// Logros y registro de expedientes terminados (meta-progresión).

import { alive } from './run.js';
import { computeScore, ENDINGS } from './data/finale.js';

export const ACHIEVEMENTS = {
  despegue: { name: 'Primer despegue', desc: 'Completa tu primer tramo de vuelo.' },
  urales: { name: 'Más allá de los Urales', desc: 'Llega a la Región II.' },
  siberia: { name: 'Siberiano honorario', desc: 'Llega a la Región III.' },
  tunguska: { name: 'Zona prohibida', desc: 'Llega a la Región V.' },
  heroes: { name: 'Héroes de la URSS', desc: 'Consigue el final «Héroes de la Unión Soviética».' },
  verdad: { name: 'La pregunta', desc: 'Descubre la verdad de Tunguska.' },
  cenizas: { name: 'Prometeo', desc: 'Destruye el Objeto.' },
  alaska: { name: 'Chicle y libertad', desc: 'Deserta hacia Alaska.' },
  sinbajas: { name: 'Nadie se queda atrás', desc: 'Termina la misión sin perder a nadie.' },
  as: { name: 'As de la PVO', desc: 'Derriba 5 aparatos en una misma misión.' },
  burocrata: { name: 'Burócrata ejemplar', desc: 'Cumple 6 directivas en una misma misión.' },
  purga: { name: 'Sobrevivir a la Purga', desc: 'Termina la misión en dificultad Purga.' },
  juicio: { name: 'Enemigo del pueblo', desc: 'Pierde por sospecha.' },
  sabio: { name: 'Academia de Ciencias', desc: 'Reúne 80 de conocimiento.' },
};

export function recordRun(app, run) {
  const meta = app.meta;
  if (run.recorded) return null;
  run.recorded = true;
  const E = ENDINGS[run.over.ending];
  const score = computeScore(run);
  const entry = {
    date: Date.now(),
    seed: run.seed,
    difficulty: run.difficulty,
    variant: run.variant,
    ending: run.over.ending,
    kind: E.kind,
    title: E.title,
    score,
    region: run.region,
    day: Math.floor(run.clock / 1440) + 1,
    crew: alive(run).length,
    kills: run.stats.kills,
    km: Math.round(run.stats.km),
    knowledge: Math.round(run.res.knowledge || 0),
  };
  meta.runs = [entry, ...(meta.runs || [])].slice(0, 40);
  meta.totals = meta.totals || { runs: 0, wins: 0, deaths: 0, km: 0 };
  meta.totals.runs++;
  if (E.kind === 'win') meta.totals.wins++;
  meta.totals.deaths += run.stats.deaths;
  meta.totals.km += entry.km;
  // logros
  const got = [];
  const give = (id) => {
    meta.achievements = meta.achievements || {};
    if (!meta.achievements[id]) {
      meta.achievements[id] = Date.now();
      got.push(id);
    }
  };
  if (run.stats.legs >= 1) give('despegue');
  const maxR = Math.max(run.region, run.stats.maxRegion || 0);
  if (maxR >= 1) give('urales');
  if (maxR >= 2) give('siberia');
  if (maxR >= 4) give('tunguska');
  if (['heroes', 'verdad', 'cenizas', 'alaska', 'juicio'].includes(run.over.ending)) give(run.over.ending);
  if (E.kind === 'win' && run.stats.deaths === 0) give('sinbajas');
  if (run.stats.kills >= 5) give('as');
  if (run.stats.directivesOk >= 6) give('burocrata');
  if (E.kind === 'win' && run.difficulty === 'purga') give('purga');
  if ((run.res.knowledge || 0) >= 80) give('sabio');
  // desbloqueos
  meta.unlocked = meta.unlocked || { variants: ['topolev'] };
  const unlockedNow = [];
  if (maxR >= 2 && !meta.unlocked.variants.includes('bogatyr')) {
    meta.unlocked.variants.push('bogatyr');
    unlockedNow.push('T-0B «Bogatyr»');
  }
  if ((maxR >= 4 || E.kind === 'win') && !meta.unlocked.variants.includes('rassvet')) {
    meta.unlocked.variants.push('rassvet');
    unlockedNow.push('T-0R «Rassvet»');
  }
  app.saveMeta();
  return { score, got, unlockedNow, entry };
}
