// Condiciones de la misión (modificadores aleatorios por partida) y maestrías de habilidad.

export const MODIFIERS = {
  invierno: { name: 'Invierno temprano', kind: 'neg', desc: 'Siberia se hiela antes de tiempo: −6 °C en todas las regiones.' },
  purga: { name: 'Purga en el Partido', kind: 'neg', desc: 'Moscú ve traidores en todas partes: la sospecha sube un 25% más.' },
  escasez: { name: 'Escasez', kind: 'neg', desc: 'El combustible y la comida cuestan un 35% más.' },
  tormentas: { name: 'Año de tormentas', kind: 'neg', desc: 'Un frente tormentoso más en cada región.' },
  senal: { name: 'Señal intensa', kind: 'mix', desc: 'Más anomalías en vuelo, pero el conocimiento llega un 30% más rápido.' },
  presupuesto: { name: 'Presupuesto especial', kind: 'mix', desc: '+250 ₽ iniciales, pero alguien en Moscú vigila las cuentas (+8 sospecha).' },
  veteranos: { name: 'Tripulación veterana', kind: 'pos', desc: 'Cada tripulante inicial tiene +1 en su especialidad.' },
  revisado: { name: 'Recién revisado', kind: 'pos', desc: 'Los módulos de serie son más fiables y resistentes.' },
};

export function hasMod(run, id) {
  return !!(run.mods && run.mods.includes(id));
}

// Maestrías: habilidad 8 o más
export const MASTERY = {
  pil: 'Evasión +5% en combate.',
  nav: 'Rutas un 5% más cortas.',
  ing: 'Las reparaciones gastan la mitad de piezas.',
  med: 'Cura un 30% más rápido.',
  rad: 'Descifra y transmite un 50% más rápido.',
  art: 'Daño de torreta +30%.',
  coc: 'Una comida extra por tanda.',
  pol: 'Cada informe a Moscú vale el doble.',
  cie: 'Estudia la Señal un 50% más rápido.',
};
export const MASTER_LEVEL = 8;
export const isMaster = (c, sk) => (c?.skills?.[sk] || 0) >= MASTER_LEVEL;
