// Generador pseudoaleatorio con semilla y estado serializable (mulberry32)
// + ruido de valor 2D con fbm.

export function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class RNG {
  constructor(seed = 1) {
    this.state = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }
  static from(state) {
    const r = new RNG(1);
    r.state = state >>> 0;
    return r;
  }
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a = 0, b = 1) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    // entero en [a, b] inclusive
    return a + Math.floor(this.next() * (b - a + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  // items: [{w: peso, ...}] o pares [item, peso]
  weighted(items, wkey = 'w') {
    let total = 0;
    for (const it of items) total += Array.isArray(it) ? it[1] : it[wkey];
    let r = this.next() * total;
    for (const it of items) {
      const w = Array.isArray(it) ? it[1] : it[wkey];
      if ((r -= w) < 0) return Array.isArray(it) ? it[0] : it;
    }
    const last = items[items.length - 1];
    return Array.isArray(last) ? last[0] : last;
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  gauss(mean = 0, sd = 1) {
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  // Sub-generador derivado (para no alterar la secuencia principal)
  fork(tag = '') {
    return new RNG((hashString(tag) ^ Math.floor(this.next() * 4294967296)) >>> 0);
  }
}

// Ruido de valor 2D con interpolación suave.
export class Noise2D {
  constructor(seed) {
    const r = new RNG(seed);
    this.perm = new Uint16Array(512);
    this.vals = new Float32Array(256);
    const p = [];
    for (let i = 0; i < 256; i++) {
      p.push(i);
      this.vals[i] = r.next();
    }
    r.shuffle(p);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  v(ix, iy) {
    return this.vals[this.perm[(ix & 255) + this.perm[iy & 255]]];
  }
  get(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = this.v(ix, iy);
    const b = this.v(ix + 1, iy);
    const c = this.v(ix, iy + 1);
    const d = this.v(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let amp = 1;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += this.get(x * f, y * f) * amp;
      norm += amp;
      amp *= gain;
      f *= lac;
    }
    return sum / norm;
  }
}
