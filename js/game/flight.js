// Simulación de un tramo de vuelo (tiempo real con pausa).

import { layout, shipStats } from './ship.js';
import { rng, alive, addRes, log, DIFFICULTY, caps } from './run.js';
import { has, tadd, displayName } from './crew.js';
import { modEff } from './loot.js';
import { NODE_TYPES } from './data/regions.js';
import { legDistance, legWeather } from './map.js';
import {
  TUNE, SYSTEMS, emit, alert, ensureTask, removeTask, findTask, igniteRoom, injure, outsideTemp, hull, damageModule, damageRoom, crewRoom,
} from './fcore.js';
import { placeCrew, assign, stepCrew } from './crewai.js';
import { planLeg, triggerIncident, stepCombat, stepPvo, weaponPowered, hitRoom } from './incidents.js';
import { clamp } from '../engine/util.js';

export const THROTTLE = [
  { name: 'Económico', speed: 0.74, fuel: 0.6, wear: 0.5 },
  { name: 'Crucero', speed: 1, fuel: 1, wear: 1 },
  { name: 'Máximo', speed: 1.22, fuel: 1.6, wear: 2.4 },
];

export function createFlight(run, toId, opts = {}) {
  const map = run.map;
  const from = map.nodes[map.cur];
  const to = map.nodes[toId];
  const st = shipStats(run.ship);
  const dist = opts.dist ?? legDistance(from, to);
  const weather = legWeather(map, from, to);
  const R = run.region;
  const danger = clamp(0.1 + R * 0.09 + (NODE_TYPES[to.type].danger || 0) + weather * 0.2, 0, 1);
  const estSpeed = Math.max(250, estimateSpeed(run, st));
  const f = {
    from: from.id, to: to.id, toType: to.type, toName: to.name,
    dist, done: 0, weather, danger, t: 0,
    estDur: (dist / estSpeed) * 60,
    final: !!opts.final,
    tasks: [], radioQueue: [], enemies: [], popups: [], alerts: [], fx: [],
    schedule: [], combat: false, target: null, evasive: 0, evasiveCd: 0, flareT: 0, drain: 0,
    pvo: null, incoming: null, leak: 0, rats: 0, anomaly: 0,
    nextId: 1, acc: 0, assignAcc: 0, autosaveAcc: 0,
    stats: st, ctx: null, speedKmh: 0, fuelRate: 0, arrived: false, crashed: false,
    start: { fuel: run.res.fuel, hull: null, clock: run.clock, fires: run.stats.fires, kills: run.stats.kills, deaths: run.stats.deaths, ammo: run.res.ammo, parts: run.res.parts },
  };
  run.flight = f;
  // calor inicial y tripulación
  run.ship.scram = 0;
  for (const id in run.ship.rooms) {
    const rs = run.ship.rooms[id];
    rs.fire = 0;
    rs.ice = 0;
    rs.dark = false;
    rs.o2 = 100;
    rs.smoke = 0;
    rs.temp = 14;
  }
  placeCrew(run);
  f.start.hull = hull(run);
  planLeg(run, f);
  log(run, `Despegue hacia ${to.name} (${dist} km).`, 'info');
  return f;
}

export function estimateSpeed(run, st) {
  let thrust = 0;
  for (const id of st.engines) {
    const m = run.ship.slots[id];
    thrust += m.stats.thrust * modEff(m);
  }
  const mass = st.mass;
  const massK = 1 / (1 + Math.max(0, mass - 30) * 0.012);
  return thrust * massK * THROTTLE[run.ship.throttle].speed;
}

// Contexto del paso: quién está en cada estación, estadísticas, auras
function buildCtx(run, f) {
  const L = layout();
  const st = shipStats(run.ship);
  f.stats = st;
  const atStation = {};
  for (const t of f.tasks) {
    if (t.type !== 'station') continue;
    for (const id of t.workers || []) {
      const c = run.crew.find((x) => x.id === id);
      if (c && c.atWork) atStation[t.station] = c;
    }
  }
  const roomAura = {};
  let auraAll = 0;
  for (const c of alive(run)) {
    const a = tadd(c, 'aura');
    if (a) {
      const r = crewRoom(c);
      if (r) roomAura[r] = (roomAura[r] || 0) + a;
    }
    auraAll += tadd(c, 'auraAll');
  }
  const moraleMods = Object.values(run.ship.slots).filter((m) => m && m.type === 'moral' && m.int > 0);
  const ctx = {
    D: DIFFICULTY[run.difficulty], stats: st, atStation, pilot: atStation.piloto || null, copilot: atStation.copiloto || null,
    roomAura, auraAll, moraleMods,
  };
  f.ctx = ctx;
  return ctx;
}

// --- Tareas persistentes de estación ------------------------------------------
function maintainStations(run, f, ctx) {
  const L = layout();
  const S = run.ship.slots;
  const P = run.ship.power;
  const C = caps(run);
  for (const s of L.stationList) {
    let ok = true;
    if (s.slot) ok = !!S[s.slot] && S[s.slot].int > 0 && weaponPowered(run, s.slot);
    if (s.id === 'radio') ok = !!S.radio_eq && S.radio_eq.int > 0 && (P.radio || 0) > 0;
    if (s.id === 'ciencia') ok = run.region >= 1 || f.anomaly > 0 || run.res.knowledge > 0;
    if (s.id === 'cocina') ok = !!S.comedor_coc && S.comedor_coc.int > 0 && (P.cocina || 0) > 0 && run.res.rations > 0 && run.res.meals < C.meals;
    if (s.id === 'taller') ok = run.orders.length > 0 && (P.taller || 0) > 0;
    if (s.id === 'reactor') ok = !!S.reactor_core;
    if (s.id === 'copiloto') ok = true;
    const key = 'st:' + s.id;
    if (ok) {
      const t = ensureTask(run, key, {
        type: 'station', cat: s.cat, room: s.room, station: s.id, label: s.label, x: s.x, y: s.y, slots: 1, persistent: true,
        weight: s.id === 'piloto' ? 200 : s.id === 'navegante' ? 85 : s.id === 'reactor' ? (run.ship.heat > 70 ? 160 : 60) : s.minor ? -40 : s.cat === 'armas' ? (f.combat || f.incoming ? 120 : -20) : 0,
      });
      const fight = f.combat || f.incoming;
      if (s.cat === 'armas') t.weight = fight ? 260 : -30;
      else if (fight && ['cocina', 'politica', 'ciencia', 'taller'].includes(s.id)) t.weight = -80;
      else if (['cocina', 'politica', 'ciencia', 'taller'].includes(s.id)) t.weight = 0;
      if (s.id === 'radio') t.data.urgent = f.radioQueue.some((q) => q.kind === 'iff');
      if (s.id === 'radio') t.weight = t.data.urgent ? 200 : f.radioQueue.length ? 40 : -10;
    } else removeTask(run, key);
  }
}

function maintainHazardTasks(run, f) {
  const L = layout();
  for (const room of L.roomList) {
    const rs = run.ship.rooms[room.id];
    if (rs.fire > 0) ensureTask(run, 'fire:' + room.id, { type: 'fire', cat: 'emergencia', room: room.id, label: `Apagar fuego: ${room.name}`, slots: 3, weight: 120 });
    else removeTask(run, 'fire:' + room.id);
    if (rs.breach > 0) ensureTask(run, 'breach:' + room.id, { type: 'breach', cat: 'reparar', room: room.id, label: `Sellar brecha: ${room.name}`, slots: 2, weight: 130 });
    else removeTask(run, 'breach:' + room.id);
    if (rs.int < 70) ensureTask(run, 'hull:' + room.id, { type: 'hull', cat: 'reparar', room: room.id, label: `Reparar estructura: ${room.name}`, slots: 2, weight: 10 });
    if (rs.ice > 15) ensureTask(run, 'ice:' + room.id, { type: 'ice', cat: 'reparar', room: room.id, label: `Picar hielo: ${room.name}`, slots: 2, weight: 60, x: L.engineSpot[room.id], y: room.floor });
  }
  for (const s of L.slots) {
    const m = run.ship.slots[s.id];
    if (!m || s.room === 'fuselaje') continue;
    const key = 'rep:' + s.id;
    if (m.int < m.maxInt * 0.72) {
      const room = L.rooms[s.room];
      ensureTask(run, key, {
        type: 'repair', cat: 'reparar', room: s.room, label: `Reparar ${m.name.split('«')[0].trim()}`, slots: 2,
        weight: m.int <= 0 ? (s.type === 'reactor' || s.type === 'motor' ? 160 : 70) : s.type === 'reactor' ? 45 : 25, data: { slot: s.id }, x: s.type === 'motor' ? L.engineSpot[s.room] : null, y: s.type === 'motor' ? room.floor : null,
      });
    }
  }
  // pacientes
  for (const c of alive(run)) {
    const key = 'heal:' + c.id;
    if (c.act?.kind === 'patient' && crewRoom(c) === 'enfermeria') {
      ensureTask(run, key, {
        type: 'heal', cat: 'medicina', room: 'enfermeria', label: `Atender a ${c.sur}`, slots: 1, weight: c.hp < 30 ? 90 : 35,
        x: Math.round(c.tx) + 1, y: L.rooms.enfermeria.floor, data: { crew: c.id },
      });
    } else removeTask(run, key);
  }
}

// --- Sistemas -------------------------------------------------------------
export const BATTERY = 2;
function powerCap(run, f, ctx) {
  let cap = ctx.stats.power + (run.ship.overload && ctx.stats.power > 0 ? 3 : 0);
  if (run.ship.scram > 0) cap = 0;
  if (f.drain > 0) cap = Math.max(0, cap - 3);
  // baterías de emergencia: siempre queda algo para el soporte vital
  f.onBattery = cap < BATTERY;
  return Math.max(cap, BATTERY);
}

export function powerUsed(run) {
  return SYSTEMS.reduce((s, sys) => s + (run.ship.power[sys.id] || 0), 0);
}

const POWER_ORDER = ['vital', 'calef', 'armas', 'radio', 'radar', 'medico', 'cocina', 'taller'];

// Reparte la energía deseada por el jugador según la capacidad disponible
export function allocatePower(run, cap) {
  const ship = run.ship;
  if (!ship.want) ship.want = { ...ship.power };
  let left = cap;
  for (const id of POWER_ORDER) {
    const w = ship.want[id] || 0;
    const v = Math.max(0, Math.min(w, left));
    ship.power[id] = v;
    left -= v;
  }
}

function enforcePower(run, f, ctx) {
  const cap = powerCap(run, f, ctx);
  allocatePower(run, cap);
  f.powerCap = cap;
}

function stepReactor(run, f, ctx, dt) {
  const ship = run.ship;
  const core = ship.slots.reactor_core;
  if (ship.scram > 0) {
    ship.scram = Math.max(0, ship.scram - dt);
    ship.heat = Math.max(0, ship.heat - 3 * dt);
    if (ship.scram <= 0) alert(run, 'El reactor vuelve a estar en línea.', 'info');
    return;
  }
  if (!core) return;
  const cap = Math.max(1, ctx.stats.power);
  const load = powerUsed(run) / cap;
  const op = ctx.atStation.reactor;
  let cool = 1.1 + ctx.stats.cool + (op ? 0.5 + op.skills.ing * 0.07 : 0);
  if (core.int < core.maxInt * 0.5) cool *= 0.8;
  const gen = load * 2.4 * ctx.stats.heat * (ship.overload ? 2.2 : 1);
  ship.heat = clamp(ship.heat + (gen - cool) * dt, 18, 120);
  const rs = ship.rooms.reactor;
  const leak = Math.max(0, ship.heat - 65) * 1.6 * (1 - ctx.stats.shield) + (core.int < core.maxInt * 0.3 ? 12 : 0);
  rs.rad = leak;
  for (const lk of layout().linksOf.reactor) {
    const closed = ship.doors && ship.doors[lk.key];
    ship.rooms[lk.other].rad = Math.max(ship.rooms[lk.other].rad * 0.9, leak * (closed ? 0.08 : 0.3));
  }
  if (ship.heat > 90) {
    damageModule(run, 'reactor_core', 0.8 * dt);
    if (!f.heatWarned) {
      f.heatWarned = true;
      alert(run, '¡Temperatura crítica en el reactor! Reducid la carga o haced SCRAM.', 'danger', { pause: true, sound: 'alarm' });
    }
  } else if (ship.heat < 80) f.heatWarned = false;
  if (ship.heat >= 118) {
    // fusión parcial
    alert(run, '¡FUSIÓN PARCIAL DEL NÚCLEO!', 'danger', { pause: true, sound: 'explosion' });
    emit(run, { kind: 'bigboom', room: 'reactor' });
    hitRoom(run, 'reactor', 25, 'la explosión del reactor');
    igniteRoom(run, 'reactor', 70);
    damageModule(run, 'reactor_core', 60);
    ship.heat = 70;
    ship.scram = 15;
  }
}

function stepEngines(run, f, ctx, dt) {
  const ship = run.ship;
  const thr = THROTTLE[ship.throttle];
  let thrust = 0;
  let fuel = 0;
  const L = layout();
  for (const id of ctx.stats.engines) {
    const m = ship.slots[id];
    const room = L.slots.find((s) => s.id === id).room;
    const rs = ship.rooms[room];
    const eff = modEff(m) * (1 - rs.ice / 140) * (rs.fire > 50 ? 0.7 : 1);
    if (m.int <= 0) continue;
    thrust += m.stats.thrust * eff;
    fuel += m.stats.fuel * thr.fuel;
    // desgaste y fallos
    m.int = Math.max(0, m.int - 0.045 * thr.wear * dt * (2 - m.rel));
    const pFail = (1 - m.rel) * 0.0035 * thr.wear * (m.int < m.maxInt * 0.5 ? 2 : 1) * DIFFICULTY[run.difficulty].incident;
    if (rng(run).chance(pFail * dt)) {
      damageModule(run, id, rng(run).int(15, 30));
      alert(run, `Fallo en ${m.name}.`, 'warn', { sound: 'warn' });
      emit(run, { kind: 'sparks', room });
    }
    // hielo
    if (f.weather > 0.1 || run.region >= 3) {
      const iceRate = (f.weather * TUNE.iceRate + (run.region >= 3 ? 0.08 : 0)) * (1 - (m.stats.iceRes || 0)) * (1 - ctx.stats.deice);
      rs.ice = clamp(rs.ice + iceRate * dt, 0, 100);
    }
  }
  // otros módulos: fallos por fiabilidad
  if (rng(run).chance(dt * 0.02)) {
    const ids = Object.keys(ship.slots).filter((id) => ship.slots[id] && !['motor', 'moral', 'blindaje'].includes(ship.slots[id].type));
    const id = rng(run).pick(ids);
    const m = ship.slots[id];
    if (m && rng(run).chance((1 - m.rel) * 0.6)) {
      damageModule(run, id, rng(run).int(10, 25));
      alert(run, `Avería menor: ${m.name}.`, 'warn');
    }
  }
  const massK = 1 / (1 + Math.max(0, ctx.stats.mass - 30) * 0.012);
  const pilot = ctx.pilot;
  let pilotK = pilot ? 0.92 + pilot.skills.pil * 0.016 : 0.55 + ctx.stats.autopilot * 0.35;
  if (ctx.copilot) pilotK += 0.03;
  const mq = ctx.atStation.maquinas;
  const mqK = mq ? 1.03 + mq.skills.ing * 0.004 : 1;
  const nav = ctx.atStation.navegante;
  const navK = nav ? 1.0 + nav.skills.nav * 0.014 * (has(nav, 'calculador') ? 1.25 : 1) : 0.84;
  let speed = thrust * massK * thr.speed * pilotK * mqK;
  if (f.anomaly > 0) speed *= 0.9;
  if (f.evasive > 0) speed *= 0.85;
  if ((run.res.fuel || 0) <= 0) speed = 0;
  f.speedKmh = speed;
  f.fuelRate = fuel * (mq ? 0.95 : 1) + f.leak;
  const km = (speed * navK * dt) / 60;
  f.done += km;
  run.stats.km += km;
  if (speed > 0) addRes(run, 'fuel', -(f.fuelRate * dt) / 60);
  if ((run.res.fuel || 0) <= 0 && !f.outOfFuel) {
    f.outOfFuel = true;
    alert(run, '¡SIN COMBUSTIBLE! Los motores se apagan.', 'danger', { pause: true, sound: 'alarm' });
  }
}

function stepRooms(run, f, ctx, dt) {
  const ship = run.ship;
  const L = layout();
  const out = outsideTemp(run);
  const calef = ship.power.calef || 0;
  const vital = ship.power.vital || 0;
  const r = rng(run);
  for (const room of L.roomList) {
    const rs = ship.rooms[room.id];
    // temperatura
    let target = out + room.insul + calef * 14 + (room.heatSrc || 0) * (ship.scram > 0 && room.id === 'reactor' ? 0 : 1);
    if (room.id === 'comedor' && f.tasks.some((t) => t.station === 'cocina' && t.workers?.length)) target += 6;
    if (rs.fire > 0) target += rs.fire * 0.5;
    if (rs.breach > 0) target = out;
    if (rs.dark) target -= 4;
    const k = rs.breach > 0 ? 0.3 : 0.06;
    rs.temp += (target - rs.temp) * Math.min(1, k * dt);
    // oxígeno (despresurización voluntaria = como una gran brecha)
    if (rs.vent > 0) {
      rs.vent = Math.max(0, rs.vent - dt);
      rs.o2 = Math.max(0, rs.o2 - 30 * dt);
      rs.temp += (out - rs.temp) * Math.min(1, 0.4 * dt);
      if (rs.vent <= 0) alert(run, `${room.name}: compuertas cerradas, represurizando.`, 'info');
    } else if (rs.breach > 0) rs.o2 = Math.max(0, rs.o2 - TUNE.breachO2 * rs.breach * dt);
    else {
      const regen = (vital === 0 ? -0.15 : vital === 1 ? 2.5 : 4.5) * (1 + ctx.stats.o2);
      rs.o2 = clamp(rs.o2 + regen * dt, 0, 100);
    }
    if (rs.fire > 0) rs.o2 = Math.max(0, rs.o2 - rs.fire * 0.02 * dt);
    // fuego
    if (rs.fire > 0) {
      if (rs.o2 < 15) rs.fire = Math.max(0, rs.fire - 8 * dt);
      else rs.fire = Math.min(100, rs.fire + TUNE.fireGrow * (rs.o2 / 100) * (1 - ctx.stats.fireSup) * dt);
      damageRoom(run, room.id, rs.fire * 0.016 * dt);
      for (const s of L.slots) if (s.room === room.id && ship.slots[s.id]) ship.slots[s.id].int = Math.max(0, ship.slots[s.id].int - rs.fire * 0.022 * dt);
      if (room.id === 'bodega' && r.chance(dt * rs.fire * 0.002)) {
        const lost = Math.min(run.res.rations, r.int(1, 3));
        addRes(run, 'rations', -lost);
      }
      if (rs.fire > 45) {
        for (const lk of L.linksOf[room.id]) {
          if (ship.doors && ship.doors[lk.key]) continue; // compuerta cerrada
          if (r.chance(0.02 * dt * (rs.fire / 60))) igniteRoom(run, lk.other, 15);
        }
      }
      rs.smoke = Math.min(100, rs.smoke + rs.fire * 0.05 * dt);
    } else rs.smoke = Math.max(0, rs.smoke - 4 * dt * (vital > 0 ? 1 : 0.3));
    // oscuridad temporal
    if (rs.dark) {
      rs.darkT = (rs.darkT || 0) - dt;
      if (rs.darkT <= 0) rs.dark = false;
    }
    // estructura muy baja: riesgo de brecha
    if (rs.int < 25 && rs.breach === 0 && r.chance(dt * 0.01)) {
      rs.breach = 1;
      alert(run, `La estructura cede en ${room.name}.`, 'danger', { pause: true, sound: 'hiss' });
    }
  }
  // difusión de oxígeno y radiación decae
  for (const lk of L.links) {
    if (ship.doors && ship.doors[lk.key]) continue;
    const A = ship.rooms[lk.a];
    const B = ship.rooms[lk.b];
    const d = (B.o2 - A.o2) * 0.1 * dt;
    A.o2 += d;
    B.o2 -= d;
    // el humo también pasa
    const sm = (B.smoke - A.smoke) * 0.05 * dt;
    A.smoke += sm;
    B.smoke -= sm;
  }
  for (const room of L.roomList) {
    const rs = ship.rooms[room.id];
    if (room.id !== 'reactor') rs.rad = Math.max(0, rs.rad - 0.5 * dt);
  }
  // ratas
  if (f.rats && r.chance(dt * 0.1)) addRes(run, 'rations', -1);
}

// --- Paso principal ------------------------------------------------------
export function stepFlight(run, dtReal) {
  const f = run.flight;
  if (!f || f.arrived || run.over) return;
  const mult = run.speed || 1;
  f.acc += dtReal * mult; // 1 s real = 1 min de juego a ×1
  let steps = 0;
  while (f.acc >= TUNE.step && steps < 200) {
    f.acc -= TUNE.step;
    tick(run, f, TUNE.step);
    steps++;
    if (f.arrived || run.over || f.popups.length) {
      f.acc = 0;
      break;
    }
  }
}

function tick(run, f, dt) {
  f.t += dt;
  run.clock += dt;
  // Moscú se impacienta: la sospecha crece despacio durante el vuelo
  run.suspicion = Math.min(100, run.suspicion + (dt / 60) * 1.4 * DIFFICULTY[run.difficulty].susp);
  const ctx = buildCtx(run, f);
  enforcePower(run, f, ctx);
  // incidentes programados
  while (f.schedule.length && f.schedule[0].at <= f.t) triggerIncident(run, f.schedule.shift());
  // temporizadores
  if (f.evasive > 0) f.evasive = Math.max(0, f.evasive - dt);
  if (f.evasiveCd > 0) f.evasiveCd = Math.max(0, f.evasiveCd - dt);
  if (f.flareT > 0) f.flareT = Math.max(0, f.flareT - dt);
  if (f.drain > 0) f.drain = Math.max(0, f.drain - dt);
  if (f.anomaly > 0) f.anomaly = Math.max(0, f.anomaly - dt);
  // tareas
  f.assignAcc += dt;
  if (f.assignAcc >= TUNE.assignEvery) {
    f.assignAcc = 0;
    maintainStations(run, f, ctx);
    maintainHazardTasks(run, f);
    assign(run, ctx);
  }
  stepCrew(run, dt, ctx);
  stepReactor(run, f, ctx, dt);
  stepEngines(run, f, ctx, dt);
  stepRooms(run, f, ctx, dt);
  stepCombat(run, dt, ctx);
  stepPvo(run, dt, ctx);
  // fin de tramo
  const h = hull(run);
  if (h <= 22) {
    f.crashed = true;
    run.over = { kind: 'lose', ending: 'destruido' };
    return;
  }
  if (!alive(run).length) {
    run.over = { kind: 'lose', ending: 'tripulacion' };
    return;
  }
  if (f.done >= f.dist) {
    if (f.combat || f.incoming) {
      if (!f.holdWarned) {
        f.holdWarned = true;
        alert(run, 'No se puede aterrizar con cazas en el aire.', 'warn');
      }
      return;
    }
    f.arrived = true;
    land(run, f);
  } else if (f.outOfFuel && f.speedKmh <= 0) {
    f.arrived = true;
    f.forced = true;
    land(run, f);
  }
}

function land(run, f) {
  // resumen del tramo para la pantalla de llegada
  const S = f.start || {};
  run.lastLeg = {
    km: Math.round(f.done), min: Math.round(run.clock - (S.clock ?? run.clock)),
    fuel: +(S.fuel - run.res.fuel).toFixed(1), hull: Math.round((S.hull ?? hull(run)) - hull(run)),
    fires: run.stats.fires - (S.fires || 0), kills: run.stats.kills - (S.kills || 0), deaths: run.stats.deaths - (S.deaths || 0),
    ammo: Math.max(0, Math.round((S.ammo ?? run.res.ammo) - run.res.ammo)), parts: Math.max(0, Math.round((S.parts ?? run.res.parts) - run.res.parts)),
  };
  // en tierra: se apagan los fuegos y se funde el hielo
  for (const id in run.ship.rooms) {
    const rs = run.ship.rooms[id];
    rs.fire = 0;
    rs.ice = 0;
    rs.breach = 0;
    rs.o2 = 100;
    rs.rad = 0;
    rs.vent = 0;
  }
  run.ship.heat = 25;
  run.ship.overload = false;
  run.stats.legs++;
  for (const c of run.crew) {
    c.act = null;
    c.order = null;
    c.breakdown = null;
    c.path = null;
  }
  emit(run, { kind: 'landed' });
}

// --- Acciones del jugador --------------------------------------------------
export function setPower(run, sys, value) {
  const S = SYSTEMS.find((s) => s.id === sys);
  if (!S) return false;
  const ship = run.ship;
  if (!ship.want) ship.want = { ...ship.power };
  value = clamp(value, 0, S.max);
  const f = run.flight;
  const cap = f?.powerCap ?? shipStats(ship).power;
  const used = SYSTEMS.reduce((a, s2) => a + (s2.id === sys ? 0 : ship.want[s2.id] || 0), 0);
  if (used + value > cap) value = Math.max(0, cap - used);
  ship.want[sys] = value;
  allocatePower(run, cap);
  return true;
}

export function evasiveManeuver(run) {
  const f = run.flight;
  if (!f || f.evasiveCd > 0 || !f.ctx?.pilot) return false;
  const r = rng(run);
  f.evasive = 2.5;
  f.evasiveCd = 9;
  addRes(run, 'fuel', -0.3);
  emit(run, { kind: 'shake', amount: 7 });
  alert(run, `${displayName(f.ctx.pilot)}: «¡Agarraos!» Maniobra evasiva.`, 'info', { sound: 'flak' });
  for (const c of alive(run)) {
    const seated = c.atWork || c.act?.kind === 'sleep' || c.act?.kind === 'patient';
    if (!seated && r.chance(0.22)) injure(run, c, r.int(3, 8), 'un golpe durante una maniobra');
  }
  return true;
}

export function launchFlares(run) {
  const f = run.flight;
  if (!f || (run.res.flares || 0) < 1 || f.flareT > 0) return false;
  addRes(run, 'flares', -1);
  f.flareT = 2.5;
  emit(run, { kind: 'flares' });
  alert(run, 'Señuelos lanzados.', 'info', { sound: 'gun' });
  return true;
}

export function scram(run) {
  if (run.ship.scram > 0) return false;
  run.ship.scram = 6;
  alert(run, 'SCRAM: barras de control insertadas. Sin energía durante unos minutos.', 'warn', { sound: 'scram' });
  return true;
}

export function toggleDoor(run, key) {
  run.ship.doors = run.ship.doors || {};
  run.ship.doors[key] = !run.ship.doors[key];
  return run.ship.doors[key];
}

export function ventRoom(run, roomId) {
  const rs = run.ship.rooms[roomId];
  if (!rs || rs.vent > 0) return false;
  rs.vent = 4;
  alert(run, `Despresurizando ${layout().rooms[roomId].name}: el fuego se ahogará… y quien esté dentro, también.`, 'warn', { sound: 'hiss' });
  emit(run, { kind: 'breach', room: roomId });
  return true;
}

export function toggleOverload(run) {
  run.ship.overload = !run.ship.overload;
  alert(run, run.ship.overload ? 'Reactor en SOBRECARGA: +3 de energía, el calor se dispara.' : 'Sobrecarga desactivada.', run.ship.overload ? 'warn' : 'info', { sound: run.ship.overload ? 'warn' : 'click' });
  return run.ship.overload;
}

export function orderCrew(run, crewId, order) {
  const c = run.crew.find((x) => x.id === crewId);
  if (!c || c.dead) return;
  c.order = order;
  if (c.act && ['sleep', 'eat', 'warm', 'drink'].includes(c.act.kind)) c.act = null;
  if (run.flight) run.flight.assignAcc = 99; // reasignar ya
}
