// Where a soldier deploys (spec catalogue 6; bf2-re finding 27 §4): the
// stage's spawn sets are the map's spawn areas (`SpawnLocationFinderShapeData`
// polygons) and spawn points (`AlternateSpawnEntityData`) the mode prefab's
// stage ports enable (the stage file's `spawns` and `points`,
// scripts/bf2017-stages.mjs). The spot is the spawn location finder's pick
// (`SpawnLocationFinderEntityData`, squads.json's `finder`): every candidate
// with an enemy inside `SpawnSafeEnemyDistance` (50 m) is rejected, the rest
// are scored by what is near them, `FriendlyWeight` −1 a friendly,
// `EnemyWeight` −2 an enemy, `DeathWeight` −50 a death of the last
// `DeathRememberDuration` 10 s, `SpawnWeight` −100 a spawn of the last
// `SpawnRememberDuration` 10 s, and of the best, one facing the front
// (`DirectionAngleThreshold` 0.5 within `DirectionCheckMaxRange` 200 m).
// When none is safe, the spot furthest from the nearest enemy, so a living
// team always has somewhere (by hand). Or on a squadmate out of contact
// (squad spawn: the game's friendly spawn offsets round the mate, tried in
// turn, the table moved back `FriendlySpawnPositionAttemptOffset` for each
// further attempt). A fresh soldier is protected a moment, and bots come
// back together, on their team's wave. Pure.
//
//   pickSpawn({ map, ids, points, team, enemies, friendlies, memory, now, front, rand, mode }) → { at, yaw } | null
//   createMemory()    remember(memory, 'death' | 'spawn', [x, z], now)    (the finder's recent deaths and spawns)
//   scoreSpot(at, { enemies, friendlies, memory, now }) → number | -Infinity (rejected)
//   squadSpawn({ squad: [mates], me, enemies, now, offsets, walkable }) → { at, yaw, mate } | null
//   blocked(mate, { enemies, now }) → null | 'none' | 'dead' | 'oob' | 'vehicle' | 'airborne' | 'combat' | 'other'
//   protect(entity, now)    waves(now) → the next wave's time

import SQUADS from '../../data/bf2017/squads.json';
import { spawnsFor } from './rulebook.js';
import { centroid, insidePolygon } from './modes/objectives.js';

export const FINDER = SQUADS.rows.finder;
// No enemy inside this of a spot: the record's SpawnSafeEnemyDistance (a hard
// reject in the finder, and the reason a squadmate counts as in combat).
export const SAFE = SQUADS.rows.safeEnemyDistance;
export const SQUAD_SAFE = SAFE;
// How near a friendly, an enemy, a death or a spawn must be to weigh on a
// spot: the record scores a cell grid and keeps no radius; 10 m by hand.
export const NEAR_RADIUS = 10;
// Where round a squadmate a squad spawn lands, in turn: [right, ahead] in
// metres (squads.json, the spawn manager's friendly position table).
export const OFFSETS = SQUADS.rows.offsets;
// The table's shift for each further attempt (the record's (0, 0, −6): 6 m further behind), and how many attempts.
export const ATTEMPT_OFFSET = [SQUADS.rows.attemptOffset[0], SQUADS.rows.attemptOffset[2]];
export const ATTEMPTS = SQUADS.rows.attempts;
// How far behind a squadmate a squad spawn lands first: the table's first spot.
export const BEHIND = -OFFSETS[0][1];
// How long a soldier hit, or hitting, is in combat (no spawning on them), by
// hand: the game names what puts a soldier in combat (squads.json's
// `inCombat` killswitches) but keeps no time for it.
export const IN_COMBAT = 5;
// Spawn protection, by hand: bolts pass a fresh soldier until it fires or this runs out.
export const SPAWN_PROTECTION = 3;
// Bots come back together every this many seconds, by hand (the BattleAI
// model's wave; the AutoPlayer model paces its waves by ai/waves.js).
export const WAVE = 10;

const nearest = (p, enemies) => enemies.reduce((m, e) => Math.min(m, Math.hypot(e[0] - p[0], e[1] - p[1])), Infinity);
const within = (p, list, r) => list.reduce((n, e) => n + (Math.hypot(e[0] - p[0], e[1] - p[1]) <= r ? 1 : 0), 0);

// the finder's memory of recent deaths and spawns
export const createMemory = () => ({ deaths: [], spawns: [] });

export function remember(memory, kind, at, now) {
  const list = kind === 'death' ? memory.deaths : memory.spawns;
  const keep = kind === 'death' ? FINDER.deathRemember : FINDER.spawnRemember;
  list.push({ at: [at[0], at[1]], t: now });
  while (list.length && now - list[0].t > keep) list.shift();
  if (kind === 'spawn') while (list.length > FINDER.spawnsRemembered) list.shift();
}

const recent = (memory, kind, now) => {
  if (!memory) return [];
  const list = kind === 'death' ? memory.deaths : memory.spawns;
  const keep = kind === 'death' ? FINDER.deathRemember : FINDER.spawnRemember;
  return list.filter((d) => now - d.t <= keep).map((d) => d.at);
};

export function scoreSpot(at, { enemies = [], friendlies = [], memory = null, now = 0 } = {}) {
  if (nearest(at, enemies) < SAFE) return -Infinity;
  return (
    0 +
    within(at, friendlies, NEAR_RADIUS) * FINDER.friendlyWeight +
    within(at, enemies, NEAR_RADIUS) * FINDER.enemyWeight +
    within(at, recent(memory, 'death', now), NEAR_RADIUS) * FINDER.deathWeight +
    within(at, recent(memory, 'spawn', now), NEAR_RADIUS) * FINDER.spawnWeight
  );
}

// a spot's facing against the direction to the front: the record's cosine threshold, inside its range
function facesFront(s, front) {
  if (!front) return true;
  const dx = front[0] - s.at[0];
  const dz = front[1] - s.at[1];
  const d = Math.hypot(dx, dz);
  if (d > FINDER.directionRange || d < 1e-6) return true;
  return (Math.sin(s.yaw) * dx + Math.cos(s.yaw) * dz) / d >= FINDER.directionThreshold;
}

// the team's spawn points inside the set's areas, cached on the map by set
const cache = new WeakMap();
function pointsIn(map, ids, team, mode, pointIds) {
  let byKey = cache.get(map);
  if (!byKey) cache.set(map, (byKey = new Map()));
  const key = `${mode}|${team}|${ids.join(',')}|${pointIds ? pointIds.join(',') : ''}`;
  if (byKey.has(key)) return byKey.get(key);
  const areas = spawnsFor(map, { mode, ids }).filter((p) => p.points);
  const points = pointIds ? spawnsFor(map, { mode, ids: pointIds }).filter((s) => s.at) : spawnsFor(map, { mode, team }).filter((s) => s.at && areas.some((a) => insidePolygon(a.points, s.at[0], s.at[2])));
  const out = { areas, points };
  byKey.set(key, out);
  return out;
}

export function pickSpawn({ map, ids, points: pointIds = null, team, enemies = [], friendlies = [], memory = null, now = 0, front = null, rand = Math.random, mode = 'galacticAssault' }) {
  const { areas, points } = pointsIn(map, ids, team, mode, pointIds);
  const spots = points.map((s) => ({ at: [s.at[0], s.at[2]], y: s.at[1], yaw: s.yaw ?? 0, priority: s.priority ?? 0 }));
  const scored = spots.map((s) => ({ s, score: scoreSpot(s.at, { enemies, friendlies, memory, now }) })).filter((x) => x.score > -Infinity);
  if (scored.length) {
    // the record's priority first, then the finder's score, then the front
    const top = Math.max(...scored.map((x) => x.s.priority));
    const ranked = scored.filter((x) => x.s.priority === top);
    const best = Math.max(...ranked.map((x) => x.score));
    let pool = ranked.filter((x) => x.score >= best - 1e-9).map((x) => x.s);
    const facing = pool.filter((s) => facesFront(s, front));
    if (facing.length) pool = facing;
    const s = pool[Math.floor(rand() * pool.length)];
    return { at: [s.at[0], s.y, s.at[1]], yaw: s.yaw };
  }
  // nowhere safe: of the areas' corners, middles and spots, the one furthest from the nearest enemy
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

export function squadSpawn({ squad, me = null, enemies = [], now = 0, offsets = OFFSETS, attempts = ATTEMPTS, walkable = () => true }) {
  for (const m of squad) {
    if (!m || m.id === me || blocked(m, { enemies, now })) continue;
    for (let k = 0; k < attempts; k++) {
      for (const o of offsets) {
        const at = around(m, [o[0] + k * ATTEMPT_OFFSET[0], o[1] + k * ATTEMPT_OFFSET[1]]);
        if (walkable(at[0], at[2])) return { at, yaw: m.yaw, mate: m.id };
      }
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
