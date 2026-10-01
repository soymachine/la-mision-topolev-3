// Estado de una partida (expediente): creación, recursos, reloj, registro.

import { RNG, hashString } from '../engine/rng.js';
import { genCrew, resetCrewIds, has } from './crew.js';
import { resetModIds } from './loot.js';
import { initialModules, initialRooms, shipStats, capacities, VARIANTS } from './ship.js';
import { genRegionMap, reveal } from './map.js';
import { clamp } from '../engine/util.js';

export const RUN_VERSION = 3;

export const DIFFICULTY = {
  camarada: {
    name: 'Camarada', desc: 'Para conocer el Topolev. Más plazo, menos incidentes, Moscú es comprensiva.',
    days: 8, incident: 0.75, susp: 0.7, needs: 0.85,
    start: { fuel: 30, rations: 42, meals: 8, parts: 30, meds: 8, ammo: 160, vodka: 10, flares: 3, rubles: 500, knowledge: 0 },
  },
  estajanovista: {
    name: 'Estajanovista', desc: 'La experiencia prevista por el Comité Central. Exigente pero justa.',
    days: 6.5, incident: 1, susp: 1, needs: 1,
    start: { fuel: 26, rations: 34, meals: 6, parts: 22, meds: 6, ammo: 120, vodka: 6, flares: 2, rubles: 320, knowledge: 0 },
  },
  purga: {
    name: 'Purga', desc: 'Moscú no perdona. Plazos ajustados, la nave falla, el KGB ve traidores en todas partes.',
    days: 5.5, incident: 1.35, susp: 1.3, needs: 1.15,
    start: { fuel: 22, rations: 26, meals: 4, parts: 16, meds: 4, ammo: 90, vodka: 4, flares: 1, rubles: 160, knowledge: 0 },
  },
};

export const RES = {
  fuel: { name: 'Combustible', short: 'COMB', glyph: '◘', unit: ' t', d: 1, color: 'o5' },
  rations: { name: 'Raciones', short: 'RAC', glyph: '▪', unit: '', d: 0, color: 'o6' },
  meals: { name: 'Comidas', short: 'COM', glyph: '♨', unit: '', d: 0, color: 'o7' },
  parts: { name: 'Piezas', short: 'PZS', glyph: '¤', unit: '', d: 0, color: 'o5' },
  meds: { name: 'Medicinas', short: 'MED', glyph: '+', unit: '', d: 0, color: 'red' },
  ammo: { name: 'Munición', short: 'MUN', glyph: '‼', unit: '', d: 0, color: 'o6' },
  vodka: { name: 'Vodka', short: 'VOD', glyph: '¡', unit: '', d: 0, color: 'ice' },
  flares: { name: 'Señuelos', short: 'SEÑ', glyph: '*', unit: '', d: 0, color: 'gold' },
  rubles: { name: 'Rublos', short: '₽', glyph: '₽', unit: ' ₽', d: 0, color: 'gold' },
  knowledge: { name: 'Conocimiento', short: 'CON', glyph: 'Ψ', unit: '', d: 0, color: 'violet' },
};
export const RES_KEYS = Object.keys(RES);

const rngs = new WeakMap();
export function rng(run) {
  let r = rngs.get(run);
  if (!r) {
    r = RNG.from(run.rngState);
    rngs.set(run, r);
  }
  return r;
}

export function syncIds(run) {
  let mc = 0;
  let mm = 0;
  for (const c of run.crew) mc = Math.max(mc, Number(c.id.slice(1)) || 0);
  const mods = [...Object.values(run.ship.slots).filter(Boolean), ...run.inventory];
  for (const m of mods) mm = Math.max(mm, Number(m.id.slice(1)) || 0);
  resetCrewIds(Math.max(mc + 1, run.ids?.c || 1));
  resetModIds(Math.max(mm + 1, run.ids?.m || 1));
}

export function prepareSave(run) {
  run.rngState = rng(run).state;
  if (run.flight) {
    delete run.flight.ctx;
    run.flight.fx = [];
  }
  return run;
}

export function newRun({ seed, difficulty = 'estajanovista', variant = 'topolev' }) {
  seed = String(seed || Math.floor(Math.random() * 1e9).toString(36).toUpperCase());
  const base = hashString(seed);
  const r = new RNG(base);
  resetCrewIds(1);
  resetModIds(1);
  const D = DIFFICULTY[difficulty];
  const run = {
    v: RUN_VERSION,
    seed,
    difficulty,
    variant,
    rngState: r.state,
    clock: 6 * 60,
    deadline: Math.round(D.days * 1440),
    region: 0,
    map: null,
    res: { ...D.start },
    suspicion: 10,
    ship: {
      variant,
      name: VARIANTS[variant].name,
      slots: initialModules(r, variant),
      rooms: initialRooms(),
      power: { calef: 2, vital: 1, armas: 2, radar: 1, radio: 1, medico: 0, cocina: 1, taller: 0 },
      want: { calef: 2, vital: 1, armas: 2, radar: 1, radio: 1, medico: 0, cocina: 1, taller: 0 },
      throttle: 1,
      heat: 25,
      scram: 0,
    },
    crew: [],
    inventory: [],
    orders: [],
    directives: [],
    flags: {},
    log: [],
    stats: { km: 0, legs: 0, kills: 0, fires: 0, events: 0, directivesOk: 0, directivesFail: 0, deaths: 0, maxRegion: 0, repairs: 0 },
    policy: 'normal',
    phase: 'brief',
    flight: null,
    event: null,
    over: null,
    ids: {},
    speed: 1,
  };
  rngs.set(run, r);
  // tripulación inicial
  const roles = ['piloto', 'navegante', 'ingeniero', 'radio', 'medico', 'comisario'];
  if (variant === 'bogatyr') roles.push('artillero');
  if (variant === 'rassvet') roles.push('cientifico');
  for (const role of roles) {
    const c = genCrew(r, { role, hiddenChance: role === 'comisario' ? 0 : 0.2, female: role === 'cientifico' ? true : undefined });
    c.joined = 0;
    run.crew.push(c);
  }
  // como mucho un rasgo oculto «grave» en la tripulación inicial
  let grave = 0;
  for (const c of run.crew) {
    for (const t of ['saboteador', 'informante']) {
      if (has(c, t)) {
        grave++;
        if (grave > 1) c.traits = c.traits.filter((x) => x !== t);
      }
    }
  }
  // alguien debe saber cocinar algo
  if (Math.max(...run.crew.map((c) => c.skills.coc)) < 3) {
    const c = r.pick(run.crew.filter((x) => x.role !== 'piloto'));
    c.skills.coc = 4;
    c.pri.cocina = 1;
  }
  // mapa de la región I
  run.map = genRegionMap(seed, 0, new RNG(hashString(seed + ':region:0')));
  run.map.nodes[0].visited = true;
  reveal(run.map, shipStats(run.ship).range);
  log(run, 'El Comité Central activa la Misión Topolev.', 'party');
  return run;
}

// --- Reloj -----------------------------------------------------------------
export function day(run) {
  return Math.floor(run.clock / 1440) + 1;
}
export function fmtClock(min, withDay = true) {
  const d = Math.floor(min / 1440) + 1;
  const h = Math.floor((min % 1440) / 60);
  const m = Math.floor(min % 60);
  const hm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return withDay ? `Día ${d} · ${hm}` : hm;
}
export function timeLeft(run) {
  return run.deadline - run.clock;
}
export function fmtDuration(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
}

// --- Recursos --------------------------------------------------------------
export function caps(run) {
  return capacities(shipStats(run.ship));
}

export function addRes(run, key, amount, capOverride) {
  const cap = capOverride ?? caps(run)[key] ?? 99999;
  const before = run.res[key] || 0;
  let after = before + amount;
  if (amount > 0) after = Math.min(after, Math.max(cap, before));
  after = Math.max(0, after);
  if (key !== 'fuel') after = Math.round(after * 100) / 100;
  run.res[key] = after;
  return after - before;
}

export function canPay(run, cost) {
  for (const k in cost) if ((run.res[k] || 0) < cost[k]) return false;
  return true;
}
export function pay(run, cost) {
  for (const k in cost) run.res[k] = Math.max(0, (run.res[k] || 0) - cost[k]);
}

// --- Sospecha --------------------------------------------------------------
export function addSuspicion(run, amount, reason) {
  const D = DIFFICULTY[run.difficulty];
  let a = amount;
  if (a > 0) {
    a *= D.susp;
    // rasgos: fieles reducen, informante amplifica decisiones desleales
    for (const c of alive(run)) {
      if (has(c, 'leal')) a *= 0.9;
    }
  }
  run.suspicion = clamp(run.suspicion + a, 0, 100);
  if (reason) log(run, `${reason} (${a > 0 ? '+' : ''}${Math.round(a)} sospecha)`, a > 0 ? 'bad' : 'good');
  return a;
}

// Decisión desleal: el informante la duplica
export function disloyal(run, amount, reason) {
  const inf = alive(run).some((c) => has(c, 'informante'));
  return addSuspicion(run, inf ? amount * 2 : amount, reason);
}

// --- Tripulación -----------------------------------------------------------
export function alive(run) {
  return run.crew.filter((c) => !c.dead);
}
export function crewById(run, id) {
  return run.crew.find((c) => c.id === id);
}

// --- Registro ----------------------------------------------------------------
export function log(run, text, kind = 'info') {
  run.log.push({ t: run.clock, text, kind });
  if (run.log.length > 250) run.log.splice(0, run.log.length - 250);
}

export function summary(run) {
  return {
    region: run.region,
    day: day(run),
    crew: alive(run).length,
    difficulty: run.difficulty,
    variant: run.variant,
    seed: run.seed,
    phase: run.phase,
    over: !!run.over,
    suspicion: Math.round(run.suspicion),
    node: run.map?.nodes[run.map.cur]?.name,
  };
}
