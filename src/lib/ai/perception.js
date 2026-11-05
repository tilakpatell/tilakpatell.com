// What an NPC believes about who's about, as against what's true. Every
// studio system that feels fair has this and none of the site's NPCs did:
// a belief per target (Crytek's target tracks, The Last of Us's memory
// markers) that rises along a detection timer while the target is in the
// cone, in range and in clear sight (quick up close, slow at the edge:
// Splinter Cell), holds the true position for a moment after sight is
// lost (intuition, 2–3 s: Halo, Crysis, Crackdown), then coasts along the
// last velocity and fades over the memory span to nothing. A stimulus (a
// shot heard, a running step, a door) raises a belief without sight to a
// ceiling under what sight gives. A brain aims, steers and searches by its
// belief, never by the truth. Pure.
//
//   createSenses({ sight: { range, cone, far }, hearing: { range }, smell: { range }, memory, intuition })
//     cone: the cosine of the half-angle (0.5 is 60° either side; −1 is all round); far: seconds
//     it takes at the edge of range (at the centre, at once)
//   sense(senses, me, world, dt, { seesThrough }) → me.beliefs updated
//     me: { pos, dir (unit), beliefs: {} }; world: { targets: [{ id, at, vel?, kind?, faction?, hostile? }],
//     stims?: [{ type, at, radius, from?, loudness: 0…1 }] }; seesThrough(a, b) → bool (absent: clear)
//   belief(me, id) → { id, at, vel, seenAt, heardAt, confidence, visible, kind, faction, hostile } | null
//   target(me, { hostile }) → the surest belief, or null
//   share(from, to, id, { fade }) → a sighting handed on at lower confidence
//   forget(me, id)

import { add, apart, dot } from './vec';

export function createSenses({ sight = {}, hearing = {}, smell = {}, memory = 6, intuition = 2.5 } = {}) {
  return {
    sight: { range: sight.range ?? 30, cone: sight.cone ?? 0.5, far: sight.far ?? 2 },
    hearing: { range: hearing.range ?? 12 },
    smell: { range: smell.range ?? 0 },
    memory,
    intuition,
  };
}

const fresh = (t, kind) => ({ id: t.id, at: { ...t.at }, vel: { x: 0, y: 0, z: 0 }, seenAt: -Infinity, heardAt: -Infinity, confidence: 0, visible: false, timer: 0, kind: kind ?? t.kind ?? null, faction: t.faction ?? null, hostile: t.hostile ?? true });

// (kept from call to call and cleared: sense runs for every hunter every
// frame, and a set made for each call was a frame's garbage)
const seen = new Set();
const NO_OPTS = {};

export function sense(senses, me, world, dt, { seesThrough = null } = NO_OPTS) {
  me.beliefs ??= {};
  me.now = (me.now ?? 0) + dt; // (its own clock: a brain keeps `clock` for itself)
  const now = me.now;
  seen.clear();
  for (const t of world.targets ?? []) {
    if (!t?.at) continue;
    const d = apart(t.at, me.pos);
    let sees = false;
    if (d <= senses.sight.range) {
      // (the way to it worked out in place, as unit(sub(...)) has it, not as two records)
      let facing = 1;
      if (me.dir && d > 1e-6) {
        const dx = t.at.x - me.pos.x;
        const dy = t.at.y - me.pos.y;
        const dz = t.at.z - me.pos.z;
        const l = Math.hypot(dx, dy, dz) || 1;
        facing = me.dir.x * (dx / l) + me.dir.y * (dy / l) + me.dir.z * (dz / l);
      } else if (me.dir) facing = dot(me.dir, me.dir);
      sees = facing >= senses.sight.cone && (!seesThrough || seesThrough(me.pos, t.at));
    }
    if (!sees && senses.smell.range > 0 && d <= senses.smell.range) sees = true;
    if (!sees) continue;
    seen.add(t.id);
    const b = (me.beliefs[t.id] ??= fresh(t));
    // the timer: at the edge of range `far` seconds, at the centre at once
    const takes = Math.max(0.05, senses.sight.far * (d / Math.max(1e-6, senses.sight.range)));
    b.timer = Math.min(1, b.timer + dt / takes);
    b.confidence = Math.max(b.confidence, b.timer);
    b.visible = true;
    b.seenAt = now;
    b.at = { ...t.at };
    b.vel = t.vel ? { ...t.vel } : b.vel;
    if (t.kind) b.kind = t.kind;
    if (t.hostile != null) b.hostile = t.hostile;
  }
  // heard: a stimulus inside its radius (and inside what this one can hear)
  for (const s of world.stims ?? []) {
    if (!s?.at || s.from == null) continue;
    const d = apart(s.at, me.pos);
    if (d > (s.radius ?? senses.hearing.range) || d > senses.hearing.range + (s.radius ?? 0)) continue;
    const t = (world.targets ?? []).find((o) => o.id === s.from);
    const b = (me.beliefs[s.from] ??= fresh(t ?? { id: s.from, at: s.at }));
    if (seen.has(s.from)) continue;
    const loud = Math.min(0.8, (s.loudness ?? 0.5) * 0.8);
    if (loud > b.confidence || now - b.seenAt > senses.intuition) {
      b.confidence = Math.max(b.confidence, loud);
      b.at = { ...s.at };
      b.vel = { x: 0, y: 0, z: 0 };
    }
    b.heardAt = now;
  }
  // the rest: intuition, then a coast and a fade (a for…in, not a list of
  // the keys made each call: deleting the one it's on is safe)
  for (const id in me.beliefs) {
    const b = me.beliefs[id];
    if (seen.has(id)) continue;
    b.visible = false;
    b.timer = Math.max(0, b.timer - dt / Math.max(0.05, senses.sight.far));
    const sinceSeen = now - b.seenAt;
    if (sinceSeen <= senses.intuition) {
      const t = (world.targets ?? []).find((o) => o.id === id);
      if (t?.at) {
        b.at = { ...t.at };
        if (t.vel) b.vel = { ...t.vel };
      }
      continue;
    }
    b.at = add(b.at, b.vel, dt);
    b.confidence = Math.max(0, b.confidence - dt / Math.max(1e-6, senses.memory));
    if (b.confidence <= 0) delete me.beliefs[id];
  }
}

export const belief = (me, id) => me?.beliefs?.[id] ?? null;

// (hostile: true for enemies only, false for friends only, null for anyone)
export function target(me, { hostile = true } = {}) {
  let best = null;
  for (const b of Object.values(me?.beliefs ?? {})) {
    if (hostile != null && Boolean(b.hostile) !== hostile) continue;
    if (!best || b.confidence > best.confidence || (b.confidence === best.confidence && b.seenAt > best.seenAt)) best = b;
  }
  return best;
}

export function share(from, to, id, { fade = 0.6 } = {}) {
  const b = belief(from, id);
  if (!b) return null;
  to.beliefs ??= {};
  const mine = to.beliefs[id];
  const c = b.confidence * fade;
  if (mine && mine.confidence >= c) return mine;
  to.beliefs[id] = { ...b, at: { ...b.at }, vel: { ...b.vel }, confidence: c, visible: false, timer: 0, seenAt: -Infinity };
  return to.beliefs[id];
}

export function forget(me, id) {
  if (me?.beliefs) delete me.beliefs[id];
}
