// Bolts that fly: a soldier's shot is a bolt on lib/combat/bolt.js's step
// (the one every blaster on the site flies by), swept the whole of each
// step against every body in its way and stopped by the first wall, never a
// roll of the dice. On a surface the soldiers' bolts share the scene's pool
// (blaster.js), with the soldiers as capsules (bodyOf) and a bolt passing
// close keeping a head down (nearBy); this createBolts is the same step on
// its own pool for a fight played in Node (ground.scenario.test.js), with
// a 2D line of sight for its walls. A bolt at you isn't resolved here:
// it's handed to the scene, so your dodge, your saber and your shield have
// it as ever. Past 60 m from you a fight is settled without bolts, by the
// same aim and damage (farExchange), so it comes out the same watched or
// not. Pure, tested. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, section 7.
//
// bodyOf({ id, x, y, z, r, h, side }) → a capsule body for the bolt step;
// nearBy(a, e, bodies, seen, owner) → the ids of the bodies a bolt's
// segment a → e went within NEAR of (once a bolt: `seen`);
// wallsOf(seesThrough) → the step's solids from a 2D line of sight;
// createBolts({ speed, life }) → { fire({ from: [x, y, z], dir, side, owner,
//   damage, range, target? }) → bolt, step(dt, { bodies: [{ id, x, y, z, r,
//   h, side }], seesThrough }) → events, bolts }
//   events: { type: 'hit', bolt, target, at, dir } | { type: 'wall', bolt,
//   at } | { type: 'near', bolt, target } | { type: 'atYou', bolt }
// farExchange(a, b, dt, rand, { aimError, damageOf (weapon, dist, soldier) }) → { hits: [{ from,
//   to, damage }] }

import { createBolts as boltPool } from '../../../../lib/combat/bolt';
import { cadenceOf } from './troops';

export const NEAR = 2; // metres: a bolt this near a body suppresses it
const SPREAD_MAX = 0.1; // radians of aim error past which a far shot hits one time in ten
const SPLIT = 6; // halvings to find where along a step a wall stopped a bolt

export function bodyOf(o) {
  const y = o.y ?? 0;
  const r = o.r ?? 0.45;
  const h = o.h ?? 1.8;
  return { id: o.id, a: [o.x, y + r, o.z], b: [o.x, y + Math.max(r, h - r), o.z], r, side: o.side ?? 'none', ref: o.ref ?? o };
}

// the bodies a bolt's way this frame went close by, once a bolt
export function nearBy(a, e, bodies, seen, owner = null) {
  const out = [];
  const dx = e[0] - a[0];
  const dz = e[2] - a[2];
  const seg = dx * dx + dz * dz;
  for (const o of bodies) {
    const x = o.x ?? o.a?.[0];
    const z = o.z ?? o.a?.[2];
    if (o.id === owner || seen.has(o.id) || x === undefined) continue;
    const t = seg > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / seg)) : 0;
    const px = a[0] + dx * t - x;
    const pz = a[2] + dz * t - z;
    if (px * px + pz * pz < NEAR * NEAR) {
      seen.add(o.id);
      out.push(o.id);
    }
  }
  return out;
}

// a 2D line of sight as the bolt step's solids: where along a → b the line
// first fails, halved down to the spot
export function wallsOf(seesThrough) {
  if (!seesThrough) return () => null;
  return (a, b) => {
    if (seesThrough({ x: a[0], z: a[2] }, { x: b[0], z: b[2] })) return null;
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < SPLIT; k++) {
      const m = (lo + hi) / 2;
      if (seesThrough({ x: a[0], z: a[2] }, { x: a[0] + (b[0] - a[0]) * m, z: a[2] + (b[2] - a[2]) * m })) lo = m;
      else hi = m;
    }
    return { at: [a[0] + (b[0] - a[0]) * hi, a[1] + (b[1] - a[1]) * hi, a[2] + (b[2] - a[2]) * hi], normal: null };
  };
}

export function createBolts({ speed = 90, life = 2, pool = 96 } = {}) {
  const lib = boltPool({ pool });
  const bolts = [];
  const world = { solids: null, bodies: [], blades: [] };
  return {
    bolts,
    fire({ from, dir, side = null, owner = null, damage = 10, range = 100, target = null }) {
      const b = lib.fire({ from, dir, speed, range: Math.min(range, speed * life), owner, side: side ?? 'none', damage, tag: { target, near: new Set() } });
      bolts.push(b);
      return b;
    },
    step(dt, { bodies = [], seesThrough = null } = {}) {
      const events = [];
      // (at you: the scene's to fly, through your dodge and your blade)
      for (let i = bolts.length - 1; i >= 0; i--) {
        if (bolts[i].tag?.target !== 'you') continue;
        const b = bolts[i];
        bolts.splice(i, 1);
        b.alive = false;
        events.push({ type: 'atYou', bolt: b });
      }
      world.solids = wallsOf(seesThrough);
      world.bodies = bodies.map(bodyOf);
      const was = new Map(bolts.map((b) => [b, b.pos.slice()]));
      for (const e of lib.step(dt, world)) {
        const b = e.bolt;
        if (e.type === 'hit') events.push({ type: 'hit', bolt: b, target: e.body.id, at: e.at, dir: [...b.dir] });
        else if (e.type === 'solid') events.push({ type: 'wall', bolt: b, at: e.at });
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        for (const id of nearBy(was.get(b), b.pos, bodies, b.tag.near, b.owner)) if (!(b.alive === false && id === events.find((e) => e.bolt === b && e.type === 'hit')?.target)) events.push({ type: 'near', bolt: b, target: id });
        if (!b.alive) bolts.splice(i, 1);
      }
      return events;
    },
  };
}

// two squads settling a fight out of your sight: each soldier's shots fall
// due by its gun's cadence, each at someone of the other side still up,
// landing as often as its aim error says
export function farExchange(a, b, dt, rand, { aimError, damageOf }) {
  const hits = [];
  const side = (mine, theirs) => {
    const up = theirs.filter((s) => s.alive);
    for (const s of mine) {
      if (!s.alive || !s.weapon || !up.length) continue;
      s.farCool = (s.farCool ?? rand() * cadenceOf(s.weapon)) - dt;
      while (s.farCool <= 0) {
        s.farCool += cadenceOf(s.weapon);
        const v = up[Math.floor(rand() * up.length) % up.length];
        const dist = Math.hypot(v.b.x - s.b.x, v.b.z - s.b.z);
        const err = aimError(s, { x: v.b.x, z: v.b.z, vel: null }, dist, {});
        if (rand() < 1 - Math.min(0.9, Math.max(0, err / SPREAD_MAX))) hits.push({ from: s.id, to: v.id, damage: damageOf(s.weapon, dist, s) });
      }
    }
  };
  side(a, b);
  side(b, a);
  return { hits };
}
