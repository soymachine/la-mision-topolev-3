// Instrucciones.

import { C } from '../palette.js';

const SECTIONS = [
  ['La misión', `{O}LA MISIÓN TOPOLEV{/}

Eres el comandante del {l}T-0 «Topolev»{/}, un gigantesco avión-laboratorio de propulsión atómica. Moscú te ordena cruzar la Unión Soviética, región a región, hasta un lugar remoto de Siberia, y traer de vuelta lo que allí encuentres.

Cada partida es distinta: los mapas, los tripulantes, los módulos y los eventos se generan a partir de una {l}semilla{/}.

{d}El viaje{/}
· 5 regiones, cada una con un mapa de rutas.
· En cada región eliges el camino hacia la {l}frontera{/} ({y}»{/}).
· Cada tramo es un {l}vuelo en tiempo real{/} en el que gestionas a la tripulación.
· Al aterrizar ocurre un {l}evento{/} o se abren los {l}servicios{/} del lugar.

{d}Cómo se pierde{/}
· El casco se parte (integridad media por debajo del 22%).
· Muere toda la tripulación.
· La {r}sospecha del KGB{/} llega al 100%.
· Te pasas del plazo más de dos días.`],
  ['El mapa', `{O}EL MAPA REGIONAL{/}

  {y}★{/} inicio   {l}✈{/} aeródromo   {o}♣{/} koljós   {o}⌂{/} aldea
  {r}■{/} ciudad cerrada   {r}▲{/} base PVO   {o}%{/} restos   {x}#{/} campo
  {i}☼{/} estación científica   {v}◊{/} anomalía   {y}»{/} frontera   {d}?{/} desconocido

· Solo puedes volar a los nodos {l}conectados{/} con tu posición (resaltados).
· {l}Clic{/} en un nodo para seleccionarlo; {l}doble clic{/} o {l}DESPEGAR{/} para volar.
· El panel derecho estima {l}distancia, duración, combustible y peligro{/}.
· Las {i}tormentas{/} (manchas azules) se desplazan cada vez que vuelas o descansas. Atravesarlas trae hielo, turbulencias y rayos.
· El {l}círculo de puntos{/} es el alcance de tu radar: revela qué hay en los nodos «?».
· {l}Descansar 6 h{/} recupera a la tripulación a costa de tiempo y comida.
· {l}Hangar{/} (H) y {l}Tripulación{/} (T) solo están disponibles en tierra.`],
  ['El vuelo', `{O}EL VUELO EN TIEMPO REAL{/}

En el centro ves el corte transversal del Topolev. Cada letra es un tripulante.

  ┌─COMEDOR──────┬─RADIO─────┐
  │ ♨  ╤═══════╤ │ ▣▣¥   ◎≈  │
  │ ·    K  O    ¦ R     S   │
  └──────────────┴───────────┘

· {l}ESPACIO{/}: pausa. {l}1 2 3{/}: velocidad ×1, ×2, ×4.
· La tripulación trabaja {l}sola{/} según sus prioridades y necesidades.
· Tú das {l}órdenes directas{/} arrastrando:
   – una {l}tarjeta{/} de la izquierda o un {l}tripulante{/} de la nave
   – sobre una {l}sala{/}, una {l}estación{/} o una {l}tarea{/} de la lista.
· El tripulante con orden lleva un {y}▾{/}. {l}Clic derecho{/} cancela la orden.
· {l}Clic{/} en una tarea de la lista la marca como {y}urgente (!){/}.
· {l}Clic{/} en una sala muestra su estado y acciones (comisaría, taller...).
· Doble clic en un tripulante: su expediente.`],
  ['Tareas y puestos', `{O}PUESTOS Y TAREAS{/}

{d}Puestos permanentes{/} (alguien debe ocuparlos):
· {l}Piloto{/}: velocidad, evasión y turbulencias. Sin él, piloto automático.
· {l}Navegante{/}: acorta la ruta. Sin él, el tramo se alarga.
· {l}Radio{/}: descifra mensajes de Moscú y transmite códigos {r}IFF{/}.
· {l}Reactor{/}: refrigera el núcleo. {l}Máquinas{/}: afina los motores.
· {l}Torretas{/} (dorsal, ventral, cola): disparan en combate.
· {l}Hornillo{/}: convierte raciones en comidas.
· {l}Banco del taller{/}: órdenes de fabricación.
· {l}Comisario{/}: trabajo político. {l}Radiogoniómetro{/}: estudiar la Señal.

{d}Tareas de emergencia{/}
· {r}▲ Fuego{/}: crece y se propaga. Sin oxígeno se apaga solo.
· {i}◌ Brecha{/}: el aire escapa y entra el frío. Sellar cuesta piezas.
· {o}¤ Reparar{/}: módulos dañados y estructura (cuesta piezas).
· {i}❄ Hielo{/}: se acumula en los motores con tormentas y frío.
· {r}+ Atender{/}: el médico cura a quien está en la enfermería.`],
  ['Necesidades', `{O}LA TRIPULACIÓN{/}

Cada tripulante tiene {l}habilidades{/} (0–10), {l}rasgos{/} y {l}necesidades{/}:

  ♥ Salud    ☾ Fatiga    ♨ Hambre    ☺ Moral    ❄ Frío    ☢ Radiación

· Con fatiga alta van a {l}dormir{/}: hay pocas literas, ¡organiza turnos!
· Con hambre van al {l}comedor{/}: comidas calientes o raciones crudas (peor).
· Con frío buscan la sala más caliente. Heridos van a la {l}enfermería{/}.
· La {l}política de turnos{/} (abajo a la izquierda) decide cuándo descansan.
· La {v}moral{/} baja con hambre, frío, fuego, combate y muertes. Por debajo de 20 hay {v}crisis{/}: pánico, borracheras, peleas. El comisario puede calmarles.

{d}Prioridades{/}: en la pantalla de Tripulación, cada casilla dice cuánto le importa a cada tripulante cada tipo de trabajo (1 alta, 2 media, 3 baja, – nunca).

{d}Rasgos ocultos{/}: algunos tripulantes esconden secretos. El comisario puede {l}vigilarles{/} (en la Comisaría) para descubrirlos.`],
  ['Energía y motores', `{O}ENERGÍA, REACTOR Y MOTORES{/}

El reactor produce unidades de energía. Repártelas con {l}clic en los bloques{/} (clic derecho para quitar):

  Calefacción ■■□   Soporte vital ■□   Armas ■■□
  Radar ■□   Radio ■□   Enfermería □   Cocina ■   Taller □

· Más carga = más {r}calor{/}. Por encima de la marca amarilla escapa {g}radiación{/}; por encima de la roja, el núcleo se daña.
· {r}SCRAM{/}: apagado de emergencia. Enfría, pero deja la nave sin energía unos minutos.
· {l}Régimen de motores{/}: Económico, Crucero o Máximo (velocidad vs. combustible vs. desgaste).
· En Siberia hace {i}mucho frío{/}: sin calefacción la tripulación se congela.
· Sin {l}soporte vital{/}, el oxígeno no se recupera tras una brecha.`],
  ['Combate', `{O}COMBATE{/}

Cazas, bombarderos y cosas peores aparecen en el {l}RADAR{/}. Si el radar tiene energía, te avisa unos minutos antes.

· Las torretas disparan solas si tienen {l}artillero, energía y munición{/}.
· Cada torreta cubre ciertos sectores (proa, popa, arriba, abajo).
· {l}Clic en un contacto{/} del radar: objetivo prioritario.
· {l}Maniobra evasiva{/} (E): +30% evasión, pero quien no esté sentado puede herirse.
· {l}Señuelos{/}: los atacantes fallan mucho durante un rato.
· Cada impacto daña la sala, sus módulos y a quien esté dentro; puede provocar incendios y brechas.
· No se puede aterrizar con enemigos en el aire.

{d}PVO{/}: cerca de bases militares, la defensa antiaérea exige un {r}código IFF{/}. Alguien debe estar en la radio (con energía) antes de que se acabe el tiempo.`],
  ['Hangar y módulos', `{O}HANGAR Y MÓDULOS{/}

Cada sala tiene {l}ranuras{/} para módulos: motores, reactor, radar, radio, cañones, blindaje, literas, cocina, etc.

· Los módulos se generan con {l}calidad{/} ({x}Obsoleto{/}, Estándar, {l}Mejorado{/}, {v}Experimental{/}, {y}Prototipo{/}) y {l}afijos{/} (reforzado, ligero, sobrealimentado, americano...).
· {l}Arrastra{/} un módulo de la bodega a una ranura compatible para instalarlo.
· Arrastra uno instalado a la bodega para desmontarlo (o clic derecho).
· Arrástralo al {r}desguace{/} para convertirlo en piezas.
· Suéltalo en el {l}taller{/} para repararlo en vuelo.
· Pasa el ratón para comparar con el instalado ({g}verde{/} mejor, {r}rojo{/} peor).
· {r}Cuidado{/}: el material americano o religioso levanta sospechas al instalarlo.
· Cada instalación cuesta 20 minutos.`],
  ['El Partido', `{O}EL PARTIDO Y EL KGB{/}

La barra {r}KGB{/} mide la {r}sospecha{/}. Si llega al 100%, la misión termina.

{d}Sube con{/}: decisiones desleales, directivas incumplidas, retrasos, material extranjero, tripulantes bocazas... y un poco con cada parada (el KGB nunca duerme).
{d}Baja con{/}: informes del comisario, directivas cumplidas, decisiones ortodoxas y derribar intrusos.

{d}Directivas de Moscú{/}: objetivos opcionales (visitar un lugar, entregar suministros, no perder a nadie...). Llegan al principio de cada región, por radio o en las ciudades.

{d}La Comisaría{/}: selecciónala en vuelo para elegir el trabajo político:
· {l}Informes{/}: bajan la sospecha.
· {l}Sesión política{/}: sube la moral (a casi todos).
· {l}Vigilancia{/}: investiga a un tripulante para descubrir sus rasgos ocultos.

{d}El plazo{/}: aparece arriba. Retrasarse aumenta la sospecha.`],
  ['Eventos', `{O}EVENTOS Y TIRADAS{/}

Al aterrizar ocurre algo. Lee y decide.

· Algunas opciones exigen recursos o condiciones; si no se cumplen, aparecen desactivadas.
· Otras son {l}tiradas de habilidad{/}: [Medicina 6 · 72%]. Usa la mejor habilidad de la tripulación y da experiencia a quien la hace.
· Los resultados muestran lo ganado y lo perdido.
· {l}Conocimiento{/} ({v}Ψ{/}): lo que sabéis sobre la Señal. Será importante al final del viaje.

{d}Servicios{/}: aeródromos, ciudades, bases y fronteras permiten comerciar, reparar, curar y reclutar a cambio de rublos.`],
  ['Atajos', `{O}ATAJOS DE TECLADO{/}

  {l}Espacio{/}        Pausa / continuar (vuelo) · saltar texto
  {l}1  2  3{/}        Velocidad ×1 ×2 ×4
  {l}E{/}              Maniobra evasiva
  {l}Esc{/}            Menú / volver / deseleccionar
  {l}Intro{/}          Despegar / continuar
  {l}H{/}  {l}T{/}  {l}D{/}        Hangar, Tripulación, Descansar (mapa)
  {l}1..4{/}           Opciones de los eventos

{d}Ratón{/}
  Clic             seleccionar
  Arrastrar        órdenes, módulos
  Clic derecho     cancelar orden / quitar energía / desmontar
  Doble clic       expediente / despegar
  Rueda            desplazar listas

{d}Guardado{/}: la partida se guarda sola al aterrizar, al despegar y cada 30 segundos de vuelo, en este navegador. Hay 3 ranuras.`],
  ['Consejos', `{O}CONSEJOS DEL CAMARADA INSTRUCTOR{/}

· Antes de despegar, mira el combustible estimado del tramo.
· Mantén siempre a alguien en la {l}cabina{/} y en la {l}radio{/}.
· No dejes que todos duerman a la vez: usa la política de turnos.
· Si el reactor se calienta, quita energía a lo que no necesites.
· Cuando el radar avise, da energía a las {l}armas{/} y manda artilleros.
· Un incendio en la bodega quema tus raciones.
· Las piezas son vida: sin ellas, las reparaciones son lentísimas.
· Siempre conviene saber más sobre la Señal...
· Desconfía de quien no tiene nada que esconder.`],
];

export class HelpScreen {
  constructor(app, opts) {
    this.app = app;
    this.back = opts.back || 'title';
    this.sec = 0;
  }
  update() {}

  render() {
    const app = this.app;
    const { term, ui, input } = app;
    const W = term.cols;
    const H = term.rows;
    const pw = Math.min(W - 4, 130);
    const ph = Math.min(H - 2, 48);
    const px = Math.floor((W - pw) / 2);
    const py = Math.floor((H - ph) / 2);
    ui.panel(px, py, pw, ph, { title: 'INSTRUCCIONES', style: 'double' });
    const lw = 24;
    for (let i = 0; i < SECTIONS.length; i++) {
      if (ui.button('hs_' + i, px + 2, py + 2 + i * 2, SECTIONS[i][0], { w: lw, style: 'tab', align: 'left', selected: this.sec === i })) {
        this.sec = i;
        ui.scrollTo('helptext', 0);
        app.audio.play('page');
      }
    }
    if (input.key('ArrowDown')) this.sec = Math.min(SECTIONS.length - 1, this.sec + 1);
    if (input.key('ArrowUp')) this.sec = Math.max(0, this.sec - 1);
    ui.vline(px + lw + 3, py + 1, ph - 2, C.o1);
    const tx = px + lw + 6;
    const tw = pw - lw - 9;
    const text = SECTIONS[this.sec][1];
    const lines = ui.measureWrap(text, tw);
    const off = ui.beginScroll('helptext', tx, py + 2, tw, ph - 5, lines);
    ui.mwrap(tx, py + 2 - off, tw, text, C.o6);
    ui.endScroll();
    if (ui.button('help_back', px + pw - 16, py + ph - 2, 'Volver', { w: 13, key: 'Escape' })) {
      if (this.back === 'flight' || this.back === 'map') app.go(this.back);
      else app.go('title');
    }
  }
}
