// IA de tripulantes: necesidades, decisiones, asignación de tareas, movimiento y trabajo.

import { layout } from './ship.js';
import { alive, rng, addRes, log, addSuspicion } from './run.js';
import { tmul, tadd, has, maxHp, displayName, giveXp, a as ga } from './crew.js';
import { TRAITS, CAT } from './data/traits.js';
import {
  TUNE, POLICIES, emit, alert, ensureTask, removeTask, crewRoom, injure, die, heal, workRate, outsideTemp,
} from './fcore.js';
import { bfs, clamp } from '../engine/util.js';
import { resolveRadio, completeOrder, scienceGain, polWork } from './stations.js';

const NEED_ACTS = ['sleep', 'eat', 'warm', 'patient', 'drink', 'collapse'];

export function placeCrew(run) {
  const L = layout();
  const r = rng(run);
  const spots = [];
  for (const id of ['comedor', 'dormitorio', 'comisaria', 'radio', 'navegacion', 'cabina']) {
    const room = L.rooms[id];
    for (let x = room.x0; x <= room.x1; x++) spots.push([x, room.floor]);
  }
  r.shuffle(spots);
  let i = 0;
  for (const c of alive(run)) {
    const [x, y] = spots[i++ % spots.length];
    c.x = x;
    c.y = y;
    c.path = null;
    c.tx = x;
    c.ty = y;
    c.act = null;
    c.order = null;
    c.breakdown = null;
  }
}

// --- Destino y movimiento -------------------------------------------------
export function setTarget(c, x, y) {
  if (c.tx === x && c.ty === y && c.path) return;
  c.tx = x;
  c.ty = y;
  c.path = null;
}

function cellOf(c) {
  const L = layout();
  let x = Math.round(c.x);
  let y = Math.round(c.y);
  if (!L.walk(x, y)) {
    // buscar celda caminable cercana
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (L.walk(Math.floor(c.x) + dx, Math.floor(c.y) + dy)) {
        x = Math.floor(c.x) + dx;
        y = Math.floor(c.y) + dy;
        break;
      }
    }
  }
  return [x, y];
}

export function moveSpeed(c) {
  let s = TUNE.moveSpeed * tmul(c, 'moveMul');
  if (c.fatigue > 85) s *= 0.7;
  if (c.drunk > 50) s *= 0.7;
  if (c.hp < 40) s *= 0.6;
  if (c.hp < 15) s *= 0.4;
  if (c.cold > 70) s *= 0.75;
  return s;
}

function moveCrew(run, c, dt) {
  if (c.tx == null) return true;
  const L = layout();
  if (!c.path) {
    const [sx, sy] = cellOf(c);
    const start = L.key(sx, sy);
    const goal = L.key(c.tx, c.ty);
    if (!L.walk(c.tx, c.ty)) {
      c.path = [];
      return true;
    }
    const p = bfs(L.neighbors, start, goal);
    c.path = p ? p : [];
    if (!p && start !== goal) {
      // sin camino: quedarse
      c.tx = sx;
      c.ty = sy;
    }
    if (start === goal) {
      c.x = sx;
      c.y = sy;
    }
  }
  if (!c.path.length) {
    const d = Math.abs(c.x - c.tx) + Math.abs(c.y - c.ty);
    if (d > 0.01 && d < 1.5) {
      // ajuste final
      const sp = moveSpeed(c) * dt;
      c.x += clamp(c.tx - c.x, -sp, sp);
      c.y += clamp(c.ty - c.y, -sp, sp);
      return false;
    }
    return d <= 0.01 || d >= 1.5;
  }
  let budget = moveSpeed(c) * dt;
  while (budget > 0 && c.path.length) {
    const k = c.path[0];
    const nx = k % L.W;
    const ny = Math.floor(k / L.W);
    const vertical = nx === Math.round(c.x) && Math.abs(ny - c.y) > 0.01;
    const sp = vertical ? 0.6 : 1;
    const dx = nx - c.x;
    const dy = ny - c.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    const step = budget * sp;
    if (dist <= step) {
      c.x = nx;
      c.y = ny;
      budget -= dist / sp;
      c.path.shift();
    } else {
      c.x += Math.sign(dx) * Math.min(Math.abs(dx), step);
      c.y += Math.sign(dy) * Math.min(Math.abs(dy), step);
      budget = 0;
    }
  }
  return !c.path.length && Math.abs(c.x - c.tx) < 0.05 && Math.abs(c.y - c.ty) < 0.05;
}

// --- Plazas (literas, asientos, camas) -----------------------------------
function takenSpots(run, kind) {
  const s = new Set();
  for (const c of alive(run)) if (c.act && c.act.kind === kind && c.act.spot != null) s.add(c.act.spot);
  return s;
}

function floorSpot(run, roomId, avoid = new Set()) {
  const L = layout();
  const room = L.rooms[roomId];
  const r = rng(run);
  const xs = [];
  for (let x = room.x0; x <= room.x1; x++) if (!avoid.has(x)) xs.push(x);
  return xs.length ? r.pick(xs) : room.x0;
}

// --- Necesidades -----------------------------------------------------------
export function updateNeeds(run, c, dt, ctx) {
  const L = layout();
  const f = run.flight;
  const D = ctx.D;
  const room = crewRoom(c);
  const rs = room ? run.ship.rooms[room] : null;
  const act = c.act?.kind;
  const working = act === 'task' && c.atWork;
  // fatiga
  if (act === 'sleep' || act === 'collapse') {
    const bunk = act === 'sleep' && c.act.spot != null;
    let rate = (bunk ? TUNE.sleepBunk * ctx.stats.rest : TUNE.sleepFloor) * tmul(c, 'restMul');
    if (rs && rs.temp < 5) rate *= 0.6;
    c.fatigue = Math.max(0, c.fatigue - rate * dt);
  } else {
    const rate = (working ? TUNE.fatigueWork : TUNE.fatigueIdle) * tmul(c, 'fatigueMul') * D.needs;
    c.fatigue = Math.min(100, c.fatigue + rate * dt);
  }
  // hambre
  c.hunger = Math.min(100, c.hunger + TUNE.hunger * tmul(c, 'hungerMul') * D.needs * dt);
  if (c.hunger >= 100) injure(run, c, 0.08 * dt, 'inanición');
  // frío
  const temp = rs ? rs.temp : 10;
  const exterior = act === 'task' && c.atWork && f.tasks.find((t) => t.id === c.act.taskId)?.type === 'ice';
  const effT = exterior ? outsideTemp(run) * 0.5 : temp;
  if (effT < 6) c.cold = Math.min(100, c.cold + (6 - effT) * 0.012 * tmul(c, 'coldMul') * dt);
  else if (effT > 12) c.cold = Math.max(0, c.cold - (effT - 12) * 0.05 * dt - 0.1 * dt);
  if (c.cold > 70) injure(run, c, (c.cold - 70) * 0.006 * dt, 'hipotermia');
  // oxígeno
  if (rs && rs.o2 < 40) injure(run, c, (rs.o2 < 20 ? 0.9 : 0.25) * dt, 'asfixia');
  // fuego en la sala
  if (rs && rs.fire > 0) injure(run, c, (rs.fire / 100) * (act === 'task' ? 0.45 : 0.9) * dt, 'quemaduras');
  // radiación
  if (rs && rs.rad > 0) c.rad = Math.min(100, c.rad + rs.rad * 0.006 * dt);
  if (c.rad > 50) injure(run, c, (c.rad - 50) * 0.002 * dt, 'radiación');
  // enfermedad oculta
  if (has(c, 'tisis') && c.flags?.treated !== true) injure(run, c, 0.004 * dt, 'tisis');
  if (c.sick > 0) {
    c.sick = Math.max(0, c.sick - 0.01 * dt);
    injure(run, c, 0.03 * dt, 'fiebre');
  }
  // embriaguez
  c.drunk = Math.max(0, c.drunk - 0.35 * dt);
  // curación natural lenta
  if (c.hp < maxHp(c) && c.hunger < 80 && c.cold < 50 && !(rs && (rs.fire > 0 || rs.o2 < 40))) heal(c, 0.012 * dt);
  // moral: se acerca a un objetivo
  const target = moraleTarget(run, c, ctx, rs, room);
  const k = target > c.morale ? 0.07 : 0.1;
  c.morale = clamp(c.morale + (target - c.morale) * k * dt * 0.1, 0, 100);
  c.moraleTarget = target;
}

export function moraleTarget(run, c, ctx, rs, room) {
  let t = 55 + tadd(c, 'moraleBase') + ctx.auraAll + ctx.stats.morale * 2 + (run.moraleMod || 0);
  if (c.hunger > 60) t -= (c.hunger - 60) * 0.4;
  if (c.fatigue > 70) t -= (c.fatigue - 70) * 0.4;
  if (c.cold > 30) t -= (c.cold - 30) * 0.4;
  if (c.hp < 60) t -= (60 - c.hp) * 0.3;
  if (c.rad > 40) t -= 8;
  if (c.drunk > 20 && !has(c, 'abstemio')) t += 8;
  if (has(c, 'bebedor') && (run.res.vodka || 0) <= 0) t -= 10;
  t += tadd(c, 'flightMorale') * 3;
  if (rs && rs.fire > 0) t -= 15;
  if (run.flight?.combat) t -= has(c, 'veterano') ? 3 : 8;
  // auras de sala
  if (room) t += ctx.roomAura[room] || 0;
  if (has(c, 'cantante') || has(c, 'grunon')) t -= tadd(c, 'aura'); // no se afecta a sí mismo
  // objetos de moral apreciados
  for (const m of ctx.moraleMods) if (m.likes && has(c, m.likes)) t += 6;
  return clamp(t, 0, 100);
}

// --- Decisiones --------------------------------------------------------------
function isUrgentTask(t) {
  return t && (t.type === 'fire' || t.type === 'breach' || (t.station === 'radio' && t.data.urgent) || t.prio > 0);
}

function needAction(run, c, ctx) {
  const P = POLICIES[run.policy];
  const L = layout();
  const f = run.flight;
  const cur = c.act;
  const curTask = cur?.kind === 'task' ? f.tasks.find((t) => t.id === cur.taskId) : null;
  const urgent = isUrgentTask(curTask) || (c.order && c.order.kind === 'task');
  const forced = !!c.order;
  if (c.fatigue >= 100 && cur?.kind !== 'sleep') return { kind: 'collapse' };
  if (c.hp < maxHp(c) * (P.heal / 100) && !(urgent && c.hp > 25) && !(forced && c.hp > 20)) {
    return { kind: 'patient' };
  }
  if ((c.rad > 45 || c.sick > 0) && run.res.meds > 0 && !urgent && !forced) return { kind: 'patient' };
  if (c.fatigue >= P.sleep && !(urgent && c.fatigue < 97) && !(forced && c.fatigue < 95)) return { kind: 'sleep' };
  if (c.hunger >= P.eat && (run.res.meals > 0 || run.res.rations > 0) && !(urgent && c.hunger < 95) && !(forced && c.hunger < 92)) {
    return { kind: 'eat' };
  }
  if (c.cold >= 60 && !urgent && !forced) return { kind: 'warm' };
  if (has(c, 'bebedor') && c.morale < 35 && run.res.vodka > 0 && !urgent && !forced && rng(run).chance(0.05)) return { kind: 'drink' };
  if (has(c, 'hipocondriaco') && run.res.meds > 0 && rng(run).chance(0.0015)) {
    addRes(run, 'meds', -1);
    log(run, `${displayName(c)} se ha tomado unas pastillas «por si acaso».`, 'info');
  }
  return null;
}

function startNeed(run, c, kind) {
  const L = layout();
  const r = rng(run);
  const f = run.flight;
  const act = { kind, t: 0 };
  if (kind === 'sleep') {
    const taken = takenSpots(run, 'sleep');
    let spot = null;
    for (let i = 0; i < ctxStats(run).bunks; i++) if (!taken.has(i)) {
      spot = i;
      break;
    }
    act.spot = spot;
    if (spot != null) setTarget(c, L.bunkX[spot], L.rooms.dormitorio.floor);
    else setTarget(c, floorSpot(run, 'dormitorio', new Set(L.bunkX)), L.rooms.dormitorio.floor);
  } else if (kind === 'collapse') {
    const [x, y] = cellOf(c);
    setTarget(c, x, y);
  } else if (kind === 'eat' || kind === 'drink') {
    const taken = takenSpots(run, kind === 'eat' ? 'eat' : 'drink');
    let spot = null;
    for (let i = 0; i < L.seatX.length; i++) if (!taken.has(i)) {
      spot = i;
      break;
    }
    act.spot = spot;
    setTarget(c, spot != null ? L.seatX[spot] : floorSpot(run, 'comedor'), L.rooms.comedor.floor);
  } else if (kind === 'warm') {
    let best = null;
    for (const id in run.ship.rooms) {
      const rs = run.ship.rooms[id];
      if (rs.fire > 0 || rs.breach > 0 || rs.o2 < 50) continue;
      if (!best || rs.temp > run.ship.rooms[best].temp) best = id;
    }
    best = best || 'comedor';
    act.room = best;
    setTarget(c, floorSpot(run, best), L.rooms[best].floor);
  } else if (kind === 'patient') {
    const taken = takenSpots(run, 'patient');
    let spot = null;
    for (let i = 0; i < L.bedX.length; i++) if (!taken.has(i)) {
      spot = i;
      break;
    }
    act.spot = spot;
    setTarget(c, spot != null ? L.bedX[spot] : floorSpot(run, 'enfermeria', new Set(L.bedX)), L.rooms.enfermeria.floor);
  }
  c.act = act;
}

let statsCache = null;
function ctxStats(run) {
  return statsCache || { bunks: 4 };
}

function needDone(run, c, ctx) {
  const P = POLICIES[run.policy];
  const a = c.act;
  const f = run.flight;
  switch (a.kind) {
    case 'sleep':
      if (c.fatigue <= P.wake) return true;
      if (f.emergency && c.fatigue < 60 && !c.order) return true;
      return false;
    case 'collapse':
      return c.fatigue < 45;
    case 'eat':
      return a.done;
    case 'drink':
      return a.done;
    case 'warm': {
      if (c.cold < 15) return true;
      const rs = run.ship.rooms[a.room];
      return !rs || rs.temp < 8 || rs.fire > 0;
    }
    case 'patient': {
      const ok = c.hp >= maxHp(c) * 0.92 && c.rad < 30 && !(c.sick > 0);
      if (ok) return true;
      // sin medicinas y sin heridas graves: volver
      if (run.res.meds <= 0 && c.hp >= maxHp(c) * (P.heal / 100) + 10) return true;
      return false;
    }
    default:
      return true;
  }
}

// Acciones de necesidad cuando el tripulante ha llegado
function doNeed(run, c, dt, arrived) {
  const a = c.act;
  if (!arrived && a.kind !== 'collapse') return;
  a.t += dt;
  const f = run.flight;
  if (a.kind === 'eat') {
    if (a.t >= TUNE.eatTime && !a.done) {
      a.done = true;
      if (run.res.meals > 0) {
        addRes(run, 'meals', -1);
        c.hunger = Math.max(0, c.hunger - TUNE.mealHunger);
        const chef = alive(run).find((x) => has(x, 'chef'));
        c.morale = clamp(c.morale + 3 + (chef ? 6 : 0), 0, 100);
      } else if (run.res.rations > 0) {
        addRes(run, 'rations', -1);
        c.hunger = Math.max(0, c.hunger - TUNE.rawHunger);
        c.morale = clamp(c.morale - 4, 0, 100);
      }
      emit(run, { kind: 'eat', crew: c.id });
    }
  } else if (a.kind === 'drink') {
    if (a.t >= TUNE.drinkTime && !a.done) {
      a.done = true;
      if (run.res.vodka > 0) {
        addRes(run, 'vodka', -1);
        if (!has(c, 'abstemio')) {
          c.drunk = Math.min(100, c.drunk + 35);
          c.morale = clamp(c.morale + 10, 0, 100);
        }
      }
    }
  } else if (a.kind === 'sleep' || a.kind === 'collapse') {
    if (Math.random() < dt * 0.25) emit(run, { kind: 'zzz', crew: c.id });
  }
}

// --- Asignación ---------------------------------------------------------------
export function assign(run, ctx) {
  const f = run.flight;
  const L = layout();
  const r = rng(run);
  statsCache = ctx.stats;
  const crew = alive(run);
  // 1) necesidades y finalización
  for (const c of crew) {
    if (c.breakdown) continue;
    if (c.act && NEED_ACTS.includes(c.act.kind)) {
      if (needDone(run, c, ctx)) c.act = null;
      else continue;
    }
    const n = needAction(run, c, ctx);
    if (n) startNeed(run, c, n.kind);
  }
  // 2) tareas: candidatos
  const free = crew.filter((c) => !c.breakdown && !(c.act && NEED_ACTS.includes(c.act.kind)));
  const tasks = f.tasks.filter((t) => t.available !== false);
  const cnt = new Map();
  // órdenes forzadas primero
  for (const c of free) {
    if (!c.order) continue;
    if (c.order.kind === 'task') {
      const t = tasks.find((x) => x.id === c.order.taskId);
      if (!t) {
        c.order = null;
        continue;
      }
      assignTo(run, c, t, cnt);
    } else if (c.order.kind === 'room') {
      // la mejor tarea dentro de la sala, si la hay
      let best = null;
      let bs = -1e9;
      for (const t of tasks) {
        if (t.room !== c.order.room) continue;
        if ((cnt.get(t.id) || 0) >= t.slots) continue;
        const s = scoreTask(c, t, true);
        if (s > bs) {
          bs = s;
          best = t;
        }
      }
      if (best) assignTo(run, c, best, cnt);
      else {
        if (!c.act || c.act.kind !== 'idle' || c.act.room !== c.order.room) {
          c.act = { kind: 'idle', room: c.order.room, t: 0 };
          setTarget(c, c.order.x ?? floorSpot(run, c.order.room), L.rooms[c.order.room].floor);
        }
      }
    }
  }
  // greedy por puntuación
  const pairs = [];
  for (const c of free) {
    if (c.order) continue;
    for (const t of tasks) {
      const p = c.pri[t.cat] ?? 0;
      if (p <= 0) continue;
      if (has(c, 'cobarde') && c.morale < 40 && (t.type === 'fire' || t.cat === 'armas')) continue;
      pairs.push([scoreTask(c, t, false), c, t]);
    }
  }
  pairs.sort((a, b) => b[0] - a[0]);
  const done = new Set(free.filter((c) => c.order).map((c) => c.id));
  for (const [, c, t] of pairs) {
    if (done.has(c.id)) continue;
    if ((cnt.get(t.id) || 0) >= t.slots) continue;
    assignTo(run, c, t, cnt);
    done.add(c.id);
  }
  // 3) ociosos
  for (const c of free) {
    if (done.has(c.id)) continue;
    if (!c.act || c.act.kind === 'task') {
      const room = crewRoom(c);
      const rs = room ? run.ship.rooms[room] : null;
      const bad = !rs || rs.fire > 0 || rs.breach > 0 || rs.o2 < 50 || rs.temp < 5 || rs.rad > 10;
      c.act = { kind: 'idle', t: 0 };
      if (bad || room === 'motor1' || room === 'motor2' || r.chance(0.3)) {
        const dest = r.pick(['comedor', 'comedor', 'dormitorio', 'comisaria']);
        setTarget(c, floorSpot(run, dest), L.rooms[dest].floor);
      }
    }
  }
  // 4) despertar en emergencia si nadie atiende
  f.emergency = f.tasks.some((t) => (t.type === 'fire' || t.type === 'breach' || t.data.urgent) && !(cnt.get(t.id) > 0));
  // 5) crisis: tarea de calmar
  for (const c of crew) {
    if (c.breakdown) {
      ensureTask(run, 'calm:' + c.id, { type: 'calm', cat: 'politica', room: crewRoom(c) || 'comedor', label: `Calmar a ${c.sur}`, slots: 1, need: 4, weight: 40, data: { crew: c.id } });
    } else removeTask(run, 'calm:' + c.id);
  }
  // registro de trabajadores por tarea
  for (const t of f.tasks) t.workers = [];
  for (const c of crew) {
    if (c.act?.kind === 'task') {
      const t = f.tasks.find((x) => x.id === c.act.taskId);
      if (t) t.workers.push(c.id);
    }
  }
}

function scoreTask(c, t, forced) {
  const p = c.pri[t.cat] ?? 0;
  let s = forced ? 500 : (4 - p) * 100;
  if (t.prio > 0) s += 260;
  s += t.weight || 0;
  const sk = CAT[t.cat]?.skill;
  s += (sk ? c.skills[sk] || 0 : 0) * 7;
  const tx = t.x ?? c.x;
  const ty = t.y ?? c.y;
  s -= (Math.abs(tx - c.x) + Math.abs(ty - c.y) * 4) * 0.5;
  if (c.act && c.act.kind === 'task' && c.act.taskId === t.id) s += 70;
  return s;
}

function assignTo(run, c, t, cnt) {
  const L = layout();
  const n = cnt.get(t.id) || 0;
  cnt.set(t.id, n + 1);
  const same = c.act && c.act.kind === 'task' && c.act.taskId === t.id;
  if (!same) c.act = { kind: 'task', taskId: t.id, t: 0, idx: n };
  // posición de trabajo
  let x = t.x;
  let y = t.y;
  if (x == null) {
    const room = L.rooms[t.room];
    const w = room.x1 - room.x0 + 1;
    const offs = [Math.floor(w / 2), Math.floor(w / 2) - 2, Math.floor(w / 2) + 2, 1, w - 2];
    x = room.x0 + (offs[n % offs.length] % w);
    y = room.floor;
  } else if (t.slots > 1 && n > 0) {
    const room = L.rooms[t.room];
    x = clamp(x + (n % 2 ? n : -n), room.x0, room.x1);
  }
  if (!same || c.tx !== x || c.ty !== y) setTarget(c, x, y);
}

// --- Trabajo -------------------------------------------------------------
function doTask(run, c, t, dt, ctx) {
  const f = run.flight;
  const r = rng(run);
  const L = layout();
  switch (t.type) {
    case 'station': {
      const st = L.stations[t.station];
      const sk = CAT[t.cat].skill;
      giveXp(c, sk, dt * (st.minor ? 0.5 : 1));
      const rate = workRate(c, sk, t.cat === 'navegar' ? 'navMul' : t.cat === 'radio' ? 'radMul' : null);
      if (t.station === 'radio') resolveRadio(run, c, rate, dt, ctx);
      else if (t.station === 'ciencia') scienceGain(run, c, rate, dt, ctx);
      else if (t.station === 'politica') polWork(run, c, rate, dt, ctx);
      else if (t.station === 'cocina') {
        t.progress += rate * ctx.stats.cookSpeed * dt;
        if (Math.random() < dt * 0.6) emit(run, { kind: 'steam', room: 'comedor', x: st.x, y: st.y });
        if (t.progress >= TUNE.cookNeed) {
          t.progress = 0;
          const batch = ctx.stats.meals + tadd(c, 'meals') + (c.skills.coc >= 7 ? 1 : 0);
          const use = Math.min(batch, run.res.rations);
          if (use > 0) {
            addRes(run, 'rations', -use);
            addRes(run, 'meals', use);
            c.stats.meals += use;
            emit(run, { kind: 'cooked', n: use, x: st.x, y: st.y });
          }
        }
      } else if (t.station === 'taller') {
        const o = run.orders[0];
        if (o) {
          o.progress = (o.progress || 0) + rate * ctx.stats.craft * dt;
          if (Math.random() < dt * 1.2) emit(run, { kind: 'spark', x: st.x, y: st.y - 1 });
          if (o.progress >= o.need) completeOrder(run, o);
        }
      }
      return;
    }
    case 'fire': {
      const rs = run.ship.rooms[t.room];
      const rate = workRate(c, 'ing', 'repairMul');
      rs.fire = Math.max(0, rs.fire - TUNE.fireFight * rate * dt);
      giveXp(c, 'ing', dt * 0.5);
      if (Math.random() < dt * 2) emit(run, { kind: 'extinguish', x: c.x + 0.5, y: c.y });
      if (rs.fire <= 0) {
        c.stats.fires++;
        removeTask(run, t.key);
        alert(run, `Incendio sofocado en ${L.rooms[t.room].name}.`, 'good');
      }
      return;
    }
    case 'breach': {
      const rs = run.ship.rooms[t.room];
      let rate = workRate(c, 'ing', 'repairMul') * ctx.stats.repair;
      if (run.res.parts <= 0) rate *= 0.35;
      t.progress += rate * dt;
      giveXp(c, 'ing', dt);
      if (Math.random() < dt * 1.5) emit(run, { kind: 'spark', x: c.x, y: c.y - 1 });
      if (t.progress >= TUNE.sealNeed) {
        t.progress = 0;
        rs.breach = Math.max(0, rs.breach - 1);
        if (run.res.parts > 0) addRes(run, 'parts', -2);
        c.stats.repairs++;
        if (rs.breach <= 0) {
          removeTask(run, t.key);
          alert(run, `Brecha sellada en ${L.rooms[t.room].name}.`, 'good');
        }
      }
      return;
    }
    case 'repair': {
      const m = run.ship.slots[t.data.slot];
      if (!m) {
        removeTask(run, t.key);
        return;
      }
      let rate = workRate(c, 'ing', 'repairMul') * ctx.stats.repair;
      if (run.res.parts <= 0) rate *= 0.25;
      const amt = TUNE.repairRate * rate * dt;
      m.int = Math.min(m.maxInt, m.int + amt);
      f.partAcc = (f.partAcc || 0) + amt / 12;
      while (f.partAcc >= 1) {
        f.partAcc -= 1;
        if (run.res.parts > 0) addRes(run, 'parts', -1);
      }
      giveXp(c, 'ing', dt);
      if (Math.random() < dt * 1.2) emit(run, { kind: 'spark', x: c.x, y: c.y - 1 });
      if (has(c, 'torpe') && Math.random() < dt * 0.01) {
        m.int = Math.max(0, m.int - 15);
        alert(run, `${displayName(c)} ha estropeado algo en ${m.name}.`, 'warn');
      }
      if (m.int >= m.maxInt) {
        c.stats.repairs++;
        run.stats.repairs++;
        removeTask(run, t.key);
      }
      return;
    }
    case 'hull': {
      const rs = run.ship.rooms[t.room];
      let rate = workRate(c, 'ing', 'repairMul') * ctx.stats.repair;
      if (run.res.parts <= 0) rate *= 0.25;
      const amt = TUNE.repairRate * rate * dt;
      rs.int = Math.min(100, rs.int + amt);
      f.partAcc = (f.partAcc || 0) + amt / 15;
      while (f.partAcc >= 1) {
        f.partAcc -= 1;
        if (run.res.parts > 0) addRes(run, 'parts', -1);
      }
      giveXp(c, 'ing', dt * 0.7);
      if (Math.random() < dt) emit(run, { kind: 'spark', x: c.x, y: c.y - 1 });
      if (rs.int >= 100) removeTask(run, t.key);
      return;
    }
    case 'ice': {
      const rs = run.ship.rooms[t.room];
      const rate = workRate(c, 'ing', 'repairMul');
      rs.ice = Math.max(0, rs.ice - TUNE.deiceRate * rate * dt);
      if (Math.random() < dt * 2) emit(run, { kind: 'ice', x: c.x, y: c.y });
      if (rs.ice <= 0) removeTask(run, t.key);
      return;
    }
    case 'leak': {
      t.progress += workRate(c, 'ing', 'repairMul') * dt;
      if (t.progress >= t.need) {
        f.leak = 0;
        removeTask(run, t.key);
        alert(run, 'Fuga de combustible taponada.', 'good');
      }
      return;
    }
    case 'heal': {
      const p = run.crew.find((x) => x.id === t.data.crew);
      if (!p || p.dead || !(p.act?.kind === 'patient')) {
        removeTask(run, t.key);
        return;
      }
      const inBed = p.act.spot != null;
      let rate = workRate(c, 'med') * ctx.stats.heal * (run.ship.power.medico > 0 ? 1.3 : 0.85) * (inBed ? 1 : 0.6);
      const hasMeds = run.res.meds > 0;
      if (!hasMeds) rate *= 0.35;
      const amt = TUNE.healRate * rate * dt;
      heal(p, amt);
      if (hasMeds) {
        if (p.rad > 0) p.rad = Math.max(0, p.rad - amt * 0.6 * ctx.stats.medEff);
        if (p.sick > 0) p.sick = Math.max(0, p.sick - amt * 0.03);
        if (has(p, 'tisis')) {
          p.flags = p.flags || {};
          p.flags.treated = true;
        }
        f.medAcc = (f.medAcc || 0) + amt / (28 * ctx.stats.medEff);
        while (f.medAcc >= 1) {
          f.medAcc -= 1;
          addRes(run, 'meds', -1);
        }
      }
      giveXp(c, 'med', dt);
      c.stats.heals += amt;
      if (Math.random() < dt * 0.8) emit(run, { kind: 'heal', x: p.x, y: p.y });
      return;
    }
    case 'calm': {
      const p = run.crew.find((x) => x.id === t.data.crew);
      if (!p || !p.breakdown) {
        removeTask(run, t.key);
        return;
      }
      t.progress += workRate(c, 'pol') * dt;
      if (t.progress >= t.need) {
        p.breakdown = null;
        p.morale = clamp(p.morale + 12, 0, 100);
        alert(run, `${displayName(c)} ha calmado a ${displayName(p)}.`, 'good');
        removeTask(run, t.key);
      }
      return;
    }
    case 'rat': {
      t.progress += workRate(c, null) * dt;
      if (t.progress >= t.need) {
        removeTask(run, t.key);
        f.rats = 0;
        alert(run, `${displayName(c)} ha cazado a las ratas de la bodega.`, 'good');
      }
      return;
    }
    default:
      return;
  }
}

// --- Crisis nerviosas -----------------------------------------------------
function checkBreakdown(run, c, dt) {
  const L = layout();
  if (c.breakdown) {
    c.breakdown.t += dt;
    const b = c.breakdown;
    if (b.kind === 'panico' && (!c.path || !c.path.length)) {
      const room = rng(run).pick(L.roomList);
      setTarget(c, room.x0 + Math.floor(Math.random() * (room.x1 - room.x0)), room.floor);
    }
    if (b.t >= b.dur) {
      c.breakdown = null;
      c.morale = clamp(c.morale + 8, 0, 100);
    }
    return;
  }
  if (c.morale >= 20 || c.act?.kind === 'sleep' || c.act?.kind === 'collapse') return;
  const p = ((20 - c.morale) * 0.0006 * tmul(c, 'breakdownMul')) * dt;
  if (Math.random() >= p) return;
  const r = rng(run);
  const kind = r.weighted([['panico', 3], ['negarse', 3], ['beber', has(c, 'bebedor') ? 5 : 1.5], ['pelea', 1.5]]);
  const dur = kind === 'panico' ? 10 : kind === 'pelea' ? 15 : 30;
  c.breakdown = { kind, t: 0, dur };
  c.act = null;
  c.order = null;
  const name = displayName(c);
  if (kind === 'panico') alert(run, `${name} ha sufrido un ataque de pánico.`, 'warn', { pause: true });
  else if (kind === 'negarse') {
    alert(run, `${name} se niega a trabajar y se encierra en el dormitorio.`, 'warn', { pause: true });
    setTarget(c, floorSpot(run, 'dormitorio'), L.rooms.dormitorio.floor);
  } else if (kind === 'beber') {
    alert(run, `${name} ha abierto el vodka de la tripulación.`, 'warn', { pause: true });
    setTarget(c, floorSpot(run, 'comedor'), L.rooms.comedor.floor);
    const n = Math.min(run.res.vodka, r.int(1, 3));
    addRes(run, 'vodka', -n);
    c.drunk = Math.min(100, c.drunk + 30 * n);
  } else if (kind === 'pelea') {
    const room = crewRoom(c);
    const others = alive(run).filter((o) => o !== c && crewRoom(o) === room);
    if (others.length) {
      const o = r.pick(others);
      injure(run, c, r.int(5, 12), 'una pelea');
      injure(run, o, r.int(5, 12), 'una pelea');
      o.morale = clamp(o.morale - 10, 0, 100);
      alert(run, `¡${name} se ha liado a golpes con ${displayName(o)}!`, 'danger', { pause: true });
    } else c.breakdown.kind = 'negarse';
  }
}

// --- Paso por tripulante -------------------------------------------------
export function stepCrew(run, dt, ctx) {
  const f = run.flight;
  for (const c of run.crew) {
    if (c.dead) continue;
    updateNeeds(run, c, dt, ctx);
    if (c.dead) continue;
    checkBreakdown(run, c, dt);
    let arrived = moveCrew(run, c, dt);
    c.atWork = false;
    if (c.breakdown) continue;
    if (!c.act) continue;
    if (c.act.kind === 'task') {
      const t = f.tasks.find((x) => x.id === c.act.taskId);
      if (!t) {
        c.act = null;
        continue;
      }
      if (arrived) {
        c.atWork = true;
        c.act.t += dt;
        doTask(run, c, t, dt, ctx);
      }
    } else if (NEED_ACTS.includes(c.act.kind)) {
      doNeed(run, c, dt, arrived);
    }
  }
}
