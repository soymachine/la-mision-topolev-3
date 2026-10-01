// Interfaz inmediata sobre la terminal ASCII.
// Las regiones se registran cada frame; al final se resuelve cuál está bajo el ratón.
// Clics, arrastres y soltados se entregan al frame siguiente (latencia de 1 frame).

import { C, MARK } from '../palette.js';
import { clamp, mix } from './util.js';

const PARTIAL_H = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];

// --- Marcado de color: "{o}naranja{/} normal {r}rojo{/}" ---------------------
const layoutCache = new Map();
export function parseMarkup(str, defFg) {
  const out = [];
  let fg = defFg;
  const stack = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '{') {
      const j = str.indexOf('}', i);
      if (j > i) {
        const code = str.slice(i + 1, j);
        if (code === '/') {
          fg = stack.length ? stack.pop() : defFg;
          i = j;
          continue;
        }
        if (MARK[code]) {
          stack.push(fg);
          fg = MARK[code];
          i = j;
          continue;
        }
        if (code[0] === '#') {
          stack.push(fg);
          fg = code;
          i = j;
          continue;
        }
      }
    }
    out.push([c, fg]);
  }
  return out;
}
export function stripMarkup(str) {
  return String(str).replace(/\{(\/|[a-zA-Z]|#[0-9a-fA-F]{3,6})\}/g, '');
}

// Devuelve líneas: arrays de [char, color]
export function layoutMarkup(str, width, defFg) {
  const key = width + '|' + defFg + '|' + str;
  let res = layoutCache.get(key);
  if (res) return res;
  res = [];
  const paras = String(str).split('\n');
  for (const para of paras) {
    const cells = parseMarkup(para, defFg);
    if (!cells.length) {
      res.push([]);
      continue;
    }
    // separar en palabras manteniendo color
    const words = [];
    let cur = [];
    for (const cell of cells) {
      if (cell[0] === ' ') {
        if (cur.length) words.push(cur);
        cur = [];
      } else cur.push(cell);
    }
    if (cur.length) words.push(cur);
    let line = [];
    for (let w of words) {
      if (line.length && line.length + 1 + w.length > width) {
        res.push(line);
        line = [];
      }
      if (line.length) line.push([' ', defFg]);
      while (w.length > width) {
        res.push(w.slice(0, width));
        w = w.slice(width);
      }
      line = line.concat(w);
    }
    res.push(line);
  }
  if (layoutCache.size > 400) layoutCache.clear();
  layoutCache.set(key, res);
  return res;
}

export class UI {
  constructor(term, input, audio) {
    this.term = term;
    this.input = input;
    this.audio = audio;
    this.t = 0;
    this.dt = 0;
    this.regions = [];
    this.hot = null;
    this.hotRegion = null;
    this.hoverStart = 0;
    this.pressedId = null;
    this.clickEv = null;
    this.rclickEv = null;
    this.dblEv = null;
    this.pendingClick = null;
    this.pendingR = null;
    this.pendingDbl = null;
    this.anim = new Map();
    this.animFrame = new Map();
    this.smoothVals = new Map();
    this.drag = null;
    this.dragSources = new Map();
    this.dropTargets = [];
    this.pendingDrop = null;
    this.dropEv = null;
    this.tooltip = null;
    this.layer = 0;
    this.topLayer = 0;
    this.prevTopLayer = 0;
    this.scrolls = new Map();
    this.scrollStack = [];
    this.focus = null;
    this.frame = 0;
    this.cursor = 'default';
    this.hoverSound = true;
  }

  get m() {
    return this.input.m;
  }

  begin(dt, t) {
    this.dt = dt;
    this.t = t;
    this.frame++;
    this.regions.length = 0;
    this.dragSources.clear();
    this.dropTargets.length = 0;
    this.tooltip = null;
    this.layer = 0;
    this.topLayer = 0;
    this.clickEv = this.pendingClick;
    this.rclickEv = this.pendingR;
    this.dblEv = this.pendingDbl;
    this.dropEv = this.pendingDrop;
    this.pendingClick = this.pendingR = this.pendingDbl = this.pendingDrop = null;
  }

  // Registra una región interactiva. Devuelve estado.
  region(id, x, y, w, h, opts = {}) {
    let x0 = x;
    let y0 = y;
    let x1 = x + w;
    let y1 = y + h;
    const c = this.term.clip;
    if (c) {
      x0 = Math.max(x0, c.x0);
      y0 = Math.max(y0, c.y0);
      x1 = Math.min(x1, c.x1);
      y1 = Math.min(y1, c.y1);
    }
    if (x1 > x0 && y1 > y0) {
      this.regions.push({ id, x0, y0, x1, y1, layer: this.layer, cursor: opts.cursor || (opts.passive ? null : 'pointer'), sound: opts.sound !== false && !opts.passive, passive: !!opts.passive });
    }
    if (this.layer > this.topLayer) this.topLayer = this.layer;
    return this.state(id);
  }

  state(id) {
    return {
      hot: this.hot === id,
      clicked: this.clickEv === id,
      rclicked: this.rclickEv === id,
      dbl: this.dblEv === id,
      down: this.pressedId === id && this.m.down,
    };
  }

  isHot(id) {
    return this.hot === id;
  }
  hoverTime(id) {
    return this.hot === id ? this.t - this.hoverStart : 0;
  }

  // Animación 0..1 de hover para un id (suavizado exponencial)
  hoverT(id, speed = 12) {
    let v = this.anim.get(id) || 0;
    if (this.animFrame.get(id) !== this.frame) {
      const target = this.hot === id ? 1 : 0;
      v += (target - v) * Math.min(1, this.dt * speed);
      if (Math.abs(target - v) < 0.01) v = target;
      this.anim.set(id, v);
      this.animFrame.set(id, this.frame);
    }
    return v;
  }

  // Valor suavizado (para barras animadas)
  smooth(id, value, speed = 6) {
    let v = this.smoothVals.get(id);
    if (v === undefined || !isFinite(v)) v = value;
    v += (value - v) * Math.min(1, this.dt * speed);
    if (Math.abs(value - v) < 0.001) v = value;
    this.smoothVals.set(id, v);
    return v;
  }

  // --- Dibujo básico ------------------------------------------------------
  text(x, y, str, fg = C.o4, bg, attr) {
    return this.term.text(x, y, str, fg, bg, attr);
  }

  // Una línea con marcado; devuelve longitud visible
  mtext(x, y, str, fg = C.o4, bg, maxW = 9999, attr = 0) {
    const cells = parseMarkup(String(str), fg);
    const n = Math.min(cells.length, maxW);
    for (let i = 0; i < n; i++) this.term.put(x + i, y, cells[i][0], cells[i][1], bg, attr);
    return n;
  }

  // Texto con marcado ajustado a un ancho. reveal: nº de caracteres visibles (efecto máquina)
  mwrap(x, y, w, str, fg = C.o4, opts = {}) {
    const lines = layoutMarkup(String(str), w, fg);
    const maxLines = opts.maxLines ?? 9999;
    let reveal = opts.reveal ?? Infinity;
    const skip = opts.skip || 0;
    let drawn = 0;
    for (let j = skip; j < lines.length && drawn < maxLines; j++) {
      const ln = lines[j];
      for (let i = 0; i < ln.length; i++) {
        if (reveal-- <= 0) return lines.length;
        this.term.put(x + i, y + drawn, ln[i][0], ln[i][1], opts.bg);
      }
      drawn++;
    }
    return lines.length;
  }

  measureWrap(str, w) {
    return layoutMarkup(String(str), w, C.o4).length;
  }

  panel(x, y, w, h, opts = {}) {
    const t = this.term;
    const bg = opts.bg ?? C.bg1;
    const fg = opts.fg ?? C.o2;
    if (opts.shadow) {
      for (let j = 1; j <= h; j++) t.setBg(x + w, y + j, '#000000');
      for (let i = 1; i <= w; i++) t.setBg(x + i, y + h, '#000000');
    }
    t.fill(x, y, w, h, ' ', fg, bg);
    t.box(x, y, w, h, fg, bg, opts.style || 'single');
    if (opts.title) {
      const title = ` ${opts.title} `;
      const tx = opts.titleAlign === 'center' ? x + Math.floor((w - title.length) / 2) : x + 2;
      this.mtext(tx, y, title, opts.titleFg ?? C.o5, bg, w - 4, 1);
    }
    if (opts.footer) {
      const f = ` ${opts.footer} `;
      this.mtext(x + w - f.length - 2, y + h - 1, f, opts.footerFg ?? C.o3, bg);
    }
  }

  hline(x, y, w, fg = C.o1, ch = '─') {
    for (let i = 0; i < w; i++) this.term.put(x + i, y, ch, fg);
  }
  vline(x, y, h, fg = C.o1, ch = '│') {
    for (let j = 0; j < h; j++) this.term.put(x, y + j, ch, fg);
  }

  // --- Botones ----------------------------------------------------------
  // opts: w, key, disabled, tip, selected, danger, style('box'|'plain'|'tab'), align
  button(id, x, y, label, opts = {}) {
    const t = this.term;
    const plain = String(stripMarkup(label));
    const w = opts.w ?? plain.length + 4;
    const st = this.region(id, x, y, w, 1, { cursor: opts.disabled ? 'not-allowed' : 'pointer' });
    const hv = this.hoverT(id);
    const dis = !!opts.disabled;
    const sel = !!opts.selected;
    const accent = opts.danger ? C.red : opts.accent || C.o5;
    const base = dis ? C.grey2 : opts.danger ? C.red2 : opts.fg || C.o4;
    const bgBase = sel ? C.bg4 : opts.bg ?? null;
    // relleno progresivo de izquierda a derecha al pasar el ratón
    const fillN = Math.round(hv * w);
    for (let i = 0; i < w; i++) {
      const filled = i < fillN && !dis;
      const bg = filled ? mix(bgBase || C.bg2, opts.danger ? C.redD : C.o1, 0.55 + 0.45 * hv) : bgBase;
      t.put(x + i, y, ' ', base, bg);
    }
    const fg = dis ? C.grey2 : mix(sel ? C.o6 : base, opts.danger ? '#ffd0c8' : C.o7, hv);
    const style = opts.style || 'box';
    let lx;
    const inner = style === 'box' ? w - 4 : w - 2;
    const align = opts.align || 'center';
    if (align === 'left') lx = x + (style === 'box' ? 2 : 1);
    else lx = x + Math.floor((w - Math.min(plain.length, inner)) / 2);
    if (style === 'box') {
      const bc = dis ? C.greyD : mix(sel ? C.o5 : C.o2, accent, hv);
      t.put(x, y, '[', bc);
      t.put(x + w - 1, y, ']', bc);
      if (hv > 0.6 && !dis && w > 6) {
        t.put(x + 1, y, '›', accent);
        t.put(x + w - 2, y, '‹', accent);
      }
    } else if (style === 'tab') {
      if (sel) {
        t.put(x, y, '▐', C.o4);
        t.put(x + w - 1, y, '▌', C.o4);
      }
    }
    // etiqueta (respeta marcado si lo hay)
    const cells = parseMarkup(String(label), fg);
    for (let i = 0; i < cells.length && i < inner; i++) {
      const cc = cells[i][1] === fg ? fg : dis ? C.grey2 : cells[i][1];
      t.put(lx + i, y, cells[i][0], cc, undefined, sel || hv > 0.5 ? 1 : 0);
    }
    if (opts.key && !dis) {
      // atajo resaltado en la etiqueta si aparece
      const k = opts.key.length === 1 ? opts.key.toLowerCase() : null;
      if (k) {
        const idx = plain.toLowerCase().indexOf(k);
        if (idx >= 0 && idx < inner) t.put(lx + idx, y, plain[idx], opts.danger ? C.red : C.gold, undefined, 1);
      }
    }
    if (opts.tip) this.tip(id, opts.tip);
    let clicked = st.clicked && !dis;
    if (!dis && opts.key && this.layer >= this.prevTopLayer && this.focus == null) {
      if (this.input.key(opts.key)) {
        clicked = true;
        this.input.consumeKey(opts.key);
      }
    }
    if (clicked) this.audio && this.audio.play(opts.sound || 'click');
    if (st.clicked && dis) this.audio && this.audio.play('deny');
    return clicked;
  }

  // Icono/zona clicable genérica sin dibujo
  hit(id, x, y, w, h, opts = {}) {
    return this.region(id, x, y, w, h, opts);
  }

  // Interruptor ON/OFF
  toggle(id, x, y, label, value, opts = {}) {
    const w = opts.w ?? label.length + 6;
    const st = this.region(id, x, y, w, 1);
    const hv = this.hoverT(id);
    const t = this.term;
    const box = value ? '[■]' : '[ ]';
    t.text(x, y, box, value ? C.o5 : C.o2, hv > 0.3 ? C.bg3 : null);
    this.mtext(x + 4, y, label, mix(C.o4, C.o7, hv), hv > 0.3 ? C.bg3 : null, w - 4);
    if (opts.tip) this.tip(id, opts.tip);
    if (st.clicked) {
      this.audio && this.audio.play('click');
      return !value;
    }
    return value;
  }

  // --- Barras -------------------------------------------------------------
  // frac en [0,1]. opts: fg, bg, empty, id (para animar), marks
  bar(x, y, w, frac, opts = {}) {
    if (opts.id) frac = this.smooth(opts.id, frac, opts.speed || 6);
    frac = clamp(frac, 0, 1);
    const t = this.term;
    const fg = opts.fg || C.o4;
    const bgc = opts.bg ?? C.bg2;
    const eighths = Math.round(frac * w * 8);
    const full = Math.floor(eighths / 8);
    const rem = eighths % 8;
    if (opts.style === 'line') {
      for (let i = 0; i < w; i++) {
        if (i < full) t.put(x + i, y, '━', fg, opts.bg ?? null);
        else if (i === full && rem >= 4) t.put(x + i, y, '╸', fg, opts.bg ?? null);
        else t.put(x + i, y, '─', opts.emptyFg ?? C.o1, opts.bg ?? null);
      }
      return frac;
    }
    for (let i = 0; i < w; i++) {
      if (i < full) t.put(x + i, y, '█', fg, bgc);
      else if (i === full && rem > 0) t.put(x + i, y, PARTIAL_H[rem], fg, bgc);
      else t.put(x + i, y, opts.empty ?? ' ', opts.emptyFg ?? C.o1, bgc);
    }
    if (opts.marks) {
      for (const mk of opts.marks) {
        const mx = x + Math.round(mk * w);
        if (mx >= x && mx < x + w) t.put(mx, y, '│', C.red, undefined);
      }
    }
    return frac;
  }

  // Barra segmentada de pips (energía): n pips, value llenos
  pips(x, y, n, value, opts = {}) {
    const t = this.term;
    for (let i = 0; i < n; i++) {
      const on = i < value;
      t.put(x + i * (opts.gap ? 2 : 1), y, on ? opts.on ?? '■' : opts.off ?? '·', on ? opts.fg ?? C.o5 : opts.offFg ?? C.o1);
    }
  }

  // --- Tooltips -------------------------------------------------------
  // content: string con marcado | array de líneas | función -> uno de ellos
  tip(id, content, opts = {}) {
    if (this.hot !== id || this.drag) return;
    if (this.t - this.hoverStart < (opts.delay ?? 0.18)) return;
    this.tooltip = { content, w: opts.w || 44, since: this.hoverStart + (opts.delay ?? 0.18) };
  }

  drawTooltip() {
    const tt = this.tooltip;
    if (!tt) return;
    let content = typeof tt.content === 'function' ? tt.content() : tt.content;
    if (!content) return;
    const t = this.term;
    let lines = [];
    const w = tt.w;
    if (Array.isArray(content)) {
      for (const ln of content) {
        const l = layoutMarkup(String(ln), w, C.o6);
        lines = lines.concat(l.length ? l : [[]]);
      }
    } else lines = layoutMarkup(String(content), w, C.o6);
    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, l.length);
    const bw = maxW + 4;
    const bh = lines.length + 2;
    const m = this.m;
    let x = m.cx + 2;
    let y = m.cy + 1;
    if (x + bw > t.cols) x = m.cx - bw - 1;
    if (y + bh > t.rows) y = t.rows - bh;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    const age = this.t - tt.since;
    const rv = clamp(age / 0.12, 0, 1);
    const shownH = Math.max(2, Math.round(bh * (0.4 + 0.6 * rv)));
    const prev = t.layer;
    t.layer = 'top';
    const bg = '#0e0703';
    for (let j = 0; j < shownH; j++) for (let i = 0; i < bw; i++) t.put(x + i, y + j, ' ', null, bg);
    // borde
    const bc = C.o3;
    for (let i = 1; i < bw - 1; i++) {
      t.put(x + i, y, '─', bc, bg);
      t.put(x + i, y + shownH - 1, '─', bc, bg);
    }
    for (let j = 1; j < shownH - 1; j++) {
      t.put(x, y + j, '│', bc, bg);
      t.put(x + bw - 1, y + j, '│', bc, bg);
    }
    t.put(x, y, '┌', bc, bg);
    t.put(x + bw - 1, y, '┐', bc, bg);
    t.put(x, y + shownH - 1, '└', bc, bg);
    t.put(x + bw - 1, y + shownH - 1, '┘', bc, bg);
    for (let j = 0; j < lines.length && j < shownH - 2; j++) {
      const ln = lines[j];
      for (let i = 0; i < ln.length; i++) t.put(x + 2 + i, y + 1 + j, ln[i][0], ln[i][1], bg);
    }
    t.layer = prev;
  }

  // --- Arrastrar y soltar ---------------------------------------------
  // ghost: {label, fg, bg}
  draggable(id, x, y, w, h, payload, ghost = {}) {
    const st = this.region(id, x, y, w, h, { cursor: 'grab' });
    this.dragSources.set(id, { payload, ghost });
    st.dragging = !!(this.drag && this.drag.id === id);
    return st;
  }

  // Devuelve {over, accepts, dropped}
  dropTarget(id, x, y, w, h, accept = () => true) {
    const c = this.term.clip;
    let x0 = x;
    let y0 = y;
    let x1 = x + w;
    let y1 = y + h;
    if (c) {
      x0 = Math.max(x0, c.x0);
      y0 = Math.max(y0, c.y0);
      x1 = Math.min(x1, c.x1);
      y1 = Math.min(y1, c.y1);
    }
    this.dropTargets.push({ id, x0, y0, x1, y1, accept, layer: this.layer });
    const res = { over: false, accepts: false, dropped: null, dragging: !!this.drag };
    if (this.drag) {
      const m = this.m;
      res.accepts = !!accept(this.drag.payload);
      res.over = m.fx >= x0 && m.fx < x1 && m.fy >= y0 && m.fy < y1;
    }
    if (this.dropEv && this.dropEv.id === id) res.dropped = this.dropEv.payload;
    return res;
  }

  get dragging() {
    return this.drag;
  }

  drawDragGhost() {
    const d = this.drag;
    if (!d) return;
    const m = this.m;
    const g = d.ghost || {};
    const label = g.label || '■';
    const fg = g.fg || C.o7;
    const bg = g.bg || C.bg4;
    // flota con una ligera oscilación
    const wob = Math.sin(this.t * 8) * 0.06;
    const x = m.fx + 0.6;
    const y = m.fy - 0.5 + wob;
    this.term.ent(x - 0.5, y, '', fg, null, 1);
    // dibujamos como entidades en la capa FX (suaves, subcelda)
    for (let i = 0; i < label.length; i++) {
      this.term.ent(x + i, y, label[i], fg, bg, 0.92);
    }
  }

  // --- Scroll ---------------------------------------------------------
  beginScroll(id, x, y, w, h, contentH) {
    let s = this.scrolls.get(id) || { off: 0, vis: 0 };
    const maxOff = Math.max(0, contentH - h);
    const m = this.m;
    const inside = m.cx >= x && m.cx < x + w && m.cy >= y && m.cy < y + h;
    if (inside && m.wheel) s.off += m.wheel * 3;
    s.off = clamp(s.off, 0, maxOff);
    s.vis += (s.off - s.vis) * Math.min(1, this.dt * 18);
    if (Math.abs(s.vis - s.off) < 0.05) s.vis = s.off;
    this.scrolls.set(id, s);
    this.scrollStack.push({ id, x, y, w, h, contentH, maxOff });
    this.term.pushClip(x, y, w, h);
    return Math.round(s.vis);
  }
  endScroll() {
    const sc = this.scrollStack.pop();
    this.term.popClip();
    if (!sc || sc.maxOff <= 0) return;
    const s = this.scrolls.get(sc.id);
    const t = this.term;
    const bx = sc.x + sc.w;
    const thumbH = Math.max(1, Math.round((sc.h * sc.h) / sc.contentH));
    const thumbY = sc.y + Math.round(((sc.h - thumbH) * s.vis) / sc.maxOff);
    for (let j = 0; j < sc.h; j++) t.put(bx, sc.y + j, '│', C.o1);
    for (let j = 0; j < thumbH; j++) t.put(bx, thumbY + j, '┃', C.o4);
  }
  scrollTo(id, off) {
    const s = this.scrolls.get(id) || { off: 0, vis: 0 };
    s.off = off;
    this.scrolls.set(id, s);
  }

  // --- Modales --------------------------------------------------------
  beginModal(dimAmount = 0.6) {
    // oscurece todo lo dibujado hasta ahora
    const t = this.term;
    const n = t.cols * t.rows;
    for (let i = 0; i < n; i++) {
      t.fgB[i] = mix(t.fgB[i], '#000000', dimAmount);
      t.bgB[i] = mix(t.bgB[i], '#000000', dimAmount);
    }
    this.layer++;
    this.region('__modal' + this.layer, 0, 0, t.cols, t.rows, { passive: true, cursor: 'default' });
  }
  endModal() {
    this.layer = Math.max(0, this.layer - 1);
  }

  // --- Campo de texto -----------------------------------------------
  textInput(id, x, y, w, value, opts = {}) {
    const st = this.region(id, x, y, w, 1, { cursor: 'text' });
    const focused = this.focus === id;
    if (st.clicked) this.focus = id;
    else if (this.m.released && !st.hot && focused) this.focus = null;
    const t = this.term;
    t.fill(x, y, w, 1, ' ', C.o4, focused ? C.bg3 : C.bg2);
    let v = String(value);
    if (focused) {
      for (const k of this.input.keys) {
        if (k.key === 'Backspace') v = v.slice(0, -1);
        else if (k.key === 'Enter' || k.key === 'Escape') this.focus = null;
        else if (k.key.length === 1 && v.length < (opts.max || w - 1)) {
          if (!opts.filter || opts.filter.test(k.key)) v += opts.upper ? k.key.toUpperCase() : k.key;
        }
      }
      this.input.keys.length = 0;
    }
    t.text(x + 1, y, v.slice(-(w - 2)), focused ? C.o7 : C.o5);
    if (focused && Math.floor(this.t * 2) % 2 === 0) t.put(x + 1 + Math.min(v.length, w - 2), y, '▌', C.o5);
    if (!v && !focused && opts.placeholder) t.text(x + 1, y, opts.placeholder, C.o2);
    return v;
  }

  // --- Resolución al final del frame ------------------------------------
  end() {
    const m = this.m;
    // región superior bajo el ratón
    let top = null;
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (m.fx >= r.x0 && m.fx < r.x1 && m.fy >= r.y0 && m.fy < r.y1) {
        top = r;
        break;
      }
    }
    const id = top && !top.passive ? top.id : null;
    if (id !== this.hot) {
      this.hot = id;
      this.hoverStart = this.t;
      if (id && top.sound && this.hoverSound && !this.drag) this.audio && this.audio.play('hover');
    }
    this.hotRegion = top;
    if (m.pressed) this.pressedId = id;
    // inicio de arrastre
    if (m.dragging && !this.drag && this.pressedId && this.dragSources.has(this.pressedId)) {
      const src = this.dragSources.get(this.pressedId);
      this.drag = { id: this.pressedId, payload: src.payload, ghost: src.ghost, t0: this.t };
      this.audio && this.audio.play('pick');
    }
    if (m.released) {
      if (this.drag) {
        let target = null;
        for (let i = this.dropTargets.length - 1; i >= 0; i--) {
          const r = this.dropTargets[i];
          if (m.fx >= r.x0 && m.fx < r.x1 && m.fy >= r.y0 && m.fy < r.y1) {
            target = r;
            break;
          }
        }
        if (target && target.accept(this.drag.payload)) {
          this.pendingDrop = { id: target.id, payload: this.drag.payload, from: this.drag.id };
          this.audio && this.audio.play('drop');
        } else this.audio && this.audio.play('cancel');
        this.drag = null;
      } else if (id && (id === this.pressedId || m.pressed)) {
        this.pendingClick = id;
        if (m.dblclick) this.pendingDbl = id;
      }
      this.pressedId = null;
    }
    if (m.rreleased && id) this.pendingR = id;
    if (m.dblclick && id && !this.pendingDbl) this.pendingDbl = id;
    // cursor
    let cur = 'default';
    if (this.drag) cur = 'grabbing';
    else if (top && top.cursor) cur = top.cursor;
    if (cur !== this.cursor) {
      this.cursor = cur;
      this.onCursor && this.onCursor(cur);
    }
    this.prevTopLayer = this.topLayer;
    this.drawTooltip();
    this.drawDragGhost();
  }
}
