// Utilidades genéricas del motor.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const fmt = (n, d = 0) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d);
export const pad = (s, n, ch = ' ') => {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ch.repeat(n - s.length);
};
export const padL = (s, n, ch = ' ') => {
  s = String(s);
  return s.length >= n ? s.slice(-n) : ch.repeat(n - s.length) + s;
};
export const center = (s, n, ch = ' ') => {
  s = String(s);
  if (s.length >= n) return s.slice(0, n);
  const l = Math.floor((n - s.length) / 2);
  return ch.repeat(l) + s + ch.repeat(n - s.length - l);
};

// --- Color -----------------------------------------------------------------
const rgbCache = new Map();
export function hexToRgb(hex) {
  let c = rgbCache.get(hex);
  if (c) return c;
  if (hex.startsWith('rgb')) {
    const m = hex.match(/[\d.]+/g).map(Number);
    c = [m[0], m[1], m[2]];
  } else {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  rgbCache.set(hex, c);
  return c;
}
const toHex2 = (v) => {
  v = Math.round(clamp(v, 0, 255));
  return (v < 16 ? '0' : '') + v.toString(16);
};
export const rgbToHex = (r, g, b) => '#' + toHex2(r) + toHex2(g) + toHex2(b);

const mixCache = new Map();
// Mezcla dos colores (hex) con t en [0,1]. Cacheado por paso de 1/64.
export function mix(a, b, t) {
  t = clamp(t, 0, 1);
  if (t <= 0) return a;
  if (t >= 1) return b;
  const q = Math.round(t * 64);
  const key = a + b + q;
  let r = mixCache.get(key);
  if (r) return r;
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const tt = q / 64;
  r = rgbToHex(lerp(A[0], B[0], tt), lerp(A[1], B[1], tt), lerp(A[2], B[2], tt));
  if (mixCache.size > 20000) mixCache.clear();
  mixCache.set(key, r);
  return r;
}
export const dim = (c, t) => mix(c, '#000000', t);

// --- Texto -----------------------------------------------------------------
// Ajusta texto plano a un ancho. Respeta saltos de línea.
export function wrap(text, width) {
  const out = [];
  for (const para of String(text).split('\n')) {
    if (para === '') {
      out.push('');
      continue;
    }
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      if (!line.length) line = w;
      else if (line.length + 1 + w.length <= width) line += ' ' + w;
      else {
        out.push(line);
        line = w;
      }
      while (line.length > width) {
        out.push(line.slice(0, width));
        line = line.slice(width);
      }
    }
    out.push(line);
  }
  return out;
}

// --- Búsqueda de caminos (BFS en rejilla de nodos con vecinos) --------------
// nodes: Map key->[keys vecinos]. Devuelve array de keys desde start (excl) a goal (incl).
export function bfs(neighbors, start, goal) {
  if (start === goal) return [];
  const prev = new Map([[start, null]]);
  const q = [start];
  let h = 0;
  while (h < q.length) {
    const cur = q[h++];
    const nb = neighbors(cur);
    for (let i = 0; i < nb.length; i++) {
      const n = nb[i];
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === goal) {
        const path = [n];
        let p = cur;
        while (p !== start) {
          path.push(p);
          p = prev.get(p);
        }
        return path.reverse();
      }
      q.push(n);
    }
  }
  return null;
}

export const uid = (() => {
  let n = 0;
  return (p = 'id') => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;
})();

export function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

// Línea de Bresenham entre dos puntos (incluye extremos).
export function line(x0, y0, x1, y1) {
  const pts = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return pts;
}
