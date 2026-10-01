// Partículas ASCII: glifos con posición fraccional (en celdas) dibujados en la capa FX.

import { C } from '../palette.js';
import { mix } from './util.js';

const R = Math.random;
const rr = (a, b) => a + (b - a) * R();
const pick = (s) => s[Math.floor(R() * s.length)];

export class Particles {
  constructor(term) {
    this.term = term;
    this.list = [];
    this.max = 1800;
    this.mult = 1; // ajuste de densidad
    term.drawParticles = (ctx) => this.draw(ctx);
  }

  clear() {
    this.list.length = 0;
  }

  add(p) {
    if (this.list.length >= this.max) return null;
    p.age = 0;
    p.vx ??= 0;
    p.vy ??= 0;
    p.ax ??= 0;
    p.ay ??= 0;
    p.drag ??= 0;
    p.life ??= 1;
    p.alpha ??= 1;
    p.c0 ??= C.o5;
    p.c1 ??= p.c0;
    p.g ??= '*';
    p.scale ??= 1;
    this.list.push(p);
    return p;
  }

  n(base) {
    const v = base * this.mult;
    return Math.floor(v) + (R() < v % 1 ? 1 : 0);
  }

  update(dt) {
    const L = this.list;
    let j = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      if (p.drag) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      if (p.wobble) p.x += Math.sin(p.age * p.wobble + (p.seed || 0)) * dt * 0.6;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.floor != null && p.y > p.floor) {
        p.y = p.floor;
        p.vy *= -0.3;
        p.vx *= 0.6;
      }
      L[j++] = p;
    }
    L.length = j;
  }

  draw(ctx) {
    const t = this.term;
    const cw = t.cw;
    const ch = t.ch;
    const base = t.fpx;
    let curScale = 1;
    for (const p of this.list) {
      const k = p.age / p.life;
      let a = p.alpha;
      if (p.fadeIn && p.age < p.fadeIn) a *= p.age / p.fadeIn;
      a *= p.fade === false ? 1 : 1 - k * k;
      if (a <= 0.01) continue;
      const glyph = p.seq ? p.seq[Math.min(p.seq.length - 1, Math.floor(k * p.seq.length))] : p.g;
      const col = p.c0 === p.c1 ? p.c0 : mix(p.c0, p.c1, k);
      if (p.scale !== curScale) {
        ctx.font = `${Math.round(base * p.scale)}px TopoMono, monospace`;
        curScale = p.scale;
      }
      ctx.globalAlpha = a * (t.particleAlpha ?? 1);
      ctx.fillStyle = col;
      ctx.fillText(glyph, t.ox + p.x * cw, t.oy + p.y * ch);
    }
    if (curScale !== 1) ctx.font = `${base}px TopoMono, monospace`;
    ctx.globalAlpha = 1;
  }

  // --- Preajustes -------------------------------------------------------
  sparks(x, y, n = 8, opts = {}) {
    for (let i = 0, N = this.n(n); i < N; i++) {
      const a = rr(0, Math.PI * 2);
      const s = rr(4, 14) * (opts.speed || 1);
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 2, ay: 18, drag: 2,
        life: rr(0.25, 0.7), g: pick("*'.`,"), c0: opts.c0 || C.gold, c1: opts.c1 || C.red2,
      });
    }
  }

  smoke(x, y, n = 3, opts = {}) {
    for (let i = 0, N = this.n(n); i < N; i++) {
      this.add({
        x: x + rr(-0.5, 0.5), y, vx: rr(-0.6, 0.6) + (opts.wind || 0), vy: rr(-1.6, -0.6), drag: 0.4,
        life: rr(1.2, 2.6), seq: ['∙', '°', 'o', 'O', '░'], c0: opts.c0 || C.grey, c1: opts.c1 || C.greyD,
        alpha: opts.alpha ?? 0.7, fadeIn: 0.2,
      });
    }
  }

  embers(x, y, n = 2, opts = {}) {
    for (let i = 0, N = this.n(n); i < N; i++) {
      this.add({
        x: x + rr(-0.5, 0.5), y, vx: rr(-0.8, 0.8), vy: rr(-3, -1), drag: 0.5, wobble: 5, seed: R() * 6,
        life: rr(0.6, 1.6), g: pick("'.`*,"), c0: opts.c0 || C.gold, c1: opts.c1 || C.red2,
      });
    }
  }

  flame(x, y, n = 2) {
    for (let i = 0, N = this.n(n); i < N; i++) {
      this.add({
        x: x + rr(-0.4, 0.4), y: y + rr(-0.2, 0.2), vx: rr(-0.4, 0.4), vy: rr(-2.2, -0.8),
        life: rr(0.3, 0.7), seq: ['▲', '^', '*', "'", '.'], c0: C.gold, c1: C.red2,
      });
    }
  }

  snow(x, y, n = 1, opts = {}) {
    for (let i = 0, N = this.n(n); i < N; i++) {
      this.add({
        x, y, vx: opts.vx ?? rr(-2, -0.5), vy: opts.vy ?? rr(0.5, 2), wobble: 2, seed: R() * 6,
        life: opts.life ?? rr(2, 5), g: pick(opts.glyphs || '*.·∙'), c0: opts.c0 || C.ice, c1: opts.c1 || C.iceD,
        alpha: opts.alpha ?? 0.8, fadeIn: 0.3,
      });
    }
  }

  explosion(x, y, power = 1) {
    this.sparks(x, y, 14 * power, { speed: 1.2 * power });
    for (let i = 0, N = this.n(10 * power); i < N; i++) {
      const a = rr(0, Math.PI * 2);
      const s = rr(1, 6) * power;
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.55, drag: 3,
        life: rr(0.4, 1.1), seq: ['█', '▓', '▒', '░', '·'], c0: C.o7, c1: C.red2,
      });
    }
    this.smoke(x, y, 6 * power);
    for (let i = 0, N = this.n(6 * power); i < N; i++) {
      const a = rr(0, Math.PI * 2);
      this.add({
        x, y, vx: Math.cos(a) * rr(6, 12), vy: Math.sin(a) * rr(3, 8) - 4, ay: 20, drag: 1,
        life: rr(0.6, 1.2), g: pick('#%&@$/\\'), c0: C.o6, c1: C.o2,
      });
    }
  }

  tracer(x0, y0, x1, y1, opts = {}) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.hypot(dx, dy) || 1;
    const sp = opts.speed || 60;
    const g = Math.abs(dx) > Math.abs(dy) * 2 ? '-' : Math.abs(dy) > Math.abs(dx) * 2 ? '|' : dx * dy > 0 ? '\\' : '/';
    this.add({
      x: x0, y: y0, vx: (dx / d) * sp, vy: (dy / d) * sp * 0.5, life: d / sp * 1.4,
      g: opts.g || g, c0: opts.c0 || C.gold, c1: opts.c1 || C.o5, fade: false,
    });
  }

  rad(x, y, n = 1) {
    for (let i = 0, N = this.n(n); i < N; i++) {
      this.add({
        x: x + rr(-0.5, 0.5), y: y + rr(-0.5, 0.5), vx: rr(-0.5, 0.5), vy: rr(-0.8, 0.2),
        life: rr(0.5, 1.4), g: pick('+·*×'), c0: C.rad, c1: C.radD, fadeIn: 0.15,
      });
    }
  }

  zzz(x, y) {
    this.add({ x, y, vx: rr(0.2, 0.6), vy: -0.9, wobble: 3, life: 2, seq: ['z', 'z', 'Z'], c0: C.o6, c1: C.o1, alpha: 0.85, fadeIn: 0.3 });
  }

  steam(x, y, n = 2) {
    for (let i = 0, N = this.n(n); i < N; i++) {
      this.add({ x: x + rr(-0.3, 0.3), y, vx: rr(-0.4, 0.4), vy: rr(-1.5, -0.6), life: rr(0.8, 1.6), seq: ['·', '∘', '°', '·'], c0: C.white, c1: C.grey2, alpha: 0.6 });
    }
  }

  // Texto flotante (daño, recursos...)
  text(x, y, str, color = C.o6, opts = {}) {
    const s = String(str);
    const vx = opts.vx ?? 0;
    for (let i = 0; i < s.length; i++) {
      this.add({
        x: x + i - s.length / 2 + 0.5, y, vx, vy: opts.vy ?? -1.6, drag: 0.8,
        life: opts.life ?? 1.6, g: s[i], c0: color, c1: opts.c1 || color, fadeIn: 0.05,
      });
    }
  }

  // Estallido de glifos en anillo (selección, éxito)
  ring(x, y, n = 12, color = C.o5, speed = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.add({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.5, drag: 3, life: 0.6, g: '·', c0: color, c1: C.o1 });
    }
  }
}
