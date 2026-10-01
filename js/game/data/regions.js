// Regiones del viaje y tipos de nodo.

export const REGIONS = [
  {
    id: 'llanura', name: 'Llanura Rusa', roman: 'I', temp: -10, danger: 0.12, terrain: 'plains', storms: [1, 2],
    intro: 'Bajo las alas, la vieja Rusia: koljoses, iglesias sin cruz y carreteras de barro helado. Moscú todavía puede oír cada palabra que digáis por radio.',
    weights: { aerodromo: 2.5, koljos: 4, aldea: 3, ciudad: 1.5, militar: 1, restos: 1, gulag: 0.4, estacion: 0.6, anomalia: 0 },
  },
  {
    id: 'urales', name: 'Montes Urales', roman: 'II', temp: -16, danger: 0.24, terrain: 'mountains', storms: [2, 3],
    intro: 'La frontera entre Europa y Asia es una muralla de piedra vieja y nubes bajas. Aquí el viento muerde los motores y las fábricas secretas no aparecen en ningún mapa.',
    weights: { aerodromo: 2, koljos: 1.5, aldea: 2, ciudad: 2.5, militar: 2, restos: 1.5, gulag: 1.5, estacion: 1, anomalia: 0.3 },
  },
  {
    id: 'pantanos', name: 'Siberia Occidental', roman: 'III', temp: -24, danger: 0.34, terrain: 'swamps', storms: [2, 4],
    intro: 'El Ob se derrama en mil brazos sobre una llanura infinita de turba y hielo. Aquí los campos de trabajo superan a los pueblos.',
    weights: { aerodromo: 1.6, koljos: 1, aldea: 2, ciudad: 1, militar: 1.5, restos: 2, gulag: 2.5, estacion: 1.5, anomalia: 0.6 },
  },
  {
    id: 'taiga', name: 'Taiga Central', roman: 'IV', temp: -32, danger: 0.44, terrain: 'taiga', storms: [3, 4],
    intro: 'Un océano verde y negro hasta el horizonte. Las brújulas empiezan a dudar y la radio capta la Señal cada vez con más claridad.',
    weights: { aerodromo: 1.4, koljos: 0.5, aldea: 2, ciudad: 0.6, militar: 1, restos: 2, gulag: 1.5, estacion: 2, anomalia: 1.8 },
  },
  {
    id: 'tunguska', name: 'Zona Tunguska', roman: 'V', temp: -40, danger: 0.56, terrain: 'tunguska', storms: [3, 5],
    intro: 'Árboles muertos tumbados en círculos perfectos, como si una mano gigante los hubiera peinado. En algún lugar al este, la Señal late.',
    weights: { aerodromo: 0.8, koljos: 0, aldea: 1, ciudad: 0, militar: 0.6, restos: 2.5, gulag: 0.6, estacion: 2, anomalia: 3.5 },
  },
];

export const NODE_TYPES = {
  inicio: { name: 'Base de partida', glyph: '★', color: 'gold', known: true, danger: 0, desc: 'Punto de partida de la región.' },
  aerodromo: { name: 'Aeródromo', glyph: '✈', color: 'o6', known: true, danger: 0, desc: 'Repostar, reparar, comerciar y reclutar.' },
  koljos: { name: 'Koljós', glyph: 'Ж', color: 'o5', known: true, danger: 0, desc: 'Granja colectiva. Comida y gente sencilla.' },
  aldea: { name: 'Aldea', glyph: '⌂', color: 'o5', known: false, danger: 0.02, desc: 'Un puñado de isbas. Supersticiones y hospitalidad.' },
  ciudad: { name: 'Ciudad cerrada', glyph: '■', color: 'red', known: true, danger: 0.02, desc: 'Ciudad secreta. El Partido observa: directivas y favores.' },
  militar: { name: 'Base de la PVO', glyph: '▲', color: 'red', known: true, danger: 0.14, desc: 'Defensa antiaérea. Munición… y gatillo fácil.' },
  restos: { name: 'Restos de avión', glyph: '%', color: 'o4', known: false, danger: 0.06, desc: 'Chatarra valiosa entre la nieve.' },
  gulag: { name: 'Campo de trabajo', glyph: '#', color: 'grey', known: false, danger: 0.05, desc: 'Alambradas y torres. Mano de obra… y dilemas.' },
  estacion: { name: 'Estación científica', glyph: '☼', color: 'ice', known: false, danger: 0.04, desc: 'Científicos aislados. Módulos experimentales.' },
  anomalia: { name: 'Anomalía', glyph: '◊', color: 'violet', known: false, danger: 0.18, desc: 'Algo que no debería existir.' },
  frontera: { name: 'Frontera regional', glyph: '»', color: 'gold', known: true, danger: 0.04, desc: 'Paso a la siguiente región.' },
  epicentro: { name: 'Epicentro', glyph: '☢', color: 'violet', known: true, danger: 0.3, desc: 'El origen de la Señal.' },
};

export const ANOMALY_NAMES = ['el Ojo', 'el Pozo', 'el Bosque Silencioso', 'el Lago que Canta', 'el Claro Quemado', 'la Columna', 'el Eco', 'la Niebla Quieta', 'el Círculo', 'la Aguja'];
export const WRECKS = ['un Tu-4', 'un Li-2', 'un Il-14', 'un An-2', 'un globo sonda', 'un Tu-16', 'un helicóptero Mi-4', 'un U-2 americano'];
