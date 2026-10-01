// Efectos de pantalla: sacudida, destellos, easing.

import { clamp } from './util.js';

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

export class FX {
  constructor(stage, term) {
    this.stage = stage;
    this.term = term;
    this.shakeAmt = 0;
    this.shakeT = 0;
    this.flashes = [];
    this.enabledShake = true;
    term.drawOverlay = (ctx) => this.drawOverlay(ctx);
  }

  shake(amount = 4, dur = 0.3) {
    if (!this.enabledShake) return;
    this.shakeAmt = Math.max(this.shakeAmt, amount);
    this.shakeT = Math.max(this.shakeT, dur);
    this.shakeDur = Math.max(this.shakeDur || 0, dur);
  }

  flash(color = '#ff9a2e', dur = 0.25, alpha = 0.25) {
    this.flashes.push({ color, dur, t: 0, alpha });
  }

  update(dt) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = clamp(this.shakeT / (this.shakeDur || 0.3), 0, 1);
      const a = this.shakeAmt * k;
      const x = (Math.random() * 2 - 1) * a;
      const y = (Math.random() * 2 - 1) * a;
      this.stage.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (this.shakeT <= 0) {
        this.stage.style.transform = '';
        this.shakeAmt = 0;
        this.shakeDur = 0;
      }
    }
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.dur);
  }

  drawOverlay(ctx) {
    for (const f of this.flashes) {
      ctx.globalAlpha = f.alpha * (1 - f.t / f.dur);
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    ctx.globalAlpha = 1;
  }
}
