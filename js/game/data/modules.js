// Tipos de módulo, estadísticas base, fabricantes y afijos.

// stats: [min, max] para calidad Estándar. main: estadística principal.
export const MODTYPES = {
  motor: {
    name: 'Motor', glyph: '≡', main: 'thrust', base: 260,
    stats: { thrust: [230, 290], fuel: [0.85, 1.15], rel: [0.82, 0.94], iceRes: [0, 0.25] },
    codes: ['NK', 'AM', 'VD', 'RD', 'AI', 'TV', 'M'],
    desc: 'Empuje para cruzar la URSS. Consume combustible y se desgasta.',
  },
  reactor: {
    name: 'Reactor', glyph: '☢', main: 'power', base: 420,
    stats: { power: [7, 9], heat: [0.9, 1.1], shield: [0.1, 0.35] },
    codes: ['RN', 'VVR', 'AT', 'IR', 'TES'],
    desc: 'Energía para todos los sistemas. Más carga = más calor.',
  },
  radar: {
    name: 'Radar', glyph: '◎', main: 'warn', base: 200,
    stats: { warn: [15, 30], range: [14, 22], detect: [0, 0.1] },
    codes: ['RP', 'PSBN', 'RBP', 'Kobra'],
    desc: 'Aviso temprano de interceptores y alcance de reconocimiento en el mapa.',
  },
  radio: {
    name: 'Radio', glyph: '¥', main: 'decode', base: 160,
    stats: { decode: [0.9, 1.15], iff: [0, 0.2] },
    codes: ['R', 'RSB', 'RSIU', 'KV'],
    desc: 'Descifrado de mensajes y transmisión de códigos IFF.',
  },
  arma: {
    name: 'Cañón', glyph: '╪', main: 'dmg', base: 220,
    stats: { dmg: [6, 9], rof: [9, 13], acc: [0, 0.08], ammo: [1, 1] },
    codes: ['NR', 'AM', 'NS', 'B', 'ShVAK'],
    desc: 'Arma de torreta. Necesita artillero, energía y munición.',
  },
  blindaje: {
    name: 'Blindaje', glyph: '▓', main: 'armor', base: 180,
    stats: { armor: [1, 2], mass: [3, 5] },
    codes: ['BT', 'AB', 'BZ'],
    desc: 'Reduce el daño de cada impacto. Pesa.',
  },
  literas: {
    name: 'Literas', glyph: '▬', main: 'bunks', base: 90,
    stats: { bunks: [3, 4], rest: [0.95, 1.1] },
    codes: ['K', 'SP'],
    desc: 'Camas en el dormitorio. Quien no tiene litera duerme en el suelo.',
  },
  cocina: {
    name: 'Cocina', glyph: '♨', main: 'meals', base: 80,
    stats: { meals: [3, 4], speed: [0.9, 1.15] },
    codes: ['PK', 'KE'],
    desc: 'Hornillo para convertir raciones en comidas calientes.',
  },
  medico: {
    name: 'Equipo médico', glyph: '+', main: 'heal', base: 140,
    stats: { heal: [0.9, 1.2], medEff: [0.9, 1.15] },
    codes: ['MS', 'AMP'],
    desc: 'Mejora la curación en la enfermería y el rendimiento de las medicinas.',
  },
  taller: {
    name: 'Herramientas', glyph: '¶', main: 'craft', base: 120,
    stats: { craft: [0.9, 1.2], repair: [1, 1.15] },
    codes: ['ST', 'TK'],
    desc: 'Banco de trabajo: velocidad de fabricación y bonificación a reparaciones.',
  },
  carga: {
    name: 'Bodega', glyph: '▤', main: 'cap', base: 110,
    stats: { cap: [1.0, 1.2] },
    codes: ['GK', 'KT'],
    desc: 'Estanterías y redes: capacidad para raciones, piezas, munición...',
  },
  tanque: {
    name: 'Depósito', glyph: '◘', main: 'fuelCap', base: 150,
    stats: { fuelCap: [32, 40] },
    codes: ['TB', 'BK'],
    desc: 'Capacidad de combustible (toneladas).',
  },
  auxiliar: {
    name: 'Auxiliar', glyph: '⌂', main: 'aux', base: 150,
    stats: {},
    codes: ['VS', 'NA', 'AG'],
    desc: 'Equipo auxiliar de la sala de máquinas.',
  },
  avionica: {
    name: 'Aviónica', glyph: '◊', main: 'evasion', base: 170,
    stats: { evasion: [0.03, 0.07], autopilot: [0.6, 0.8], turb: [0.1, 0.3] },
    codes: ['AP', 'PPS', 'SAU'],
    desc: 'Instrumentos de vuelo: evasión, piloto automático, turbulencias.',
  },
  moral: {
    name: 'Moral', glyph: '♪', main: 'morale', base: 70,
    stats: { morale: [2, 4] },
    codes: [''],
    desc: 'Objetos que levantan el ánimo de la tripulación.',
  },
};
export const MODTYPE_LIST = Object.keys(MODTYPES);

// Subtipos auxiliares
export const AUX = {
  bomba: { name: 'Bomba de refrigeración', stats: { cool: [0.4, 0.7] }, desc: 'Ayuda a enfriar el reactor.' },
  antihielo: { name: 'Calefactor de alas', stats: { deice: [0.35, 0.6] }, desc: 'Reduce la acumulación de hielo en los motores.' },
  extintor: { name: 'Extintores automáticos', stats: { fireSup: [0.3, 0.55] }, desc: 'Frena los incendios en todas las salas.' },
  generador: { name: 'Generador diésel', stats: { power: [1, 2] }, desc: 'Energía extra (+), pero calienta y consume.' },
  purificador: { name: 'Purificador de aire', stats: { o2: [0.3, 0.6] }, desc: 'Recupera el oxígeno y elimina humo más deprisa.' },
};

export const MORAL_ITEMS = [
  ['Retrato de Lenin', 'leal'], ['Icono ortodoxo', 'supersticioso'], ['Gramófono con discos', null], ['Samovar de latón', null],
  ['Tablero de ajedrez', null], ['Bandera de Stalingrado', 'veterano'], ['Acordeón', 'cantante'], ['Barril de kvas', null],
  ['Fotos de Gagarin', null], ['Planta de interior', null],
];

export const WORDS = [
  'Ural', 'Volga', 'Burya', 'Iskra', 'Zarya', 'Vostok', 'Sokol', 'Berkut', 'Strela', 'Molniya', 'Taiga', 'Sever',
  'Rassvet', 'Pobeda', 'Druzhba', 'Mir', 'Sputnik', 'Kometa', 'Granit', 'Almaz', 'Topol', 'Yastreb', 'Kedr', 'Amur',
  'Baikal', 'Neva', 'Don', 'Dnepr', 'Lena', 'Yenisei', 'Obsk', 'Irtysh', 'Krechet', 'Orel', 'Gnom', 'Volkhov',
];

export const MAKERS = [
  'OKB-Lébedev', 'Zavod «Bandera Roja»', 'Kombinat «Estrella»', 'OKB-Sokolov', 'Fábrica Nº 156', 'Instituto Nº 9',
  'Artel «Progreso»', 'Zavod Nº 24 de Kúibyshev', 'OKB-Topolev', 'Fábrica «Octubre Rojo»', 'Taller de Perm',
  'Planta de Kazán', 'Kombinat de Gorki',
];

export const QUALITY = [
  { name: 'Obsoleto', mult: 0.82, value: 0.55, color: 'grey' },
  { name: 'Estándar', mult: 1.0, value: 1.0, color: 'o' },
  { name: 'Mejorado', mult: 1.16, value: 1.6, color: 'l' },
  { name: 'Experimental', mult: 1.34, value: 2.4, color: 'v' },
  { name: 'Prototipo', mult: 1.55, value: 3.5, color: 'y' },
];

// Afijos: types (null = todos), mods sobre stats (mul/add), extras
export const AFFIXES = {
  reforzado: { name: 'reforzado', types: null, maxInt: 40, mass: 1, value: 1.15 },
  ligero: { name: 'ligero', types: null, maxInt: -20, mass: -2, value: 1.1 },
  sobrealimentado: { name: 'sobrealimentado', types: ['motor', 'reactor', 'arma', 'radar'], mainMul: 1.25, rel: -0.1, heat: 0.2, value: 1.3 },
  fiable: { name: 'fiable', types: ['motor', 'reactor', 'arma', 'radio', 'radar', 'auxiliar'], rel: 0.08, maxInt: 15, value: 1.25 },
  quinquenal: { name: 'del Plan Quinquenal', types: null, mainMul: 0.9, maxInt: -10, value: 0.6 },
  americano: { name: 'americano (capturado)', types: ['motor', 'radar', 'radio', 'arma', 'avionica'], mainMul: 1.3, suspicion: 8, value: 1.6 },
  aleman: { name: 'con manual en alemán', types: null, mainMul: 1.1, value: 0.9 },
  bendecido: { name: 'bendecido por un pope', types: null, morale: 2, suspicion: 4, value: 1.05 },
  calefactado: { name: 'calefactado', types: ['motor'], iceRes: 0.35, value: 1.2 },
  economico: { name: 'económico', types: ['motor', 'reactor'], fuel: 0.82, heat: -0.15, value: 1.25 },
  ruidoso: { name: 'ruidoso', types: ['motor', 'reactor', 'auxiliar', 'arma'], morale: -2, mainMul: 1.08, value: 0.85 },
  radiactivo: { name: 'radiactivo', types: ['reactor'], power: 2, shield: -0.25, value: 1.1 },
  preciso: { name: 'de precisión', types: ['arma', 'radar', 'avionica'], acc: 0.08, value: 1.3 },
  gastado: { name: 'gastado', types: null, worn: true, value: 0.6 },
  compacto: { name: 'compacto', types: ['blindaje', 'literas', 'cocina', 'tanque', 'carga'], mass: -1, value: 1.2 },
};
