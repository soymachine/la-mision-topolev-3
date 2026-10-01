// Mapas regionales: terreno procedural, grafo de nodos y frentes meteorológicos.

import { RNG, Noise2D, hashString } from '../engine/rng.js';
import { C } from '../palette.js';
import { REGIONS, NODE_TYPES, ANOMALY_NAMES, WRECKS } from './data/regions.js';
import { placeName, KOLKHOZ } from './data/names.js';
import { line } from '../engine/util.js';

export const MAP_W = 120;
export const MAP_H = 40;
export const KM_PER_CELL = 22;
const COLS = 7;

// --- Terreno -------------------------------------------------------------
const terrainCache = new Map();

export function terrain(seed, regionIdx) {
  const key = seed + ':' + regionIdx;
  if (terrainCache.has(key)) return terrainCache.get(key);
  const R = REGIONS[regionIdx];
  const rng = new RNG(hashString(key + 'terr'));
  const nE = new Noise2D(hashString(key + 'e'));
  const nM = new Noise2D(hashString(key + 'm'));
  const W = MAP_W;
  const H = MAP_H;
  const ch = new Array(W * H).fill(' ');
  const fg = new Array(W * H).fill(C.o1);
  const kind = new Array(W * H).fill('plain');
  const ridgeX = (y) => W * 0.5 + Math.sin(y * 0.15 + rng.next() * 0) * 6 + nE.get(3.3, y * 0.08) * 10 - 5;
  const epi = { x: W - 14, y: H / 2 };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let e = nE.fbm(x * 0.05, y * 0.1, 4);
      const m = nM.fbm(x * 0.07 + 10, y * 0.14, 3);
      const fine = nE.get(x * 0.9, y * 1.7);
      let c = ' ';
      let col = C.o1;
      let k = 'plain';
      const t = R.terrain;
      if (t === 'mountains') {
        const d = Math.abs(x - ridgeX(y));
        e += Math.exp(-(d * d) / 70) * 0.5;
      } else if (t === 'plains') e = 0.5 + (e - 0.5) * 0.7;
      const waterT = t === 'swamps' ? 0.31 : t === 'plains' ? 0.29 : 0.27;
      const hillT = t === 'mountains' ? 0.62 : t === 'plains' ? 0.76 : 0.7;
      const mountT = t === 'mountains' ? 0.72 : 0.82;
      const peakT = t === 'mountains' ? 0.84 : 0.92;
      const forestT = { plains: 0.6, mountains: 0.54, swamps: 0.6, taiga: 0.42, tunguska: 0.44 }[t];
      if (e < waterT) {
        c = '≈';
        col = C.ice2;
        k = 'water';
      } else if (t === 'swamps' && m > 0.55) {
        c = fine > 0.6 ? '~' : fine > 0.3 ? '"' : ' ';
        col = fine > 0.6 ? C.iceD : C.o1;
        k = 'marsh';
      } else if (e > peakT) {
        c = '▲';
        col = C.white;
        k = 'peak';
      } else if (e > mountT) {
        c = fine > 0.4 ? '^' : '▲';
        col = fine > 0.4 ? C.o3 : C.o2;
        k = 'mount';
      } else if (e > hillT) {
        c = fine > 0.55 ? '∩' : fine > 0.3 ? 'n' : ' ';
        col = C.o1;
        k = 'hill';
      } else if (m > forestT) {
        const dense = m > forestT + 0.1;
        c = dense ? (fine > 0.35 ? '♠' : '♣') : fine > 0.45 ? '♣' : fine > 0.3 ? '.' : ' ';
        col = dense ? C.o2 : C.o1;
        k = 'forest';
      } else {
        c = fine > 0.86 ? '.' : fine > 0.8 ? ',' : ' ';
        col = C.o1;
        if (t === 'plains' && m < 0.36 && fine > 0.5) {
          c = '"';
          col = C.o0;
          k = 'field';
        }
        if (t === 'taiga' || t === 'tunguska') {
          if (fine > 0.6) {
            c = '♣';
            col = C.o1;
          }
        }
      }
      // Tunguska: árboles abatidos radialmente
      if (t === 'tunguska') {
        const dx = x - epi.x;
        const dy = (y - epi.y) * 2;
        const d = Math.hypot(dx, dy);
        if (d < 34 && k !== 'water') {
          const ang = Math.atan2(dy, dx);
          const a = ((ang + Math.PI) / Math.PI) * 4;
          const dir = Math.round(a) % 4;
          c = ['─', '\\', '│', '/'][dir];
          col = d < 10 ? C.grey2 : d < 22 ? C.o1 : C.o2;
          if (d < 4) {
            c = fine > 0.5 ? '·' : ' ';
            col = C.violet;
          }
          k = 'fallen';
        }
      }
      ch[i] = c;
      fg[i] = col;
      kind[i] = k;
    }
  }
  // Ríos: bajan de norte a sur
  const rivers = R.terrain === 'swamps' ? 3 : R.terrain === 'plains' || R.terrain === 'taiga' ? 2 : 1;
  for (let r = 0; r < rivers; r++) {
    let x = Math.floor(W * (0.2 + 0.6 * rng.next()));
    for (let y = 0; y < H; y++) {
      x += rng.int(-1, 1) + (rng.chance(0.1) ? rng.pick([-2, 2]) : 0);
      x = Math.max(1, Math.min(W - 2, x));
      for (const xx of [x, x + 1]) {
        const i = y * W + xx;
        if (kind[i] === 'peak') continue;
        ch[i] = y % 3 === 0 ? '~' : '≈';
        fg[i] = C.ice2;
        kind[i] = 'river';
      }
    }
  }
  // Transiberiano
  if (R.terrain !== 'tunguska') {
    let y = Math.floor(H * (0.55 + rng.float(-0.1, 0.12)));
    for (let x = 0; x < W; x++) {
      if (x % 9 === 0) y += rng.int(-1, 1);
      y = Math.max(3, Math.min(H - 4, y));
      const i = y * W + x;
      if (kind[i] === 'river' || kind[i] === 'water') ch[i] = '╪';
      else ch[i] = x % 2 ? '─' : '┼';
      fg[i] = C.grey2;
      kind[i] = 'rail';
    }
  }
  const T = { W, H, ch, fg, kind, epi };
  terrainCache.set(key, T);
  return T;
}

// --- Grafo de nodos ------------------------------------------------------
function nodeName(rng, type, regionIdx) {
  switch (type) {
    case 'aerodromo': return rng.chance(0.5) ? `Aeródromo de ${placeName(rng)}` : `Base aérea Nº ${rng.int(12, 412)}`;
    case 'koljos': return `Koljós «${rng.pick(KOLKHOZ)}»`;
    case 'aldea': return `Aldea de ${placeName(rng)}`;
    case 'ciudad': return `Ciudad cerrada ${placeName(rng)}-${rng.int(4, 45)}`;
    case 'militar': return `Base PVO «${placeName(rng)}»`;
    case 'restos': return `Restos de ${rng.pick(WRECKS)}`;
    case 'gulag': return `Campo ITL-${rng.int(10, 99)} «${placeName(rng)}»`;
    case 'estacion': return `Estación científica ${placeName(rng)}`;
    case 'anomalia': return `Anomalía «${rng.pick(ANOMALY_NAMES)}»`;
    case 'frontera': return regionIdx < 4 ? `Paso hacia ${REGIONS[regionIdx + 1].name}` : 'Frontera';
    case 'epicentro': return 'Epicentro de Tunguska';
    case 'inicio': return regionIdx === 0 ? 'Aeródromo de Zhukovski (Moscú)' : `Entrada a ${REGIONS[regionIdx].name}`;
    default: return placeName(rng);
  }
}

export function genRegionMap(seed, regionIdx, rng) {
  const R = REGIONS[regionIdx];
  const T = terrain(seed, regionIdx);
  const nodes = [];
  const edges = [];
  const cols = [];
  let id = 0;
  for (let c = 0; c < COLS; c++) {
    const n = c === 0 || c === COLS - 1 ? 1 : rng.int(c === 1 || c === COLS - 2 ? 2 : 2, c === 3 ? 4 : 3);
    const col = [];
    const xBase = 6 + Math.round((c * (MAP_W - 12)) / (COLS - 1));
    for (let k = 0; k < n; k++) {
      let y;
      if (n === 1) y = Math.round(MAP_H / 2 + rng.int(-4, 4));
      else {
        const band = (MAP_H - 8) / n;
        y = Math.round(4 + band * k + band * rng.float(0.2, 0.8));
      }
      let x = xBase + (c === 0 || c === COLS - 1 ? 0 : rng.int(-3, 3));
      // evitar el agua profunda
      for (let tries = 0; tries < 6; tries++) {
        const kk = T.kind[y * MAP_W + x];
        if (kk !== 'water' && kk !== 'peak') break;
        x += rng.int(-2, 2);
        y = Math.max(2, Math.min(MAP_H - 3, y + rng.int(-2, 2)));
      }
      const node = { id: id++, col: c, x, y, type: 'aldea', name: '', known: false, visited: false, seed: rng.int(1, 1e9) };
      col.push(node);
      nodes.push(node);
    }
    cols.push(col);
  }
  // tipos
  for (const node of nodes) {
    if (node.col === 0) node.type = 'inicio';
    else if (node.col === COLS - 1) node.type = regionIdx === 4 ? 'epicentro' : 'frontera';
    else {
      const items = Object.entries(R.weights).filter(([, w]) => w > 0);
      node.type = rng.weighted(items);
    }
  }
  // garantizar un aeródromo en las columnas centrales
  const mid = nodes.filter((n) => n.col >= 2 && n.col <= 4);
  if (!mid.some((n) => n.type === 'aerodromo')) rng.pick(mid).type = 'aerodromo';
  // evitar dos aeródromos en la misma columna
  for (const col of cols) {
    const aero = col.filter((n) => n.type === 'aerodromo');
    for (let i = 1; i < aero.length; i++) aero[i].type = 'aldea';
  }
  for (const node of nodes) {
    node.name = nodeName(rng, node.type, regionIdx);
    node.known = NODE_TYPES[node.type].known;
  }
  // aristas sin cruces (escalera entre columnas ordenadas por y)
  for (let c = 0; c < COLS - 1; c++) {
    const A = [...cols[c]].sort((p, q) => p.y - q.y);
    const B = [...cols[c + 1]].sort((p, q) => p.y - q.y);
    let i = 0;
    let j = 0;
    edges.push([A[0].id, B[0].id]);
    while (i < A.length - 1 || j < B.length - 1) {
      if (i === A.length - 1) j++;
      else if (j === B.length - 1) i++;
      else {
        const r = rng.next();
        if (r < 0.4) i++;
        else if (r < 0.8) j++;
        else {
          i++;
          j++;
        }
      }
      edges.push([A[i].id, B[j].id]);
    }
  }
  // tormentas
  const storms = [];
  const ns = rng.int(R.storms[0], R.storms[1]);
  for (let s = 0; s < ns; s++) {
    storms.push({
      x: rng.float(20, MAP_W - 10),
      y: rng.float(4, MAP_H - 4),
      r: rng.float(5, 10),
      vx: rng.float(-4, 1.5),
      vy: rng.float(-1.5, 1.5),
      p: rng.float(0.4, 1),
      seed: rng.int(1, 9999),
    });
  }
  return { region: regionIdx, nodes, edges, cur: 0, storms, path: [0] };
}

export function nodeById(map, id) {
  return map.nodes[id];
}

export function neighborsOf(map, id) {
  return map.edges.filter((e) => e[0] === id).map((e) => e[1]);
}

export function legDistance(a, b) {
  return Math.round(Math.hypot(b.x - a.x, (b.y - a.y) * 2) * KM_PER_CELL);
}

// Intensidad meteorológica de un tramo (0..1+)
export function legWeather(map, a, b) {
  let w = 0;
  const pts = line(a.x, a.y, b.x, b.y);
  for (const s of map.storms) {
    let best = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = pts[i];
      const d = Math.hypot(x - s.x, (y - s.y) * 2);
      if (d < s.r * 1.4) best = Math.max(best, (1 - d / (s.r * 1.4)) * s.p);
    }
    w += best;
  }
  return Math.min(1.5, w);
}

export function moveStorms(map, rng) {
  for (const s of map.storms) {
    s.x += s.vx;
    s.y += s.vy;
    s.vx += rng.float(-0.6, 0.6);
    s.vy += rng.float(-0.5, 0.5);
    s.vx = Math.max(-5, Math.min(3, s.vx));
    s.vy = Math.max(-2, Math.min(2, s.vy));
    s.p = Math.max(0.25, Math.min(1.1, s.p + rng.float(-0.12, 0.12)));
    if (s.x < -10 || s.x > MAP_W + 10 || s.y < -6 || s.y > MAP_H + 6) {
      // reaparece por el este o un borde
      s.x = MAP_W + 6;
      s.y = rng.float(4, MAP_H - 4);
      s.vx = rng.float(-4, -1);
      s.r = rng.float(5, 10);
      s.p = rng.float(0.4, 1);
    }
  }
}

// Revela nodos dentro del alcance de reconocimiento
export function reveal(map, range) {
  const cur = map.nodes[map.cur];
  let n = 0;
  for (const node of map.nodes) {
    if (node.known) continue;
    const d = Math.hypot(node.x - cur.x, (node.y - cur.y) * 1.5);
    if (d <= range) {
      node.known = true;
      n++;
    }
  }
  return n;
}
