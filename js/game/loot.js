// Generación procedural de módulos.

import { MODTYPES, MODTYPE_LIST, AUX, MORAL_ITEMS, WORDS, MAKERS, QUALITY, AFFIXES } from './data/modules.js';

const MASS = { motor: 4, reactor: 6, radar: 1, radio: 1, arma: 2, blindaje: 0, literas: 1, cocina: 1, medico: 1, taller: 1, carga: 1, tanque: 2, auxiliar: 2, avionica: 1, moral: 0 };

export const STAT_INFO = {
  thrust: { name: 'Empuje', unit: ' km/h', d: 0 },
  fuel: { name: 'Consumo', unit: ' t/h', d: 2, low: true },
  rel: { name: 'Fiabilidad', pct: true },
  iceRes: { name: 'Resist. hielo', pct: true },
  power: { name: 'Energía', unit: ' u', d: 0 },
  heat: { name: 'Calor', mul: true, low: true },
  shield: { name: 'Escudo radiológico', pct: true },
  warn: { name: 'Aviso temprano', unit: ' s', d: 0 },
  range: { name: 'Alcance de reconoc.', unit: '', d: 0 },
  detect: { name: 'Detección', pct: true },
  decode: { name: 'Descifrado', mul: true },
  iff: { name: 'Bonif. IFF', pct: true },
  dmg: { name: 'Daño', unit: '', d: 1 },
  rof: { name: 'Cadencia', unit: '/min', d: 0 },
  acc: { name: 'Precisión', pct: true },
  ammo: { name: 'Munición/ráfaga', unit: '', d: 0, low: true },
  armor: { name: 'Blindaje', unit: '', d: 1 },
  mass: { name: 'Masa', unit: ' t', d: 0, low: true },
  bunks: { name: 'Literas', unit: '', d: 0 },
  rest: { name: 'Descanso', mul: true },
  meals: { name: 'Comidas/tanda', unit: '', d: 0 },
  speed: { name: 'Velocidad', mul: true },
  heal: { name: 'Curación', mul: true },
  medEff: { name: 'Efic. medicinas', mul: true },
  craft: { name: 'Fabricación', mul: true },
  repair: { name: 'Reparación', mul: true },
  cap: { name: 'Capacidad', mul: true },
  fuelCap: { name: 'Capacidad', unit: ' t', d: 0 },
  cool: { name: 'Refrigeración', unit: '', d: 2 },
  deice: { name: 'Antihielo', pct: true },
  fireSup: { name: 'Supresión fuego', pct: true },
  o2: { name: 'Purificación', pct: true },
  evasion: { name: 'Evasión', pct: true },
  autopilot: { name: 'Piloto automático', pct: true },
  turb: { name: 'Antiturbulencia', pct: true },
  morale: { name: 'Moral', unit: '', d: 0 },
  maxInt: { name: 'Integridad máx.', unit: '', d: 0 },
};

export function fmtStat(k, v) {
  const s = STAT_INFO[k];
  if (!s) return String(v);
  if (s.pct) return Math.round(v * 100) + '%';
  if (s.mul) return '×' + v.toFixed(2);
  return (s.d ? v.toFixed(s.d) : Math.round(v)) + (s.unit || '');
}

let nextModId = 1;
export function resetModIds(n) {
  nextModId = n;
}

const r2 = (v) => Math.round(v * 100) / 100;

// opts: type, quality (0-4), affixes [], region (0-4), sub (auxiliar), noAffix, maker
export function genModule(rng, opts = {}) {
  const region = opts.region ?? 0;
  const type = opts.type || rng.pick(MODTYPE_LIST);
  const T = MODTYPES[type];
  let q = opts.quality;
  if (q == null) {
    const r = rng.next() + region * 0.06;
    q = r < 0.2 ? 0 : r < 0.72 ? 1 : r < 0.93 ? 2 : r < 1.06 ? 3 : 4;
    if (q === 4 && region < 3) q = 3;
  }
  const Q = QUALITY[q];
  const m = {
    id: 'm' + nextModId++,
    type,
    sub: null,
    q,
    affixes: [],
    stats: {},
    mass: MASS[type],
    maxInt: q === 3 ? 85 : q === 0 ? 90 : 100,
    int: 100,
    rel: 0.9,
    value: T.base,
    maker: opts.maker || rng.pick(MAKERS),
    name: '',
    morale: 0,
    suspicion: 0,
  };
  let stats = T.stats;
  if (type === 'auxiliar') {
    m.sub = opts.sub || rng.pick(Object.keys(AUX));
    stats = AUX[m.sub].stats;
  }
  for (const k in stats) {
    const [a, b] = stats[k];
    let v = a + (b - a) * rng.next();
    // calidad multiplica la estadística (inversa para las "low")
    const low = STAT_INFO[k]?.low;
    if (k === 'mass') v = Math.round(v);
    else if (low) v = v / Q.mult;
    else v = v * Q.mult;
    m.stats[k] = k === 'bunks' || k === 'meals' || k === 'armor' ? Math.round(v) : r2(v);
  }
  if (type === 'blindaje') {
    m.mass = m.stats.mass;
    delete m.stats.mass;
  }
  if (type === 'motor') {
    m.rel = m.stats.rel;
    delete m.stats.rel;
  } else {
    m.rel = r2(0.9 + (q - 1) * 0.015 - (q >= 3 ? 0.06 : 0));
  }
  if (type === 'moral') {
    const it = rng.pick(MORAL_ITEMS);
    m.item = it[0];
    m.likes = it[1];
    m.morale = m.stats.morale;
  }
  // afijos
  const aff = opts.affixes ? [...opts.affixes] : [];
  if (!opts.noAffix && !opts.affixes) {
    const n = rng.chance(0.35 + q * 0.08) ? (rng.chance(0.2) ? 2 : 1) : 0;
    let guard = 0;
    while (aff.length < n && guard++ < 30) {
      const id = rng.pick(Object.keys(AFFIXES));
      const A = AFFIXES[id];
      if (aff.includes(id) || (A.types && !A.types.includes(type))) continue;
      if (id === 'americano' && region < 1 && rng.chance(0.7)) continue;
      aff.push(id);
    }
  }
  const main = type === 'auxiliar' ? Object.keys(stats)[0] : T.main;
  for (const id of aff) {
    const A = AFFIXES[id];
    m.affixes.push(id);
    if (A.mainMul && m.stats[main] != null) {
      const low = STAT_INFO[main]?.low;
      m.stats[main] = r2(low ? m.stats[main] / A.mainMul : m.stats[main] * A.mainMul);
      if (['bunks', 'meals', 'armor'].includes(main)) m.stats[main] = Math.max(1, Math.round(m.stats[main]));
    }
    if (A.maxInt) m.maxInt += A.maxInt;
    if (A.mass) m.mass = Math.max(0, m.mass + A.mass);
    if (A.rel) m.rel = r2(Math.min(0.99, m.rel + A.rel));
    if (A.heat && m.stats.heat != null) m.stats.heat = r2(Math.max(0.5, m.stats.heat + A.heat));
    if (A.fuel && m.stats.fuel != null) m.stats.fuel = r2(m.stats.fuel * A.fuel);
    if (A.iceRes && m.stats.iceRes != null) m.stats.iceRes = r2(Math.min(0.9, m.stats.iceRes + A.iceRes));
    if (A.power && m.stats.power != null) m.stats.power += A.power;
    if (A.shield && m.stats.shield != null) m.stats.shield = r2(Math.max(0, m.stats.shield + A.shield));
    if (A.acc) m.stats.acc = r2((m.stats.acc || 0) + A.acc);
    if (A.morale) m.morale += A.morale;
    if (A.suspicion) m.suspicion += A.suspicion;
  }
  m.int = m.maxInt;
  if (m.affixes.includes('gastado')) m.int = Math.round(m.maxInt * rng.float(0.3, 0.6));
  if (opts.worn) m.int = Math.round(m.maxInt * opts.worn);
  // valor
  let val = T.base * Q.value * rng.float(0.9, 1.1);
  for (const id of m.affixes) val *= AFFIXES[id].value || 1;
  m.value = Math.round(val);
  // nombre
  if (type === 'moral') m.name = m.item;
  else if (type === 'auxiliar') m.name = `${AUX[m.sub].name} ${rng.pick(T.codes)}-${rng.int(1, 9)}`;
  else {
    const code = `${rng.pick(T.codes)}-${rng.int(2, 40)}${rng.chance(0.4) ? rng.pick(['M', 'B', 'D', 'U', 'F', 'K']) : ''}`;
    m.name = `${T.name} ${code} «${rng.pick(WORDS)}»`;
  }
  return m;
}

export function modTitle(m) {
  const aff = m.affixes.map((a) => AFFIXES[a].name).join(', ');
  return aff ? `${m.name}, ${aff}` : m.name;
}

export function modMainStat(m) {
  if (m.type === 'auxiliar') return Object.keys(m.stats)[0];
  return MODTYPES[m.type].main;
}

// Factor de eficacia según integridad
export function modEff(m) {
  if (!m) return 0;
  const k = m.int / m.maxInt;
  if (m.int <= 0) return 0;
  return k > 0.5 ? 1 : 0.4 + k * 1.2;
}

// Precio de venta/compra
export function modPrice(m, buy = true) {
  const cond = 0.4 + 0.6 * (m.int / m.maxInt);
  return Math.max(5, Math.round(m.value * cond * (buy ? 1 : 0.45)));
}

export function scrapValue(m) {
  return Math.max(1, Math.round((m.value / 40) * (0.3 + 0.7 * (m.int / m.maxInt))));
}

// Líneas descriptivas (con marcado) para tooltips; cmp = módulo a comparar
export function modLines(m, cmp = null) {
  const L = [];
  const Q = QUALITY[m.q];
  L.push(`{${Q.color === 'grey' ? 'x' : Q.color}}${modTitle(m)}{/}`);
  L.push(`{d}${MODTYPES[m.type].name}${m.sub ? ' · ' + AUX[m.sub].name : ''} · ${Q.name} · ${m.maker}{/}`);
  const intPct = Math.round((m.int / m.maxInt) * 100);
  const intC = intPct > 60 ? 'o' : intPct > 30 ? 'y' : 'r';
  L.push(`Integridad: {${intC}}${Math.round(m.int)}/${m.maxInt}{/}`);
  const keys = Object.keys(m.stats);
  for (const k of keys) {
    let line = `${STAT_INFO[k]?.name || k}: {l}${fmtStat(k, m.stats[k])}{/}`;
    if (cmp && cmp.stats[k] != null && cmp !== m) {
      const d = m.stats[k] - cmp.stats[k];
      if (Math.abs(d) > 0.001) {
        const good = STAT_INFO[k]?.low ? d < 0 : d > 0;
        line += ` {${good ? 'g' : 'r'}}(${d > 0 ? '+' : ''}${STAT_INFO[k]?.pct ? Math.round(d * 100) + '%' : STAT_INFO[k]?.mul ? d.toFixed(2) : Math.round(d * 100) / 100})`;
        line += '{/}';
      }
    }
    L.push(line);
  }
  if (m.type !== 'moral') L.push(`Fiabilidad: {l}${Math.round(m.rel * 100)}%{/}  Masa: {l}${m.mass} t{/}`);
  if (m.morale) L.push(`Moral a bordo: {${m.morale > 0 ? 'g' : 'r'}}${m.morale > 0 ? '+' : ''}${m.morale}{/}`);
  if (m.suspicion) L.push(`{r}Instalarlo levanta sospechas (+${m.suspicion}){/}`);
  if (m.likes) L.push(`{d}Especialmente apreciado por: ${m.likes}{/}`);
  L.push(`{x}Valor: ${m.value} ₽{/}`);
  return L;
}
