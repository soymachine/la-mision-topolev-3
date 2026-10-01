// Pantalla de vuelo: micro-gestión en tiempo real con pausa.

import { C } from '../palette.js';
import { mix, clamp, pad, padL, wrap } from '../engine/util.js';
import { Noise2D } from '../engine/rng.js';
import { layout, SHIP_W, SHIP_H } from '../game/ship.js';
import { alive, fmtClock, RES, caps, log, addRes } from '../game/run.js';
import { displayName, roleName } from '../game/crew.js';
import { SYSTEMS, POLICIES, hull, crewRoom, findTask, daylight, outsideTemp } from '../game/fcore.js';
import { stepFlight, setPower, powerUsed, THROTTLE, evasiveManeuver, launchFlares, scram, orderCrew, ventRoom, toggleOverload, toggleDoor } from '../game/flight.js';
import { ENEMIES } from '../game/data/enemies.js';
import { COVERAGE, TURRET_STATION, weaponPowered } from '../game/incidents.js';
import { RECIPES, addOrder, cancelOrder, POL_FOCUS } from '../game/stations.js';
import { buildPopup } from '../game/popups.js';
import { saveGame } from '../game/save.js';
import { modLines } from '../game/loot.js';
import { CAT } from '../game/data/traits.js';
import { ShipView, crewGlyph } from './ui/shipview.js';
import { drawCrewCards, crewTooltip } from './ui/crewcards.js';
import { resourceBar, suspicionMeter, clockWidget, sectionTitle } from './ui/common.js';
import { drawDossier } from './ui/dossier.js';

const TIPS = [
  'Si una sala arde sin control, despresurízala: el fuego se ahoga en segundos (saca antes a la gente).',
  'La sobrecarga del reactor da +3 de energía. Úsala en combate, pero vigila el calor.',
  'Antes de una tormenta, sube la calefacción y ten a alguien libre para picar hielo.',
  'Los artilleros solo disparan si su torreta tiene energía en el sistema de Armas.',
  'Con poca munición, el taller puede fabricar más a partir de piezas.',
  'El comisario puede investigar a un tripulante desde la Comisaría (Vigilancia).',
  'Un tripulante con una orden directa lleva una flecha ▾. Clic derecho para liberarle.',
  'Haz clic en una tarea para marcarla como urgente: atraerá a más gente.',
  'Haz clic en una puerta (¦) o escotilla (╫) para cerrarla: aísla incendios, brechas y radiación.',
  'Las literas son pocas. Con la política de turnos decides cuánto se descansa.',
  'Quien no está sentado o tumbado puede herirse en turbulencias y maniobras.',
  'Sin navegante el tramo se alarga; sin piloto, el piloto automático es torpe.',
  'La radio necesita energía para descifrar mensajes y transmitir códigos IFF.',
];

const LOGCOL = { info: C.o3, good: C.rad2, bad: C.red, warn: C.gold, party: C.o6 };
const ALERTCOL = { info: C.o6, good: C.rad, danger: C.red, warn: C.gold, party: C.o7 };

export class FlightScreen {
  constructor(app) {
    this.app = app;
    this.ship = new ShipView(app);
    this.sel = { crew: null, room: null, dossier: null };
    this.paused = false;
    this.menu = false;
    this.popup = null;
    this.toasts = [];
    this.noise = new Noise2D(77);
    this.landT = 0;
    this.saveT = 0;
    this.snowAcc = 0;
    this.radarAng = 0;
    this.enemyFlash = {};
  }

  get run() {
    return this.app.run;
  }

  onBlur() {
    this.paused = true;
  }

  enter() {
    this.app.audio.loop('engine', true, 1);
    this.app.audio.loop('wind', true, 0.5);
  }
  exit() {
    this.app.audio.loop('engine', false);
    this.app.audio.loop('wind', false);
  }

  // --- Lógica -----------------------------------------------------------------
  update(dt) {
    const run = this.run;
    const f = run.flight;
    if (!f) return;
    // ventanas emergentes pendientes
    if (!this.popup && f.popups.length) {
      const p = f.popups[0];
      this.popup = { def: buildPopup(run, p), raw: p, result: null };
      this.paused = true;
    }
    if (!this.popup && run.pendingReveal && run.pendingReveal.length) {
      const r = run.pendingReveal.shift();
      f.popups.push({ id: 'reveal', crew: r.crew, trait: r.trait });
    }
    const blocked = this.paused || this.menu || this.popup || this.sel.dossier;
    if (!blocked && !f.arrived && !run.over) stepFlight(run, dt);
    this.consumeFx(dt);
    // música: tensión en combate
    this.app.audio.music(f.combat || f.incoming ? 'combat' : 'flight');
    // sonido de motores según régimen
    this.app.audio.loop('engine', !f.arrived, f.speedKmh > 0 ? 0.6 + run.ship.throttle * 0.4 : 0.1);
    this.app.audio.loop('wind', !f.arrived, 0.4 + f.weather);
    // autoguardado
    this.saveT += dt;
    if (this.saveT > 30) {
      this.saveT = 0;
      saveGame(this.app);
    }
    // fin
    if (run.over) {
      this.landT += dt;
      if (this.landT > 2.2) {
        saveGame(this.app);
        this.app.go('gameover');
      }
      return;
    }
    if (f.arrived && !this.popup) {
      this.landT += dt;
      if (this.landT > 2) {
        run.phase = 'arrive';
        saveGame(this.app);
        this.app.go('event', { arrival: true });
      }
    }
    // partículas ambientales: nieve que pasa (sensación de velocidad)
    const P = this.app.particles;
    const area = this.shipArea;
    if (area && !f.arrived) {
      this.snowAcc += dt * (8 + f.weather * 40) * (f.speedKmh / 500);
      while (this.snowAcc > 1) {
        this.snowAcc--;
        P.snow(area.x + area.w + 1, area.y + Math.random() * area.h, 1, { vx: -(25 + Math.random() * 25) * (f.speedKmh / 500 + 0.2), vy: 1 + Math.random() * 2, life: (area.w + 4) / 30, alpha: 0.25 + f.weather * 0.4, glyphs: '-·.' });
      }
    }
  }

  consumeFx(dt) {
    const run = this.run;
    const f = run.flight;
    const { particles: P, audio, fx } = this.app;
    const sv = this.ship;
    if (sv.ox == null) return;
    const L = layout();
    const ox = sv.ox;
    const oy = sv.oy;
    const events = f.fx || [];
    f.fx = [];
    for (const e of events) {
      switch (e.kind) {
        case 'alert':
          if (e.sound) audio.play(e.sound);
          if (e.pause && this.app.settings.autoPause) this.paused = true;
          break;
        case 'hurt': {
          const c = run.crew.find((x) => x.id === e.crew);
          if (c && e.amount >= 1) P.text(ox + c.x + 0.5, oy + c.y - 0.5, '-' + e.amount, C.red, { life: 1.2 });
          break;
        }
        case 'death': P.explosion(ox + e.x + 0.5, oy + e.y + 0.5, 0.5); break;
        case 'fire': {
          const R = L.rooms[e.room];
          P.sparks(ox + (R.x0 + R.x1) / 2, oy + R.floor, 12);
          break;
        }
        case 'breach': {
          const R = L.rooms[e.room];
          for (let i = 0; i < 12; i++) P.snow(ox + R.x + R.w / 2, oy + R.y + 0.5, 1, { vx: -6 + Math.random() * 12, vy: 3 + Math.random() * 4, life: 1 });
          fx.shake(4, 0.3);
          break;
        }
        case 'sparks': {
          const R = L.rooms[e.room];
          if (R) P.sparks(ox + (R.x0 + R.x1) / 2, oy + R.floor - 1, 10);
          break;
        }
        case 'spark': if (Math.random() < 0.6) P.sparks(ox + e.x + 0.5, oy + e.y + 0.5, 2, { speed: 0.5 }); if (Math.random() < 0.2) audio.play('repair'); break;
        case 'extinguish': P.steam(ox + e.x, oy + e.y, 2); break;
        case 'ice': P.snow(ox + e.x + 0.5, oy + e.y, 2, { vx: (Math.random() - 0.5) * 6, vy: -2, life: 0.6 }); break;
        case 'heal': P.add({ x: ox + e.x + 0.5, y: oy + e.y, vy: -1.2, life: 1, g: '+', c0: C.red, c1: C.redD }); break;
        case 'cooked': P.text(ox + e.x + 0.5, oy + e.y - 1, `+${e.n}♨`, C.o7); P.steam(ox + e.x + 0.5, oy + e.y - 1, 4); break;
        case 'steam': P.steam(ox + e.x + 0.5, oy + e.y - 1.5, 1); break;
        case 'zzz': {
          const c = run.crew.find((x) => x.id === e.crew);
          if (c) P.zzz(ox + c.x + 0.7, oy + c.y - 0.3);
          break;
        }
        case 'radio': {
          const s = L.stations.radio;
          P.add({ x: ox + s.x + 1.5, y: oy + s.y - 2, vx: 2, life: 0.7, seq: [')', '))', ')))'], g: ')', c0: C.o6, c1: C.o1 });
          break;
        }
        case 'science': P.text(ox + e.x + 0.5, oy + e.y - 1, '+Ψ', C.violet); break;
        case 'stamp': P.text(ox + e.x + 0.5, oy + e.y - 1, '☭', C.red); audio.play('stamp'); break;
        case 'shot': this.shotFx(e); break;
        case 'hit':
          this.roomFlash = this.roomFlash || {};
          if (e.room) this.roomFlash[e.room] = this.app.time;
          P.explosion(ox + e.x, oy + e.y, e.flak ? 0.6 : 0.8 + (e.dmg || 5) / 15);
          fx.shake(3 + (e.dmg || 5) / 3, 0.35);
          fx.flash(C.o5, 0.15, 0.12);
          audio.play('hit');
          if (!e.flak) this.enemyFire(e, true);
          break;
        case 'miss': this.enemyFire(e, false); break;
        case 'flak': P.explosion(ox + e.x, oy + e.y, 0.35); audio.play('flak'); break;
        case 'kill': {
          this.enemyFlash[e.enemy] = 1;
          const p = this.enemyScreen?.[e.enemy];
          if (p) P.explosion(p.x + 0.5, p.y + 0.5, 1.2);
          audio.play('explosion');
          fx.shake(4, 0.3);
          break;
        }
        case 'levelup': {
          const c = run.crew.find((x) => x.id === e.crew);
          if (c) P.ring(ox + c.x + 0.5, oy + c.y + 0.5, 14, C.gold, 6);
          break;
        }
        case 'shake': fx.shake(e.amount || 4, 0.4); break;
        case 'flash': fx.flash(e.color || '#ffffff', 0.25, 0.3); break;
        case 'anomaly': fx.flash(C.violet, 0.8, 0.25); for (let i = 0; i < 30; i++) P.add({ x: ox + Math.random() * SHIP_W, y: oy + Math.random() * SHIP_H, vy: -0.5, life: 2, g: '◊', c0: C.violet, c1: '#000000', fadeIn: 0.5 }); break;
        case 'bigboom': {
          const R = L.rooms[e.room];
          P.explosion(ox + (R.x0 + R.x1) / 2, oy + R.floor - 1, 2.5);
          fx.shake(14, 1.2);
          fx.flash('#ffffff', 0.6, 0.6);
          break;
        }
        case 'flares':
          for (let i = 0; i < 24; i++) P.add({ x: ox + 20 + Math.random() * 50, y: oy + SHIP_H - 2, vx: -8 - Math.random() * 10, vy: 2 + Math.random() * 6, ay: 4, life: 2.5, g: '*', c0: C.gold, c1: C.red2 });
          break;
        case 'landed': audio.play('land'); break;
        case 'crafted': audio.play('success'); break;
        case 'eat': break;
        default: break;
      }
    }
  }

  // Posición en pantalla de un contacto (vuela alrededor del avión según su sector)
  enemyPos(e) {
    const ox = this.ship.ox;
    const oy = this.ship.oy;
    const area = this.shipArea || { x: ox, y: oy, w: SHIP_W, h: SHIP_H };
    const cx = ox + SHIP_W / 2;
    const cy = oy + SHIP_H / 2;
    const base = { proa: 0, popa: Math.PI, arriba: -Math.PI / 2, abajo: Math.PI / 2 }[e.sector] ?? 0;
    const a = base + Math.sin(e.ang) * 0.55;
    const k = clamp(e.dist / 100, 0.2, 1.2);
    const rx = SHIP_W / 2 + 2 + k * 14;
    const ry = SHIP_H / 2 + 1 + k * 4;
    let x = cx + Math.cos(a) * rx;
    let y = cy + Math.sin(a) * ry;
    x = clamp(x, area.x + 1, area.x + area.w - 2);
    y = clamp(y, area.y, area.y + area.h - 2);
    // suavizado
    const prev = this.enemyScreen?.[e.id];
    if (prev) {
      x = prev.x + (x - prev.x) * 0.08;
      y = prev.y + (y - prev.y) * 0.08;
    }
    this.enemyScreen = this.enemyScreen || {};
    this.enemyScreen[e.id] = { x, y };
    return { x, y };
  }

  drawEnemies(f) {
    const { term } = this.app;
    const t = this.app.time;
    for (const e of f.enemies || []) {
      const E = ENEMIES[e.type];
      const p = this.enemyPos(e);
      const flash = (this.enemyFlash[e.id] || 0) > 0;
      const col = flash ? C.white : e.fleeing ? C.grey : f.target === e.id ? C.gold : C.red;
      term.ent(p.x, p.y, E.glyph, col, null, e.fleeing ? 0.5 : 1);
      // estela
      if (Math.random() < 0.3) this.app.particles.add({ x: p.x + 0.5, y: p.y + 0.5, vx: -2 + Math.random(), vy: 0, life: 0.5, g: '·', c0: C.o3, c1: C.o0, alpha: 0.5 });
      if (f.target === e.id && Math.floor(t * 3) % 2) {
        term.ent(p.x - 1, p.y, '[', C.gold, null, 0.8);
        term.ent(p.x + 1, p.y, ']', C.gold, null, 0.8);
      }
    }
  }

  // trazadora desde una torreta hacia fuera
  shotFx(e) {
    const L = layout();
    const s = L.stations[e.station];
    const { particles: P, audio } = this.app;
    const ox = this.ship.ox;
    const oy = this.ship.oy;
    const sx = ox + s.x + 0.5;
    const sy = oy + s.y - 1;
    const enemy = this.run.flight.enemies.find((x) => x.id === e.enemy);
    let tx = sx + 40;
    let ty = sy - 10;
    if (enemy) {
      const p = this.enemyPos(enemy);
      tx = p.x + 0.5 + (e.hit ? 0 : (Math.random() - 0.5) * 8);
      ty = p.y + 0.5 + (e.hit ? 0 : (Math.random() - 0.5) * 4);
      if (e.hit) setTimeout(() => P.sparks(p.x + 0.5, p.y + 0.5, 6, { speed: 0.6 }), 160);
    }
    for (let i = 0; i < 3; i++) setTimeout(() => P.tracer(sx, sy, tx + (Math.random() - 0.5) * 4, ty + (Math.random() - 0.5) * 3, { speed: 90 }), i * 70);
    audio.play('gun');
    if (e.hit && enemy) this.enemyFlash[enemy.id] = 0.5;
  }

  enemyFire(e, hit) {
    const enemy = this.run.flight.enemies.find((x) => x.id === e.enemy);
    const { particles: P } = this.app;
    const ox = this.ship.ox;
    const oy = this.ship.oy;
    let sx = ox + SHIP_W + 8;
    let sy = oy - 4;
    if (enemy) {
      const p = this.enemyPos(enemy);
      sx = p.x + 0.5;
      sy = p.y + 0.5;
    }
    const tx = e.x + (hit ? 0 : (Math.random() - 0.5) * 30);
    const ty = e.y + (hit ? 0 : (Math.random() < 0.5 ? -8 : 10));
    for (let i = 0; i < 4; i++) setTimeout(() => P.tracer(sx, sy, ox + tx, oy + ty, { speed: 80, c0: C.red, c1: C.o3 }), i * 60);
    if (!hit) this.app.audio.play('gun');
  }

  // --- Dibujo -------------------------------------------------------------------
  render() {
    const app = this.app;
    const { term, ui, input } = app;
    const run = this.run;
    const f = run.flight;
    if (!f) return;
    const W = term.cols;
    const H = term.rows;
    const LW = 32;
    const RW = clamp(W - LW - 96, 38, 52);
    const CX = LW + 1;
    const CW = W - LW - RW - 2;
    const RX = W - RW;
    this.layoutInfo = { LW, RW, CX, CW, RX };

    // teclado
    if (!this.popup && !this.menu && !this.sel.dossier) {
      if (input.key(' ')) {
        this.paused = !this.paused;
        app.audio.play('click');
      }
      if (input.key('1')) this.setSpeed(1);
      if (input.key('2')) this.setSpeed(2);
      if (input.key('3')) this.setSpeed(4);
      if (input.key('Escape')) {
        if (this.sel.crew || this.sel.room) this.sel.crew = this.sel.room = null;
        else this.menu = true;
      }
      if (input.key('e')) evasiveManeuver(run);
      if (input.key('s') && !input.key('S')) launchFlares(run);
    }

    // fondo del cielo
    this.drawSky(CX, 3, CW, SHIP_H + 4, f);

    // barra superior
    this.drawTopBar(W, f);

    // columna izquierda
    ui.panel(0, 2, LW, H - 2, { title: `TRIPULACIÓN ${alive(run).length}`, bg: C.bg1 });
    const cards = drawCrewCards(app, run, 1, 3, LW - 2, H - 6, this.sel);
    this.drawPolicy(1, H - 2, LW - 2);

    // nave
    const SX = CX + Math.max(0, Math.floor((CW - SHIP_W) / 2));
    const SY = 4;
    this.shipArea = { x: CX, y: 3, w: CW, h: SHIP_H + 2 };
    const hoverRoomPrev = this.hoverRoom;
    let highlight = null;
    if (this.hoverTask) {
      const tk = f.tasks.find((t) => t.id === this.hoverTask);
      if (tk) highlight = { room: tk.room, x: tk.x != null ? SX + tk.x : null, y: SY + (tk.y ?? 0) };
    }
    this.ship.render(run, SX, SY, { hoverRoom: hoverRoomPrev, selRoom: this.sel.room, highlight, flash: this.roomFlash });
    this.shipInteractions(run, SX, SY, cards.hover);
    this.ship.drawCrew(run, { selCrew: this.sel.crew, hoverCrew: this.hoverCrew || cards.hover });
    this.drawEnemies(f);

    // estado sobre la nave: pausa, aterrizaje
    this.drawShipOverlay(CX, 3, CW, f);

    // paneles inferiores
    const by = SY + SHIP_H + 1;
    const bh = H - by;
    const pw = 31;
    const mw = 30;
    const rw = clamp(CW - pw - mw, 24, 36);
    const panH = Math.min(15, bh);
    this.drawPower(CX, by, pw, panH);
    this.drawEngines(CX + pw, by, mw, panH);
    this.drawRadar(CX + pw + mw, by, CW - pw - mw, panH);
    if (bh - panH >= 4) this.drawLog(CX, by + panH, CW, bh - panH);

    // columna derecha
    const th = Math.floor((H - 2) * 0.52);
    this.drawTasks(RX, 2, RW, th);
    this.drawSelection(RX, 2 + th, RW, H - 2 - th);

    // avisos flotantes
    this.drawToasts(CX, 3, CW, f);

    // modales
    if (this.sel.dossier) {
      const c = run.crew.find((x) => x.id === this.sel.dossier);
      ui.beginModal(0.65);
      const close = drawDossier(app, run, c, { inFlight: true });
      ui.endModal();
      if (close) this.sel.dossier = null;
    }
    if (this.popup) this.drawPopup();
    if (this.menu) this.drawMenu();
  }

  setSpeed(s) {
    this.run.speed = s;
    this.paused = false;
    this.app.audio.play('click');
  }

  drawTopBar(W, f) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    term.fill(0, 0, W, 2, ' ', C.o4, C.bg2);
    let x = 1;
    term.text(x, 0, '☭', C.red);
    term.text(x + 2, 0, run.ship.name.toUpperCase(), C.o5, null, 1);
    x += run.ship.name.length + 4;
    term.text(x, 0, '│', C.o1);
    x += 2;
    x += clockWidget(app, x, 0, run) + 2;
    term.text(x, 0, '│', C.o1);
    x += 2;
    // progreso del tramo
    const from = run.map.nodes[f.from].name;
    const to = f.toName;
    const pct = clamp(f.done / f.dist, 0, 1);
    const routeW = clamp(W - x - 48, 20, 60);
    const label = `→ ${to}`;
    ui.mtext(x, 0, `{d}${label.slice(0, routeW)}{/}`, C.o4);
    x += Math.min(label.length, routeW) + 1;
    const bw = 18;
    ui.bar(x, 0, bw, pct, { fg: C.o5, bg: C.bg1, id: 'routebar' });
    // el avión sobre la barra
    term.put(x + Math.min(bw - 1, Math.floor(pct * bw)), 0, '✈', C.white);
    x += bw + 1;
    const eta = f.speedKmh > 0 ? ((f.dist - f.done) / f.speedKmh) * 60 : Infinity;
    term.text(x, 0, `${Math.round(f.done)}/${f.dist} km`, C.o6);
    x += `${Math.round(f.done)}/${f.dist} km`.length + 2;
    // controles de velocidad a la derecha
    const bx = W - 34;
    const sp = run.speed;
    if (ui.button('sp_pause', bx, 0, this.paused ? ' ▶ ' : '❚❚ ', { w: 6, selected: this.paused, tip: 'Pausa / continuar (Espacio)' })) this.paused = !this.paused;
    if (ui.button('sp_1', bx + 6, 0, '×1', { w: 6, selected: !this.paused && sp === 1, tip: 'Velocidad normal (1)' })) this.setSpeed(1);
    if (ui.button('sp_2', bx + 12, 0, '×2', { w: 6, selected: !this.paused && sp === 2, tip: 'Velocidad doble (2)' })) this.setSpeed(2);
    if (ui.button('sp_4', bx + 18, 0, '×4', { w: 6, selected: !this.paused && sp === 4, tip: 'Velocidad cuádruple (3)' })) this.setSpeed(4);
    if (ui.button('menu', bx + 25, 0, '≡ Menú', { w: 9, tip: 'Menú (Esc)' })) this.menu = true;
    // fila 2: recursos y sospecha
    resourceBar(app, 1, 1, run);
    const sx = W - 52;
    const swW = suspicionMeter(app, sx, 1, run, 12);
    const h = hull(run);
    const hx = sx + swW + 2;
    term.text(hx, 1, 'CASCO', C.o3);
    ui.bar(hx + 6, 1, 10, h / 100, { fg: h < 40 ? C.red : h < 65 ? C.gold : C.o5, id: 'hullbar', bg: C.bg1 });
    term.text(hx + 17, 1, `${Math.round(h)}%`, h < 40 ? C.red : C.o6);
    ui.region('hullw', hx, 1, 22, 1, { cursor: 'help', sound: false });
    ui.tip('hullw', ['{O}Integridad estructural{/}', 'Media de la estructura de todas las salas. Si baja del 22%, el Topolev se parte en el aire.', '{d}Repara salas dañadas (tareas «Reparar estructura»).{/}']);
  }

  drawPolicy(x, y, w) {
    const { term, ui } = this.app;
    const run = this.run;
    const P = POLICIES[run.policy];
    term.text(x, y, 'Turnos:', C.o3);
    const keys = Object.keys(POLICIES);
    let bx = x + 8;
    for (const k of keys) {
      const lbl = POLICIES[k].name.slice(0, 7);
      if (ui.button('pol_' + k, bx, y, lbl, { w: 8, style: 'tab', selected: run.policy === k, tip: [`{O}Política de turnos: ${POLICIES[k].name}{/}`, POLICIES[k].desc, `{d}Dormir con fatiga ≥${POLICIES[k].sleep}, despertar ≤${POLICIES[k].wake}, comer con hambre ≥${POLICIES[k].eat}.{/}`] })) run.policy = k;
      bx += 8;
    }
  }

  drawSky(x, y, w, h, f) {
    const { term } = this.app;
    const t = this.app.time;
    const speed = (f.speedKmh || 0) / 60;
    const light = daylight(this.run.clock);
    const storm = f.weather > 0.4;
    const skyBg = mix('#000000', storm ? '#0a0b0c' : '#0e0703', light);
    const cloudA = mix(storm ? '#141414' : '#120903', storm ? '#2a2826' : '#3a1d08', light);
    const cloudB = mix(storm ? '#0e0e0e' : '#0c0602', storm ? '#1f1d1b' : '#26130a', light);
    for (let j = 0; j < h; j++) {
      // horizonte más cálido al amanecer/atardecer
      const horizon = j / h;
      const rowBg = light > 0 && light < 1 ? mix(skyBg, '#1c0a03', horizon * (1 - Math.abs(light - 0.5) * 2) * 0.8) : skyBg;
      for (let i = 0; i < w; i++) {
        const n = this.noise.fbm((i + t * speed * 2) * 0.05, (j + 30) * 0.18, 3);
        const n2 = this.noise.get((i + t * speed * 5) * 0.12 + 50, j * 0.3);
        let ch = ' ';
        let fg = C.o0;
        const dens = n - 0.52 + f.weather * 0.15;
        if (dens > 0.12) {
          ch = '▒';
          fg = cloudA;
        } else if (dens > 0.04) {
          ch = '░';
          fg = cloudB;
        } else if (n2 > 0.86 && light < 0.5) {
          ch = n2 > 0.97 ? '+' : '·';
          fg = mix('#3a2410', '#000000', light * 2);
        }
        term.put(x + i, y + j, ch, fg, rowBg);
      }
    }
    // sol o luna en la esquina
    const h24 = (this.run.clock / 60) % 24;
    const icon = light > 0.3 ? '☼' : '☾';
    term.text(x + 1, y + h - 3, `${icon} ${String(Math.floor(h24)).padStart(2, '0')}:${String(Math.floor((this.run.clock % 60))).padStart(2, '0')}  ${Math.round(outsideTemp(this.run))}°C`, light > 0.3 ? C.gold : C.o3);
    // relámpagos
    if (f.weather > 0.5 && Math.random() < 0.004 * f.weather) {
      this.app.fx.flash('#d8e8ff', 0.12, 0.25);
    }
  }

  shipInteractions(run, SX, SY, cardHover) {
    const { ui, term } = this.app;
    const L = layout();
    const f = run.flight;
    this.hoverRoom = null;
    this.hoverCrew = null;
    // salas: región + objetivo de arrastre
    for (const room of L.roomList) {
      const id = 'room_' + room.id;
      const x = SX + room.x0;
      const y = SY + room.top;
      const w = room.x1 - room.x0 + 1;
      const h = room.floor - room.top + 1;
      const st = ui.region(id, x, y, w, h, { sound: false });
      const dt = ui.dropTarget(id, x, y, w, h, (p) => p.kind === 'crew');
      if (st.hot || (dt.over && dt.accepts)) this.hoverRoom = room.id;
      if (dt.over && dt.accepts) {
        for (let xx = x; xx < x + w; xx++) term.setBg(xx, SY + room.floor, mix(C.bg2, C.o3, 0.5 + 0.3 * Math.sin(this.app.time * 10)));
      }
      if (dt.dropped) {
        orderCrew(run, dt.dropped.id, { kind: 'room', room: room.id, x: clamp(Math.round(this.app.input.m.fx - SX), room.x0, room.x1) });
        this.app.particles.ring(this.app.input.m.fx, SY + room.floor + 0.5, 10, C.o5, 5);
      }
      if (st.clicked) {
        this.sel.room = this.sel.room === room.id ? null : room.id;
        this.sel.crew = null;
      }
      ui.tip(id, () => this.roomTooltip(room), { w: 40, delay: 0.5 });
    }
    // compuertas: clic para abrir/cerrar
    for (const lk of L.links) {
      const id = 'door_' + lk.key;
      const st = ui.region(id, SX + lk.x, SY + lk.y, 1, 1, { sound: false });
      const closed = run.ship.doors && run.ship.doors[lk.key];
      if (st.hot) term.setBg(SX + lk.x, SY + lk.y, C.o2);
      if (st.clicked) {
        const c2 = toggleDoor(run, lk.key);
        this.app.audio.play(c2 ? 'drop' : 'pick');
      }
      ui.tip(id, [`{O}${lk.kind === 'door' ? 'Puerta' : 'Escotilla'}: ${closed ? 'CERRADA' : 'abierta'}{/}`, `${L.rooms[lk.a].name} ↔ ${L.rooms[lk.b].name}`, '{d}Cerrada frena el fuego, el humo, la radiación y la pérdida de aire entre salas. La tripulación puede pasar igualmente.{/}', '{x}Clic para abrir/cerrar{/}'], { w: 40 });
    }
    // estaciones: objetivo de arrastre preciso
    for (const s of L.stationList) {
      const id = 'stn_' + s.id;
      const tk = f.tasks.find((t) => t.station === s.id);
      const dt = ui.dropTarget(id, SX + s.x - 1, SY + s.y - 1, 3, 2, (p) => p.kind === 'crew' && !!tk);
      if (dt.over && dt.accepts) {
        term.setBg(SX + s.x, SY + s.y, C.o4);
        term.setBg(SX + s.x, SY + s.y - 1, C.o2);
      }
      if (dt.dropped && tk) {
        orderCrew(run, dt.dropped.id, { kind: 'task', taskId: tk.id });
        this.app.particles.ring(SX + s.x + 0.5, SY + s.y + 0.5, 10, C.gold, 5);
      }
    }
    // tripulantes
    for (const c of alive(run)) {
      if (c.x == null) continue;
      const cx = SX + Math.round(c.x);
      const cy = SY + Math.round(c.y);
      const id = 'crewent_' + c.id;
      const st = ui.draggable(id, cx, cy, 1, 1, { kind: 'crew', id: c.id }, { label: `${c.sur[0]} ${c.sur}`, fg: C.o7 });
      if (st.hot) this.hoverCrew = c.id;
      if (st.clicked) {
        this.sel.crew = this.sel.crew === c.id ? null : c.id;
        this.sel.room = null;
      }
      if (st.rclicked && c.order) {
        c.order = null;
        f.assignAcc = 99;
      }
      if (st.dbl) this.sel.dossier = c.id;
      ui.tip(id, () => crewTooltip(run, c), { w: 46 });
    }
  }

  roomTooltip(room) {
    const run = this.run;
    const rs = run.ship.rooms[room.id];
    const L = [`{O}${room.name}{/}`];
    L.push(`Temp. {${rs.temp < 0 ? 'i' : 'l'}}${Math.round(rs.temp)}°C{/}  O₂ {${rs.o2 < 50 ? 'r' : 'l'}}${Math.round(rs.o2)}%{/}  Estructura {${rs.int < 50 ? 'r' : 'l'}}${Math.round(rs.int)}%{/}`);
    if (rs.fire > 0) L.push(`{r}Incendio: ${Math.round(rs.fire)}%{/}`);
    if (rs.breach > 0) L.push(`{i}Brecha en el casco (nivel ${rs.breach}){/}`);
    if (rs.rad > 1) L.push(`{g}Radiación: ${Math.round(rs.rad)}{/}`);
    if (rs.ice > 0) L.push(`{i}Hielo: ${Math.round(rs.ice)}%{/}`);
    if (rs.dark) L.push('{x}Sin luz (cortocircuito){/}');
    const slots = layout().slots.filter((s) => s.room === room.id);
    for (const s of slots) {
      const m = run.ship.slots[s.id];
      L.push(m ? `${s.name}: {l}${m.name}{/} {${m.int < m.maxInt * 0.5 ? 'r' : 'd'}}${Math.round((m.int / m.maxInt) * 100)}%{/}` : `${s.name}: {x}vacío{/}`);
    }
    const crew = alive(run).filter((c) => crewRoom(c) === room.id);
    if (crew.length) L.push(`{d}Aquí: ${crew.map((c) => c.sur).join(', ')}{/}`);
    L.push('{x}Clic: seleccionar · Suelta un tripulante aquí para enviarlo{/}');
    return L;
  }

  drawShipOverlay(x, y, w, f) {
    const { term } = this.app;
    const run = this.run;
    const t = this.app.time;
    if (this.paused && !this.popup && !this.menu) {
      const s = '❚❚ PAUSA — Espacio para continuar';
      if (Math.floor(t * 1.5) % 2 === 0 || true) term.text(x + Math.floor((w - s.length) / 2), y + SHIP_H + 1, s, mix(C.o3, C.o6, 0.5 + 0.5 * Math.sin(t * 3)), '#000000');
    }
    if (f.arrived) {
      const s = run.over ? '█ CONTACTO PERDIDO █' : f.forced ? '▼ ATERRIZAJE FORZOSO ▼' : '▼ APROXIMACIÓN Y ATERRIZAJE ▼';
      term.text(x + Math.floor((w - s.length) / 2), y + 1, s, run.over || f.forced ? C.red : C.gold, '#000000', 1);
    } else if (run.over) {
      const s = '█ CONTACTO PERDIDO █';
      term.text(x + Math.floor((w - s.length) / 2), y + 1, s, C.red, '#000000', 1);
    }
    // indicadores de estado globales en la esquina
    let iy = y;
    const tags = [];
    if (f.combat) tags.push(['COMBATE', C.red]);
    if (f.incoming) tags.push([`CONTACTOS EN ${Math.max(0, Math.ceil(f.incoming.at - f.t))} min`, C.red]);
    if (f.pvo) tags.push([f.pvo.active ? 'FUEGO ANTIAÉREO' : `PVO: IFF EN ${Math.max(0, Math.ceil(f.pvo.deadline - f.t))} min`, C.red]);
    if (f.weather > 0.15) tags.push([`TORMENTA ${Math.round(f.weather * 100)}%`, C.ice]);
    if (f.anomaly > 0) tags.push(['ANOMALÍA', C.violet]);
    if (f.evasive > 0) tags.push(['EVASIÓN', C.gold]);
    if (f.flareT > 0) tags.push(['SEÑUELOS', C.gold]);
    if (run.ship.scram > 0) tags.push(['SCRAM', C.rad]);
    if (f.outOfFuel) tags.push(['SIN COMBUSTIBLE', C.red]);
    for (const [s, c] of tags) {
      const blink = c === C.red && Math.floor(t * 3) % 2;
      term.text(x + w - s.length - 2, iy, ` ${s} `, blink ? '#000000' : c, blink ? c : '#000000', 1);
      iy++;
    }
  }

  drawToasts(x, y, w, f) {
    const { term, ui } = this.app;
    const now = f.t;
    const list = f.alerts.slice(-4);
    let yy = y;
    for (const a of list) {
      const age = now - a.t;
      if (age > 12) continue;
      const fade = clamp(1 - (age - 9) / 3, 0, 1);
      const col = mix('#000000', ALERTCOL[a.level] || C.o6, fade);
      const text = ` ${a.text} `.slice(0, w - 24);
      term.text(x + 2, yy, text, col, mix('#000000', C.bg2, fade));
      yy++;
    }
  }

  // --- Panel de energía -------------------------------------------------------
  drawPower(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const f = run.flight;
    ui.panel(x, y, w, h, { title: 'ENERGÍA' });
    const cap = f.powerCap ?? 0;
    const used = powerUsed(run);
    term.text(x + 2, y + 1, 'Reactor', C.o3);
    ui.bar(x + 10, y + 1, 8, cap ? used / Math.max(cap, 1) : 0, { fg: C.o5, id: 'pw_used' });
    term.text(x + 19, y + 1, `${used}/${cap}`, C.o6);
    const heat = run.ship.heat;
    term.text(x + 2, y + 2, 'Calor', C.o3);
    const hc = heat > 85 ? C.red : heat > 65 ? C.gold : C.rad2;
    ui.bar(x + 10, y + 2, 8, heat / 120, { fg: hc, id: 'pw_heat', marks: [65 / 120, 90 / 120] });
    term.text(x + 19, y + 2, `${Math.round((heat / 120) * 100)}%`, hc);
    if (f.onBattery) term.text(x + 2, y + 3, 'BATERÍAS', Math.floor(app.time * 2) % 2 ? C.red : C.gold);
    ui.region('pw_heat_tip', x + 2, y + 2, 24, 1, { cursor: 'help', sound: false });
    ui.tip('pw_heat_tip', ['{O}Temperatura del núcleo{/}', 'Sube con la carga del reactor. Por encima de la marca amarilla escapa radiación; por encima de la roja el núcleo se daña.', '{d}Un operador en la consola del reactor refrigera mejor. SCRAM lo apaga de golpe.{/}']);
    if (ui.button('scram', x + w - 9, y + 1, 'SCRAM', { w: 8, danger: true, disabled: run.ship.scram > 0, tip: ['{r}SCRAM{/}: parada de emergencia del reactor.', 'Enfría el núcleo rápidamente pero corta TODA la energía (salvo baterías) durante 6 minutos.'] })) scram(run);
    if (ui.button('overload', x + w - 9, y + 2, run.ship.overload ? '{r}SOBR!{/}' : 'Sobr.', { w: 8, selected: !!run.ship.overload, danger: !!run.ship.overload, tip: ['{O}Sobrecarga del reactor{/}', '+3 unidades de energía, pero el núcleo se calienta más del doble de rápido.', '{d}Útil en combate o con frío extremo. Vigila el calor.{/}'] })) toggleOverload(run);
    ui.hline(x + 1, y + 3, w - 2);
    let yy = y + 4;
    const want = run.ship.want || run.ship.power;
    const wantSum = SYSTEMS.reduce((a, s2) => a + (want[s2.id] || 0), 0);
    for (const sys of SYSTEMS) {
      if (yy >= y + h - 1) break;
      const v = run.ship.power[sys.id] || 0;
      const wv = want[sys.id] || 0;
      const id = 'sys_' + sys.id;
      const st = ui.region(id, x + 1, yy, 16, 1, { cursor: 'help', sound: false });
      term.text(x + 2, yy, pad(sys.name, 14), st.hot ? C.o7 : v ? C.o5 : wv ? C.red2 : C.o3);
      ui.tip(id, [`{O}${sys.name}{/}`, sys.desc, wv > v ? '{r}Sin energía suficiente: se restablecerá cuando el reactor pueda.{/}' : '', '{d}Clic en los bloques para asignar energía. Clic derecho: quitar.{/}']);
      for (let i = 0; i < sys.max; i++) {
        const pid = `pip_${sys.id}_${i}`;
        const px = x + 17 + i * 2;
        const ps = ui.region(pid, px, yy, 2, 1, { sound: false });
        const on = i < v;
        const wanted = i < wv;
        const hv = ui.hoverT(pid);
        const avail = wantSum - wv + (i + 1) <= cap;
        const g = on ? '■' : wanted ? '▣' : '□';
        const col = on ? mix(C.o5, C.o7, hv) : wanted ? C.red : avail ? mix(C.o2, C.o4, hv) : C.greyD;
        term.put(px, yy, g, col, hv > 0.3 ? C.bg3 : null);
        if (ps.clicked) {
          setPower(run, sys.id, wanted && wv === i + 1 ? i : i + 1);
          app.audio.play('click');
        }
        if (ps.rclicked) setPower(run, sys.id, Math.max(0, wv - 1));
      }
      if (st.rclicked) setPower(run, sys.id, Math.max(0, wv - 1));
      // indicador de necesidad
      const warn = this.sysWarning(sys.id);
      if (warn) term.text(x + 24, yy, warn[0], warn[1]);
      yy++;
    }
  }

  sysWarning(id) {
    const run = this.run;
    const f = run.flight;
    const P = run.ship.power;
    if (id === 'armas' && (f.combat || f.incoming) && (P.armas || 0) === 0) return ['!', C.red];
    if (id === 'radio' && f.radioQueue.length && (P.radio || 0) === 0) return ['!', C.red];
    if (id === 'vital' && Object.values(run.ship.rooms).some((r) => r.o2 < 60) && (P.vital || 0) < 2) return ['!', C.gold];
    if (id === 'calef' && Object.values(run.ship.rooms).some((r) => r.temp < 2)) return ['❄', C.ice];
    return null;
  }

  // --- Panel de motores y acciones ------------------------------------------
  drawEngines(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const f = run.flight;
    ui.panel(x, y, w, h, { title: 'VUELO' });
    term.text(x + 2, y + 1, 'Régimen', C.o3);
    for (let i = 0; i < 3; i++) {
      const T = THROTTLE[i];
      if (ui.button('thr_' + i, x + 2 + i * 9, y + 2, T.name.slice(0, 7), { w: 9, style: 'tab', selected: run.ship.throttle === i, tip: [`{O}${T.name}{/}`, `Velocidad ×${T.speed} · Consumo ×${T.fuel} · Desgaste ×${T.wear}`] })) run.ship.throttle = i;
    }
    term.text(x + 2, y + 3, `${padL(Math.round(f.speedKmh), 4)} km/h`, C.o6);
    term.text(x + 14, y + 3, `${f.fuelRate.toFixed(2)} t/h`, run.res.fuel < 5 ? C.red : C.o4);
    const L = layout();
    let yy = y + 4;
    for (const sid of ['motor1_m', 'motor2_m']) {
      const m = run.ship.slots[sid];
      const room = L.slots.find((s) => s.id === sid).room;
      const rs = run.ship.rooms[room];
      const lbl = room === 'motor1' ? 'Mot.1' : 'Mot.2';
      term.text(x + 2, yy, lbl, C.o3);
      if (m) {
        const k = m.int / m.maxInt;
        ui.bar(x + 8, yy, 8, k, { fg: k < 0.4 ? C.red : k < 0.7 ? C.gold : C.o5, id: 'eng' + sid });
        term.text(x + 17, yy, `${Math.round(k * 100)}%`, C.o4);
        if (rs.ice > 5) term.text(x + 22, yy, `❄${Math.round(rs.ice)}`, C.ice);
        ui.region('engtip' + sid, x + 2, yy, w - 4, 1, { cursor: 'help', sound: false });
        ui.tip('engtip' + sid, modLines(m));
      } else term.text(x + 8, yy, '— vacío —', C.grey2);
      yy++;
    }
    ui.hline(x + 1, yy, w - 2);
    yy++;
    const pilot = f.ctx?.pilot;
    term.text(x + 2, yy, 'Piloto:', C.o3);
    term.text(x + 10, yy, pilot ? pilot.sur.slice(0, w - 12) : 'AUTOMÁTICO', pilot ? C.o6 : C.gold);
    yy++;
    const nav = f.ctx?.atStation?.navegante;
    term.text(x + 2, yy, 'Naveg.:', C.o3);
    term.text(x + 10, yy, nav ? nav.sur.slice(0, w - 12) : 'SIN NAVEGANTE (+ruta)', nav ? C.o6 : C.gold);
    yy++;
    const evLbl = f.evasive > 0 ? 'EVADIENDO' : f.evasiveCd > 0 ? `Evasiva (${Math.ceil(f.evasiveCd)})` : 'Maniobra evasiva';
    if (yy < y + h - 1 && ui.button('evasive', x + 2, yy, evLbl, { w: w - 4, key: 'e', disabled: !pilot || f.evasiveCd > 0, tip: ['{O}Maniobra evasiva{/} (E)', 'Evasión +30% durante 2,5 min. Gasta 0,3 t de combustible.', '{r}Quien no esté sentado o tumbado puede herirse.{/}', pilot ? '' : '{r}Requiere piloto en la cabina.{/}'] })) evasiveManeuver(run);
    yy++;
    if (yy < y + h - 1 && ui.button('flares', x + 2, yy, `Señuelos (${run.res.flares || 0})`, { w: w - 4, disabled: (run.res.flares || 0) < 1 || f.flareT > 0, tip: ['{O}Señuelos{/}', 'Los atacantes tienen −50% de probabilidad de acertar durante 2,5 min.'] })) launchFlares(run);
  }

  // --- Radar ---------------------------------------------------------------
  drawRadar(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const f = run.flight;
    const pw = run.ship.power.radar || 0;
    ui.panel(x, y, w, h, { title: f.combat ? '{r}RADAR · COMBATE{/}' : 'RADAR' });
    const cx = x + Math.floor(w / 2);
    const cy = y + Math.floor(h / 2);
    const rx = Math.floor((w - 4) / 2);
    const ry = Math.floor((h - 3) / 2);
    this.radarAng += app.ui.dt * (pw > 0 ? 2.2 : 0.4);
    const t = app.time;
    if (pw <= 0) {
      term.text(cx - 6, cy, 'SIN ENERGÍA', C.grey2);
    }
    // anillos
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      for (const k of [1, 0.5]) {
        const px = Math.round(cx + Math.cos(a) * rx * k);
        const py = Math.round(cy + Math.sin(a) * ry * k);
        term.put(px, py, '·', C.o1);
      }
    }
    term.put(cx, cy, '✈', C.o6);
    // barrido
    if (pw > 0) {
      for (let i = 1; i <= rx; i++) {
        for (let tr = 0; tr < 3; tr++) {
          const a = this.radarAng - tr * 0.12;
          const px = Math.round(cx + Math.cos(a) * i);
          const py = Math.round(cy + Math.sin(a) * i * (ry / rx));
          term.put(px, py, tr === 0 ? '∙' : '·', tr === 0 ? C.rad2 : C.radD);
        }
      }
    }
    // contactos
    const enemies = f.enemies || [];
    for (const e of enemies) {
      const E = ENEMIES[e.type];
      const k = clamp(e.dist / 100, 0.15, 1);
      const px = Math.round(cx + Math.cos(e.ang) * rx * k);
      const py = Math.round(cy + Math.sin(e.ang) * ry * k);
      const id = 'enemy_' + e.id;
      const st = ui.region(id, px - 1, py, 3, 1);
      const flash = (this.enemyFlash[e.id] || 0) > 0;
      if (flash) this.enemyFlash[e.id] -= app.ui.dt * 2;
      const tgt = f.target === e.id;
      const col = flash ? C.white : e.fleeing ? C.grey : tgt ? C.gold : C.red;
      term.put(px, py, E.glyph, col, st.hot ? C.bg3 : null);
      if (tgt) {
        term.put(px - 1, py, '[', C.gold);
        term.put(px + 1, py, ']', C.gold);
      }
      if (st.clicked) {
        f.target = f.target === e.id ? null : e.id;
        app.audio.play('click');
      }
      ui.tip(id, [`{r}${E.name}{/}`, E.desc, `Integridad: ${Math.max(0, Math.round(e.hp))}/${e.maxHp}`, `Distancia: ${Math.round(e.dist)} · Sector: ${e.sector}`, e.fleeing ? '{x}Huyendo{/}' : '', '{d}Clic: marcar como objetivo prioritario{/}']);
    }
    // estado
    if (f.incoming) {
      const s = `▲ ${f.incoming.group.length} contactos en ${Math.ceil(f.incoming.at - f.t)} min`;
      term.text(x + 2, y + h - 2, s.slice(0, w - 4), Math.floor(t * 3) % 2 ? C.red : C.gold);
    } else if (!enemies.length) {
      term.text(x + 2, y + h - 2, f.weather > 0.15 ? `Frente tormentoso ${Math.round(f.weather * 100)}%` : 'Sin contactos', f.weather > 0.15 ? C.ice2 : C.o2);
    } else {
      // estado de torretas
      let tx = x + 2;
      for (const sid of Object.keys(COVERAGE)) {
        const m = run.ship.slots[sid];
        if (!m) continue;
        const st = TURRET_STATION[sid];
        const manned = !!f.ctx?.atStation?.[st];
        const pw2 = weaponPowered(run, sid);
        const ok = manned && pw2 && m.int > 0;
        const lbl = st[0].toUpperCase();
        term.text(tx, y + h - 2, `${lbl}${ok ? '●' : '○'}`, ok ? C.o5 : C.red);
        tx += 3;
      }
      term.text(tx + 1, y + h - 2, `Mun ${Math.floor(run.res.ammo)}`, run.res.ammo < 20 ? C.red : C.o4);
    }
  }

  // --- Registro ------------------------------------------------------------------
  drawLog(x, y, w, h) {
    const { term, ui } = this.app;
    const run = this.run;
    ui.panel(x, y, w, h, { title: 'DIARIO DE A BORDO' });
    const lines = [];
    for (let i = run.log.length - 1; i >= 0 && lines.length < h - 2; i--) {
      const e = run.log[i];
      const wr = wrap(e.text, w - 10);
      for (let j = wr.length - 1; j >= 0 && lines.length < h - 2; j--) lines.push([j === 0 ? fmtClock(e.t, false) : '', wr[j], e.kind]);
    }
    let yy = y + 1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const [tm, txt, kind] = lines[i];
      term.text(x + 2, yy, tm, C.o1);
      term.text(x + 8, yy, txt, LOGCOL[kind] || C.o3);
      yy++;
    }
  }

  // --- Tareas --------------------------------------------------------------------
  drawTasks(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const f = run.flight;
    ui.panel(x, y, w, h, { title: 'TAREAS', footer: '{x}arrastra aquí{/}' });
    const order = { fire: 0, breach: 1, heal: 3, repair: 4, hull: 6, ice: 2, leak: 2, calm: 3, rat: 7, station: 9 };
    const list = [...f.tasks].sort((a, b) => (b.prio - a.prio) || (order[a.type] - order[b.type]) || a.label.localeCompare(b.label));
    const contentH = list.length;
    const off = ui.beginScroll('tasks', x + 1, y + 1, w - 3, h - 2, contentH);
    this.hoverTask = null;
    let yy = y + 1 - off;
    for (const t of list) {
      if (yy >= y + 1 && yy < y + h - 1) {
        const id = 'task_' + t.id;
        const st = ui.region(id, x + 1, yy, w - 3, 1, { sound: false });
        const dt = ui.dropTarget(id, x + 1, yy, w - 3, 1, (p) => p.kind === 'crew');
        const hv = ui.hoverT(id);
        if (st.hot || dt.over) this.hoverTask = t.id;
        const workers = (t.workers || []).map((wid) => run.crew.find((c) => c.id === wid)).filter(Boolean);
        const empty = !workers.length;
        const crit = t.type === 'fire' || t.type === 'breach' || t.data.urgent;
        let bg = dt.over && dt.accepts ? C.bg4 : hv > 0.1 ? C.bg3 : null;
        if (bg) term.fillBg(x + 1, yy, w - 3, 1, bg);
        const icon = { fire: ['▲', C.red], breach: ['◌', C.ice], heal: ['+', C.red], repair: ['¤', C.gold], hull: ['╳', C.gold], ice: ['❄', C.ice], leak: ['◘', C.gold], calm: ['☺', C.violet], rat: ['r', C.o4], station: ['■', C.o3] }[t.type] || ['·', C.o3];
        term.put(x + 2, yy, icon[0], icon[1]);
        if (t.prio) term.put(x + 3, yy, '!', C.gold);
        const lblW = w - 16;
        let label = t.label;
        if (t.type === 'station') {
          const c = workers[0];
          label = `${t.label}: ${c ? c.sur : '—'}`;
        }
        const lc = t.type === 'station' ? (empty ? (t.station === 'piloto' || t.data.urgent ? C.red : C.o2) : C.o4) : crit && empty ? (Math.floor(app.time * 3) % 2 ? C.red : C.o6) : C.o6;
        term.text(x + 4, yy, pad(label, lblW), lc);
        // trabajadores
        let wx = x + 4 + lblW + 1;
        for (let i = 0; i < Math.min(t.slots, 3); i++) {
          const c = workers[i];
          term.put(wx + i, yy, c ? crewGlyph(c) : '·', c ? (c.atWork ? C.o5 : C.o3) : C.o1);
        }
        // progreso
        const prog = this.taskProgress(t);
        if (prog != null) ui.bar(x + w - 8, yy, 5, prog, { fg: C.o4, bg: C.bg2 });
        if (st.clicked && t.type !== 'station') {
          t.prio = t.prio ? 0 : 1;
          f.assignAcc = 99;
        }
        if (dt.dropped) {
          orderCrew(run, dt.dropped.id, { kind: 'task', taskId: t.id });
        }
        ui.tip(id, () => this.taskTooltip(t, workers), { w: 40, delay: 0.4 });
      }
      yy++;
    }
    ui.endScroll();
    if (!list.length) term.text(x + 2, y + 2, 'Sin tareas.', C.o2);
  }

  taskProgress(t) {
    const run = this.run;
    switch (t.type) {
      case 'fire': return 1 - run.ship.rooms[t.room].fire / 100;
      case 'breach': return t.progress / 12;
      case 'repair': {
        const m = run.ship.slots[t.data.slot];
        return m ? m.int / m.maxInt : null;
      }
      case 'hull': return run.ship.rooms[t.room].int / 100;
      case 'ice': return 1 - run.ship.rooms[t.room].ice / 100;
      case 'heal': {
        const c = run.crew.find((x) => x.id === t.data.crew);
        return c ? c.hp / 100 : null;
      }
      case 'leak':
      case 'rat':
      case 'calm':
        return t.progress / t.need;
      case 'station':
        if (t.station === 'cocina') return t.progress / 18;
        if (t.station === 'radio' && run.flight.radioQueue.length) {
          const q = run.flight.radioQueue[0];
          return q.progress / q.need;
        }
        if (t.station === 'taller' && run.orders[0]) return (run.orders[0].progress || 0) / run.orders[0].need;
        return null;
      default: return null;
    }
  }

  taskTooltip(t, workers) {
    const L = [`{O}${t.label}{/}`, `{d}Categoría: ${CAT[t.cat]?.name || t.cat} · Plazas: ${t.slots}{/}`];
    if (workers.length) L.push(`Asignados: ${workers.map((c) => c.sur + (c.atWork ? '' : ' (en camino)')).join(', ')}`);
    else L.push('{r}Nadie asignado{/}');
    if (t.type === 'station' && t.station === 'radio' && this.run.flight.radioQueue.length) {
      const q = this.run.flight.radioQueue[0];
      L.push(q.kind === 'iff' ? '{r}Transmitiendo código IFF{/}' : 'Descifrando mensaje de Moscú');
    }
    if (t.type !== 'station') L.push('{x}Clic: marcar como urgente (!){/}');
    L.push('{x}Suelta un tripulante aquí para ordenarle esta tarea{/}');
    return L;
  }

  // --- Panel de selección ---------------------------------------------------------
  drawSelection(x, y, w, h) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const f = run.flight;
    const c = this.sel.crew ? run.crew.find((x) => x.id === this.sel.crew) : null;
    const roomId = this.sel.room;
    if (c && !c.dead) return this.drawCrewSel(x, y, w, h, c);
    if (roomId) return this.drawRoomSel(x, y, w, h, roomId);
    ui.panel(x, y, w, h, { title: 'INFORMACIÓN' });
    let yy = y + 1;
    const lines = [
      '{O}Ayuda rápida{/}',
      '· {l}Arrastra{/} un tripulante a una sala, estación o tarea.',
      '· {l}Clic{/} en una sala o tripulante para ver detalles.',
      '· {l}Clic derecho{/} en un tripulante: cancelar su orden.',
      '· {l}Energía{/}: clic en los bloques para repartirla.',
      '· {l}Espacio{/}: pausa. {l}1 2 3{/}: velocidad.',
      '· {l}Clic en una tarea{/}: urgente.',
      '',
      `{d}Tramo: ${run.map.nodes[f.from].name}{/}`,
      `{d}→ ${f.toName}{/}`,
      `{d}Peligro ${Math.round(f.danger * 100)}% · Meteo ${Math.round(f.weather * 100)}%{/}`,
    ];
    for (const l of lines) {
      if (yy >= y + h - 1) break;
      ui.mtext(x + 2, yy++, l, C.o4, null, w - 4);
    }
    yy++;
    if (yy < y + h - 3) {
      const tip = TIPS[Math.floor(app.time / 12) % TIPS.length];
      ui.mtext(x + 2, yy++, '{y}Consejo del instructor{/}', C.o4, null, w - 4);
      ui.mwrap(x + 2, yy, w - 4, `{d}${tip}{/}`, C.o4, { maxLines: y + h - 1 - yy });
    }
  }

  drawCrewSel(x, y, w, h, c) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    ui.panel(x, y, w, h, { title: displayName(c).toUpperCase().slice(0, w - 6) });
    let yy = y + 1;
    ui.mtext(x + 2, yy++, `{d}${roleName(c)} · ${c.age} años · ${c.origin}{/}`, C.o4, null, w - 4);
    const room = crewRoom(c);
    ui.mtext(x + 2, yy++, `En: {l}${room ? layout().rooms[room].name : '—'}{/}`, C.o4, null, w - 4);
    if (c.order) {
      const o = c.order;
      const what = o.kind === 'room' ? layout().rooms[o.room].name : run.flight.tasks.find((t) => t.id === o.taskId)?.label || '—';
      ui.mtext(x + 2, yy++, `{y}Orden directa:{/} ${what}`, C.o4, null, w - 4);
      if (ui.button('cancel_order', x + 2, yy++, 'Cancelar orden', { w: 18 })) {
        c.order = null;
        run.flight.assignAcc = 99;
      }
    }
    yy++;
    // prioridades rápidas
    term.text(x + 2, yy++, 'Prioridades (clic para cambiar):', C.o3);
    const cats = Object.keys(c.pri);
    const colW = Math.floor((w - 4) / 3);
    for (let i = 0; i < cats.length; i++) {
      const cat = cats[i];
      const px = x + 2 + (i % 3) * colW;
      const py = yy + Math.floor(i / 3);
      if (py >= y + h - 3) break;
      const v = c.pri[cat];
      const lbl = `${CAT[cat].short} ${v ? v : '–'}`;
      const col = v === 1 ? C.o6 : v === 2 ? C.o4 : v === 3 ? C.o2 : C.grey2;
      if (ui.button(`qp_${cat}`, px, py, lbl, { w: colW - 1, style: 'plain', fg: col, tip: [`{O}${CAT[cat].name}{/}: ${CAT[cat].desc}`, `Habilidad ${CAT[cat].skill}: ${c.skills[CAT[cat].skill] || 0}`, '{d}1 = alta · 2 = media · 3 = baja · – = nunca{/}'] })) {
        c.pri[cat] = (v + 1) % 4 === 0 ? 0 : v === 0 ? 1 : v + 1;
        if (c.pri[cat] > 3) c.pri[cat] = 0;
        run.flight.assignAcc = 99;
      }
    }
    yy += Math.ceil(cats.length / 3) + 1;
    if (yy < y + h - 1 && ui.button('dossier', x + 2, yy, 'Ver expediente', { w: 18 })) this.sel.dossier = c.id;
  }

  drawRoomSel(x, y, w, h, roomId) {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const L = layout();
    const room = L.rooms[roomId];
    const rs = run.ship.rooms[roomId];
    ui.panel(x, y, w, h, { title: room.name.toUpperCase() });
    let yy = y + 1;
    const stat = (label, v, col) => {
      term.text(x + 2, yy, label, C.o3);
      term.text(x + 14, yy, v, col);
      yy++;
    };
    stat('Temperatura', `${Math.round(rs.temp)}°C`, rs.temp < 0 ? C.ice : C.o6);
    stat('Oxígeno', `${Math.round(rs.o2)}%`, rs.o2 < 50 ? C.red : C.o6);
    stat('Estructura', `${Math.round(rs.int)}%`, rs.int < 50 ? C.red : C.o6);
    if (rs.fire > 0) stat('Fuego', `${Math.round(rs.fire)}%`, C.red);
    if (rs.rad > 1) stat('Radiación', `${Math.round(rs.rad)}`, C.rad);
    const slots = L.slots.filter((s) => s.room === roomId);
    for (const s of slots) {
      const m = run.ship.slots[s.id];
      if (yy >= y + h - 2) break;
      const id = 'selmod_' + s.id;
      ui.region(id, x + 2, yy, w - 4, 1, { cursor: 'help', sound: false });
      ui.mtext(x + 2, yy++, m ? `${s.name}: {l}${m.name}{/}` : `${s.name}: {x}vacío{/}`, C.o3, null, w - 4);
      if (m) ui.tip(id, modLines(m));
    }
    if (yy < y + h - 2) {
      if (ui.button('vent_' + roomId, x + 2, yy, rs.vent > 0 ? `Despresurizando… ${Math.ceil(rs.vent)}` : 'Despresurizar sala', { w: w - 4, danger: true, disabled: rs.vent > 0, tip: ['{r}Despresurizar{/}: abre la sala al exterior durante 4 minutos.', 'Ahoga cualquier incendio, pero el aire y el calor escapan. Quien se quede dentro se asfixia.'] })) ventRoom(run, roomId);
      yy++;
    }
    yy++;
    // acciones específicas
    if (roomId === 'comisaria') {
      term.text(x + 2, yy++, 'Trabajo político:', C.o3);
      for (const k of Object.keys(POL_FOCUS)) {
        if (yy >= y + h - 1) break;
        if (ui.button('polf_' + k, x + 2, yy++, POL_FOCUS[k].name, { w: w - 4, selected: (run.polFocus || 'informe') === k, style: 'tab', align: 'left', tip: POL_FOCUS[k].desc })) run.polFocus = k;
      }
      if ((run.polFocus || 'informe') === 'vigilancia' && yy < y + h - 1) {
        term.text(x + 2, yy++, 'Investigar a:', C.o3);
        for (const c of alive(run)) {
          if (yy >= y + h - 1) break;
          if (c.role === 'comisario') continue;
          const prog = Math.round(((run.invest || {})[c.id] || 0) / 55 * 100);
          const lbl = `${c.sur}${c.flags?.clean ? ' (limpio)' : ''} ${prog ? prog + '%' : ''}`;
          if (ui.button('inv_' + c.id, x + 2, yy++, lbl, { w: w - 4, style: 'plain', align: 'left', selected: run.polTarget === c.id })) run.polTarget = c.id;
        }
      }
    } else if (roomId === 'taller') {
      term.text(x + 2, yy++, 'Órdenes de fabricación:', C.o3);
      for (const o of run.orders) {
        if (yy >= y + h - 1) break;
        const R = RECIPES[o.recipe];
        const tgt = o.target ? run.inventory.find((m) => m.id === o.target) : null;
        ui.mtext(x + 2, yy, `{l}${R.name}{/}${tgt ? ' · ' + tgt.name.slice(0, 12) : ''}`, C.o4, null, w - 14);
        ui.bar(x + w - 11, yy, 5, (o.progress || 0) / o.need, { fg: C.o4 });
        if (ui.button('co_' + o.id, x + w - 5, yy, '×', { w: 3, style: 'plain', danger: true, tip: 'Cancelar (se recuperan los materiales)' })) cancelOrder(run, o.id);
        yy++;
      }
      if (!(run.ship.power.taller > 0)) ui.mtext(x + 2, yy++, '{r}El taller no tiene energía.{/}', C.o4);
      yy++;
      for (const k of ['municion', 'senuelos', 'botiquin', 'destilar']) {
        if (yy >= y + h - 1) break;
        const R = RECIPES[k];
        if (ui.button('add_' + k, x + 2, yy++, `+ ${R.name}`, { w: w - 4, align: 'left', tip: R.desc })) {
          if (!addOrder(run, k)) app.audio.play('deny');
        }
      }
    } else if (roomId === 'comedor') {
      ui.mtext(x + 2, yy++, `Comidas: {l}${run.res.meals}{/} · Raciones: {l}${run.res.rations}{/}`, C.o4, null, w - 4);
      ui.mtext(x + 2, yy++, `{d}La cocina necesita energía y alguien con prioridad en Cocina.{/}`, C.o4, null, w - 4);
    } else if (roomId === 'reactor') {
      ui.mtext(x + 2, yy++, `Calor del núcleo: {l}${Math.round((run.ship.heat / 120) * 100)}%{/}`, C.o4, null, w - 4);
    }
  }

  // --- Ventanas emergentes -----------------------------------------------------
  drawPopup() {
    const app = this.app;
    const { term, ui } = app;
    const run = this.run;
    const p = this.popup;
    const W = term.cols;
    const H = term.rows;
    const pw = Math.min(76, W - 10);
    const lines = ui.measureWrap(p.def.text, pw - 6);
    const ph = Math.min(H - 6, 8 + lines + p.def.options.length * 2 + (p.result ? 3 : 0));
    const px = Math.floor((W - pw) / 2);
    const py = Math.floor((H - ph) / 2);
    ui.beginModal(0.7);
    ui.panel(px, py, pw, ph, { title: p.def.title, style: 'double', fg: C.o4, bg: '#0a0502', shadow: true });
    let yy = py + 2;
    ui.mwrap(px + 3, yy, pw - 6, p.def.text, C.o6);
    yy += lines + 1;
    if (!p.result) {
      p.def.options.forEach((o, i) => {
        const ok = !o.req || o.req(run);
        if (ui.button('pop_' + i, px + 3, yy, `${i + 1}. ${o.label}`, { w: pw - 6, align: 'left', disabled: !ok, key: String(i + 1), tip: o.desc })) {
          p.result = o.fx(run) || 'Hecho.';
        }
        if (o.desc) ui.mtext(px + 7, yy + 1, `{x}${o.desc}{/}`, C.o3, null, pw - 10);
        yy += 2;
      });
    } else {
      ui.mwrap(px + 3, yy, pw - 6, `{l}${p.result}{/}`, C.o6);
      if (ui.button('pop_ok', px + pw - 16, py + ph - 2, 'Continuar', { w: 13, key: 'Enter' })) {
        run.flight.popups.shift();
        this.popup = null;
        this.paused = false;
      }
    }
    ui.endModal();
  }

  drawMenu() {
    const app = this.app;
    const { term, ui } = app;
    const W = term.cols;
    const H = term.rows;
    const pw = 34;
    const ph = 13;
    const px = Math.floor((W - pw) / 2);
    const py = Math.floor((H - ph) / 2);
    ui.beginModal(0.7);
    ui.panel(px, py, pw, ph, { title: 'MENÚ', style: 'double', shadow: true });
    let yy = py + 2;
    if (ui.button('m_cont', px + 3, yy, 'Continuar', { w: pw - 6, key: 'Escape' })) this.menu = false;
    yy += 2;
    if (ui.button('m_save', px + 3, yy, 'Guardar expediente', { w: pw - 6 })) {
      saveGame(app);
      app.audio.play('success');
      this.menu = false;
    }
    yy += 2;
    if (ui.button('m_help', px + 3, yy, 'Instrucciones', { w: pw - 6 })) {
      saveGame(app);
      app.go('help', { back: 'flight' });
    }
    yy += 2;
    if (ui.button('m_set', px + 3, yy, 'Ajustes', { w: pw - 6 })) {
      saveGame(app);
      app.go('settings', { back: 'flight' });
    }
    yy += 2;
    if (ui.button('m_quit', px + 3, yy, 'Guardar y salir al título', { w: pw - 6, danger: true })) {
      saveGame(app);
      app.go('title');
    }
    ui.endModal();
  }
}
