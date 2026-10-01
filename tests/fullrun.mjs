// Partidas completas automáticas (sin navegador): detecta errores y mide el equilibrio.
// Uso: node tests/fullrun.mjs [n] [dificultad] [-v]
import { newRun, alive, fmtClock, rng, addRes, caps } from '../js/game/run.js';
import { createFlight, stepFlight } from '../js/game/flight.js';
import { neighborsOf, legDistance } from '../js/game/map.js';
import { hull } from '../js/game/fcore.js';
import { arrive, nextRegion, restCrew, market, buyPrice, hullRepairCost } from '../js/game/nodes.js';
import { pickEvent, eventDef, optionsFor, resolveOption } from '../js/game/events.js';
import { genDirective } from '../js/game/directives.js';
import { buildPopup } from '../js/game/popups.js';
import { ENDINGS, computeScore } from '../js/game/data/finale.js';
import { shipStats } from '../js/game/ship.js';

const N = Number(process.argv[2] || 5);
const DIFF = process.argv[3] || 'estajanovista';
const VERB = process.argv.includes('-v');
const endings = {};
let totalLegs = 0;

function shop(run, node) {
  const mk = market(run, node);
  const cp = caps(run);
  const buy = (k, want) => {
    const p = buyPrice(mk, k);
    const q = Math.min(want, mk.stock[k], Math.floor(run.res.rubles / p), Math.max(0, cp[k] - run.res[k]));
    if (q > 0) {
      addRes(run, 'rubles', -Math.ceil(q * p));
      addRes(run, k, q);
      mk.stock[k] -= q;
    }
  };
  buy('fuel', 40);
  buy('rations', 20);
  buy('parts', 10);
  buy('meds', 3);
  const hc = hullRepairCost(run, mk);
  if (hc && run.res.rubles >= hc && ['aerodromo', 'militar', 'ciudad'].includes(node.type)) {
    run.res.rubles -= hc;
    for (const id in run.ship.rooms) run.ship.rooms[id].int = 100;
  }
}

function playEvent(run, id, node) {
  let cur = id;
  let guard = 0;
  while (cur && guard++ < 6 && !run.over) {
    const def = eventDef(cur);
    const ctx = { node };
    let opts = optionsFor(run, def, ctx).filter((o) => !o.req || o.req(run, ctx));
    if (!opts.length) return null;
    if (cur === 'frontera' && guard > 1) opts = opts.filter((o) => o.end === 'region');
    const o = rng(run).pick(opts);
    const r = resolveOption(run, def, o, ctx);
    if (VERB) console.log(`    · ${def.title}: ${o.label} → ${r.success == null ? '' : r.success ? 'OK' : 'FALLO'} ${r.fx.join(' ')}`);
    if (r.end && r.end.startsWith('ending:')) {
      run.over = { kind: ENDINGS[r.end.slice(7)].kind, ending: r.end.slice(7) };
      return null;
    }
    if (r.end === 'station') shop(run, node);
    if (r.end === 'region') return 'region';
    cur = r.next || (r.end === 'station' && cur === 'frontera' ? 'frontera' : null);
  }
  return null;
}

for (let k = 0; k < N; k++) {
  const run = newRun({ seed: 'FULL' + k + DIFF, difficulty: DIFF });
  genDirective(run);
  run.phase = 'map';
  let legs = 0;
  while (!run.over && legs < 60) {
    const nb = neighborsOf(run.map, run.map.cur);
    if (!nb.length) break;
    // preferir aeródromos si falta combustible
    let to = rng(run).pick(nb);
    const aero = nb.find((id) => run.map.nodes[id].type === 'aerodromo');
    if (aero != null && run.res.fuel < 15) to = aero;
    const final = run.map.nodes[to].type === 'epicentro';
    const f = createFlight(run, to, { final });
    let g = 0;
    while (!f.arrived && !run.over && g++ < 40000) {
      stepFlight(run, 0.25);
      while (f.popups.length) {
        const p = f.popups[0];
        const def = buildPopup(run, p);
        const ok = def.options.filter((o) => !o.req || o.req(run));
        if (ok.length) rng(run).pick(ok).fx(run);
        f.popups.shift();
      }
      if (run.pendingReveal && run.pendingReveal.length) {
        const r = run.pendingReveal.shift();
        f.popups.push({ id: 'reveal', crew: r.crew, trait: r.trait });
      }
    }
    legs++;
    totalLegs++;
    if (run.over) break;
    const { node } = arrive(run);
    const queue = [];
    if (run.forced) queue.push('forzoso');
    if (node.type === 'frontera') queue.push('frontera');
    else if (node.type === 'epicentro') queue.push('epicentro');
    else if (node.type !== 'inicio') {
      const id = pickEvent(run, node);
      if (id) queue.push(id);
    }
    if (VERB) console.log(`  [${fmtClock(run.clock)}] R${run.region + 1} → ${node.name} (${node.type}) comb=${run.res.fuel.toFixed(1)} rac=${run.res.rations} com=${run.res.meals} pz=${run.res.parts} ₽=${Math.round(run.res.rubles)} sosp=${run.suspicion.toFixed(0)} casco=${hull(run).toFixed(0)} vivos=${alive(run).length} Ψ=${Math.round(run.res.knowledge)}`);
    for (const id of queue) {
      if (run.over) break;
      const res = playEvent(run, id, node);
      if (res === 'region') {
        if (node.type === 'frontera') shop(run, node);
        nextRegion(run);
      }
    }
    if (['aerodromo', 'ciudad', 'militar'].includes(node.type)) shop(run, node);
    // descansar si están agotados
    if (alive(run).filter((c) => c.fatigue > 70).length >= 3) restCrew(run, 6);
    if (run.suspicion >= 100) run.over = { kind: 'lose', ending: 'juicio' };
    else if (run.clock > run.deadline + 2 * 1440) run.over = { kind: 'lose', ending: 'cancelada' };
    else if (!alive(run).length) run.over = { kind: 'lose', ending: 'tripulacion' };
  }
  if (process.argv.includes('-log')) for (const l of run.log.slice(-40)) console.log('     ', fmtClock(l.t), l.text);
  if (VERB || process.argv.includes("-d")) for (const c of run.crew) if (c.dead) console.log("     ✝", c.sur, c.cause, fmtClock(c.diedAt || 0));
  const end = run.over ? run.over.ending : "SIN FINAL";
  endings[end] = (endings[end] || 0) + 1;
  console.log(`[${run.seed}] ${end} · región ${run.region + 1} · ${fmtClock(run.clock)} (plazo ${fmtClock(run.deadline)}) · tramos ${legs} · vivos ${alive(run).length}/${run.crew.length} · sosp ${run.suspicion.toFixed(0)} · Ψ ${Math.round(run.res.knowledge)} · casco ${hull(run).toFixed(0)} · comb ${run.res.fuel.toFixed(1)} · ₽ ${Math.round(run.res.rubles)} · kills ${run.stats.kills} · dir ${run.stats.directivesOk}/${run.stats.directivesFail} · puntos ${run.over ? computeScore(run) : 0}`);
}
console.log('Finales:', JSON.stringify(endings), '· tramos totales', totalLegs);
