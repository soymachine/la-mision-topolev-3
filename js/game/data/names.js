// Nombres, apellidos, orígenes y topónimos (transliterados al español).

export const MALE = [
  'Alekséi', 'Andréi', 'Antón', 'Arkadi', 'Borís', 'Dmitri', 'Fiódor', 'Guennadi', 'Gleb', 'Grigori',
  'Ígor', 'Iliá', 'Iván', 'Konstantín', 'Leonid', 'Lev', 'Maksim', 'Mijaíl', 'Nikolái', 'Oleg',
  'Pável', 'Piotr', 'Román', 'Semión', 'Serguéi', 'Stanislav', 'Vadim', 'Valentín', 'Vasili', 'Víktor',
  'Vladímir', 'Yákov', 'Yuri', 'Zajar', 'Timur', 'Rustam', 'Arsén', 'Guiorgui', 'Aidar', 'Yegor',
  'Matvéi', 'Kiril', 'Artiom', 'Denís', 'Eduard', 'Gavriil', 'Timoféi', 'Ósip', 'Rinat', 'Tarás',
];

export const FEMALE = [
  'Alla', 'Anna', 'Daria', 'Galina', 'Irina', 'Liudmila', 'Lidia', 'Marina', 'María', 'Nadezhda',
  'Natalia', 'Nina', 'Olga', 'Raísa', 'Svetlana', 'Tamara', 'Tatiana', 'Valentina', 'Vera', 'Yelena',
  'Yevguenia', 'Zoya', 'Klavdia', 'Antonina', 'Aigul', 'Nino', 'Polina', 'Ksenia', 'Larisa', 'Valeria',
];

const PATRO = [
  'Ivánov', 'Petróv', 'Serguéyev', 'Nikoláyev', 'Mijáilov', 'Alekséyev', 'Andréyev', 'Fiódorov',
  'Vasílyev', 'Grigóriev', 'Dmítriev', 'Yúriev', 'Borísov', 'Pávlov', 'Semiónov', 'Stepánov',
  'Konstantínov', 'Víktorov', 'Vladímirov', 'Leonídov', 'Maksímov', 'Románov', 'Arkádiev',
  'Guennádiev', 'Yákovlev', 'Timoféyev', 'Matvéyev', 'Yegórov', 'Ósipov', 'Antónov',
];

export function patronymic(rng, female) {
  return rng.pick(PATRO) + (female ? 'na' : 'ich');
}

// Apellidos: [masculino, femenino]
const SUR_RU = [
  'Petrov', 'Smirnov', 'Ivanov', 'Kuznetsov', 'Popov', 'Vasíliev', 'Sokolov', 'Mijáilov', 'Novikov',
  'Fiódorov', 'Morozov', 'Volkov', 'Alekséyev', 'Lébedev', 'Semiónov', 'Yegórov', 'Pávlov', 'Kozlov',
  'Stepánov', 'Nikoláyev', 'Orlov', 'Andréyev', 'Makárov', 'Zajárov', 'Zaitsev', 'Soloviov', 'Borísov',
  'Yákovlev', 'Grigóriev', 'Románov', 'Vorobiov', 'Serguéyev', 'Kuzmín', 'Frolov', 'Aleksándrov',
  'Dmítriev', 'Koroliov', 'Gúsev', 'Kiseliov', 'Ilín', 'Maksímov', 'Poliakov', 'Sorokin', 'Vinográdov',
  'Kovaliov', 'Bélov', 'Medvédev', 'Antónov', 'Tarásov', 'Zhúkov', 'Baránov', 'Filíppov', 'Komarov',
  'Davýdov', 'Beliáyev', 'Guerásimov', 'Bogdánov', 'Ósipov', 'Sídorov', 'Matvéyev', 'Titov', 'Márkov',
  'Mirónov', 'Krylov', 'Kulikov', 'Kárpov', 'Vlásov', 'Mélnikov', 'Denísov', 'Gavrílov', 'Tíjonov',
  'Kazakov', 'Afanásiev', 'Danílov', 'Savéliev', 'Timoféyev', 'Fomín', 'Chernov', 'Abrámov', 'Martýnov',
  'Yefímov', 'Fedótov', 'Shcherbakov', 'Nazárov', 'Kalinin', 'Isáyev', 'Chernyshov', 'Bykov', 'Maslov',
  'Rodiónov', 'Lavréntiev', 'Rúsakov', 'Gromov', 'Belousov', 'Sharov', 'Utkin', 'Glazunov', 'Kórsakov',
];
const SUR_SKI = ['Zhukovski', 'Ostrovski', 'Kovalevski', 'Tsiolkovski', 'Pokrovski', 'Uspenski', 'Voznesenski', 'Rozhdestvenski'];
const SUR_INV = [
  'Shevchenko', 'Bondarenko', 'Kovalenko', 'Tkachenko', 'Levchenko', 'Kravchenko', 'Moroz', 'Beridze',
  'Kapanadze', 'Tsereteli', 'Grigorián', 'Avakián', 'Sarkisián', 'Lukashevich', 'Ozols', 'Tamm', 'Saar',
  'Kalnins', 'Karpenko', 'Savchenko',
];
const SUR_TURK = ['Ahmédov', 'Yusúpov', 'Tursúnov', 'Ismaílov', 'Sultánov', 'Rajímov', 'Nurmágomedov', 'Abdulín', 'Jasánov', 'Bekmámbetov'];

export function surname(rng, female) {
  const r = rng.next();
  if (r < 0.68) {
    const s = rng.pick(SUR_RU);
    return female ? s + 'a' : s;
  }
  if (r < 0.76) {
    const s = rng.pick(SUR_SKI);
    return female ? s.slice(0, -1) + 'aya' : s;
  }
  if (r < 0.88) {
    const s = rng.pick(SUR_TURK);
    return female ? s + 'a' : s;
  }
  return rng.pick(SUR_INV);
}

export const NICKS = [
  'el Oso', 'Sputnik', 'el Profesor', 'el Zorro', 'el Lobo', 'Chispas', 'el Abuelo', 'la Hormiga',
  'Matrioska', 'el Cosaco', 'Bujía', 'el Tártaro', 'el Mudo', 'Pajarito', 'Samovar', 'el Halcón',
  'Kaláshnikov', 'el Cura', 'Polilla', 'Martillo', 'el Poeta', 'Ceniza', 'Borsch', 'Tornillo',
];

export const ORIGINS = [
  'Moscú', 'Leningrado', 'Kiev', 'Minsk', 'Stalingrado', 'Sverdlovsk', 'Gorki', 'Kúibyshev', 'Novosibirsk',
  'Járkov', 'Odesa', 'Tiflis', 'Ereván', 'Bakú', 'Tashkent', 'Alma-Atá', 'Riga', 'Tallin', 'Vilna',
  'Múrmansk', 'Arcángel', 'Vladivostok', 'Irkutsk', 'Krasnoyarsk', 'Omsk', 'Perm', 'Kazán', 'Ufá',
  'Sebastopol', 'Rostov', 'Smolensk', 'Tula', 'Yakutsk', 'Magadán', 'Norilsk', 'Vorkutá', 'Samarcanda',
  'Chelyábinsk', 'Tomsk', 'Bárnaul', 'Kursk', 'Briansk', 'Kaliningrado', 'Petrozavodsk',
];

// --- Topónimos procedurales ------------------------------------------------
const PRE = ['Krasno', 'Novo', 'Staro', 'Belo', 'Cherno', 'Verjne', 'Nizhne', 'Ust-', 'Zalesno', 'Sosno', 'Lesno', 'Kamensk', 'Bolshe', 'Malo', 'Pervo', 'Polyarno', 'Ozerno', 'Severo', 'Yuzhno', 'Zlato'];
const ROOT = ['gorsk', 'yarsk', 'vodsk', 'dar', 'pol', 'grad', 'zavodsk', 'reche', 'lesye', 'borsk', 'kamsk', 'tundrino', 'ozersk', 'selye', 'polye', 'luzhsk', 'sibirsk', 'ural', 'taigino', 'ugolsk'];
const SINGLE = ['Kolyvan', 'Yemva', 'Ozyorsk', 'Dudinka', 'Igarka', 'Vanavara', 'Strelka', 'Mirny', 'Tura', 'Baykit', 'Kezhma', 'Chuna', 'Taseyevo', 'Kansk', 'Achinsk', 'Tayshet', 'Mama', 'Kirensk', 'Yerbogachen', 'Podkamennaya', 'Teteya', 'Chizhapka', 'Lebyazhye', 'Gremyachinsk', 'Lysva', 'Tavda', 'Ivdel', 'Serov', 'Kachkanar', 'Asbest'];

export function placeName(rng) {
  if (rng.chance(0.3)) return rng.pick(SINGLE);
  const p = rng.pick(PRE);
  let r = rng.pick(ROOT);
  if (p.endsWith('-')) r = r[0].toUpperCase() + r.slice(1);
  return p + r;
}

export const KOLKHOZ = ['Camino de Lenin', 'Aurora Roja', 'Octubre Rojo', 'Bandera Roja', 'Hoz y Martillo', 'Trabajo Libre', 'Nueva Vida', 'Primero de Mayo', 'Estrella del Norte', 'Amanecer Comunista', 'Kirov', 'Chapáiev', 'Pravda', 'Victoria', 'Plan Quinquenal', 'Gloria al Trabajo'];
export const SHIP_NICK = ['Matrioska', 'Babushka', 'la Ballena', 'el Elefante', 'la Catedral', 'el Samovar Volante'];
