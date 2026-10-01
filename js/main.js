// Arranque de La Misión Topolev.

import { Term } from './engine/term.js';
import { Input } from './engine/input.js';
import { UI } from './engine/ui.js';
import { Particles } from './engine/particles.js';
import { FX } from './engine/fx.js';
import { Audio } from './engine/audio.js';
import { Storage } from './engine/storage.js';
import { ScreenManager } from './engine/screens.js';
import { registerScreens } from './screens/index.js';
import { DEFAULT_META } from './game/meta.js';

export const DEFAULT_SETTINGS = {
  font: 'auto',
  volume: 0.5,
  muted: false,
  crt: true,
  glow: true,
  particles: 1,
  shake: true,
  speed: 1,
  hoverSound: true,
  autoPause: true,
  typewriter: true,
};

async function boot() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('16px TopoMono'), document.fonts.load('bold 16px TopoMono')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) {
    /* seguimos con la fuente de reserva */
  }

  const stage = document.getElementById('stage');
  const base = document.getElementById('base');
  const fxc = document.getElementById('fx');
  const glow = document.getElementById('glow');
  const crt = document.getElementById('crt');

  const settings = Storage.loadSettings(DEFAULT_SETTINGS);
  const meta = Storage.loadMeta(DEFAULT_META);

  const term = new Term(base, fxc, glow);
  term.fontSetting = settings.font;
  term.resize();
  const audio = new Audio();
  audio.volume = settings.volume;
  audio.muted = settings.muted;
  const input = new Input(base, term);
  input.onFirstInteraction = () => audio.init();
  const ui = new UI(term, input, audio);
  ui.onCursor = (c) => (base.style.cursor = c);
  const particles = new Particles(term);
  const fx = new FX(stage, term);

  const app = {
    term, input, ui, particles, fx, audio, settings, meta, stage,
    time: 0,
    run: null,
    slot: null,
    screens: null,
    applySettings() {
      term.setFontSetting(settings.font);
      input.refresh();
      audio.setVolume(settings.volume);
      audio.setMuted(settings.muted);
      crt.classList.toggle('off', !settings.crt);
      glow.classList.toggle('off', !settings.glow);
      term.glowOn = settings.glow;
      particles.mult = settings.particles;
      fx.enabledShake = settings.shake;
      ui.hoverSound = settings.hoverSound;
    },
    saveSettings() {
      Storage.saveSettings(settings);
    },
    saveMeta() {
      Storage.saveMeta(meta);
    },
    go(name, opts) {
      app.screens.go(name, opts);
    },
    toggleFullscreen() {
      try {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      } catch (e) {
        /* sin pantalla completa */
      }
    },
  };
  app.screens = new ScreenManager(app);
  window.__app = app; // depuración
  registerScreens(app.screens);
  app.applySettings();

  window.addEventListener('resize', () => {
    term.resize();
    input.refresh();
  });

  document.getElementById('boot').classList.add('hide');
  app.go('title');

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    app.time += dt;
    try {
      ui.begin(dt, app.time);
      app.screens.update(dt);
      particles.update(dt);
      fx.update(dt);
      term.clear();
      app.screens.render();
      ui.end();
      term.flush();
    } catch (e) {
      console.error(e);
      showError(e);
    }
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

let errShown = false;
function showError(e) {
  if (errShown) return;
  errShown = true;
  const d = document.createElement('pre');
  d.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:60%;color:#ff3b2f;background:#000c;border:1px solid #ff3b2f;padding:8px;font:12px monospace;z-index:9;white-space:pre-wrap;pointer-events:none';
  d.textContent = 'ERROR: ' + (e && e.stack ? e.stack : e);
  document.body.appendChild(d);
  setTimeout(() => {
    d.remove();
    errShown = false;
  }, 8000);
}

boot();
