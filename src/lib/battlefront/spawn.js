// Where a soldier deploys (spec catalogue 6): the stage's spawn sets are the
// map's spawn areas (`SpawnLocationFinderShapeData` polygons); the exact
// spots are the team's spawn points inside them, by priority, those clear
// of enemies first; when none is clear, the area's point furthest from the
// nearest enemy, so a living team always has somewhere. Or on a squadmate
// out of contact (squad spawn: at the first of the game's friendly spawn
// offsets round the mate that can be stood on, `squads.json`). A fresh soldier is protected a moment, and
// bots come back together, on their team's wave. Pure.
//
//   pickSpawn({ map, ids, team, enemies: [[x, z]], rand, mode }) → { at, yaw } | null
//   squadSpawn({ squad: [mates], me, enemies, now, offsets, walkable }) → { at, yaw, mate } | null
//   blocked(mate, { enemies, now }) → null | 'none' | 'dead' | 'oob' | 'vehicle' | 'airborne' | 'combat' | 'other'
//   protect(entity, now)    waves(now) → the next wave's time

import SQUADS from '../../data/bf2017/squads.json';
import { spawnsFor } from './rulebook.js';
import { centroid, insidePolygon } from './modes/objectives.js';

// The game's rule, by hand: a spot this far from every enemy is safe to deploy on.
export const SAFE = 30;
// How far every enemy must be from a squadmate to spawn on them: the record's
// SpawnSafeEnemyDistance (squads.json's `safeEnemyDistance`). Its being a
// reason the mate is "in combat" is by hand (NOTES.md).
export const SQUAD_SAFE = SQUADS.rows.safeEnemyDistance;
// Where round a squadmate a squad spawn lands, in turn: [right, ahead] in
// metres (squads.json, the spawn manager's friendly position table).
export const OFFSETS = SQUADS.rows.offsets;
// How far behind a squadmate a squad spawn lands first: the table's first spot.
export const BEHIND = -OFFSETS[0][1];
// How long a soldier hit, or hitting, is in combat (no spawning on them), by
// hand: the game names what puts a soldier in combat (squads.json's
// `inCombat` killswitches) but keeps no time for it.
export const IN_COMBAT = 5;
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

// why a squadmate cannot be spawned on now, or null
export function blocked(mate, { enemies = [], now = 0 } = {}) {
  if (!mate) return 'none';
  if (!mate.alive) return 'dead';
  if (mate.kind && mate.kind !== 'soldier') return 'other';
  if (mate.oobSince != null) return 'oob';
  if (mate.vehicle) return 'vehicle';
  if (mate.cls?.cls === 'aerial') return 'airborne';
  if (now - (mate.combatAt ?? -Infinity) < IN_COMBAT - 1e-9 || (mate.suppressed ?? 0) > 0) return 'combat';
  if (nearest([mate.at[0], mate.at[2]], enemies) < SQUAD_SAFE) return 'combat';
  if (mate.state === 'roll') return 'other';
  return null;
}

// a squadmate's [right, ahead] offset in the world, the mate facing yaw (+Z ahead at yaw 0, the right −X)
const around = (m, [x, y]) => [m.at[0] + y * Math.sin(m.yaw) - x * Math.cos(m.yaw), m.at[1], m.at[2] + y * Math.cos(m.yaw) + x * Math.sin(m.yaw)];

export function squadSpawn({ squad, me = null, enemies = [], now = 0, offsets = OFFSETS, walkable = () => true }) {
  for (const m of squad) {
    if (!m || m.id === me || blocked(m, { enemies, now })) continue;
    for (const o of offsets) {
      const at = around(m, o);
      if (walkable(at[0], at[2])) return { at, yaw: m.yaw, mate: m.id };
    }
  }
  return null;
}

export function protect(entity, now) {
  entity.safeUntil = now + SPAWN_PROTECTION;
}

export const isProtected = (entity, now) => (entity.safeUntil ?? -Infinity) > now;

// the next wave at or after now
export const waves = (now) => Math.max(0, Math.ceil(now / WAVE - 1e-9)) * WAVE;
