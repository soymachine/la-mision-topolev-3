// Mercado / servicios en tierra.

import { C } from '../palette.js';
import { mix, clamp, pad, padL } from '../engine/util.js';
import { RES, caps, alive, addRes, log, fmtClock, rng } from '../game/run.js';
import { market, buyPrice, sellPrice, hullRepairCost, moduleRepairCost, passTime } from '../game/nodes.js';
import { NODE_TYPES } from '../game/data/regions.js';
import { modLines, modTitle, modPrice } from '../game/loot.js';
import { MODTYPES, QUALITY } from '../game/data/modules.js';
import { layout } from '../game/ship.js';
import { miniFace, displayName, roleName, visibleTraits, maxHp, seedRelations } from '../game/crew.js';
import { SKILLS, TRAITS } from '../game/data/traits.js';
import { saveGame } from '../game/save.js';
import { resourceBar, suspicionMeter, clockWidget, sectionTitle, resColor } from './ui/common.js';
import { crewTooltip } from './ui/crewcards.js';

const MAX_CREW = 10;

export class StationScreen {
  constructor(app, opts) {
    this.app = app;
    this.back = opts.back || 'map';
    this.tab = null;
    this.msg = null;
    this.msgT = 0;
  }
  get run() {
    return this.app.run;
  }
  get node() {
    return this.run.map.nodes[this.run.map.cur];
  }

  enter() {
    this.mk = market(this.run, this.node);
    this.run.phase = 'station';
  }

  update(dt) {
    this.msgT -= dt;
  }

  say(text, ok = true) {
    this.msg = { text, ok };
    this.msgT = 3;
    this.app.audio.play(ok ? 'coin' : 'deny');
  }

  tabs() {
    const t = [];
    const mk = this.mk;
    const type = this.node.type;
    if (mk.sells.length) t.push(['mercado', 'Mercado']);
    if (mk.modules.length || ['aerodromo', 'ciudad', 'militar'].includes(type)) t.push(['modulos', 'Módulos']);
    if (['aerodromo', 'militar', 'ciudad', 'frontera'].includes(type)) t.push(['taller', 'Reparaciones']);
    if (mk.recruits.length) t.push(['reclutas', 'Reclutas']);
    if (['aerodromo', 'ciudad', 'estacion'].includes(type)) t.push(['hospital', 'Enfermería']);
    return t;
  }

  render() {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const W = term.cols;
    const H = term.rows;
    term.fill(0, 0, W, 2, ' ', C.o4, C.bg2);
    term.text(1, 0, '☭', C.red);
    term.text(3, 0, this.node.name.toUpperCase(), C.o5, null, 1);
    clockWidget(app, 5 + this.node.name.length, 0, run);
    resourceBar(app, 1, 1, run);
    suspicionMeter(app, W - 30, 1, run, 12);

    const tabs = this.tabs();
    if (!this.tab || !tabs.some((t) => t[0] === this.tab)) this.tab = tabs[0]?.[0];
    let tx = 2;
    for (const [id, name] of tabs) {
      if (ui.button('tab_' + id, tx, 3, name, { w: name.length + 4, style: 'tab', selected: this.tab === id })) this.tab = id;
      tx += name.length + 5;
    }
    if (ui.button('st_back', W - 22, 3, 'Volver ▸', { w: 20, key: 'Escape', accent: C.gold })) {
      saveGame(app);
      app.go(this.back === 'event' ? 'event' : 'map');
      return;
    }
    const x = 2;
    const y = 5;
    const w = W - 4;
    const h = H - 7;
    ui.panel(x, y, w, h, { title: (tabs.find((t) => t[0] === this.tab) || ['', ''])[1].toUpperCase() });
    if (this.tab === 'mercado') this.drawMarket(x + 2, y + 2, w - 4, h - 3);
    else if (this.tab === 'modulos') this.drawModules(x + 2, y + 2, w - 4, h - 3);
    else if (this.tab === 'taller') this.drawRepairs(x + 2, y + 2, w - 4, h - 3);
    else if (this.tab === 'reclutas') this.drawRecruits(x + 2, y + 2, w - 4, h - 3);
    else if (this.tab === 'hospital') this.drawHospital(x + 2, y + 2, w - 4, h - 3);
    else term.text(x + 2, y + 2, 'Aquí no hay nada que comprar.', C.o3);
    if (this.msg && this.msgT > 0) {
      const s = ` ${this.msg.text} `;
      term.text(Math.floor((W - s.length) / 2), H - 1, s, this.msg.ok ? C.rad : C.red, '#000000');
    }
  }

  drawMarket(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const mk = this.mk;
    const cp = caps(run);
    term.text(x, y, pad('Recurso', 16) + padL('Aquí', 7) + padL('Compra', 9) + padL('Venta', 8) + padL('Tenéis', 10), C.o3);
    let yy = y + 2;
    for (const k of Object.keys(mk.prices)) {
      if (k === 'rubles' || k === 'knowledge') continue;
      const R = RES[k];
      const stock = mk.stock[k];
      const bp = buyPrice(mk, k);
      const sp = sellPrice(mk, k);
      const unit = k === 'ammo' ? 10 : 1;
      const have = RES[k].d ? run.res[k].toFixed(1) : Math.floor(run.res[k]);
      term.put(x, yy, R.glyph, resColor(k));
      term.text(x + 2, yy, pad(R.name + (unit > 1 ? ` (×${unit})` : ''), 14), C.o6);
      term.text(x + 16, yy, padL(stock > 0 ? stock : '—', 7), stock > 0 ? C.o5 : C.o1);
      term.text(x + 23, yy, padL(stock > 0 ? (bp * unit).toFixed(0) + '₽' : '—', 9), C.gold);
      term.text(x + 32, yy, padL((sp * unit).toFixed(0) + '₽', 8), C.o4);
      term.text(x + 40, yy, padL(`${have}/${cp[k]}`, 10), C.o6);
      let bx = x + 53;
      for (const n of [1, 5]) {
        const q = n * unit;
        const cost = Math.ceil(bp * q);
        const can = stock >= q && run.res.rubles >= cost && run.res[k] + q <= cp[k] + 0.001;
        if (ui.button(`buy_${k}_${n}`, bx, yy, `+${n}`, { w: 6, disabled: !can, tip: `Comprar ${q} por ${cost}₽` })) {
          addRes(run, 'rubles', -cost);
          addRes(run, k, q);
          mk.stock[k] -= q;
          this.say(`Comprado: ${q} ${R.name.toLowerCase()}`);
        }
        bx += 7;
      }
      for (const n of [1, 5]) {
        const q = n * unit;
        const gain = Math.floor(sp * q);
        const can = run.res[k] >= q && gain > 0;
        if (ui.button(`sell_${k}_${n}`, bx, yy, `−${n}`, { w: 6, disabled: !can, tip: `Vender ${q} por ${gain}₽` })) {
          addRes(run, k, -q);
          addRes(run, 'rubles', gain);
          mk.stock[k] += q;
          this.say(`Vendido: ${q} ${R.name.toLowerCase()} (+${gain}₽)`);
        }
        bx += 7;
      }
      // llenar
      if (stock > 0) {
        const room = Math.max(0, cp[k] - run.res[k]);
        const q = Math.min(stock, room, Math.floor(run.res.rubles / bp));
        const qq = k === 'fuel' ? Math.floor(q) : q;
        if (ui.button(`fill_${k}`, bx + 1, yy, 'Llenar', { w: 9, disabled: qq < 1, tip: `Comprar ${qq} por ${Math.ceil(qq * bp)}₽` })) {
          const cost = Math.ceil(qq * bp);
          addRes(run, 'rubles', -cost);
          addRes(run, k, qq);
          mk.stock[k] -= qq;
          this.say(`Comprado: ${qq} ${R.name.toLowerCase()}`);
        }
      }
      yy += 2;
    }
    ui.mtext(x, yy + 1, '{x}Los precios suben a medida que os alejáis de Moscú. Cada lugar vende cosas distintas.{/}', C.o3, null, w);
  }

  drawModules(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const mk = this.mk;
    const half = Math.floor(w / 2) - 2;
    term.text(x, y, 'EN VENTA', C.o5, null, 1);
    let yy = y + 2;
    if (!mk.modules.length) term.text(x, yy, 'No hay módulos a la venta.', C.o2);
    for (const m of [...mk.modules]) {
      if (yy >= y + h - 2) break;
      const Q = QUALITY[m.q];
      const id = 'mbuy_' + m.id;
      const st = ui.region(id, x, yy, half - 12, 2, { cursor: 'help', sound: false });
      term.text(x, yy, MODTYPES[m.type].glyph, C.o5);
      ui.mtext(x + 2, yy, `{${Q.color === 'grey' ? 'x' : Q.color}}${modTitle(m)}{/}`, C.o6, null, half - 14);
      ui.mtext(x + 2, yy + 1, `{d}${MODTYPES[m.type].name} · ${Q.name} · ${Math.round((m.int / m.maxInt) * 100)}%{/}`, C.o4, null, half - 14);
      const installed = Object.values(run.ship.slots).find((s) => s && s.type === m.type);
      ui.tip(id, () => modLines(m, installed), { w: 46 });
      const can = run.res.rubles >= m.price;
      if (ui.button('bm_' + m.id, x + half - 11, yy, `${m.price}₽`, { w: 10, disabled: !can, accent: C.gold, tip: 'Comprar (va a la bodega; instálalo en el Hangar)' })) {
        addRes(run, 'rubles', -m.price);
        mk.modules = mk.modules.filter((z) => z !== m);
        delete m.price;
        run.inventory.push(m);
        this.say(`Comprado: ${m.name}`);
        if (m.suspicion) log(run, 'Material de procedencia dudosa en la bodega.', 'warn');
      }
      yy += 3;
    }
    const x2 = x + half + 4;
    term.text(x2, y, 'VUESTRA BODEGA', C.o5, null, 1);
    yy = y + 2;
    if (!run.inventory.length) term.text(x2, yy, 'La bodega no tiene módulos sueltos.', C.o2);
    for (const m of [...run.inventory]) {
      if (yy >= y + h - 2) break;
      const Q = QUALITY[m.q];
      const id = 'msell_' + m.id;
      ui.region(id, x2, yy, half - 12, 2, { cursor: 'help', sound: false });
      term.text(x2, yy, MODTYPES[m.type].glyph, C.o5);
      ui.mtext(x2 + 2, yy, `{${Q.color === 'grey' ? 'x' : Q.color}}${modTitle(m)}{/}`, C.o6, null, half - 14);
      ui.mtext(x2 + 2, yy + 1, `{d}${MODTYPES[m.type].name} · ${Q.name} · ${Math.round((m.int / m.maxInt) * 100)}%{/}`, C.o4, null, half - 14);
      ui.tip(id, () => modLines(m), { w: 46 });
      const price = modPrice(m, false);
      if (ui.button('sm_' + m.id, x2 + half - 11, yy, `+${price}₽`, { w: 10, tip: 'Vender' })) {
        addRes(run, 'rubles', price);
        run.inventory = run.inventory.filter((z) => z !== m);
        this.say(`Vendido: ${m.name} (+${price}₽)`);
      }
      yy += 3;
    }
  }

  drawRepairs(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const mk = this.mk;
    const cost = hullRepairCost(run, mk);
    let yy = y;
    term.text(x, yy, 'ESTRUCTURA', C.o5, null, 1);
    yy += 2;
    const avg = Object.values(run.ship.rooms).reduce((s, r) => s + r.int, 0) / Object.keys(run.ship.rooms).length;
    term.text(x, yy, 'Integridad media del casco', C.o4);
    ui.bar(x + 28, yy, 20, avg / 100, { fg: avg < 50 ? C.red : C.o5 });
    term.text(x + 50, yy, `${Math.round(avg)}%`, C.o6);
    if (ui.button('rep_hull', x + 58, yy, cost ? `Reparar (${cost}₽ · 1 h)` : 'Intacto', { w: 26, disabled: !cost || run.res.rubles < cost })) {
      addRes(run, 'rubles', -cost);
      for (const id in run.ship.rooms) run.ship.rooms[id].int = 100;
      passTime(run, 60);
      this.say('Casco reparado');
    }
    yy += 3;
    term.text(x, yy, 'MÓDULOS INSTALADOS', C.o5, null, 1);
    yy += 2;
    const L = layout();
    let total = 0;
    for (const s of L.slots) {
      const m = run.ship.slots[s.id];
      if (!m || m.int >= m.maxInt) continue;
      if (yy >= y + h - 3) break;
      const c = moduleRepairCost(m, mk);
      total += c;
      const k = m.int / m.maxInt;
      ui.mtext(x, yy, `${pad(s.name, 16)} {l}${m.name}{/}`, C.o4, null, 56);
      ui.bar(x + 58, yy, 12, k, { fg: k < 0.4 ? C.red : C.gold });
      if (ui.button('rm_' + m.id, x + 72, yy, `${c}₽`, { w: 9, disabled: run.res.rubles < c })) {
        addRes(run, 'rubles', -c);
        m.int = m.maxInt;
        passTime(run, 20);
        this.say(`${m.name} reparado`);
      }
      yy++;
    }
    if (!total) term.text(x, yy, 'Todos los módulos están en perfecto estado.', C.o3);
    else if (ui.button('rm_all', x, yy + 1, `Reparar todo (${total}₽)`, { w: 26, disabled: run.res.rubles < total })) {
      addRes(run, 'rubles', -total);
      for (const s of L.slots) {
        const m = run.ship.slots[s.id];
        if (m) m.int = m.maxInt;
      }
      passTime(run, 60);
      this.say('Todos los módulos reparados');
    }
    ui.mtext(x, y + h - 2, '{x}Las piezas de repuesto permiten a la tripulación reparar en vuelo; aquí lo hacen los mecánicos de tierra, a cambio de rublos.{/}', C.o3, null, w);
  }

  drawRecruits(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const mk = this.mk;
    const n = alive(run).length;
    ui.mtext(x, y, `Tripulación actual: {l}${n}/${MAX_CREW}{/} · Literas: {l}${run.ship.slots.dorm_lit?.stats.bunks || 0}{/}`, C.o4);
    let cx = x;
    let yy = y + 2;
    const cw = 44;
    for (const c of [...mk.recruits]) {
      if (cx + cw > x + w) {
        cx = x;
        yy += 16;
      }
      if (yy + 14 > y + h) break;
      ui.panel(cx, yy, cw - 2, 15, { title: displayName(c).slice(0, cw - 8), bg: C.bg2 });
      const face = miniFace(c);
      for (let j = 0; j < 3; j++) term.text(cx + 2, yy + 2 + j, face[j], C.o4);
      ui.mtext(cx + 9, yy + 2, `{l}${roleName(c)}{/}`, C.o4, null, cw - 12);
      ui.mtext(cx + 9, yy + 3, `{d}${c.age} años · ${c.origin}{/}`, C.o4, null, cw - 12);
      let sy = yy + 6;
      const sk = SKILLS.filter((s) => c.skills[s.id] > 0).sort((a, b) => c.skills[b.id] - c.skills[a.id]).slice(0, 4);
      for (const s of sk) {
        term.text(cx + 2, sy, pad(s.name, 12), C.o4);
        for (let i = 0; i < 10; i++) term.put(cx + 15 + i, sy, i < c.skills[s.id] ? '■' : '·', i < c.skills[s.id] ? C.o5 : C.o1);
        sy++;
      }
      for (const t of visibleTraits(c)) {
        if (sy >= yy + 13) break;
        const T = TRAITS[t];
        ui.mtext(cx + 2, sy++, `{${T.kind === 'pos' ? 'g' : 'r'}}• ${T.name}{/}`, C.o4, null, cw - 6);
      }
      const can = run.res.rubles >= c.price && n < MAX_CREW;
      if (ui.button('hire_' + c.id, cx + 2, yy + 13, `Contratar · ${c.price}₽`, { w: cw - 6, disabled: !can, accent: C.gold, tip: n >= MAX_CREW ? 'Tripulación completa' : null })) {
        addRes(run, 'rubles', -c.price);
        mk.recruits = mk.recruits.filter((z) => z !== c);
        delete c.price;
        c.joined = run.clock;
        run.crew.push(c);
        seedRelations(run, rng(run), c, 0.3);
        log(run, `${displayName(c)} se une a la tripulación.`, 'good');
        this.say(`${displayName(c)} contratado`);
      }
      ui.region('rtip_' + c.id, cx, yy, cw - 2, 12, { cursor: 'help', sound: false });
      ui.tip('rtip_' + c.id, () => crewTooltip(run, c), { w: 46 });
      cx += cw;
    }
  }

  drawHospital(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    let yy = y;
    let total = 0;
    for (const c of alive(run)) {
      const miss = maxHp(c) - c.hp;
      const cost = Math.ceil(miss * 0.6 + c.rad * 0.8 + (c.sick ? 20 : 0));
      total += cost;
      ui.mtext(x, yy, `${pad(displayName(c), 30)} {l}${Math.round(c.hp)}/${maxHp(c)}{/} ♥  {g}${Math.round(c.rad)}{/} ☢ ${c.sick ? '{r}fiebre{/}' : ''}`, C.o4, null, 70);
      if (cost > 0 && ui.button('heal_' + c.id, x + 72, yy, `Tratar ${cost}₽`, { w: 16, disabled: run.res.rubles < cost })) {
        addRes(run, 'rubles', -cost);
        c.hp = maxHp(c);
        c.rad = 0;
        c.sick = 0;
        passTime(run, 30);
        this.say(`${c.sur} tratado`);
      }
      yy += 2;
    }
    if (total > 0 && ui.button('heal_all', x, yy + 1, `Tratar a todos (${total}₽ · 2 h)`, { w: 34, disabled: run.res.rubles < total })) {
      addRes(run, 'rubles', -total);
      for (const c of alive(run)) {
        c.hp = maxHp(c);
        c.rad = 0;
        c.sick = 0;
      }
      passTime(run, 120);
      this.say('Tripulación tratada');
    }
  }
}
