// Tripulantes: generación procedural, retratos ASCII, modificadores de rasgos.

import { MALE, FEMALE, patronymic, surname, NICKS, ORIGINS } from './data/names.js';
import { SKILLS, ROLES, TRAITS, POS_TRAITS, NEG_TRAITS, HID_TRAITS, INCOMPATIBLE, CATS } from './data/traits.js';
import { clamp } from '../engine/util.js';

let nextId = 1;
export function resetCrewIds(n) {
  nextId = n;
}

function compatible(traits, t) {
  if (traits.includes(t)) return false;
  for (const [a, b] of INCOMPATIBLE) {
    if ((a === t && traits.includes(b)) || (b === t && traits.includes(a))) return false;
  }
  return true;
}

export function genCrew(rng, opts = {}) {
  const female = opts.female ?? rng.chance(0.3);
  const roleId = opts.role || rng.pick(['piloto', 'navegante', 'ingeniero', 'radio', 'medico', 'cocinero', 'artillero', 'cientifico', 'mecanico']);
  const role = ROLES[roleId];
  const skills = {};
  for (const s of SKILLS) skills[s.id] = rng.chance(0.55) ? rng.int(0, 2) : 0;
  const q = opts.quality ?? 0; // -2..+2 calidad del recluta
  if (role.main) skills[role.main] = clamp(rng.int(4, 7) + q, 2, 10);
  for (const s of role.sec) skills[s] = clamp(Math.max(skills[s], rng.int(2, 4) + Math.floor(q / 2)), 0, 10);
  // algo de cocina para todos (todo soviético sabe hervir patatas)
  skills.coc = Math.max(skills.coc, rng.int(0, 3));
  if (roleId === 'preso') {
    for (const s of SKILLS) skills[s.id] = rng.int(0, 4);
    skills[rng.pick(SKILLS).id] = rng.int(4, 7);
  }
  // rasgos
  const traits = opts.traits ? [...opts.traits] : [];
  const nPos = rng.chance(0.75) ? 1 : rng.chance(0.3) ? 2 : 0;
  const nNeg = rng.chance(0.7) ? 1 : 0;
  let guard = 0;
  while (traits.filter((t) => TRAITS[t].kind === 'pos').length < nPos && guard++ < 40) {
    const t = rng.pick(POS_TRAITS);
    if (compatible(traits, t)) traits.push(t);
  }
  guard = 0;
  while (traits.filter((t) => TRAITS[t].kind === 'neg').length < nNeg && guard++ < 40) {
    const t = rng.pick(NEG_TRAITS);
    if (compatible(traits, t)) traits.push(t);
  }
  if (opts.hidden !== false && rng.chance(opts.hiddenChance ?? 0.18)) {
    const t = rng.pick(HID_TRAITS);
    if (compatible(traits, t)) traits.push(t);
  }
  const c = {
    id: 'c' + nextId++,
    female,
    first: female ? rng.pick(FEMALE) : rng.pick(MALE),
    patro: patronymic(rng, female),
    sur: surname(rng, female),
    nick: rng.chance(0.25) ? rng.pick(NICKS) : null,
    age: rng.int(22, 54),
    origin: rng.pick(ORIGINS),
    role: roleId,
    skills,
    xp: {},
    traits,
    revealed: {}, // rasgos ocultos descubiertos
    face: genFace(rng, female, roleId),
    hp: 100,
    fatigue: rng.int(0, 15),
    hunger: rng.int(5, 25),
    cold: 0,
    morale: rng.int(55, 75),
    rad: 0,
    drunk: 0,
    sick: 0,
    dead: false,
    cause: null,
    pri: {},
    stats: { repairs: 0, fires: 0, kills: 0, meals: 0, heals: 0, km: 0 },
    hist: [],
    joined: null,
  };
  if (c.nick && female) c.nick = c.nick.replace(/^el /, 'la ');
  c.hp = maxHp(c);
  c.pri = defaultPriorities(c);
  return c;
}

export function defaultPriorities(c) {
  const p = {};
  for (const cat of CATS) {
    const sk = c.skills[cat.skill] || 0;
    let v = sk >= 6 ? 1 : sk >= 3 ? 2 : sk >= 1 ? 3 : 0;
    if (cat.id === 'emergencia') v = 1;
    if (cat.id === 'reparar' && v === 0) v = 3;
    if (cat.id === 'cocina' && v === 0) v = 3;
    if (cat.id === 'armas' && v === 0) v = 3;
    if (cat.id === 'pilotar' && sk < 3) v = c.role === 'piloto' ? 1 : 0;
    if (cat.id === 'politica' && c.role !== 'comisario') v = sk >= 5 ? 3 : 0;
    p[cat.id] = v;
  }
  return p;
}

// --- Modificadores de rasgos -------------------------------------------------
export function tmul(c, key) {
  let v = 1;
  for (const t of c.traits) {
    const m = TRAITS[t]?.mods?.[key];
    if (m !== undefined) v *= m;
  }
  return v;
}
export function tadd(c, key) {
  let v = 0;
  for (const t of c.traits) {
    const m = TRAITS[t]?.mods?.[key];
    if (m !== undefined) v += m;
  }
  return v;
}
export function has(c, trait) {
  return c.traits.includes(trait);
}
export function visibleTraits(c) {
  return c.traits.filter((t) => TRAITS[t].kind !== 'hid' || c.revealed[t]);
}

export function maxHp(c) {
  return 100 + tadd(c, 'hpMax');
}

export function fullName(c) {
  return `${c.first} ${c.patro} ${c.sur}`;
}
export function shortName(c) {
  return `${c.first[0]}. ${c.sur}`;
}
export function displayName(c) {
  return c.nick ? `${c.first} «${c.nick.replace(/^(el|la) /, '')}» ${c.sur}` : `${c.first} ${c.sur}`;
}
export function roleName(c) {
  const r = ROLES[c.role]?.name || c.role;
  if (c.female) {
    return r
      .replace('Piloto', 'Piloto')
      .replace('Ingeniero', 'Ingeniera')
      .replace('Médico', 'Médica')
      .replace('Cocinero', 'Cocinera')
      .replace('Científico', 'Científica')
      .replace('Mecánico', 'Mecánica')
      .replace('Prisionero', 'Prisionera')
      .replace('Navegante', 'Navegante');
  }
  return r;
}
export const a = (c, m, f) => (c.female ? f : m); // concordancia de género

export function bestSkill(c) {
  let best = null;
  for (const s of SKILLS) if (!best || c.skills[s.id] > c.skills[best]) best = s.id;
  return best;
}

// Experiencia: cada 100 puntos sube un nivel (más caro a niveles altos)
export function giveXp(c, skill, amount) {
  if (!skill) return false;
  c.xp[skill] = (c.xp[skill] || 0) + amount * tmul(c, 'xpMul');
  const need = 60 + c.skills[skill] * 25;
  if (c.xp[skill] >= need && c.skills[skill] < 10) {
    c.xp[skill] -= need;
    c.skills[skill]++;
    return true;
  }
  return false;
}

// --- Retratos -------------------------------------------------------------
function genFace(rng, female, role) {
  const hats = female ? ['panuelo', 'mono', 'pelo', 'gorra', 'ushanka', 'boina', 'casco'] : ['ushanka', 'gorra', 'pelo', 'calvo', 'casco', 'boina', 'rizos'];
  let hat = rng.pick(hats);
  if (role === 'piloto' && rng.chance(0.6)) hat = 'casco';
  if (role === 'comisario' && rng.chance(0.7)) hat = 'gorra';
  if (role === 'preso') hat = rng.pick(['calvo', 'pelo']);
  return {
    hat,
    head: rng.pick(['()', '()', '[]', '{}']),
    eyes: rng.pick(['o o', '• •', '° °', 'ò ó', 'ô ô']),
    glasses: rng.chance(0.18),
    beard: !female && rng.chance(0.22),
    moustache: !female && rng.chance(0.35),
    scar: rng.chance(0.12),
    medals: rng.int(0, 3),
  };
}

const HAT_MINI = {
  ushanka: '▄███▄', gorra: '▄▄★▄▄', pelo: ' ▄▄▄ ', calvo: ' ___ ', casco: '(▀▀▀)', boina: ' ▄▄▄▀',
  rizos: ' ∿∿∿ ', panuelo: '/▀▀▀\\', mono: ' ▄█▄ ',
};

// Retrato pequeño: 3 líneas de 5 caracteres. state: 'ok'|'sleep'|'hurt'|'dead'|'drunk'|'panic'
export function miniFace(c, state = 'ok') {
  const f = c.face;
  const hat = HAT_MINI[f.hat] || ' ▄▄▄ ';
  let eyes = f.glasses ? 'O-O' : f.eyes;
  if (state === 'sleep') eyes = '- -';
  else if (state === 'dead') eyes = 'x x';
  else if (state === 'hurt') eyes = '> <';
  else if (state === 'drunk') eyes = '@ @';
  else if (state === 'panic') eyes = '° °';
  const row1 = f.head[0] + eyes + f.head[1];
  let mouth = f.beard ? '\\▓▓▓/' : f.moustache ? ' ▀▀▀ ' : state === 'panic' ? '  O  ' : state === 'hurt' ? '  ~  ' : '  ─  ';
  if (state === 'dead') mouth = '  ─  ';
  return [hat, row1, mouth];
}

// Retrato grande: 9 líneas de 15 caracteres
export function bigFace(c, state = 'ok') {
  const f = c.face;
  const L = [];
  const hats = {
    ushanka: ['   ▄▄▄▄▄▄▄▄▄   ', ' ▄███████████▄ ', ' ██▀▀▀▀▀▀▀▀▀██ '],
    gorra: ['    ▄▄▄★▄▄▄    ', '  ▄█████████▄  ', ' ▀▀▀▀▀▀▀▀▀▀▀▀▀ '],
    pelo: ['               ', '    ▄▄▄▄▄▄▄    ', '   █▀▀▀▀▀▀▀█   '],
    calvo: ['               ', '    _______    ', '   /       \\   '],
    casco: ['    ▄▄▄▄▄▄▄    ', '  ▄█▀▀▀▀▀▀▀█▄  ', '  █ [=] [=] █  '],
    boina: ['     ▄▄▄▄▄▄▄▀  ', '   ▄███████▀   ', '   █▀▀▀▀▀▀▀█   '],
    rizos: ['    ∿∿∿∿∿∿∿    ', '   ∿∿∿∿∿∿∿∿∿   ', '   ∿▀▀▀▀▀▀▀∿   '],
    panuelo: ['    ▄▄▄▄▄▄▄    ', '  ▄█▀▀▀▀▀▀▀█▄  ', ' ▐█         █▌ '],
    mono: ['      ▄█▄      ', '    ▄▄███▄▄    ', '   █▀▀▀▀▀▀▀█   '],
  };
  const h = hats[f.hat] || hats.pelo;
  L.push(h[0], h[1], h[2]);
  const lb = f.head[0] === '(' ? '(' : f.head[0] === '[' ? '[' : '{';
  const rb = f.head[0] === '(' ? ')' : f.head[0] === '[' ? ']' : '}';
  let e = f.eyes.split(' ');
  if (state === 'sleep') e = ['-', '-'];
  else if (state === 'dead') e = ['x', 'x'];
  else if (state === 'hurt') e = ['>', '<'];
  else if (state === 'drunk') e = ['@', '@'];
  const eyes = f.glasses ? `(${e[0]})─(${e[1]})` : ` ${e[0]}   ${e[1]} `;
  L.push(`  ${lb}  ${eyes.padEnd(7)} ${rb}  `.slice(0, 15).padEnd(15));
  L.push(`  ${lb}${f.scar ? '/' : ' '}    ┘    ${rb}  `.slice(0, 15).padEnd(15));
  const mouth = f.moustache ? '▀▀▀▀▀' : state === 'hurt' ? ' ~~~ ' : state === 'dead' ? ' ─── ' : ' ─── ';
  L.push(`  ${lb}   ${mouth}   ${rb}  `.slice(0, 15).padEnd(15));
  L.push(f.beard ? '   \\▓▓▓▓▓▓▓/   ' : '   \\_______/   ');
  L.push('     ═╡ ╞═     ');
  const med = ['   ', ' ★ ', '★ ★', '★★★'][f.medals];
  L.push(`  ▄▄▄${med}▄▄▄▄▄▄  `.slice(0, 15).padEnd(15));
  return L;
}

export function faceState(c) {
  if (c.dead) return 'dead';
  if (c.act && c.act.kind === 'sleep') return 'sleep';
  if (c.drunk > 50) return 'drunk';
  if (c.hp < 40) return 'hurt';
  if (c.breakdown) return 'panic';
  return 'ok';
}
