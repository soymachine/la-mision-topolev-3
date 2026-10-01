// Tripulación: matriz de prioridades de trabajo y expedientes.

import { C } from '../palette.js';
import { mix, clamp, pad, padL } from '../engine/util.js';
import { alive, log, addSuspicion } from '../game/run.js';
import { displayName, roleName, miniFace, faceState, defaultPriorities, maxHp, visibleTraits } from '../game/crew.js';
import { CATS, SKILL, TRAITS } from '../game/data/traits.js';
import { POLICIES } from '../game/fcore.js';
import { saveGame } from '../game/save.js';
import { drawDossier } from './ui/dossier.js';
import { resourceBar, suspicionMeter, clockWidget } from './ui/common.js';
import { crewTooltip } from './ui/crewcards.js';

export class CrewScreen {
  constructor(app, opts) {
    this.app = app;
    this.back = opts.back || 'map';
    this.dossier = null;
    this.confirm = null;
  }
  get run() {
    return this.app.run;
  }
  update() {}

  render() {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const W = term.cols;
    const H = term.rows;
    term.fill(0, 0, W, 2, ' ', C.o4, C.bg2);
    term.text(1, 0, '☭', C.red);
    term.text(3, 0, 'TRIPULACIÓN · PRIORIDADES DE TRABAJO', C.o5, null, 1);
    resourceBar(app, 1, 1, run);
    suspicionMeter(app, W - 30, 1, run, 12);
    if (ui.button('cr_back', W - 22, 0, 'Volver', { w: 20, key: 'Escape', accent: C.gold })) {
      if (this.dossier) this.dossier = null;
      else {
        saveGame(app);
        app.go(this.back);
        return;
      }
    }
    const crew = alive(run);
    const nameW = 30;
    const cellW = 6;
    const tw = nameW + CATS.length * cellW + 4;
    const x0 = Math.max(1, Math.floor((W - tw) / 2));
    const y0 = 4;
    ui.panel(x0 - 1, y0 - 1, tw + 2, crew.length * 2 + 6, { title: 'MATRIZ DE PRIORIDADES' });
    // cabeceras
    for (let i = 0; i < CATS.length; i++) {
      const c = CATS[i];
      const hx = x0 + nameW + i * cellW;
      const id = 'hdr_' + c.id;
      ui.region(id, hx, y0, cellW, 1, { cursor: 'help', sound: false });
      term.text(hx + 1, y0, c.short.toUpperCase(), ui.isHot(id) ? C.o7 : C.o5, null, 1);
      ui.tip(id, [`{O}${c.name}{/}`, c.desc, `Habilidad: {l}${SKILL[c.skill].name}{/}`]);
    }
    let y = y0 + 2;
    for (const c of crew) {
      const rid = 'row_' + c.id;
      const st = ui.region(rid, x0, y, nameW - 1, 1);
      const face = miniFace(c, faceState(c));
      term.text(x0, y, face[1], C.o4);
      term.text(x0 + 6, y, pad(displayName(c), nameW - 7), st.hot ? C.o7 : C.o6);
      ui.mtext(x0 + 6, y + 1, `{x}${roleName(c)}{/}`, C.o3, null, nameW - 7);
      ui.tip(rid, () => crewTooltip(run, c), { w: 46 });
      if (st.clicked) this.dossier = c.id;
      for (let i = 0; i < CATS.length; i++) {
        const cat = CATS[i];
        const cx = x0 + nameW + i * cellW;
        const id = `cell_${c.id}_${cat.id}`;
        const cs = ui.region(id, cx, y, cellW - 1, 1, { sound: false });
        const hv = ui.hoverT(id);
        const v = c.pri[cat.id] ?? 0;
        const sk = c.skills[cat.skill] || 0;
        const bg = mix(C.bg1, C.o1, sk / 10);
        const col = v === 1 ? C.o7 : v === 2 ? C.o5 : v === 3 ? C.o3 : C.grey2;
        term.fill(cx, y, cellW - 1, 1, ' ', col, hv > 0.2 ? C.bg4 : bg);
        term.text(cx + 1, y, v ? String(v) : '–', col, null, v === 1 ? 1 : 0);
        term.text(cx + 3, y, padL(sk, 2), C.o2);
        if (cs.clicked) {
          c.pri[cat.id] = v === 0 ? 1 : v === 3 ? 0 : v + 1;
          app.audio.play('click');
        }
        if (cs.rclicked) c.pri[cat.id] = v === 1 ? 0 : v === 0 ? 3 : v - 1;
        ui.tip(id, [`{O}${displayName(c)} · ${cat.name}{/}`, `Prioridad: {l}${v ? v : 'nunca'}{/} · Habilidad ${SKILL[cat.skill].name}: {l}${sk}{/}`, '{x}Clic: 1→2→3→nunca · Clic derecho: al revés{/}'], { delay: 0.5 });
      }
      // acciones por fila
      if (ui.button('reset_' + c.id, x0 + nameW + CATS.length * cellW, y, '↺', { w: 3, style: 'plain', tip: 'Restablecer prioridades según habilidades' })) c.pri = defaultPriorities(c);
      y += 2;
    }
    y += 1;
    ui.mtext(x0, y, '{d}1{/} alta · {d}2{/} media · {d}3{/} baja · {d}–{/} nunca. El número pequeño es la habilidad. {x}Clic en un nombre: expediente.{/}', C.o4, null, tw);
    y += 3;
    // política de turnos
    term.text(x0, y, 'POLÍTICA DE TURNOS', C.o5, null, 1);
    y += 2;
    for (const k of Object.keys(POLICIES)) {
      const P = POLICIES[k];
      if (ui.button('cpol_' + k, x0, y, P.name, { w: 20, style: 'tab', selected: run.policy === k })) run.policy = k;
      ui.mtext(x0 + 22, y, `{x}${P.desc} (dormir ≥${P.sleep}, comer ≥${P.eat}){/}`, C.o4, null, tw - 24);
      y += 2;
    }
    // licenciar
    y += 1;
    if (y < H - 4) {
      term.text(x0, y, 'LICENCIAR TRIPULANTES', C.o5, null, 1);
      y += 2;
      let bx = x0;
      for (const c of crew) {
        const lbl = `× ${c.sur}`;
        if (bx + lbl.length + 4 > x0 + tw) {
          bx = x0;
          y += 2;
        }
        if (y >= H - 2) break;
        if (ui.button('fire_' + c.id, bx, y, lbl, { w: lbl.length + 4, danger: true, tip: `Desembarcar a ${displayName(c)} en esta parada. No volverá.` })) this.confirm = c.id;
        bx += lbl.length + 5;
      }
    }
    if (this.dossier) {
      ui.beginModal(0.65);
      const c = run.crew.find((x) => x.id === this.dossier);
      if (drawDossier(app, run, c)) this.dossier = null;
      ui.endModal();
    }
    if (this.confirm) this.drawConfirm();
  }

  drawConfirm() {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const c = run.crew.find((x) => x.id === this.confirm);
    const W = term.cols;
    const H = term.rows;
    const pw = 56;
    const ph = 9;
    const px = Math.floor((W - pw) / 2);
    const py = Math.floor((H - ph) / 2);
    ui.beginModal(0.7);
    ui.panel(px, py, pw, ph, { title: 'LICENCIAR', style: 'double', shadow: true });
    ui.mwrap(px + 3, py + 2, pw - 6, `¿Desembarcar a {O}${displayName(c)}{/}? Se quedará en tierra para siempre. La tripulación lo notará.`, C.o6);
    if (ui.button('cf_yes', px + 3, py + ph - 2, 'Desembarcar', { w: 16, danger: true })) {
      c.dead = true;
      c.removed = true;
      c.cause = 'licenciado';
      c.diedAt = run.clock;
      for (const o of alive(run)) o.morale = clamp(o.morale - 5, 0, 100);
      log(run, `${displayName(c)} abandona la tripulación.`, 'warn');
      this.confirm = null;
    }
    if (ui.button('cf_no', px + pw - 19, py + ph - 2, 'Cancelar', { w: 16, key: 'Escape' })) this.confirm = null;
    ui.endModal();
  }
}
