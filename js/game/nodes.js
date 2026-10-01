// Lógica en tierra: llegada a nodos, descanso, mercados y reclutamiento.

import { RNG } from '../engine/rng.js';
import { rng, alive, addRes, addSuspicion, log, caps, DIFFICULTY, fmtClock } from './run.js';
import { has, tmul, maxHp, genCrew, displayName } from './crew.js';
import { genModule } from './loot.js';
import { moveStorms, reveal, genRegionMap } from './map.js';
import { shipStats } from './ship.js';
import { onArrive, closeRegion, genDirective } from './directives.js';
import { REGIONS, NODE_TYPES } from './data/regions.js';
import { hashString } from '../engine/rng.js';
import { clamp } from '../engine/util.js';

// Descanso de N horas en tierra
export function restCrew(run, hours, opts = {}) {
  const ateMeals = { meals: 0, rations: 0 };
  const medic = alive(run).reduce((b, c) => Math.max(b, c.skills.med), 0);
  const cook = alive(run).reduce((b, c) => Math.max(b, c.skills.coc), 0);
  for (const c of alive(run)) {
    c.fatigue = Math.max(0, c.fatigue - hours * 13 * tmul(c, 'restMul'));
    c.hunger = Math.min(100, c.hunger + hours * 7 * tmul(c, 'hungerMul'));
    let guard = 0;
    while (c.hunger > 35 && guard++ < 4) {
      if (run.res.meals > 0) {
        run.res.meals--;
        c.hunger = Math.max(0, c.hunger - 62);
        ateMeals.meals++;
      } else if (run.res.rations > 0) {
        run.res.rations--;
        c.hunger = Math.max(0, c.hunger - (cook >= 3 ? 55 : 38));
        ateMeals.rations++;
        if (cook < 3) c.morale = clamp(c.morale - 2, 0, 100);
      } else break;
    }
    c.cold = 0;
    c.drunk = 0;
    let healAmt = hours * 1.2;
    if (medic >= 2 && run.res.meds > 0 && c.hp < maxHp(c) * 0.8) {
      healAmt += hours * (1 + medic * 0.4);
      run.res.meds = Math.max(0, run.res.meds - 1);
    }
    c.hp = Math.min(maxHp(c), c.hp + healAmt);
    if (c.sick > 0 && run.res.meds > 0) {
      c.sick = 0;
      run.res.meds--;
    }
    c.morale = clamp(c.morale + (opts.morale ?? 6) - (c.hunger > 70 ? 10 : 0), 0, 100);
    c.act = null;
    c.breakdown = null;
  }
  run.clock += hours * 60;
  return `Descanso de ${hours} h: ${ateMeals.meals} comidas y ${ateMeals.rations} raciones consumidas.`;
}

// Paso del tiempo con necesidades (sin descanso), p. ej. durante un evento
export function passTime(run, minutes) {
  run.clock += minutes;
  for (const c of alive(run)) {
    c.hunger = Math.min(100, c.hunger + (minutes / 60) * 7);
    c.fatigue = Math.min(100, c.fatigue + (minutes / 60) * 4);
  }
}

// --- Llegada ----------------------------------------------------------------------
export function arrive(run) {
  const f = run.flight;
  const map = run.map;
  const msgs = [];
  const to = f ? f.to : map.cur;
  map.cur = to;
  const node = map.nodes[to];
  node.visited = true;
  if (!map.path.includes(to)) map.path.push(to);
  moveStorms(map, rng(run));
  reveal(map, shipStats(run.ship).range);
  run.forced = !!(f && f.forced);
  run.flight = null;
  passTime(run, 40);
  const L = run.lastLeg;
  if (L) {
    const parts = [`{d}Tramo: ${L.km} km en ${Math.floor(L.min / 60)}h ${String(L.min % 60).padStart(2, '0')}m · −${L.fuel} t{/}`];
    const extra = [];
    if (L.fires) extra.push(`${L.fires} incendio${L.fires > 1 ? 's' : ''}`);
    if (L.kills) extra.push(`${L.kills} derribo${L.kills > 1 ? 's' : ''}`);
    if (L.hull > 0) extra.push(`casco −${L.hull}%`);
    if (L.ammo) extra.push(`−${L.ammo} munición`);
    if (L.parts) extra.push(`−${L.parts} piezas`);
    if (L.deaths) extra.push(`{r}${L.deaths} baja${L.deaths > 1 ? 's' : ''}{/}`);
    if (extra.length) parts.push(`{d}${extra.join(' · ')}{/}`);
    msgs.push(...parts);
    run.lastLeg = null;
  }
  // revelaciones espontáneas
  for (const c of alive(run)) {
    if (has(c, 'oyente') && !c.revealed.oyente && run.region >= 3 && rng(run).chance(0.35)) {
      c.revealed.oyente = true;
      run.pendingReveal = run.pendingReveal || [];
      run.pendingReveal.push({ crew: c.id, trait: 'oyente' });
      msgs.push(`{v}${displayName(c)} lleva horas mirando a la nada, murmurando al ritmo de la Señal.{/}`);
    }
  }
  msgs.push(...onArrive(run, node));
  // bocazas en sitios con oídos
  if ((node.type === 'ciudad' || node.type === 'aerodromo' || node.type === 'militar') && alive(run).some((c) => has(c, 'bocazas'))) {
    addSuspicion(run, 3, 'Alguien de la tripulación ha hablado más de la cuenta');
    msgs.push('{r}Alguien de la tripulación se ha ido de la lengua (+sospecha).{/}');
  }
  // retraso respecto al plazo
  if (run.clock > run.deadline) {
    const late = Math.ceil((run.clock - run.deadline) / 60);
    addSuspicion(run, 2 + Math.min(6, late * 0.15), 'Moscú exige explicaciones por el retraso');
    msgs.push(`{r}Lleváis ${late} h de retraso sobre el plazo.{/}`);
  }
  // sospecha de fondo: el KGB nunca duerme
  addSuspicion(run, 0.8 * DIFFICULTY[run.difficulty].susp);
  run.stats.maxRegion = Math.max(run.stats.maxRegion, run.region);
  run.phase = 'event';
  return { node, msgs };
}

// Paso a la siguiente región
export function nextRegion(run) {
  const msgs = closeRegion(run);
  run.region++;
  run.stats.maxRegion = Math.max(run.stats.maxRegion, run.region);
  run.map = genRegionMap(run.seed, run.region, new RNG(hashString(run.seed + ':region:' + run.region)));
  run.map.nodes[0].visited = true;
  reveal(run.map, shipStats(run.ship).range);
  log(run, `Entrada en la Región ${REGIONS[run.region].roman}: ${REGIONS[run.region].name}.`, 'party');
  const n = rng(run).chance(0.6) ? 2 : 1;
  for (let i = 0; i < n; i++) genDirective(run);
  return msgs;
}

// --- Mercados ------------------------------------------------------------------
const BASE_PRICE = { fuel: 16, rations: 5, parts: 11, meds: 22, ammo: 0.8, vodka: 8, flares: 26 };
const MARKET_MOD = {
  aerodromo: { fuel: 0.85, parts: 0.9 },
  koljos: { rations: 0.6, vodka: 0.8, fuel: 1.3, parts: 1.4 },
  ciudad: { meds: 0.85, parts: 0.95, fuel: 1.1 },
  militar: { ammo: 0.6, flares: 0.7, fuel: 1.0 },
  estacion: { meds: 0.9, parts: 1.2 },
  aldea: { rations: 0.8, vodka: 0.7, fuel: 1.5, parts: 1.5 },
  gulag: { rations: 1.3, parts: 0.8 },
  frontera: { fuel: 1.1, rations: 1.2 },
};
const SELLS = {
  aerodromo: ['fuel', 'rations', 'parts', 'meds', 'ammo', 'vodka', 'flares'],
  koljos: ['rations', 'vodka', 'fuel'],
  ciudad: ['fuel', 'rations', 'parts', 'meds', 'vodka'],
  militar: ['fuel', 'ammo', 'flares', 'parts'],
  estacion: ['meds', 'parts', 'fuel'],
  aldea: ['rations', 'vodka'],
  gulag: ['parts', 'rations'],
  frontera: ['fuel', 'rations'],
};
const MODS_FOR = {
  aerodromo: ['motor', 'avionica', 'tanque', 'radar', 'radio', 'auxiliar', 'blindaje', 'arma'],
  ciudad: ['reactor', 'radio', 'medico', 'taller', 'moral', 'radar', 'carga'],
  militar: ['arma', 'blindaje', 'radar', 'arma'],
  estacion: ['reactor', 'auxiliar', 'medico', 'radar'],
  koljos: ['cocina', 'literas', 'moral', 'carga'],
};

export function market(run, node) {
  if (node.market) return node.market;
  const r = new RNG(node.seed ^ 0x5f3759df);
  const type = node.type;
  const sells = SELLS[type] || [];
  const prices = {};
  const stock = {};
  const infl = 1 + run.region * 0.12;
  for (const k of Object.keys(BASE_PRICE)) {
    const mod = (MARKET_MOD[type] || {})[k] || 1;
    prices[k] = Math.max(1, BASE_PRICE[k] * mod * infl * r.float(0.85, 1.15));
    stock[k] = sells.includes(k) ? Math.round((k === 'ammo' ? 200 : k === 'fuel' ? r.int(14, 30) : k === 'rations' ? r.int(20, 50) : r.int(4, 16)) * (type === 'aerodromo' ? 1.2 : 1)) : 0;
  }
  const modules = [];
  const pool = MODS_FOR[type];
  if (pool) {
    const n = type === 'aerodromo' ? r.int(3, 5) : r.int(1, 3);
    for (let i = 0; i < n; i++) {
      const q = type === 'estacion' ? (r.chance(0.6) ? 3 : 2) : undefined;
      const m = genModule(r, { type: r.pick(pool), region: run.region, quality: q });
      m.price = Math.round(m.value * (0.9 + run.region * 0.08) * r.float(0.9, 1.2));
      modules.push(m);
    }
  }
  const recruits = [];
  const nRec = type === 'aerodromo' ? r.int(1, 3) : type === 'ciudad' ? r.int(1, 2) : type === 'aldea' ? r.int(0, 1) : 0;
  for (let i = 0; i < nRec; i++) {
    const q = r.int(-1, 2);
    const c = genCrew(r, { quality: q });
    c.price = Math.round((70 + q * 40 + Math.max(...Object.values(c.skills)) * 12) * (1 + run.region * 0.1));
    recruits.push(c);
  }
  node.market = { prices, stock, modules, recruits, repairK: type === 'aerodromo' ? 1 : 1.5, sells };
  return node.market;
}

export function buyPrice(m, k) {
  return Math.ceil(m.prices[k]);
}
export function sellPrice(m, k) {
  return Math.max(0, Math.floor(m.prices[k] * 0.5 * 10) / 10);
}

export function hullRepairCost(run, mk) {
  let missing = 0;
  for (const id in run.ship.rooms) missing += 100 - run.ship.rooms[id].int;
  return Math.ceil(missing * 0.9 * mk.repairK);
}
export function moduleRepairCost(m, mk) {
  return Math.ceil(((m.maxInt - m.int) / m.maxInt) * m.value * 0.35 * mk.repairK);
}
