// Terminal ASCII sobre canvas: rejilla a pantalla completa con doble buffer,
// render solo de celdas modificadas, glifos de caja/bloques dibujados a mano,
// capa FX (entidades suaves, partículas, interfaz superior) y bloom opcional.

import { clamp } from './util.js';

const FONT_FAMILY = 'TopoMono, "DejaVu Sans Mono", Menlo, Consolas, monospace';

// Brazos [arriba, abajo, izquierda, derecha]: 1 sencillo, 2 doble, 3 grueso
const BOX = {
  '─': [0, 0, 1, 1], '│': [1, 1, 0, 0], '┌': [0, 1, 0, 1], '┐': [0, 1, 1, 0],
  '└': [1, 0, 0, 1], '┘': [1, 0, 1, 0], '├': [1, 1, 0, 1], '┤': [1, 1, 1, 0],
  '┬': [0, 1, 1, 1], '┴': [1, 0, 1, 1], '┼': [1, 1, 1, 1], '╴': [0, 0, 1, 0],
  '╶': [0, 0, 0, 1], '╵': [1, 0, 0, 0], '╷': [0, 1, 0, 0], '╭': [0, 1, 0, 1],
  '╮': [0, 1, 1, 0], '╰': [1, 0, 0, 1], '╯': [1, 0, 1, 0],
  '━': [0, 0, 3, 3], '┃': [3, 3, 0, 0], '┏': [0, 3, 0, 3], '┓': [0, 3, 3, 0],
  '┗': [3, 0, 0, 3], '┛': [3, 0, 3, 0], '┣': [3, 3, 0, 3], '┫': [3, 3, 3, 0],
  '┳': [0, 3, 3, 3], '┻': [3, 0, 3, 3], '╋': [3, 3, 3, 3],
  '═': [0, 0, 2, 2], '║': [2, 2, 0, 0], '╔': [0, 2, 0, 2], '╗': [0, 2, 2, 0],
  '╚': [2, 0, 0, 2], '╝': [2, 0, 2, 0], '╠': [2, 2, 0, 2], '╣': [2, 2, 2, 0],
  '╦': [0, 2, 2, 2], '╩': [2, 0, 2, 2], '╬': [2, 2, 2, 2],
  '╤': [0, 1, 2, 2], '╧': [1, 0, 2, 2], '╟': [2, 2, 0, 1], '╢': [2, 2, 1, 0],
  '╫': [2, 2, 1, 1], '╪': [1, 1, 2, 2], '╞': [1, 1, 0, 2], '╡': [1, 1, 2, 0],
  '╥': [0, 2, 1, 1], '╨': [2, 0, 1, 1], '╒': [0, 1, 0, 2], '╓': [0, 2, 0, 1],
  '╕': [0, 1, 2, 0], '╖': [0, 2, 1, 0], '╘': [1, 0, 0, 2], '╙': [2, 0, 0, 1],
  '╛': [1, 0, 2, 0], '╜': [2, 0, 1, 0],
  '╸': [0, 0, 3, 0], '╺': [0, 0, 0, 3], '╹': [3, 0, 0, 0], '╻': [0, 3, 0, 0],
};

// Bloques: [x0,y0,x1,y1] en octavos de celda (uno o varios rectángulos)
const BLOCKS = {
  '█': [[0, 0, 8, 8]], '▀': [[0, 0, 8, 4]], '▄': [[0, 4, 8, 8]], '▌': [[0, 0, 4, 8]],
  '▐': [[4, 0, 8, 8]], '▁': [[0, 7, 8, 8]], '▂': [[0, 6, 8, 8]], '▃': [[0, 5, 8, 8]],
  '▅': [[0, 3, 8, 8]], '▆': [[0, 2, 8, 8]], '▇': [[0, 1, 8, 8]], '▏': [[0, 0, 1, 8]],
  '▎': [[0, 0, 2, 8]], '▍': [[0, 0, 3, 8]], '▋': [[0, 0, 5, 8]], '▊': [[0, 0, 6, 8]],
  '▉': [[0, 0, 7, 8]], '▔': [[0, 0, 8, 1]], '▕': [[7, 0, 8, 8]],
  '▖': [[0, 4, 4, 8]], '▗': [[4, 4, 8, 8]], '▘': [[0, 0, 4, 4]], '▝': [[4, 0, 8, 4]],
  '▙': [[0, 0, 4, 8], [4, 4, 8, 8]], '▛': [[0, 0, 8, 4], [0, 4, 4, 8]],
  '▜': [[0, 0, 8, 4], [4, 4, 8, 8]], '▟': [[4, 0, 8, 8], [0, 4, 4, 8]],
  '▚': [[0, 0, 4, 4], [4, 4, 8, 8]], '▞': [[4, 0, 8, 4], [0, 4, 4, 8]],
};
const SHADES = { '░': 1, '▒': 2, '▓': 3 };

export class Term {
  constructor(base, fx, glow) {
    this.base = base;
    this.fx = fx;
    this.glow = glow;
    this.bctx = base.getContext('2d', { alpha: false });
    this.fctx = fx.getContext('2d');
    this.gctx = glow ? glow.getContext('2d') : null;
    this.fontPx = 15;
    this.fontSetting = 'auto';
    this.cols = 0;
    this.rows = 0;
    this.layer = 'base'; // 'base' | 'top'
    this.top = []; // celdas de la capa superior (se dibujan sobre FX)
    this.ents = []; // glifos de entidades con posición fraccional (bajo partículas)
    this.clipStack = [];
    this.clip = null;
    this.patterns = new Map();
    this.defaultBg = '#000000';
    this.glowOn = true;
    this.glowTimer = 0;
    this.resize();
  }

  setFontSetting(v) {
    this.fontSetting = v;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    const W = window.innerWidth;
    const H = window.innerHeight;
    let px;
    if (this.fontSetting === 'auto') {
      // Buscar una letra que deje al menos ~168x52 celdas, entre 10 y 18 px
      px = Math.floor(Math.min(W / (0.602 * 168), H / (1.18 * 52)));
      px = clamp(px, 9, 18);
    } else {
      px = Number(this.fontSetting) || 15;
    }
    this.fontPx = px;
    const fpx = Math.round(px * dpr);
    this.fpx = fpx;
    const ctx = this.bctx;
    ctx.font = `${fpx}px ${FONT_FAMILY}`;
    const mw = ctx.measureText('M').width;
    this.cw = Math.max(4, Math.round(mw));
    this.ch = Math.max(8, Math.round(fpx * 1.18));
    for (const c of [this.base, this.fx]) {
      c.width = Math.floor(W * dpr);
      c.height = Math.floor(H * dpr);
      c.style.width = W + 'px';
      c.style.height = H + 'px';
    }
    if (this.glow) {
      this.glow.width = Math.max(1, Math.floor((W * dpr) / 3));
      this.glow.height = Math.max(1, Math.floor((H * dpr) / 3));
      this.glow.style.width = W + 'px';
      this.glow.style.height = H + 'px';
    }
    this.cols = Math.floor(this.base.width / this.cw);
    this.rows = Math.floor(this.base.height / this.ch);
    this.ox = Math.floor((this.base.width - this.cols * this.cw) / 2);
    this.oy = Math.floor((this.base.height - this.rows * this.ch) / 2);
    const n = this.cols * this.rows;
    this.chB = new Array(n).fill(' ');
    this.fgB = new Array(n).fill('#ffffff');
    this.bgB = new Array(n).fill(this.defaultBg);
    this.atB = new Uint8Array(n);
    this.chF = new Array(n).fill(null);
    this.fgF = new Array(n).fill(null);
    this.bgF = new Array(n).fill(null);
    this.atF = new Uint8Array(n);
    this.patterns.clear();
    this.fullRedraw = true;
    this.lw = Math.max(1, Math.round(this.cw * 0.13));
    this.gap = Math.max(this.lw + 1, Math.round(this.cw * 0.22));
    this.onResize && this.onResize();
  }

  // --- Recorte ----------------------------------------------------------
  pushClip(x, y, w, h) {
    let c = { x0: x, y0: y, x1: x + w, y1: y + h };
    if (this.clip) {
      c = {
        x0: Math.max(c.x0, this.clip.x0),
        y0: Math.max(c.y0, this.clip.y0),
        x1: Math.min(c.x1, this.clip.x1),
        y1: Math.min(c.y1, this.clip.y1),
      };
    }
    this.clipStack.push(this.clip);
    this.clip = c;
  }
  popClip() {
    this.clip = this.clipStack.pop() || null;
  }

  // --- Escritura en buffer ----------------------------------------------
  clear(bg = this.defaultBg) {
    this.chB.fill(' ');
    this.bgB.fill(bg);
    this.fgB.fill('#ffffff');
    this.atB.fill(0);
    this.top.length = 0;
    this.ents.length = 0;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  put(x, y, ch, fg, bg, attr = 0) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const c = this.clip;
    if (c && (x < c.x0 || y < c.y0 || x >= c.x1 || y >= c.y1)) return;
    if (this.layer === 'top') {
      this.top.push(x, y, ch, fg, bg, attr);
      return;
    }
    const i = y * this.cols + x;
    if (ch != null) this.chB[i] = ch;
    if (fg != null) this.fgB[i] = fg;
    if (bg != null) this.bgB[i] = bg;
    this.atB[i] = attr;
  }

  setBg(x, y, bg) {
    x |= 0;
    y |= 0;
    if (!this.inBounds(x, y)) return;
    const c = this.clip;
    if (c && (x < c.x0 || y < c.y0 || x >= c.x1 || y >= c.y1)) return;
    if (this.layer === 'top') {
      this.top.push(x, y, null, null, bg, 0);
      return;
    }
    this.bgB[y * this.cols + x] = bg;
  }
  setFg(x, y, fg) {
    x |= 0;
    y |= 0;
    if (!this.inBounds(x, y) || this.layer === 'top') return;
    const c = this.clip;
    if (c && (x < c.x0 || y < c.y0 || x >= c.x1 || y >= c.y1)) return;
    this.fgB[y * this.cols + x] = fg;
  }

  get(x, y) {
    if (!this.inBounds(x, y)) return null;
    const i = y * this.cols + x;
    return { ch: this.chB[i], fg: this.fgB[i], bg: this.bgB[i] };
  }

  text(x, y, str, fg, bg, attr = 0) {
    str = String(str);
    for (let i = 0; i < str.length; i++) this.put(x + i, y, str[i], fg, bg, attr);
    return str.length;
  }

  fill(x, y, w, h, ch, fg, bg) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, ch, fg, bg);
  }

  fillBg(x, y, w, h, bg) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.setBg(x + i, y + j, bg);
  }

  box(x, y, w, h, fg, bg, style = 'single') {
    if (w < 2 || h < 2) return;
    const s =
      style === 'double'
        ? ['╔', '╗', '╚', '╝', '═', '║']
        : style === 'heavy'
          ? ['┏', '┓', '┗', '┛', '━', '┃']
          : style === 'round'
            ? ['╭', '╮', '╰', '╯', '─', '│']
            : ['┌', '┐', '└', '┘', '─', '│'];
    for (let i = 1; i < w - 1; i++) {
      this.put(x + i, y, s[4], fg, bg);
      this.put(x + i, y + h - 1, s[4], fg, bg);
    }
    for (let j = 1; j < h - 1; j++) {
      this.put(x, y + j, s[5], fg, bg);
      this.put(x + w - 1, y + j, s[5], fg, bg);
    }
    this.put(x, y, s[0], fg, bg);
    this.put(x + w - 1, y, s[1], fg, bg);
    this.put(x, y + h - 1, s[2], fg, bg);
    this.put(x + w - 1, y + h - 1, s[3], fg, bg);
  }

  // Glifo de entidad en posición fraccional (celdas), dibujado en la capa FX
  ent(xf, yf, ch, fg, bg = null, alpha = 1, scale = 1) {
    this.ents.push(xf, yf, ch, fg, bg, alpha, scale);
  }

  // --- Volcado a canvas ------------------------------------------------
  flush() {
    const ctx = this.bctx;
    const n = this.cols * this.rows;
    const full = this.fullRedraw;
    if (full) {
      ctx.fillStyle = this.defaultBg;
      ctx.fillRect(0, 0, this.base.width, this.base.height);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let curFont = -1;
    for (let i = 0; i < n; i++) {
      const ch = this.chB[i];
      const fg = this.fgB[i];
      const bg = this.bgB[i];
      const at = this.atB[i];
      if (!full && ch === this.chF[i] && bg === this.bgF[i] && (fg === this.fgF[i] || ch === ' ') && at === this.atF[i]) continue;
      this.chF[i] = ch;
      this.fgF[i] = fg;
      this.bgF[i] = bg;
      this.atF[i] = at;
      const x = this.ox + (i % this.cols) * this.cw;
      const y = this.oy + Math.floor(i / this.cols) * this.ch;
      const bold = at & 1 ? 1 : 0;
      if (bold !== curFont) {
        ctx.font = `${bold ? 'bold ' : ''}${this.fpx}px ${FONT_FAMILY}`;
        curFont = bold;
      }
      this.drawCell(ctx, x, y, ch, fg, bg);
    }
    this.fullRedraw = false;
    this.drawFx();
  }

  drawCell(ctx, x, y, ch, fg, bg) {
    const cw = this.cw;
    const chh = this.ch;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, cw, chh);
    if (ch === ' ' || ch == null) return;
    ctx.fillStyle = fg;
    const box = BOX[ch];
    if (box) return this.drawBox(ctx, x, y, box);
    const blk = BLOCKS[ch];
    if (blk) {
      for (const r of blk) {
        const x0 = x + Math.round((r[0] * cw) / 8);
        const y0 = y + Math.round((r[1] * chh) / 8);
        const x1 = x + Math.round((r[2] * cw) / 8);
        const y1 = y + Math.round((r[3] * chh) / 8);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      return;
    }
    const sh = SHADES[ch];
    if (sh) {
      ctx.fillStyle = this.shadePattern(sh, fg);
      ctx.fillRect(x, y, cw, chh);
      return;
    }
    const code = ch.charCodeAt(0);
    if (code > 0x7f) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cw, chh);
      ctx.clip();
      ctx.fillText(ch, x + cw / 2, y + chh / 2 + 1);
      ctx.restore();
    } else {
      ctx.fillText(ch, x + cw / 2, y + chh / 2 + 1);
    }
  }

  shadePattern(level, color) {
    const key = level + color;
    let p = this.patterns.get(key);
    if (p) return p;
    const s = Math.max(1, Math.round(this.dpr));
    const c = document.createElement('canvas');
    c.width = 4 * s;
    c.height = 4 * s;
    const g = c.getContext('2d');
    g.fillStyle = color;
    const dots =
      level === 1
        ? [[0, 0], [2, 1], [0, 2], [2, 3]]
        : level === 2
          ? [[0, 0], [2, 0], [1, 1], [3, 1], [0, 2], [2, 2], [1, 3], [3, 3]]
          : [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [2, 2], [3, 2], [0, 3], [1, 3], [3, 3]];
    for (const [dx, dy] of dots) g.fillRect(dx * s, dy * s, s, s);
    p = this.bctx.createPattern(c, 'repeat');
    this.patterns.set(key, p);
    return p;
  }

  drawBox(ctx, x, y, arms) {
    const cw = this.cw;
    const chh = this.ch;
    const lw = this.lw;
    const cx = x + Math.floor(cw / 2);
    const cy = y + Math.floor(chh / 2);
    const h = Math.floor(lw / 2);
    const [u, d, l, r] = arms;
    const hasDouble = u === 2 || d === 2 || l === 2 || r === 2;
    if (!hasDouble) {
      const t = lw * (u === 3 || d === 3 || l === 3 || r === 3 ? 2 : 1);
      const ht = Math.floor(t / 2);
      if (u) ctx.fillRect(cx - ht, y, t, cy - y + t - ht);
      if (d) ctx.fillRect(cx - ht, cy - ht, t, y + chh - cy + ht);
      if (l) ctx.fillRect(x, cy - ht, cx - x + t - ht, t);
      if (r) ctx.fillRect(cx - ht, cy - ht, x + cw - cx + ht, t);
      return;
    }
    const g = this.gap;
    // Cuadrado central [cx-g, cx+g] x [cy-g, cy+g]
    const L = cx - g;
    const R = cx + g;
    const T = cy - g;
    const B = cy + g;
    // Brazos dobles: dos líneas paralelas desde el cuadrado hasta el borde
    if (u === 2) {
      ctx.fillRect(L - h, y, lw, T - y + lw - h);
      ctx.fillRect(R - h, y, lw, T - y + lw - h);
    }
    if (d === 2) {
      ctx.fillRect(L - h, B - h, lw, y + chh - B + h);
      ctx.fillRect(R - h, B - h, lw, y + chh - B + h);
    }
    if (l === 2) {
      ctx.fillRect(x, T - h, L - x + lw - h, lw);
      ctx.fillRect(x, B - h, L - x + lw - h, lw);
    }
    if (r === 2) {
      ctx.fillRect(R - h, T - h, x + cw - R + h, lw);
      ctx.fillRect(R - h, B - h, x + cw - R + h, lw);
    }
    // Lados del cuadrado donde no hay brazo doble
    if (u !== 2) ctx.fillRect(L - h, T - h, R - L + lw, lw);
    if (d !== 2) ctx.fillRect(L - h, B - h, R - L + lw, lw);
    if (l !== 2) ctx.fillRect(L - h, T - h, lw, B - T + lw);
    if (r !== 2) ctx.fillRect(R - h, T - h, lw, B - T + lw);
    // Brazos sencillos en caracteres mixtos: desde el lado del cuadrado
    if (u === 1) ctx.fillRect(cx - h, y, lw, T - y);
    if (d === 1) ctx.fillRect(cx - h, B, lw, y + chh - B);
    if (l === 1) ctx.fillRect(x, cy - h, L - x, lw);
    if (r === 1) ctx.fillRect(R, cy - h, x + cw - R, lw);
  }

  // Capa FX: entidades, partículas (callback), capa superior de UI
  drawFx() {
    const ctx = this.fctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.fx.width, this.fx.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${this.fpx}px ${FONT_FAMILY}`;
    const cw = this.cw;
    const chh = this.ch;
    // Entidades
    const E = this.ents;
    for (let i = 0; i < E.length; i += 7) {
      const px = this.ox + E[i] * cw;
      const py = this.oy + E[i + 1] * chh;
      const alpha = E[i + 5];
      const scale = E[i + 6];
      ctx.globalAlpha = alpha;
      if (E[i + 4]) {
        ctx.fillStyle = E[i + 4];
        ctx.fillRect(Math.round(px), Math.round(py), cw, chh);
      }
      if (scale !== 1) ctx.font = `${Math.round(this.fpx * scale)}px ${FONT_FAMILY}`;
      ctx.fillStyle = E[i + 3];
      ctx.fillText(E[i + 2], px + cw / 2, py + chh / 2 + 1);
      if (scale !== 1) ctx.font = `${this.fpx}px ${FONT_FAMILY}`;
    }
    ctx.globalAlpha = 1;
    // Partículas
    if (this.drawParticles) this.drawParticles(ctx);
    // Capa superior (tooltips, fantasma de arrastre...)
    const T = this.top;
    let curBold = 0;
    for (let i = 0; i < T.length; i += 6) {
      const x = this.ox + T[i] * cw;
      const y = this.oy + T[i + 1] * chh;
      const ch = T[i + 2];
      const fg = T[i + 3];
      const bg = T[i + 4];
      const bold = T[i + 5] & 1;
      if (bold !== curBold) {
        ctx.font = `${bold ? 'bold ' : ''}${this.fpx}px ${FONT_FAMILY}`;
        curBold = bold;
      }
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(x, y, cw, chh);
      }
      if (ch && ch !== ' ') {
        ctx.fillStyle = fg || '#fff';
        const box = BOX[ch];
        const blk = BLOCKS[ch];
        if (box) this.drawBox(ctx, x, y, box);
        else if (blk) {
          for (const r of blk) {
            const x0 = x + Math.round((r[0] * cw) / 8);
            const y0 = y + Math.round((r[1] * chh) / 8);
            ctx.fillRect(x0, y0, x + Math.round((r[2] * cw) / 8) - x0, y + Math.round((r[3] * chh) / 8) - y0);
          }
        } else ctx.fillText(ch, x + cw / 2, y + chh / 2 + 1);
      }
    }
    if (this.drawOverlay) this.drawOverlay(ctx);
    // Bloom: copia reducida de ambas capas (se difumina por CSS)
    if (this.gctx && this.glowOn) {
      if (++this.glowTimer % 2 === 0) {
        const g = this.gctx;
        g.globalCompositeOperation = 'copy';
        g.drawImage(this.base, 0, 0, this.glow.width, this.glow.height);
        g.globalCompositeOperation = 'source-over';
        g.drawImage(this.fx, 0, 0, this.glow.width, this.glow.height);
      }
    }
  }

  // Conversión de píxeles CSS a celdas (fraccionarias)
  pxToCell(px, py) {
    const dx = (px * this.dpr - this.ox) / this.cw;
    const dy = (py * this.dpr - this.oy) / this.ch;
    return [dx, dy];
  }
}
