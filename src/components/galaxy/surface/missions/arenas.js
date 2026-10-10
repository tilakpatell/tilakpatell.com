// Where Heroes vs Villains and Blast are fought on a world: the level's own
// hero arena (its HeroArena volume, HeroesVsVillains on Geonosis_01) and
// its team-deathmatch ground and spawns, from the map rulebooks (cut small
// by scripts/bf2017-arenas.mjs into src/data/bf2017/maps/arenas.json), put
// on the site. Pure, so it's tested.
//
// The shapes and spawns keep the level's layout to the centimetre; where
// they stand on the site is by hand (ARENA_AT, NOTES.md): Hoth's pack puts
// the level's frame on the site (level.json's origin, 205, −1540: the
// site's 0, 0), but both of Hoth's grounds are inside Echo Base under the
// glacier, which the surface leaves out (the base's inside is its own zone),
// so on the site's frame they would be 70 m up on the ice; the other four
// worlds have no level pack yet. Each ground's middle goes on an open,
// level spot of the site's (a 160 m square within 8 m of level on Hoth's
// heightmap, the flattest of the site's ground elsewhere).
//
//   ARENA_AT                   { world: [x, z] } where a ground's middle goes
//   GROUNDS                    the worlds that have both grounds
//   groundFor(world, mode)     → { mode, world, volume, points ([[x, z]…] on
//                                the site), at (its middle), bounds { min, max },
//                                spawns { light, dark, any } ([[x, z, yaw]…]) } | null
//   inside(points, x, z)       → whether a point is in the ground
//   pull(points, at, x, z)     → [x, z] back inside: toward the middle until it is
//   spawnFor(g, side, r, near) → [x, z, yaw]: a side's start spot, or (near:
//                                the enemies up) the respawn farthest from them

import DATA from '../../../../data/bf2017/maps/arenas.json';

export const ARENA_AT = {
  hoth: [320, 20], // (the plain east of the landing: 7.5 m of rise over 160 m)
  endor: [-40, 320], // (the forest floor north of the scouts' camp)
  tatooine: [220, 100], // (the flat sand between the sandcrawler and Ben's hut)
  geonosis: [110, -360], // (the dust plain west of the hangar)
  kashyyyk: [60, -400], // (the dry ground south of the beach, past the pod)
};
export const GROUNDS = Object.keys(ARENA_AT);

const centre = (pts) => {
  // (the middle of its box: the polygon's own centroid can sit in a notch)
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
};

export function inside(points, x, z) {
  let yes = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i];
    const [xj, zj] = points[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) yes = !yes;
  }
  return yes;
}

export function pull(points, at, x, z) {
  if (inside(points, x, z)) return [x, z];
  for (let k = 0.05; k <= 1; k += 0.05) {
    const px = x + (at[0] - x) * k;
    const pz = z + (at[1] - z) * k;
    if (inside(points, px, pz)) return [px, pz];
  }
  return [at[0], at[1]];
}

const CACHE = new Map();
export function groundFor(world, mode) {
  const key = `${world}:${mode}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const src = DATA[world]?.[mode];
  const to = ARENA_AT[world];
  if (!src || !to) return null;
  const [cx, cz] = centre(src.points);
  const move = ([x, z, ...rest]) => [Math.round((x - cx + to[0]) * 100) / 100, Math.round((z - cz + to[1]) * 100) / 100, ...rest];
  const points = src.points.map(move);
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  // (a spawn the level leaves just outside its own ground, by a step, drawn in)
  const fit = (s) => {
    const [x, z] = pull(points, to, s[0], s[1]);
    return [x, z, s[2]];
  };
  const g = {
    mode,
    world,
    volume: src.volume,
    points,
    at: [to[0], to[1]],
    bounds: { min: [Math.min(...xs), Math.min(...zs)], max: [Math.max(...xs), Math.max(...zs)] },
    spawns: { light: src.spawns.light.map(move).map(fit), dark: src.spawns.dark.map(move).map(fit), any: src.spawns.any.map(move).map(fit) },
  };
  CACHE.set(key, g);
  return g;
}

// A side's spot: at the start one of its own cluster (team 1 or 2); back
// from down, the spawn (its own or either side's) farthest from the nearest
// enemy up, as the game's respawn picks a quiet one.
export function spawnFor(g, side, r = Math.random, near = null) {
  const own = g.spawns[side].length ? g.spawns[side] : g.spawns.any;
  if (!near) return own[Math.floor(r() * own.length) % own.length];
  const all = [...own, ...g.spawns.any];
  if (!near.length) return all[Math.floor(r() * all.length) % all.length];
  let best = all[0];
  let bestD = -1;
  for (const s of all) {
    let d = Infinity;
    for (const e of near) d = Math.min(d, Math.hypot(e.x - s[0], e.z - s[1]));
    // (a little chance in it, so a side doesn't always come back at one spot)
    d += r() * 6;
    if (d > bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}
