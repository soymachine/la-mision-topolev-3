// Segundo bloque de eventos: más variedad, rasgos ocultos y cadenas.

import { rng, alive } from '../run.js';
import { displayName, has, a as ga, maxHp } from '../crew.js';
import { TRAITS } from './traits.js';

const R = (run) => rng(run);
const nm = (c) => (c ? displayName(c) : 'alguien');
const someone = (run, filter) => {
  const list = alive(run).filter(filter || (() => true));
  return list.length ? R(run).pick(list) : null;
};
const trade = { label: 'Comerciar y reabastecerse', desc: 'Abrir el mercado del lugar.', end: 'station', fx: () => '' };
const leave = { label: 'Seguir adelante', desc: 'No perder más tiempo.', fx: () => 'Volvéis al avión.' };
const avgMorale = (run) => alive(run).reduce((s, c) => s + c.morale, 0) / Math.max(1, alive(run).length);

export const EVENTS2 = {
  // ---------------------------------------------------------------- AERÓDROMO
  aero_apuesta: {
    where: ['aerodromo'], art: 'aerodromo',
    title: 'La apuesta',
    text: () => 'Los pilotos de un regimiento de transporte se burlan del Topolev: «Esa ballena no da ni una pasada a baja altura». Uno de ellos saca un fajo de rublos.',
    options: [
      { label: 'Apostar 50 ₽ a una pasada rasante', desc: 'Pilotaje 6. Triple o nada.', req: (run) => run.res.rubles >= 50, skill: 'pil', dc: 6,
        ok: (run, ctx, E) => { E.res({ rubles: 100 }); E.morale(8); return `${nm(ctx.actor)} pasa a seis metros de la torre. Los pilotos pagan, pálidos, y os invitan a beber.`; },
        fail: (run, ctx, E) => { E.res({ rubles: -50 }); E.damageHull(5); return 'El tren de aterrizaje se lleva por delante una antena. Los pilotos se ríen hasta llorar.'; } },
      { label: 'Ignorarles', desc: '', fx: () => 'Las risas os siguen hasta la cabina.' },
      trade,
    ],
  },
  aero_combustible: {
    where: ['aerodromo', 'militar'], art: 'aerodromo',
    title: 'Queroseno barato',
    text: () => 'Un sargento de intendencia os ofrece combustible a mitad de precio, «de un lote sobrante». Los bidones no tienen sello.',
    options: [
      { label: 'Comprar 10 t por 70 ₽', desc: 'Puede estar aguado.', req: (run) => run.res.rubles >= 70, fx: (run, ctx, E) => {
        E.res({ rubles: -70, fuel: 10 });
        if (R(run).chance(0.45)) { E.damageModules(25, 2); return 'Al arrancar, los motores tosen agua. Estaba aguado.'; }
        return 'Queroseno de primera. El sargento guiña un ojo.';
      } },
      { label: 'Analizarlo antes de comprar', desc: 'Ingeniería 4.', skill: 'ing', dc: 4,
        ok: (run, ctx, E) => { if (R(run).chance(0.5) && run.res.rubles >= 70) { E.res({ rubles: -70, fuel: 10 }); return `${nm(ctx.actor)} lo prueba: está limpio. Compráis.`; } E.susp(-3); return `${nm(ctx.actor)} demuestra que está aguado. El sargento acaba detenido.`; },
        fail: (run, ctx, E) => `${nm(ctx.actor)} no consigue decidir si es queroseno o té.` },
      trade,
    ],
  },
  // ---------------------------------------------------------------- CIUDAD
  ciudad_periodista: {
    where: ['ciudad', 'aerodromo'], art: 'ciudad',
    title: 'Una entrevista para Pravda',
    text: () => 'Un periodista de Pravda quiere un reportaje sobre «los héroes del Topolev». Trae un fotógrafo y un cuaderno con las preguntas ya respondidas.',
    options: (run) => [
      { label: 'Conceder la entrevista', desc: 'Política 4. Buena propaganda... si nadie habla de más.', skill: 'pol', dc: 4,
        ok: (run, ctx, E) => { E.susp(-6, 'Reportaje elogioso en Pravda'); E.morale(6); if (alive(run).some((c) => has(c, 'bocazas'))) { E.susp(7, 'Un bocazas habló de la Señal ante la prensa'); return 'El reportaje es precioso. Por desgracia, alguien mencionó la Señal y el KGB lo ha leído.'; } return 'Salís en la portada: sonrisas, gorros de piel y un avión enorme.'; },
        fail: (run, ctx, E) => { E.susp(5, 'Entrevista desafortunada'); return 'El periodista escribe exactamente lo que le dijisteis. Ese es el problema.'; } },
      { label: 'Negarse: la misión es secreta', desc: '', fx: (run, ctx, E) => { E.susp(-2); return 'El periodista se va decepcionado; el comisario, satisfecho.'; } },
    ],
  },
  ciudad_mercado_negro: {
    where: ['ciudad', 'aerodromo', 'koljos'], art: 'ciudad',
    title: 'Fartsovshchiki',
    text: () => 'Detrás del hangar, dos chavales con abrigos demasiado buenos venden de todo: penicilina americana, coñac francés, discos de jazz y vaqueros. Aceptan rublos y no hacen preguntas.',
    options: [
      { label: 'Comprar medicinas (60 ₽)', desc: '+5 medicinas. Desleal.', req: (run) => run.res.rubles >= 60, fx: (run, ctx, E) => { E.res({ rubles: -60, meds: 5 }); E.disloyal(3, 'Compras en el mercado negro'); return 'Penicilina de verdad, con prospecto en inglés.'; } },
      { label: 'Comprar discos de jazz (30 ₽)', desc: 'Objeto de moral. Muy desleal.', req: (run) => run.res.rubles >= 30, fx: (run, ctx, E) => { E.res({ rubles: -30 }); const m = E.module({ type: 'moral', quality: 2 }); m.name = 'Discos de jazz de contrabando'; m.item = m.name; m.morale = 4; m.suspicion = 6; m.likes = null; return 'Duke Ellington en un samovar volante. Que no lo vea el comisario.'; } },
      { label: 'Denunciarles', desc: '', fx: (run, ctx, E) => { E.susp(-4, 'Denuncia de especuladores'); return 'Los detienen antes de que despeguéis. Uno os mira con odio.'; } },
    ],
  },
  // ---------------------------------------------------------------- KOLJÓS / ALDEA
  aldea_lobos: {
    where: ['aldea', 'koljos'], regions: [1, 2, 3, 4], art: 'taiga',
    title: 'Los lobos',
    text: () => 'Una manada de lobos ha matado media docena de terneros. Los vecinos tienen escopetas viejas y miedo. Os piden ayuda.',
    options: [
      { label: 'Salir a cazarlos (3 h)', desc: 'Artillería 4.', skill: 'art', dc: 4,
        ok: (run, ctx, E) => { E.time(180); E.res({ rations: 12 }); E.morale(8); return `${nm(ctx.actor)} abate al macho alfa. El pueblo os regala carne ahumada para un mes.`; },
        fail: (run, ctx, E) => { E.time(180); E.hurt(ctx.actor, 22, 'mordiscos de lobo'); return `Los lobos se escabullen. ${nm(ctx.actor)} vuelve con una pierna destrozada.`; } },
      { label: 'Dejarles munición (40)', desc: '', req: (run) => run.res.ammo >= 40, fx: (run, ctx, E) => { E.res({ ammo: -40, rations: 5 }); return 'Os dan las gracias con pan negro y pepinillos.'; } },
      leave,
    ],
  },
  aldea_banya: {
    where: ['aldea', 'koljos'], art: 'aldea',
    title: 'La banya',
    text: () => 'El jefe de la aldea ha encendido la banya en vuestro honor. Vapor, ramas de abedul y un barril de agua helada para salir corriendo a la nieve.',
    options: [
      { label: 'Aceptar (3 h)', desc: 'Fatiga −50, frío 0, moral +10.', fx: (run, ctx, E) => { E.time(180); for (const c of alive(run)) { c.fatigue = Math.max(0, c.fatigue - 50); c.cold = 0; } E.morale(10); E.note('{g}Tripulación descansada{/}'); return 'Salís de la banya como nuevos. Alguien llora de felicidad desnudo en la nieve.'; } },
      { label: 'No hay tiempo', desc: '', fx: () => 'El vapor se escapa por la chimenea mientras despegáis.' },
    ],
  },
  koljos_carta: {
    where: ['koljos', 'aldea'], art: 'koljos',
    title: 'La carta al Comité',
    text: () => 'Los campesinos han escrito una carta: la cuota de grano les deja sin semillas para la primavera. Os suplican que la llevéis a Moscú, en mano, saltándoos al secretario regional.',
    options: [
      { label: 'Llevar la carta', desc: 'Desleal, pero justo.', fx: (run, ctx, E) => { E.disloyal(5, 'Correspondencia no autorizada'); E.morale(6); E.res({ rations: 6 }); return 'Os dan lo poco que tienen. La carta viaja en la bodega, junto al reactor.'; } },
      { label: 'Entregarla al comisario regional', desc: '', fx: (run, ctx, E) => { E.susp(-5, 'Colaboración con las autoridades'); E.morale(-6); return 'El comisario regional sonríe y la guarda en un cajón. Los campesinos no os miran al despegar.'; } },
      { label: 'Rechazarla', desc: '', fx: () => 'Os dan las gracias igualmente. Eso es lo peor.' },
    ],
  },
  // ---------------------------------------------------------------- GULAG
  gulag_fisico: {
    where: ['gulag'], regions: [2, 3, 4], art: 'gulag',
    title: 'El hombre de 1938',
    text: () => 'Un preso anciano pide hablar con «los del avión». Fue miembro de la expedición de Kulik a Tunguska en 1938. Después de aquello, le acusaron de espía. Lleva veintidós años aquí y lo recuerda todo.',
    options: [
      { label: 'Escucharle (2 h)', desc: 'Conocimiento +8.', fx: (run, ctx, E) => { E.time(120); E.know(8); return 'Habla de un cráter que no era un cráter, y de un sonido que salía de debajo de la tierra.'; } },
      { label: 'Llevárselo (soborno: 80 ₽)', desc: 'Un científico veterano a bordo. Muy desleal.', req: (run) => run.res.rubles >= 80, fx: (run, ctx, E) => { E.res({ rubles: -80 }); const c = E.newCrew({ role: 'cientifico', quality: 2, traits: ['erudito'] }); c.age = 71; c.origin = 'Leningrado'; c.hp = 70; E.recruit(c); E.disloyal(10, 'Excarcelación irregular'); return `${nm(c)} sube a bordo con un gorro roto y los ojos brillantes.`; } },
      leave,
    ],
  },
  gulag_escolta: {
    where: ['gulag'], art: 'gulag',
    title: 'Encargo del comandante',
    text: () => 'El comandante necesita trasladar a dos guardias a la siguiente región «por motivos de servicio». No es una petición.',
    options: [
      { label: 'Llevarles', desc: 'Sospecha −8. Comen y no ayudan.', fx: (run, ctx, E) => { E.susp(-8, 'Colaboración con la administración penitenciaria'); E.res({ rations: -6 }); E.morale(-5); return 'Pasan el vuelo jugando a las cartas en el comedor y mirando mal a todo el mundo.'; } },
      { label: 'Excusarse: no hay sitio', desc: 'Política 5.', skill: 'pol', dc: 5,
        ok: () => 'El comandante gruñe, pero acepta la excusa.',
        fail: (run, ctx, E) => { E.susp(7, 'Desaire al comandante del campo'); return '«Ya informaré a quien corresponda», dice. Y lo hará.'; } },
    ],
  },
  // ---------------------------------------------------------------- RESTOS
  restos_trampa: {
    where: ['restos'], regions: [1, 2, 3, 4], art: 'restos',
    title: 'Algo no encaja',
    text: () => 'Los restos parecen intactos, demasiado intactos. Alrededor hay huellas recientes que se detienen de golpe. El ingeniero señala un cable fino que cruza la nieve.',
    options: [
      { label: 'Desactivar la trampa y saquear', desc: 'Ingeniería 6.', skill: 'ing', dc: 6,
        ok: (run, ctx, E) => { E.res({ parts: 12, ammo: 40 }); E.module({ quality: 2 }); return `${nm(ctx.actor)} corta el cable con unos alicates temblorosos. Debajo hay un alijo de contrabandistas.`; },
        fail: (run, ctx, E) => { E.hurt(ctx.actor, 30, 'una mina'); E.damageHull(4); return 'La explosión levanta una columna de nieve y metal.'; } },
      { label: 'Alejarse con cuidado', desc: '', fx: () => 'Hay cosas que es mejor dejar donde están.' },
    ],
  },
  restos_capsula: {
    where: ['restos', 'anomalia'], regions: [2, 3, 4], art: 'restos',
    title: 'La cápsula',
    text: () => 'Entre los árboles hay una esfera metálica chamuscada, con la pintura «СССР» medio borrada. Una cápsula espacial. Ninguna noticia habló nunca de un lanzamiento fallido. Dentro hay alguien con escafandra.',
    options: [
      { label: 'Informar a Moscú', desc: 'Lo correcto. Moral −.', fx: (run, ctx, E) => { E.susp(-10, 'Hallazgo de material espacial clasificado'); E.morale(-8); return 'Moscú responde en minutos: «Olvidad lo que habéis visto». Nadie lo olvida.'; } },
      { label: 'Quedarse con el equipo de radio', desc: 'Módulo experimental. Desleal.', fx: (run, ctx, E) => { E.module({ type: 'radio', quality: 3 }); E.disloyal(6, 'Sustracción de material espacial'); return 'El cosmonauta se queda en la nieve, con su secreto. Le cubrís con una bandera.'; } },
      { label: 'Enterrarle con honores', desc: 'Moral +, una hora.', fx: (run, ctx, E) => { E.time(60); E.morale(6); return 'Una cruz de abedul y una estrella de lata. Sin nombre: no lo sabéis.'; } },
    ],
  },
  // ---------------------------------------------------------------- ESTACIÓN
  estacion_perra: {
    where: ['estacion', 'aldea', 'militar'], art: 'estacion',
    title: 'La perra',
    text: () => 'Una perra callejera con una oreja caída se ha subido a la escalerilla y se niega a bajar. El jefe de la estación dice que se llama Strelka, «como la del cosmos», y que traía buena suerte.',
    options: [
      { label: 'Adoptarla', desc: 'Moral a bordo +.', fx: (run, ctx, E) => { const m = E.module({ type: 'moral', quality: 2 }); m.name = 'Strelka, perra de a bordo'; m.item = m.name; m.morale = 4; m.likes = null; m.suspicion = 0; return 'Strelka elige la litera del comisario. Nadie se atreve a moverla.'; } },
      { label: 'Bajarla con cuidado', desc: '', fx: (run, ctx, E) => { E.morale(-3); return 'Os mira despegar desde la pista, moviendo la cola.'; } },
    ],
  },
  estacion_radiotelescopio: {
    where: ['estacion'], art: 'estacion',
    title: 'El radiotelescopio',
    text: () => 'La estación tiene un radiotelescopio construido con chatarra militar. Si lo calibráis con vuestra radio, podréis triangular la Señal… y ver todo lo que hay en esta región.',
    options: [
      { label: 'Calibrarlo juntos (2 h)', desc: 'Radio 5.', skill: 'rad', dc: 5,
        ok: (run, ctx, E) => { E.time(120); E.know(6); for (const n of run.map.nodes) n.known = true; E.note('{g}Todo el mapa revelado{/}'); return 'Durante un minuto, la Señal y el telescopio laten al unísono.'; },
        fail: (run, ctx, E) => { E.time(120); E.know(2); return 'Solo captáis la emisora de Radio Moscú y un partido de hockey.'; } },
      leave,
    ],
  },
  // ---------------------------------------------------------------- ANOMALÍA
  anomalia_voz: {
    where: ['anomalia'], art: 'anomalia',
    title: 'La voz en la radio',
    text: (run) => { const c = someone(run); run.flags.vozCrew = c?.id; return `La radio se enciende sola. Una voz de mujer pronuncia el nombre de ${nm(c)}: dice que es su madre. Su madre murió en el sitio de Leningrado.`; },
    options: [
      { label: 'Escuchar lo que dice', desc: 'Conocimiento +7. Alguien sufrirá.', fx: (run, ctx, E) => { E.know(7); const c = run.crew.find((x) => x.id === run.flags.vozCrew); if (c) E.morale(-25, c); return 'La voz describe un lugar con un detalle imposible. Después repite el nombre, una y otra vez, hasta que alguien arranca los cables.'; } },
      { label: 'Apagar la radio', desc: '', fx: (run, ctx, E) => { E.morale(-3); return 'El silencio es peor.'; } },
    ],
  },
  anomalia_nieve: {
    where: ['anomalia'], regions: [2, 3, 4], art: 'anomalia',
    title: 'Nieve negra',
    text: () => 'Cae nieve negra. No es hollín: los copos son perfectos, hexagonales, y crujen como cristal. Donde tocan la piel dejan una marca fría que tarda horas en irse.',
    options: [
      { label: 'Recoger muestras', desc: 'Ciencia 4. Radiación.', skill: 'cie', dc: 4,
        ok: (run, ctx, E) => { E.know(9); E.rad(5); return 'Bajo el microscopio, cada copo contiene el mismo patrón de círculos concéntricos.'; },
        fail: (run, ctx, E) => { E.know(3); E.rad(12); return 'Las muestras se funden en el frasco. La radiación, no.'; } },
      { label: 'Despegar sin tocar nada', desc: '', fx: () => 'La nieve negra cubre las alas hasta que el viento se la lleva.' },
    ],
  },
  anomalia_brujula: {
    where: ['anomalia', 'aldea', 'restos'], regions: [3, 4], art: 'taiga',
    title: 'El norte que no está',
    text: () => 'Todas las brújulas señalan al este. Las estrellas no están donde deberían. El navegante revisa sus cartas tres veces.',
    options: [
      { label: 'Confiar en el navegante', desc: 'Navegación 6.', skill: 'nav', dc: 6,
        ok: (run, ctx, E) => { E.know(4); return `${nm(ctx.actor)} se orienta por el sonido de la Señal. Funciona.`; },
        fail: (run, ctx, E) => { E.time(240); E.res({ fuel: -2 }); return 'Cuatro horas de vueltas en círculo antes de reconocer el río.'; } },
      { label: 'Esperar al amanecer (5 h)', desc: '', fx: (run, ctx, E) => { E.time(300); for (const c of alive(run)) c.fatigue = Math.max(0, c.fatigue - 30); return 'Con el sol, el mundo vuelve a su sitio.'; } },
    ],
  },
  // ---------------------------------------------------------------- MILITAR
  militar_codigos: {
    where: ['militar'], art: 'militar',
    title: 'Códigos nuevos',
    text: () => 'El oficial de transmisiones os ofrece las tablas de códigos IFF actualizadas para toda la región. Así ninguna batería os disparará por error.',
    options: [
      { label: 'Aceptar los códigos (1 h)', desc: 'El próximo encuentro con la PVO se resuelve solo.', fx: (run, ctx, E) => { E.time(60); run.flags.iffCodes = 2; E.note('{g}Códigos IFF actualizados (2 usos){/}'); return 'Memorizáis las tablas y quemáis las copias.'; } },
      trade,
    ],
  },
  militar_revista: {
    where: ['militar'], art: 'militar',
    title: 'Revista de armamento',
    text: () => 'Un mayor de artillería quiere inspeccionar vuestras torretas. «Por curiosidad profesional», dice. Trae una libreta.',
    options: (run) => {
      const ame = Object.values(run.ship.slots).some((m) => m && m.type === 'arma' && m.affixes.includes('americano'));
      return [
        { label: 'Enseñarle las torretas', desc: ame ? 'Hay un cañón americano instalado…' : 'Todo es reglamentario.', fx: (run, ctx, E) => {
          if (ame) {
            const id = Object.keys(run.ship.slots).find((k) => run.ship.slots[k]?.type === 'arma' && run.ship.slots[k].affixes.includes('americano'));
            run.ship.slots[id] = null;
            E.susp(10, 'Armamento extranjero confiscado');
            return 'El mayor confisca el cañón americano y lo anota todo.';
          }
          E.res({ ammo: 60 });
          return '«Material soviético, material fiable». Os regala munición.';
        } },
        { label: 'Distraerle con vodka (3)', desc: '', req: (run) => run.res.vodka >= 3, fx: (run, ctx, E) => { E.res({ vodka: -3 }); return 'La inspección termina en el comedor, cantando «Katiusha».'; } },
      ];
    },
  },
  // ---------------------------------------------------------------- TRIPULACIÓN (cualquier sitio)
  cumple: {
    where: ['aerodromo', 'koljos', 'aldea', 'ciudad', 'militar', 'estacion'], art: 'fiesta',
    title: 'Cumpleaños a bordo',
    text: (run) => { const c = someone(run); run.flags.cumple = c?.id; return `Hoy es el cumpleaños de ${nm(c)}. Lo ha dicho sin querer, y ya es tarde para disimular.`; },
    options: [
      { label: 'Celebrarlo (−2 vodka)', desc: 'Moral +10.', req: (run) => run.res.vodka >= 2, fx: (run, ctx, E) => { E.res({ vodka: -2 }); E.morale(10); return 'Una tarta de galletas y leche condensada, velas de emergencia y un brindis desafinado.'; } },
      { label: 'Felicitarle y seguir', desc: '', fx: (run, ctx, E) => { const c = run.crew.find((x) => x.id === run.flags.cumple); if (c) E.morale(4, c); return 'Un apretón de manos. No es mucho, pero se agradece.'; } },
    ],
  },
  malas_noticias: {
    where: ['aerodromo', 'ciudad', 'militar'], art: 'correo',
    title: 'Un telegrama',
    text: (run) => { const c = someone(run); run.flags.telegrama = c?.id; return `Un telegrama para ${nm(c)}. Lo lee dos veces, lo dobla con cuidado y se sienta en el suelo del hangar.`; },
    options: [
      { label: 'Hablar con calma', desc: 'Política 3.', skill: 'pol', dc: 3,
        ok: (run, ctx, E) => { const c = run.crew.find((x) => x.id === run.flags.telegrama); if (c) E.morale(5, c); return 'No hay palabras que sirvan, pero el silencio compartido ayuda.'; },
        fail: (run, ctx, E) => { const c = run.crew.find((x) => x.id === run.flags.telegrama); if (c) E.morale(-20, c); return 'Las frases de manual suenan huecas. Se encierra en el dormitorio.'; } },
      { label: 'Darle un día libre en tierra (8 h)', desc: 'Retraso, pero recuperación.', fx: (run, ctx, E) => { E.time(480); const c = run.crew.find((x) => x.id === run.flags.telegrama); if (c) { c.morale = Math.max(c.morale, 60); c.fatigue = 0; } return 'Vuelve al amanecer con los ojos rojos y dispuesto a seguir.'; } },
    ],
  },
  desercion: {
    where: ['aerodromo', 'ciudad', 'koljos', 'aldea'], cond: (run) => avgMorale(run) < 38 && alive(run).length > 3, weight: 3, art: 'aerodromo',
    title: 'Quiero bajarme',
    text: (run) => { const c = someone(run, (x) => x.role !== 'comisario'); run.flags.desertor = c?.id; return `${nm(c)} se planta frente a vosotros con el petate al hombro: «No sigo. Que me fusilen si quieren, pero no vuelvo a subir a ese trasto».`; },
    options: [
      { label: 'Convencerle', desc: 'Política 5.', skill: 'pol', dc: 5,
        ok: (run, ctx, E) => { const c = run.crew.find((x) => x.id === run.flags.desertor); if (c) E.morale(20, c); return 'Tras una hora de conversación, deja el petate en su litera.'; },
        fail: (run, ctx, E) => { const c = run.crew.find((x) => x.id === run.flags.desertor); if (c) { c.dead = true; c.removed = true; c.cause = 'desertó'; c.diedAt = run.clock; } E.disloyal(6, 'Deserción en la tripulación'); E.morale(-6); return 'Se marcha caminando por la pista sin mirar atrás.'; } },
      { label: 'Dejarle marchar', desc: 'Moscú no lo verá con buenos ojos.', fx: (run, ctx, E) => { const c = run.crew.find((x) => x.id === run.flags.desertor); if (c) { c.dead = true; c.removed = true; c.cause = 'licenciado'; c.diedAt = run.clock; } E.susp(4, 'Baja no autorizada'); return 'Le dais la mano. Es lo último que sabéis de él.'; } },
      { label: 'Amenazarle con el tribunal', desc: 'Se queda… resentido.', fx: (run, ctx, E) => { const c = run.crew.find((x) => x.id === run.flags.desertor); if (c) { c.morale = 10; } E.susp(-2); return 'Sube a bordo. No vuelve a dirigiros la palabra.'; } },
    ],
  },
  sabotaje_pista: {
    where: ['aerodromo', 'militar', 'ciudad', 'aldea', 'koljos', 'restos', 'estacion', 'gulag'], weight: 4,
    cond: (run) => (run.flags.sabotages || 0) >= 1 && alive(run).some((c) => has(c, 'saboteador') && !c.revealed.saboteador),
    art: 'expediente',
    title: 'Huellas de grasa',
    text: () => 'Revisando la última avería, el ingeniero encuentra huellas de grasa en un panel que nadie debería haber abierto. Y una colilla de una marca que solo fuma una persona a bordo.',
    options: [
      { label: 'Investigar a fondo', desc: 'Política o Ingeniería: descubrir al culpable.', skill: 'ing', dc: 4,
        ok: (run, ctx, E) => { const c = alive(run).find((x) => has(x, 'saboteador')); if (c) { c.revealed.saboteador = true; run.pendingReveal = run.pendingReveal || []; run.pendingReveal.push({ crew: c.id, trait: 'saboteador' }); } return `Todo apunta a ${nm(c)}. El comisario abre un expediente.`; },
        fail: () => 'Las huellas no llevan a ninguna parte. Alguien a bordo respira aliviado.' },
      { label: 'Dejarlo estar', desc: '', fx: () => 'Quizá fue un accidente. Quizá no.' },
    ],
  },
  informante_nota: {
    where: ['aerodromo', 'militar', 'ciudad'], weight: 3,
    cond: (run) => alive(run).some((c) => has(c, 'informante') && !c.revealed.informante),
    art: 'kgb',
    title: 'La nota',
    text: () => 'Desde la ventanilla del comedor veis a alguien de la tripulación entregar un sobre a un hombre de abrigo gris junto al depósito de combustible. El hombre lo guarda sin mirarlo.',
    options: [
      { label: 'Acercarse a ver quién es', desc: 'Pilotaje no; agilidad. Sale bien casi siempre.', fx: (run, ctx, E) => { const c = alive(run).find((x) => has(x, 'informante')); if (c) { c.revealed.informante = true; run.pendingReveal = run.pendingReveal || []; run.pendingReveal.push({ crew: c.id, trait: 'informante' }); } return `Es ${nm(c)}. Os ve. Sonríe como si nada.`; } },
      { label: 'No querer saberlo', desc: '', fx: () => 'Hay preguntas que en este país es mejor no hacerse.' },
    ],
  },
};
