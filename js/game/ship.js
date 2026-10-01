// El T-0 «Topolev»: disposición de salas, estaciones, escaleras, ranuras de módulo
// y estadísticas derivadas de los módulos instalados.

import { genModule, modEff } from './loot.js';

// Salas: rectángulo con paredes incluidas. floor = fila de suelo (interior inferior).
const ROOMS = [
  { id: 'dorsal', name: 'Torreta dorsal', short: 'DORSAL', x: 48, y: 0, w: 10, h: 4, deck: 'top', insul: 10 },
  { id: 'cola', name: 'Torreta de cola', short: 'COLA', x: 6, y: 3, w: 10, h: 5, deck: 'up', insul: 14 },
  { id: 'dormitorio', name: 'Dormitorio', short: 'DORMITORIO', x: 15, y: 3, w: 16, h: 5, deck: 'up', insul: 25 },
  { id: 'comedor', name: 'Comedor y cocina', short: 'COMEDOR', x: 30, y: 3, w: 16, h: 5, deck: 'up', insul: 25 },
  { id: 'comisaria', name: 'Comisaría política', short: 'COMISARÍA', x: 45, y: 3, w: 11, h: 5, deck: 'up', insul: 25 },
  { id: 'radio', name: 'Sala de radio', short: 'RADIO', x: 55, y: 3, w: 13, h: 5, deck: 'up', insul: 25 },
  { id: 'navegacion', name: 'Navegación', short: 'NAVEG.', x: 67, y: 3, w: 11, h: 5, deck: 'up', insul: 25 },
  { id: 'cabina', name: 'Cabina de mando', short: 'CABINA', x: 77, y: 3, w: 12, h: 5, deck: 'up', insul: 20 },
  { id: 'bodega', name: 'Bodega', short: 'BODEGA', x: 15, y: 7, w: 16, h: 5, deck: 'low', insul: 15 },
  { id: 'reactor', name: 'Reactor', short: 'REACTOR', x: 30, y: 7, w: 15, h: 5, deck: 'low', insul: 25, heatSrc: 12 },
  { id: 'maquinas', name: 'Sala de máquinas', short: 'MÁQUINAS', x: 44, y: 7, w: 12, h: 5, deck: 'low', insul: 25, heatSrc: 6 },
  { id: 'taller', name: 'Taller', short: 'TALLER', x: 55, y: 7, w: 13, h: 5, deck: 'low', insul: 22 },
  { id: 'enfermeria', name: 'Enfermería', short: 'ENFERMERÍA', x: 67, y: 7, w: 13, h: 5, deck: 'low', insul: 25 },
  { id: 'motor1', name: 'Góndola motor 1', short: 'MOTOR 1', x: 22, y: 11, w: 12, h: 5, deck: 'bot', insul: 8, heatSrc: 8 },
  { id: 'ventral', name: 'Torreta ventral', short: 'VENTRAL', x: 46, y: 11, w: 9, h: 5, deck: 'bot', insul: 10 },
  { id: 'motor2', name: 'Góndola motor 2', short: 'MOTOR 2', x: 60, y: 11, w: 12, h: 5, deck: 'bot', insul: 8, heatSrc: 8 },
];

// Ranuras de módulo por sala
const SLOTS = [
  { id: 'cabina_av', room: 'cabina', type: 'avionica', name: 'Aviónica' },
  { id: 'nav_radar', room: 'navegacion', type: 'radar', name: 'Radar' },
  { id: 'radio_eq', room: 'radio', type: 'radio', name: 'Radio' },
  { id: 'comisaria_m', room: 'comisaria', type: 'moral', name: 'Moral' },
  { id: 'comedor_coc', room: 'comedor', type: 'cocina', name: 'Cocina' },
  { id: 'comedor_m', room: 'comedor', type: 'moral', name: 'Moral' },
  { id: 'dorm_lit', room: 'dormitorio', type: 'literas', name: 'Literas' },
  { id: 'bodega_carga', room: 'bodega', type: 'carga', name: 'Estiba' },
  { id: 'bodega_tanque', room: 'bodega', type: 'tanque', name: 'Depósito' },
  { id: 'reactor_core', room: 'reactor', type: 'reactor', name: 'Núcleo' },
  { id: 'maq_aux1', room: 'maquinas', type: 'auxiliar', name: 'Auxiliar A' },
  { id: 'maq_aux2', room: 'maquinas', type: 'auxiliar', name: 'Auxiliar B' },
  { id: 'taller_her', room: 'taller', type: 'taller', name: 'Herramientas' },
  { id: 'enf_eq', room: 'enfermeria', type: 'medico', name: 'Equipo médico' },
  { id: 'motor1_m', room: 'motor1', type: 'motor', name: 'Motor' },
  { id: 'motor2_m', room: 'motor2', type: 'motor', name: 'Motor' },
  { id: 'dorsal_arma', room: 'dorsal', type: 'arma', name: 'Arma' },
  { id: 'ventral_arma', room: 'ventral', type: 'arma', name: 'Arma' },
  { id: 'cola_arma', room: 'cola', type: 'arma', name: 'Arma' },
  { id: 'casco1', room: 'fuselaje', type: 'blindaje', name: 'Blindaje proa' },
  { id: 'casco2', room: 'fuselaje', type: 'blindaje', name: 'Blindaje centro' },
  { id: 'casco3', room: 'fuselaje', type: 'blindaje', name: 'Blindaje popa' },
];

// Estaciones: posición en el suelo de la sala. cat = categoría de trabajo.
const STATIONS = [
  { id: 'piloto', room: 'cabina', x: 85, cat: 'pilotar', label: 'Asiento del piloto', glyph: 'P' },
  { id: 'copiloto', room: 'cabina', x: 81, cat: 'pilotar', label: 'Asiento del copiloto', glyph: 'p', minor: true },
  { id: 'navegante', room: 'navegacion', x: 70, cat: 'navegar', label: 'Mesa de navegación', glyph: 'N' },
  { id: 'radio', room: 'radio', x: 58, cat: 'radio', label: 'Consola de radio', glyph: 'R' },
  { id: 'ciencia', room: 'radio', x: 64, cat: 'ciencia', label: 'Radiogoniómetro (la Señal)', glyph: 'S' },
  { id: 'politica', room: 'comisaria', x: 47, cat: 'politica', label: 'Escritorio del comisario', glyph: 'C' },
  { id: 'cocina', room: 'comedor', x: 32, cat: 'cocina', label: 'Hornillo', glyph: 'K' },
  { id: 'reactor', room: 'reactor', x: 38, cat: 'reactor', label: 'Consola del reactor', glyph: 'X' },
  { id: 'maquinas', room: 'maquinas', x: 52, cat: 'reactor', label: 'Control de motores', glyph: 'M', minor: true },
  { id: 'taller', room: 'taller', x: 59, cat: 'taller', label: 'Banco de trabajo', glyph: 'W' },
  { id: 'dorsal', room: 'dorsal', x: 54, cat: 'armas', label: 'Torreta dorsal', glyph: 'T', slot: 'dorsal_arma' },
  { id: 'ventral', room: 'ventral', x: 51, cat: 'armas', label: 'Torreta ventral', glyph: 'T', slot: 'ventral_arma' },
  { id: 'cola', room: 'cola', x: 9, cat: 'armas', label: 'Torreta de cola', glyph: 'T', slot: 'cola_arma' },
];

const BUNK_X = [17, 19, 25, 27, 29, 24];
const SEAT_X = [36, 38, 40, 42];
const BED_X = [69, 76];
const ENGINE_SPOT = { motor1: 25, motor2: 67 };

const DOORS = [
  [15, 6], [30, 6], [45, 6], [55, 6], [67, 6], [77, 6],
  [30, 10], [44, 10], [55, 10], [67, 10],
];
// Escaleras: x, yDesde (suelo superior), yHasta (suelo inferior)
const LADDERS = [
  [22, 6, 10], [50, 6, 10], [73, 6, 10],
  [52, 2, 6],
  [27, 10, 14], [48, 10, 14], [63, 10, 14],
];

export const SHIP_W = 92;
export const SHIP_H = 18;

let LAYOUT = null;
export function layout() {
  if (LAYOUT) return LAYOUT;
  const W = SHIP_W;
  const H = SHIP_H;
  const cell = new Array(W * H).fill(0); // 0 vacío, 1 pared, 2 interior, 3 suelo, 4 puerta, 5 escalera, 6 hueco escalera en pared
  const roomAt = new Array(W * H).fill(null);
  const rooms = {};
  for (const r of ROOMS) {
    const room = { ...r, floor: r.y + r.h - 2, x0: r.x + 1, x1: r.x + r.w - 2, top: r.y + 1 };
    rooms[r.id] = room;
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const i = y * W + x;
        const edge = y === r.y || y === r.y + r.h - 1 || x === r.x || x === r.x + r.w - 1;
        if (edge) {
          if (cell[i] === 0) cell[i] = 1;
        } else {
          cell[i] = y === room.floor ? 3 : 2;
          roomAt[i] = r.id;
        }
      }
    }
  }
  for (const [x, y] of DOORS) cell[y * W + x] = 4;
  const ladderCells = [];
  for (const [x, y0, y1] of LADDERS) {
    for (let y = y0 + 1; y < y1; y++) {
      const i = y * W + x;
      cell[i] = cell[i] === 1 ? 6 : 5;
      ladderCells.push([x, y]);
    }
  }
  // Puertas: pertenecen a la sala de la izquierda a efectos de "sala actual"
  const walk = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const c = cell[y * W + x];
    return c === 3 || c === 4 || c === 5 || c === 6;
  };
  const key = (x, y) => y * W + x;
  const nbCache = new Map();
  const neighbors = (k) => {
    let r = nbCache.get(k);
    if (r) return r;
    const x = k % W;
    const y = Math.floor(k / W);
    r = [];
    const c = cell[k];
    // horizontal: solo en suelos y puertas
    if (c === 3 || c === 4) {
      if (walk(x - 1, y) && (cell[key(x - 1, y)] === 3 || cell[key(x - 1, y)] === 4)) r.push(key(x - 1, y));
      if (walk(x + 1, y) && (cell[key(x + 1, y)] === 3 || cell[key(x + 1, y)] === 4)) r.push(key(x + 1, y));
    }
    // vertical: si esta celda o la vecina es escalera
    for (const dy of [-1, 1]) {
      const ny = y + dy;
      if (!walk(x, ny)) continue;
      const nc = cell[key(x, ny)];
      if (c === 5 || c === 6 || nc === 5 || nc === 6) r.push(key(x, ny));
    }
    nbCache.set(k, r);
    return r;
  };
  const roomOf = (x, y) => {
    const i = key(x, y);
    if (roomAt[i]) return roomAt[i];
    // puertas/escaleras en pared: buscar sala adyacente
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const j = key(x + dx, y + dy);
      if (roomAt[j]) return roomAt[j];
    }
    return null;
  };
  const stations = {};
  for (const s of STATIONS) stations[s.id] = { ...s, y: rooms[s.room].floor };
  LAYOUT = {
    W, H, cell, roomAt, rooms, roomList: ROOMS.map((r) => rooms[r.id]), slots: SLOTS, stations, stationList: Object.values(stations),
    bunkX: BUNK_X, seatX: SEAT_X, bedX: BED_X, engineSpot: ENGINE_SPOT, ladders: LADDERS, ladderCells, doors: DOORS,
    key, neighbors, roomOf, walk,
  };
  // adyacencia entre salas (para propagación de fuego/humo)
  const adj = {};
  for (const r of ROOMS) adj[r.id] = new Set();
  const link = (a, b) => {
    if (a && b && a !== b) {
      adj[a].add(b);
      adj[b].add(a);
    }
  };
  // compuertas (puertas y escotillas) que se pueden cerrar
  const links = [];
  for (const [x, y] of DOORS) {
    const a = roomAt[key(x - 1, y)];
    const b = roomAt[key(x + 1, y)];
    link(a, b);
    if (a && b) links.push({ a, b, key: `d${x}_${y}`, x, y, kind: 'door' });
  }
  for (const [x, y0, y1] of LADDERS) {
    const a = roomAt[key(x, y0)];
    const b = roomAt[key(x, y1)];
    link(a, b);
    let hy = null;
    for (let y = y0 + 1; y < y1; y++) if (cell[key(x, y)] === 6) hy = y;
    if (a && b && hy != null) links.push({ a, b, key: `h${x}_${hy}`, x, y: hy, kind: 'hatch' });
  }
  LAYOUT.adj = Object.fromEntries(Object.entries(adj).map(([k, v]) => [k, [...v]]));
  LAYOUT.links = links;
  LAYOUT.linksOf = {};
  for (const r of ROOMS) LAYOUT.linksOf[r.id] = [];
  for (const l of links) {
    LAYOUT.linksOf[l.a].push({ other: l.b, key: l.key });
    LAYOUT.linksOf[l.b].push({ other: l.a, key: l.key });
  }
  return LAYOUT;
}

export const SLOT_DEFS = SLOTS;
export function slotDef(id) {
  return SLOTS.find((s) => s.id === id);
}

// --- Variantes ----------------------------------------------------------
export const VARIANTS = {
  topolev: {
    name: 'T-0 «Topolev»', short: 'Topolev',
    desc: 'El prototipo original de la OKB. Equilibrado: dos motores fiables, reactor de 8 unidades y dos torretas armadas.',
    unlock: null,
  },
  bogatyr: {
    name: 'T-0B «Bogatyr»', short: 'Bogatyr',
    desc: 'Versión blindada para zonas hostiles. Tres torretas, blindaje pesado y un artillero extra. Lento y sediento.',
    unlock: 'Alcanzar la Región III',
  },
  rassvet: {
    name: 'T-0R «Rassvet»', short: 'Rassvet',
    desc: 'Versión de reconocimiento: radar de largo alcance, motores ligeros y una científica a bordo. Apenas armado.',
    unlock: 'Alcanzar la Región V',
  },
};

export function initialModules(rng, variant) {
  const g = (type, extra = {}) => genModule(rng, { type, quality: 1, noAffix: true, ...extra });
  const s = {};
  for (const sl of SLOTS) s[sl.id] = null;
  s.cabina_av = g('avionica');
  s.nav_radar = g('radar');
  s.radio_eq = g('radio');
  s.comedor_coc = g('cocina');
  s.dorm_lit = g('literas');
  s.dorm_lit.stats.bunks = 4;
  s.bodega_carga = g('carga');
  s.bodega_tanque = g('tanque');
  s.reactor_core = g('reactor');
  s.reactor_core.stats.power = 8;
  s.maq_aux1 = g('auxiliar', { sub: 'bomba' });
  s.taller_her = g('taller');
  s.enf_eq = g('medico');
  s.motor1_m = g('motor');
  s.motor2_m = g('motor');
  s.dorsal_arma = g('arma');
  s.cola_arma = g('arma');
  s.casco2 = g('blindaje');
  s.comisaria_m = genModule(rng, { type: 'moral', quality: 1, noAffix: true });
  if (variant === 'bogatyr') {
    s.ventral_arma = g('arma');
    s.casco1 = g('blindaje', { quality: 2 });
    s.casco3 = g('blindaje');
    s.reactor_core.stats.power = 9;
    s.bodega_tanque.stats.fuelCap = 32;
    s.motor1_m.stats.fuel = 1.1;
    s.motor2_m.stats.fuel = 1.1;
  } else if (variant === 'rassvet') {
    s.nav_radar = g('radar', { quality: 3 });
    s.cola_arma = null;
    s.casco2 = null;
    s.motor1_m = g('motor', { quality: 2, affixes: ['ligero'] });
    s.motor2_m = g('motor', { quality: 2, affixes: ['ligero'] });
    s.dorm_lit.stats.bunks = 3;
    s.maq_aux2 = g('auxiliar', { sub: 'antihielo' });
  }
  return s;
}

export function initialRooms() {
  const r = {};
  for (const room of ROOMS) r[room.id] = { fire: 0, breach: 0, o2: 100, temp: 16, rad: 0, int: 100, smoke: 0, ice: 0, dark: false };
  return r;
}

// --- Estadísticas derivadas ------------------------------------------------
export function shipStats(ship) {
  const S = ship.slots;
  const st = {
    thrust: 0, fuel: 0, power: 0, heat: 1, shield: 0, armor: 0, mass: 0, evasion: 0, autopilot: 0.5, turb: 0,
    bunks: 0, rest: 1, meals: 2, cookSpeed: 0.7, heal: 0.6, medEff: 0.8, craft: 0.6, repair: 1, cap: 1, fuelCap: 20,
    cool: 0, deice: 0, fireSup: 0, o2: 0, warn: 5, range: 10, detect: 0, decode: 0.7, iff: 0, morale: 0, suspicionMods: 0,
    engines: [], weapons: {},
  };
  for (const id in S) {
    const m = S[id];
    if (!m) continue;
    st.mass += m.mass;
    st.morale += m.morale || 0;
    const e = modEff(m);
    const x = m.stats;
    switch (m.type) {
      case 'motor':
        st.engines.push(id);
        break;
      case 'reactor':
        st.power += Math.round(x.power * (e > 0 ? Math.max(0.5, e) : 0));
        st.heat = x.heat;
        st.shield = x.shield;
        break;
      case 'radar': st.warn = x.warn * e; st.range = x.range * (0.5 + 0.5 * e); st.detect = x.detect; break;
      case 'radio': st.decode = x.decode * e; st.iff = x.iff; break;
      case 'blindaje': st.armor += x.armor * e; break;
      case 'literas': st.bunks = e > 0 ? x.bunks : 0; st.rest = x.rest; break;
      case 'cocina': st.meals = x.meals; st.cookSpeed = x.speed * e; break;
      case 'medico': st.heal = x.heal * e; st.medEff = x.medEff; break;
      case 'taller': st.craft = x.craft * e; st.repair = x.repair; break;
      case 'carga': st.cap = x.cap; break;
      case 'tanque': st.fuelCap = x.fuelCap * (e > 0 ? 1 : 0.5); break;
      case 'avionica': st.evasion = x.evasion * e; st.autopilot = x.autopilot; st.turb = x.turb; break;
      case 'arma': st.weapons[id] = m; break;
      case 'auxiliar':
        if (x.cool) st.cool += x.cool * e;
        if (x.deice) st.deice += x.deice * e;
        if (x.fireSup) st.fireSup += x.fireSup * e;
        if (x.o2) st.o2 += x.o2 * e;
        if (x.power) st.power += Math.round(x.power * e);
        break;
      default: break;
    }
  }
  st.bunks = Math.min(st.bunks, 6);
  return st;
}

// Capacidades de almacenamiento según la estiba
export function capacities(stats) {
  const k = stats.cap;
  return {
    fuel: Math.round(stats.fuelCap),
    rations: Math.round(60 * k),
    meals: Math.round(16 * k),
    parts: Math.round(50 * k),
    meds: Math.round(16 * k),
    ammo: Math.round(240 * k),
    vodka: Math.round(20 * k),
    flares: Math.round(6 * k),
    rubles: 99999,
    knowledge: 999,
  };
}
