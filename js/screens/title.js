// Pantalla de título.

import { C } from '../palette.js';
import { mix, center } from '../engine/util.js';
import { drawBig, drawBigHalf, bigWidth } from '../engine/bigfont.js';
import { Storage, SLOTS } from '../engine/storage.js';

const PLANE = [
  '                ▗▄▖',
  '               ▐███▙▖',
  '               ▐█☭███▙▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▖',
  '      ▗▄▄▄▄▄▄▄▄████████████████████████████████████████████████████▙▄▄▖',
  ' ◄══▐██████████▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪█▪███████▓▓▙▄',
  '      ▝▀▀▀▀▀▀▀▜████████████████████████████████████████████████████████▛▘',
  '               ▝▀▀▀▀▀▀▀▀▀██▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀██▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▘',
  '                     ≡████████◗              ≡████████◗',
  '                      ▀▀▀▀▀▀▀▀                ▀▀▀▀▀▀▀▀',
];

function hash(n) {
  let h = Math.imul(n ^ 0x27d4eb2d, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export class TitleScreen {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.snowAcc = 0;
    this.hasSave = false;
    this.lastSlot = Storage.lastSlot();
    for (let i = 0; i < SLOTS; i++) {
      const inf = Storage.slotInfo(i);
      if (inf && !inf.summary?.over) this.hasSave = true;
    }
    if (this.lastSlot != null) {
      const inf = Storage.slotInfo(this.lastSlot);
      if (!inf || inf.summary?.over) this.lastSlot = null;
    }
  }

  update(dt) {
    this.t += dt;
    const { term, particles } = this.app;
    // nieve
    this.snowAcc += dt * term.cols * 0.08;
    while (this.snowAcc > 1) {
      this.snowAcc--;
      particles.snow(Math.random() * (term.cols + 30), -1, 1, { vx: -1.5 - Math.random() * 2, vy: 1.5 + Math.random() * 2.5, life: 30, alpha: 0.35 + Math.random() * 0.4 });
    }
    // estela del avión
    const p = this.planePos();
    if (Math.random() < dt * 24) {
      particles.smoke(p.x + 21, p.y + 7.5, 1, { wind: -4, alpha: 0.3, c0: C.o3, c1: C.o0 });
      particles.smoke(p.x + 46, p.y + 7.5, 1, { wind: -4, alpha: 0.3, c0: C.o3, c1: C.o0 });
    }
    if (Math.random() < dt * 20) {
      particles.add({ x: p.x + 20, y: p.y + 7.5, vx: -9, vy: 0.2, life: 0.8, g: '-', c0: C.gold, c1: C.red2, alpha: 0.7 });
      particles.add({ x: p.x + 45, y: p.y + 7.5, vx: -9, vy: 0.2, life: 0.8, g: '-', c0: C.gold, c1: C.red2, alpha: 0.7 });
    }
  }

  planePos() {
    const { term } = this.app;
    const span = term.cols + 95;
    const x = ((this.t * 5 + term.cols * 0.25) % span) - 80;
    const y = this.layout().planeY + Math.sin(this.t * 0.8) * 0.4;
    return { x, y };
  }

  layout() {
    const { term } = this.app;
    const rows = term.rows;
    const compact = rows < 52;
    return {
      headerY: 1,
      laY: compact ? 3 : 4,
      topoY: compact ? 8 : 10,
      subY: compact ? 15 : 18,
      planeY: compact ? 16 : 20,
      menuY: compact ? 27 : 31,
      gap: rows < 46 ? 1 : 2,
    };
  }

  render() {
    const { term, ui } = this.app;
    const t = this.t;
    const L = this.layout();
    const cols = term.cols;
    const rows = term.rows;

    // Cielo: degradado muy sutil y estrellas
    for (let y = 0; y < rows; y++) {
      const k = y / rows;
      const bg = mix('#000000', '#140802', Math.max(0, k - 0.45) * 1.2);
      for (let x = 0; x < cols; x++) {
        term.put(x, y, ' ', null, bg);
        const h = hash(x * 131 + y * 7919);
        if (y < rows * 0.55 && h > 0.996) {
          const tw = 0.5 + 0.5 * Math.sin(t * (1 + h * 3) + x);
          term.put(x, y, h > 0.999 ? '+' : '·', mix(C.o1, C.o6, tw * 0.7));
        }
      }
    }

    // Cabecera en cirílico
    const head = '☭  ОКБ ТОПОЛЕВ · СОВЕРШЕННО СЕКРЕТНО · ЭКЗ. № 1  ☭';
    term.text(Math.floor((cols - head.length) / 2), L.headerY, head, C.o2);

    // "LA MISIÓN"
    const la = 'LA MISIÓN';
    const wLa = bigWidth(la);
    drawBigHalf(term, Math.floor((cols - wLa) / 2), L.laY, la, (x) => mix(C.o3, C.o6, 0.5 + 0.5 * Math.sin(x * 0.2 - t * 2)));

    // "TOPOLEV" grande con brillo que recorre las letras
    const topo = 'TOPOLEV';
    const wT = bigWidth(topo, 2);
    const tx = Math.floor((cols - wT) / 2);
    drawBig(
      term, tx, L.topoY, topo,
      (x, y) => {
        const s = Math.sin((x - tx) * 0.09 - t * 2.4 + y * 0.3);
        const glint = Math.max(0, Math.sin((x - tx) * 0.05 - t * 0.9)) ** 18;
        return mix(mix(C.o3, C.o5, 0.5 + 0.5 * s), C.white, glint);
      },
      { sx: 2, shadow: C.o1, skipTop: true },
    );
    // estrella sobre la "O"
    const blink = 0.5 + 0.5 * Math.sin(t * 3);
    term.put(tx + 12 + 4, L.topoY - 1, '★', mix(C.red2, C.red, blink));

    const sub = 'МИССИЯ «ТОПОЛЕВ»  ·  С С С Р  ·  1 9 6 1';
    term.text(Math.floor((cols - sub.length) / 2), L.subY, sub, C.o3);

    // Avión
    const p = this.planePos();
    const px = Math.floor(p.x);
    const py = Math.round(p.y);
    for (let j = 0; j < PLANE.length; j++) {
      const row = PLANE[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === ' ') continue;
        let fg = j <= 2 ? C.o3 : j <= 5 ? C.o2 : C.o1;
        if (ch === '▪') fg = Math.sin(t * 5 + i * 0.7) > 0.6 ? C.gold : C.o6;
        else if (ch === '▓') fg = C.ice2;
        else if (ch === '☭') fg = C.red;
        else if (ch === '≡' || ch === '◗' || ch === '◄' || ch === '═') fg = C.o3;
        term.put(px + i, py + j, ch, fg);
      }
    }
    // luces de navegación
    if (Math.floor(t * 2) % 2 === 0) term.put(px + 72, py + 4, '•', C.red);
    else term.put(px + 17, py, '•', C.rad);

    // Taiga en paralaje
    const gY = rows - 4;
    for (let layer = 0; layer < 2; layer++) {
      const speed = layer === 0 ? 2 : 5;
      const off = Math.floor(t * speed);
      for (let x = 0; x < cols; x++) {
        const wx = x + off;
        const h = hash(wx * (layer ? 17 : 29) + layer * 1000);
        const height = layer === 0 ? 1 + Math.floor(h * 3) : Math.floor(h * 2.5);
        const base = gY + 1 + layer;
        for (let k = 0; k < height; k++) {
          const glyph = k === height - 1 ? (h > 0.5 ? '▲' : '♠') : '█';
          term.put(x, base - k, glyph, layer === 0 ? C.o0 : C.o1, null);
        }
      }
    }
    for (let x = 0; x < cols; x++) {
      term.put(x, rows - 2, '▀', C.o1, '#0a0502');
      term.put(x, rows - 1, ' ', null, '#0a0502');
    }

    // Menú
    const items = [];
    if (this.lastSlot != null) items.push(['continue', 'Continuar expediente', 'c']);
    items.push(['new', 'Nueva misión', 'n']);
    if (this.hasSave) items.push(['load', 'Cargar expediente', 'g']);
    items.push(['help', 'Instrucciones', 'i']);
    items.push(['archive', 'Archivo del Kremlin', 'a']);
    items.push(['settings', 'Ajustes', 'j']);
    items.push(['fs', 'Pantalla completa', 'p']);
    const bw = 30;
    const bx = Math.floor((cols - bw) / 2);
    let by = L.menuY;
    // marco del menú
    const mh = items.length * L.gap + 1;
    ui.panel(bx - 3, by - 1, bw + 6, mh + 1, { bg: '#050200', fg: C.o1 });
    for (const [id, label, key] of items) {
      if (ui.button('title_' + id, bx, by, label, { w: bw, key })) this.action(id);
      by += L.gap;
    }

    // Pie
    const foot = 'v1.0 · Ratón: todo · Espacio: pausa · Rueda: desplazar';
    term.text(2, rows - 1, foot, C.o2, '#0a0502');
    const cr = '«Слава труду!»';
    term.text(cols - cr.length - 2, rows - 1, cr, C.o2, '#0a0502');
  }

  action(id) {
    const app = this.app;
    const go = (name, opts) => {
      if (app.screens.registry[name]) app.go(name, opts);
    };
    switch (id) {
      case 'continue': go('load', { autoload: this.lastSlot }); break;
      case 'new': go('newgame'); break;
      case 'load': go('load'); break;
      case 'help': go('help'); break;
      case 'archive': go('archive'); break;
      case 'settings': go('settings', { back: 'title' }); break;
      case 'fs': app.toggleFullscreen(); break;
      default: break;
    }
  }
}
