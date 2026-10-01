// Catálogo de eventos narrativos. Cada opción puede llevar tirada (skill/dc) con ok/fail,
// o un efecto directo (fx). end: 'station' abre el comercio del nodo.

import { rng, alive, addRes, fmtClock } from '../run.js';
import { displayName, has, a as ga } from '../crew.js';
import { REGIONS } from './regions.js';
import { FINALE } from './finale.js';
import { EVENTS2 } from './events2.js';
import { genDirective } from '../directives.js';

const R = (run) => rng(run);
const someone = (run, filter) => {
  const list = alive(run).filter(filter || (() => true));
  return list.length ? R(run).pick(list) : null;
};
const nm = (c) => (c ? displayName(c) : 'alguien');
const trade = { label: 'Comerciar y reabastecerse', desc: 'Abrir el mercado del lugar.', end: 'station', fx: () => '' };
const leave = { label: 'Seguir adelante', desc: 'No perder más tiempo.', fx: () => 'Volvéis al avión.' };

export const EVENTS = {
  // ====================================================================== AERÓDROMO
  aero_generico: {
    where: ['aerodromo'], once: false, weight: 2, art: 'aerodromo',
    title: 'Pista helada',
    text: (run, ctx) => `El Topolev toca tierra en ${ctx.node.name} levantando una nube de nieve. Mecánicos con abrigos de piel y bufandas hasta los ojos rodean el avión, boquiabiertos: nunca habían visto nada tan grande. Un oficial de intendencia se acerca con una carpeta y un sello.`,
    options: [trade, leave],
  },
  aero_inspeccion: {
    where: ['aerodromo'], art: 'kgb',
    title: 'Inspección sorpresa',
    text: () => 'Dos hombres de abrigo gris y sombrero idéntico suben por la escalerilla sin pedir permiso. «Comité de Seguridad del Estado. Rutina.» Uno de ellos ya está abriendo las cajas de la bodega.',
    options: (run) => {
      const illegal = Object.values(run.ship.slots).concat(run.inventory).some((m) => m && m.affixes?.includes('americano'));
      return [
        { label: 'Colaborar con la inspección', desc: 'Dos horas de papeleo. Si hay algo extranjero a bordo, lo encontrarán.', fx: (run, ctx, E) => {
          E.time(120);
          const dis = alive(run).find((c) => has(c, 'disidente') && !c.flags?.protected);
          if (dis && R(run).chance(0.5)) {
            dis.revealed.disidente = true;
            E.susp(15, `Literatura prohibida en la taquilla de ${dis.sur}`);
            return `Encuentran libros prohibidos en la taquilla de ${nm(dis)}. Se los llevan, y con ellos vuestra reputación.`;
          }
          if (illegal) {
            E.susp(12, 'Material americano encontrado a bordo');
            return 'Encuentran el equipo americano. Lo fotografían todo, lo anotan todo y se marchan sin decir adiós.';
          }
          E.susp(-6, 'Inspección superada');
          return '«Todo en orden, camaradas.» Os estrechan la mano. Os habéis ganado un punto en algún expediente.';
        } },
        { label: 'Sobornarles (60 ₽)', desc: 'Un sobre discreto puede acortar la rutina.', req: (run) => run.res.rubles >= 60, fx: (run, ctx, E) => {
          E.res({ rubles: -60 });
          if (R(run).chance(0.75)) return 'El sobre desaparece en un bolsillo. «Buen viaje, camaradas.»';
          E.disloyal(10, 'Intento de soborno a agentes del Estado');
          return 'El más joven se ofende y lo anota todo. El otro se queda el sobre igualmente.';
        } },
        { label: 'Invocar la autoridad del Comité Central', desc: 'Política 5: la misión tiene prioridad absoluta.', skill: 'pol', dc: 5,
          ok: (run, ctx, E) => { E.susp(-2); return `${nm(ctx.actor)} agita la orden firmada en Moscú. Los hombres grises palidecen y se disculpan.`; },
          fail: (run, ctx, E) => { E.susp(8, 'Os habéis negado a colaborar con el KGB'); E.time(180); return 'Llaman a Moscú. Tres horas después, os dejan marchar. Pero alguien ha tomado nota.'; } },
      ];
    },
  },
  aero_mecanicos: {
    where: ['aerodromo'], art: 'aerodromo',
    title: 'Los mecánicos de la base',
    text: () => 'El jefe de mecánicos, un ucraniano con las manos negras de grasa, da una vuelta alrededor de vuestros motores y silba. «Esto se cae a pedazos, camaradas. Por una caja de vodka os lo dejo como nuevo.»',
    options: [
      { label: 'Pagar con vodka (4 botellas)', desc: 'Repara todos los módulos +35.', req: (run) => run.res.vodka >= 4, fx: (run, ctx, E) => { E.res({ vodka: -4 }); E.repairAll(35); E.time(90); return 'Trabajan cantando. Al amanecer los motores ronronean.'; } },
      { label: 'Pagar en rublos (90 ₽)', desc: 'Repara todos los módulos +35.', req: (run) => run.res.rubles >= 90, fx: (run, ctx, E) => { E.res({ rubles: -90 }); E.repairAll(35); E.time(90); return 'Cobran, firman un recibo inventado y dejan los motores relucientes.'; } },
      trade,
    ],
  },
  aero_piloto: {
    where: ['aerodromo'], art: 'aerodromo',
    title: 'Un piloto sin avión',
    text: () => 'En la cantina, un piloto con la chaqueta llena de medallas os invita a una ronda. Lo trasladaron aquí «por un malentendido con un general». Quiere volver a volar, en lo que sea.',
    options: (run) => {
      return [
        { label: 'Reclutarle', desc: 'Buen piloto. Bebe demasiado.', fx: (run, ctx, E) => { const p = E.newCrew({ role: 'piloto', quality: 1, traits: ['bebedor'] }); E.recruit(p); return `${nm(p)} se pone la gorra y os sigue a la pista sin despedirse de nadie.`; } },
        { label: 'Brindar y seguir', desc: 'Moral +5, −1 vodka.', req: (run) => run.res.vodka >= 1, fx: (run, ctx, E) => { E.res({ vodka: -1 }); E.morale(5); return 'Cuenta historias de Corea hasta que se queda dormido sobre la mesa.'; } },
        trade,
      ];
    },
  },
  aero_ventisca: {
    where: ['aerodromo', 'militar', 'ciudad'], regions: [1, 2, 3, 4], art: 'tormenta',
    title: 'Ventisca',
    text: () => 'La torre de control cierra el aeródromo: una ventisca baja desde el Ártico y la visibilidad es de diez metros. El controlador os ruega que esperéis.',
    options: [
      { label: 'Esperar a que amaine (5 h)', desc: 'La tripulación descansa algo.', fx: (run, ctx, E) => { E.time(300); for (const c of alive(run)) c.fatigue = Math.max(0, c.fatigue - 40); E.note('{g}La tripulación descansa{/}'); return 'Jugáis al ajedrez mientras la nieve entierra media pista.'; } },
      { label: 'Despegar igualmente', desc: 'Pilotaje 6. El reloj manda.', skill: 'pil', dc: 6,
        ok: (run, ctx, E) => `${nm(ctx.actor)} despega a ciegas guiándose por el sonido de los motores. Los controladores aplauden.`,
        fail: (run, ctx, E) => { E.damageHull(10); E.damageModules(20, 2); return 'Un ala roza un montón de nieve compactada. El Topolev se levanta, herido.'; } },
    ],
  },

  // ====================================================================== KOLJÓS
  koljos_generico: {
    where: ['koljos'], once: false, weight: 2, art: 'koljos',
    title: 'Koljós',
    text: (run, ctx) => `Los campesinos de ${ctx.node.name} salen de las isbas a ver el avión. El presidente del koljós, con un retrato de Jruschov colgando en el despacho, os ofrece patatas, pepinillos y una mirada calculadora: «¿Qué traéis a cambio, camaradas?»`,
    options: [trade, leave],
  },
  koljos_cosecha: {
    where: ['koljos'], art: 'koljos',
    title: 'La cosecha helada',
    text: () => 'Una helada temprana ha sorprendido al koljós con media cosecha de patatas aún enterrada. Mujeres y viejos cavan con las manos desnudas. El presidente os mira, os mira el avión, y no dice nada.',
    options: [
      { label: 'Ayudar a desenterrar (3 h)', desc: 'Trabajo duro, gratitud sincera.', fx: (run, ctx, E) => { E.time(180); E.res({ rations: 14 }); E.morale(8); for (const c of alive(run)) c.fatigue = Math.min(100, c.fatigue + 15); return 'Cuando acabáis os sientan a la mesa y os llenan la bodega de sacos. Una anciana besa la mano de vuestro piloto.'; } },
      { label: 'Requisar víveres en nombre del Partido', desc: 'Legal. Muy legal. Nadie os lo agradecerá.', fx: (run, ctx, E) => { E.res({ rations: 22 }); E.susp(-3); E.morale(-8); return 'Firmáis un recibo con sello oficial. Los campesinos cargan los sacos en silencio. Nadie os despide.'; } },
      leave,
    ],
  },
  koljos_tractor: {
    where: ['koljos', 'aldea'], art: 'koljos',
    title: 'El tractor muerto',
    text: () => 'Un tractor Belarus yace en mitad del camino con el motor abierto. El tractorista, desesperado, dice que sin él no podrán sacar la leña antes de la nevada grande.',
    options: [
      { label: 'Repararlo', desc: 'Ingeniería 4.', skill: 'ing', dc: 4,
        ok: (run, ctx, E) => { E.res({ rations: 8, vodka: 3 }); E.morale(4); return `${nm(ctx.actor)} lo arranca a la tercera. El tractorista llora y os regala su reserva secreta de samogón.`; },
        fail: (run, ctx, E) => { E.res({ parts: -3 }); return `${nm(ctx.actor)} lo intenta durante una hora. El tractor tose, escupe aceite y muere del todo.`; } },
      { label: 'Darle piezas (4)', desc: 'Que lo arregle él.', req: (run) => run.res.parts >= 4, fx: (run, ctx, E) => { E.res({ parts: -4, rations: 6 }); return 'Os da las gracias con un saco de remolachas.'; } },
      leave,
    ],
  },
  koljos_boda: {
    where: ['koljos', 'aldea'], art: 'fiesta',
    title: 'Una boda',
    text: () => 'Hay boda en el pueblo. El acordeón suena desde el granero y os invitan a pasar: «¡Los aviadores dan buena suerte!»',
    options: [
      { label: 'Celebrar con ellos (3 h)', desc: 'Moral +15. Mañana habrá resaca.', fx: (run, ctx, E) => { E.time(180); E.morale(15); E.res({ vodka: 3 }); for (const c of alive(run)) if (!has(c, 'abstemio')) c.drunk = 60; return 'Bailáis hasta que el sol, tímido, asoma sobre los abedules. El navegante ha prometido casarse con alguien.'; } },
      { label: 'Felicitar a los novios y seguir', desc: '', fx: (run, ctx, E) => { E.morale(-2); return 'La tripulación mira con nostalgia el granero iluminado mientras despegáis.'; } },
    ],
  },
  koljos_deportados: {
    where: ['koljos', 'aldea'], regions: [1, 2, 3], art: 'aldea',
    title: 'Los colonos especiales',
    text: () => 'En las afueras hay unas barracas donde viven familias deportadas hace años: alemanes del Volga, chechenos, lituanos. Tienen hambre. Un niño se queda mirando vuestras cajas de raciones.',
    options: [
      { label: 'Darles comida (−8 raciones)', desc: 'Lo humano. No lo reglamentario.', req: (run) => run.res.rations >= 8, fx: (run, ctx, E) => { E.res({ rations: -8 }); E.morale(7); E.disloyal(4, 'Ayuda a deportados'); return 'Una mujer os da a cambio un mapa dibujado a mano: atajos que solo conocen los que caminaron por aquí.'; } },
      { label: 'Informar de su situación a las autoridades', desc: '', fx: (run, ctx, E) => { E.susp(-3); E.morale(-5); return 'El comisario redacta una nota. Nadie sabe si servirá de algo.'; } },
      leave,
    ],
  },

  // ====================================================================== ALDEA
  aldea_generico: {
    where: ['aldea'], once: false, weight: 2, art: 'aldea',
    title: 'Isbas en la nieve',
    text: (run, ctx) => `${ctx.node.name} son veinte casas de madera, una iglesia convertida en almacén y un camino que se pierde en el bosque. Los vecinos, desconfiados, se acercan a vender lo poco que tienen.`,
    options: [
      trade,
      { label: 'Preguntar por la zona', desc: 'Puede revelar parte del mapa.', fx: (run, ctx, E) => {
        let n = 0;
        for (const node of run.map.nodes) if (!node.known && R(run).chance(0.5)) { node.known = true; n++; }
        return n ? `Un viejo cazador os dibuja en la nieve dónde está cada cosa. (${n} lugares revelados)` : 'Nadie sabe nada. O nadie quiere saber.';
      } },
      leave,
    ],
  },
  aldea_babushka: {
    where: ['aldea', 'koljos'], art: 'aldea',
    title: 'La bendición de la abuela',
    text: () => 'Una anciana con pañuelo negro se planta frente al morro del Topolev con un icono y una vela. Quiere bendecir el avión. El comisario carraspea.',
    options: [
      { label: 'Dejarla rezar', desc: 'Moral +, sobre todo para los supersticiosos. Sospecha +.', fx: (run, ctx, E) => {
        E.morale(5);
        for (const c of alive(run)) if (has(c, 'supersticioso')) c.morale = Math.min(100, c.morale + 15);
        E.disloyal(3, 'Ritual religioso a bordo de un aparato del Estado');
        const m = E.module({ type: 'moral', quality: 1 });
        m.name = 'Icono de san Nicolás';
        m.item = m.name;
        m.likes = 'supersticioso';
        return 'Murmura algo antiguo y deja un pequeño icono colgado junto a la escotilla.';
      } },
      { label: 'Explicarle con respeto que es un avión soviético', desc: '', fx: (run, ctx, E) => { E.susp(-1); return '«Dios también es soviético, hijo», contesta, y se va.'; } },
    ],
  },
  aldea_enfermos: {
    where: ['aldea', 'koljos', 'gulag'], art: 'aldea',
    title: 'Fiebre en el pueblo',
    text: () => 'Media aldea está en cama con fiebre alta. El médico más cercano está a trescientos kilómetros. Os ven bajar del avión como si fuerais ángeles con maletines.',
    options: [
      { label: 'Atender a los enfermos (−3 medicinas)', desc: 'Medicina 3.', req: (run) => run.res.meds >= 3, skill: 'med', dc: 3,
        ok: (run, ctx, E) => { E.res({ meds: -3, rations: 10 }); E.morale(10); E.time(120); return `${nm(ctx.actor)} trabaja toda la noche. Por la mañana, los niños ya piden comida. Os despiden con pan y miel.`; },
        fail: (run, ctx, E) => { E.res({ meds: -3 }); E.time(120); const c = ctx.actor; if (c) c.sick = 1; return `La fiebre cede en algunos casos. ${nm(c)} se ha contagiado.`; } },
      { label: 'Dejarles medicinas y seguir (−2)', desc: '', req: (run) => run.res.meds >= 2, fx: (run, ctx, E) => { E.res({ meds: -2 }); E.morale(4); return 'Os dan las gracias con los ojos.'; } },
      leave,
    ],
  },
  aldea_cazador: {
    where: ['aldea'], regions: [2, 3, 4], art: 'taiga',
    title: 'El cazador evenki',
    text: () => 'Un cazador evenki con abrigo de reno examina el avión sin miedo. Conoce la taiga como su casa y dice que puede guiaros. A cambio, quiere ver «la cosa que cayó del cielo».',
    options: [
      { label: 'Aceptarle como guía', desc: 'Navegante siberiano.', fx: (run, ctx, E) => { const c = E.newCrew({ role: 'navegante', quality: 1, traits: ['siberiano'] }); c.origin = 'Tura (Evenkia)'; E.recruit(c); return `${c.first} sube a bordo con un saco de carne seca y una escopeta de 1910.`; } },
      { label: 'Comprarle carne (30 ₽)', desc: '+10 raciones.', req: (run) => run.res.rubles >= 30, fx: (run, ctx, E) => { E.res({ rubles: -30, rations: 10 }); return 'Carne de reno ahumada. La mejor comida en semanas.'; } },
      leave,
    ],
  },
  aldea_leyenda: {
    where: ['aldea', 'estacion'], regions: [3, 4], art: 'taiga',
    title: 'El fuego del cielo',
    text: () => 'Una vieja que tenía doce años en 1908 recuerda la mañana en que el cielo se partió: «Primero, un sol más grande que el sol. Luego el viento, que tumbó el bosque entero. Y después… después la música. Una música que nadie más oyó.»',
    options: [
      { label: 'Escuchar toda la historia (1 h)', desc: 'Conocimiento +4.', fx: (run, ctx, E) => { E.time(60); E.know(4); return 'Dibuja con un palo en la nieve el mismo patrón que el radiogoniómetro registró anoche.'; } },
      { label: 'Grabarla para la Academia', desc: 'Radio 4. Conocimiento +6.', skill: 'rad', dc: 4,
        ok: (run, ctx, E) => { E.know(6); E.time(60); return 'La cinta capta su voz… y, de fondo, un zumbido que no estaba en la habitación.'; },
        fail: (run, ctx, E) => { E.know(2); E.time(60); return 'La grabadora se estropea a mitad del relato.'; } },
    ],
  },

  // ====================================================================== CIUDAD CERRADA
  ciudad_generico: {
    where: ['ciudad'], once: false, weight: 2, art: 'ciudad',
    title: 'Ciudad que no existe',
    text: (run, ctx) => `${ctx.node.name} no figura en ningún mapa. Bloques de hormigón, chimeneas, una estatua de Lenin señalando al futuro y tres controles de documentos antes de llegar a la pista. El secretario local del Partido os recibe con una sonrisa ensayada.`,
    options: [
      trade,
      { label: 'Ofrecerse para un encargo del Partido', desc: 'Nueva directiva.', hidden: (run) => run.directives.filter((d) => d.status === 'active').length >= 3, fx: (run, ctx, E) => { const d = genDirective(run); return d ? `El secretario os entrega un sobre lacrado: «${d.text}»` : 'El secretario no tiene nada para vosotros.'; } },
      leave,
    ],
  },
  ciudad_banquete: {
    where: ['ciudad'], art: 'ciudad',
    title: 'Banquete oficial',
    text: () => 'El director de la planta organiza un banquete en vuestro honor: esturión, caviar, coñac armenio y brindis interminables por el Comité Central. Asistir es casi obligatorio.',
    options: [
      { label: 'Asistir (3 h)', desc: 'Sospecha −8, moral +, resaca.', fx: (run, ctx, E) => { E.time(180); E.susp(-8, 'Excelente impresión ante las autoridades'); E.morale(6); E.res({ rations: 6 }); for (const c of alive(run)) if (!has(c, 'abstemio')) c.drunk = 50; return 'Brindáis por Gagarin, por Lenin, por la paz y por el Topolev. Varias veces.'; } },
      { label: 'Excusarse: la misión no espera', desc: '', fx: (run, ctx, E) => { E.susp(3, 'Desaire a las autoridades locales'); return 'El director sonríe sin enseñar los dientes.'; } },
    ],
  },
  ciudad_academico: {
    where: ['ciudad', 'estacion'], art: 'cientifico',
    title: 'El académico',
    text: () => 'Un físico de la Academia de Ciencias, con gafas de pasta y el abrigo mal abrochado, os aborda en el hangar. Ha leído los informes sobre la Señal. Quiere ir con vosotros. Tiene un permiso firmado… más o menos.',
    options: [
      { label: 'Aceptarle a bordo', desc: 'Científico experto. Su permiso es dudoso.', fx: (run, ctx, E) => { const c = E.newCrew({ role: 'cientifico', quality: 2 }); E.recruit(c); if (R(run).chance(0.4)) E.disloyal(5, 'Pasajero con documentación irregular'); return `${nm(c)} sube con dos maletas llenas de libros y ni un calcetín de repuesto.`; } },
      { label: 'Comprarle sus notas (40 ₽)', desc: 'Conocimiento +5.', req: (run) => run.res.rubles >= 40, fx: (run, ctx, E) => { E.res({ rubles: -40 }); E.know(5); return 'Cuadernos llenos de ecuaciones y, en los márgenes, dibujos de círculos concéntricos.'; } },
      leave,
    ],
  },
  ciudad_interrogatorio: {
    where: ['ciudad', 'aerodromo'], cond: (run) => run.suspicion > 30, art: 'kgb',
    title: 'Citación',
    text: () => 'El comisario de la tripulación recibe una citación del departamento especial. Debe explicar ciertos «detalles» de vuestro viaje. Le esperan en el edificio sin ventanas.',
    options: [
      { label: 'Enviar al comisario', desc: 'Política 5.', skill: 'pol', dc: 5,
        ok: (run, ctx, E) => { E.susp(-10, 'Interrogatorio superado'); E.time(120); return `${nm(ctx.actor)} vuelve dos horas después, pálido pero sonriente: «Todo aclarado».`; },
        fail: (run, ctx, E) => { E.susp(8, 'El interrogatorio no fue bien'); E.time(240); if (ctx.actor) E.morale(-15, ctx.actor); return `${nm(ctx.actor)} vuelve al anochecer y no quiere hablar de lo ocurrido.`; } },
      { label: 'Despegar antes de que vengan a buscarle', desc: 'Huir nunca parece inocente.', fx: (run, ctx, E) => { E.disloyal(10, 'Desobediencia a una citación'); return 'Desde la pista veis un coche negro llegar tarde.'; } },
    ],
  },
  ciudad_reactor: {
    where: ['ciudad'], regions: [1, 2, 3], art: 'ciudad',
    title: 'La ciudad atómica',
    text: () => 'Esta ciudad vive del uranio. Los ingenieros del combinado nuclear miran vuestro reactor con interés profesional y un poco de envidia. Ofrecen revisarlo… o cambiarlo por algo más nuevo.',
    options: [
      { label: 'Revisión del reactor (80 ₽)', desc: 'Repara el núcleo y lo mejora (+1 energía).', req: (run) => run.res.rubles >= 80 && run.ship.slots.reactor_core, fx: (run, ctx, E) => { E.res({ rubles: -80 }); const m = run.ship.slots.reactor_core; m.int = m.maxInt; m.stats.power += 1; return 'Cambian las barras de control y ajustan los moderadores. El reactor da una unidad más.'; } },
      { label: 'Solicitar un reactor experimental', desc: 'Política 4.', skill: 'pol', dc: 4,
        ok: (run, ctx, E) => { E.module({ type: 'reactor', quality: 3 }); return 'Os lo dan con un formulario de doce páginas y una advertencia: «No lo calentéis demasiado».'; },
        fail: (run, ctx, E) => { E.susp(3); return '«Eso no es posible, camaradas.» Y os miran raro por haberlo preguntado.'; } },
      trade,
    ],
  },

  // ====================================================================== BASE PVO
  militar_generico: {
    where: ['militar'], once: false, weight: 2, art: 'militar',
    title: 'Base de la defensa antiaérea',
    text: (run, ctx) => `Baterías de cañones antiaéreos apuntan al cielo gris en ${ctx.node.name}. El comandante, un coronel con cicatriz, os recibe en el búnker de mando: «Por poco os derribamos, camaradas. Actualizad vuestros códigos.»`,
    options: [trade, leave],
  },
  militar_maniobras: {
    where: ['militar'], art: 'militar',
    title: 'Blanco de prácticas',
    text: () => 'El coronel tiene un problema: sus artilleros necesitan practicar con un blanco real y no tienen avión. «Solo seguimiento por radar, camaradas. Munición de fogueo. Casi toda.»',
    options: [
      { label: 'Aceptar (150 ₽)', desc: 'Pilotaje 5 para no recibir un susto.', skill: 'pil', dc: 5,
        ok: (run, ctx, E) => { E.res({ rubles: 150, ammo: 60 }); E.susp(-4); E.time(90); return 'Los artilleros no consiguen fijaros ni una vez. El coronel paga riendo y os regala munición.'; },
        fail: (run, ctx, E) => { E.res({ rubles: 150 }); E.damageHull(8); E.time(90); return 'Una ráfaga «de fogueo» os abre un agujero en la cola. El coronel paga sin reír.'; } },
      { label: 'Rechazar educadamente', desc: '', fx: () => 'El coronel se encoge de hombros.' },
      trade,
    ],
  },
  militar_desertores: {
    where: ['militar', 'gulag'], art: 'militar',
    title: 'Los del calabozo',
    text: () => 'En el calabozo de la base hay dos soldados detenidos por «desertar»: intentaban volver a su pueblo tras la muerte de su madre. Mañana los trasladan al tribunal. Uno de ellos es un artillero excelente.',
    options: [
      { label: 'Sacarles a escondidas', desc: 'Dos artilleros. Muy desleal.', fx: (run, ctx, E) => { E.recruit(E.newCrew({ role: 'artillero', quality: 1 })); E.recruit(E.newCrew({ role: 'artillero', quality: 0 })); E.disloyal(14, 'Fuga de detenidos de una base militar'); return 'Se esconden en la bodega entre sacos de patatas. Nadie los echa de menos hasta el amanecer.'; } },
      { label: 'Interceder por ellos ante el coronel', desc: 'Política 6.', skill: 'pol', dc: 6,
        ok: (run, ctx, E) => { E.recruit(E.newCrew({ role: 'artillero', quality: 1 })); return 'El coronel acepta «trasladar» a uno de ellos a vuestra tripulación. El otro irá a juicio.'; },
        fail: (run, ctx, E) => { E.susp(4); return '«¿Defendéis a desertores?» El coronel os mira de otra manera.'; } },
      leave,
    ],
  },
  militar_americano: {
    where: ['militar'], art: 'militar',
    title: 'Botín de guerra',
    text: () => 'El intendente os enseña, bajando la voz, un cañón y un radar desmontados de un avión espía americano derribado el año pasado. Oficialmente no existen. Extraoficialmente, están en venta.',
    options: [
      { label: 'Comprar el radar (110 ₽)', desc: 'Módulo americano: excelente, pero comprometedor.', req: (run) => run.res.rubles >= 110, fx: (run, ctx, E) => { E.res({ rubles: -110 }); E.module({ type: 'radar', quality: 2, affixes: ['americano'] }); return 'Os lo entregan envuelto en una lona con el sello del Ejército.'; } },
      { label: 'Comprar el cañón (110 ₽)', desc: 'Módulo americano.', req: (run) => run.res.rubles >= 110, fx: (run, ctx, E) => { E.res({ rubles: -110 }); E.module({ type: 'arma', quality: 2, affixes: ['americano'] }); return 'Un cañón M24. Sus instrucciones están en inglés.'; } },
      { label: 'Denunciar el mercado negro', desc: '', fx: (run, ctx, E) => { E.susp(-6, 'Denuncia de corrupción militar'); return 'El intendente es arrestado esa misma tarde. El coronel no os despide.'; } },
    ],
  },

  // ====================================================================== RESTOS
  restos_generico: {
    where: ['restos'], once: false, weight: 2, art: 'restos',
    title: 'Chatarra en la nieve',
    text: (run, ctx) => `Los restos de ${ctx.node.name.replace('Restos de ', '')} asoman de la nieve como las costillas de una ballena. La caída fue hace tiempo: el metal está cubierto de escarcha y no hay huellas alrededor.`,
    options: [
      { label: 'Desguazar a fondo (2 h)', desc: 'Ingeniería 4: piezas y quizá un módulo útil.', skill: 'ing', dc: 4,
        ok: (run, ctx, E) => { E.time(120); E.res({ parts: R(run).int(8, 14) }); E.module({ quality: R(run).chance(0.4) ? 2 : 1 }); return `${nm(ctx.actor)} encuentra un compartimento intacto bajo el ala.`; },
        fail: (run, ctx, E) => { E.time(120); E.res({ parts: R(run).int(3, 6) }); if (R(run).chance(0.4)) E.hurt(ctx.actor, 12, 'un corte con chapa oxidada'); return 'Poco que rescatar. Alguien se corta con una chapa.'; } },
      { label: 'Recoger lo que esté a mano (30 min)', desc: '', fx: (run, ctx, E) => { E.time(30); E.res({ parts: R(run).int(2, 5) }); return 'Unos cables, unos tornillos, una lata de conservas de 1953.'; } },
    ],
  },
  restos_superviviente: {
    where: ['restos'], art: 'restos',
    title: 'Alguien vive ahí dentro',
    text: () => 'De la cabina del avión siniestrado sale humo: alguien ha encendido una hoguera dentro. Un hombre barbudo, envuelto en paracaídas, os apunta con una pistola de señales. Lleva semanas aquí.',
    options: [
      { label: 'Rescatarle', desc: 'Medicina 3. Puede unirse a vosotros.', skill: 'med', dc: 3,
        ok: (run, ctx, E) => { const c = E.newCrew({ role: R(run).pick(['mecanico', 'piloto', 'radio']), quality: 0 }); c.hp = 50; E.recruit(c); E.res({ meds: -1 }); return `Se llama ${c.first}. Llora cuando prueba la sopa caliente.`; },
        fail: (run, ctx, E) => { E.res({ meds: -2 }); return 'Está demasiado débil. Muere en la camilla, agradecido. Le enterráis bajo un abedul.'; } },
      { label: 'Dejarle provisiones y seguir', desc: '−4 raciones.', req: (run) => run.res.rations >= 4, fx: (run, ctx, E) => { E.res({ rations: -4 }); E.morale(-3); return 'Le prometéis avisar por radio. Lo hacéis. Nadie contesta.'; } },
    ],
  },
  restos_radiactivo: {
    where: ['restos'], regions: [1, 2, 3, 4], art: 'restos',
    title: 'El bombardero que no debía caer',
    text: () => 'Es un bombardero estratégico. El contador Geiger empieza a crepitar a cien metros. En la bodega, intacto, hay un pequeño reactor de propulsión experimental.',
    options: [
      { label: 'Extraer el reactor (3 h)', desc: 'Ingeniería 5. Toda la tripulación recibirá radiación.', skill: 'ing', dc: 5,
        ok: (run, ctx, E) => { E.time(180); E.rad(10); E.module({ type: 'reactor', quality: 3 }); return 'Lo sacáis con grúas improvisadas y plomo de las baterías.'; },
        fail: (run, ctx, E) => { E.time(180); E.rad(25); E.module({ type: 'reactor', quality: 2, worn: 0.4 }); return 'Algo se rompe durante la extracción. El Geiger se vuelve loco.'; } },
      { label: 'Marcar la zona y avisar a Moscú', desc: '', fx: (run, ctx, E) => { E.susp(-5, 'Informe sobre material nuclear perdido'); return 'El mensaje sale cifrado. Alguien, en algún despacho, va a tener un mal día.'; } },
    ],
  },
  restos_caja: {
    where: ['restos'], art: 'restos',
    title: 'La caja negra',
    text: () => 'Entre los restos encontráis el registrador de vuelo, intacto. Las últimas palabras de la tripulación están en esa cinta.',
    options: [
      { label: 'Escuchar la cinta', desc: 'Radio 3.', skill: 'rad', dc: 3,
        ok: (run, ctx, E) => { E.know(5); E.morale(-4); return '«…la brújula gira… hay una luz… Dios mío, está cantando…» Silencio.'; },
        fail: (run, ctx, E) => { E.know(1); return 'La cinta está quemada. Solo se oyen gritos y estática.'; } },
      { label: 'Entregarla sin escuchar', desc: '', fx: (run, ctx, E) => { E.susp(-4); return 'Mejor no saber. La guardáis en una caja sellada.'; } },
    ],
  },
  restos_u2: {
    where: ['restos'], regions: [0, 1, 2], art: 'restos',
    title: 'El avión espía',
    text: () => 'No es soviético. Las alas larguísimas y la carlinga individual no dejan dudas: un U-2 americano. La cámara de reconocimiento sigue en el fuselaje.',
    options: [
      { label: 'Entregar la cámara al KGB', desc: '', fx: (run, ctx, E) => { E.susp(-10, 'Entrega de material de espionaje enemigo'); return 'Moscú os felicita por radio. Por una vez, suena sincero.'; } },
      { label: 'Desmontar la electrónica para el Topolev', desc: 'Módulo americano.', fx: (run, ctx, E) => { E.module({ type: R(run).pick(['radio', 'avionica', 'radar']), quality: 2, affixes: ['americano'] }); E.disloyal(4, 'Material enemigo sin declarar'); return 'Tecnología del imperialismo, puesta al servicio del proletariado.'; } },
      { label: 'Estudiar las fotografías', desc: 'Conocimiento +4: fotografiaron Tunguska.', fx: (run, ctx, E) => { E.know(4); E.disloyal(3, 'Revelado de material enemigo sin autorización'); return 'En las fotos hay un círculo perfecto en la taiga, y algo brillante en el centro.'; } },
    ],
  },

  // ====================================================================== GULAG
  gulag_generico: {
    where: ['gulag'], once: false, weight: 2, art: 'gulag',
    title: 'El campo',
    text: (run, ctx) => `Alambradas, torres de vigilancia y barracones bajos medio enterrados en la nieve: ${ctx.node.name}. El comandante os recibe con prisa. Le sobran brazos y le faltan piezas: está dispuesto a «ceder» presos útiles a cambio de material.`,
    options: [
      { label: 'Solicitar un preso con oficio (8 piezas)', desc: 'Un prisionero se une a la tripulación.', req: (run) => run.res.parts >= 8, fx: (run, ctx, E) => { E.res({ parts: -8 }); const c = E.newCrew({ role: 'preso', quality: 1 }); E.recruit(c); return `${nm(c)} sube a bordo sin preguntar adónde vais. Cualquier sitio es mejor.`; } },
      trade, leave,
    ],
  },
  gulag_fuga: {
    where: ['gulag'], art: 'gulag',
    title: 'Fuga',
    text: () => 'Mientras repostáis, suenan sirenas: tres presos han escapado y corren hacia el bosque. Uno de ellos cambia de dirección y se mete bajo el ala del Topolev. Os mira suplicando.',
    options: [
      { label: 'Esconderle en la bodega', desc: 'Muy desleal.', fx: (run, ctx, E) => { const c = E.newCrew({ role: 'preso', quality: 1 }); E.recruit(c); E.disloyal(12, 'Encubrimiento de un fugado'); return `${nm(c)} pasa ocho horas entre sacos sin moverse. Al despegar, se echa a llorar.`; } },
      { label: 'Avisar a los guardias', desc: '', fx: (run, ctx, E) => { E.susp(-6, 'Colaboración con la administración del campo'); E.morale(-6); return 'Se lo llevan a rastras. La tripulación evita mirarle a los ojos.'; } },
      { label: 'Mirar hacia otro lado', desc: '', fx: (run, ctx, E) => { if (R(run).chance(0.3)) E.susp(4, 'Un guardia os vio mirar hacia otro lado'); return 'Cuando volvéis a mirar, ya no está.'; } },
    ],
  },
  gulag_doctor: {
    where: ['gulag'], art: 'gulag',
    title: 'El doctor del barracón 7',
    text: () => 'En la enfermería del campo trabaja un preso: un cirujano de Leningrado condenado a diez años por «sabotaje médico». Es, con diferencia, el mejor médico que veréis en Siberia.',
    options: [
      { label: 'Solicitar su traslado', desc: 'Política 5.', skill: 'pol', dc: 5,
        ok: (run, ctx, E) => { const c = E.newCrew({ role: 'medico', quality: 2 }); c.skills.med = Math.max(c.skills.med, 8); E.recruit(c); return `El comandante firma. ${nm(c)} se quita la gorra del campo y la tira a la nieve.`; },
        fail: (run, ctx, E) => { E.susp(4); return '«Ese hombre es un enemigo del pueblo.» Fin de la conversación.'; } },
      { label: 'Pedirle que atienda a vuestros heridos', desc: 'Cura a toda la tripulación (2 h).', fx: (run, ctx, E) => { E.time(120); for (const c of alive(run)) { c.hp = Math.min(c.hp + 40, 100 + (c.traits.includes('robusto') ? 25 : 0)); c.sick = 0; } E.note('{g}Tripulación curada{/}'); return 'Trabaja en silencio, con unas manos que no tiemblan.'; } },
      leave,
    ],
  },

  // ====================================================================== ESTACIÓN CIENTÍFICA
  estacion_generico: {
    where: ['estacion'], once: false, weight: 2, art: 'estacion',
    title: 'Estación científica',
    text: (run, ctx) => `${ctx.node.name}: tres cúpulas, una antena oxidada y un perro que ladra a la nada. Los científicos llevan meses sin ver caras nuevas y os reciben como a parientes.`,
    options: [
      trade,
      { label: 'Intercambiar datos sobre la Señal', desc: 'Radio o Ciencia 4. Conocimiento.', skill: 'cie', dc: 4,
        ok: (run, ctx, E) => { E.know(6); E.time(60); return 'Sus registros y los vuestros encajan como dos mitades de un mapa.'; },
        fail: (run, ctx, E) => { E.know(2); E.time(60); return 'Discutís dos horas sobre unidades de medida.'; } },
      leave,
    ],
  },
  estacion_experimento: {
    where: ['estacion'], art: 'cientifico',
    title: 'Prototipo sin probar',
    text: () => 'El jefe de la estación os enseña su orgullo: un módulo que nadie ha probado en vuelo. «Si funciona, será histórico. Si no… bueno, también.»',
    options: [
      { label: 'Llevároslo', desc: 'Módulo experimental gratis.', fx: (run, ctx, E) => { E.module({ quality: 3 }); return 'Os hace firmar que asumís toda la responsabilidad. En tres copias.'; } },
      { label: 'Ayudarle con sus mediciones (2 h)', desc: 'Ciencia 3: conocimiento y piezas.', skill: 'cie', dc: 3,
        ok: (run, ctx, E) => { E.time(120); E.know(4); E.res({ parts: 6 }); return 'Las mediciones confirman sus teorías. Os regala material sobrante.'; },
        fail: (run, ctx, E) => { E.time(120); E.know(1); return 'Las mediciones no confirman nada.'; } },
    ],
  },
  estacion_abandonada: {
    where: ['estacion', 'anomalia'], regions: [2, 3, 4], art: 'estacion',
    title: 'Estación abandonada',
    text: () => 'La puerta está abierta y la nieve ha entrado hasta la cocina. Hay tazas de té congeladas sobre la mesa, como si sus ocupantes se hubieran levantado hace un minuto. El diario de la estación termina a mitad de una frase.',
    options: [
      { label: 'Registrarla a fondo', desc: 'Ciencia 4.', skill: 'cie', dc: 4,
        ok: (run, ctx, E) => { E.know(8); E.res({ meds: 3, parts: 5 }); return 'En el laboratorio, una pizarra llena de cálculos: la Señal no viene del suelo. Viene de debajo.'; },
        fail: (run, ctx, E) => { E.know(3); E.morale(-8); return 'En el sótano encontráis las camas, ordenadas. Y vacías. Nadie quiere quedarse más tiempo.'; } },
      { label: 'Llevarse los suministros y salir', desc: '', fx: (run, ctx, E) => { E.res({ rations: 8, meds: 2 }); return 'No miréis atrás.'; } },
    ],
  },

  // ====================================================================== ANOMALÍA
  anomalia_luces: {
    where: ['anomalia'], once: false, weight: 1.5, art: 'anomalia',
    title: 'Las luces',
    text: () => 'Sobre el claro flotan esferas de luz del tamaño de un puño, inmóviles a dos metros del suelo. No queman. No hacen ruido. Pero cuando os acercáis, todas giran a la vez para mirar.',
    options: [
      { label: 'Acercarse con los instrumentos', desc: 'Ciencia 5. Mucho conocimiento, algún riesgo.', skill: 'cie', dc: 5,
        ok: (run, ctx, E) => { E.know(10); return `${nm(ctx.actor)} pasa la mano entre ellas. Durante un segundo, entiende algo. Luego lo olvida, pero los instrumentos lo han registrado todo.`; },
        fail: (run, ctx, E) => { E.know(4); E.hurt(ctx.actor, 18, 'quemaduras de radiación'); E.rad(6); return 'Una esfera toca a ' + nm(ctx.actor) + '. Le deja una quemadura con forma de espiral.'; } },
      { label: 'Observar desde el avión', desc: 'Conocimiento +3.', fx: (run, ctx, E) => { E.know(3); return 'Al cabo de una hora, se apagan una a una, como velas.'; } },
    ],
  },
  anomalia_tiempo: {
    where: ['anomalia'], art: 'anomalia',
    title: 'El reloj del comisario',
    text: () => 'Al aterrizar, todos los relojes de a bordo marcan horas distintas. El del comisario va hacia atrás. Fuera, los copos de nieve caen… hacia arriba.',
    options: [
      { label: 'Esperar a que pase', desc: 'Imprevisible.', fx: (run, ctx, E) => {
        if (R(run).chance(0.5)) { run.clock = Math.max(0, run.clock - 180); E.note('{g}−3 h (el tiempo ha retrocedido){/}'); return 'Cuando todo vuelve a la normalidad, es más temprano que cuando llegasteis.'; }
        E.time(480); return 'Parece que solo han pasado unos minutos. Pero fuera ya es de noche.';
      } },
      { label: 'Medirlo todo', desc: 'Ciencia 4.', skill: 'cie', dc: 4,
        ok: (run, ctx, E) => { E.know(9); return 'Los datos son imposibles, y precisamente por eso, valiosísimos.'; },
        fail: (run, ctx, E) => { E.time(240); E.know(2); return 'Os perdéis en las mediciones. Literalmente: cuatro horas.'; } },
    ],
  },
  anomalia_ecos: {
    where: ['anomalia'], art: 'anomalia',
    title: 'Los otros',
    text: (run) => { const c = someone(run); return `${nm(c)} jura haber visto a otra tripulación junto a otro Topolev, al otro lado del claro. Misma ropa. Mismas caras. Os saludaron con la mano.`; },
    options: [
      { label: 'Ir a su encuentro', desc: 'Nadie sabe qué pasará.', fx: (run, ctx, E) => {
        const r = R(run).next();
        if (r < 0.4) { E.know(12); E.morale(-10); return 'Cuando llegáis, solo hay huellas. Vuestras huellas. Pero las cámaras sí registraron algo.'; }
        if (r < 0.7) { E.res({ fuel: 6, parts: 6 }); return 'Encontráis bidones de combustible y cajas con vuestro propio sello. Nadie quiere hablar de ello.'; }
        const c = someone(run); if (c) { c.morale = 0; } E.know(6); return `${nm(c)} vuelve solo, temblando, y no habla durante horas.`;
      } },
      { label: 'Despegar inmediatamente', desc: 'Moral −5 a los supersticiosos.', fx: (run, ctx, E) => { for (const c of alive(run)) if (has(c, 'supersticioso')) c.morale -= 10; return 'Al despegar, otro avión despega a la vez al otro lado del claro.'; } },
    ],
  },
  anomalia_cristal: {
    where: ['anomalia'], regions: [3, 4], art: 'anomalia',
    title: 'El fragmento',
    text: () => 'En el centro de un círculo de árboles calcinados hay un fragmento de algo parecido al cristal negro, del tamaño de un samovar. Está tibio. Vibra en la misma frecuencia que la Señal.',
    options: [
      { label: 'Cargarlo en la bodega', desc: 'Conocimiento +12. Radiación.', fx: (run, ctx, E) => { E.know(12); E.rad(12); run.flags.fragment = true; return 'Durante la noche, todos soñáis con el mismo lugar.'; } },
      { label: 'Tomar muestras y dejarlo', desc: 'Ciencia 3.', skill: 'cie', dc: 3,
        ok: (run, ctx, E) => { E.know(6); return 'Las muestras brillan en la oscuridad de la bodega.'; },
        fail: (run, ctx, E) => { E.hurt(ctx.actor, 10, 'una descarga'); return 'El fragmento escupe una chispa violeta.'; } },
    ],
  },

  // ====================================================================== GENÉRICOS (cualquier nodo)
  carta_casa: {
    where: ['aerodromo', 'ciudad', 'militar', 'koljos'], art: 'correo',
    title: 'Correo',
    text: () => 'Una saca de correo os estaba esperando. Cartas de madres, esposas, hijos. Alguna de un sindicato reclamando cuotas atrasadas.',
    options: [{ label: 'Repartir las cartas', desc: 'Moral +10.', fx: (run, ctx, E) => { E.morale(10); return 'Durante un rato, nadie habla. Alguien sonríe. Alguien llora.'; } }, trade],
  },
  kgb_visita: {
    where: ['aerodromo', 'ciudad', 'militar', 'koljos', 'aldea'], cond: (run) => run.suspicion >= 60, weight: 3, art: 'kgb',
    title: 'El hombre del abrigo gris',
    text: () => 'Un hombre del KGB sube a bordo y se sienta en el comedor sin quitarse el abrigo. «Me han pedido que viaje con ustedes un tramo. Hagan como si no estuviera.» Nadie lo consigue.',
    options: [
      { label: 'Ofrecerle té y franqueza', desc: 'Política 6.', skill: 'pol', dc: 6,
        ok: (run, ctx, E) => { E.susp(-15, 'El agente se marcha satisfecho'); return 'Charláis de fútbol y del Dinamo. En la siguiente parada se baja y os da la mano.'; },
        fail: (run, ctx, E) => { E.susp(6); E.morale(-8); return 'Anota cada palabra. En el siguiente aeródromo baja sin despedirse.'; } },
      { label: 'Darle vodka hasta que se duerma (4)', desc: '', req: (run) => run.res.vodka >= 4, fx: (run, ctx, E) => { E.res({ vodka: -4 }); E.susp(-6); return 'Canta canciones de la guerra y llora por su madre. Por la mañana no recuerda nada… o eso dice.'; } },
    ],
  },

  // ====================================================================== ESPECIALES
  frontera: {
    where: ['frontera'], once: false, weight: 1, art: 'frontera', special: true,
    title: 'Fin de etapa',
    text: (run) => {
      const next = REGIONS[run.region + 1];
      return `Habéis cruzado ${REGIONS[run.region].name}. En el depósito de enlace, un sargento somnoliento os ofrece combustible y un termo de té. Más allá empieza ${next.name}.\n\n{d}${next.intro}{/}`;
    },
    options: [
      { label: 'Repostar en el depósito', desc: 'Mercado limitado.', end: 'station', fx: () => '' },
      { label: 'Continuar hacia la siguiente región', desc: '', fx: () => '', end: 'region' },
    ],
  },
  forzoso: {
    special: true, art: 'tormenta',
    title: 'Aterrizaje forzoso',
    text: () => 'Sin combustible, el Topolev planea en silencio sobre la taiga. El piloto encuentra un claro helado y posa el monstruo con un estruendo de metal y hielo. Estáis vivos. Estáis lejos de todo.',
    options: [
      { label: 'Pedir auxilio a Moscú', desc: 'Llegará combustible. Moscú tomará nota.', fx: (run, ctx, E) => { E.time(16 * 60); E.res({ fuel: 10 }); E.susp(18, 'Rescate de emergencia: la misión ha quedado en evidencia'); return 'Un Li-2 aterriza a la mañana siguiente con bidones y un oficial que no deja de escribir.'; } },
      { label: 'Buscar combustible a pie (10 h)', desc: 'Navegación 5: encontrar una aldea o una base.', skill: 'nav', dc: 5,
        ok: (run, ctx, E) => { E.time(600); E.res({ fuel: 7 }); for (const c of alive(run)) c.fatigue = Math.min(100, c.fatigue + 30); return `${nm(ctx.actor)} vuelve con un tractor cargado de bidones y un campesino muy confuso.`; },
        fail: (run, ctx, E) => { E.time(900); E.res({ fuel: 3 }); E.hurt(ctx.actor, 25, 'congelación'); return 'Tras quince horas en la nieve, apenas encontráis un bidón olvidado.'; } },
      { label: 'Destilar el vodka y el alcohol médico', desc: 'Requiere 10 vodka. Moral −10.', req: (run) => run.res.vodka >= 10, fx: (run, ctx, E) => { E.res({ vodka: -10, fuel: 3 }); E.morale(-10); E.time(240); return 'El Topolev despega oliendo a destilería. La tripulación no lo perdonará.'; } },
    ],
  },
  ...EVENTS2,
  ...FINALE,
};
