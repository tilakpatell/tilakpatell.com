// The heroes' and reinforcements' abilities played over the sim's steps
// (abilitiesUnit.js reads what each does from its records; this file plays
// it by its kind): an area ability's query once its wind-up is over (the
// push, the repulse, the pull, the slam, the mind trick, the barrier) or
// again each second while it lasts (the dark aura, the ping); a rush that
// carries its user forward through what it meets (a WarpClip move, finding
// 46: the hit sphere is its own); a choke or an electrocution that holds
// the nearest it finds in its cone for the grip's time; chain lightning from
// the first to the next within the loop's sphere; a thrown saber that flies
// out at its missile's speed and back; the grenades, rockets and traps as
// projectiles of their own records; a weapon ability's gun in the hand while
// it lasts; a bubble that keeps its side's damage off inside it; the jump
// pack's thrusts (`JumpPack.Control`, `JumpPackDash_Control`); and the saber
// heroes' strike on the trigger (saber.json's query and damage). Pure: the
// sim's entities and navgrid go in, damage requests come out.
//
//   onUnit(sim, s, a, e)          an ability event of a hero's or a reinforcement's (start / active / end)
//   stepUnits(sim) → requests [{ type: 'blast', by, team, at, kind, hits }]
//   strike(sim, s, aim) → bool    a saber hero's swing (core.js's shoot for a soldier with a saber and no gun)
//   shielded(sim, o) → dome | null     the bubble o stands in, if any (kit.js's absorb)
//   RUSH, JUMP_PACK, STRIKE, CHAIN

import { lungePick, saberOf, strikeZone } from '../combat/saber2017.js';
import { end } from './abilities.js';
import { affect, burst, inReach, kitOfUnit, outputOf, release, specOf, unitWeapon, unitsOf } from './abilitiesUnit.js';
import { STEP } from './core.js';
import { heightAt, walkable } from './nav.js';
import { chestOf } from './soldier.js';
import { createGun } from './weapons.js';
import { weaponOf } from './rulebook.js';

// A rush's drive: the attack node's `DriveWithInput.ChargedAttack` (Velocity 5, SprintTopSpeedMultiplier 1.57); its
// time the ability's ActiveTime, or 0.5 s where that is 0 (the dash clip's own length is not exported): NOTES.md.
export const RUSH = { speed: 5 * 1.57, time: 0.5 };
// The jump packs (`Physics.JumpPack.Node`: JumpPack.Control and Network_Physics_JumpPackDash_Control): up and forward
// thrusts for AccelerateTime, then the fall at −20 (Network_Physics_Fall). The thrusts read as accelerations with the
// gravity off while they push (the controller's update is not decompiled): NOTES.md.
export const JUMP_PACK = {
  Ability_Special_Shared_JumpPack: { up: 28, forward: 11, accelerate: 0.5, gravity: -20 },
  Ability_Special_Shared_JumpPack_Dash: { up: 12, forward: 25, accelerate: 1, gravity: -20 },
};
// A saber strike's cadence (finding 41): the next strike opens 0.5 s in (tick 30 of 60), the kill window 0.42–0.58 s.
export const STRIKE = { every: 0.5, hit: 0.42 };
// Chain lightning: the loop's sphere is its record's (PF_ChainLightning_Emperor_Targetloop, 10 m); how many it leaps
// to is an output this read does not name (1209176742 = 5 is the likeliest): 5 by hand, NOTES.md.
export const CHAIN = { hops: 5 };
// How long a bubble stands where the record does not say (Leia's shield vehicle's life is not read): NOTES.md.
export const BUBBLE_LIFE = 10;
const SABER_KEY = { darthvader: 'vader' };

const units = unitsOf;
const domesOf = (sim) => ((sim.kit ??= {}).domes ??= []);
const fwd = (s) => [Math.sin(s.yaw), 0, Math.cos(s.yaw)];

function gunFor(sim, id) {
  const row = unitWeapon(id) ?? (() => {
    try {
      return weaponOf(sim.rb, id);
    } catch {
      return null;
    }
  })();
  return row ? createGun(row, { rand: sim.rand }) : null;
}

export function onUnit(sim, s, a, e) {
  const spec = a?.row.unit;
  if (!spec) return;
  const U = units(sim);
  const now = sim.time;
  const out = (sim.unitOut ??= []);
  if (e.phase === 'start') {
    // (armour through the wind-up: the push's, the impact's, the thrust's damage taken from the press)
    for (const fx of spec.self) if (fx.type === 'taken') affect(sim, s, s, fx, now, out, spec.id);
    if (spec.kind === 'weapon' && spec.weapon) {
      const gun = gunFor(sim, spec.weapon);
      if (gun) {
        a.gun = gun;
        s.gunBase ??= s.gun;
        s.gun = gun;
        s.weapon = gun.row;
      }
    }
    s.kitActive = { id: spec.id, slot: a.slot, since: now };
    return;
  }
  if (e.phase === 'end') {
    release(sim, s, spec.id);
    if (a.gun) {
      a.gun = null;
      if (s.gunBase) {
        s.gun = s.gunBase;
        s.gunBase = null;
        s.weapon = s.gun?.row ?? s.weapon;
      }
    }
    U.holds = U.holds.filter((h) => h.by !== s.id || h.ability !== spec.id);
    for (const o of sim.entities.values()) if (o.heldBy === s.id) o.heldBy = null;
    if (s.kitActive?.id === spec.id) s.kitActive = null;
    return;
  }
  if (e.phase !== 'active') return;
  const active = Number.isFinite(a.row.active) ? a.row.active : 0;
  const rest = spec.self.filter((fx) => fx.type !== 'taken');
  switch (spec.kind) {
    case 'push':
    case 'repulse':
    case 'pull':
    case 'slam':
    case 'weaken':
    case 'pulse':
    case 'sharpShot':
    case 'barrier':
      burst(sim, s, { ...spec, self: rest }, now, out);
      break;
    case 'aura':
    case 'scan':
      burst(sim, s, { ...spec, self: rest }, now, out);
      if (active > 0) U.repeats.push({ by: s.id, ability: spec.id, spec: { ...spec, self: [] }, every: 1, next: now + 1, until: now + active });
      break;
    case 'buff':
      for (const fx of rest) affect(sim, s, s, fx, now, out, spec.id);
      break;
    case 'rush':
      for (const fx of rest) affect(sim, s, s, fx, now, out, spec.id);
      U.moves.push({ by: s.id, ability: spec.id, dir: fwd(s), speed: RUSH.speed, until: now + (active > 0 ? Math.min(active, 1.2) : RUSH.time), reach: spec.reach ?? 1.5, hit: new Set(), spec });
      break;
    case 'choke': {
      const grip = active > 0 ? active : Math.max(0.5, ...spec.targets.map((t) => t.duration || 0));
      const victims = inReach(sim, s, { range: spec.range, cone: spec.cone }).slice(0, spec.max ?? 1);
      for (const o of victims) {
        for (const fx of spec.targets) affect(sim, s, o, fx.duration > 0 ? fx : { ...fx, duration: grip }, now, out, spec.id);
        o.heldBy = s.id;
        o.disabledUntil = Math.max(o.disabledUntil ?? -Infinity, now + grip);
        o.stunnedUntil = Math.max(o.stunnedUntil ?? -Infinity, now + grip);
        U.holds.push({ by: s.id, ability: spec.id, id: o.id, until: now + grip });
      }
      for (const fx of rest) affect(sim, s, s, fx, now, out, spec.id);
      break;
    }
    case 'chain': {
      const first = inReach(sim, s, { range: spec.range, cone: spec.cone })[0];
      const struck = [];
      let last = first;
      while (last && struck.length < CHAIN.hops) {
        struck.push(last);
        for (const fx of spec.targets) affect(sim, s, last, fx, now, out, spec.id);
        const from = chestOf(last);
        last = inReach(sim, s, { range: spec.reach ?? 10, from }).find((o) => !struck.includes(o)) ?? null;
      }
      s.arcs = { at: now, ids: struck.map((o) => o.id) };
      break;
    }
    case 'throw': {
      const p = spec.projectile ?? {};
      const speed = p.maxSpeed || p.speed || 35;
      const range = spec.range ?? (speed * (active || 2)) / 2;
      const c = chestOf(s);
      U.throws.push({ by: s.id, ability: spec.id, at: [c[0], c[1], c[2]], dir: fwd(s), speed, out: range, flown: 0, back: false, reach: spec.reach ?? 0.5, hit: new Set(), spec, until: now + Math.max(active, (2 * range) / speed) + 0.5 });
      break;
    }
    case 'bubble':
      domesOf(sim).push({ by: s.id, team: s.team, at: [...s.at], radius: spec.reach ?? 4, until: now + (active > 1 ? active : BUBBLE_LIFE), follow: active > 1, ability: spec.id, heal: spec.targets.filter((fx) => fx.type === 'heal') });
      break;
    case 'jumpPack': {
      const j = JUMP_PACK[spec.id];
      if (j) s.air = { y: s.air?.y ?? 0, vy: s.air?.vy ?? 0, push: { ...j, until: now + j.accelerate }, dir: fwd(s), vxz: 0 };
      break;
    }
    case 'grenade':
      throwUnit(sim, s, spec, now);
      break;
    default:
  }
}

// a grenade, rocket or trap of a unit's: its projectile's own speed, gravity, bounce and blast; the affectors its
// prefab lays on what the blast reaches go with it
function throwUnit(sim, s, spec, now) {
  const p = spec.projectile;
  const f = spec.fired;
  if (!p || !sim.kit) return;
  const v = f?.speed ?? [0, 0, p.speed ?? 20];
  const x = p.explosion ?? { inner: 0, damage: 0, radius: spec.range ?? 5, impulse: 0 };
  const grenade = /Grenade/.test(p.entity ?? '') && (p.bounce ?? 0) > 0;
  const row = { id: spec.id, fuse: grenade ? { on: 'sleep', delay: 0 } : { on: 'collision', delay: 0 }, inner: x.inner, damage: x.damage, radius: x.radius || spec.reach || 5, multiplier: 1, impulse: x.impulse, ttl: p.ttl > 0 ? p.ttl : 5, gravity: p.gravity ?? -9.8, owner: true, effects: spec.targets, unit: true };
  const yaw = s.yaw;
  const c = chestOf(s);
  const vel = [Math.sin(yaw) * v[2], v[1], Math.cos(yaw) * v[2]];
  sim.kit.unitThrows ??= [];
  sim.kit.unitThrows.push({ row, at: [c[0] + Math.sin(yaw) * 0.4, c[1] + 0.2, c[2] + Math.cos(yaw) * 0.4], vel, owner: s.id, team: s.team, now });
}

// what moves an entity by an ability: along the ground where it is walkable, else it stops
function slide(sim, o, dx, dz) {
  const x = o.at[0] + dx;
  const z = o.at[2] + dz;
  if (sim.nav && !walkable(sim.nav, x, z)) return false;
  o.at[0] = x;
  o.at[2] = z;
  if (sim.nav && !o.air) o.at[1] = heightAt(sim.nav, x, z);
  return true;
}

export const shielded = (domes, o) => (domes ?? []).find((d) => d.team === o.team && Math.hypot(o.at[0] - d.at[0], o.at[2] - d.at[2]) <= d.radius) ?? null;

export function stepUnits(sim) {
  const U = sim.units;
  const out = sim.unitOut ?? [];
  sim.unitOut = [];
  if (!U) return out;
  const now = sim.time;
  const get = (id) => sim.entities.get(id);
  // shoves: the pushed slide away (or in) for the request's time
  for (const o of sim.entities.values()) {
    if (!o.shove) continue;
    if (now >= o.shove.until || !o.alive) o.shove = null;
    else slide(sim, o, o.shove.dir[0] * o.shove.speed * STEP, o.shove.dir[1] * o.shove.speed * STEP);
  }
  // rushes: forward at the drive's speed, each enemy within the hit sphere struck once
  U.moves = U.moves.filter((m) => {
    const s = get(m.by);
    if (!s?.alive || now >= m.until) return false;
    if (!slide(sim, s, m.dir[0] * m.speed * STEP, m.dir[2] * m.speed * STEP)) return false;
    for (const o of inReach(sim, s, { range: m.reach + 0.5 })) {
      if (m.hit.has(o.id)) continue;
      m.hit.add(o.id);
      for (const fx of m.spec.targets) affect(sim, s, o, fx, now, out, m.ability);
    }
    return true;
  });
  // chokes and holds: the held stay held, lifted, until the grip ends
  U.holds = U.holds.filter((h) => {
    const o = get(h.id);
    const keep = o?.alive && now < h.until;
    if (!keep && o) o.heldBy = null;
    return keep;
  });
  // the areas that repeat while they last (the aura, the ping)
  U.repeats = U.repeats.filter((r) => {
    const s = get(r.by);
    if (!s?.alive || now >= r.until) return false;
    if (now + 1e-9 >= r.next) {
      r.next += r.every;
      burst(sim, s, r.spec, now, out);
    }
    return true;
  });
  // thrown sabers: out to the range, back to the hand, cutting what they pass
  U.throws = U.throws.filter((t) => {
    const s = get(t.by);
    if (!s?.alive || now >= t.until) return false;
    if (t.back) {
      const c = chestOf(s);
      const d = [c[0] - t.at[0], c[1] - t.at[1], c[2] - t.at[2]];
      const L = Math.hypot(...d);
      if (L < t.speed * STEP + 0.5) return false;
      t.dir = d.map((v) => v / L);
    }
    for (let i = 0; i < 3; i++) t.at[i] += t.dir[i] * t.speed * STEP;
    t.flown += t.speed * STEP;
    if (!t.back && t.flown >= t.out) {
      t.back = true;
      t.hit.clear();
    }
    for (const o of inReach(sim, s, { range: t.reach + 0.6, from: t.at })) {
      if (t.hit.has(o.id)) continue;
      t.hit.add(o.id);
      for (const fx of t.spec.targets) affect(sim, s, o, fx, now, out, t.ability);
    }
    return true;
  });
  // bubbles: gone at their time; a following one moves with its owner; the heal inside
  if (sim.kit?.domes) sim.kit.domes = sim.kit.domes.filter((d) => {
    const s = get(d.by);
    if (now >= d.until || (d.follow && !s?.alive)) return false;
    if (d.follow && s) d.at = [...s.at];
    if (d.heal.length && now + 1e-9 >= (d.next ?? now)) {
      d.next = now + 0.5;
      for (const o of sim.entities.values()) if (o.alive && o.kind === 'soldier' && o.team === d.team && Math.hypot(o.at[0] - d.at[0], o.at[2] - d.at[2]) <= d.radius) for (const fx of d.heal) affect(sim, s ?? o, o, fx, now, out, d.ability);
    }
    return true;
  });
  // damage over time and heals over time
  U.dots = U.dots.filter((d) => {
    const o = get(d.id);
    if (!o?.alive || now >= d.until + 1e-9) return false;
    while (now + 1e-9 >= d.next && d.next <= d.until + 1e-9) {
      out.push({ type: 'blast', by: d.by, team: d.team, at: chestOf(o), kind: d.kind, hits: [{ id: o.id, damage: d.perSecond * d.every, dir: null }] });
      d.next += d.every;
    }
    return true;
  });
  U.heals = U.heals.filter((h) => {
    const o = get(h.id);
    if (!o?.alive || now >= h.until) return false;
    o.hp = Math.min(o.hpMax, o.hp + h.perSecond * STEP);
    return true;
  });
  // the jump packs: thrust, then the fall, the body lifted off the ground it walks
  for (const s of sim.entities.values()) {
    const air = s.air;
    if (!air) continue;
    const ground = sim.nav ? heightAt(sim.nav, s.at[0], s.at[2]) : 0;
    const p = air.push && now < air.push.until ? air.push : null;
    air.vy += (p ? p.up : JUMP_PACK.Ability_Special_Shared_JumpPack.gravity) * STEP;
    if (p) air.vxz = Math.min(p.forward * p.accelerate, air.vxz + p.forward * STEP);
    air.y += air.vy * STEP;
    if (air.vxz > 0) slide(sim, s, air.dir[0] * air.vxz * STEP, air.dir[2] * air.vxz * STEP);
    if (air.y <= 0 && !p) {
      s.air = null;
      s.at[1] = ground;
      continue;
    }
    air.y = Math.max(0, air.y);
    s.at[1] = ground + air.y;
  }
  return out;
}

// The Emperor's Force lightning on the trigger (`Ability_Emperor_ForceLightning`, a passive of his kit): its prefab's
// loop (an auto-started Delay 0.1) lays Affector_Damage_Emperor_Lightning_Regular and Affector_Lightning on up to the
// output 3171394841's 2 characters in its cone (3650610006: 14°) and range (1107289327: 15 m).
export const LIGHTNING = { every: 0.1, max: 3171394841, cone: 3650610006, range: 1107289327 };

// a unit's trigger with no gun: a saber's strike, or the Emperor's lightning
export function fireUnit(sim, s, aim) {
  const fire = kitOfUnit(s.unitId)?.fire;
  if (!fire) return strike(sim, s, aim);
  const spec = specOf(fire);
  const now = sim.time;
  if (!spec || !s.alive || (s.stunnedUntil ?? -Infinity) > now || now < (s.strikeAt ?? -Infinity) + LIGHTNING.every - 1e-9) return false;
  s.strikeAt = now;
  const victims = inReach(sim, s, { range: outputOf(fire, LIGHTNING.range) ?? spec.range, cone: outputOf(fire, LIGHTNING.cone) ?? spec.cone }).slice(0, outputOf(fire, LIGHTNING.max) ?? 1);
  const out = (sim.unitOut ??= []);
  for (const o of victims) for (const fx of spec.targets) affect(sim, s, o, fx, now, out, fire);
  s.arcs = { at: now, ids: victims.map((o) => o.id) };
  return true;
}

// The six strikes of a hero's chain (finding 41: Strike_1 → … → 6, the next open from tick 30 of 60) as the packs name them.
export const STRIKES = ['sword.light.a', 'sword.light.b', 'sword.light.c', 'sword.a', 'sword.b', 'sword.uppercut'];
// Where a lunge sets the hero down short of its pick, metres: inside the strike's wedge (0–1.5 m ahead of the hero, the
// 3 m sphere 1.5 m behind it less its 1.5 m core). The warp's own stretch is the clip's root motion, not exported: NOTES.md.
export const LUNGE_STOP = 1.1;

const enemiesOf = (sim, s) => {
  const out = [];
  for (const o of sim.entities.values()) if (o.alive && o.kind === 'soldier' && o.team !== s.team) out.push({ id: o.id, x: o.at[0], y: o.at[1], z: o.at[2], yaw: o.yaw, o });
  return out;
};

// a saber hero's strike (finding 41; saber.json through src/lib/combat/saber2017.js, the galaxy's duels' engine): one each
// `every` seconds while the trigger is down. The lunge's pick (8 m, 40°, scored 0.2·d + 2·angle) turns the hero to it and
// carries it there by the kill window; the hit is the query's wedge at the window (0.42 s) plus the affector's delay
export function strike(sim, s, aim) {
  const rules = saberOf(SABER_KEY[s.unitId] ?? s.unitId);
  if (rules.standIn || !s.alive) return false;
  const now = sim.time;
  if (now < (s.strikeAt ?? -Infinity) + STRIKE.every - 1e-9) return false;
  if ((s.stunnedUntil ?? -Infinity) > now) return false;
  s.strikeAt = now;
  s.strikes = (s.strikes ?? 0) + 1;
  const yaw = aim ? Math.atan2(aim[0] - s.at[0], aim[2] - s.at[2]) : s.yaw;
  const pick = lungePick(rules.query, { x: s.at[0], z: s.at[2], yaw }, enemiesOf(sim, s), { aim: yaw });
  const U = unitsOf(sim);
  if (pick) {
    const dx = pick.x - s.at[0];
    const dz = pick.z - s.at[2];
    const L = Math.hypot(dx, dz);
    s.yaw = Math.atan2(dx, dz);
    if (L > LUNGE_STOP) U.moves.push({ by: s.id, ability: 'lunge', dir: [dx / L, 0, dz / L], speed: (L - LUNGE_STOP) / STRIKE.hit, until: now + STRIKE.hit, reach: 0, hit: new Set(), spec: { targets: [] } });
  }
  s.act = { clip: STRIKES[(s.strikes - 1) % STRIKES.length], since: now, id: 'strike' };
  U.swings.push({ by: s.id, at: now + STRIKE.hit + (rules.damage.hit.delay ?? 0), rules });
  return true;
}

// the swings' hits once each lands: every enemy in the wedge (saber2017's strikeZone), from behind with its bonus
export function stepSwings(sim) {
  const U = sim.units;
  if (!U?.swings?.length) return [];
  const out = [];
  const now = sim.time;
  U.swings = U.swings.filter((w) => {
    if (now + 1e-9 < w.at) return true;
    const s = sim.entities.get(w.by);
    if (!s?.alive) return false;
    const me = { x: s.at[0], y: s.at[1], z: s.at[2], yaw: s.yaw };
    for (const t of enemiesOf(sim, s)) {
      const z = strikeZone(w.rules.query, me, t);
      if (!z.in) continue;
      const damage = w.rules.damage.hit.damage + (z.behind ? (w.rules.damage.behind?.damage ?? 0) : 0);
      out.push({ type: 'blast', by: s.id, team: s.team, at: chestOf(t.o), kind: 'saber', hits: [{ id: t.id, damage, dir: fwd(s) }] });
      t.o.stunnedUntil = Math.max(t.o.stunnedUntil ?? -Infinity, now + (w.rules.react?.hit ?? 0.7));
    }
    return false;
  });
  return out;
}

// the end of an ability whose own event ends it (the weapon's heat or ammo)
export function endUnitWeapons(sim, s) {
  for (const a of s.abilities?.list ?? []) {
    if (!a.row.unit || !a.gun || a.phase !== 'active') continue;
    const h = a.gun.row.heat;
    const empty = a.gun.row.ammo && a.gun.mag === 0 && a.gun.mags === 0;
    if ((h && a.gun.state === 'overheated') || empty) end(s.abilities, a.slot, sim.time, 'heat');
  }
}
