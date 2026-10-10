// Where a soldier deploys (spec catalogue 6): the stage's spawn sets are the
// map's spawn areas (`SpawnLocationFinderShapeData` polygons); the exact
// spots are the team's spawn points inside them, by priority, those clear
// of enemies first; when none is clear, the area's point furthest from the
// nearest enemy, so a living team always has somewhere. Or on a squadmate
// out of contact (squad spawn). A fresh soldier is protected a moment, and
// bots come back together, on their team's wave. Pure.
//
//   pickSpawn({ map, ids, team, enemies: [[x, z]], rand, mode }) → { at, yaw } | null
//   squadSpawn({ squad: [mates], me, enemies }) → { at, yaw, mate } | null
//   protect(entity, now)    waves(now) → the next wave's time

import { spawnsFor } from './rulebook.js';
import { centroid, insidePolygon } from './modes/objectives.js';

// The game's rule, by hand: a spot this far from every enemy is safe to deploy on.
export const SAFE = 30;
// How far behind a squadmate a squad spawn lands, by hand.
export const BEHIND = 1.5;
// Spawn protection, by hand: bolts pass a fresh soldier until it fires or this runs out.
export const SPAWN_PROTECTION = 3;
// Bots come back together every this many seconds, by hand.
export const WAVE = 10;

const nearest = (p, enemies) => enemies.reduce((m, e) => Math.min(m, Math.hypot(e[0] - p[0], e[1] - p[1])), Infinity);

// the team's spawn points inside the set's areas, cached on the map by set
const cache = new WeakMap();
function pointsIn(map, ids, team, mode) {
  let byKey = cache.get(map);
  if (!byKey) cache.set(map, (byKey = new Map()));
  const key = `${mode}|${team}|${ids.join(',')}`;
  if (byKey.has(key)) return byKey.get(key);
  const areas = spawnsFor(map, { mode, ids }).filter((p) => p.points);
  const points = spawnsFor(map, { mode, team }).filter((s) => s.at && areas.some((a) => insidePolygon(a.points, s.at[0], s.at[2])));
  const out = { areas, points };
  byKey.set(key, out);
  return out;
}

export function pickSpawn({ map, ids, team, enemies = [], rand = Math.random, mode = 'galacticAssault' }) {
  const { areas, points } = pointsIn(map, ids, team, mode);
  const safe = points.filter((s) => nearest([s.at[0], s.at[2]], enemies) >= SAFE);
  if (safe.length) {
    const top = Math.max(...safe.map((s) => s.priority ?? 0));
    const best = safe.filter((s) => (s.priority ?? 0) === top);
    const s = best[Math.floor(rand() * best.length)];
    return { at: [...s.at], yaw: s.yaw ?? 0 };
  }
  // nowhere safe: of the areas' corners, middles and spots, the one furthest from the nearest enemy
  const spots = [...points.map((s) => ({ at: [s.at[0], s.at[2]], y: s.at[1], yaw: s.yaw ?? 0 }))];
  for (const a of areas) {
    for (const p of a.points) spots.push({ at: p, y: a.y ?? 0, yaw: 0 });
    spots.push({ at: centroid(a.points), y: a.y ?? 0, yaw: 0 });
  }
  if (!spots.length) return null;
  let best = spots[0];
  let far = -1;
  for (const s of spots) {
    const d = nearest(s.at, enemies);
    if (d > far) {
      far = d;
      best = s;
    }
  }
  return { at: [best.at[0], best.y, best.at[1]], yaw: best.yaw };
}

export function squadSpawn({ squad, me = null, enemies = [] }) {
  for (const m of squad) {
    if (!m?.alive || m.id === me || m.kind !== 'soldier' || m.state === 'roll') continue;
    if ((m.suppressed ?? 0) > 0) continue;
    if (nearest([m.at[0], m.at[2]], enemies) < SAFE) continue;
    return { at: [m.at[0] - Math.sin(m.yaw) * BEHIND, m.at[1], m.at[2] - Math.cos(m.yaw) * BEHIND], yaw: m.yaw, mate: m.id };
  }
  return null;
}

export function protect(entity, now) {
  entity.safeUntil = now + SPAWN_PROTECTION;
}

export const isProtected = (entity, now) => (entity.safeUntil ?? -Infinity) > now;

// the next wave at or after now
export const waves = (now) => Math.max(0, Math.ceil(now / WAVE - 1e-9)) * WAVE;
