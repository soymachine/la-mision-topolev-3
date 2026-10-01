// Pantalla de eventos narrativos (llegadas, sesión informativa, fronteras, finales).

import { C } from '../palette.js';
import { mix, clamp } from '../engine/util.js';
import { ART } from '../game/data/art.js';
import { REGIONS, NODE_TYPES } from '../game/data/regions.js';
import { fmtClock, alive, log, DIFFICULTY } from '../game/run.js';
import { arrive, nextRegion } from '../game/nodes.js';
import { pickEvent, eventDef, optionsFor, resolveOption, checkChance, skillName } from '../game/events.js';
import { genDirective } from '../game/directives.js';
import { briefingText, ENDINGS } from '../game/data/finale.js';
import { saveGame } from '../game/save.js';
import { resourceBar, suspicionMeter, clockWidget } from './ui/common.js';

const ART_COL = {
  '☭': C.red, '★': C.gold, '☼': C.gold, '◊': C.violet, '◉': C.violet, '◦': C.violet, '○': C.violet, 'ϟ': C.gold,
  '♪': C.o6, '♫': C.o6, '¡': C.ice, '♨': C.o6, '*': C.ice, '☾': C.o7, '✈': C.white, 'ψ': C.violet, '×': C.grey,
};

export class EventScreen {
  constructor(app, opts) {
    this.app = app;
    this.opts = opts;
    this.reveal = 0;
    this.revealRes = 0;
    this.particleT = 0;
  }
  get run() {
    return this.app.run;
  }

  enter(opts) {
    const run = this.run;
    if (opts.arrival) {
      const { node, msgs } = arrive(run);
      const queue = [];
      if (run.forced) queue.push('forzoso');
      if (node.type === 'frontera') queue.push('frontera');
      else if (node.type === 'epicentro') queue.push('epicentro');
      else if (node.type !== 'inicio') {
        const id = pickEvent(run, node);
        if (id) queue.push(id);
      }
      run.event = { queue, cur: null, stage: 'choose', result: null, msgs, node: node.id };
      this.advance();
      saveGame(this.app);
    } else if (opts.briefing) {
      run.event = { queue: [], cur: '__briefing', stage: 'choose', result: null, msgs: [], node: run.map.cur };
    } else if (!run.event) {
      this.app.go('map');
      return;
    } else if (!run.event.cur) {
      this.advance();
      if (!run.event) return;
    }
    this.checkOver();
  }

  checkOver() {
    const run = this.run;
    if (run.over) return true;
    if (run.suspicion >= 100) run.over = { kind: 'lose', ending: 'juicio' };
    else if (run.clock > run.deadline + 2 * 1440) run.over = { kind: 'lose', ending: 'cancelada' };
    else if (!alive(run).length) run.over = { kind: 'lose', ending: 'tripulacion' };
    if (run.over) {
      saveGame(this.app);
      this.app.go('gameover');
      return true;
    }
    return false;
  }

  advance() {
    const run = this.run;
    const ev = run.event;
    ev.cur = ev.queue.shift() || null;
    ev.stage = 'choose';
    ev.result = null;
    this.reveal = 0;
    this.revealRes = 0;
    if (!ev.cur) this.finish();
  }

  finish(end) {
    const run = this.run;
    const node = run.map.nodes[run.map.cur];
    run.event = null;
    if (this.checkOver()) return;
    if (end === 'station') {
      this.app.go('station', { back: 'map' });
      return;
    }
    run.phase = 'map';
    saveGame(this.app);
    this.app.go('map');
  }

  // Definición del evento actual (incluye pseudo-eventos)
  current() {
    const run = this.run;
    const ev = run.event;
    if (!ev || !ev.cur) return null;
    if (ev.cur === '__briefing') {
      return {
        art: 'moscu', title: 'ORDEN DEL COMITÉ CENTRAL', text: () => briefingText(run),
        options: [{ label: 'A la orden, camarada secretario', desc: 'Comenzar la misión.', fx: () => '', end: 'brief' }],
      };
    }
    if (ev.cur === '__region') {
      const R = REGIONS[run.region];
      return {
        art: 'taiga', title: `REGIÓN ${R.roman}: ${R.name.toUpperCase()}`, text: () => `${R.intro}${ev.regionMsgs?.length ? '\n\n{d}Balance de la región anterior:{/}\n' + ev.regionMsgs.join('\n') : ''}`,
        options: [{ label: 'Continuar', fx: () => '' }],
      };
    }
    return eventDef(ev.cur);
  }

  update(dt) {
    this.reveal += dt * (this.app.settings.typewriter ? 140 : 99999);
    this.revealRes += dt * (this.app.settings.typewriter ? 160 : 99999);
    this.particleT += dt;
    const P = this.app.particles;
    const { term } = this.app;
    if (Math.random() < dt * 14) P.snow(Math.random() * term.cols, -1, 1, { vx: -0.5 - Math.random(), vy: 1.5 + Math.random() * 2, life: 30, alpha: 0.25 });
  }

  render() {
    const app = this.app;
    const { term, ui, input } = app;
    const run = this.run;
    if (!run || !run.event) return;
    const ev = run.event;
    const def = this.current();
    if (!def) return;
    const W = term.cols;
    const H = term.rows;
    // barra superior mínima
    term.fill(0, 0, W, 1, ' ', C.o4, C.bg2);
    term.text(1, 0, '☭', C.red);
    let x = 3;
    x += clockWidget(app, x, 0, run) + 2;
    resourceBar(app, x, 0, run);
    suspicionMeter(app, W - 24, 0, run, 8);

    const pw = Math.min(W - 6, 150);
    const ph = Math.min(H - 4, 46);
    const px = Math.floor((W - pw) / 2);
    const py = 2 + Math.floor((H - 2 - ph) / 2);
    const node = run.map.nodes[ev.node ?? run.map.cur];
    ui.panel(px, py, pw, ph, { title: node ? node.name : '', style: 'double', bg: '#060302', fg: C.o2 });

    // ilustración
    const art = ART[def.art] || ART.taiga;
    const aw = 40;
    const ax = px + 3;
    const ay = py + 2;
    term.fillBg(ax - 1, ay - 1, aw + 2, art.length + 2, '#0c0603');
    const t = app.time;
    for (let j = 0; j < art.length; j++) {
      const row = art[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === ' ') continue;
        let col = ART_COL[ch] || (j < 3 ? C.o3 : j > 8 ? C.o2 : C.o4);
        if (ch === '░' || ch === '▒') col = C.o1;
        if (ch === '◉' || ch === '◊') col = mix(C.violet, C.white, 0.5 + 0.5 * Math.sin(t * 3 + i));
        term.put(ax + i, ay + j, ch, col);
      }
    }
    // pie de la ilustración
    let ly = ay + art.length + 2;
    if (node) {
      const NT = NODE_TYPES[node.type];
      ui.mtext(ax, ly++, `{d}${NT.name}{/}`, C.o4, null, aw);
      ui.mtext(ax, ly++, `{x}${REGIONS[run.region].name} · ${fmtClock(run.clock)}{/}`, C.o4, null, aw);
    }
    ly++;
    // mensajes de llegada
    if (ev.msgs && ev.msgs.length) {
      for (const m of ev.msgs) {
        if (ly >= py + ph - 2) break;
        const n = ui.mwrap(ax, ly, aw, m, C.o4, { maxLines: 3 });
        ly += Math.min(3, n);
      }
    }
    // tripulación disponible para las tiradas
    if (ly < py + ph - 4) {
      ly++;
      term.text(ax, ly++, 'TRIPULACIÓN', C.o3);
      for (const c of alive(run)) {
        if (ly >= py + ph - 2) break;
        ui.mtext(ax, ly++, `{l}${c.first[0]}. ${c.sur}{/} {x}${Math.round(c.hp)}♥ ${Math.round(c.morale)}☺{/}`, C.o4, null, aw);
      }
    }

    // texto
    const tx = ax + aw + 4;
    const tw = px + pw - tx - 3;
    let ty = py + 2;
    term.text(tx, ty, (typeof def.title === 'function' ? def.title(run) : def.title).toUpperCase(), C.o6, null, 1);
    ty += 2;
    const text = typeof def.text === 'function' ? def.text(run, { node }) : def.text;
    const skipKey = input.key(' ') || (input.m.released && ui.hot == null);
    const nLines = ui.mwrap(tx, ty, tw, text, C.o6, { reveal: this.reveal });
    const total = text.length;
    if (this.reveal < total && skipKey) this.reveal = 99999;
    if (this.reveal < total && Math.random() < 0.3) app.audio.play('type');
    ty += nLines + 1;
    const ready = this.reveal >= total;

    if (ev.stage === 'choose' && ready) {
      const ctx = { node };
      const opts = optionsFor(run, def, ctx);
      opts.forEach((o, i) => {
        if (ty >= py + ph - 2) return;
        const ok = !o.req || o.req(run, ctx);
        let chance = '';
        if (o.skill) {
          const ch = checkChance(run, o);
          const pc = Math.round(ch.chance * 100);
          chance = ` {d}[${ch.actor ? ch.actor.sur + ': ' : ''}${skillName(o.skill)} ${ch.skill} · {/}{${pc >= 66 ? 'g' : pc >= 40 ? 'y' : 'r'}}${pc}%{/}{d}]{/}`;
        }
        const label = `${i + 1}. ${o.label}`;
        if (ui.button('evopt_' + i, tx, ty, label, { w: tw, align: 'left', disabled: !ok, key: String(i + 1), tip: o.desc || null })) this.choose(def, o, ctx);
        if (chance) ui.mtext(tx + Math.min(tw - 20, label.length + 4), ty, chance, C.o3);
        ty++;
        if (o.desc) {
          ui.mtext(tx + 3, ty, `{x}${ok ? o.desc : 'No disponible. ' + o.desc}{/}`, C.o3, null, tw - 4);
          ty++;
        }
        ty++;
      });
    } else if (ev.stage === 'result' && ev.result) {
      const r = ev.result;
      if (r.success != null) {
        term.text(tx, ty, r.success ? '▲ ÉXITO' : '▼ FRACASO', r.success ? C.rad : C.red, null, 1);
        ty += 2;
      }
      const n = ui.mwrap(tx, ty, tw, r.text || '', C.o7, { reveal: this.revealRes });
      ty += n + 1;
      if (this.revealRes >= (r.text || '').length) {
        for (const line of r.fx) {
          if (ty >= py + ph - 3) break;
          ui.mtext(tx + 2, ty++, '· ' + line, C.o5, null, tw - 4);
        }
        if (ui.button('evcont', px + pw - 18, py + ph - 3, 'Continuar ▸', { w: 15, key: 'Enter' })) this.continueAfter(r);
      } else if (skipKey) this.revealRes = 99999;
    }
  }

  choose(def, o, ctx) {
    const run = this.run;
    const ev = run.event;
    const r = resolveOption(run, def, o, ctx);
    ev.result = { text: r.text, fx: r.fx, success: r.success, next: r.next, end: r.end };
    ev.stage = 'result';
    this.revealRes = 0;
    if (r.success === true) this.app.audio.play('success');
    else if (r.success === false) this.app.audio.play('fail');
    // fin inmediato sin texto de resultado
    if (!r.text && !r.fx.length) this.continueAfter(ev.result);
    else saveGame(this.app);
  }

  continueAfter(r) {
    const run = this.run;
    const ev = run.event;
    if (this.checkOver()) return;
    if (r.next) {
      ev.queue.unshift(r.next);
      this.advance();
      return;
    }
    const end = r.end;
    if (end && end.startsWith('ending:')) {
      const id = end.slice(7);
      run.over = { kind: ENDINGS[id].kind, ending: id };
      saveGame(this.app);
      this.app.go('gameover');
      return;
    }
    if (end === 'brief') {
      genDirective(run);
      run.event = null;
      run.phase = 'map';
      saveGame(this.app);
      this.app.go('map');
      return;
    }
    if (end === 'region') {
      const msgs = nextRegion(run);
      ev.regionMsgs = msgs;
      ev.queue = ['__region'];
      this.advance();
      saveGame(this.app);
      return;
    }
    if (end === 'station') {
      // la frontera vuelve al evento tras comerciar
      if (ev.cur === 'frontera') {
        ev.stage = 'choose';
        ev.result = null;
        this.app.go('station', { back: 'event' });
        return;
      }
      ev.cur = null;
      run.event = ev.queue.length ? ev : null;
      this.app.go('station', { back: run.event ? 'event' : 'map' });
      return;
    }
    this.advance();
  }
}
