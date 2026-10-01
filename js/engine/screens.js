// Gestor de pantallas con transición de disolución ASCII.

import { C } from '../palette.js';

const EDGE = '░▒▓█▚▞#%';

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class ScreenManager {
  constructor(app) {
    this.app = app;
    this.registry = {};
    this.cur = null;
    this.name = null;
    this.trans = null;
  }

  register(name, cls) {
    this.registry[name] = cls;
  }

  go(name, opts = {}) {
    const Cls = this.registry[name];
    if (!Cls) throw new Error('Pantalla desconocida: ' + name);
    if (this.cur && this.cur.exit) this.cur.exit();
    this.cur = new Cls(this.app, opts);
    this.name = name;
    if (this.cur.enter) this.cur.enter(opts);
    this.trans = opts.instant ? null : { t: 0, dur: opts.dur || 0.5 };
    this.app.ui.focus = null;
    if (!opts.keepParticles) this.app.particles.clear();
  }

  update(dt) {
    if (this.trans) {
      this.trans.t += dt;
      if (this.trans.t >= this.trans.dur) this.trans = null;
    }
    if (this.cur && this.cur.update) this.cur.update(dt);
  }

  render() {
    if (this.cur) this.cur.render();
    if (this.trans) this.applyTransition();
  }

  applyTransition() {
    const t = this.app.term;
    const p = this.trans.t / this.trans.dur;
    const cols = t.cols;
    const rows = t.rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = 0.55 * hash(x, y) + 0.45 * (x / cols);
        const k = p * 1.15;
        const i = y * cols + x;
        if (k < v) {
          t.chB[i] = ' ';
          t.bgB[i] = '#000000';
        } else if (k < v + 0.07) {
          t.chB[i] = EDGE[(x * 7 + y * 3 + Math.floor(p * 30)) % EDGE.length];
          t.fgB[i] = k < v + 0.035 ? C.o6 : C.o3;
          t.bgB[i] = '#000000';
        }
      }
    }
  }
}
