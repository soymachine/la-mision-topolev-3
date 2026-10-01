// Ajustes.

import { C } from '../palette.js';
import { clamp } from '../engine/util.js';

export class SettingsScreen {
  constructor(app, opts) {
    this.app = app;
    this.back = opts.back || 'title';
  }
  update() {}

  render() {
    const app = this.app;
    const { term, ui } = app;
    const s = app.settings;
    const W = term.cols;
    const H = term.rows;
    const pw = 70;
    const px = Math.floor((W - pw) / 2);
    const ph = 32;
    const py = Math.max(1, Math.floor((H - ph) / 2));
    ui.panel(px, py, pw, ph, { title: 'AJUSTES', style: 'double' });
    let y = py + 2;
    const row = (label) => {
      term.text(px + 3, y, label, C.o4);
    };
    let changed = false;
    // tamaño de letra
    row('Tamaño de letra');
    const fonts = ['auto', 10, 11, 12, 13, 14, 15, 16, 18, 20];
    const fi = fonts.indexOf(s.font);
    if (ui.button('font_m', px + 30, y, '◄', { w: 5 })) {
      s.font = fonts[Math.max(0, fi - 1)];
      changed = true;
    }
    term.text(px + 37, y, s.font === 'auto' ? 'Automático' : `${s.font} px`, C.o6);
    if (ui.button('font_p', px + 50, y, '►', { w: 5 })) {
      s.font = fonts[Math.min(fonts.length - 1, fi + 1)];
      changed = true;
    }
    y += 2;
    row('Volumen');
    if (ui.button('vol_m', px + 30, y, '◄', { w: 5 })) {
      s.volume = clamp(Math.round((s.volume - 0.1) * 10) / 10, 0, 1);
      changed = true;
    }
    ui.bar(px + 37, y, 11, s.volume, { fg: C.o5 });
    if (ui.button('vol_p', px + 50, y, '►', { w: 5 })) {
      s.volume = clamp(Math.round((s.volume + 0.1) * 10) / 10, 0, 1);
      changed = true;
      app.audio.play('click');
    }
    y += 2;
    const tog = (key, label, tip) => {
      const v = ui.toggle('tg_' + key, px + 3, y, label, s[key], { w: pw - 6, tip });
      if (v !== s[key]) {
        s[key] = v;
        changed = true;
      }
      y += 2;
    };
    tog('muted', 'Silenciar todo el sonido');
    tog('music', 'Música');
    tog('hoverSound', 'Sonido al pasar el ratón');
    tog('crt', 'Efecto CRT (líneas y viñeta)');
    tog('glow', 'Resplandor (bloom)');
    tog('shake', 'Sacudidas de pantalla');
    tog('autoPause', 'Pausa automática ante emergencias');
    tog('typewriter', 'Texto con efecto máquina de escribir');
    row('Partículas');
    const opts = [0.4, 1, 1.6];
    const names = ['Pocas', 'Normales', 'Muchas'];
    for (let i = 0; i < 3; i++) {
      if (ui.button('pt_' + i, px + 30 + i * 12, y, names[i], { w: 11, style: 'tab', selected: s.particles === opts[i] })) {
        s.particles = opts[i];
        changed = true;
      }
    }
    y += 2;
    if (ui.button('fs', px + 3, y, 'Alternar pantalla completa', { w: 30 })) app.toggleFullscreen();
    if (changed) {
      app.applySettings();
      app.saveSettings();
    }
    if (ui.button('set_back', px + pw - 17, py + ph - 2, 'Volver', { w: 14, key: 'Escape' })) {
      if (this.back === 'flight' || this.back === 'map') app.go(this.back);
      else app.go('title');
    }
  }
}
