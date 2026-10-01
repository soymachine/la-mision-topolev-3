// Habilidades, categorías de trabajo, especialidades y rasgos.

export const SKILLS = [
  { id: 'pil', name: 'Pilotaje', short: 'PIL', desc: 'Velocidad, evasión en combate y turbulencias.' },
  { id: 'nav', name: 'Navegación', short: 'NAV', desc: 'Acorta las rutas y revela el mapa.' },
  { id: 'ing', name: 'Ingeniería', short: 'ING', desc: 'Reparar, sellar brechas, reactor y taller.' },
  { id: 'med', name: 'Medicina', short: 'MED', desc: 'Curar heridas, radiación y enfermedades.' },
  { id: 'rad', name: 'Radio', short: 'RAD', desc: 'Descifrar mensajes y transmitir códigos.' },
  { id: 'art', name: 'Artillería', short: 'ART', desc: 'Puntería en las torretas.' },
  { id: 'coc', name: 'Cocina', short: 'COC', desc: 'Preparar comidas (más y mejores).' },
  { id: 'pol', name: 'Política', short: 'POL', desc: 'Informes al Partido, moral y vigilancia.' },
  { id: 'cie', name: 'Ciencia', short: 'CIE', desc: 'Estudiar la Señal y las anomalías.' },
];
export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

// Categorías de trabajo (columnas de la matriz de prioridades)
export const CATS = [
  { id: 'pilotar', name: 'Pilotar', short: 'Pil', skill: 'pil', desc: 'Ocupar los asientos de la cabina.' },
  { id: 'navegar', name: 'Navegar', short: 'Nav', skill: 'nav', desc: 'Ocupar la mesa de navegación.' },
  { id: 'radio', name: 'Radio', short: 'Rad', skill: 'rad', desc: 'Escucha, mensajes cifrados y códigos IFF.' },
  { id: 'reactor', name: 'Reactor', short: 'Rea', skill: 'ing', desc: 'Vigilar y refrigerar el reactor.' },
  { id: 'armas', name: 'Artillería', short: 'Art', skill: 'art', desc: 'Tripular las torretas.' },
  { id: 'emergencia', name: 'Emergencia', short: 'Emg', skill: 'ing', desc: 'Apagar incendios.' },
  { id: 'reparar', name: 'Reparar', short: 'Rep', skill: 'ing', desc: 'Averías, brechas, hielo y fugas.' },
  { id: 'medicina', name: 'Medicina', short: 'Med', skill: 'med', desc: 'Atender a heridos y enfermos.' },
  { id: 'cocina', name: 'Cocina', short: 'Coc', skill: 'coc', desc: 'Convertir raciones en comidas.' },
  { id: 'taller', name: 'Taller', short: 'Tal', skill: 'ing', desc: 'Órdenes de fabricación.' },
  { id: 'politica', name: 'Política', short: 'Pol', skill: 'pol', desc: 'Informes, sesiones e investigaciones.' },
  { id: 'ciencia', name: 'Ciencia', short: 'Cie', skill: 'cie', desc: 'Estudiar la Señal.' },
];
export const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));

export const ROLES = {
  piloto: { name: 'Piloto', main: 'pil', sec: ['nav', 'art'], glyph: 'P' },
  navegante: { name: 'Navegante', main: 'nav', sec: ['rad', 'pil'], glyph: 'N' },
  ingeniero: { name: 'Ingeniero', main: 'ing', sec: ['cie', 'coc'], glyph: 'I' },
  radio: { name: 'Radiooperador', main: 'rad', sec: ['cie', 'nav'], glyph: 'R' },
  medico: { name: 'Médico', main: 'med', sec: ['cie', 'coc'], glyph: 'M' },
  cocinero: { name: 'Cocinero', main: 'coc', sec: ['med', 'art'], glyph: 'K' },
  artillero: { name: 'Artillero', main: 'art', sec: ['ing', 'pil'], glyph: 'A' },
  comisario: { name: 'Comisario político', main: 'pol', sec: ['art', 'rad'], glyph: 'C' },
  cientifico: { name: 'Científico', main: 'cie', sec: ['med', 'ing'], glyph: 'S' },
  mecanico: { name: 'Mecánico', main: 'ing', sec: ['art', 'pil'], glyph: 'E' },
  preso: { name: 'Prisionero', main: null, sec: [], glyph: 'Z' },
};

// Rasgos. kind: 'pos' | 'neg' | 'hid' (oculto). mods: modificadores numéricos usados por la simulación.
export const TRAITS = {
  veterano: { name: 'Veterano de guerra', kind: 'pos', desc: 'Sobrevivió a Stalingrado. Mantiene la calma en combate (moral −50% de pérdida) y apunta mejor.', mods: { combatCalm: 0.5, accuracy: 0.05 } },
  manitas: { name: 'Manitas', kind: 'pos', desc: 'Arregla cualquier cosa con alambre. Repara un 35% más rápido.', mods: { repairMul: 1.35 } },
  siberiano: { name: 'Siberiano', kind: 'pos', desc: 'Nacido a −50 °C. El frío le afecta la mitad.', mods: { coldMul: 0.5 } },
  robusto: { name: 'Robusto', kind: 'pos', desc: '+25 de salud máxima y las heridas le hacen menos daño.', mods: { hpMax: 25, injuryMul: 0.8 } },
  incansable: { name: 'Incansable', kind: 'pos', desc: 'Se cansa un 30% más despacio.', mods: { fatigueMul: 0.7 } },
  optimista: { name: 'Optimista', kind: 'pos', desc: 'El vaso siempre medio lleno (de vodka). Moral base +12.', mods: { moraleBase: 12 } },
  cantante: { name: 'Cantante', kind: 'pos', desc: 'Canta canciones del frente. Sube la moral de quien esté en su sala.', mods: { aura: 4 } },
  halcon: { name: 'Ojo de halcón', kind: 'pos', desc: '+12% de puntería en las torretas.', mods: { accuracy: 0.12 } },
  leal: { name: 'Fiel al Partido', kind: 'pos', desc: 'Carnet desde los 16. Reduce la sospecha que generan sus compañeros.', mods: { suspicionMul: 0.85, polBonus: 1 } },
  heroe: { name: 'Héroe de la Unión Soviética', kind: 'pos', desc: 'Medalla de oro. Toda la tripulación gana +5 de moral base.', mods: { auraAll: 5 } },
  agil: { name: 'Ágil', kind: 'pos', desc: 'Se mueve un 35% más rápido por la nave.', mods: { moveMul: 1.35 } },
  erudito: { name: 'Erudito', kind: 'pos', desc: 'Aprende un 60% más rápido y aporta más a la ciencia.', mods: { xpMul: 1.6, sciMul: 1.3 } },
  chef: { name: 'Cocinero de vocación', kind: 'pos', desc: 'Sus guisos son legendarios: +2 comidas por tanda y +moral al comer.', mods: { meals: 2, mealMorale: 6 } },
  estoico: { name: 'Estoico', kind: 'pos', desc: 'Difícilmente se derrumba (crisis ×0.3).', mods: { breakdownMul: 0.3 } },
  abstemio: { name: 'Abstemio', kind: 'pos', desc: 'No bebe. Nunca se emborracha, pero el vodka no le anima.', mods: { abstinent: 1 } },
  calculador: { name: 'Mente de cálculo', kind: 'pos', desc: 'Navegación y radio un 25% más eficaces.', mods: { navMul: 1.25, radMul: 1.25 } },
  bebedor: { name: 'Bebedor', kind: 'neg', desc: 'Necesita su vodka. Sin él pierde moral; a veces bebe de servicio.', mods: { drinker: 1 } },
  torpe: { name: 'Torpe', kind: 'neg', desc: 'A veces estropea lo que intenta reparar.', mods: { clumsy: 0.08 } },
  gloton: { name: 'Glotón', kind: 'neg', desc: 'Tiene hambre un 45% más rápido.', mods: { hungerMul: 1.45 } },
  insomne: { name: 'Insomne', kind: 'neg', desc: 'Descansa un 35% peor.', mods: { restMul: 0.65 } },
  claustro: { name: 'Claustrofóbico', kind: 'neg', desc: 'En vuelo su moral baja sin parar.', mods: { flightMorale: -3 } },
  cobarde: { name: 'Cobarde', kind: 'neg', desc: 'Con la moral baja se niega a apagar fuegos o a tripular torretas.', mods: { coward: 1 } },
  hipocondriaco: { name: 'Hipocondríaco', kind: 'neg', desc: 'Gasta medicinas sin necesitarlas.', mods: { hypo: 1 } },
  supersticioso: { name: 'Supersticioso', kind: 'neg', desc: 'Las anomalías le aterran (moral ×2), pero adora los iconos.', mods: { superstitious: 1 } },
  perezoso: { name: 'Perezoso', kind: 'neg', desc: 'Trabaja un 20% más lento, aunque se cansa menos.', mods: { workMul: 0.8, fatigueMul: 0.85 } },
  bocazas: { name: 'Bocazas', kind: 'neg', desc: 'Habla demasiado en las paradas: +sospecha en ciudades y aeródromos.', mods: { gossip: 1 } },
  friolero: { name: 'Friolero', kind: 'neg', desc: 'El frío le afecta un 60% más.', mods: { coldMul: 1.6 } },
  grunon: { name: 'Gruñón', kind: 'neg', desc: 'Amarga el ambiente de su sala (−moral a los demás).', mods: { aura: -3 } },
  fragil: { name: 'Frágil', kind: 'neg', desc: '−20 de salud máxima.', mods: { hpMax: -20 } },
  informante: { name: 'Informante del KGB', kind: 'hid', desc: 'Informa a la Lubianka de todo lo que ocurre a bordo. Las decisiones desleales cuestan el doble de sospecha.', mods: { informant: 1 } },
  saboteador: { name: 'Saboteador', kind: 'hid', desc: 'Trabaja para alguien que no quiere que el Topolev llegue. Provoca averías e incendios.', mods: { saboteur: 1 } },
  disidente: { name: 'Disidente', kind: 'hid', desc: 'Lee a escondidas literatura prohibida. Si el KGB lo descubre, la sospecha se dispara.', mods: { dissident: 1, sciMul: 1.15 } },
  tisis: { name: 'Tisis oculta', kind: 'hid', desc: 'Una enfermedad que oculta. Pierde salud poco a poco si no recibe medicinas.', mods: { sick: 1 } },
  oyente: { name: 'Oye la Señal', kind: 'hid', desc: 'Desde niño oye «algo» en la estática. Cerca de Tunguska aporta conocimiento… y pesadillas.', mods: { hears: 1 } },
};

export const TRAIT_LIST = Object.keys(TRAITS);
export const POS_TRAITS = TRAIT_LIST.filter((t) => TRAITS[t].kind === 'pos');
export const NEG_TRAITS = TRAIT_LIST.filter((t) => TRAITS[t].kind === 'neg');
export const HID_TRAITS = TRAIT_LIST.filter((t) => TRAITS[t].kind === 'hid');

// Rasgos incompatibles entre sí
export const INCOMPATIBLE = [
  ['bebedor', 'abstemio'], ['siberiano', 'friolero'], ['robusto', 'fragil'], ['incansable', 'perezoso'],
  ['estoico', 'cobarde'], ['optimista', 'grunon'], ['leal', 'disidente'], ['leal', 'informante'],
  ['veterano', 'cobarde'], ['agil', 'torpe'], ['insomne', 'incansable'],
];
