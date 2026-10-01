// Decisiones emergentes durante el vuelo (polizón, revelaciones de la vigilancia...).

import { rng, addRes, addSuspicion, disloyal, alive, log } from './run.js';
import { genCrew, displayName, has, a as ga } from './crew.js';
import { TRAITS } from './data/traits.js';
import { clamp } from '../engine/util.js';

function removeCrew(run, c, reason) {
  c.dead = true;
  c.removed = true;
  c.cause = reason;
  c.diedAt = run.clock;
  c.act = null;
  c.order = null;
}

export function buildPopup(run, p) {
  const r = rng(run);
  if (p.id === 'polizon') {
    if (!p.crew) {
      const c = genCrew(r, { role: r.pick(['mecanico', 'cocinero', 'artillero', 'preso']), quality: -1 });
      p.crew = c;
    }
    const c = p.crew;
    return {
      title: 'POLIZÓN EN LA BODEGA',
      art: 'polizon',
      text: `Entre los sacos de patatas aparece ${ga(c, 'un hombre flaco', 'una mujer flaca')}, con las manos azules de frío. Dice llamarse {O}${c.first} ${c.sur}{/}, ${c.age} años, de ${c.origin}. «Solo quería salir de allí», murmura. No tiene papeles.`,
      options: [
        { label: `Acogerl${ga(c, 'o', 'a')} como tripulante`, desc: 'Una mano más. Moscú no lo aprobaría.', fx: (run) => {
          c.joined = run.clock;
          run.crew.push(c);
          c.x = 20;
          c.y = 10;
          disloyal(run, 6, 'Habéis acogido a un polizón sin papeles');
          return `${c.first} ${c.sur} se une a la tripulación, agradecid${ga(c, 'o', 'a')}.`;
        } },
        { label: 'Entregarl' + ga(c, 'o', 'a') + ' en la próxima parada', desc: 'Lo correcto según el reglamento.', fx: (run) => {
          addSuspicion(run, -4, 'Polizón entregado a las autoridades');
          return 'Queda encerrad' + ga(c, 'o', 'a') + ' en la bodega hasta la próxima parada.';
        } },
        { label: 'Darle comida y dejarl' + ga(c, 'o', 'a') + ' en la próxima aldea', desc: '−3 raciones. Nadie tiene por qué saberlo.', fx: (run) => {
          addRes(run, 'rations', -3);
          for (const o of alive(run)) o.morale = clamp(o.morale + 4, 0, 100);
          return 'La tripulación aprueba en silencio.';
        } },
      ],
    };
  }
  if (p.id === 'reveal') {
    const c = run.crew.find((x) => x.id === p.crew);
    const T = TRAITS[p.trait];
    const name = c ? displayName(c) : '¿?';
    const base = { title: 'INFORME DE VIGILANCIA', art: 'expediente', text: `El comisario deja un expediente sobre la mesa: {O}${name}{/} — {v}${T.name}{/}. ${T.desc}` };
    if (!c || c.dead) return { ...base, options: [{ label: 'Archivar', fx: () => 'Archivado.' }] };
    if (p.trait === 'informante') {
      return {
        ...base,
        options: [
          { label: 'Fingir que no sabemos nada', desc: 'Seguirá informando: las decisiones desleales costarán el doble.', fx: () => 'Cerráis el expediente y sonreís a ' + name + ' en la cena.' },
          { label: 'Alimentarle con informes falsos', desc: 'Requiere un comisario hábil (Política 5+). Neutraliza al informante.', req: (run) => alive(run).some((x) => x.skills.pol >= 5 && x !== c), fx: (run) => {
            c.traits = c.traits.filter((t) => t !== 'informante');
            c.flags = { ...(c.flags || {}), turned: true };
            addSuspicion(run, -5, 'Los informes de vuestro informante son ahora muy halagadores');
            return `${name} ahora envía a Moscú exactamente lo que vosotros queréis.`;
          } },
          { label: 'Desembarcarle en la próxima parada', desc: 'Una mano menos, pero libres de su lápiz.', fx: (run) => {
            removeCrew(run, c, 'desembarcado (informante)');
            addSuspicion(run, 6, 'El KGB pregunta por qué habéis apartado a su hombre');
            return `${name} recoge sus cosas sin decir palabra.`;
          } },
        ],
      };
    }
    if (p.trait === 'saboteador') {
      return {
        ...base,
        options: [
          { label: 'Arrestarle y entregarle al KGB', desc: 'Sospecha −15. Perdéis un tripulante.', fx: (run) => {
            removeCrew(run, c, 'arrestado (saboteador)');
            addSuspicion(run, -15, 'Saboteador entregado a las autoridades');
            return `${name} acaba esposado a una tubería de la bodega.`;
          } },
          { label: 'Interrogarle', desc: 'Quizá sepa quién le paga. Requiere Política 4+.', req: (run) => alive(run).some((x) => x.skills.pol >= 4 && x !== c), fx: (run) => {
            addRes(run, 'knowledge', 5);
            removeCrew(run, c, 'arrestado (saboteador)');
            addSuspicion(run, -10, 'Confesión obtenida');
            return `${name} habla de «gente en Moscú que no quiere que nadie llegue a Tunguska». Conocimiento +5.`;
          } },
        ],
      };
    }
    if (p.trait === 'disidente') {
      return {
        ...base,
        options: [
          { label: 'Denunciarle', desc: 'Sospecha −8, la tripulación se resiente (−moral).', fx: (run) => {
            removeCrew(run, c, 'denunciado (disidente)');
            addSuspicion(run, -8, 'Disidente denunciado');
            for (const o of alive(run)) o.morale = clamp(o.morale - 8, 0, 100);
            return `Se llevan a ${name} en la siguiente parada. Nadie habla durante horas.`;
          } },
          { label: 'Quemar el expediente', desc: 'Lealtad a la tripulación. Desleal (+sospecha).', fx: (run) => {
            disloyal(run, 6, 'Encubrimiento de un disidente');
            c.morale = clamp(c.morale + 25, 0, 100);
            c.flags = { ...(c.flags || {}), protected: true };
            return `${name} os mira con una gratitud que no olvidaréis.`;
          } },
        ],
      };
    }
    if (p.trait === 'tisis') {
      return {
        ...base,
        options: [
          { label: 'Tratarle (3 medicinas)', desc: 'Detiene la enfermedad.', req: (run) => run.res.meds >= 3, fx: (run) => {
            addRes(run, 'meds', -3);
            c.flags = { ...(c.flags || {}), treated: true };
            c.traits = c.traits.filter((t) => t !== 'tisis');
            return `${name} empieza el tratamiento. Tose menos.`;
          } },
          { label: 'Más adelante', desc: 'Seguirá perdiendo salud poco a poco.', fx: () => 'El expediente queda sobre la mesa.' },
        ],
      };
    }
    if (p.trait === 'oyente') {
      return {
        ...base,
        options: [
          { label: 'Escuchar lo que oye', desc: 'Conocimiento +6.', fx: (run) => {
            addRes(run, 'knowledge', 6);
            return `${name} dibuja con un lápiz la forma de la Señal. Es… un mapa.`;
          } },
          { label: 'Mandarle a la enfermería', desc: 'Moral +10 para el resto, que estaban inquietos.', fx: (run) => {
            for (const o of alive(run)) if (o !== c) o.morale = clamp(o.morale + 10, 0, 100);
            return 'Los demás respiran tranquilos.';
          } },
        ],
      };
    }
    return { ...base, options: [{ label: 'Archivar', fx: () => 'Archivado.' }] };
  }
  return { title: '...', text: '...', options: [{ label: 'Continuar', fx: () => '' }] };
}
