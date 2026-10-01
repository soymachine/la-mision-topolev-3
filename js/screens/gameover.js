// Final de la misión (victoria o derrota).

import { C } from '../palette.js';
import { mix } from '../engine/util.js';
import { ART } from '../game/data/art.js';
import { ENDINGS, computeScore } from '../game/data/finale.js';
import { alive, fmtClock, DIFFICULTY } from '../game/run.js';
import { displayName } from '../game/crew.js';
import { recordRun, ACHIEVEMENTS } from '../game/achievements.js';
import { saveGame } from '../game/save.js';

export class GameOverScreen {
  constructor(app) {
    this.app = app;
    this.reveal = 0;
    this.t = 0;
  }
  get run() {
    return this.app.run;
  }

  enter() {
    const run = this.run;
    if (!run || !run.over) {
      this.app.go('title');
      return;
    }
    run.phase = 'over';
    this.result = recordRun(this.app, run) || { score: computeScore(run), got: [], unlockedNow: [] };
    saveGame(this.app);
    const E = ENDINGS[run.over.ending];
    this.app.audio.play(E.kind === 'win' ? 'success' : 'fail');
  }

  update(dt) {
    this.t += dt;
    this.reveal += dt * (this.app.settings.typewriter ? 90 : 99999);
    const run = this.run;
    if (!run || !run.over) return;
    const E = ENDINGS[run.over.ending];
    const P = this.app.particles;
    const { term } = this.app;
    if (E.kind === 'win') {
      if (Math.random() < dt * 6) P.add({ x: Math.random() * term.cols, y: -1, vy: 3 + Math.random() * 3, vx: (Math.random() - 0.5) * 2, life: 20, g: Math.random() < 0.5 ? '★' : '*', c0: C.gold, c1: C.o3, alpha: 0.6 });
    } else if (Math.random() < dt * 20) P.snow(Math.random() * term.cols, -1, 1, { vx: -2, vy: 3, life: 20, alpha: 0.4 });
  }

  render() {
    const app = this.app;
    const { term, ui, input } = app;
    const run = this.run;
    if (!run || !run.over) return;
    const E = ENDINGS[run.over.ending];
    const W = term.cols;
    const H = term.rows;
    const pw = Math.min(W - 4, 140);
    const ph = Math.min(H - 2, 46);
    const px = Math.floor((W - pw) / 2);
    const py = Math.floor((H - ph) / 2);
    const win = E.kind === 'win';
    ui.panel(px, py, pw, ph, { title: win ? 'MISIÓN CUMPLIDA' : 'MISIÓN FRACASADA', style: 'double', fg: win ? C.o4 : C.red2, bg: '#050201', titleFg: win ? C.gold : C.red });
    const art = ART[E.art] || ART.taiga;
    const ax = px + 3;
    const ay = py + 2;
    for (let j = 0; j < art.length; j++) term.text(ax, ay + j, art[j], win ? C.o3 : C.grey2);
    // título
    const tx = ax + 44;
    const tw = px + pw - tx - 3;
    term.text(tx, py + 2, E.title, win ? C.gold : C.red, null, 1);
    const text = E.text(run);
    const n = ui.mwrap(tx, py + 4, tw, text, C.o6, { reveal: this.reveal });
    if (this.reveal < text.length && (input.key(' ') || input.m.released)) this.reveal = 99999;
    // estadísticas
    let y = ay + art.length + 2;
    const stat = (k, v) => {
      term.text(ax, y, k, C.o3);
      term.text(ax + 26, y, String(v), C.o6);
      y++;
    };
    stat('Dificultad', DIFFICULTY[run.difficulty].name);
    stat('Semilla', run.seed);
    stat('Fecha final', fmtClock(run.clock));
    stat('Región alcanzada', ['I', 'II', 'III', 'IV', 'V'][run.region]);
    stat('Kilómetros', Math.round(run.stats.km));
    stat('Tramos volados', run.stats.legs);
    stat('Derribos', run.stats.kills);
    stat('Incendios', run.stats.fires);
    stat('Directivas cumplidas', `${run.stats.directivesOk} / ${run.stats.directivesOk + run.stats.directivesFail}`);
    stat('Conocimiento', Math.round(run.res.knowledge || 0));
    stat('Sospecha final', `${Math.round(run.suspicion)}%`);
    stat('Supervivientes', `${alive(run).length} / ${run.crew.filter((c) => !c.removed).length}`);
    y++;
    term.text(ax, y, 'PUNTUACIÓN', C.o5, null, 1);
    term.text(ax + 26, y, String(this.result.score), C.gold, null, 1);
    y += 2;
    // caídos
    const fallen = run.crew.filter((c) => c.dead && !c.removed);
    if (fallen.length && y < py + ph - 4) {
      term.text(tx, py + 5 + n + 1, 'EN MEMORIA', C.o3, null, 1);
      let fy = py + 7 + n;
      for (const c of fallen) {
        if (fy >= py + ph - 6) break;
        ui.mtext(tx, fy++, `{x}✝ ${displayName(c)} — ${c.cause}{/}`, C.o4, null, tw);
      }
    }
    // logros y desbloqueos
    let ly = py + ph - 5 - this.result.got.length - this.result.unlockedNow.length;
    for (const id of this.result.got) ui.mtext(tx, ly++, `{y}★ Logro: ${ACHIEVEMENTS[id].name}{/} {x}— ${ACHIEVEMENTS[id].desc}{/}`, C.o4, null, tw);
    for (const v of this.result.unlockedNow) ui.mtext(tx, ly++, `{g}▲ Desbloqueado: ${v}{/}`, C.o4, null, tw);
    if (ui.button('go_new', px + pw - 42, py + ph - 2, 'Nueva misión', { w: 18, key: 'Enter', accent: C.gold })) app.go('newgame');
    if (ui.button('go_title', px + pw - 22, py + ph - 2, 'Título', { w: 18, key: 'Escape' })) app.go('title');
  }
}
