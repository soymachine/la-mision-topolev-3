// Archivo del Kremlin: historial de expedientes, logros y desbloqueos.

import { C } from '../palette.js';
import { pad, padL } from '../engine/util.js';
import { ACHIEVEMENTS } from '../game/achievements.js';
import { DIFFICULTY } from '../game/run.js';
import { VARIANTS } from '../game/ship.js';

export class ArchiveScreen {
  constructor(app) {
    this.app = app;
  }
  update() {}

  render() {
    const app = this.app;
    const { term, ui } = app;
    const meta = app.meta;
    const W = term.cols;
    const H = term.rows;
    const pw = Math.min(W - 4, 150);
    const px = Math.floor((W - pw) / 2);
    let y = 2;
    term.text(px, y, '☭ ARCHIVO DEL KREMLIN', C.o5, null, 1);
    term.text(px + pw - 30, y, 'АРХИВ · ДЛЯ СЛУЖЕБНОГО ПОЛЬЗОВАНИЯ', C.o2);
    y += 2;
    const t = meta.totals || { runs: 0, wins: 0, deaths: 0, km: 0 };
    ui.mtext(px, y, `Misiones: {l}${t.runs}{/} · Cumplidas: {l}${t.wins}{/} · Tripulantes caídos: {l}${t.deaths}{/} · Kilómetros: {l}${t.km}{/}`, C.o4);
    y += 2;
    const lw = Math.floor(pw * 0.62);
    ui.panel(px, y, lw, H - y - 4, { title: 'EXPEDIENTES' });
    const runs = meta.runs || [];
    let yy = y + 1;
    term.text(px + 2, yy, pad('Fecha', 12) + pad('Final', 34) + pad('Dific.', 14) + padL('Puntos', 7) + '  Semilla', C.o3);
    yy += 2;
    const off = ui.beginScroll('archlist', px + 1, yy, lw - 3, H - yy - 6, runs.length);
    let ry = yy - off;
    for (const r of runs) {
      const col = r.kind === 'win' ? C.o6 : C.grey;
      term.text(px + 2, ry, pad(new Date(r.date).toLocaleDateString('es-ES'), 12), C.o3);
      term.text(px + 14, ry, pad(r.title, 33), col);
      term.text(px + 48, ry, pad(DIFFICULTY[r.difficulty]?.name || '', 13), C.o4);
      term.text(px + 62, ry, padL(r.score, 6), C.gold);
      term.text(px + 70, ry, String(r.seed).slice(0, lw - 74), C.o2);
      ry++;
    }
    ui.endScroll();
    if (!runs.length) term.text(px + 2, yy, 'Todavía no hay expedientes archivados.', C.o2);
    // logros
    const ax = px + lw + 2;
    const aw = pw - lw - 2;
    ui.panel(ax, y, aw, H - y - 4, { title: 'LOGROS Y DESBLOQUEOS' });
    let ay = y + 1;
    for (const id of Object.keys(ACHIEVEMENTS)) {
      if (ay >= H - 6) break;
      const A = ACHIEVEMENTS[id];
      const got = meta.achievements && meta.achievements[id];
      const rid = 'ach_' + id;
      ui.region(rid, ax + 1, ay, aw - 2, 1, { cursor: 'help', sound: false });
      ui.tip(rid, [`{O}${A.name}{/}`, A.desc]);
      ui.mtext(ax + 2, ay++, got ? `{y}★{/} {l}${A.name}{/}` : `{x}☆ ${A.name}{/}`, C.o4, null, aw - 4);
    }
    ay++;
    for (const k of Object.keys(VARIANTS)) {
      if (ay >= H - 5) break;
      const ok = meta.unlocked?.variants?.includes(k);
      ui.mtext(ax + 2, ay++, ok ? `{g}▲{/} ${VARIANTS[k].name}` : `{x}▒ ${VARIANTS[k].name}: ${VARIANTS[k].unlock}{/}`, C.o4, null, aw - 4);
    }
    if (ui.button('ar_back', px, H - 2, 'Volver', { w: 14, key: 'Escape' })) app.go('title');
  }
}
