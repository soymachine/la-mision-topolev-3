// Expediente personal de un tripulante (modal).

import { C } from '../../palette.js';
import { bigFace, faceState, displayName, fullName, roleName, maxHp, visibleTraits, relationsOf } from '../../game/crew.js';
import { SKILLS, TRAITS } from '../../game/data/traits.js';
import { fmtClock } from '../../game/run.js';
import { mix, pad } from '../../engine/util.js';
import { MASTERY, MASTER_LEVEL } from '../../game/data/modifiers.js';

export function drawDossier(app, run, c, opts = {}) {
  const { term, ui } = app;
  if (!c) return true;
  const W = term.cols;
  const H = term.rows;
  const pw = Math.min(96, W - 6);
  const ph = Math.min(40, H - 4);
  const px = Math.floor((W - pw) / 2);
  const py = Math.floor((H - ph) / 2);
  ui.panel(px, py, pw, ph, { title: `EXPEDIENTE Nº ${c.id.slice(1).padStart(4, '0')}`, style: 'double', bg: '#0b0603', shadow: true });
  // sello
  term.text(px + pw - 22, py + 1, '▐ СЕКРЕТНО ▌', C.red2, null, 1);
  // retrato
  const face = bigFace(c, faceState(c));
  term.fillBg(px + 2, py + 2, 17, face.length + 2, '#120904');
  for (let j = 0; j < face.length; j++) term.text(px + 3, py + 3 + j, face[j], c.dead ? C.grey2 : C.o5);
  let yy = py + 2;
  const tx = px + 22;
  term.text(tx, yy++, fullName(c).toUpperCase(), C.o7, null, 1);
  ui.mtext(tx, yy++, `{d}${roleName(c)}${c.nick ? ` · alias «${c.nick}»` : ''}{/}`, C.o4);
  ui.mtext(tx, yy++, `${c.age} años · natural de {l}${c.origin}{/}`, C.o4);
  if (c.dead) ui.mtext(tx, yy++, `{r}✝ ${c.cause}${c.diedAt ? ' · ' + fmtClock(c.diedAt) : ''}{/}`, C.o4);
  yy++;
  // estado
  const st = (label, v, max, col, x, y) => {
    term.text(x, y, label, C.o3);
    ui.bar(x + 10, y, 14, v / max, { fg: col });
    term.text(x + 25, y, `${Math.round(v)}`, col);
  };
  st('Salud', c.hp, maxHp(c), c.hp < 40 ? C.red : C.o5, tx, yy);
  st('Moral', c.morale, 100, c.morale < 25 ? C.red : C.o6, tx + 32, yy++);
  st('Fatiga', c.fatigue, 100, c.fatigue > 80 ? C.gold : C.o4, tx, yy);
  st('Hambre', c.hunger, 100, c.hunger > 75 ? C.gold : C.o4, tx + 32, yy++);
  st('Frío', c.cold, 100, C.ice2, tx, yy);
  st('Radiación', c.rad, 100, C.rad2, tx + 32, yy++);
  yy = Math.max(yy + 1, py + 13);
  // habilidades
  term.text(px + 3, yy++, 'HABILIDADES', C.o5, null, 1);
  for (const s of SKILLS) {
    const v = c.skills[s.id];
    const xp = c.xp[s.id] || 0;
    const need = 60 + v * 25;
    const id = 'dsk_' + s.id;
    ui.region(id, px + 3, yy, 40, 1, { cursor: 'help', sound: false });
    ui.tip(id, [`{O}${s.name}{/}`, s.desc, `{d}Experiencia: ${Math.round(xp)}/${need}{/}`, v >= MASTER_LEVEL ? `{y}★ Maestría:{/} ${MASTERY[s.id]}` : `{x}Maestría (nivel ${MASTER_LEVEL}): ${MASTERY[s.id]}{/}`]);
    term.text(px + 3, yy, pad(s.name, 12), v >= 6 ? C.o6 : v >= 3 ? C.o4 : C.o2);
    for (let i = 0; i < 10; i++) term.put(px + 16 + i * 2, yy, i < v ? '■' : '·', i < v ? (v >= 6 ? C.o5 : C.o3) : C.o1);
    term.text(px + 37, yy, String(v), C.o6);
    if (v >= MASTER_LEVEL) term.text(px + 39, yy, '★', C.gold);
    yy++;
  }
  // rasgos
  let ry = py + 13;
  const rx = px + 46;
  term.text(rx, ry++, 'RASGOS', C.o5, null, 1);
  for (const t of c.traits) {
    const T = TRAITS[t];
    const hidden = T.kind === 'hid' && !c.revealed[t];
    if (hidden) continue;
    const col = T.kind === 'pos' ? C.rad : T.kind === 'neg' ? C.red : C.violet;
    term.text(rx, ry++, '• ' + T.name, col);
    const n = ui.mwrap(rx + 2, ry, pw - (rx - px) - 4, `{d}${T.desc}{/}`, C.o3, { maxLines: 3 });
    ry += Math.min(3, n);
  }
  if (c.traits.some((t) => TRAITS[t].kind === 'hid' && !c.revealed[t])) {
    term.text(rx, ry++, '• ???', C.grey2);
    ui.mtext(rx + 2, ry++, '{x}Algo no encaja en este expediente.{/}', C.o3);
  } else if (!visibleTraits(c).length) term.text(rx, ry++, 'Ninguno destacable.', C.o2);
  const rels = relationsOf(run, c);
  if (rels.length) {
    ry++;
    term.text(rx, ry++, 'RELACIONES', C.o5, null, 1);
    for (const r of rels) {
      const o = run.crew.find((x) => x.id === r.other);
      if (!o) continue;
      ui.mtext(rx, ry++, `${r.kind === 'amigo' ? '{g}♥ Amistad{/}' : '{r}✕ Rivalidad{/}'} con {l}${displayName(o)}{/}${o.dead ? ' {x}(✝){/}' : ''}`, C.o4, null, pw - (rx - px) - 4);
    }
  }
  ry++;
  term.text(rx, ry++, 'HOJA DE SERVICIO', C.o5, null, 1);
  const s = c.stats;
  ui.mtext(rx, ry++, `Reparaciones {l}${s.repairs}{/} · Incendios {l}${s.fires}{/} · Derribos {l}${s.kills}{/}`, C.o4);
  ui.mtext(rx, ry++, `Comidas cocinadas {l}${s.meals}{/} · Salud curada {l}${Math.round(s.heals)}{/}`, C.o4);
  const close = ui.button('dossier_close', px + pw - 14, py + ph - 2, 'Cerrar', { w: 11, key: 'Escape' });
  return close;
}
