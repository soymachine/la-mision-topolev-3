// Director de incidentes, catálogo de incidentes y combate aéreo.

import { layout } from './ship.js';
import { rng, alive, addRes, log, DIFFICULTY, addSuspicion } from './run.js';
import { has, displayName } from './crew.js';
import { ENEMIES, ENEMY_GROUPS } from './data/enemies.js';
import {
  emit, alert, ensureTask, igniteRoom, breachRoom, damageModule, damageRandomModule, damageRoom, injure, crewRoom, modulesInRoom,
} from './fcore.js';
import { newMessage, onKill } from './directives.js';
import { clamp } from '../engine/util.js';

const ROOM_IDS = () => layout().roomList.map((r) => r.id);

function poisson(r, lambda) {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r.next();
  } while (p > L && k < 20);
  return k - 1;
}

// --- Planificación del tramo --------------------------------------------------
export function planLeg(run, f) {
  const r = rng(run);
  const D = DIFFICULTY[run.difficulty];
  const dur = f.estDur;
  const first = run.stats.legs === 0;
  const lambda = (0.7 + f.danger * 3.2 + f.weather * 2) * (dur / 60) * D.incident * (first ? 0.35 : 1);
  const n = Math.min(10, poisson(r, lambda));
  const sched = [];
  for (let i = 0; i < n; i++) sched.push({ at: r.float(3, Math.max(5, dur - 4)), type: pickIncident(run, f) });
  // combate
  const pCombat = (0.1 + f.danger * 0.6 + (run.flags.warned ? 0.15 : 0)) * (D.incident > 1 ? 1.15 : D.incident < 1 ? 0.8 : 1);
  if (r.chance(pCombat) && !f.final && !first) {
    run.flags.warned = 0;
    sched.push({ at: r.float(dur * 0.15, dur * 0.6), type: 'combate' });
  }
  // PVO al acercarse a una base militar
  if (f.toType === 'militar' && r.chance(0.75)) sched.push({ at: Math.max(4, dur * 0.7), type: 'pvo' });
  else if (r.chance(0.05 + f.danger * 0.1)) sched.push({ at: r.float(5, dur * 0.8), type: 'pvo' });
  // la Señal: fase final
  if (f.final) {
    for (let k = 0; k < 5; k++) sched.push({ at: 4 + k * (dur / 6), type: 'senal' });
    sched.push({ at: dur * 0.35, type: 'combate', group: ['esfera', 'esfera'] });
  }
  sched.sort((a, b) => a.at - b.at);
  f.schedule = sched;
}

function pickIncident(run, f) {
  const r = rng(run);
  const w = f.weather;
  const items = [
    ['averia', 3], ['fuego', 2], ['brecha', 0.8 + w], ['turbulencia', 0.8 + w * 4], ['sobrecalor', 1], ['mensaje', 2.4],
    ['enfermedad', 0.6], ['fuga', 0.7], ['cortocircuito', 0.9],
  ];
  if (w > 0.15 || run.region >= 3) items.push(['hielo', 0.6 + w * 6]);
  if (w > 0.3) items.push(['rayo', w * 2.2]);
  if ((run.res.rations || 0) > 8) items.push(['rata', 0.5]);
  if (alive(run).some((c) => has(c, 'saboteador'))) items.push(['sabotaje', 2]);
  if (run.region >= 2) items.push(['anomalia', run.region === 2 ? 0.4 : run.region === 3 ? 1.5 : 3]);
  if (!run.flags.polizon) items.push(['polizon', 0.35]);
  if ((run.res.meals || 0) > 3) items.push(['intoxicacion', 0.5]);
  if (run.ship.slots.reactor_core) items.push(['filtracion', 0.6]);
  if (run.region <= 2) items.push(['pajaros', 0.5]);
  items.push(['corriente', 0.5]);
  return r.weighted(items);
}

// --- Incidentes ---------------------------------------------------------
export function triggerIncident(run, inc) {
  const r = rng(run);
  const f = run.flight;
  const L = layout();
  switch (inc.type) {
    case 'averia': {
      const slots = Object.keys(run.ship.slots).filter((id) => run.ship.slots[id] && run.ship.slots[id].int > 0 && run.ship.slots[id].type !== 'moral' && run.ship.slots[id].type !== 'blindaje');
      if (!slots.length) return;
      const weights = slots.map((id) => [id, (run.ship.slots[id].type === 'motor' ? 3 : 1) * (1.2 - run.ship.slots[id].rel)]);
      const id = r.weighted(weights);
      const m = run.ship.slots[id];
      damageModule(run, id, r.int(18, 42));
      alert(run, `Avería: ${m.name}.`, 'warn', { sound: 'warn' });
      const room = L.slots.find((s) => s.id === id)?.room;
      if (room && L.rooms[room]) emit(run, { kind: 'sparks', room });
      if ((m.type === 'motor' || m.type === 'reactor') && r.chance(0.2)) igniteRoom(run, room, 18);
      return;
    }
    case 'fuego': {
      const room = r.weighted([['reactor', 3], ['maquinas', 3], ['motor1', 2], ['motor2', 2], ['comedor', 2.5], ['taller', 2], ['bodega', 1.5], ['radio', 1], ['dormitorio', 1], ['enfermeria', 0.6], ['cabina', 0.6], ['navegacion', 0.6], ['comisaria', 0.8]]);
      igniteRoom(run, room, r.int(18, 34));
      return;
    }
    case 'brecha': {
      const ids = ROOM_IDS();
      const room = r.weighted(ids.map((id) => [id, 0.3 + (110 - run.ship.rooms[id].int) / 40]));
      damageRoom(run, room, r.int(5, 12));
      breachRoom(run, room, 1);
      return;
    }
    case 'hielo': {
      const amt = r.int(22, 40) * (1 + f.weather * 0.5);
      for (const id of ['motor1', 'motor2']) {
        if (r.chance(0.7)) run.ship.rooms[id].ice = clamp(run.ship.rooms[id].ice + amt * (1 - f.stats.deice), 0, 100);
      }
      alert(run, 'Se acumula hielo en los motores. Hay que salir a picarlo.', 'warn', { sound: 'warn' });
      return;
    }
    case 'turbulencia': {
      const pilot = f.ctx?.pilot;
      const skill = pilot ? pilot.skills.pil : 0;
      emit(run, { kind: 'shake', amount: 5 + f.weather * 4 });
      alert(run, 'Turbulencias severas.', 'warn', { sound: 'flak' });
      let hurt = 0;
      for (const c of alive(run)) {
        const seated = c.atWork || c.act?.kind === 'sleep' || c.act?.kind === 'patient';
        if (seated) continue;
        const p = clamp(0.32 - skill * 0.025 - f.stats.turb + f.weather * 0.1, 0.03, 0.6);
        if (r.chance(p)) {
          injure(run, c, r.int(4, 11), 'un golpe por turbulencias');
          hurt++;
        }
      }
      if (hurt) log(run, `${hurt} tripulante(s) heridos por las turbulencias.`, 'bad');
      return;
    }
    case 'sobrecalor':
      run.ship.heat = clamp(run.ship.heat + r.int(15, 28), 0, 120);
      alert(run, 'Pico de temperatura en el reactor.', 'warn', { sound: 'warn' });
      return;
    case 'mensaje':
      f.radioQueue.push({ kind: 'decode', need: r.int(10, 16), progress: 0, msg: newMessage(run) });
      alert(run, 'Mensaje cifrado entrante desde Moscú.', 'party', { sound: 'radio' });
      return;
    case 'enfermedad': {
      const c = r.pick(alive(run));
      if (!c) return;
      c.sick = 1;
      alert(run, `${displayName(c)} tiene fiebre alta.`, 'warn');
      return;
    }
    case 'rata':
      f.rats = 1;
      ensureTask(run, 'rat', { type: 'rat', cat: 'emergencia', room: 'bodega', label: 'Cazar ratas', slots: 2, need: 6, weight: -60 });
      alert(run, 'Hay ratas en la bodega. Se están comiendo las raciones.', 'warn');
      return;
    case 'fuga': {
      const room = r.pick(['motor1', 'motor2']);
      f.leak = r.float(0.8, 1.6);
      ensureTask(run, 'leak', { type: 'leak', cat: 'reparar', room, label: 'Taponar fuga de combustible', slots: 2, need: 10, weight: 50, x: L.engineSpot[room], y: L.rooms[room].floor });
      alert(run, 'Fuga de combustible en una góndola.', 'danger', { pause: true, sound: 'alarm' });
      return;
    }
    case 'rayo': {
      emit(run, { kind: 'flash', color: '#ffffff' });
      emit(run, { kind: 'shake', amount: 6 });
      const room = r.pick(['radio', 'navegacion', 'cabina', 'dorsal']);
      damageRandomModule(run, room, r.int(15, 30));
      run.ship.heat = clamp(run.ship.heat + 8, 0, 120);
      alert(run, '¡Un rayo alcanza el fuselaje!', 'danger', { sound: 'explosion' });
      if (r.chance(0.3)) igniteRoom(run, room, 20);
      return;
    }
    case 'cortocircuito': {
      const room = r.pick(ROOM_IDS());
      run.ship.rooms[room].dark = true;
      run.ship.rooms[room].darkT = r.int(8, 14);
      damageRandomModule(run, room, r.int(8, 16));
      emit(run, { kind: 'sparks', room });
      alert(run, `Cortocircuito en ${L.rooms[room].name}.`, 'warn', { sound: 'warn' });
      if (r.chance(0.25)) igniteRoom(run, room, 16);
      return;
    }
    case 'sabotaje': {
      const s = alive(run).find((c) => has(c, 'saboteador'));
      if (!s) return;
      const room = crewRoom(s) || 'maquinas';
      const sid = damageRandomModule(run, room, r.int(30, 50)) || damageRandomModule(run, 'maquinas', 35);
      if (r.chance(0.45)) igniteRoom(run, room, 28);
      emit(run, { kind: 'sparks', room });
      alert(run, 'Avería sospechosa: alguien ha manipulado el equipo.', 'danger', { pause: true, sound: 'alarm' });
      run.flags.sabotages = (run.flags.sabotages || 0) + 1;
      return;
    }
    case 'anomalia':
    case 'senal': {
      f.anomaly = r.float(10, 18);
      emit(run, { kind: 'anomaly' });
      alert(run, inc.type === 'senal' ? 'La Señal satura todos los instrumentos.' : 'Una luz violeta envuelve el avión. Las brújulas giran.', 'party', { pause: inc.type !== 'senal', sound: 'radio' });
      for (const c of alive(run)) {
        const k = has(c, 'supersticioso') ? 2 : 1;
        c.morale = clamp(c.morale - 6 * k, 0, 100);
        if (r.chance(0.08 * k) && !c.breakdown) c.breakdown = { kind: 'panico', t: 0, dur: 8 };
      }
      if (inc.type === 'senal') {
        damageRandomModule(run, r.pick(['radio', 'navegacion', 'reactor', 'maquinas']), r.int(10, 22));
        f.drain = Math.max(f.drain || 0, 6);
      }
      return;
    }
    case 'intoxicacion': {
      const n = Math.min(alive(run).length, r.int(1, 3));
      const victims = r.shuffle([...alive(run)]).slice(0, n);
      for (const c of victims) {
        c.sick = 1;
        c.hunger = Math.min(100, c.hunger + 20);
      }
      addRes(run, 'meals', -Math.min(run.res.meals, 3));
      alert(run, `Intoxicación alimentaria: ${victims.map((c) => c.sur).join(', ')} con fiebre. Algo estaba en mal estado.`, 'warn', { sound: 'warn' });
      return;
    }
    case 'filtracion': {
      const rs = run.ship.rooms.reactor;
      rs.rad = Math.max(rs.rad, 30);
      run.ship.heat = clamp(run.ship.heat + 12, 0, 120);
      damageModule(run, 'reactor_core', r.int(10, 20));
      alert(run, 'Fuga de refrigerante en el reactor: radiación en la sala. Cerrad compuertas y reparad.', 'danger', { pause: true, sound: 'alarm' });
      emit(run, { kind: 'sparks', room: 'reactor' });
      return;
    }
    case 'pajaros': {
      const id = r.pick(['motor1_m', 'motor2_m']);
      damageModule(run, id, r.int(12, 25));
      alert(run, 'Una bandada de gansos contra un motor. Plumas y aspas dobladas.', 'warn', { sound: 'hit' });
      emit(run, { kind: 'sparks', room: id === 'motor1_m' ? 'motor1' : 'motor2' });
      return;
    }
    case 'corriente': {
      // corriente en chorro: a favor o en contra
      const fav = r.chance(0.55);
      f.dist = Math.max(f.done + 20, f.dist + (fav ? -1 : 1) * r.int(30, 80));
      alert(run, fav ? 'Corriente en chorro a favor: el tramo se acorta.' : 'Viento de cara: el tramo se alarga.', fav ? 'good' : 'warn');
      return;
    }
    case 'polizon':
      run.flags.polizon = true;
      f.popups.push({ id: 'polizon' });
      return;
    case 'pvo':
      if (f.pvo) return;
      if ((run.flags.iffCodes || 0) > 0) {
        run.flags.iffCodes--;
        alert(run, 'La PVO os interroga: los códigos IFF actualizados responden solos.', 'good');
        return;
      }
      f.pvo = { deadline: f.t + 5 + (run.ship.power.radar >= 2 ? 2 : 0), active: false, until: 0 };
      f.radioQueue.unshift({ kind: 'iff', need: 8, progress: 0 });
      alert(run, '¡La PVO os ha fijado! Transmitid el código IFF desde la radio.', 'danger', { pause: true, sound: 'alarm' });
      return;
    case 'combate': {
      const group = inc.group || r.weighted(ENEMY_GROUPS[run.region]);
      const warn = (run.ship.power.radar || 0) > 0 ? f.stats.warn / 10 : 0;
      if (warn > 0) {
        f.incoming = { at: f.t + warn, group };
        alert(run, `Radar: ${group.length} contacto${group.length > 1 ? 's' : ''} hostil${group.length > 1 ? 'es' : ''} en aproximación.`, 'danger', { pause: true, sound: 'alarm' });
      } else startCombat(run, group, true);
      return;
    }
    default:
      return;
  }
}

// --- Combate -----------------------------------------------------------------
const SECTORS = ['proa', 'popa', 'arriba', 'abajo'];
export const COVERAGE = {
  dorsal_arma: ['proa', 'popa', 'arriba'],
  ventral_arma: ['proa', 'popa', 'abajo'],
  cola_arma: ['popa', 'arriba', 'abajo'],
};
export const TURRET_STATION = { dorsal_arma: 'dorsal', ventral_arma: 'ventral', cola_arma: 'cola' };

export function startCombat(run, group, surprise = false) {
  const r = rng(run);
  const f = run.flight;
  f.enemies = f.enemies || [];
  for (const type of group) {
    const E = ENEMIES[type];
    f.enemies.push({
      id: 'e' + f.nextId++, type, hp: E.hp, maxHp: E.hp, dist: surprise ? r.int(40, 55) : r.int(85, 100),
      sector: r.pick(SECTORS), cd: r.float(E.rate[0], E.rate[1]) * 0.6, fleeing: false, ang: r.float(0, Math.PI * 2), t: 0,
    });
  }
  f.combat = true;
  if (surprise) alert(run, '¡Interceptores encima! No hubo aviso del radar.', 'danger', { pause: true, sound: 'alarm' });
}

export function evasion(run, ctx) {
  const f = run.flight;
  let e = ctx.pilot ? 0.04 + ctx.pilot.skills.pil * 0.022 : 0.02;
  e += ctx.stats.evasion;
  if (ctx.copilot) e += 0.02;
  if (f.evasive > 0) e += 0.3;
  return e;
}

export function weaponPowered(run, slotId) {
  // las unidades de "armas" se asignan por orden dorsal, ventral, cola entre las torretas armadas
  const order = ['dorsal_arma', 'ventral_arma', 'cola_arma'].filter((id) => run.ship.slots[id] && run.ship.slots[id].int > 0);
  const idx = order.indexOf(slotId);
  return idx >= 0 && idx < (run.ship.power.armas || 0);
}

export function stepCombat(run, dt, ctx) {
  const f = run.flight;
  const r = rng(run);
  const L = layout();
  if (f.incoming && f.t >= f.incoming.at) {
    const g = f.incoming.group;
    f.incoming = null;
    startCombat(run, g, false);
  }
  if (!f.enemies || !f.enemies.length) {
    if (f.combat) {
      f.combat = false;
      alert(run, 'Cielo despejado.', 'good', { sound: 'success' });
    }
    return;
  }
  const ev = evasion(run, ctx);
  // enemigos
  for (const e of f.enemies) {
    const E = ENEMIES[e.type];
    e.t += dt;
    e.ang += dt * (0.3 + E.speed * 0.02);
    if (e.fleeing) {
      e.dist += E.speed * 1.4 * dt;
      continue;
    }
    if (E.passive) {
      if (e.dist > 55) e.dist -= E.speed * dt;
      if (e.t > (E.escape || 40)) e.fleeing = true;
      continue;
    }
    if (e.dist > 32) e.dist -= E.speed * 0.6 * dt;
    if (r.chance(dt * 0.08)) e.sector = r.pick(SECTORS);
    // combustible limitado: acaban retirándose
    if (e.t > (e.maxT || (e.maxT = r.float(18, 30)))) {
      e.fleeing = true;
      alert(run, `${E.name} rompe el contacto y se retira.`, 'info');
      continue;
    }
    e.cd -= dt;
    if (e.dist <= 45 && e.cd <= 0) {
      e.cd = r.float(E.rate[0], E.rate[1]);
      enemyAttack(run, e, E, ev, ctx);
    }
  }
  // torretas
  f.turretCd = f.turretCd || {};
  for (const slotId of Object.keys(COVERAGE)) {
    const m = run.ship.slots[slotId];
    if (!m || m.int <= 0) continue;
    const st = TURRET_STATION[slotId];
    const gunner = ctx.atStation[st];
    if (!gunner) continue;
    if (!weaponPowered(run, slotId)) continue;
    f.turretCd[slotId] = (f.turretCd[slotId] ?? 1) - dt;
    if (f.turretCd[slotId] > 0) continue;
    const valid = f.enemies.filter((e) => !e.dead && e.dist <= 62 && COVERAGE[slotId].includes(e.sector));
    if (!valid.length) continue;
    let tgt = valid.find((e) => e.id === f.target) || valid.sort((a, b) => a.dist - b.dist)[0];
    const ammoUse = m.stats.ammo || 1;
    if ((run.res.ammo || 0) < ammoUse * 4) {
      if (!f.noAmmoWarned) {
        f.noAmmoWarned = true;
        alert(run, '¡Sin munición en las torretas!', 'danger', { sound: 'deny' });
      }
      continue;
    }
    addRes(run, 'ammo', -ammoUse * 4);
    f.turretCd[slotId] = 60 / (m.stats.rof || 10) * (0.85 + r.next() * 0.3);
    const E = ENEMIES[tgt.type];
    const acc = clamp(0.38 + gunner.skills.art * 0.045 + (m.stats.acc || 0) + (gunner.traits.includes('halcon') ? 0.12 : 0) + (gunner.traits.includes('veterano') ? 0.05 : 0) - E.evasion + ctx.stats.detect, 0.05, 0.95);
    const hit = r.chance(acc);
    const dmg = hit ? (m.stats.dmg || 6) * r.float(0.8, 1.25) * (m.int / m.maxInt > 0.5 ? 1 : 0.7) : 0;
    emit(run, { kind: 'shot', slot: slotId, station: st, enemy: tgt.id, hit });
    if (hit) {
      tgt.hp -= dmg;
      gunner.xp.art = (gunner.xp.art || 0) + 3;
      if (tgt.hp <= 0) {
        tgt.dead = true;
        gunner.stats.kills++;
        run.stats.kills++;
        onKill(run);
        if (E.bounty) addRes(run, 'rubles', E.bounty);
        if (E.knowledge) addRes(run, 'knowledge', E.knowledge);
        if (tgt.type !== 'esfera') addSuspicion(run, -2);
        emit(run, { kind: 'kill', enemy: tgt.id });
        alert(run, `¡${E.name} derribado por ${displayName(gunner)}!${E.bounty ? ` (+${E.bounty} ₽)` : ''}`, 'good', { sound: 'explosion' });
      } else if (!tgt.fleeing && tgt.hp < tgt.maxHp * 0.35 && r.chance(E.flee)) {
        tgt.fleeing = true;
        alert(run, `${E.name} se retira dañado.`, 'info');
      }
    }
  }
  f.enemies = f.enemies.filter((e) => !e.dead && e.dist < 115);
}

function roomCenter(roomId) {
  const R = layout().rooms[roomId];
  return { x: (R.x0 + R.x1) / 2, y: R.top + 1 };
}

function enemyAttack(run, e, E, ev, ctx) {
  const r = rng(run);
  const f = run.flight;
  let p = E.acc - ev - (f.flareT > 0 ? 0.5 : 0);
  p = clamp(p, 0.04, 0.95);
  const ids = ROOM_IDS();
  const targets = ids.map((id) => [id, (E.targets && E.targets.includes(id) ? 3 : 1) * (layout().rooms[id].deck === 'top' ? 0.5 : 1)]);
  const room = r.weighted(targets);
  if (E.drain) {
    f.drain = Math.max(f.drain || 0, 5);
  }
  if (!r.chance(p)) {
    emit(run, { kind: 'miss', enemy: e.id, room, ...roomCenter(room) });
    return;
  }
  const dmg = Math.max(1, r.int(E.dmg[0], E.dmg[1]) - ctx.stats.armor);
  hitRoom(run, room, dmg, E.name);
  emit(run, { kind: 'hit', enemy: e.id, room, dmg, ...roomCenter(room) });
}

export function hitRoom(run, room, dmg, source) {
  const r = rng(run);
  damageRoom(run, room, dmg * 2);
  const mods = modulesInRoom(run, room);
  if (mods.length) {
    const sid = layout().slots.filter((s) => s.room === room && run.ship.slots[s.id]).map((s) => s.id);
    if (sid.length) damageModule(run, r.pick(sid), dmg * 2.6);
  }
  if (r.chance(0.2 + dmg * 0.015)) igniteRoom(run, room, 15 + dmg * 2);
  const rs = run.ship.rooms[room];
  if (r.chance(0.1 + (100 - rs.int) / 220)) breachRoom(run, room, 1);
  for (const c of alive(run)) {
    if (crewRoom(c) === room && r.chance(0.32)) injure(run, c, dmg * r.float(1, 1.8), `metralla (${source})`);
  }
}

// Fuego antiaéreo de la PVO
export function stepPvo(run, dt, ctx) {
  const f = run.flight;
  if (!f.pvo) return;
  const r = rng(run);
  if (!f.pvo.active && f.t >= f.pvo.deadline) {
    f.pvo.active = true;
    f.pvo.until = f.t + 6;
    alert(run, '¡Fuego antiaéreo! La PVO no ha recibido el código.', 'danger', { pause: true, sound: 'alarm' });
  }
  if (f.pvo.active) {
    f.pvo.cd = (f.pvo.cd ?? 0) - dt;
    if (f.pvo.cd <= 0) {
      f.pvo.cd = r.float(0.5, 1.1);
      const room = r.pick(ROOM_IDS());
      const p = clamp(0.45 - evasion(run, ctx) * 0.6, 0.1, 0.7);
      const c = roomCenter(room);
      if (r.chance(p)) {
        const dmg = r.int(3, 7);
        hitRoom(run, room, Math.max(1, dmg - ctx.stats.armor * 0.5), 'fuego antiaéreo');
        emit(run, { kind: 'hit', room, dmg, flak: true, ...c });
      } else emit(run, { kind: 'flak', x: c.x + r.float(-20, 20), y: c.y + r.float(-6, 6) });
    }
    if (f.t >= f.pvo.until) {
      f.pvo = null;
      f.radioQueue = f.radioQueue.filter((q) => q.kind !== 'iff');
      alert(run, 'Habéis salido del alcance de la PVO.', 'info');
    }
  }
}
