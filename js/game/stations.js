// Trabajos de estación: radio, ciencia, política y órdenes de taller.

import { rng, addRes, addSuspicion, alive, log, canPay, pay } from './run.js';
import { has, displayName, visibleTraits } from './crew.js';
import { TRAITS } from './data/traits.js';
import { emit, alert } from './fcore.js';
import { handleMessage, onReport } from './directives.js';
import { scrapValue } from './loot.js';
import { clamp } from '../engine/util.js';

export const RECIPES = {
  municion: { name: 'Munición', desc: '3 piezas → 40 de munición', cost: { parts: 3 }, out: { ammo: 40 }, need: 18 },
  senuelos: { name: 'Señuelos', desc: '4 piezas + 1 vodka → 2 señuelos', cost: { parts: 4, vodka: 1 }, out: { flares: 2 }, need: 22 },
  botiquin: { name: 'Botiquín improvisado', desc: '2 piezas + 2 vodka → 1 medicina', cost: { parts: 2, vodka: 2 }, out: { meds: 1 }, need: 14 },
  destilar: { name: 'Destilar vodka', desc: '3 raciones → 2 vodka', cost: { rations: 3 }, out: { vodka: 2 }, need: 26 },
  reparar: { name: 'Reparar módulo', desc: 'Repara un módulo de la bodega (1 pieza / 10%)', cost: {}, out: {}, need: 0, target: true },
  desguazar: { name: 'Desguazar módulo', desc: 'Convierte un módulo de la bodega en piezas', cost: {}, out: {}, need: 10, target: true },
};

export function addOrder(run, recipe, target = null) {
  const R = RECIPES[recipe];
  if (!R) return false;
  if (!canPay(run, R.cost)) return false;
  pay(run, R.cost);
  let need = R.need;
  if (recipe === 'reparar') {
    const m = run.inventory.find((x) => x.id === target);
    if (!m || m.int >= m.maxInt) return false;
    need = Math.max(6, (m.maxInt - m.int) / 4);
  }
  run.orders.push({ id: 'o' + Math.floor(Math.random() * 1e9), recipe, target, progress: 0, need });
  return true;
}

export function cancelOrder(run, id) {
  const i = run.orders.findIndex((o) => o.id === id);
  if (i < 0) return;
  const o = run.orders[i];
  const R = RECIPES[o.recipe];
  for (const k in R.cost) addRes(run, k, R.cost[k]);
  run.orders.splice(i, 1);
}

export function completeOrder(run, o) {
  const R = RECIPES[o.recipe];
  run.orders = run.orders.filter((x) => x !== o);
  if (o.recipe === 'reparar') {
    const m = run.inventory.find((x) => x.id === o.target);
    if (m) {
      const parts = Math.ceil((m.maxInt - m.int) / 10);
      const use = Math.min(parts, run.res.parts);
      addRes(run, 'parts', -use);
      m.int = Math.min(m.maxInt, m.int + use * 10);
      log(run, `Taller: ${m.name} reparado (${use} piezas).`, 'good');
    }
  } else if (o.recipe === 'desguazar') {
    const i = run.inventory.findIndex((x) => x.id === o.target);
    if (i >= 0) {
      const m = run.inventory[i];
      const v = scrapValue(m);
      run.inventory.splice(i, 1);
      addRes(run, 'parts', v);
      log(run, `Taller: ${m.name} desguazado (+${v} piezas).`, 'good');
    }
  } else {
    for (const k in R.out) addRes(run, k, R.out[k]);
    log(run, `Taller: ${R.name} terminado.`, 'good');
  }
  emit(run, { kind: 'crafted', recipe: o.recipe });
}

// Radio: descifrar cola o escuchar
export function resolveRadio(run, c, rate, dt, ctx) {
  const f = run.flight;
  const pw = run.ship.power.radio || 0;
  if (pw <= 0 || ctx.stats.decode <= 0) return;
  const q = f.radioQueue;
  if (q.length) {
    const it = q[0];
    it.progress += rate * ctx.stats.decode * (pw >= 2 ? 1.4 : 1) * (it.kind === 'iff' ? 1 + ctx.stats.iff : 1) * dt;
    if (Math.random() < dt * 2) emit(run, { kind: 'radio', station: 'radio' });
    if (it.progress >= it.need) {
      q.shift();
      if (it.kind === 'iff') {
        f.pvo = null;
        alert(run, 'Código IFF aceptado. La PVO baja las armas.', 'good', { sound: 'success' });
      } else {
        const txt = handleMessage(run, it.msg);
        alert(run, txt, 'party', { sound: 'radio' });
      }
    }
  } else if (Math.random() < dt * 0.004 * rate) {
    const r = rng(run);
    if (r.chance(0.5)) {
      addRes(run, 'knowledge', 1);
      log(run, `${displayName(c)} capta un eco extraño en la frecuencia de la Señal.`, 'info');
    }
  }
}

export function scienceGain(run, c, rate, dt, ctx) {
  const f = run.flight;
  let g = 0.01 * rate * (1 + run.region * 0.7) * (has(c, 'erudito') ? 1.3 : 1) * (has(c, 'disidente') ? 1.15 : 1);
  if ((run.ship.power.radio || 0) <= 0) g *= 0.5;
  if (f.anomaly) g *= 2.5;
  if (has(c, 'oyente') && run.region >= 3) g *= 1.8;
  f.sciAcc = (f.sciAcc || 0) + g * dt;
  if (f.sciAcc >= 1) {
    f.sciAcc -= 1;
    addRes(run, 'knowledge', 1);
    emit(run, { kind: 'science', x: c.x, y: c.y });
  }
}

export const POL_FOCUS = {
  informe: { name: 'Redactar informes', desc: 'Cada informe enviado a Moscú reduce la sospecha.' },
  moral: { name: 'Sesión política', desc: 'Charlas sobre el futuro radiante: sube la moral (a casi todos).' },
  vigilancia: { name: 'Vigilancia', desc: 'Investiga a un tripulante para descubrir rasgos ocultos.' },
};

export function polWork(run, c, rate, dt, ctx) {
  const f = run.flight;
  const focus = run.polFocus || 'informe';
  f.polAcc = (f.polAcc || 0) + rate * dt * (has(c, 'leal') ? 1.2 : 1);
  if (focus === 'informe' && f.polAcc >= 48) {
    f.polAcc = 0;
    addSuspicion(run, -1.5);
    run.stats.reports = (run.stats.reports || 0) + 1;
    onReport(run);
    emit(run, { kind: 'stamp', x: c.x, y: c.y });
    log(run, `${displayName(c)} envía un informe a Moscú. Sospecha −1,5.`, 'good');
  } else if (focus === 'moral' && f.polAcc >= 30) {
    f.polAcc = 0;
    for (const o of alive(run)) {
      let d = 3;
      if (has(o, 'disidente')) d = -3;
      if (has(o, 'leal')) d = 5;
      o.morale = clamp(o.morale + d, 0, 100);
    }
    emit(run, { kind: 'stamp', x: c.x, y: c.y });
    log(run, `${displayName(c)} dirige una sesión política. La moral sube.`, 'good');
  } else if (focus === 'vigilancia') {
    const target = run.crew.find((x) => x.id === run.polTarget && !x.dead);
    if (!target || target === c) return;
    run.invest = run.invest || {};
    run.invest[target.id] = (run.invest[target.id] || 0) + rate * dt;
    if (run.invest[target.id] >= 55) {
      run.invest[target.id] = 0;
      const hidden = target.traits.filter((t) => TRAITS[t].kind === 'hid' && !target.revealed[t]);
      if (hidden.length) {
        const t = hidden[0];
        target.revealed[t] = true;
        alert(run, `Vigilancia: ${displayName(target)} es «${TRAITS[t].name}».`, 'danger', { pause: true, sound: 'stamp' });
        run.pendingReveal = run.pendingReveal || [];
        run.pendingReveal.push({ crew: target.id, trait: t });
      } else {
        target.flags = target.flags || {};
        target.flags.clean = true;
        target.morale = clamp(target.morale - 6, 0, 100);
        alert(run, `Vigilancia: el expediente de ${displayName(target)} está limpio.`, 'info');
        run.polTarget = null;
      }
    }
  }
}
