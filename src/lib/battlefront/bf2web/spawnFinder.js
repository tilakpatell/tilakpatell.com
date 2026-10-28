// Where a soldier respawns, as bf2-web chooses it (WebPort/physics/player/spawn-finder.{h,cpp}): the level's spawn
// points and zones (Hoth: Levels/MP/Hoth_01/TeamDeathmatch_Global, 44 AlternateSpawnEntityData and 8
// SpawnLocationFinderShapeData) picked as ServerSpawnLocationFinderEntity picks them, recovered from the retail
// binary (bf2-web's arcade-flow notes, 3.2 and 11.1). A request first lets the expired memories go, then takes the
// zone with the best score (its base from the memories, -1 a friend and -2 an enemy standing in it), then in that
// zone the point with the fewest blockers (a soldier within 1.5 m of its eye, a recent spawn's ghost), then the
// fewest enemies who can see it, then the farthest nearest enemy, taking at once a point that is clear and has no
// enemy within 100 m. A spawn costs the other team 100 in the point's zones for 10 s; a death costs the victim's own
// team up to 50 around the body, less the longer it lived. bf2-web counts in float and int, and so does this
// (spawnFinder.test.js replays its driver). Pure.
//
//   createSpawnFinder(zones, points, config?) → finder
//     zones: [{ team, enabled, polygon: [x0, z0, x1, z1, …] }]   points: [{ team, enabled, position: [x, y, z] }]
//   choose(finder, team, influences, now, rayBlocked?) → { point, zone, nearest, blockers, seen, accepted, zoneScore }
//     influences: [{ team, position: [x, y, z], facing: [x, z] | null }]   rayBlocked(from, to) → true when something is between
//   onDeath(finder, team, position, aliveSeconds, now)
//   zoneMaskAt(finder, x, z) → BigInt   pointZoneMask(finder, i) → BigInt   zoneBase(finder, zone, team) → int

const f = Math.fround;
const FLT_MAX = 3.4028234663852886e38;

// SpawnLocationFinderEntityData (SpawnManager_Shared_MP's record) and the code's constants
export const SPAWN_FINDER = {
  friendlyWeight: -1, enemyWeight: -2, deathWeight: -50, spawnWeight: -100,
  deathWeightTimeout: 20, deathRememberDuration: 10, spawnRememberDuration: 10,
  spawnPointCheckRadius: 1.5, spawnSafeEnemyDistance: 50, spawnerHeightOffset: 2,
  directionCheckMaxRange: 200, directionAngleThreshold: 0.5,
  previousSpawnsRemembered: 40, lastSpawnPointGhostCount: 40, ghostDecay: 1,
  // m²: a point this clear of enemies is taken at once
  acceptNearest: 10000,
};

// TeamInfo::isFriendly as the finder asks it: 1 the same team, 2 two different playing teams, 0 otherwise
const friendly = (a, b) => (a === 0 || b === 0 ? 0 : a === b ? 1 : 2);
const bit = (z) => 1n << BigInt(z);

// A closed polygon in x/z, by the even-odd rule, in float as the C++ has it
function inside(polygon, x, z) {
  const n = polygon.length / 2;
  let isIn = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[2 * i], zi = polygon[2 * i + 1], xj = polygon[2 * j], zj = polygon[2 * j + 1];
    if (zi > z !== zj > z && x < f(f(f(f(xj - xi) * f(z - zi)) / f(zj - zi)) + xi)) isIn = !isIn;
  }
  return isIn;
}

const v3 = (p) => [f(p[0]), f(p[1]), f(p[2])];

export function createSpawnFinder(zones, points, config = {}) {
  const cfg = { ...SPAWN_FINDER, ...config };
  for (const k of ['deathWeightTimeout', 'deathRememberDuration', 'spawnRememberDuration', 'spawnPointCheckRadius', 'spawnSafeEnemyDistance',
    'spawnerHeightOffset', 'directionCheckMaxRange', 'directionAngleThreshold', 'acceptNearest']) cfg[k] = f(cfg[k]);
  const finder = {
    config: cfg,
    zones: zones.map((z) => ({ team: z.team, enabled: z.enabled !== false, polygon: z.polygon.map(f) })),
    points: points.map((p) => ({ team: p.team, enabled: p.enabled !== false, position: v3(p.position) })),
    // each zone's base for teams 1 and 2, zeroed when the zone records are built
    base: zones.map(() => [0, 0]),
    memories: [],
    // the recent spawns, newest first
    recent: [],
  };
  finder.masks = finder.points.map((p) => zoneMaskAt(finder, p.position[0], p.position[2]));
  return finder;
}

export function zoneMaskAt(finder, x, z) {
  let mask = 0n;
  finder.zones.forEach((zone, k) => {
    if (k < 64 && inside(zone.polygon, f(x), f(z))) mask |= bit(k);
  });
  return mask;
}

export const pointZoneMask = (finder, i) => finder.masks[i];
export const zoneBase = (finder, zone, team) => finder.base[zone][team - 1];

// queue the memory and add its weight to the team's base in each zone of the mask
function add(finder, team, mask, weight, duration, now) {
  if (!(duration > 0) || team < 1 || team > 2) return;
  finder.memories.push({ expire: f(now + duration), mask, weight, team });
  finder.zones.forEach((_, z) => {
    if (z < 64 && mask & bit(z)) finder.base[z][team - 1] += weight;
  });
}

// the first step of every request: a memory past its expiry gives its weight back
function expire(finder, now) {
  finder.memories = finder.memories.filter((m) => {
    if (!(m.expire < now)) return true;
    finder.zones.forEach((_, z) => {
      if (z < 64 && m.mask & bit(z)) finder.base[z][m.team - 1] -= m.weight;
    });
    return false;
  });
}

// The victim's own team loses up to DeathWeight in the zones round the body for DeathRememberDuration, scaled down
// the longer it lived (1 - alive / DeathWeightTimeout; nothing once that is spent)
export function onDeath(finder, team, position, aliveSeconds, now) {
  const cfg = finder.config;
  let k = 1;
  if (cfg.deathWeightTimeout > 0) {
    k = f(1 - f(f(aliveSeconds) / cfg.deathWeightTimeout));
    if (!(k > 0)) return;
  }
  add(finder, team, zoneMaskAt(finder, position[0], position[2]), Math.trunc(f(cfg.deathWeight * k)), cfg.deathRememberDuration, f(now));
}

export function choose(finder, team, influences, now, rayBlocked = null) {
  const cfg = finder.config;
  now = f(now);
  expire(finder, now);
  const choice = { point: -1, zone: -1, nearest: 0, blockers: 0xff, seen: 0xff, accepted: false, zoneScore: 0 };
  const usable = (p) => {
    const s = finder.points[p];
    return s.enabled && (s.team === 0 || s.team === team);
  };
  const near = influences.map((i) => ({ team: i.team, position: v3(i.position), facing: i.facing ? [f(i.facing[0]), f(i.facing[1])] : null }));
  // the zone: each valid zone scored by its base and the soldiers in it; the best strictly wins
  const score = finder.zones.map(() => 0);
  let best = -32768;
  finder.zones.forEach((zone, z) => {
    if (z >= 64) return;
    const any = finder.points.some((_, p) => finder.masks[p] & bit(z) && usable(p));
    if (!((zone.team === 0 || zone.team === team) && zone.enabled && any)) return;
    let s = finder.base[z][team - 1];
    for (const i of near) if (inside(zone.polygon, i.position[0], i.position[2])) s += friendly(team, i.team) === 1 ? cfg.friendlyWeight : cfg.enemyWeight;
    score[z] = s;
    if (s > best) {
      best = s;
      choice.zone = z;
    }
  });
  if (choice.zone < 0) return choice;
  choice.zoneScore = best;
  const zoneBit = bit(choice.zone);
  // the point
  let have = false;
  const r2 = f(cfg.spawnPointCheckRadius * cfg.spawnPointCheckRadius);
  const range2 = f(cfg.directionCheckMaxRange * cfg.directionCheckMaxRange);
  const safe2 = f(cfg.spawnSafeEnemyDistance * cfg.spawnSafeEnemyDistance);
  for (let p = 0; p < finder.points.length; p++) {
    if (!(finder.masks[p] & zoneBit) || !usable(p)) continue;
    // past the first, a point also in another zone that scored below 0 is passed over
    if (have && finder.zones.some((_, z) => z < 64 && z !== choice.zone && finder.masks[p] & bit(z) && score[z] < 0)) continue;
    const s = finder.points[p];
    const eye = [s.position[0], f(s.position[1] + cfg.spawnerHeightOffset), s.position[2]];
    let blockers = 0;
    let seen = 0;
    let nearest = FLT_MAX;
    let rejected = false;
    for (const i of near) {
      const dx = f(eye[0] - i.position[0]), dy = f(eye[1] - i.position[1]), dz = f(eye[2] - i.position[2]);
      let d2 = f(f(f(dx * dx) + f(dy * dy)) + f(dz * dz));
      if (d2 <= r2) blockers++;
      if (have && blockers > choice.blockers) {
        rejected = true;
        break;
      }
      if (i.facing && d2 <= range2 && friendly(team, i.team) === 2) {
        const len = f(Math.sqrt(f(f(dx * dx) + f(dz * dz))));
        const facing = len > 0 ? f(f(f(i.facing[0] * dx) + f(i.facing[1] * dz)) / len) : 1;
        // an enemy facing away (within the angle threshold) doesn't see the point; one facing it does, unless the ray is blocked
        if (!(cfg.directionAngleThreshold >= 1e-6 && facing <= cfg.directionAngleThreshold) && !rayBlocked?.(eye, i.position)) seen++;
      }
      if (d2 >= safe2) d2 = FLT_MAX;
      if (d2 < nearest && friendly(team, i.team) === 2) nearest = d2;
    }
    if (rejected) continue;
    // the ghosts: the point's recent spawns block it
    finder.recent.forEach((r, k) => {
      if (r === p && k * cfg.ghostDecay < cfg.lastSpawnPointGhostCount) blockers++;
    });
    const better = !have || seen < choice.seen || (seen === choice.seen && nearest > choice.nearest);
    if (!have || blockers < choice.blockers || (blockers === choice.blockers && better)) {
      choice.point = p;
      choice.blockers = blockers;
      choice.seen = seen;
      choice.nearest = nearest;
      have = true;
    }
    if (choice.blockers === 0 && choice.seen === 0 && choice.nearest > cfg.acceptNearest) {
      choice.accepted = true;
      break;
    }
  }
  if (choice.point < 0) return choice;
  // the spawn memory: the other playing team loses SpawnWeight in the point's zones, and the point becomes a ghost
  for (let t = 1; t <= 2; t++) if (t !== team) add(finder, t, finder.masks[choice.point], cfg.spawnWeight, cfg.spawnRememberDuration, now);
  finder.recent.unshift(choice.point);
  if (finder.recent.length > cfg.previousSpawnsRemembered) finder.recent.length = cfg.previousSpawnsRemembered;
  return choice;
}
