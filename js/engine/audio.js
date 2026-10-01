// Sonido sintetizado con WebAudio (sin archivos externos).

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.5;
    this.muted = false;
    this.loops = new Map();
    this.last = new Map();
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.ctx = null;
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  tone(freq, dur, type = 'square', vol = 0.15, slide = null, delay = 0) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.2, f0 = 2000, f1 = 200, type = 'lowpass', delay = 0, q = 1) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t0, Math.random());
    s.stop(t0 + dur + 0.05);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    // limitar repetición del mismo sonido
    const now = performance.now();
    const minGap = { hover: 35, type: 25, gun: 45, hit: 60 }[name] ?? 20;
    if (now - (this.last.get(name) || 0) < minGap) return;
    this.last.set(name, now);
    if (this.ctx.state === 'suspended') this.ctx.resume();
    switch (name) {
      case 'hover': this.tone(1800, 0.025, 'sine', 0.025); break;
      case 'click': this.tone(700, 0.05, 'square', 0.06, 350); break;
      case 'deny': this.tone(160, 0.12, 'square', 0.07, 110); break;
      case 'pick': this.tone(500, 0.06, 'triangle', 0.08, 900); break;
      case 'drop': this.tone(900, 0.08, 'triangle', 0.08, 300); this.noise(0.05, 0.05, 3000, 800); break;
      case 'cancel': this.tone(400, 0.08, 'triangle', 0.05, 200); break;
      case 'type': this.tone(2400 + Math.random() * 600, 0.012, 'square', 0.012); break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone(880, 0.14, 'square', 0.06, null, i * 0.32);
          this.tone(660, 0.14, 'square', 0.06, null, i * 0.32 + 0.16);
        }
        break;
      case 'explosion': this.noise(0.9, 0.35, 1400, 60); this.tone(90, 0.5, 'sine', 0.2, 30); break;
      case 'hit': this.noise(0.25, 0.22, 2500, 200); this.tone(140, 0.15, 'square', 0.08, 60); break;
      case 'gun': this.noise(0.06, 0.12, 4000, 1500, 'bandpass', 0, 2); break;
      case 'flak': this.noise(0.4, 0.2, 900, 80); break;
      case 'radio':
        this.noise(0.35, 0.06, 3000, 1200, 'bandpass', 0, 4);
        for (let i = 0; i < 4; i++) this.tone(1100, Math.random() < 0.5 ? 0.05 : 0.12, 'sine', 0.04, null, 0.1 + i * 0.16);
        break;
      case 'success': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.08, null, i * 0.08)); break;
      case 'fail': [392, 330, 262].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.08, null, i * 0.12)); break;
      case 'coin': this.tone(1300, 0.06, 'square', 0.04); this.tone(1700, 0.1, 'square', 0.04, null, 0.06); break;
      case 'page': this.noise(0.12, 0.05, 6000, 2000, 'highpass'); break;
      case 'fire': this.noise(0.4, 0.06, 900, 300); break;
      case 'hiss': this.noise(0.8, 0.08, 6000, 3000, 'highpass'); break;
      case 'repair': this.tone(300 + Math.random() * 200, 0.04, 'square', 0.03); break;
      case 'scram': this.tone(1200, 0.6, 'sawtooth', 0.06, 100); break;
      case 'land': this.noise(1.2, 0.15, 800, 100); break;
      case 'stamp': this.noise(0.08, 0.3, 1200, 200); this.tone(80, 0.12, 'sine', 0.2, 40); break;
      case 'warn': this.tone(520, 0.1, 'square', 0.05); this.tone(520, 0.1, 'square', 0.05, null, 0.15); break;
      default: break;
    }
  }

  // --- Música generativa (re menor armónico, aire de canción popular) ----------
  setMusic(on) {
    this.musicOn = on;
    if (!on) this.music(null);
    else if (this.musicMode) this.music(this.musicMode, true);
  }

  music(mode, force = false) {
    if (mode === this.musicMode && !force) return;
    this.musicMode = mode;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (!mode || !this.ctx || this.musicOn === false) return;
    const SCALE = [0, 2, 3, 5, 7, 8, 11, 12, 14, 15];
    const base = { title: 146.83, map: 146.83, flight: 110, combat: 98, event: 130.81, over: 110 }[mode] || 146.83;
    const bpm = { title: 54, map: 50, flight: 60, combat: 96, event: 46, over: 40 }[mode] || 54;
    const beat = 60 / bpm;
    this.mStep = 0;
    this.mDeg = 4;
    this.mNext = this.ctx.currentTime + 0.1;
    const vol = mode === 'combat' ? 0.05 : 0.035;
    const tick = () => {
      if (!this.ctx || this.muted) return;
      while (this.mNext < this.ctx.currentTime + 0.4) {
        const t0 = this.mNext - this.ctx.currentTime;
        const step = this.mStep++;
        // bajo cada compás
        if (step % 8 === 0) {
          const root = step % 32 < 16 ? 1 : step % 32 < 24 ? 0.75 : 0.667;
          this.tone(base * root * 0.5, beat * 7, 'triangle', vol * 1.1, null, t0);
        }
        // melodía: paseo aleatorio por la escala con silencios
        if (Math.random() < (mode === 'combat' ? 0.75 : 0.55)) {
          this.mDeg = Math.max(0, Math.min(SCALE.length - 1, this.mDeg + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
          const f = base * Math.pow(2, SCALE[this.mDeg] / 12);
          const pluck = mode === 'title' || mode === 'event';
          this.tone(f, pluck ? beat * 0.9 : beat * 1.6, pluck ? 'triangle' : 'sine', vol * (pluck ? 1 : 0.8), null, t0);
          if (pluck && Math.random() < 0.3) this.tone(f * 2, beat * 0.4, 'triangle', vol * 0.4, null, t0 + beat * 0.5);
        }
        this.mNext += beat;
      }
    };
    tick();
    this.musicTimer = setInterval(tick, 150);
  }

  // Bucles ambientales: 'engine' (zumbido) y 'wind' (viento)
  loop(name, on, param = 1) {
    if (!this.ctx) return;
    let l = this.loops.get(name);
    if (on && !l) {
      const c = this.ctx;
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      l = { g, nodes: [] };
      if (name === 'engine') {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 220;
        f.connect(g);
        for (const fr of [48, 48.7, 96.3]) {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = fr;
          o.connect(f);
          o.start();
          l.nodes.push(o);
        }
        l.filter = f;
      } else if (name === 'wind') {
        const s = c.createBufferSource();
        s.buffer = this.noiseBuf;
        s.loop = true;
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 500;
        f.Q.value = 0.7;
        s.connect(f).connect(g);
        s.start();
        l.nodes.push(s);
        l.filter = f;
      }
      this.loops.set(name, l);
    }
    if (!l) return;
    const t = this.ctx.currentTime;
    const target = on ? (name === 'engine' ? 0.05 : 0.04) * param : 0;
    l.g.gain.setTargetAtTime(target, t, 0.4);
    if (name === 'engine' && l.nodes.length) {
      const base = 44 + 14 * param;
      l.nodes[0].frequency.setTargetAtTime(base, t, 0.5);
      l.nodes[1].frequency.setTargetAtTime(base * 1.013, t, 0.5);
      l.nodes[2].frequency.setTargetAtTime(base * 2.01, t, 0.5);
    }
    if (name === 'wind' && l.filter) l.filter.frequency.setTargetAtTime(300 + 500 * param, t, 0.8);
  }
}
