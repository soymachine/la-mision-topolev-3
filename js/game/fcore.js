// Núcleo compartido de la simulación de vuelo: constantes, tareas, daños, avisos.

import { layout } from './ship.js';
import { REGIONS } from './data/regions.js';
import { alive, log, rng } from './run.js';
import { tmul, maxHp, displayName, a as ga } from './crew.js';
import { clamp } from '../engine/util.js';
import { onDeath } from './directives.js';

export const TUNE = {
  step: 0.05, // minutos de juego por paso de simulación
  assignEvery: 0.5,
  moveSpeed: 5.5, // celdas por minuto de juego
  fatigueWork: 10 / 60,
  fatigueIdle: 4 / 60,
  sleepBunk: 32 / 60,
  sleepFloor: 14 / 60,
  hunger: 7 / 60,
  mealHunger: 62,
  rawHunger: 38,
  eatTime: 8,
  drinkTime: 4,
  fireGrow: 2.8,
  fireFight: 4.2,
  breachO2: 12,
  sealNeed: 12,
  repairRate: 3.2,
  iceRate: 1.6,
  deiceRate: 5.5,
  cookNeed: 18,
  healRate: 2.4,
};

export const POLICIES = {
  estricta: { name: 'Estajanovista', sleep: 92, wake: 35, eat: 85, heal: 30, desc: 'Se trabaja hasta caer. Más manos, más riesgos.' },
  normal: { name: 'Reglamentaria', sleep: 80, wake: 15, eat: 70, heal: 45, desc: 'El reglamento de la Fuerza Aérea.' },
  relajada: { name: 'Humanitaria', sleep: 65, wake: 5, eat: 55, heal: 60, desc: 'Tripulación descansada, pero menos gente de guardia.' },
};

export const SYSTEMS = [
  { id: 'calef', name: 'Calefacción', max: 3, desc: 'Cada unidad sube la temperatura de todas las salas.' },
  { id: 'vital', name: 'Soporte vital', max: 2, desc: 'Regenera oxígeno y presión. Sin él, el aire se agota.' },
  { id: 'armas', name: 'Armas', max: 3, desc: 'Una unidad por torreta armada (dorsal, ventral, cola).' },
  { id: 'radar', name: 'Radar', max: 2, desc: 'Aviso temprano de interceptores y tormentas.' },
  { id: 'radio', name: 'Radio', max: 2, desc: 'Necesaria para mensajes y códigos IFF. 2 = más rápido.' },
  { id: 'medico', name: 'Enfermería', max: 1, desc: 'Curación más rápida en las camas.' },
  { id: 'cocina', name: 'Cocina', max: 1, desc: 'Sin energía no se puede cocinar.' },
  { id: 'taller', name: 'Taller', max: 1, desc: 'Sin energía no se fabrica nada.' },
];
export const SYS = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

export function outsideTemp(run) {
  const R = REGIONS[run.region];
  return R.temp - 16 - (run.flight?.weather || 0) * 8;
}

export function F(run) {
  return run.flight;
}

// --- Avisos y efectos --------------------------------------------------------
export function emit(run, ev) {
  const f = run.flight;
  if (f) {
    f.fx = f.fx || [];
    if (f.fx.length < 200) f.fx.push(ev);
  }
}

export function alert(run, text, level = 'info', opts = {}) {
  const f = run.flight;
  log(run, text, level === 'danger' ? 'bad' : level === 'good' ? 'good' : level === 'warn' ? 'warn' : 'info');
  if (!f) return;
  f.alerts.push({ text, level, t: f.t, pause: !!opts.pause, id: f.nextId++ });
  if (f.alerts.length > 8) f.alerts.shift();
  emit(run, { kind: 'alert', level, pause: !!opts.pause, sound: opts.sound });
}

// --- Tareas --------------------------------------------------------------
export function findTask(run, key) {
  return run.flight.tasks.find((t) => t.key === key);
}

export function ensureTask(run, key, def) {
  let t = findTask(run, key);
  if (t) return t;
  const f = run.flight;
  t = {
    id: 't' + f.nextId++,
    key,
    type: def.type,
    cat: def.cat,
    room: def.room,
    label: def.label,
    slots: def.slots ?? 1,
    need: def.need ?? 0,
    progress: 0,
    prio: def.prio ?? 0,
    weight: def.weight ?? 0,
    station: def.station || null,
    x: def.x ?? null,
    y: def.y ?? null,
    data: def.data || {},
    persistent: !!def.persistent,
    created: f.t,
    deadline: def.deadline ?? null,
  };
  f.tasks.push(t);
  return t;
}

export function removeTask(run, key) {
  const f = run.flight;
  const i = f.tasks.findIndex((t) => t.key === key);
  if (i >= 0) {
    const t = f.tasks[i];
    f.tasks.splice(i, 1);
    for (const c of run.crew) {
      if (c.act && c.act.taskId === t.id) c.act = null;
      if (c.order && c.order.taskId === t.id) c.order = null;
    }
  }
}

// --- Salas y tripulantes ---------------------------------------------------
export function crewRoom(c) {
  if (c.x == null) return null;
  const L = layout();
  return L.roomOf(Math.round(c.x), Math.round(c.y));
}

export function crewInRoom(run, roomId) {
  return alive(run).filter((c) => crewRoom(c) === roomId);
}

export function slotsInRoom(roomId) {
  return layout().slots.filter((s) => s.room === roomId);
}

export function modulesInRoom(run, roomId) {
  return slotsInRoom(roomId).map((s) => run.ship.slots[s.id]).filter(Boolean);
}

export function injure(run, c, amount, cause) {
  if (c.dead || amount <= 0) return;
  const dmg = amount * tmul(c, 'injuryMul');
  c.hp -= dmg;
  emit(run, { kind: 'hurt', crew: c.id, amount: Math.round(dmg) });
  if (c.hp <= 0) die(run, c, cause);
}

export function die(run, c, cause) {
  if (c.dead) return;
  c.dead = true;
  c.hp = 0;
  c.cause = cause;
  c.diedAt = run.clock;
  c.act = null;
  c.order = null;
  run.stats.deaths++;
  onDeath(run);
  for (const o of alive(run)) o.morale = clamp(o.morale - 14, 0, 100);
  alert(run, `${displayName(c)} ha ${ga(c, 'muerto', 'muerto')}: ${cause}.`, 'danger', { pause: true, sound: 'fail' });
  emit(run, { kind: 'death', crew: c.id, x: c.x, y: c.y });
}

export function heal(c, amount) {
  c.hp = Math.min(maxHp(c), c.hp + amount);
}

export function igniteRoom(run, roomId, amount = 20) {
  const r = run.ship.rooms[roomId];
  if (!r) return;
  if (r.o2 < 20) return;
  const was = r.fire;
  r.fire = clamp(Math.max(r.fire, amount), 0, 100);
  if (was <= 0 && r.fire > 0) {
    run.stats.fires++;
    alert(run, `¡Incendio en ${layout().rooms[roomId].name}!`, 'danger', { pause: true, sound: 'alarm' });
    emit(run, { kind: 'fire', room: roomId });
  }
}

export function breachRoom(run, roomId, lvl = 1) {
  const r = run.ship.rooms[roomId];
  if (!r) return;
  const was = r.breach;
  r.breach = clamp(r.breach + lvl, 0, 3);
  if (r.breach > was) {
    alert(run, `¡Brecha en el casco: ${layout().rooms[roomId].name}!`, 'danger', { pause: true, sound: 'hiss' });
    emit(run, { kind: 'breach', room: roomId });
  }
}

export function damageModule(run, slotId, amount) {
  const m = run.ship.slots[slotId];
  if (!m || m.int <= 0) return;
  const before = m.int;
  m.int = Math.max(0, m.int - amount);
  if (before > 0 && m.int <= 0) {
    alert(run, `${m.name} ha dejado de funcionar.`, 'danger', { pause: false, sound: 'warn' });
  }
}

export function damageRandomModule(run, roomId, amount) {
  const slots = slotsInRoom(roomId).filter((s) => run.ship.slots[s.id] && run.ship.slots[s.id].int > 0);
  if (!slots.length) return null;
  const s = rng(run).pick(slots);
  damageModule(run, s.id, amount);
  return s.id;
}

export function damageRoom(run, roomId, amount) {
  const r = run.ship.rooms[roomId];
  if (!r) return;
  r.int = clamp(r.int - amount, 0, 100);
}

export function hull(run) {
  const rooms = Object.values(run.ship.rooms);
  return rooms.reduce((s, r) => s + r.int, 0) / rooms.length;
}

// Habilidad efectiva (0..10) para trabajo
export function workRate(c, skill, mulKey) {
  const sk = skill ? c.skills[skill] || 0 : 3;
  let r = 0.4 + sk * 0.12;
  r *= tmul(c, 'workMul');
  if (mulKey) r *= tmul(c, mulKey);
  if (c.fatigue > 60) r *= 1 - (c.fatigue - 60) / 90;
  if (c.morale < 30) r *= 0.75 + c.morale / 120;
  if (c.cold > 50) r *= 0.75;
  if (c.drunk > 40) r *= 0.7;
  if (c.hp < 40) r *= 0.7;
  if (c.sick > 0) r *= 0.8;
  return Math.max(0.1, r);
}
