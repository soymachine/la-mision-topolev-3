// Contactos hostiles. Tiempos en minutos de juego.

export const ENEMIES = {
  sabre: {
    name: 'Caza F-86 «Sabre»', short: 'F-86', glyph: '>', hp: 24, acc: 0.52, dmg: [5, 9], rate: [3, 4.5], evasion: 0.22, speed: 16,
    bounty: 70, flee: 0.5, desc: 'Intruso de la OTAN. Rápido y molesto.', targets: ['motor1', 'motor2', 'cabina'],
  },
  starfighter: {
    name: 'Interceptor F-104', short: 'F-104', glyph: '»', hp: 20, acc: 0.6, dmg: [6, 10], rate: [2.5, 4], evasion: 0.3, speed: 24,
    bounty: 90, flee: 0.6, desc: 'Un misil con alas y un piloto loco dentro.', targets: ['cabina', 'navegacion', 'reactor'],
  },
  b47: {
    name: 'Bombardero B-47', short: 'B-47', glyph: 'W', hp: 48, acc: 0.38, dmg: [10, 16], rate: [5, 7], evasion: 0.08, speed: 9,
    bounty: 160, flee: 0.3, desc: 'Lento, pesado y con bombas que no perdonan.', targets: ['reactor', 'bodega', 'maquinas'],
  },
  li2: {
    name: 'Li-2 de contrabandistas', short: 'Li-2', glyph: 'm', hp: 18, acc: 0.42, dmg: [4, 7], rate: [3.5, 5], evasion: 0.12, speed: 11,
    bounty: 50, flee: 0.7, desc: 'Un viejo transporte artillado. Quieren vuestra carga.', targets: ['bodega', 'comedor'],
  },
  desertor: {
    name: 'MiG-17 desertor', short: 'MiG', glyph: '<', hp: 26, acc: 0.55, dmg: [6, 9], rate: [3, 4.5], evasion: 0.25, speed: 18,
    bounty: 60, flee: 0.4, desc: 'Un piloto soviético que ya no obedece a nadie.', targets: ['cabina', 'motor1', 'motor2'],
  },
  globo: {
    name: 'Globo espía', short: 'Globo', glyph: 'o', hp: 12, acc: 0, dmg: [0, 0], rate: [99, 99], evasion: 0, speed: 3,
    bounty: 120, flee: 0, desc: 'Fotografía todo. Derribarlo complacería a Moscú.', passive: true, escape: 40,
  },
  esfera: {
    name: 'Esfera luminosa', short: '???', glyph: '◉', hp: 30, acc: 0.6, dmg: [3, 6], rate: [3, 5], evasion: 0.35, speed: 12,
    bounty: 0, flee: 0, desc: 'Una luz con voluntad propia. Drena la energía.', drain: true, knowledge: 6, targets: ['reactor', 'radio', 'maquinas'],
  },
};

// Grupos posibles por región (índice 0..4)
export const ENEMY_GROUPS = [
  [[['sabre'], 3], [['li2'], 3], [['globo'], 2], [['sabre', 'sabre'], 1]],
  [[['sabre', 'sabre'], 3], [['desertor'], 2], [['li2', 'li2'], 2], [['globo'], 1], [['b47'], 1]],
  [[['sabre', 'sabre'], 2], [['starfighter'], 2], [['b47'], 2], [['desertor', 'desertor'], 2], [['li2', 'sabre'], 1]],
  [[['starfighter', 'sabre'], 2], [['b47', 'sabre'], 2], [['esfera'], 2], [['desertor', 'desertor'], 1], [['globo', 'sabre'], 1]],
  [[['esfera'], 3], [['esfera', 'esfera'], 2], [['starfighter', 'starfighter'], 1], [['b47', 'sabre'], 1]],
];
