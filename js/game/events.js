// Motor de eventos: selección, tiradas de habilidad, efectos con resumen.

import { RNG } from '../engine/rng.js';
import { rng, alive, addRes, addSuspicion, disloyal, log, RES, caps } from './run.js';
import { genCrew, displayName, giveXp, maxHp, has, a as ga } from './crew.js';
import { genModule, modTitle } from './loot.js';
import { SKILL } from './data/traits.js';
import { EVENTS } from './data/events.js';
import { clamp } from '../engine/util.js';
import { passTime } from './nodes.js';
import { onDeath } from './directives.js';

// --- Efectos con resumen -------------------------------------------------------
export function makeFx(run, ctx) {
  const out = [];
  const E = {
    out,
    res(delta) {
      for (const k in delta) {
        const got = addRes(run, k, delta[k]);
        if (Math.abs(got) < 0.01) {
          if (delta[k] > 0) out.push(`{x}(no cabe más ${RES[k].name.toLowerCase()}){/}`);
          continue;
        }
        const v = RES[k].d ? Math.abs(got).toFixed(RES[k].d) : Math.round(Math.abs(got));
        out.push(`${got > 0 ? '{g}+' : '{r}−'}${v}${RES[k].unit} ${RES[k].name.toLowerCase()}{/}`);
      }
      return E;
    },
    susp(n, reason) {
      const a = addSuspicion(run, n, reason);
      if (Math.abs(a) >= 0.5) out.push(`${a > 0 ? '{r}+' : '{g}−'}${Math.round(Math.abs(a))} sospecha{/}`);
      return E;
    },
    disloyal(n, reason) {
      const a = disloyal(run, n, reason);
      out.push(`{r}+${Math.round(a)} sospecha{/}`);
      return E;
    },
    morale(n, who) {
      const list = who ? [who] : alive(run);
      for (const c of list) c.morale = clamp(c.morale + n, 0, 100);
      out.push(`${n > 0 ? '{g}+' : '{r}−'}${Math.abs(n)} moral${who ? ' (' + who.sur + ')' : ''}{/}`);
      return E;
    },
    hurt(c, n, cause = 'heridas') {
      if (!c) return E;
      c.hp -= n;
      out.push(`{r}${c.sur}: −${n} salud{/}`);
      if (c.hp <= 0) {
        c.hp = 0;
        c.dead = true;
        c.cause = cause;
        c.diedAt = run.clock;
        run.stats.deaths++;
        onDeath(run);
        out.push(`{r}✝ ${displayName(c)} ha muerto{/}`);
        for (const o of alive(run)) o.morale = clamp(o.morale - 12, 0, 100);
      }
      return E;
    },
    heal(c, n) {
      c.hp = Math.min(maxHp(c), c.hp + n);
      out.push(`{g}${c.sur}: +${n} salud{/}`);
      return E;
    },
    rad(n) {
      for (const c of alive(run)) c.rad = clamp(c.rad + n, 0, 100);
      out.push(`{g}+${n} radiación a la tripulación{/}`);
      return E;
    },
    know(n) {
      return E.res({ knowledge: n });
    },
    time(min) {
      passTime(run, min);
      out.push(`{x}+${min >= 60 ? Math.round(min / 60) + ' h' : min + ' min'}{/}`);
      return E;
    },
    module(opts = {}) {
      const m = genModule(rng(run), { region: run.region, ...opts });
      run.inventory.push(m);
      out.push(`{l}Obtenéis: ${modTitle(m)}{/}`);
      return m;
    },
    recruit(c) {
      c.joined = run.clock;
      run.crew.push(c);
      out.push(`{O}${displayName(c)} se une a la tripulación{/}`);
      return c;
    },
    newCrew(opts = {}) {
      return genCrew(rng(run), opts);
    },
    note(t) {
      out.push(t);
      return E;
    },
    damageHull(n) {
      for (const id in run.ship.rooms) run.ship.rooms[id].int = clamp(run.ship.rooms[id].int - n * rng(run).float(0.5, 1.5), 5, 100);
      out.push(`{r}Daños estructurales (−${n}%){/}`);
      return E;
    },
    damageModules(n, count = 1) {
      const ids = Object.keys(run.ship.slots).filter((k) => run.ship.slots[k]);
      for (let i = 0; i < count && ids.length; i++) {
        const id = rng(run).pick(ids);
        const m = run.ship.slots[id];
        m.int = Math.max(0, m.int - n);
        out.push(`{r}${m.name} dañado{/}`);
      }
      return E;
    },
    repairAll(n) {
      for (const id in run.ship.slots) {
        const m = run.ship.slots[id];
        if (m) m.int = Math.min(m.maxInt, m.int + n);
      }
      out.push(`{g}Módulos reparados (+${n}){/}`);
      return E;
    },
  };
  return E;
}

// --- Selección ---------------------------------------------------------------------
export function pickEvent(run, node) {
  const r = new RNG((node.seed ^ (run.region * 7919)) >>> 0);
  const used = run.flags.usedEvents || (run.flags.usedEvents = []);
  const ctx = { node, region: run.region };
  const cands = [];
  for (const id in EVENTS) {
    const ev = EVENTS[id];
    if (ev.special) continue;
    if (ev.where && !ev.where.includes(node.type)) continue;
    if (ev.regions && !ev.regions.includes(run.region)) continue;
    if (ev.once !== false && used.includes(id)) continue;
    if (ev.cond && !ev.cond(run, ctx)) continue;
    cands.push([id, ev.weight ?? 1]);
  }
  if (!cands.length) return null;
  const id = r.weighted(cands);
  if (EVENTS[id].once !== false) used.push(id);
  return id;
}

// Mejor tripulante para una habilidad
export function bestFor(run, skill) {
  let best = null;
  for (const c of alive(run)) {
    if (c.hp < 20) continue;
    if (!best || c.skills[skill] > best.skills[skill]) best = c;
  }
  return best;
}

export function checkChance(run, opt) {
  if (!opt.skill) return null;
  const c = bestFor(run, opt.skill);
  const sk = c ? c.skills[opt.skill] : 0;
  return { chance: clamp(0.5 + (sk - (opt.dc ?? 5)) * 0.11 + (opt.bonus || 0), 0.05, 0.95), actor: c, skill: sk };
}

// Resuelve una opción: devuelve {text, fx, success, next, end}
export function resolveOption(run, ev, opt, ctx) {
  const E = makeFx(run, ctx);
  let text = '';
  let success = null;
  if (opt.skill) {
    const ch = checkChance(run, opt);
    ctx.actor = ch.actor;
    success = rng(run).chance(ch.chance);
    if (ch.actor) giveXp(ch.actor, opt.skill, success ? 25 : 10);
    text = success ? opt.ok(run, ctx, E) : opt.fail(run, ctx, E);
  } else {
    text = opt.fx ? opt.fx(run, ctx, E) || '' : '';
  }
  run.stats.events++;
  return { text, fx: E.out, success, next: typeof opt.next === 'function' ? opt.next(run, ctx, success) : opt.next, end: opt.end };
}

export function eventDef(id) {
  return EVENTS[id];
}

export function optionsFor(run, ev, ctx) {
  const opts = typeof ev.options === 'function' ? ev.options(run, ctx) : ev.options;
  return opts.filter((o) => !o.hidden || !o.hidden(run, ctx));
}

export function skillName(s) {
  return SKILL[s]?.name || s;
}
