// Prueba de simulación sin navegador: vuelos completos acelerados.
import { newRun, alive, fmtClock } from '../js/game/run.js';
import { createFlight, stepFlight } from '../js/game/flight.js';
import { neighborsOf } from '../js/game/map.js';
import { hull } from '../js/game/fcore.js';

const N = Number(process.argv[2] || 3);
let errors = 0;
for (let k = 0; k < N; k++) {
  const run = newRun({ seed: 'TEST' + k, difficulty: ['camarada', 'estajanovista', 'purga'][k % 3] });
  run.phase = 'map';
  for (let leg = 0; leg < 6 && !run.over; leg++) {
    const nb = neighborsOf(run.map, run.map.cur);
    if (!nb.length) break;
    const to = nb[0];
    const f = createFlight(run, to);
    let guard = 0;
    while (!f.arrived && !run.over && guard < 20000) {
      stepFlight(run, 0.1);
      if (f.popups.length) f.popups.length = 0;
      guard++;
    }
    const counts = {};
    for (const t of f.tasks) counts[t.type] = (counts[t.type] || 0) + 1;
    console.log(`[${run.seed}] tramo ${leg}: ${f.arrived ? 'llegada' : 'NO'} t=${f.t.toFixed(0)}min dist=${f.dist} km=${f.done.toFixed(0)} comb=${run.res.fuel.toFixed(1)} casco=${hull(run).toFixed(0)} vivos=${alive(run).length} heat=${run.ship.heat.toFixed(0)} comidas=${run.res.meals} rac=${run.res.rations} sosp=${run.suspicion.toFixed(0)} ${fmtClock(run.clock)}`);
    console.log('   tareas:', JSON.stringify(counts), 'alertas:', f.alerts.map((a) => a.text).slice(-4).join(' | '));
    for (const c of run.crew) console.log(`     ${c.sur.padEnd(14)} hp=${c.hp.toFixed(0)} fat=${c.fatigue.toFixed(0)} ham=${c.hunger.toFixed(0)} fr=${c.cold.toFixed(0)} mor=${c.morale.toFixed(0)} act=${c.act?.kind || '-'} ${c.dead ? 'MUERTO ' + c.cause : ''}`);
    run.map.cur = to;
    run.flight = null;
  }
  if (run.over) console.log('FIN:', run.over);
}
console.log(errors ? `${errors} errores` : 'OK');
