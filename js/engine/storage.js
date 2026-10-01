// Persistencia en localStorage: ranuras de partida, ajustes y meta-progresión.

const P = 'topolev3.';
export const SLOTS = 3;

function read(key, def) {
  try {
    const s = localStorage.getItem(P + key);
    return s ? JSON.parse(s) : def;
  } catch (e) {
    return def;
  }
}
function write(key, val) {
  try {
    localStorage.setItem(P + key, JSON.stringify(val));
    return true;
  } catch (e) {
    console.warn('No se pudo guardar', e);
    return false;
  }
}

export const Storage = {
  loadSettings(defaults) {
    return Object.assign({}, defaults, read('settings', {}));
  },
  saveSettings(s) {
    write('settings', s);
  },
  loadMeta(defaults) {
    return Object.assign({}, defaults, read('meta', {}));
  },
  saveMeta(m) {
    write('meta', m);
  },
  saveSlot(i, run, summary) {
    const ok = write('slot' + i, run);
    if (ok) {
      write('slotinfo' + i, {
        savedAt: Date.now(),
        summary: summary || summarize(run),
      });
      write('lastSlot', i);
    }
    return ok;
  },
  loadSlot(i) {
    return read('slot' + i, null);
  },
  slotInfo(i) {
    return read('slotinfo' + i, null);
  },
  deleteSlot(i) {
    try {
      localStorage.removeItem(P + 'slot' + i);
      localStorage.removeItem(P + 'slotinfo' + i);
    } catch (e) {
      /* nada */
    }
  },
  lastSlot() {
    return read('lastSlot', null);
  },
};

function summarize(run) {
  return {
    region: run.regionIndex,
    day: Math.floor((run.clock || 0) / 1440) + 1,
    crew: (run.crew || []).filter((c) => !c.dead).length,
    difficulty: run.difficulty,
    variant: run.variant,
    seed: run.seed,
    phase: run.phase,
    over: !!run.over,
  };
}
