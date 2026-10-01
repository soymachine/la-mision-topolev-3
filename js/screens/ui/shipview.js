// Vista del corte transversal del Topolev: paredes, salas, estados, equipo, tripulación.

import { C } from '../../palette.js';
import { layout, SHIP_W, SHIP_H } from '../../game/ship.js';
import { alive } from '../../game/run.js';
import { displayName, roleName, has } from '../../game/crew.js';
import { ROLES } from '../../game/data/traits.js';
import { mix, clamp } from '../../engine/util.js';

// Arte exterior del casco: [x, y, texto]. '█' relleno oscuro; resto, borde.
const HULL = [
  [7, 0, '▗▄▄▄▖'],
  [6, 1, '▗█████▙'],
  [5, 2, '▗████████▙▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄'],
  [58, 2, '▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▖'],
  [3, 3, '▗▟█'], [1, 4, '▗▟██'], [2, 5, '▐██'], [1, 6, '▝▜██'], [3, 7, '▝▜█'],
  [6, 8, '▝▀▜██████'], [10, 9, '▝▀▜███'], [13, 10, '▝▜'],
  [89, 3, '▙▄'], [89, 4, '███▙▖'], [89, 5, '█████▙▖'], [89, 6, '███████▌'], [89, 7, '██████▛▘'],
  [80, 8, '█████████▛▘'], [80, 9, '███████▛▘'], [80, 10, '████▛▘'], [80, 11, '▀▀▘'],
  [16, 12, '▀▀▀▀▀▀'], [34, 12, '▀▀▀▀▀▀▀▀▀▀▀▀'], [55, 12, '▀▀▀▀▀'], [72, 12, '▀▀▀▀▀▀▘'],
];
const HULL_EXTRA = [
  [0, 5, '◄═', 'g'], [58, 1, '══◘', 'g'], [42, 14, '◘══', 'g'],
  [91, 4, '◢', 'w'], [92, 5, '◢', 'w'],
  [34, 13, '◖', 'g'], [20, 13, '≡≡', 'g'], [72, 13, '◖', 'g'], [58, 13, '≡≡', 'g'],
  [7, 1, '★', 'r'],
];

// Decorado interior (fila relativa al suelo: -1 = justo encima)
const DECOR = [
  ['cabina', 79, -2, '◊▣◊ ○○ ▣', 'o2'], ['cabina', 80, -1, '╤╕ ╤╕ ═╗', 'o1'],
  ['navegacion', 69, -2, '▤ ◎', 'o2'], ['navegacion', 69, -1, '╤══╤', 'o1'],
  ['radio', 57, -2, '▣▣¥', 'o2'], ['radio', 57, -1, '╤══╤', 'o1'], ['radio', 63, -2, '◎≈', 'o2'], ['radio', 63, -1, '╤═╤', 'o1'],
  ['comisaria', 46, -2, '☭ ▤', 'red'], ['comisaria', 46, -1, '╤══╤', 'o1'],
  ['comedor', 31, -2, '♨', 'o3'], ['comedor', 31, -1, '▄▄', 'o2'], ['comedor', 35, -1, '╤═══════╤', 'o1'],
  ['reactor', 35, -2, '╔═☢═╗', 'g'], ['reactor', 35, -1, '║▓▓▓║', 'o2'],
  ['maquinas', 45, -2, '≡≡ ⌂', 'o2'], ['maquinas', 51, -2, '◘◘', 'o2'], ['maquinas', 51, -1, '╤═╤', 'o1'],
  ['taller', 57, -2, '¶ ▓▒', 'o2'], ['taller', 57, -1, '╤═══╤', 'o1'],
  ['enfermeria', 68, -2, '+', 'red'], ['enfermeria', 75, -2, '+', 'red'],
  ['motor1', 24, -2, '◄▓▓▓▓▓▓▓►', 'o2'], ['motor2', 62, -2, '◄▓▓▓▓▓▓▓►', 'o2'],
  ['dorsal', 50, -1, '╞╪╡', 'o2'], ['ventral', 49, -2, '╞╪╡', 'o2'], ['cola', 8, -2, '╞╪╡', 'o2'],
];

const COLMAP = { h: '#2a1406', g: C.o3, w: C.ice2, o1: C.o1, o2: C.o2, o3: C.o3, red: C.red2, r: C.red };
const HULL_FILL = '#1a0c04';
const HULL_EDGE = '#3d1e08';

export class ShipView {
  constructor(app) {
    this.app = app;
    this.L = layout();
    this.walls = this.computeWalls();
    this.hoverRoom = null;
    this.hoverCrew = null;
    this.highlight = null; // {x,y} a resaltar (tarea)
    this.clouds = [];
  }

  computeWalls() {
    const L = this.L;
    const W = L.W;
    const out = new Map();
    const isWall = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= L.H) return false;
      const c = L.cell[y * W + x];
      return c === 1;
    };
    for (let y = 0; y < L.H; y++) {
      for (let x = 0; x < W; x++) {
        const c = L.cell[y * W + x];
        if (c === 1) {
          const u = isWall(x, y - 1) || L.cell[(y - 1) * W + x] === 4;
          const d = isWall(x, y + 1) || L.cell[(y + 1) * W + x] === 4;
          const l = isWall(x - 1, y) || L.cell[y * W + x - 1] === 6;
          const r = isWall(x + 1, y) || L.cell[y * W + x + 1] === 6;
          const key = (u ? 1 : 0) + (d ? 2 : 0) + (l ? 4 : 0) + (r ? 8 : 0);
          const G = { 0: '·', 1: '│', 2: '│', 3: '│', 4: '─', 8: '─', 12: '─', 5: '┘', 6: '┐', 9: '└', 10: '┌', 7: '┤', 11: '├', 13: '┴', 14: '┬', 15: '┼' };
          out.set(y * W + x, G[key]);
        } else if (c === 4) out.set(y * W + x, 'door');
        else if (c === 6) out.set(y * W + x, 'hatch');
        else if (c === 5) out.set(y * W + x, 'ladder');
      }
    }
    return out;
  }

  // Dibuja la nave en (ox, oy). sel: {room, crew}. Devuelve nada; expone hoverRoom/hoverCrew.
  render(run, ox, oy, opts = {}) {
    const { term, ui, particles } = this.app;
    const L = this.L;
    const t = this.app.time;
    const ship = run.ship;
    const f = run.flight;
    this.ox = ox;
    this.oy = oy;
    // casco exterior
    for (const [x, y, s] of HULL) {
      for (let i = 0; i < s.length; i++) term.put(ox + x + i, oy + y, s[i], s[i] === '█' ? HULL_FILL : HULL_EDGE);
    }
    for (const [x, y, s, col] of HULL_EXTRA) term.text(ox + x, oy + y, s, COLMAP[col] || col);
    // salas: fondo según estado
    this.hoverRoom = null;
    for (const room of L.roomList) {
      const rs = ship.rooms[room.id];
      const hov = opts.hoverRoom === room.id;
      const sel = opts.selRoom === room.id;
      let bg = '#080402';
      if (rs.temp < 0) bg = mix(bg, C.iceD, clamp(-rs.temp / 25, 0, 0.8));
      if (rs.rad > 5) bg = mix(bg, C.radD, clamp(rs.rad / 40, 0.2, 0.8) * (0.7 + 0.3 * Math.sin(t * 8)));
      if (rs.o2 < 60) bg = mix(bg, '#000814', 0.6);
      if (rs.fire > 0) bg = mix(bg, C.redD, clamp(rs.fire / 60, 0.3, 1) * (0.75 + 0.25 * Math.sin(t * 13 + room.x)));
      if (hov) bg = mix(bg, C.o1, 0.35);
      if (sel) bg = mix(bg, C.o1, 0.5);
      if (rs.dark) bg = '#000000';
      for (let y = room.top; y <= room.floor; y++) {
        for (let x = room.x0; x <= room.x1; x++) term.put(ox + x, oy + y, ' ', C.o2, bg);
      }
    }
    // paredes, puertas, escaleras
    for (const [k, g] of this.walls) {
      const x = k % L.W;
      const y = Math.floor(k / L.W);
      const roomHere = L.roomOf(x, y);
      let fg = C.o2;
      if (g === 'door') {
        term.put(ox + x, oy + y, '¦', C.o1);
        continue;
      }
      if (g === 'hatch') {
        term.put(ox + x, oy + y, '╫', C.o3);
        continue;
      }
      if (g === 'ladder') {
        term.put(ox + x, oy + y, 'H', C.o2);
        continue;
      }
      term.put(ox + x, oy + y, g, fg);
    }
    // brechas: marcar pared exterior
    for (const room of L.roomList) {
      const rs = ship.rooms[room.id];
      const hov = opts.hoverRoom === room.id || opts.selRoom === room.id;
      if (hov) {
        // paredes resaltadas
        for (let x = room.x; x < room.x + room.w; x++) {
          this.tint(ox + x, oy + room.y, C.o5);
          this.tint(ox + x, oy + room.y + room.h - 1, C.o5);
        }
        for (let y = room.y; y < room.y + room.h; y++) {
          this.tint(ox + room.x, oy + y, C.o5);
          this.tint(ox + room.x + room.w - 1, oy + y, C.o5);
        }
      }
      if (rs.breach > 0) {
        const bx = room.x + Math.floor(room.w / 2);
        const flick = Math.floor(t * 6) % 2;
        for (let i = 0; i < rs.breach; i++) term.put(ox + bx + i - 1, oy + room.y, flick ? '░' : '▒', C.red);
        if (Math.random() < 0.5) particles.snow(ox + bx + Math.random() * 2, oy + room.y + 0.5, 1, { vx: -2 - Math.random() * 3, vy: 2 + Math.random() * 2, life: 1.2 });
      }
    }
    // decorado
    for (const [rid, x, dy, s, col] of DECOR) {
      const room = L.rooms[rid];
      if (ship.rooms[rid].dark) continue;
      let c = COLMAP[col] || col;
      if (rid === 'reactor') {
        const h = ship.heat;
        c = h > 85 ? (Math.floor(t * 5) % 2 ? C.red : C.gold) : h > 65 ? C.gold : ship.scram > 0 ? C.grey2 : C.rad2;
      }
      term.text(ox + x, oy + room.floor + dy, s, c);
    }
    // literas activas, asientos, camas
    const st = f?.stats;
    const bunks = st ? st.bunks : 4;
    for (let i = 0; i < L.bunkX.length; i++) {
      const x = L.bunkX[i];
      const room = L.rooms.dormitorio;
      if (i < bunks) {
        term.put(ox + x, oy + room.floor - 1, '▬', C.o2);
        term.put(ox + x, oy + room.floor - 2, '▬', C.o1);
      }
    }
    for (const x of L.bedX) term.text(ox + x, oy + L.rooms.enfermeria.floor - 1, '▄▄', C.o2);
    // cajas en la bodega según existencias
    const crates = Math.min(12, Math.ceil(((run.res.rations || 0) + (run.res.parts || 0) + (run.res.ammo || 0) / 10) / 8));
    const bod = L.rooms.bodega;
    for (let i = 0; i < crates; i++) {
      const x = bod.x0 + 1 + (i % 6) + (i % 6 >= 3 ? 1 : 0);
      const y = bod.floor - 1 - Math.floor(i / 6);
      term.put(ox + x + 7, oy + y, i % 3 === 0 ? '▤' : i % 3 === 1 ? '▦' : '▣', i % 2 ? C.o3 : C.o2);
    }
    // etiquetas sobre la pared superior
    for (const room of L.roomList) {
      const rs = ship.rooms[room.id];
      const hov = opts.hoverRoom === room.id || opts.selRoom === room.id;
      const w = room.w - 2;
      const label = room.short.slice(0, w - 1);
      const col = hov ? C.o7 : rs.dark ? C.grey2 : C.o3;
      term.text(ox + room.x + 1, oy + room.y, label, col, hov ? C.bg3 : null);
      // iconos de estado a la derecha de la etiqueta
      const icons = [];
      if (rs.fire > 0) icons.push(['▲', Math.floor(t * 8) % 2 ? C.gold : C.red]);
      if (rs.breach > 0) icons.push(['◌', C.ice]);
      if (rs.o2 < 50) icons.push(['○', C.ice2]);
      if (rs.rad > 10) icons.push(['☢', C.rad]);
      if (rs.temp < 0) icons.push(['*', C.ice]);
      if (rs.ice > 15) icons.push(['❄', C.ice]);
      if (rs.int < 60) icons.push(['╳', C.gold]);
      let ix = room.x + room.w - 2;
      for (const [g, c] of icons) {
        if (ix <= room.x + label.length + 1) break;
        term.put(ox + ix, oy + room.y, g, c);
        ix--;
      }
    }
    // fuego: llamas en las celdas interiores
    for (const room of L.roomList) {
      const rs = ship.rooms[room.id];
      if (rs.fire <= 0) continue;
      const rows = rs.fire > 60 ? 3 : rs.fire > 25 ? 2 : 1;
      for (let x = room.x0; x <= room.x1; x++) {
        for (let k = 0; k < rows; k++) {
          const y = room.floor - k;
          const n = Math.sin(x * 1.7 + t * 9 + k * 2) + Math.sin(x * 0.7 - t * 5);
          if (n > 0.4 - rs.fire / 100) {
            const g = k === rows - 1 ? (n > 1 ? '^' : "'") : n > 1.2 ? '▲' : '^';
            term.put(ox + x, oy + y, g, n > 1 ? C.gold : k ? C.o5 : C.red, null);
          }
        }
      }
      if (Math.random() < 0.3 * this.app.particles.mult) particles.embers(ox + room.x0 + Math.random() * (room.x1 - room.x0), oy + room.floor, 1);
      if (Math.random() < 0.15 * this.app.particles.mult) particles.smoke(ox + room.x0 + Math.random() * (room.x1 - room.x0), oy + room.top + 0.5, 1, { wind: -1 });
    }
    // radiación: chispas verdes
    for (const room of L.roomList) {
      const rs = ship.rooms[room.id];
      if (rs.rad > 10 && Math.random() < rs.rad / 300) particles.rad(ox + room.x0 + Math.random() * (room.x1 - room.x0 + 1), oy + room.top + 1 + Math.random() * 2, 1);
      if (rs.ice > 15) {
        for (let x = room.x; x < room.x + room.w; x += 2) term.put(ox + x, oy + room.y + room.h - 1, '*', C.ice);
      }
    }
    // escarcha en salas heladas
    // estaciones (marcadores cuando están libres)
    for (const s of L.stationList) {
      const occupied = alive(run).some((c) => Math.round(c.x) === s.x && Math.round(c.y) === s.y);
      if (!occupied) term.put(ox + s.x, oy + s.y, '·', C.o2);
    }
    // marcadores de tareas
    if (f) {
      for (const tk of f.tasks) {
        if (tk.type === 'station') continue;
        const room = L.rooms[tk.room];
        if (!room) continue;
        const x = tk.x ?? room.x0 + Math.floor((room.x1 - room.x0) / 2);
        const y = room.floor - 1;
        const g = tk.type === 'fire' ? '!' : tk.type === 'breach' ? '◌' : tk.type === 'heal' ? '+' : tk.type === 'ice' ? '❄' : '¤';
        const col = tk.type === 'fire' ? C.red : tk.type === 'heal' ? C.red2 : tk.type === 'ice' ? C.ice : C.gold;
        if (Math.floor(t * 2.5) % 2 === 0 || tk.prio) term.put(ox + x, oy + y, g, col);
      }
    }
    // resaltado de una posición (hover de tarea)
    if (opts.highlight) {
      const { x, y, room } = opts.highlight;
      if (room) {
        const R = L.rooms[room];
        for (let xx = R.x0; xx <= R.x1; xx++) this.app.term.setBg(ox + xx, oy + R.floor, mix(C.bg1, C.o2, 0.5 + 0.3 * Math.sin(t * 8)));
      }
      if (x != null) term.setBg(ox + x, oy + y, mix(C.o1, C.o4, 0.5 + 0.5 * Math.sin(t * 10)));
    }
  }

  tint(x, y, fg) {
    const t = this.app.term;
    if (!t.inBounds(x, y)) return;
    const i = y * t.cols + x;
    const ch = t.chB[i];
    if (ch !== ' ') t.fgB[i] = fg;
  }

  // Tripulación como entidades suaves (capa FX)
  drawCrew(run, opts = {}) {
    const { term } = this.app;
    const t = this.app.time;
    const ox = this.ox;
    const oy = this.oy;
    // ruta del tripulante seleccionado
    const selC = opts.selCrew && run.crew.find((c) => c.id === opts.selCrew);
    if (selC && selC.path && selC.path.length) {
      const W = this.L.W;
      for (let i = 0; i < selC.path.length; i++) {
        const k = selC.path[i];
        const a = 0.35 + 0.35 * Math.sin(t * 6 - i * 0.6);
        term.ent(ox + (k % W), oy + Math.floor(k / W), '·', C.gold, null, a);
      }
    }
    for (const c of alive(run)) {
      if (c.x == null) continue;
      const sel = opts.selCrew === c.id;
      const hov = opts.hoverCrew === c.id;
      const lying = c.act && (c.act.kind === 'sleep' || c.act.kind === 'collapse' || c.act.kind === 'patient');
      let g = crewGlyph(c);
      if (lying) g = g.toLowerCase();
      let col = C.o7;
      if (c.act?.kind === 'task' && c.atWork) col = C.o5;
      if (lying) col = C.o3;
      if (c.hp < 40) col = Math.floor(t * 4) % 2 ? C.red : C.o6;
      if (c.breakdown) col = C.violet;
      if (c.drunk > 50) col = C.ice;
      let bg = null;
      if (sel) bg = mix(C.o2, C.o4, 0.5 + 0.5 * Math.sin(t * 6));
      else if (hov) bg = C.o2;
      // pequeño balanceo al trabajar
      const bob = c.atWork ? Math.sin(t * 10 + c.x) * 0.06 : 0;
      term.ent(ox + c.x, oy + c.y + bob, g, col, bg, 1);
      if (c.order) term.ent(ox + c.x, oy + c.y - 0.75, '▾', C.gold, null, 0.8, 0.7);
    }
  }

  // Coordenadas de celda de pantalla -> sala
  roomAt(sx, sy) {
    const L = this.L;
    const x = sx - this.ox;
    const y = sy - this.oy;
    for (const room of L.roomList) {
      if (x >= room.x0 && x <= room.x1 && y >= room.top && y <= room.floor) return room.id;
    }
    return null;
  }
}

export function crewGlyph(c) {
  return (c.sur[0] || '@').toUpperCase();
}
