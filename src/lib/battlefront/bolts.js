// Bolts are projectiles, not hitscan (spec catalogue 2): each moves its
// speed a step and its whole segment is swept against the bodies' capsules
// (`lib/combat/bolt.js`'s segCapsule) and the navgrid's solids and ground
// (`nav.firstSolid`); the nearest wins. A bolt that passes within `NEAR` of
// an enemy is a near miss, which is what suppresses a bot. Friendly bodies
// are passed through. Pure.
//
//   createBolts() → bolts
//   fire(bolts, { from, dir, speed, range, ttl, team, owner, weapon, colour, now }) → bolt
//   step(bolts, dt, { bodies: [{ id, team, alive, safe, at, capsules }], nav, now }) → events   (a `safe` body is passed through)
//     { type: 'hit', bolt, target, part, at, dir, dist } | { type: 'wall', bolt, at } |
//     { type: 'near', bolt, target, dist } | { type: 'gone', bolt }
//   (a bolt a wall or a body stops is left `ended`, its `at` and `travelled`
//   where it stopped; `bolts.left` is the step's let go of, fired in it or before)

import { segCapsule } from '../combat/bolt.js';
import { firstSolid } from './nav.js';

// How close a bolt passes an enemy to count as a near miss (suppression):
// the tactics' WeaponSuppressionSettings.SuppressionArea is the area a
// suppressor covers (5 m), not this; the game's by observation.
export const NEAR = 2;
// Bodies further than this from a bolt's segment are not looked at closely.
const BROAD = 3;

export const createBolts = () => ({ list: [], next: 1, left: [] });

export function fire(bolts, { from, dir, speed, range = 200, ttl = 3, team, owner, weapon = null, colour = null, now = 0 }) {
  const bolt = { id: bolts.next++, at: [...from], from: [...from], dir: [...dir], speed, range, ttl, team, owner, weapon, colour, born: now, travelled: 0, near: null };
  bolts.list.push(bolt);
  return bolt;
}

// the distance from p to segment a→b, and the fraction along it
function pointSeg(p, a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const t = L < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / L));
  return Math.hypot(a[0] + d[0] * t - p[0], a[1] + d[1] * t - p[1], a[2] + d[2] * t - p[2]);
}

// a bolt stopped this step keeps where (and how far on) it stopped: the page
// draws it there though the sim has let it go
function end(bolt, at, len) {
  bolt.at = at.slice();
  bolt.travelled += len;
  bolt.ended = true;
}

export function step(bolts, dt, { bodies, nav, now = 0 }) {
  const events = [];
  const keep = [];
  const left = [];
  for (const bolt of bolts.list) {
    const len = Math.min(bolt.speed * dt, bolt.range - bolt.travelled);
    const a = bolt.at;
    const b = [a[0] + bolt.dir[0] * len, a[1] + bolt.dir[1] * len, a[2] + bolt.dir[2] * len];
    const wall = nav ? firstSolid(nav, a, b) : null;
    let hit = null;
    for (const body of bodies) {
      if (!body.alive || body.safe || body.team === bolt.team || body.id === bolt.owner) continue;
      const mid = body.capsules[1] ?? body.capsules[0];
      const off = pointSeg(mid.a, a, b);
      if (off > BROAD) continue;
      for (const c of body.capsules) {
        const h = segCapsule(a, b, c.a, c.b, c.r);
        if (h && (!hit || h.t < hit.t)) hit = { t: h.t, at: h.at, target: body.id, part: c.part };
      }
    }
    if (hit && (!wall || hit.t <= wall.t)) {
      events.push({ type: 'hit', bolt, target: hit.target, part: hit.part, at: hit.at, dir: bolt.dir, dist: bolt.travelled + hit.t * len });
      end(bolt, hit.at, hit.t * len);
      left.push(bolt);
      continue;
    }
    if (wall) {
      events.push({ type: 'wall', bolt, at: wall.at });
      end(bolt, wall.at, wall.t * len);
      left.push(bolt);
      continue;
    }
    for (const body of bodies) {
      if (!body.alive || body.team === bolt.team || body.id === bolt.owner || bolt.near?.has(body.id)) continue;
      const dist = pointSeg(body.capsules[1]?.a ?? body.at, a, b);
      if (dist > NEAR) continue;
      (bolt.near ??= new Set()).add(body.id);
      events.push({ type: 'near', bolt, target: body.id, dist });
    }
    bolt.at = b;
    bolt.travelled += len;
    if (bolt.travelled >= bolt.range - 1e-9 || now - bolt.born >= bolt.ttl) {
      events.push({ type: 'gone', bolt });
      left.push(bolt);
      continue;
    }
    keep.push(bolt);
  }
  bolts.list = keep;
  bolts.left = left;
  return events;
}
