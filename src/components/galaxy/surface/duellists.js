// The quests' duellists: a spawn with a blade (`hostile.blade`) on the 2017
// game's rig fences. Its mind is lib/combat/duel.js's (close, circle, strike,
// recover; hold its block for a strike of yours that would reach it, while
// its stamina lasts; reel); its body activity.js's rigged crew figure, the
// saber in its own hand (heldBlade.js's bladeInHand, on saber.js), so its
// strikes are its hero's strokes, and what lands is the game's rules, each
// saber's own engine (lib/combat/saber2017.js): yours and theirs meet in
// them. Wiring beside activity.js, kept apart so that file doesn't grow.
//
//   duelFor(spec, seed, hero?) → its mind (createDuellist), from the spawn's
//     hostile: reach, parry (the share of your strikes it holds its block for);
//     hero (its crew row, by the spawn's kind): its stroke table's strikes at
//     their cadence (gameStance.js's stanceFor)
//   asTarget() → you as their blades see you ({ holder, fig, you: true, yaw, sim }:
//     what saber.js's engine and lock read); .at(st, sim?) moves it, your saber's
//     engine with it
//   engaged(t, dist) → whether it fences its mark now (within ENGAGE once it
//     has it, until LEAVE)
//   stepDuel(t, mark, dt, time, world) → whether its feet are going: its
//     mind's step, its strike begun (or dropped: its mark gone), its block
//     (t.blocking, and t.blockSide: the side of it your strike comes in on,
//     blockSide.js's), its feet. mark: { x, z, yaw, target (what its blade may
//     hit), swinging (yours, swingingOf's, when the mark is you), out (your
//     stamina spent), dead }
//   fence(t, aim, { you, swinging, out }, dt, time, world) → whether its feet are
//     going, while it fences its mark (aim: activity.js's hostileAim; you:
//     asTarget's); null when it doesn't, its mind stood down (it hunts then)
//   swingingOf(saber, now, yaw?) → your strike as its mind reads it ({ contact,
//     t, speed, cut (the side it cuts from: blockSide.js's cutOf), yaw (where you
//     face), query (your rules') }, `t` seconds into the clip) or null
//   incomingAt(targets, you) → the side of you ('left' | 'right' | null) the
//     nearest duellist's strike at you comes in on (your block's: scene.js);
//     you: { x, z, yaw }
//   landed(t, target, damage, at, { behind, region }) → the contact's record for
//     the scene, when the target is you ({ melee, blade, game (the game's
//     damage, landed: your hero's health counts it), behind, region, point,
//     from, who }); null for anyone else
//   recoiled(t, target, at, how) → the record of its strike met on your block or
//     in a clash ({ melee, blade, met: how, point, who }) for the scene's sparks
//   stun(t, secs, next) → it reels: its mind staggered (then `next`), its
//     strike dropped, its block let down; reeling(t, dt) while the body reels
//     (activity.js's t.stagger), its mind's clock with it
//   met(c, { saber, me, now, health }) → a brawler's swipe (no blade of the game's)
//     on you, met by your block: the swipe is the AI's melee projectile
//     (the rulebook's ai.melee), so a block's shield turns one from the front:
//     { how ('block' | 'hit'), damage (what lands) }

import { duelStep, swung, createDuellist, onStagger } from '../../../lib/combat/duel';
import { lungePick, shieldHit, strikeZone } from '../../../lib/combat/saber2017';
import { cutOf, incomingSide } from './blockSide';
import { CREW } from './crewList';
import { stanceFor } from './gameStance';
import { shoreStep, turnToward } from './walker';

export const ENGAGE = 10; // m: within this of the mark it has, it fences
export const LEAVE = 14; // m: past this it hunts you as the others do (hostiles.js)
const TURN = 6; // rad/s it squares up to you between strikes
const CHEST = 1.2; // m: where a swipe meets you

export function duelFor(spec, seed = 1, hero = CREW[spec.kind] ?? null) {
  const h = spec.hostile;
  const stance = h.blade?.stance ?? 'single';
  // (its hero's strikes, at their cadence: stanceFromTable.js)
  const st = stanceFor(stance, hero);
  return createDuellist({ reach: h.reach ?? 2.4, guard: h.parry ?? 0.6, stance, strokes: st?.strokes.map((k) => k.clip) ?? null, cadence: st?.cadence ?? null, seed });
}

export function asTarget() {
  const position = { x: 0, y: 0, z: 0 };
  return {
    holder: { position },
    fig: { tall: 1.8 },
    spec: {},
    you: true,
    down: false,
    yaw: 0,
    sim: null,
    at(st, sim = this.sim) {
      position.x = st.x;
      position.y = st.y ?? 0;
      position.z = st.z;
      this.yaw = st.yaw ?? this.yaw;
      this.sim = sim;
      return this;
    },
  };
}

export function engaged(t, dist) {
  t.engaged = t.engaged ? dist <= LEAVE : Boolean(t.aim) && dist <= ENGAGE;
  return t.engaged;
}

// whether your strike's query would find it: in the strike's zone now, or in your lunge's pick
const reaches = (sw, mark, b) => {
  if (!sw?.query || mark.yaw == null) return undefined;
  const you = { x: mark.x, z: mark.z, yaw: mark.yaw };
  const it = { x: b.x, z: b.z, yaw: b.yaw };
  return strikeZone(sw.query, you, it).in || Boolean(lungePick(sw.query, you, [it]));
};

export function stepDuel(t, mark, dt, time, world) {
  const d = t.duel;
  const b = t.b;
  d.at[0] = b.x;
  d.at[1] = b.z;
  const saber = t.blade.saber;
  const swinging = mark?.swinging ? { ...mark.swinging, reaches: reaches(mark.swinging, mark, b) } : null;
  const o = duelStep(d, mark && { pos: [mark.x, mark.z], swinging, out: Boolean(mark.out), tired: saber.sim.state.out, dead: Boolean(mark.dead) }, dt);
  if (o.begin) {
    const sw = t.blade.swing(time, { clip: o.stroke, lock: mark?.target ?? null });
    if (sw) swung(d, sw.dur / sw.speed);
  } else if (!o.stroke && saber.swinging) saber.cancel(); // (its mark gone mid-strike: not at air for the rest of the clip)
  t.blocking = o.block;
  // (on the side of it your strike comes in on: it lays the game's block for it, saber.js)
  t.blockSide = o.block ? incomingSide(mark?.swinging?.cut, { from: mark?.swinging?.yaw, to: b.yaw }) : null;
  // (no mark: its feet and its facing are the hunt's, hostiles.js's)
  if (!mark) return false;
  const pace = t.hostile.chase ?? 2;
  const x = b.x + o.move[0] * pace * dt;
  const z = b.z + o.move[1] * pace * dt;
  const held = shoreStep(world, b, x, z);
  b.x = held ? held[0] : x;
  b.z = held ? held[1] : z;
  // (through a strike the saber turns it to its lock, over the wind-up)
  if (o.state !== 'attack') b.yaw = turnToward(b.yaw, o.face, dt * TURN);
  return Math.hypot(o.move[0], o.move[1]) > 0.05;
}

export function stun(t, secs, next = null) {
  if (!t.duel) return;
  onStagger(t.duel, secs, next);
  t.blade?.saber.cancel();
  t.blocking = false;
}
export function reeling(t, dt) {
  if (t.duel?.state === 'stagger') t.duel.timer -= dt;
}

export function fence(t, aim, { you, swinging = null, out = false }, dt, time, world) {
  if (!t.duel) return null;
  if (aim && engaged(t, Math.hypot(aim.x - t.b.x, aim.z - t.b.z))) {
    t.duelMark = t.victim ?? you;
    const yaw = t.victim ? (t.victim.b?.yaw ?? null) : (you?.yaw ?? null);
    const moving = stepDuel(t, { x: aim.x, z: aim.z, yaw, target: t.duelMark, swinging: t.victim ? null : swinging, out: t.victim ? false : out }, dt, time, world);
    t.aim = { x: aim.x, z: aim.z };
    t.guessed = false;
    return moving ? 1 : 0;
  }
  t.engaged = false;
  t.duelMark = null;
  stepDuel(t, null, dt, time, world); // (stood down: its strike dropped, its block let go)
  return null;
}

export function swingingOf(saber, now, yaw = null) {
  const sw = saber?.swinging;
  return sw ? { contact: sw.contact, t: (now - sw.t0) * sw.speed, speed: sw.speed, cut: cutOf(saber.stance, sw.name), yaw, query: saber.rules?.query ?? null } : null;
}

export function incomingAt(targets, you) {
  let near = null;
  let best = Infinity;
  for (const t of targets) {
    if (t.down || !t.duelMark?.you || !t.blade?.saber.swinging) continue;
    const d = Math.hypot(t.b.x - you.x, t.b.z - you.z);
    if (d < best) [near, best] = [t, d];
  }
  if (!near) return null;
  const s = near.blade.saber;
  return incomingSide(cutOf(s.stance, s.swinging.name), { from: near.b.yaw, to: you.yaw });
}

export function landed(t, target, damage, at, { behind = false, region = null } = {}) {
  if (!target?.you) return null;
  return {
    melee: true,
    blade: true,
    game: damage,
    behind,
    region,
    point: [at.x, at.y, at.z],
    from: [t.b.x, t.holder.position.y, t.b.z],
    who: t,
  };
}

export function recoiled(t, target, at, how) {
  if (!target?.you) return null;
  return { melee: true, blade: true, met: how, point: [at.x, at.y, at.z], from: [t.b.x, t.holder.position.y, t.b.z], who: t };
}

export function met(c, { saber, me, now, health = 100 }) {
  const ai = saber?.rules?.ai?.melee;
  if (saber?.sim?.deflecting && me && c.from && ai) {
    const y = me.y ?? 0;
    const hit = shieldHit(saber.rules, me, [c.from[0], c.from[1] + CHEST, c.from[2]], [me.x, y + CHEST, me.z]);
    if (hit) {
      saber.deflected(ai.damage, now);
      return { how: 'block', damage: 0 };
    }
  }
  return { how: 'hit', damage: saber?.sim ? saber.sim.taken(c.damage ?? 0, now) : (c.damage ?? 0), health };
}
