// Cargar expediente.

import { C } from '../palette.js';
import { mix } from '../engine/util.js';
import { Storage, SLOTS } from '../engine/storage.js';
import { REGIONS } from '../game/data/regions.js';
import { DIFFICULTY } from '../game/run.js';
import { VARIANTS } from '../game/ship.js';
import { loadGame } from '../game/save.js';

export function resumeRun(app) {
  const run = app.run;
  if (run.over) return app.go('gameover');
  switch (run.phase) {
    case 'flight':
      if (run.flight) return app.go('flight');
      return app.go('map');
    case 'arrive':
      if (run.flight) return app.go('event', { arrival: true });
      return app.go('map');
    case 'event':
      if (run.event) return app.go('event');
      return app.go('map');
    case 'brief':
      return app.go('event', { briefing: true });
    case 'station':
      return app.go('station', { back: 'map' });
    default:
      return app.go('map');
  }
}

export class LoadScreen {
  constructor(app, opts) {
    this.app = app;
    this.err = null;
    this.confirmDel = null;
    if (opts.autoload != null) {
      setTimeout(() => this.load(opts.autoload), 0);
    }
  }
  update() {}

  load(i) {
    const run = loadGame(this.app, i);
    if (!run) {
      this.err = 'No se pudo cargar el expediente (¿versión antigua?).';
      this.app.audio.play('deny');
      return;
    }
    this.app.audio.play('success');
    resumeRun(this.app);
  }

  render() {
    const app = this.app;
    const { term, ui } = app;
    const W = term.cols;
    const H = term.rows;
    const pw = Math.min(W - 4, 100);
    const px = Math.floor((W - pw) / 2);
    let y = 3;
    term.text(px, y, '☭ EXPEDIENTES GUARDADOS', C.o5, null, 1);
    y += 3;
    for (let i = 0; i < SLOTS; i++) {
      const inf = Storage.slotInfo(i);
      ui.panel(px, y, pw, 7, { title: `EXPEDIENTE Nº ${i + 1}`, fg: inf ? C.o3 : C.o1 });
      if (inf && inf.summary) {
        const s = inf.summary;
        const R = REGIONS[s.region];
        ui.mtext(px + 3, y + 1, `{l}${s.over ? 'MISIÓN TERMINADA' : `Región ${R?.roman} · ${R?.name}`}{/}   Día ${s.day} · ${s.crew} tripulantes · Sospecha ${s.suspicion ?? '?'}%`, C.o4, null, pw - 6);
        ui.mtext(px + 3, y + 2, `{d}${s.node || ''}{/}`, C.o4, null, pw - 6);
        ui.mtext(px + 3, y + 3, `{x}${DIFFICULTY[s.difficulty]?.name || ''} · ${VARIANTS[s.variant]?.name || ''} · Semilla ${s.seed} · ${new Date(inf.savedAt).toLocaleString('es-ES')}{/}`, C.o4, null, pw - 6);
        if (ui.button('load_' + i, px + 3, y + 5, s.over ? 'Ver final' : 'Cargar', { w: 14, key: String(i + 1) })) this.load(i);
        if (this.confirmDel === i) {
          if (ui.button('delc_' + i, px + pw - 36, y + 5, '¿Seguro? Borrar', { w: 18, danger: true })) {
            Storage.deleteSlot(i);
            this.confirmDel = null;
          }
          if (ui.button('deln_' + i, px + pw - 17, y + 5, 'No', { w: 14 })) this.confirmDel = null;
        } else if (ui.button('del_' + i, px + pw - 17, y + 5, 'Borrar', { w: 14, danger: true })) this.confirmDel = i;
      } else ui.mtext(px + 3, y + 2, '{x}Vacío{/}', C.o4);
      y += 8;
    }
    if (this.err) ui.mtext(px, y, `{r}${this.err}{/}`, C.o4);
    if (ui.button('ld_back', px, H - 3, 'Volver', { w: 14, key: 'Escape' })) app.go('title');
  }
}
