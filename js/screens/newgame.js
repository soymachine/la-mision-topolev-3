// Nueva misión: dificultad, variante del avión, semilla y ranura de guardado.

import { C } from '../palette.js';
import { mix, pad } from '../engine/util.js';
import { Storage, SLOTS } from '../engine/storage.js';
import { DIFFICULTY, newRun, fmtClock } from '../game/run.js';
import { VARIANTS } from '../game/ship.js';
import { REGIONS } from '../game/data/regions.js';
import { saveGame } from '../game/save.js';

function randomSeed() {
  const syl = ['KA', 'RO', 'VO', 'LE', 'NI', 'TA', 'MI', 'SO', 'ZA', 'GO', 'RA', 'TU', 'PE', 'DI', 'BO'];
  let s = '';
  for (let i = 0; i < 3; i++) s += syl[Math.floor(Math.random() * syl.length)];
  return s + '-' + Math.floor(Math.random() * 90 + 10);
}

export class NewGameScreen {
  constructor(app) {
    this.app = app;
    this.diff = 'estajanovista';
    this.variant = 'topolev';
    this.seed = randomSeed();
    this.slot = 0;
    for (let i = 0; i < SLOTS; i++) {
      const inf = Storage.slotInfo(i);
      if (!inf || inf.summary?.over) {
        this.slot = i;
        break;
      }
    }
    this.confirm = false;
  }
  update() {}

  render() {
    const app = this.app;
    const { term, ui } = app;
    const W = term.cols;
    const H = term.rows;
    const pw = Math.min(W - 4, 128);
    const px = Math.floor((W - pw) / 2);
    let y = 2;
    term.text(px, y, '☭ NUEVA MISIÓN', C.o5, null, 1);
    term.text(px + pw - 26, y, 'ОКБ ТОПОЛЕВ · ПРИКАЗ', C.o2);
    y += 2;
    // dificultad
    term.text(px, y, 'DIFICULTAD', C.o3, null, 1);
    y += 1;
    const cw = Math.floor((pw - 4) / 3);
    let cx = px;
    for (const k of Object.keys(DIFFICULTY)) {
      const D = DIFFICULTY[k];
      const sel = this.diff === k;
      const id = 'diff_' + k;
      const st = ui.region(id, cx, y, cw, 6);
      const hv = ui.hoverT(id);
      ui.panel(cx, y, cw, 6, { title: D.name.toUpperCase(), fg: sel ? C.o5 : mix(C.o1, C.o3, hv), bg: sel ? C.bg3 : C.bg1, titleFg: sel ? C.o7 : C.o4 });
      ui.mwrap(cx + 2, y + 1, cw - 4, `{d}${D.desc}{/}`, C.o4, { maxLines: 3 });
      ui.mtext(cx + 2, y + 4, `Plazo {l}${D.days} días{/}`, C.o3, null, cw - 4);
      if (st.clicked) this.diff = k;
      cx += cw + 2;
    }
    y += 8;
    // variante
    term.text(px, y, 'AVIÓN', C.o3, null, 1);
    y += 1;
    cx = px;
    const unlocked = app.meta.unlocked?.variants || ['topolev'];
    for (const k of Object.keys(VARIANTS)) {
      const V = VARIANTS[k];
      const ok = unlocked.includes(k);
      const sel = this.variant === k;
      const id = 'var_' + k;
      const st = ui.region(id, cx, y, cw, 7, { cursor: ok ? 'pointer' : 'not-allowed' });
      const hv = ui.hoverT(id);
      ui.panel(cx, y, cw, 7, { title: ok ? V.name : '▒ BLOQUEADO ▒', fg: sel ? C.o5 : mix(C.o1, C.o3, hv), bg: sel ? C.bg3 : C.bg1, titleFg: ok ? (sel ? C.o7 : C.o4) : C.grey2 });
      if (ok) ui.mwrap(cx + 2, y + 1, cw - 4, `{d}${V.desc}{/}`, C.o4, { maxLines: 5 });
      else ui.mwrap(cx + 2, y + 2, cw - 4, `{x}Para desbloquear: ${V.unlock}.{/}`, C.o4, { maxLines: 3 });
      if (st.clicked && ok) this.variant = k;
      cx += cw + 2;
    }
    y += 9;
    // semilla
    term.text(px, y, 'SEMILLA DEL MUNDO', C.o3, null, 1);
    this.seed = ui.textInput('seed', px + 20, y, 24, this.seed, { max: 20, upper: true, filter: /[A-Za-z0-9-]/ });
    if (ui.button('reroll', px + 46, y, '⟳ Otra', { w: 10, tip: 'Semilla aleatoria' })) this.seed = randomSeed();
    ui.mtext(px + 58, y, '{x}La misma semilla genera el mismo mundo. Compártela.{/}', C.o3, null, pw - 58);
    y += 3;
    // ranura
    term.text(px, y, 'EXPEDIENTE (RANURA)', C.o3, null, 1);
    y += 1;
    cx = px;
    for (let i = 0; i < SLOTS; i++) {
      const inf = Storage.slotInfo(i);
      const sel = this.slot === i;
      const id = 'slot_' + i;
      const st = ui.region(id, cx, y, cw, 4);
      const hv = ui.hoverT(id);
      ui.panel(cx, y, cw, 4, { title: `Nº ${i + 1}`, fg: sel ? C.o5 : mix(C.o1, C.o3, hv), bg: sel ? C.bg3 : C.bg1 });
      if (inf && inf.summary) {
        const s = inf.summary;
        ui.mtext(cx + 2, y + 1, s.over ? '{x}Misión terminada{/}' : `{l}Región ${REGIONS[s.region]?.roman || '?'}{/} · Día ${s.day} · ${s.crew} trip.`, C.o4, null, cw - 4);
        ui.mtext(cx + 2, y + 2, `{x}${new Date(inf.savedAt).toLocaleString('es-ES')}{/}`, C.o4, null, cw - 4);
      } else ui.mtext(cx + 2, y + 1, '{x}Vacío{/}', C.o4);
      if (st.clicked) this.slot = i;
      cx += cw + 2;
    }
    y += 6;
    const occupied = Storage.slotInfo(this.slot);
    if (ui.button('start', px, y, '★ COMENZAR LA MISIÓN', { w: 30, key: 'Enter', accent: C.gold })) {
      if (occupied && !occupied.summary?.over && !this.confirm) this.confirm = true;
      else this.start();
    }
    if (ui.button('ng_back', px + pw - 16, y, 'Volver', { w: 16, key: 'Escape' })) app.go('title');
    if (this.confirm) ui.mtext(px + 32, y, '{r}Esa ranura tiene una misión en curso. Pulsa otra vez para sobrescribirla.{/}', C.o4, null, pw - 50);
  }

  start() {
    const app = this.app;
    const run = newRun({ seed: this.seed || randomSeed(), difficulty: this.diff, variant: this.variant });
    app.run = run;
    app.slot = this.slot;
    saveGame(app);
    app.audio.play('stamp');
    app.go('event', { briefing: true, dur: 0.9 });
  }
}
