// Sesión informativa inicial, el Epicentro y los finales.

import { alive, fmtClock, DIFFICULTY } from '../run.js';
import { displayName, has } from '../crew.js';

export function briefingText(run) {
  const days = (run.deadline / 1440).toFixed(1).replace('.0', '');
  return [
    '{d}MOSCÚ · 14 DE OCTUBRE DE 1961{/}',
    '{r}ORDEN Nº 0017/СС — ALTO SECRETO — EJEMPLAR ÚNICO{/}',
    '',
    'Desde el 2 de septiembre, las estaciones de escucha de Krasnoyarsk registran una transmisión de origen desconocido procedente de la cuenca del río Podkamennaya Tunguska: el lugar exacto donde, en 1908, una explosión arrasó dos mil kilómetros cuadrados de taiga.',
    '',
    'La señal no responde a ningún código conocido. Se repite cada 61 minutos. {O}Se intensifica.{/} Tres expediciones terrestres han desaparecido sin dejar rastro.',
    '',
    `El Comité Central ordena: el avión-laboratorio atómico {O}${run.ship.name}{/} volará desde Moscú hasta el epicentro, atravesando cinco regiones de la Unión, localizará el origen de la señal y recuperará el objeto que la emite.`,
    '',
    `Plazo: {y}${days} días{/} (hasta el ${fmtClock(run.deadline)}).`,
    'La tripulación responde ante el Partido. El Comité de Seguridad del Estado seguirá cada uno de sus pasos.',
    '',
    '{d}Firmado: ████████████, secretario del Comité Central.{/}',
  ].join('\n');
}

export const FINALE = {
  epicentro: {
    special: true, art: 'epicentro',
    title: 'El Epicentro',
    text: (run) => {
      const k = run.res.knowledge || 0;
      let t = 'El Topolev se posa en el centro del círculo. Alrededor, millones de árboles muertos apuntan hacia fuera, como agujas de una brújula que se volvió loca hace medio siglo. En el centro exacto hay un hoyo perfecto, y en el fondo del hoyo, {v}el Objeto{/}: una esfera negra de tres metros que no refleja la luz de las linternas.\n\nLa Señal ya no suena en la radio. Suena dentro de vuestras cabezas.';
      if (k >= 40) t += '\n\n{v}Con todo lo que habéis aprendido, empezáis a entender: la Señal no es una llamada. Es una pregunta.{/}';
      if (k >= 70) t += '\n\n{v}Y sabéis cómo responderla.{/}';
      return t;
    },
    options: (run) => [
      { label: 'Cargar el Objeto y regresar a Moscú', desc: 'Cumplir las órdenes. El Partido decidirá.', fx: () => '', end: run.suspicion < 60 ? 'ending:heroes' : 'ending:traicionados' },
      { label: 'Estudiarlo aquí mismo y responder a la Señal', desc: 'Requiere 40 de conocimiento y alguien con Ciencia 4+.', req: (run) => (run.res.knowledge || 0) >= 40 && alive(run).some((c) => c.skills.cie >= 4), fx: () => '', end: (run.res.knowledge || 0) >= 70 ? 'ending:verdad' : 'ending:respuesta' },
      { label: 'Destruirlo sobrecargando el reactor', desc: 'Nadie más debe tenerlo. El Topolev no volverá a volar.', req: (run) => !!run.ship.slots.reactor_core, fx: () => '', end: 'ending:cenizas' },
      { label: 'Cargarlo y desertar hacia Alaska', desc: 'Requiere 15 t de combustible. No hay vuelta atrás.', req: (run) => run.res.fuel >= 15, fx: () => '', end: 'ending:alaska' },
    ],
  },
};

// Finales. kind: 'win' | 'lose'. score: base.
export const ENDINGS = {
  heroes: {
    kind: 'win', score: 1500, title: 'HÉROES DE LA UNIÓN SOVIÉTICA', art: 'moscu',
    text: (run) => `El Objeto viaja a Moscú en la bodega del Topolev, envuelto en lona y plomo. En la Plaza Roja os espera una banda de música, Jruschov en persona y tantas medallas que se os doblan las chaquetas.\n\nEl Objeto desaparece en un sótano del Instituto Nº 9. Nadie os vuelve a preguntar por él. Nadie os pregunta qué oísteis en el epicentro, y vosotros no lo contáis.\n\nPero algunas noches, a las ${['tres', 'cuatro', 'dos'][run.seed.length % 3]} y un minuto, os despertáis con una música que no está en ninguna parte.`,
  },
  traicionados: {
    kind: 'win', score: 900, title: 'MISIÓN CUMPLIDA, TRIPULACIÓN DETENIDA', art: 'kgb',
    text: () => 'Entregáis el Objeto en el aeródromo de Zhukovski. Antes de que se apaguen los motores, el avión está rodeado de soldados. «Por vuestra seguridad, camaradas.»\n\nEl Objeto llega a su destino. Vosotros, a otro: demasiadas preguntas, demasiadas irregularidades en vuestro expediente. La misión figura en los archivos como un éxito. Vuestros nombres, no.',
  },
  verdad: {
    kind: 'win', score: 2600, title: 'LA VERDAD DE TUNGUSKA', art: 'epicentro',
    text: (run) => `Lo que cayó en 1908 no era un meteorito. Era una sonda, y lleva cincuenta y tres años haciendo la misma pregunta a un planeta que no sabía escuchar.\n\nCon el conocimiento acumulado durante el viaje, ${scientist(run)} traduce la respuesta a la frecuencia de la Señal y el Topolev la emite con toda la potencia de su reactor. No es una respuesta soviética ni americana. Es una respuesta humana.\n\nLa esfera se ilumina, se eleva sobre la taiga y se va. Durante tres minutos, todas las radios del mundo —en Moscú, en Washington, en Pekín— reciben el mismo mensaje. Nadie sabe qué decir después. Por primera vez en años, nadie dispara.`,
  },
  respuesta: {
    kind: 'win', score: 1900, title: 'UNA RESPUESTA A MEDIAS', art: 'epicentro',
    text: () => 'Sabéis lo suficiente para responder, pero no para entender del todo la respuesta. Emitís lo que podéis. La esfera vibra, se agrieta y se apaga, como una estrella cansada.\n\nLa Señal deja de sonar. En Moscú lo consideran un éxito. Vosotros pasaréis el resto de vuestras vidas preguntándoos qué habría pasado si hubierais sabido un poco más.',
  },
  cenizas: {
    kind: 'win', score: 1300, title: 'CENIZAS', art: 'epicentro',
    text: () => 'Desembarcáis lo imprescindible, cerráis las escotillas y el ingeniero retira las barras de control. Desde una colina a cinco kilómetros, veis cómo el Topolev se convierte en un segundo sol sobre Tunguska.\n\nCuando el resplandor se apaga, la Señal ha desaparecido. Volvéis a pie, en trineo, en camiones, durante semanas. Moscú clasifica el informe y lo entierra. Nadie más tendrá el Objeto. Quizá era lo correcto.',
  },
  alaska: {
    kind: 'win', score: 1100, title: 'RUMBO A ALASKA', art: 'tormenta',
    text: () => 'El Topolev vira al este con el Objeto en la bodega y la radio apagada. Cruzáis el estrecho de Bering de noche, a ras de las olas, perseguidos por cazas de los dos bandos.\n\nEn Fairbanks os reciben hombres de traje que hablan ruso demasiado bien. En la Unión Soviética, vuestros nombres desaparecen de las fotografías. El Objeto acaba en otro sótano, en otro país. Al menos, piensa alguien, esta vez hay chicle.',
  },
  juicio: {
    kind: 'lose', score: 200, title: 'JUICIO SUMARÍSIMO', art: 'kgb',
    text: () => 'La radio de Moscú deja de responder. En el siguiente aeródromo os espera un pelotón del KGB y una orden de arresto firmada por alguien cuyo nombre nadie se atreve a pronunciar.\n\nEl juicio dura veinte minutos. La Misión Topolev se reasigna a otra tripulación, más leal. Vosotros pasaréis los próximos veinticinco años en un lugar donde la Señal no llega.',
  },
  destruido: {
    kind: 'lose', score: 150, title: 'RESTOS EN LA TAIGA', art: 'restos',
    text: () => 'El fuselaje cruje, se abre, y el Topolev se parte en dos sobre la taiga. Durante un instante eterno, el cielo y el bosque cambian de sitio.\n\nAños después, un cazador evenki encontrará los restos cubiertos de musgo. Moscú nunca reconocerá que existió un avión llamado Topolev.',
  },
  tripulacion: {
    kind: 'lose', score: 100, title: 'SILENCIO EN LA RADIO', art: 'restos',
    text: () => 'Ya no queda nadie a bordo para responder a Moscú. El Topolev vuela con el piloto automático hasta agotar el combustible y planea, en silencio, hacia la nieve.',
  },
  cancelada: {
    kind: 'lose', score: 250, title: 'MISIÓN CANCELADA', art: 'moscu',
    text: () => 'El plazo hace tiempo que expiró. Moscú pierde la paciencia: la misión se cancela por radio y se os ordena regresar de inmediato. Nadie os recibe en Zhukovski excepto un comité de investigación.\n\nOtros llegarán a Tunguska. Otros oirán la Señal. Vosotros solo oiréis preguntas.',
  },
};

function scientist(run) {
  const list = alive(run).sort((a, b) => b.skills.cie - a.skills.cie);
  return list.length ? displayName(list[0]) : 'la tripulación';
}

export function computeScore(run) {
  const E = ENDINGS[run.over?.ending] || { score: 0 };
  const D = { camarada: 0.7, estajanovista: 1, purga: 1.5 }[run.difficulty] || 1;
  let s = E.score;
  s += alive(run).length * 80;
  s += (run.res.knowledge || 0) * 4;
  s += run.stats.directivesOk * 60 - run.stats.directivesFail * 30;
  s += run.region * 150;
  s += run.stats.kills * 25;
  s -= Math.round(run.suspicion * 3);
  if (E.kind === 'win') s += Math.max(0, Math.round((run.deadline - run.clock) / 60)) * 4;
  return Math.max(0, Math.round(s * D));
}
