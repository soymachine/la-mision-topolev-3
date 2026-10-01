// Elementos de interfaz compartidos: barra superior, recursos, sospecha, cabeceras.

import { C } from '../../palette.js';
import { RES, RES_KEYS, caps, fmtClock, timeLeft, fmtDuration, day } from '../../game/run.js';
import { REGIONS } from '../../game/data/regions.js';
import { mix, clamp } from '../../engine/util.js';

export const RES_COLORS = { o5: C.o5, o6: C.o6, o7: C.o7, red: C.red, ice: C.ice, gold: C.gold, violet: C.violet };

export function resColor(k) {
  return RES_COLORS[RES[k].color] || C.o5;
}

export function fmtRes(run, k) {
  const v = run.res[k] || 0;
  return RES[k].d ? v.toFixed(RES[k].d) : String(Math.floor(v));
}

// Barra de recursos en una fila. Devuelve ancho usado.
export function resourceBar(app, x, y, run, opts = {}) {
  const { ui, term } = app;
  const cp = caps(run);
  const keys = opts.keys || RES_KEYS;
  let cx = x;
  for (const k of keys) {
    const R = RES[k];
    const v = fmtRes(run, k);
    const cap = cp[k];
    const low = k === 'fuel' ? run.res.fuel < 6 : k === 'rations' ? run.res.rations + run.res.meals < 8 : false;
    const label = `${R.glyph}${v}`;
    const w = label.length + 2;
    const id = 'res_' + k + (opts.idSuffix || '');
    const st = ui.region(id, cx, y, w, 1, { passive: false, cursor: 'help', sound: false });
    const hv = ui.hoverT(id);
    const col = low ? (Math.floor(app.time * 3) % 2 ? C.red : C.o6) : resColor(k);
    term.text(cx, y, R.glyph, col, hv > 0.2 ? C.bg3 : null);
    term.text(cx + 1, y, v, mix(C.o6, C.white, hv), hv > 0.2 ? C.bg3 : null);
    const prev = opts.prev && opts.prev[k];
    ui.tip(id, () => {
      const L = [`{O}${R.name}{/}: ${v}${R.unit}${cap && cap < 9999 ? ` / ${cap}` : ''}`];
      L.push(`{d}${RES_DESC[k]}{/}`);
      return L;
    });
    cx += w;
  }
  return cx - x;
}

const RES_DESC = {
  fuel: 'Queroseno para los motores. Sin él, aterrizaje forzoso.',
  rations: 'Materia prima. El cocinero las convierte en comidas; también se comen crudas (mala moral).',
  meals: 'Comidas calientes preparadas en la cocina. Quitan más hambre y suben la moral.',
  parts: 'Repuestos: reparaciones, sellado de brechas y fabricación en el taller.',
  meds: 'Curan heridas, radiación y fiebre en la enfermería.',
  ammo: 'Proyectiles para las torretas. Cada ráfaga gasta 4.',
  vodka: 'Sube la moral. Los bebedores lo necesitan. Se puede destilar.',
  flares: 'Señuelos térmicos: los cazas fallan durante unos minutos.',
  rubles: 'Dinero para comerciar en aeródromos y ciudades.',
  knowledge: 'Lo que sabéis de la Señal. Decisivo en el Epicentro.',
};

export function suspicionMeter(app, x, y, run, w = 16) {
  const { ui, term } = app;
  const v = run.suspicion;
  const col = v > 75 ? C.red : v > 50 ? mix(C.o5, C.red, (v - 50) / 25) : C.o5;
  term.text(x, y, 'KGB', v > 75 && Math.floor(app.time * 2) % 2 ? C.red : C.o3);
  ui.bar(x + 4, y, w, v / 100, { fg: col, id: 'susp_bar', bg: C.bg2 });
  term.text(x + 5 + w, y, `${Math.round(v)}%`, col);
  const st = ui.region('susp', x, y, w + 9, 1, { cursor: 'help', sound: false });
  ui.tip('susp', [
    `{r}Sospecha del KGB: ${Math.round(v)}%{/}`,
    'Si llega al 100% la misión será intervenida y la tripulación, juzgada.',
    '{d}Sube con decisiones desleales, directivas incumplidas y retrasos. Baja con informes del comisario, directivas cumplidas y lealtad.{/}',
  ]);
  return w + 9;
}

export function clockWidget(app, x, y, run) {
  const { term, ui } = app;
  const left = timeLeft(run);
  const txt = fmtClock(run.clock);
  term.text(x, y, txt, C.o6);
  const late = left < 0;
  const dl = late ? `RETRASO ${fmtDuration(-left)}` : `Plazo ${fmtDuration(left)}`;
  term.text(x + txt.length + 2, y, dl, late ? C.red : left < 1440 ? C.gold : C.o3);
  ui.region('clock', x, y, txt.length + dl.length + 2, 1, { cursor: 'help', sound: false });
  ui.tip('clock', [
    `{O}${txt}{/}`,
    `Moscú exige llegar al Epicentro antes de ${fmtClock(run.deadline)}.`,
    late ? '{r}Cada hora de retraso aumenta la sospecha.{/}' : `{d}Quedan ${fmtDuration(left)}.{/}`,
  ]);
  return txt.length + dl.length + 2;
}

export function regionTag(run) {
  const R = REGIONS[run.region];
  return `REGIÓN ${R.roman} · ${R.name.toUpperCase()}`;
}

// Título de sección estilo ficha
export function sectionTitle(app, x, y, w, title, fg = C.o5) {
  const { term } = app;
  term.text(x, y, '▌', C.o4);
  term.text(x + 1, y, ' ' + title + ' ', fg, null, 1);
  for (let i = x + title.length + 3; i < x + w; i++) term.put(i, y, '─', C.o1);
}

export function statusColor(v, good = 70, bad = 35, invert = false) {
  if (invert) v = 100 - v;
  return v >= good ? C.o5 : v >= bad ? C.gold : C.red;
}

// mini-barra de 6 celdas con icono
export function miniBar(app, x, y, icon, frac, color, w = 6, id = null) {
  const { term, ui } = app;
  term.put(x, y, icon, color);
  ui.bar(x + 1, y, w, clamp(frac, 0, 1), { fg: color, bg: C.bg2, id });
}
