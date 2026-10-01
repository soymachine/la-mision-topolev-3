// Directivas de Moscú y mensajes de radio.

import { rng, log, addRes, addSuspicion, alive, fmtClock } from './run.js';
import { NODE_TYPES } from './data/regions.js';
import { reveal } from './map.js';
import { clamp } from '../engine/util.js';

const RES_NAMES = { rations: 'raciones', parts: 'piezas', meds: 'medicinas', vodka: 'botellas de vodka', ammo: 'cajas de munición' };

export function activeDirectives(run) {
  return run.directives.filter((d) => d.status === 'active');
}

export function genDirective(run, forceKind) {
  const r = rng(run);
  const map = run.map;
  const cur = map.nodes[map.cur];
  const ahead = map.nodes.filter((n) => n.col > cur.col && n.col < 6);
  const kinds = [];
  if (ahead.length) kinds.push(['visitar', 3]);
  const delTypes = ['koljos', 'aldea', 'ciudad', 'gulag', 'estacion', 'aerodromo'].filter((t) => ahead.some((n) => n.type === t));
  if (delTypes.length) kinds.push(['entregar', 3]);
  kinds.push(['sin_bajas', 1.5], ['plazo', 2], ['informes', 2]);
  if (run.region >= 1) kinds.push(['conocimiento', 1.5]);
  kinds.push(['derribar', run.region >= 1 ? 1.5 : 0.6]);
  const used = new Set(activeDirectives(run).map((d) => d.kind));
  const avail = kinds.filter(([k]) => !used.has(k));
  if (!avail.length) return null;
  const kind = forceKind || r.weighted(avail);
  const d = { id: 'd' + (run.directives.length + 1) + '_' + r.int(100, 999), kind, region: run.region, status: 'active', progress: 0, need: 1, issued: run.clock };
  const susp = r.int(8, 14);
  d.reward = { suspicion: -susp, rubles: r.int(6, 14) * 10 };
  d.penalty = { suspicion: Math.round(susp * 0.8) };
  switch (kind) {
    case 'visitar': {
      const n = r.pick(ahead);
      d.target = n.id;
      n.known = true;
      d.text = `Aterrizad en ${n.name}.`;
      d.why = r.pick(['Un camarada del Partido os espera allí con documentos.', 'Hay que inspeccionar las instalaciones.', 'Moscú quiere fotografías del lugar.', 'Recoged un paquete sellado.']);
      break;
    }
    case 'entregar': {
      const type = r.pick(delTypes);
      const res = r.pick(Object.keys(RES_NAMES).filter((k) => k !== 'ammo' || type === 'aerodromo'));
      const amount = res === 'rations' ? r.int(8, 14) : res === 'parts' ? r.int(6, 10) : res === 'ammo' ? r.int(40, 60) : r.int(2, 4);
      d.nodeType = type;
      d.res = res;
      d.need = amount;
      d.text = `Entregad ${amount} ${RES_NAMES[res]} en un ${NODE_TYPES[type].name.toLowerCase()} de esta región.`;
      d.why = 'La solidaridad socialista no es opcional.';
      d.reward.rubles += amount * 6;
      break;
    }
    case 'sin_bajas':
      d.text = 'Cruzad esta región sin perder a ningún tripulante.';
      d.why = 'Cada camarada es propiedad del pueblo soviético.';
      break;
    case 'plazo': {
      const hours = r.int(30, 44);
      d.deadline = run.clock + hours * 60;
      d.text = `Cruzad la frontera de la región antes de ${fmtClock(d.deadline)}.`;
      d.why = 'El Comité Central se impacienta.';
      break;
    }
    case 'informes':
      d.need = r.int(3, 5);
      d.text = `El comisario debe enviar ${d.need} informes antes de la frontera.`;
      d.why = 'La Lubianka quiere saberlo todo.';
      break;
    case 'conocimiento':
      d.need = Math.round((run.res.knowledge || 0) + r.int(8, 14) + run.region * 2);
      d.text = `Reunid ${d.need} de conocimiento sobre la Señal antes de la frontera.`;
      d.why = 'La Academia de Ciencias exige datos.';
      break;
    case 'derribar':
      d.need = r.int(1, 2);
      d.text = `Derribad ${d.need} aparato${d.need > 1 ? 's' : ''} intruso${d.need > 1 ? 's' : ''} en esta región.`;
      d.why = 'El espacio aéreo soviético es sagrado.';
      d.reward.rubles += 60;
      break;
    default:
      break;
  }
  run.directives.push(d);
  log(run, `Nueva directiva: ${d.text}`, 'party');
  return d;
}

function complete(run, d, ok) {
  if (d.status !== 'active') return;
  d.status = ok ? 'done' : 'failed';
  d.closed = run.clock;
  if (ok) {
    run.stats.directivesOk++;
    addSuspicion(run, d.reward.suspicion, `Directiva cumplida: ${d.text}`);
    if (d.reward.rubles) addRes(run, 'rubles', d.reward.rubles);
  } else {
    run.stats.directivesFail++;
    addSuspicion(run, d.penalty.suspicion, `Directiva incumplida: ${d.text}`);
  }
  return d;
}

// Comprobaciones al llegar a un nodo. Devuelve mensajes para mostrar.
export function onArrive(run, node) {
  const out = [];
  for (const d of activeDirectives(run)) {
    if (d.kind === 'visitar' && d.target === node.id) {
      complete(run, d, true);
      out.push(`{g}Directiva cumplida:{/} ${d.text}`);
    }
    if (d.kind === 'entregar' && d.nodeType === node.type) {
      if ((run.res[d.res] || 0) >= d.need) {
        addRes(run, d.res, -d.need);
        complete(run, d, true);
        out.push(`{g}Entrega realizada:{/} ${d.need} ${RES_NAMES[d.res]}.`);
      } else out.push(`{r}No tenéis suficientes ${RES_NAMES[d.res]} para la entrega ordenada.{/}`);
    }
  }
  return out;
}

export function onKill(run) {
  for (const d of activeDirectives(run)) {
    if (d.kind === 'derribar') {
      d.progress++;
      if (d.progress >= d.need) complete(run, d, true);
    }
  }
}

export function onReport(run) {
  for (const d of activeDirectives(run)) {
    if (d.kind === 'informes') {
      d.progress++;
      if (d.progress >= d.need) complete(run, d, true);
    }
  }
}

export function onDeath(run) {
  for (const d of activeDirectives(run)) if (d.kind === 'sin_bajas') complete(run, d, false);
}

// Al cruzar la frontera regional: cerrar las directivas de la región
export function closeRegion(run) {
  const out = [];
  for (const d of activeDirectives(run)) {
    if (d.region !== run.region) continue;
    let ok = false;
    if (d.kind === 'sin_bajas') ok = true;
    else if (d.kind === 'plazo') ok = run.clock <= d.deadline;
    else if (d.kind === 'conocimiento') ok = (run.res.knowledge || 0) >= d.need;
    complete(run, d, ok);
    out.push(`${ok ? '{g}Cumplida' : '{r}Incumplida'}:{/} ${d.text}`);
  }
  return out;
}

// --- Mensajes de radio ---------------------------------------------------------
export function newMessage(run) {
  const r = rng(run);
  const types = [['directiva', activeDirectives(run).length < 3 ? 3 : 0], ['intel', 2.5], ['propaganda', 1.5], ['senal', run.region >= 2 ? 2 : 0.5], ['aviso', 1.2]];
  return { type: r.weighted(types.filter(([, w]) => w > 0)) };
}

export function handleMessage(run, msg) {
  const r = rng(run);
  switch (msg.type) {
    case 'directiva': {
      const d = genDirective(run);
      return d ? `Mensaje de Moscú: ${d.text}` : 'Mensaje de Moscú: «Continuad».';
    }
    case 'intel': {
      const n = reveal(run.map, 30 + r.int(0, 20));
      return n ? `Información de inteligencia: ${n} puntos del mapa identificados.` : 'Información de inteligencia sin novedades.';
    }
    case 'propaganda':
      for (const c of alive(run)) c.morale = clamp(c.morale + 6, 0, 100);
      return r.pick(['Radio Moscú emite la Marcha de los Entusiastas. La tripulación tararea.', 'Mensaje del Comité Central: «Todo el país os mira con orgullo».', 'Un locutor lee los logros de la cosecha. Alguien aplaude, sin ironía.']);
    case 'senal':
      addRes(run, 'knowledge', r.int(2, 4));
      return 'Entre la estática: una secuencia de pulsos que no es humana. Conocimiento +.';
    case 'aviso':
      run.flags.warned = (run.flags.warned || 0) + 1;
      return 'Aviso de la PVO: actividad aérea no identificada en la región. Torretas preparadas.';
    default:
      return 'Estática.';
  }
}
