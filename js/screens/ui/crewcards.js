// Tarjetas de tripulación (arrastrables) para la columna izquierda.

import { C } from '../../palette.js';
import { alive } from '../../game/run.js';
import { miniFace, faceState, displayName, roleName, maxHp, visibleTraits, shortName } from '../../game/crew.js';
import { TRAITS, ROLES, SKILLS } from '../../game/data/traits.js';
import { layout } from '../../game/ship.js';
import { mix, clamp, pad } from '../../engine/util.js';

export const CARD_H = 5;

export function activityText(run, c) {
  if (c.dead) return `{r}✝ ${c.cause || 'muerto'}{/}`;
  if (c.breakdown) {
    const k = { panico: 'Ataque de pánico', negarse: 'Se niega a trabajar', beber: 'Bebiendo a escondidas', pelea: 'Peleándose' }[c.breakdown.kind];
    return `{v}${k}{/}`;
  }
  const a = c.act;
  const f = run.flight;
  if (!a) return '{x}En espera{/}';
  switch (a.kind) {
    case 'sleep': return a.spot != null ? '{x}Durmiendo en litera{/}' : '{x}Durmiendo en el suelo{/}';
    case 'collapse': return '{r}Desplomado de agotamiento{/}';
    case 'eat': return '{l}Comiendo{/}';
    case 'drink': return '{i}Bebiendo vodka{/}';
    case 'warm': return '{i}Entrando en calor{/}';
    case 'patient': return '{r}En la enfermería{/}';
    case 'idle': return c.order ? '{y}Esperando órdenes{/}' : '{x}Descansando{/}';
    case 'task': {
      const t = f?.tasks.find((x) => x.id === a.taskId);
      if (!t) return '{x}…{/}';
      const go = c.atWork ? '' : '→ ';
      return `${c.atWork ? '{O}' : '{d}'}${go}${t.label}{/}`;
    }
    default: return '';
  }
}

export function crewTooltip(run, c) {
  const L = [];
  L.push(`{O}${displayName(c)}{/} · ${roleName(c)}`);
  L.push(`{d}${c.age} años · ${c.origin}{/}`);
  L.push(`Salud {${c.hp < 40 ? 'r' : 'l'}}${Math.round(c.hp)}/${maxHp(c)}{/}  Moral {l}${Math.round(c.morale)}{/}`);
  L.push(`Fatiga {l}${Math.round(c.fatigue)}{/}  Hambre {l}${Math.round(c.hunger)}{/}  Frío {i}${Math.round(c.cold)}{/}`);
  if (c.rad > 5) L.push(`Radiación {g}${Math.round(c.rad)}{/}`);
  if (c.drunk > 10) L.push(`Embriaguez {i}${Math.round(c.drunk)}{/}`);
  if (c.sick > 0) L.push('{r}Fiebre{/}');
  const sk = SKILLS.filter((s) => c.skills[s.id] > 0).sort((a, b) => c.skills[b.id] - c.skills[a.id]).slice(0, 5);
  L.push(sk.map((s) => `${s.short} {l}${c.skills[s.id]}{/}`).join('  '));
  const vt = visibleTraits(c);
  if (vt.length) L.push(vt.map((t) => `{${TRAITS[t].kind === 'neg' ? 'r' : TRAITS[t].kind === 'hid' ? 'v' : 'g'}}${TRAITS[t].name}{/}`).join(', '));
  L.push('');
  L.push('{x}Arrastra a una sala, estación o tarea para darle una orden. Clic derecho: cancelar orden. Doble clic: expediente.{/}');
  return L;
}

// Dibuja la lista. Devuelve {hoverId}
export function drawCrewCards(app, run, x, y, w, h, sel) {
  const { term, ui } = app;
  const crew = run.crew.filter((c) => !c.dead).concat(run.crew.filter((c) => c.dead && run.clock - (c.diedAt || 0) < 600));
  const contentH = crew.length * CARD_H;
  const off = ui.beginScroll('crewcards', x, y, w, h, contentH);
  let hover = null;
  const t = app.time;
  for (let i = 0; i < crew.length; i++) {
    const c = crew[i];
    const cy = y + i * CARD_H - off;
    if (cy + CARD_H < y || cy > y + h) continue;
    const id = 'card_' + c.id;
    const st = c.dead ? ui.region(id, x, cy, w, CARD_H - 1, { cursor: 'default' }) : ui.draggable(id, x, cy, w, CARD_H - 1, { kind: 'crew', id: c.id }, { label: `${c.sur[0]} ${c.sur}`, fg: C.o7 });
    const hv = ui.hoverT(id);
    const selected = sel.crew === c.id;
    if (st.hot) hover = c.id;
    const bg = selected ? C.bg4 : hv > 0.05 ? mix(C.bg1, C.bg3, hv) : C.bg1;
    term.fillBg(x, cy, w, CARD_H - 1, bg);
    // borde izquierdo de estado
    const alertCol = c.dead ? C.grey2 : c.hp < 40 || c.breakdown ? C.red : c.fatigue > 85 || c.hunger > 85 ? C.gold : selected ? C.o5 : C.o1;
    for (let j = 0; j < CARD_H - 1; j++) term.put(x, cy + j, '▌', alertCol);
    const face = miniFace(c, faceState(c));
    const fcol = c.dead ? C.grey2 : C.o4;
    for (let j = 0; j < 3; j++) term.text(x + 2, cy + j, face[j], fcol);
    const name = pad(displayName(c), w - 13);
    term.text(x + 8, cy, name, c.dead ? C.grey2 : selected ? C.white : C.o6, null, 1);
    const role = ROLES[c.role]?.glyph || '?';
    term.text(x + w - 4, cy, `[${(c.sur[0] || '?').toUpperCase()}]`, c.dead ? C.grey2 : C.o3);
    if (!c.dead) {
      // barras: salud, fatiga / hambre, moral
      const hpF = c.hp / maxHp(c);
      bar(app, x + 8, cy + 1, '♥', hpF, hpF < 0.4 ? C.red : C.o5, 'hp' + c.id);
      bar(app, x + 8 + 11, cy + 1, '☾', 1 - c.fatigue / 100, c.fatigue > 80 ? C.gold : C.o4, 'fa' + c.id);
      bar(app, x + 8, cy + 2, '♨', 1 - c.hunger / 100, c.hunger > 75 ? C.gold : C.o4, 'hu' + c.id);
      bar(app, x + 8 + 11, cy + 2, '☺', c.morale / 100, c.morale < 25 ? C.red : C.o6, 'mo' + c.id);
      // iconos extra
      let ix = x + w - 2;
      if (c.cold > 30) term.put(ix--, cy + 1, '❄', c.cold > 60 ? C.ice : C.ice2);
      if (c.rad > 20) term.put(ix--, cy + 1, '☢', C.rad);
      if (c.drunk > 30) term.put(ix--, cy + 1, '¡', C.ice);
      if (c.sick > 0) term.put(ix--, cy + 1, '¤', C.red);
      if (c.order) term.put(ix--, cy + 1, '▾', C.gold);
    }
    ui.mtext(x + 2, cy + 3, activityText(run, c), C.o3, null, w - 3);
    if (!c.dead) ui.tip(id, () => crewTooltip(run, c), { w: 46 });
    if (st.clicked) sel.crew = selected ? null : c.id, (sel.room = null);
    if (st.rclicked && c.order) {
      c.order = null;
      if (run.flight) run.flight.assignAcc = 99;
      app.audio.play('cancel');
    }
    if (st.dbl && !c.dead) sel.dossier = c.id;
  }
  ui.endScroll();
  return { hover };
}

function bar(app, x, y, icon, frac, col, id) {
  const { term, ui } = app;
  term.put(x, y, icon, col);
  ui.bar(x + 1, y, 8, clamp(frac, 0, 1), { fg: col, id, style: 'line' });
}
