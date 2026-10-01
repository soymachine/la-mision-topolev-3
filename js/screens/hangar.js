// Hangar: instalar y desinstalar módulos arrastrándolos (estilo Cogmind), bodega y taller.

import { C } from '../palette.js';
import { mix, clamp, pad, padL } from '../engine/util.js';
import { layout, shipStats, capacities, SLOT_DEFS } from '../game/ship.js';
import { addRes, addSuspicion, log, caps, alive, RES } from '../game/run.js';
import { modLines, modTitle, scrapValue, fmtStat, STAT_INFO } from '../game/loot.js';
import { MODTYPES, QUALITY } from '../game/data/modules.js';
import { estimateSpeed, THROTTLE } from '../game/flight.js';
import { passTime } from '../game/nodes.js';
import { RECIPES, addOrder, cancelOrder } from '../game/stations.js';
import { saveGame } from '../game/save.js';
import { ShipView } from './ui/shipview.js';
import { resourceBar, suspicionMeter, clockWidget, sectionTitle } from './ui/common.js';

const INSTALL_MIN = 20;

export class HangarScreen {
  constructor(app) {
    this.app = app;
    this.ship = new ShipView(app);
    this.hoverSlot = null;
    this.msg = null;
    this.msgT = 0;
  }
  get run() {
    return this.app.run;
  }
  update(dt) {
    this.msgT -= dt;
  }
  say(t, ok = true) {
    this.msg = { t, ok };
    this.msgT = 3;
  }

  install(slotId, mod, fromInv) {
    const run = this.run;
    const def = SLOT_DEFS.find((s) => s.id === slotId);
    if (!def || def.type !== mod.type) return;
    const prev = run.ship.slots[slotId];
    if (fromInv) run.inventory = run.inventory.filter((m) => m !== mod);
    else {
      // de otra ranura
      for (const k in run.ship.slots) if (run.ship.slots[k] === mod) run.ship.slots[k] = null;
    }
    run.ship.slots[slotId] = mod;
    if (prev && prev !== mod) {
      if (fromInv) run.inventory.push(prev);
      else {
        // intercambio entre ranuras
        const from = Object.keys(run.ship.slots).find((k) => k !== slotId && run.ship.slots[k] === null && SLOT_DEFS.find((s) => s.id === k).type === prev.type);
        if (from) run.ship.slots[from] = prev;
        else run.inventory.push(prev);
      }
    }
    if (mod.suspicion && !mod.installedOnce) {
      addSuspicion(run, mod.suspicion, `Instalado material comprometedor: ${mod.name}`);
    }
    mod.installedOnce = true;
    passTime(run, INSTALL_MIN);
    this.app.particles.ring(this.app.input.m.fx, this.app.input.m.fy, 12, C.o5, 6);
    this.say(`Instalado: ${mod.name} (${INSTALL_MIN} min)`);
  }

  uninstall(slotId) {
    const run = this.run;
    const m = run.ship.slots[slotId];
    if (!m) return;
    run.ship.slots[slotId] = null;
    run.inventory.push(m);
    passTime(run, INSTALL_MIN / 2);
    this.say(`Desmontado: ${m.name}`);
  }

  scrap(mod, fromSlot) {
    const run = this.run;
    if (fromSlot) run.ship.slots[fromSlot] = null;
    else run.inventory = run.inventory.filter((m) => m !== mod);
    const v = scrapValue(mod);
    addRes(run, 'parts', v);
    this.app.particles.sparks(this.app.input.m.fx, this.app.input.m.fy, 20);
    this.app.audio.play('hit');
    this.say(`Desguazado: ${mod.name} (+${v} piezas)`);
  }

  render() {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const W = term.cols;
    const H = term.rows;
    const L = layout();
    term.fill(0, 0, W, 2, ' ', C.o4, C.bg2);
    term.text(1, 0, '☭', C.red);
    term.text(3, 0, 'HANGAR · ' + run.ship.name.toUpperCase(), C.o5, null, 1);
    clockWidget(app, 6 + 9 + run.ship.name.length, 0, run);
    resourceBar(app, 1, 1, run);
    suspicionMeter(app, W - 30, 1, run, 12);
    if (ui.button('hg_back', W - 22, 0, 'Volver al mapa', { w: 20, key: 'Escape', accent: C.gold })) {
      saveGame(app);
      app.go('map');
      return;
    }

    // nave arriba con la sala de la ranura resaltada
    const statsW = 34;
    const sx = Math.max(1, Math.floor((W - statsW - 92) / 2));
    const hovRoom = this.hoverSlot ? SLOT_DEFS.find((s) => s.id === this.hoverSlot)?.room : null;
    this.ship.render(run, sx, 3, { hoverRoom: hovRoom !== 'fuselaje' ? hovRoom : null });
    this.drawStats(W - statsW - 1, 3, statsW, 19);

    // ranuras
    const top = 23;
    const listH = H - top - 1;
    const colW = Math.floor((W - 4) * 0.62 / 2);
    ui.panel(1, top - 1, colW * 2 + 2, listH + 1, { title: 'RANURAS DE MÓDULO', footer: '{x}arrastra módulos entre ranuras y bodega{/}' });
    this.hoverSlot = null;
    let i = 0;
    const perCol = Math.ceil(SLOT_DEFS.length / 2);
    for (const s of SLOT_DEFS) {
      const col = Math.floor(i / perCol);
      const row = i % perCol;
      const x = 2 + col * colW;
      const y = top + row;
      if (y >= top + listH - 1) {
        i++;
        continue;
      }
      this.drawSlot(s, x, y, colW - 1);
      i++;
    }

    // bodega
    const bx = 3 + colW * 2 + 1;
    const bw = W - bx - 1;
    const bh = listH - 8;
    ui.panel(bx, top - 1, bw, bh + 1, { title: `BODEGA (${run.inventory.length})` });
    const dtInv = ui.dropTarget('inv_drop', bx, top - 1, bw, bh + 1, (p) => p.kind === 'mod' && p.from === 'slot');
    if (dtInv.over && dtInv.accepts) term.fillBg(bx + 1, top, bw - 2, bh - 1, mix(C.bg1, C.o1, 0.5));
    if (dtInv.dropped) this.uninstall(dtInv.dropped.slot);
    const off = ui.beginScroll('invlist', bx + 1, top, bw - 3, bh - 1, run.inventory.length * 2);
    let yy = top - off;
    for (const m of run.inventory) {
      if (yy >= top - 1 && yy < top + bh) this.drawInvItem(m, bx + 1, yy, bw - 3);
      yy += 2;
    }
    ui.endScroll();
    if (!run.inventory.length) ui.mtext(bx + 2, top + 1, '{x}Vacía. Compra módulos en aeródromos y ciudades, o rescátalos de restos.{/}', C.o3, null, bw - 4);

    // desguace y taller
    const dy = top + bh + 1;
    const scrapW = 22;
    ui.panel(bx, dy - 1, scrapW, 7, { title: 'DESGUACE', fg: C.red2 });
    const dtS = ui.dropTarget('scrap_drop', bx, dy - 1, scrapW, 7, (p) => p.kind === 'mod');
    const hot = dtS.over && dtS.accepts;
    term.text(bx + 2, dy + 1, hot ? '▼ SOLTAR AQUÍ ▼' : '  ╲╱ ╲╱ ╲╱  ', hot ? C.red : C.o2);
    ui.mtext(bx + 2, dy + 3, '{x}Módulo → piezas{/}', C.o3);
    if (hot) term.fillBg(bx + 1, dy, scrapW - 2, 5, mix(C.bg1, C.redD, 0.7));
    if (dtS.dropped) {
      const p = dtS.dropped;
      if (p.from === 'slot') this.scrap(run.ship.slots[p.slot], p.slot);
      else this.scrap(run.inventory.find((m) => m.id === p.id), null);
    }
    // órdenes de taller con objetivo
    const tx = bx + scrapW + 1;
    const tw = W - tx - 1;
    ui.panel(tx, dy - 1, tw, 7, { title: 'TALLER DE A BORDO' });
    const dtR = ui.dropTarget('repair_drop', tx, dy - 1, tw, 7, (p) => p.kind === 'mod' && p.from === 'inv');
    if (dtR.over && dtR.accepts) term.fillBg(tx + 1, dy, tw - 2, 5, mix(C.bg1, C.o1, 0.6));
    if (dtR.dropped) {
      const m = run.inventory.find((z) => z.id === dtR.dropped.id);
      if (m && m.int < m.maxInt && addOrder(run, 'reparar', m.id)) this.say(`Orden de reparación: ${m.name}`);
      else this.say('Ese módulo no necesita reparación', false);
    }
    let oy = dy;
    ui.mtext(tx + 2, oy++, '{x}Suelta aquí un módulo dañado de la bodega para repararlo en vuelo.{/}', C.o3, null, tw - 4);
    for (const o of run.orders.slice(0, 3)) {
      const R = RECIPES[o.recipe];
      const tgt = o.target ? run.inventory.find((m) => m.id === o.target) : null;
      ui.mtext(tx + 2, oy, `· {l}${R.name}{/} ${tgt ? tgt.name.slice(0, tw - 30) : ''}`, C.o4, null, tw - 8);
      if (ui.button('hco_' + o.id, tx + tw - 5, oy, '×', { w: 3, style: 'plain', danger: true })) cancelOrder(run, o.id);
      oy++;
    }
    if (this.msg && this.msgT > 0) term.text(2, H - 1, ` ${this.msg.t} `, this.msg.ok ? C.rad : C.red, '#000000');
    else term.text(2, H - 1, `Instalar o desmontar cuesta ${INSTALL_MIN} minutos. Pasa el ratón para comparar.`, C.o2);
  }

  drawSlot(s, x, y, w) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const m = run.ship.slots[s.id];
    const id = 'slot_' + s.id;
    const drag = ui.dragging;
    const st = m
      ? ui.draggable(id, x, y, w, 1, { kind: 'mod', from: 'slot', slot: s.id, type: m.type }, { label: `${MODTYPES[m.type].glyph} ${m.name}`, fg: C.o7 })
      : ui.region(id, x, y, w, 1, { sound: false, cursor: 'default' });
    const dt = ui.dropTarget(id + '_d', x, y, w, 1, (p) => p.kind === 'mod' && p.type === s.type && !(p.from === 'slot' && p.slot === s.id));
    if (st.hot || (dt.over && dt.accepts)) this.hoverSlot = s.id;
    const hv = ui.hoverT(id);
    let bg = null;
    if (drag && dt.accepts) bg = mix(C.bg2, C.o1, 0.4 + 0.3 * Math.sin(app.time * 6));
    if (dt.over && dt.accepts) bg = C.o2;
    else if (hv > 0.1) bg = C.bg3;
    if (bg) term.fillBg(x, y, w, 1, bg);
    const roomName = s.room === 'fuselaje' ? 'Fuselaje' : layout().rooms[s.room].short;
    term.text(x, y, MODTYPES[s.type].glyph, m ? C.o5 : C.o1);
    term.text(x + 2, y, pad(roomName.slice(0, 9), 9), C.o2);
    if (m) {
      const Q = QUALITY[m.q];
      const qc = Q.color === 'grey' ? C.grey : Q.color === 'l' ? C.o6 : Q.color === 'v' ? C.violet : Q.color === 'y' ? C.gold : C.o5;
      term.text(x + 12, y, pad(m.name, w - 20), qc);
      const k = m.int / m.maxInt;
      ui.bar(x + w - 7, y, 6, k, { fg: k < 0.4 ? C.red : k < 0.75 ? C.gold : C.o4, style: 'line' });
      ui.tip(id, () => modLines(m), { w: 46 });
    } else {
      term.text(x + 12, y, pad(`— ${s.name.toLowerCase()} vacío —`, w - 14), C.o1);
      ui.tip(id, [`{O}Ranura: ${s.name}{/}`, `Acepta: ${MODTYPES[s.type].name}`, `{d}${MODTYPES[s.type].desc}{/}`]);
    }
    if (dt.dropped) {
      const p = dt.dropped;
      const mod = p.from === 'inv' ? run.inventory.find((z) => z.id === p.id) : run.ship.slots[p.slot];
      if (mod) this.install(s.id, mod, p.from === 'inv');
    }
    if (st.rclicked && m) this.uninstall(s.id);
  }

  drawInvItem(m, x, y, w) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const id = 'inv_' + m.id;
    const st = ui.draggable(id, x, y, w, 2, { kind: 'mod', from: 'inv', id: m.id, type: m.type }, { label: `${MODTYPES[m.type].glyph} ${m.name}`, fg: C.o7 });
    const hv = ui.hoverT(id);
    if (hv > 0.1) term.fillBg(x, y, w, 2, C.bg3);
    const Q = QUALITY[m.q];
    term.text(x + 1, y, MODTYPES[m.type].glyph, C.o5);
    ui.mtext(x + 3, y, `{${Q.color === 'grey' ? 'x' : Q.color}}${modTitle(m)}{/}`, C.o6, null, w - 4);
    const k = m.int / m.maxInt;
    ui.mtext(x + 3, y + 1, `{d}${MODTYPES[m.type].name}${m.sub ? '' : ''} · ${Q.name} · ${Math.round(k * 100)}%{/}`, C.o4, null, w - 4);
    const installed = Object.entries(run.ship.slots).find(([sid, s]) => SLOT_DEFS.find((d) => d.id === sid).type === m.type)?.[1];
    ui.tip(id, () => {
      const L = modLines(m, installed || null);
      if (installed) L.push('', `{x}Comparado con: ${installed.name}{/}`);
      L.push('{x}Arrastra a una ranura compatible para instalarlo.{/}');
      return L;
    }, { w: 48 });
    if (st.dbl) {
      // instalar en la primera ranura compatible (vacía o no)
      const slot = SLOT_DEFS.find((s) => s.type === m.type && !run.ship.slots[s.id]) || SLOT_DEFS.find((s) => s.type === m.type);
      if (slot) this.install(slot.id, m, true);
    }
  }

  drawStats(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const st = shipStats(run.ship);
    const cp = capacities(st);
    ui.panel(x, y, w, h, { title: 'PRESTACIONES' });
    const rows = [
      ['Velocidad', `${Math.round(estimateSpeed(run, st))} km/h`],
      ['Consumo', `${st.engines.reduce((s, id) => s + run.ship.slots[id].stats.fuel, 0).toFixed(2)} t/h`],
      ['Energía', `${st.power} u`],
      ['Masa', `${Math.round(st.mass)} t`],
      ['Blindaje', st.armor.toFixed(1)],
      ['Evasión', `${Math.round(st.evasion * 100)}%`],
      ['Literas', String(st.bunks)],
      ['Comidas/tanda', String(st.meals)],
      ['Aviso radar', `${Math.round(st.warn)} s`],
      ['Reconocim.', String(Math.round(st.range))],
      ['Depósito', `${cp.fuel} t`],
      ['Raciones máx.', String(cp.rations)],
      ['Piezas máx.', String(cp.parts)],
      ['Munición máx.', String(cp.ammo)],
      ['Moral (objetos)', `${st.morale >= 0 ? '+' : ''}${st.morale}`],
    ];
    let yy = y + 1;
    for (const [k, v] of rows) {
      if (yy >= y + h - 1) break;
      term.text(x + 2, yy, k, C.o3);
      term.text(x + w - 2 - v.length, yy, v, C.o6);
      yy++;
    }
  }
}
