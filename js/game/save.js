// Guardado y carga de expedientes.

import { Storage } from '../engine/storage.js';
import { prepareSave, summary, syncIds, RUN_VERSION } from './run.js';

export function saveGame(app) {
  if (!app.run || app.slot == null) return false;
  return Storage.saveSlot(app.slot, prepareSave(app.run), summary(app.run));
}

export function loadGame(app, slot) {
  const run = Storage.loadSlot(slot);
  if (!run || run.v !== RUN_VERSION) return null;
  syncIds(run);
  app.run = run;
  app.slot = slot;
  return run;
}
