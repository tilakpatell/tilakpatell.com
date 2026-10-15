// What the seven blaster heroes' abilities do: a handler a kind, each on
// the numbers abilities.json's `effect` block reads from the game's records
// (scripts/lib/bf2017-rulebook-effects.mjs; a number no record names is the
// block's `hand`, src/data/bf2017/NOTES.md). The times are the ability
// rows', run by abilities.js; the thrown things fly, burst and burn as the
// troopers' do (grenades.js, kit.js); a swapped weapon is a gun of its own
// row in the hand (kit.js's syncGun); the dash and the slam are the saber
// heroes' own (heroAbilities.js), on the blaster hero's numbers. Pure.
//
//   KINDS                     the fourteen kinds, BLASTER[kind] its handler:
//     { fire(sim, s, a, now) → requests   at the end of the activation
//       end(sim, s, a, now, why) → requests   when the ability ends
//       again(sim, s, a, now)   a press while it is active (the next detonator)
//       step(sim, s, a, now)    each step while the hero lives }
//   onBlaster(sim, s, a, e) → requests | null   (an ability event; null: not a blaster kind)
//   pressBlaster(sim, s, slot, now) → bool      (a press an active ability takes for itself)
//   stepBlaster(sim, s, now) → requests         (the abilities' steps, the dome, the mines, the barrage)
//   dropBlaster(sim, s)                          (a fallen hero's charge, device, mines and dome go with it)
//   domed(sim, target, bolt, damage) → bool     (a bolt from outside a Squad Shield at one inside it: the shield takes it)

import { end as endAbility } from './abilities.js';
import { remove } from './affectors.js';
import { fire as fireBolt } from './bolts.js';
import { SPLIT, createGrenade, throwFrom } from './grenades.js';
import { heightAt } from './nav.js';
import { meshStand } from './meshNav.js';
import { syncGun } from './kit.js';
import { chestOf, eyeOf } from './soldier.js';
import { createGun } from './weapons.js';
import { aimPitch, aimYaw, dmgFor, enemiesOf, fireAbility, hold, inReach } from './heroAbilities.js';

export const KINDS = ['charge', 'thrown', 'weaponSwap', 'dash', 'deployShield', 'cloud', 'scan', 'reveal', 'mines', 'barrage', 'stunDroid', 'selfShield', 'slam', 'marks'];

// How long a bot waits before it sets off a charge with no one on it, and puts a weapon with no heat away: by hand.
export const BOT_CHARGE = 3;
export const BOT_WEAPON = 10;
// The gap between a bot's detonators (a player throws one a press): by hand.
export const BOT_THROW = 0.5;
// How often the smoke looks for who stands in it, seconds: by hand.
export const SMOKE_TICK = 0.5;
// A fuse that never runs: the round waits for its ability (a charge, a device).
const NEVER = { on: 'never', delay: 0 };
const ON_HIT = { on: 'collision', delay: 0 };

const fxOf = (a) => a.row.hero;
const dist = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);
const dirTo = (from, to) => {
  const d = [to[0] - from[0], 0, to[2] - from[2]];
  const L = Math.hypot(d[0], d[2]) || 1;
  return [d[0] / L, 0, d[2] / L];
};

// a round from the hero's hand along its aim (the trooper's throw, at the round's own speed where it has one)
function toss(sim, s, row, now, { speed = null, up = null } = {}) {
  const { at, vel } = throwFrom(eyeOf(s), aimYaw(s), aimPitch(s), { ...(speed != null ? { speed } : {}), ...(up != null ? { up } : {}) });
  const g = Object.assign(createGrenade(row, { at, vel, owner: s.id, team: s.team, now, bot: s.bot }), { id: sim.kit.next++ });
  sim.kit.grenades.push(g);
  sim.out?.push({ t: now, type: 'throw', by: s.id, kind: row.id, at: [...at] });
  return g;
}

// a rocket from the hero's eye straight at a point (a round that flies flat is aimed, not lobbed)
function launch(sim, s, row, now, to, speed) {
  const eye = eyeOf(s);
  const d = [to[0] - eye[0], to[1] - eye[1], to[2] - eye[2]];
  const L = Math.hypot(...d) || 1;
  const at = [eye[0] + (d[0] / L) * 0.5, eye[1] + (d[1] / L) * 0.5, eye[2] + (d[2] / L) * 0.5];
  const g = Object.assign(createGrenade(row, { at, vel: d.map((v) => (v / L) * speed), owner: s.id, team: s.team, now, bot: s.bot }), { id: sim.kit.next++ });
  sim.kit.grenades.push(g);
  sim.out?.push({ t: now, type: 'throw', by: s.id, kind: row.id, at: [...at] });
  return g;
}

// a burst where something lies: the kit applies it this step
function burst(sim, s, at, row, now) {
  sim.kit.blasts.push({ by: s.id, team: s.team, at: [at[0], at[1] + 0.2, at[2]], row, multiplier: 1 });
  sim.out?.push({ t: now, type: 'explosion', by: s.id, kind: row.id, at: [...at], radius: row.radius });
}

const blastRow = (id, fx, more = {}) => ({ id, inner: fx.inner ?? 0, damage: fx.damage ?? 0, radius: fx.radius ?? 0, multiplier: 1, impulse: fx.impulse ?? 0, ...more });

// the rounds, each from its ability's numbers
const ROUNDS = {
  // Han Solo's charge: it sticks where it lands and waits
  Ability_HanSolo_DemolitionGrenade: (fx) => blastRow('detonite', fx, { fuse: NEVER, stick: true, ttl: Infinity, gravity: fx.gravity }),
  // Leia's detonators: the trooper's fuse, her own blast
  Ability_Leia_ThermalDetonator_Fake: (fx) => blastRow('thermal', fx, { fuse: { on: 'sleep', delay: fx.hand.fuse }, ttl: fx.ttl, gravity: fx.gravity }),
  // Chewbacca's shock grenade: no damage; where it first lands it splits (as the officer's flash does, kit.js), and
  // each of its six shocks those within its reach, no one twice inside the immunity it leaves
  Ability_Chewbacca_GrenadeStun: (fx) =>
    blastRow('shock', { radius: fx.radius }, { fuse: ON_HIT, ttl: fx.ttl, gravity: fx.gravity, splits: fx.splits, sub: blastRow('shockSub', { radius: fx.radius }, { fuse: { on: 'timer', delay: SPLIT.fuse }, ttl: fx.ttl, field: { radius: fx.reach, perSecond: 0, tick: 0.1, apply: fx.shock, immune: fx.immune, seconds: 0.1 } }) }),
  // Boba Fett's concussion rocket: those facing it flashed, the blasters in its burst held down
  Ability_BobaFett_Concussion_Rocket: (fx) => blastRow('rocket', { radius: fx.radius }, { fuse: ON_HIT, ttl: fx.ttl, gravity: fx.gravity, flash: { range: fx.flash.range, angle: fx.flash.angle, seconds: fx.flash.seconds }, field: { radius: fx.radius, perSecond: 0, tick: 0.1, noFire: fx.disrupt, seconds: 0.1 } }),
  // Bossk's Dioxis: the cloud its first touch and then its rate, for its seconds after the burst (the flight has its own fuse)
  Ability_Bossk_GrenadeDioxis: (fx) => blastRow('dioxis', { radius: fx.radius }, { fuse: ON_HIT, ttl: fx.ttl, field: { radius: fx.reach, first: fx.first, perSecond: fx.perSecond, tick: fx.tick, seconds: fx.seconds } }),
  // Lando's smoke: a cloud that hurts no one and hides whoever stands within its `hides`, for its seconds from the first bounce
  Ability_GrenadeSmoke_Lando: (fx) => blastRow('smoke', { radius: fx.radius }, { fuse: ON_HIT, ttl: fx.ttl, field: { radius: fx.radius, perSecond: 0, tick: SMOKE_TICK, seconds: fx.seconds, hides: fx.hides } }),
  // Lando's disabler: it sticks and waits, as the charge does
  Ability_Lando_Disruptor: (fx) => blastRow('disabler', { radius: fx.radius }, { fuse: NEVER, stick: true, ttl: Infinity }),
  // Boba Fett's barrage: a rocket that flies flat and bursts on what it meets
  Ability_BobaFett_RocketBarrage: (fx) => blastRow('barrage', fx, { fuse: ON_HIT, ttl: fx.ttl, gravity: fx.gravity }),
};
const roundOf = (a) => (a.round ??= ROUNDS[a.row.id](fxOf(a)));

function throwNext(sim, s, a, now) {
  const fx = fxOf(a);
  // (a round with a speed of its own is a rocket, sent at the aim point; the rest are thrown)
  if (fx.speed != null) launch(sim, s, roundOf(a), now, s.aim ?? [s.at[0] + Math.sin(s.yaw) * 30, s.at[1] + 1, s.at[2] + Math.cos(s.yaw) * 30], fx.speed);
  else toss(sim, s, roundOf(a), now);
  a.thrown = (a.thrown ?? 0) + 1;
  a.nextThrow = now + BOT_THROW;
  if (a.thrown >= fx.hand.count) {
    a.thrown = 0;
    // (the last one thrown ends an ability the record holds active for ever, Leia's detonators; one with an
    // active time of its own, Chewbacca's second, runs it out)
    if (a.phase === 'active' && a.row.active > 60) endAbility(s.abilities, a.slot, now, 'thrown');
  }
}

const enemiesNear = (sim, s, at, radius) => enemiesOf(sim, s).filter((o) => dist(o.at, at) <= radius);

export const BLASTER = {
  // a sticky charge thrown at the activation's end, set off by the second press
  charge: {
    fire(sim, s, a, now) {
      const fx = fxOf(a);
      a.device = toss(sim, s, roundOf(a), now, { speed: fx.speed, up: 0 });
      return [];
    },
    step(sim, s, a, now) {
      const g = a.device;
      if (!s.bot || a.phase !== 'active' || !g?.resting) return [];
      // (a bot sets it off with an enemy inside its full blast, or after a wait)
      if (enemiesNear(sim, s, g.at, fxOf(a).inner).length || now - g.restAt >= BOT_CHARGE) endAbility(s.abilities, a.slot, now, 'retrigger');
      return [];
    },
    end(sim, s, a, now) {
      const g = a.device;
      a.device = null;
      if (!g || g.dead) return [];
      g.dead = true;
      burst(sim, s, g.at, g.row, now);
      return [];
    },
  },
  // one round a press until they are all thrown (Leia's three), or the one (the shock grenade, the rocket)
  thrown: {
    fire(sim, s, a, now) {
      a.thrown = 0;
      throwNext(sim, s, a, now);
      return [];
    },
    again(sim, s, a, now) {
      throwNext(sim, s, a, now);
    },
    step(sim, s, a, now) {
      if (s.bot && a.phase === 'active' && a.thrown > 0 && now >= a.nextThrow) throwNext(sim, s, a, now);
      return [];
    },
  },
  // the ability's own weapon in the hand until its heat ends it or the second press puts it away
  weaponSwap: {
    fire(sim, s, a) {
      const w = fxOf(a).weapon;
      // (its overheat is the ability's end, not a bar to cool by hand: the gun is made with no active cooling)
      a.gun = createGun(w.heat?.cooling ? { ...w, heat: { ...w.heat, cooling: null } } : w, { rand: sim.rand });
      syncGun(s);
      return [];
    },
    step(sim, s, a, now) {
      const g = a.gun;
      if (a.phase !== 'active' || !g) return [];
      const hot = Boolean(g.row.heat) && (g.state !== 'ready' || g.heat >= g.row.heat.threshold - 1e-9);
      if (hot) endAbility(s.abilities, a.slot, now, 'heat');
      // (a weapon with no heat, Iden's pulse cannon, is a bot's to put away after a while)
      else if (s.bot && !g.row.heat && now - a.activeAt >= BOT_WEAPON - 1e-9) endAbility(s.abilities, a.slot, now, 'time');
      return [];
    },
    end(sim, s, a) {
      a.gun = null;
      syncGun(s);
      return [];
    },
  },
  // (the saber heroes' rush, on Shoulder Charge's numbers: heroAbilities.js)
  dash: { fire: fireAbility },
  // (the saber heroes' slam, on the Charge Slam's: heroAbilities.js)
  slam: { fire: fireAbility },
  // a dome at the hero's place: its health takes the bolts from outside, those of its side inside it heal
  deployShield: {
    fire(sim, s, a, now) {
      const fx = fxOf(a);
      s.hero.dome = { at: s.at.slice(), radius: fx.radius, hp: fx.health, max: fx.health, until: now + fx.seconds, heal: fx.heal, every: fx.healEvery, next: now + fx.healEvery };
      sim.out?.push({ t: now, type: 'dome', by: s.id, at: s.at.slice(), radius: fx.radius });
      return [];
    },
  },
  // a grenade whose burst leaves a cloud (the kit's field)
  cloud: {
    fire(sim, s, a, now) {
      toss(sim, s, roundOf(a), now);
      return [];
    },
  },
  // the enemies round the hero shown to its side while it lasts; the hero off their radars
  scan: {
    fire(sim, s) {
      s.offRadar = true;
      return [];
    },
    step(sim, s, a, now) {
      if (a.phase !== 'active') return [];
      for (const o of enemiesNear(sim, s, s.at, fxOf(a).range)) o.markedUntil = Math.max(o.markedUntil ?? 0, now + 0.5);
      return [];
    },
    end(sim, s) {
      s.offRadar = false;
      return [];
    },
  },
  // a sticky device that shows and jams those near it; the second press overcharges it and they are shocked, as
  // they are when its time runs out (its card's own text: it "auto-detonates")
  reveal: {
    fire(sim, s, a, now) {
      a.device = toss(sim, s, roundOf(a), now);
      return [];
    },
    step(sim, s, a, now) {
      const g = a.device;
      if (a.phase !== 'active' || !g?.resting) return [];
      const fx = fxOf(a);
      for (const o of enemiesNear(sim, s, g.at, fx.radius)) {
        o.markedUntil = Math.max(o.markedUntil ?? 0, now + fx.jam);
        o.jammedUntil = Math.max(o.jammedUntil ?? 0, now + fx.jam);
      }
      return [];
    },
    end(sim, s, a, now) {
      const g = a.device;
      a.device = null;
      if (!g || g.dead) return [];
      g.dead = true;
      const fx = fxOf(a);
      for (const o of enemiesNear(sim, s, g.at, fx.radius)) hold(o, now + fx.shock, 'shocked');
      sim.out?.push({ t: now, type: 'explosion', by: s.id, kind: 'disabler', at: [...g.at], radius: fx.radius });
      return [];
    },
  },
  // mines laid ahead in a row: armed after their delay, off for an enemy inside their reach
  mines: {
    fire(sim, s, a, now) {
      const fx = fxOf(a);
      const yaw = aimYaw(s);
      const row = blastRow('mine', fx);
      s.hero.mines = [];
      for (let i = 1; i <= fx.hand.count; i++) {
        const at = [s.at[0] + Math.sin(yaw) * fx.hand.apart * i, s.at[1], s.at[2] + Math.cos(yaw) * fx.hand.apart * i];
        // (on the level's navmesh, the floor nearest the hero's own: a hangar's, not the snow over it)
        const stood = sim.nav?.mesh ? meshStand(sim.nav, at, 2) : null;
        if (stood) at[1] = stood[1];
        else if (sim.nav) at[1] = heightAt(sim.nav, at[0], at[2]);
        s.hero.mines.push({ at, armAt: now + fx.arm, until: now + fx.hand.life, trigger: fx.trigger, row });
      }
      sim.out?.push({ t: now, type: 'mines', by: s.id, at: s.hero.mines.map((m) => m.at.slice()) });
      return [];
    },
  },
  // the rockets one after another at the launcher's rate, round the aim point
  barrage: {
    fire(sim, s, a, now) {
      const fx = fxOf(a);
      const yaw = aimYaw(s);
      s.hero.barrage = { left: fx.count, every: 60 / fx.rof, next: now, aim: s.aim ? s.aim.slice() : [s.at[0] + Math.sin(yaw) * 20, s.at[1], s.at[2] + Math.cos(yaw) * 20], row: roundOf(a), speed: fx.hand.speed, spread: fx.hand.spread };
      return [];
    },
  },
  // the droid's shock on the mark ahead, leaping to those near it
  stunDroid: {
    fire(sim, s, a, now) {
      const fx = fxOf(a);
      const yaw = aimYaw(s);
      const mark = enemiesOf(sim, s)
        .filter((o) => inReach(sim, s, o, { range: fx.hand.range, cone: fx.hand.cone, yaw }))
        .sort((p, q) => dist(p.at, s.at) - dist(q.at, s.at))[0];
      if (!mark) return [];
      const hits = [];
      for (const o of [mark, ...enemiesNear(sim, s, mark.at, fx.chain).filter((x) => x !== mark)]) {
        hits.push({ id: o.id, damage: dmgFor(fx.damage, o), dir: dirTo(s.at, o.at) });
        hold(o, now + fx.shock, 'shocked');
      }
      return [{ type: 'blast', part: 'force', kind: 'stunDroid', by: s.id, team: s.team, at: chestOf(mark), hits }];
    },
  },
  // a shield of its own health round the hero while the ability lasts
  selfShield: {
    fire(sim, s, a, now) {
      const hp = fxOf(a).health;
      s.over = { hp, max: hp, since: now, drainAfter: Infinity, step: 0, every: 1e9, next: Infinity, drainStep: 0, drainEvery: 1e9, of: a.row.id };
      return [];
    },
    step(sim, s, a, now) {
      // (broken through: the ability is over)
      if (a.phase === 'active' && !(s.over?.of === a.row.id && s.over.hp > 0)) endAbility(s.abilities, a.slot, now, 'health');
      return [];
    },
    end(sim, s, a) {
      if (s.over?.of === a.row.id) s.over = null;
      return [];
    },
  },
  // the enemies in view marked while it lasts, nearest first, as many as it holds; then the flurry, one shot of
  // the ability's own round at each whose mark still stands, when it is pressed again or its time runs out
  marks: {
    fire(sim, s, a, now) {
      a.marks = [];
      markMore(sim, s, a, now);
      return [];
    },
    step(sim, s, a, now) {
      if (a.phase === 'active' && a.marks) markMore(sim, s, a, now);
      return [];
    },
    end(sim, s, a, now) {
      const fx = fxOf(a);
      const targets = (a.marks ?? []).filter((m) => m.until > now).map((m) => m.id);
      a.marks = null;
      if (targets.length) s.hero.flurry = { targets, next: now, every: fx.every, damage: fx.damage };
      return [];
    },
  },
};

// those in view marked, nearest first, up to the count; a mark is kept up while its body stays in view, and
// stands its seconds after it has left
function markMore(sim, s, a, now) {
  const fx = fxOf(a);
  const yaw = aimYaw(s);
  const seen = enemiesOf(sim, s)
    .filter((o) => inReach(sim, s, o, { range: fx.range, cone: fx.hand.cone, yaw }))
    .sort((p, q) => dist(p.at, s.at) - dist(q.at, s.at));
  for (const o of seen) {
    let m = a.marks.find((x) => x.id === o.id);
    if (!m && a.marks.length < fx.hand.count) a.marks.push((m = { id: o.id, until: 0 }));
    if (!m) continue;
    m.until = now + fx.marked;
    o.markedUntil = Math.max(o.markedUntil ?? 0, m.until);
  }
}

// one shot of Sharp Shot's round at a mark: the hero's own gun's bolt, at the round's damage whatever the range
function sharpShot(sim, s, o, damage, now) {
  const row = (s.gunBase ?? s.gun)?.row ?? {};
  const from = chestOf(s);
  const to = chestOf(o);
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const L = Math.hypot(...d) || 1;
  fireBolt(sim.bolts, { from, dir: d.map((v) => v / L), speed: row.firing?.speed ?? 700, range: row.range ?? 200, ttl: row.damage?.timeToLive ?? 3, team: s.team, owner: s.id, weapon: { id: 'sharpShot', family: 'hero', damage: { start: damage, end: damage, startDistance: 0, endDistance: 1, min: 1, max: 1 } }, colour: row.colour, now });
  sim.out?.push({ t: now, type: 'shot', by: s.id });
}

export function onBlaster(sim, s, a, e) {
  const h = BLASTER[fxOf(a)?.kind];
  if (!h) return null;
  const now = sim.time;
  const out = [];
  if (e.phase === 'start') return out;
  // (it goes off once, when its activation ends: into its active time, or straight to its end where it has none)
  if (!a.fired && (e.phase === 'active' || !e.why)) {
    a.fired = true;
    out.push(...(h.fire?.(sim, s, a, now) ?? []));
  }
  if (e.phase === 'end') {
    out.push(...(h.end?.(sim, s, a, now, e.why ?? null) ?? []));
    // (the damage taken while a held ability lasted, a swapped weapon's: over with it)
    if (a.row.active === Infinity) remove(s.stack, `${a.row.id}:taken`);
  }
  return out;
}

export function pressBlaster(sim, s, slot, now) {
  const a = s.abilities.list.find((x) => x.slot === slot);
  const h = a && BLASTER[fxOf(a)?.kind];
  if (!h?.again || a.phase !== 'active') return false;
  h.again(sim, s, a, now);
  return true;
}

export function stepBlaster(sim, s, now) {
  const H = s.hero;
  const out = [];
  for (const a of s.abilities.list) {
    const h = BLASTER[fxOf(a)?.kind];
    if (h?.step) out.push(...h.step(sim, s, a, now));
  }
  const d = H.dome;
  if (d) {
    if (now >= d.until || d.hp <= 0) H.dome = null;
    else if (now + 1e-9 >= d.next) {
      d.next += d.every;
      for (const o of sim.entities.values()) if (o.kind === 'soldier' && o.alive && o.team === s.team && dist(o.at, d.at) <= d.radius) o.hp = Math.min(o.hpMax, o.hp + d.heal);
    }
  }
  if (H.mines?.length) {
    const them = enemiesOf(sim, s);
    H.mines = H.mines.filter((m) => {
      if (now >= m.until) return false;
      if (now < m.armAt || !them.some((o) => dist(o.at, m.at) <= m.trigger)) return true;
      burst(sim, s, m.at, m.row, now);
      return false;
    });
  }
  const b = H.barrage;
  if (b) {
    while (b.left > 0 && now + 1e-9 >= b.next) {
      b.left--;
      b.next += b.every;
      launch(sim, s, b.row, now, [b.aim[0] + (sim.rand() - 0.5) * 2 * b.spread, b.aim[1], b.aim[2] + (sim.rand() - 0.5) * 2 * b.spread], b.speed);
    }
    if (b.left <= 0) H.barrage = null;
  }
  const f = H.flurry;
  if (f) {
    while (f.targets.length && now + 1e-9 >= f.next) {
      f.next += f.every;
      const o = sim.entities.get(f.targets.shift());
      if (o?.alive) sharpShot(sim, s, o, f.damage, now);
    }
    if (!f.targets.length) H.flurry = null;
  }
  return out;
}

export function dropBlaster(sim, s) {
  const H = s.hero;
  for (const a of s.abilities.list) {
    if (a.device) a.device.dead = true;
    a.device = null;
  }
  H.dome = null;
  H.mines = [];
  H.barrage = null;
  H.flurry = null;
}

export function domed(sim, t, bolt, damage = 0) {
  for (const o of sim.entities.values()) {
    const dome = o.hero?.dome;
    if (!dome || o.team !== t.team || !o.alive) continue;
    if (dist(t.at, dome.at) > dome.radius || dist(bolt.from, dome.at) <= dome.radius) continue;
    dome.hp -= damage;
    return true;
  }
  return false;
}
