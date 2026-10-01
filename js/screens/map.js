// Pantalla del mapa regional.

import { C } from '../palette.js';
import { mix, clamp, line, pad, wrap } from '../engine/util.js';
import { Noise2D } from '../engine/rng.js';
import { terrain, MAP_W, MAP_H, neighborsOf, legDistance, legWeather, moveStorms, reveal, KM_PER_CELL } from '../game/map.js';
import { REGIONS, NODE_TYPES } from '../game/data/regions.js';
import { alive, fmtClock, fmtDuration, rng, log, addRes, caps, day, RES } from '../game/run.js';
import { shipStats } from '../game/ship.js';
import { createFlight, estimateSpeed, THROTTLE } from '../game/flight.js';
import { activeDirectives } from '../game/directives.js';
import { saveGame } from '../game/save.js';
import { resourceBar, suspicionMeter, clockWidget, regionTag, sectionTitle } from './ui/common.js';
import { restCrew } from '../game/nodes.js';

const NODE_COL = { gold: C.gold, o6: C.o6, o5: C.o5, o4: C.o4, red: C.red, grey: C.grey, ice: C.ice, violet: C.violet };

export class MapScreen {
  constructor(app) {
    this.app = app;
    this.sel = null;
    this.hover = null;
    this.menu = false;
    this.noise = new Noise2D(1234);
    this.view = { x: 0, y: 0 };
    this.confirmRest = false;
  }
  get run() {
    return this.app.run;
  }

  enter() {
    const run = this.run;
    run.phase = 'map';
    const st = shipStats(run.ship);
    reveal(run.map, st.range);
    saveGame(this.app);
  }

  update(dt) {
    const P = this.app.particles;
    const { term } = this.app;
    if (this.departing) {
      this.departing.t += dt;
      if (this.departing.t > 1.6) this.depart(this.departing.to);
    }
    if (Math.random() < dt * 20) P.snow(Math.random() * term.cols, -1, 1, { vx: -1 - Math.random(), vy: 2 + Math.random() * 2, life: 25, alpha: 0.3 });
  }

  legInfo(to) {
    const run = this.run;
    const map = run.map;
    const a = map.nodes[map.cur];
    const b = map.nodes[to];
    const st = shipStats(run.ship);
    const dist = legDistance(a, b);
    const speed = Math.max(200, estimateSpeed(run, st));
    const navs = alive(run).filter((c) => c.pri.navegar > 0);
    const nav = navs.length ? Math.max(...navs.map((c) => c.skills.nav)) : 0;
    const navK = nav ? 1 + nav * 0.014 : 0.84;
    const hours = dist / (speed * navK);
    let fuelH = 0;
    for (const id of st.engines) fuelH += run.ship.slots[id].stats.fuel * THROTTLE[run.ship.throttle].fuel;
    const fuel = fuelH * hours;
    const weather = legWeather(map, a, b);
    const danger = clamp(0.1 + run.region * 0.09 + (NODE_TYPES[b.type].danger || 0) + weather * 0.2, 0, 1);
    return { dist, hours, fuel, weather, danger };
  }

  render() {
    const app = this.app;
    const { term, ui, input } = app;
    const run = this.run;
    const map = run.map;
    const W = term.cols;
    const H = term.rows;
    const RW = clamp(W - MAP_W - 4, 42, 56);
    const AW = W - RW - 1;
    const AH = H - 4;
    const T = terrain(run.seed, run.region);

    // barra superior
    term.fill(0, 0, W, 2, ' ', C.o4, C.bg2);
    term.text(1, 0, '☭', C.red);
    term.text(3, 0, regionTag(run), C.o5, null, 1);
    let x = 3 + regionTag(run).length + 3;
    x += clockWidget(app, x, 0, run) + 2;
    resourceBar(app, 1, 1, run);
    suspicionMeter(app, W - 30, 1, run, 12);
    if (ui.button('mapmenu', W - 10, 0, '≡ Menú', { w: 9, key: 'Escape' })) this.menu = true;

    // marco del mapa
    const mx = Math.max(1, Math.floor((AW - MAP_W) / 2));
    const my = 3 + Math.max(0, Math.floor((AH - MAP_H) / 2));
    const vw = Math.min(MAP_W, AW - 2);
    const vh = Math.min(MAP_H, AH - 1);
    // desplazamiento si no cabe
    const cur = map.nodes[map.cur];
    if (vw < MAP_W) this.view.x = clamp(cur.x - Math.floor(vw / 2), 0, MAP_W - vw);
    else this.view.x = 0;
    if (vh < MAP_H) this.view.y = clamp(cur.y - Math.floor(vh / 2), 0, MAP_H - vh);
    else this.view.y = 0;
    const vx0 = this.view.x;
    const vy0 = this.view.y;
    ui.panel(mx - 1, my - 1, vw + 2, vh + 2, { title: REGIONS[run.region].name.toUpperCase(), titleAlign: 'center', bg: '#000000', fg: C.o1 });
    const t = app.time;
    const S = (mxx, myy) => [mx + mxx - vx0, my + myy - vy0];
    const inView = (mxx, myy) => mxx >= vx0 && mxx < vx0 + vw && myy >= vy0 && myy < vy0 + vh;
    // terreno
    for (let yy = 0; yy < vh; yy++) {
      for (let xx = 0; xx < vw; xx++) {
        const i = (yy + vy0) * MAP_W + (xx + vx0);
        let fg = T.fg[i];
        const ch = T.ch[i];
        if (T.kind[i] === 'river' || T.kind[i] === 'water') {
          const s = Math.sin((xx + vx0) * 0.4 + t * 1.5 + (yy + vy0));
          fg = mix(T.fg[i], C.ice, 0.15 + 0.15 * s);
        }
        term.put(mx + xx, my + yy, ch, fg, '#000000');
      }
    }
    // tormentas
    for (const s of map.storms) {
      const r = Math.ceil(s.r);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r * 2; dx <= r * 2; dx++) {
          const px = Math.round(s.x + dx);
          const py = Math.round(s.y + dy);
          if (!inView(px, py)) continue;
          const d = Math.hypot(dx / 2, dy) / s.r;
          if (d > 1) continue;
          const n = this.noise.get(px * 0.3 + t * 0.6 + s.seed, py * 0.5 - t * 0.3);
          const v = (1 - d) * s.p + n * 0.5 - 0.35;
          if (v > 0.1) {
            const [sx, sy] = S(px, py);
            const flick = this.noise.get(px * 0.9 + t * 3, py * 1.3);
            const g = v > 0.6 ? '▒' : v > 0.42 ? '░' : flick > 0.55 ? '*' : '·';
            term.put(sx, sy, g, mix('#0a1820', C.ice2, clamp(v, 0, 1) * 0.55), null);
          }
        }
      }
      // relámpago
      if (s.p > 0.6 && Math.random() < 0.01) {
        const [sx, sy] = S(Math.round(s.x), Math.round(s.y));
        if (inView(Math.round(s.x), Math.round(s.y))) term.put(sx, sy, 'ϟ', C.gold);
      }
      // dirección
      const [ax, ay] = S(Math.round(s.x + Math.sign(s.vx) * (s.r * 2 + 1)), Math.round(s.y));
      if (inView(Math.round(s.x + Math.sign(s.vx) * (s.r * 2 + 1)), Math.round(s.y))) term.put(ax, ay, s.vx < 0 ? '←' : '→', '#3a5a6a');
    }
    // alcance de reconocimiento
    const st = shipStats(run.ship);
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      const px = Math.round(cur.x + Math.cos(a) * st.range);
      const py = Math.round(cur.y + (Math.sin(a) * st.range) / 1.5);
      if (inView(px, py)) {
        const [sx, sy] = S(px, py);
        term.put(sx, sy, '·', mix(C.o1, C.o3, 0.5 + 0.5 * Math.sin(a * 6 + t * 2)));
      }
    }
    // aristas
    const reach = new Set(neighborsOf(map, map.cur));
    const target = this.hover ?? this.sel;
    for (const [a, b] of map.edges) {
      const A = map.nodes[a];
      const B = map.nodes[b];
      const pts = line(A.x, A.y, B.x, B.y);
      const active = a === map.cur && reach.has(b);
      const chosen = active && b === target;
      for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i];
        if (!inView(px, py)) continue;
        const [sx, sy] = S(px, py);
        if (chosen) {
          const phase = (i - t * 12) % 4;
          const on = ((phase % 4) + 4) % 4 < 2;
          term.put(sx, sy, on ? '•' : '·', on ? C.o7 : C.o4);
        } else if (active) term.put(sx, sy, '·', C.o4);
        else if (map.path.includes(a) && map.path.includes(b)) term.put(sx, sy, '·', C.o3);
        else if (i % 2 === 0) term.put(sx, sy, '·', C.o1);
      }
    }
    // nodos
    this.hover = null;
    for (const n of map.nodes) {
      if (!inView(n.x, n.y)) continue;
      const [sx, sy] = S(n.x, n.y);
      const NT = NODE_TYPES[n.type];
      const known = n.known || n.visited;
      const isCur = n.id === map.cur;
      const canGo = reach.has(n.id);
      const id = 'node_' + n.id;
      const stt = ui.region(id, sx - 1, sy, 3, 1, { cursor: canGo ? 'pointer' : 'help' });
      if (stt.hot) this.hover = canGo ? n.id : null;
      const hv = ui.hoverT(id);
      let g = known ? NT.glyph : '?';
      let col = known ? NODE_COL[NT.color] || C.o5 : C.o3;
      if (n.visited && !isCur) col = mix(col, '#000000', 0.55);
      const bg = canGo ? mix('#000000', C.o1, 0.45 + 0.4 * hv + (this.sel === n.id ? 0.5 : 0) + (this.sel === n.id ? 0.15 * Math.sin(t * 6) : 0)) : '#000000';
      term.put(sx, sy, g, col, bg, 1);
      term.put(sx - 1, sy, canGo && this.sel === n.id ? '[' : ' ', C.o6, bg);
      term.put(sx + 1, sy, canGo && this.sel === n.id ? ']' : ' ', C.o6, bg);
      if (isCur) {
        const pulse = Math.floor(t * 4) % 4;
        term.put(sx, sy, '✈', C.white, C.o2, 1);
        const R2 = 1 + (t * 1.5) % 2.5;
        for (let a = 0; a < Math.PI * 2; a += 0.5) {
          const rx = Math.round(n.x + Math.cos(a) * R2 * 2);
          const ry = Math.round(n.y + Math.sin(a) * R2);
          if (inView(rx, ry) && !(rx === n.x && ry === n.y)) {
            const [qx, qy] = S(rx, ry);
            term.put(qx, qy, '·', mix(C.o5, '#000000', R2 / 3.5));
          }
        }
      }
      ui.tip(id, () => this.nodeTip(n, canGo), { w: 42 });
      if (stt.clicked && canGo) {
        this.sel = n.id;
        app.audio.play('click');
      }
      if (stt.dbl && canGo) this.depart(n.id);
    }
    // animación de despegue: el avión recorre la ruta
    if (this.departing) {
      const A = map.nodes[map.cur];
      const B = map.nodes[this.departing.to];
      const k = Math.min(1, this.departing.t / 1.4);
      const e = k * k * (3 - 2 * k);
      const px = A.x + (B.x - A.x) * e;
      const py = A.y + (B.y - A.y) * e;
      const [sx, sy] = S(px, py);
      term.ent(sx, sy, '✈', C.white, null, 1, 1.3);
      if (Math.random() < 0.8) this.app.particles.add({ x: sx + 0.5, y: sy + 0.5, vx: -(B.x - A.x) * 0.3, vy: 0, life: 0.8, g: '·', c0: C.o5, c1: C.o1 });
    }
    // etiquetas de los destinos alcanzables y la posición actual
    for (const n of map.nodes) {
      const isCur = n.id === map.cur;
      if (!reach.has(n.id) && !isCur) continue;
      if (!inView(n.x, n.y)) continue;
      const [sx, sy] = S(n.x, n.y);
      const known = n.known || n.visited;
      let label = isCur ? 'AQUÍ' : known ? n.name : '¿?';
      label = label.length > 22 ? label.slice(0, 21) + '…' : label;
      const hot = this.hover === n.id || this.sel === n.id;
      let lx = sx + 2;
      if (lx + label.length >= mx + vw) lx = sx - 2 - label.length;
      const ly = sy + (isCur ? 1 : 0);
      if (ly >= my + vh) continue;
      term.text(lx, ly, label, isCur ? C.white : hot ? C.o7 : C.o4, '#000000');
    }
    // leyenda
    this.drawLegend(1, H - 1);

    // panel derecho
    this.drawSide(W - RW, 2, RW, H - 2);

    if (this.menu) this.drawMenu();
  }

  nodeTip(n, canGo) {
    const run = this.run;
    const NT = NODE_TYPES[n.type];
    const known = n.known || n.visited;
    const L = [known ? `{O}${n.name}{/}` : '{O}Destino desconocido{/}', known ? `{d}${NT.name} — ${NT.desc}{/}` : '{d}El radar no alcanza. Podría ser cualquier cosa.{/}'];
    if (n.visited) L.push('{x}Ya visitado{/}');
    if (canGo) {
      const li = this.legInfo(n.id);
      L.push(`Distancia {l}${li.dist} km{/} · ~${fmtDuration(li.hours * 60)}`);
      L.push(`Combustible ~{${li.fuel > run.res.fuel ? 'r' : 'l'}}${li.fuel.toFixed(1)} t{/}`);
      L.push(`Peligro {${li.danger > 0.5 ? 'r' : 'l'}}${Math.round(li.danger * 100)}%{/}${li.weather > 0.1 ? ` · Tormenta {i}${Math.round(li.weather * 100)}%{/}` : ''}`);
      L.push('{x}Clic: seleccionar · Doble clic: despegar{/}');
    }
    for (const d of activeDirectives(run)) if (d.kind === 'visitar' && d.target === n.id) L.push('{y}★ Objetivo de una directiva{/}');
    return L;
  }

  drawLegend(x, y) {
    const { term } = this.app;
    let cx = x;
    for (const k of ['aerodromo', 'koljos', 'aldea', 'ciudad', 'militar', 'restos', 'gulag', 'estacion', 'anomalia', 'frontera']) {
      const NT = NODE_TYPES[k];
      term.put(cx, y, NT.glyph, NODE_COL[NT.color] || C.o5);
      term.text(cx + 2, y, NT.name, C.o2);
      cx += NT.name.length + 4;
      if (cx > term.cols - 60) break;
    }
  }

  drawSide(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const map = run.map;
    const cur = map.nodes[map.cur];
    ui.panel(x, y, w, h, { title: 'MANDO', bg: C.bg1 });
    let yy = y + 1;
    sectionTitle(app, x + 1, yy++, w - 2, 'POSICIÓN');
    ui.mtext(x + 2, yy++, `{l}${cur.name}{/}`, C.o4, null, w - 4);
    ui.mtext(x + 2, yy++, `{d}${NODE_TYPES[cur.type].name}{/}`, C.o4, null, w - 4);
    yy++;
    sectionTitle(app, x + 1, yy++, w - 2, 'DESTINO');
    const dest = this.sel != null ? map.nodes[this.sel] : null;
    if (dest) {
      const known = dest.known || dest.visited;
      const li = this.legInfo(dest.id);
      ui.mtext(x + 2, yy++, known ? `{O}${dest.name}{/}` : '{O}¿?{/}', C.o4, null, w - 4);
      ui.mtext(x + 2, yy++, `{d}${known ? NODE_TYPES[dest.type].name : 'Desconocido'}{/}`, C.o4, null, w - 4);
      const row = (k, v, c = C.o6) => {
        term.text(x + 2, yy, k, C.o3);
        ui.mtext(x + 16, yy++, v, c, null, w - 18);
      };
      row('Distancia', `${li.dist} km`);
      row('Duración', `~${fmtDuration(li.hours * 60)}`);
      row('Combustible', `~${li.fuel.toFixed(1)} t {d}(hay ${run.res.fuel.toFixed(1)}){/}`, li.fuel > run.res.fuel ? C.red : C.o6);
      row('Peligro', `${Math.round(li.danger * 100)}%`, li.danger > 0.5 ? C.red : li.danger > 0.3 ? C.gold : C.o6);
      if (li.weather > 0.05) row('Tormenta', `${Math.round(li.weather * 100)}%`, C.ice);
      // avisos previos
      const warns = this.preflight(li);
      for (const wtxt of warns) {
        if (yy >= y + h - 16) break;
        ui.mtext(x + 2, yy++, `{r}▲{/} ${wtxt}`, C.o5, null, w - 4);
      }
      yy++;
      if (ui.button('depart', x + 2, yy, '✈ DESPEGAR', { w: w - 4, key: 'Enter', accent: C.gold, tip: 'Iniciar el vuelo hacia el destino seleccionado (Intro)' })) this.depart(dest.id);
      yy += 2;
    } else {
      ui.mtext(x + 2, yy++, '{x}Elige un nodo conectado en el mapa.{/}', C.o4, null, w - 4);
      yy += 2;
    }
    // acciones en tierra
    sectionTitle(app, x + 1, yy++, w - 2, 'EN TIERRA');
    const bw = Math.floor((w - 5) / 2);
    if (ui.button('hangar', x + 2, yy, 'Hangar', { w: bw, key: 'h', tip: 'Instalar y gestionar módulos, bodega y taller (H)' })) app.go('hangar');
    if (ui.button('crew', x + 3 + bw, yy, 'Tripulación', { w: bw, key: 't', tip: 'Prioridades de trabajo y expedientes (T)' })) app.go('crew');
    yy += 2;
    if (ui.button('rest', x + 2, yy, 'Descansar 6 h', { w: bw, key: 'd', tip: ['{O}Descansar 6 horas{/}', 'La tripulación duerme, come y se recupera. Las tormentas se desplazan.', '{r}Consume tiempo del plazo y comida.{/}'] })) this.confirmRest = true;
    if (ui.button('savebtn', x + 3 + bw, yy, 'Guardar', { w: bw, tip: 'Guardar el expediente' })) {
      saveGame(app);
      app.audio.play('success');
    }
    yy += 2;
    // directivas
    sectionTitle(app, x + 1, yy++, w - 2, 'DIRECTIVAS DE MOSCÚ');
    const ds = activeDirectives(run);
    if (!ds.length) ui.mtext(x + 2, yy++, '{x}Ninguna activa.{/}', C.o4);
    for (const d of ds) {
      if (yy >= y + h - 8) break;
      const prog = d.need > 1 ? ` (${d.progress}/${d.need})` : '';
      const n = ui.mwrap(x + 2, yy, w - 4, `{y}★{/} ${d.text}${prog}`, C.o6, { maxLines: 3 });
      yy += Math.min(3, n);
    }
    yy++;
    // tripulación resumida
    if (yy < y + h - 3) {
      sectionTitle(app, x + 1, yy++, w - 2, 'TRIPULACIÓN');
      for (const c of alive(run)) {
        if (yy >= y + h - 1) break;
        const warn = c.hp < 50 ? '{r}herido{/}' : c.fatigue > 75 ? '{y}agotado{/}' : c.hunger > 70 ? '{y}hambriento{/}' : c.morale < 30 ? '{v}desmoralizado{/}' : '{x}bien{/}';
        ui.mtext(x + 2, yy++, `${pad(c.first[0] + '. ' + c.sur, 20)} ${warn}`, C.o5, null, w - 4);
      }
    }
    if (this.confirmRest) this.drawRestConfirm();
  }

  preflight(li) {
    const run = this.run;
    const W = [];
    if (li.fuel > run.res.fuel) W.push('Combustible insuficiente: aterrizaje forzoso.');
    if (!alive(run).some((c) => c.pri.pilotar > 0 && c.skills.pil > 0)) W.push('Nadie tiene asignado pilotar: piloto automático.');
    if (run.res.meals + run.res.rations < alive(run).length) W.push('Comida escasa.');
    if (alive(run).filter((c) => c.fatigue > 75).length >= 2) W.push('Varios tripulantes agotados.');
    const st = shipStats(run.ship);
    if (!st.engines.length) W.push('¡No hay motores instalados!');
    return W;
  }

  depart(to) {
    const run = this.run;
    const st = shipStats(run.ship);
    if (!st.engines.length) {
      this.app.audio.play('deny');
      return;
    }
    if (!this.departing) {
      this.departing = { to, t: 0 };
      this.app.audio.play('land');
      return;
    }
    this.departing = null;
    createFlight(run, to, { final: run.map.nodes[to].type === 'epicentro' });
    run.phase = 'flight';
    saveGame(this.app);
    this.app.go('flight');
  }

  drawRestConfirm() {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const W = term.cols;
    const H = term.rows;
    const pw = 54;
    const ph = 11;
    const px = Math.floor((W - pw) / 2);
    const py = Math.floor((H - ph) / 2);
    ui.beginModal(0.6);
    ui.panel(px, py, pw, ph, { title: 'DESCANSO EN TIERRA', style: 'double', shadow: true });
    ui.mwrap(px + 3, py + 2, pw - 6, `La tripulación dormirá y comerá durante {O}6 horas{/}. Consumirá comida y retrasará la misión. Las tormentas seguirán su curso.\n\n{d}Ahora: ${fmtClock(run.clock)} · Tras el descanso: ${fmtClock(run.clock + 360)}{/}`, C.o6);
    if (ui.button('rest_ok', px + 3, py + ph - 2, 'Descansar', { w: 16, key: 'Enter' })) {
      const msg = restCrew(run, 6);
      moveStorms(run.map, rng(run));
      log(run, msg, 'info');
      this.confirmRest = false;
      saveGame(app);
      app.audio.play('success');
    }
    if (ui.button('rest_no', px + pw - 19, py + ph - 2, 'Cancelar', { w: 16, key: 'Escape' })) this.confirmRest = false;
    ui.endModal();
  }

  drawMenu() {
    const app = this.app;
    const { term, ui } = app;
    const W = term.cols;
    const H = term.rows;
    const pw = 34;
    const ph = 13;
    const px = Math.floor((W - pw) / 2);
    const py = Math.floor((H - ph) / 2);
    ui.beginModal(0.7);
    ui.panel(px, py, pw, ph, { title: 'MENÚ', style: 'double', shadow: true });
    ui.mtext(px + 3, py + ph - 2, `{x}Semilla: {l}${this.run.seed}{/}`, C.o4, null, pw - 6);
    let yy = py + 2;
    if (ui.button('mm_cont', px + 3, yy, 'Continuar', { w: pw - 6, key: 'Escape' })) this.menu = false;
    yy += 2;
    if (ui.button('mm_help', px + 3, yy, 'Instrucciones', { w: pw - 6 })) app.go('help', { back: 'map' });
    yy += 2;
    if (ui.button('mm_set', px + 3, yy, 'Ajustes', { w: pw - 6 })) app.go('settings', { back: 'map' });
    yy += 2;
    if (ui.button('mm_quit', px + 3, yy, 'Guardar y salir al título', { w: pw - 6, danger: true })) {
      saveGame(app);
      app.go('title');
    }
    ui.endModal();
  }
}
