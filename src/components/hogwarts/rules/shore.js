// The shore of the Black Lake where the world opens: the ground's height,
// the water's level, where you may walk, the jetty with its four boats, the
// way in, what grows and lies about, and where the castle stands across the
// water. Pure numbers in metres, tested in Node; world/shore.js and
// world/boats.js draw them. (Lane C's grounds take the shore over: this is
// its first stretch.)
//
// The lake is to -z, the castle on its crag across it; +x is to the right
// as you face it.
//
//   LEVEL, CASTLE, JETTY, BOATS, DOOR, BOUNDS, GROUND, SPAWN
//   waterline(x) → z where the ground meets the water
//   heightAt(x, z) → the ground's height (under the water too)
//   floorAt(x, z) → what you stand on there: the ground, or the jetty's planks
//   nearDoor(x, z) → whether the way in is in reach
//   scatterOf({ tier }) → [{ model, x, z, yaw, scale, r }]: the kit's rocks, pines and grass
//   solidsOf(items) → [{ at: [x, z], r }]: what the walk goes round

export const LEVEL = 0;
// the crag's foot, its middle, across the water (world/castle/silhouette.js's origin)
export const CASTLE = { at: [70, -620] };

// the ground's mesh (out either side to the far hills' ring, world/shore.js),
// and the box the walk keeps to
export const GROUND = { x0: -1100, x1: 1100, z0: -60, z1: 220 };
export const BOUNDS = { x0: -150, x1: 150, z0: -40, z1: 150 };

// the shoreline, wandering: a long gentle bay with a point either side
export const waterline = (x) => 4 * Math.sin(x / 37) + 2.2 * Math.sin(x / 13 + 1.1) + 7 * Math.exp(-(((x + 70) / 40) ** 2)) - 6 * Math.exp(-(((x - 60) / 35) ** 2));

// a little unevenness, the same everywhere for everyone (sums of sines, no randomness)
const lumps = (x, z) => 0.18 * Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.17 - x * 0.07) + 0.08 * Math.sin(x * 0.53 + 2) * Math.sin(z * 0.61 + 1);

// how far inland (+) or out (−) a point is, measured from the waterline
export const inland = (x, z) => z - waterline(x);

export function heightAt(x, z) {
  const d = inland(x, z);
  let h;
  if (d < 0) h = d * 0.11; // the lake's bed shelving off
  else if (d < 14) h = d * 0.07 + 0.22 * Math.exp(-(((d - 9) / 2.2) ** 2)); // the shingle, with the storm ridge along it
  else if (d < 42) h = 0.98 + 0.22 * Math.exp(-(((d - 9) / 2.2) ** 2)) + (d - 14) * 0.17; // the bank up to the moor
  else h = 5.74 + (d - 42) * 0.07; // the moor rising away
  // the hills closing in at either end of the bay, rising from the shingle
  // up and rounding over at their tops, out to meet the far shore's
  const side = Math.max(0, Math.abs(x) - 110);
  h += (70 * (1 - Math.exp(-((side / 110) ** 2))) + side * 0.03) * Math.max(0, Math.min(1, d / 160));
  return h + lumps(x, z) * Math.min(1, Math.max(0, (d + 2) / 6));
}

// The jetty: planks on posts from the shingle out over the water, the
// boats moored along it, bows to the castle
const JX = 6;
const JZ = waterline(JX);
export const JETTY = { x: JX, from: JZ + 4, to: JZ - 24, wide: 2.4, deck: 0.55, posts: 3 };
export const BOATS = [
  { at: [JX - 2.9, JZ - 9], yaw: 0.04, lantern: false },
  { at: [JX + 2.9, JZ - 11], yaw: -0.05, lantern: false },
  { at: [JX - 2.9, JZ - 18.5], yaw: -0.03, lantern: false },
  { at: [JX + 2.9, JZ - 20.5], yaw: 0.06, lantern: true },
];
// the way in, at the jetty's end where the boats wait
export const DOOR = { at: [JX, JZ - 18], reach: 6, label: 'Hogwarts' };
export const nearDoor = (x, z) => Math.hypot(x - DOOR.at[0], z - DOOR.at[1]) <= DOOR.reach;

const onJetty = (x, z) => Math.abs(x - JETTY.x) <= JETTY.wide / 2 && z <= JETTY.from && z >= JETTY.to;
export const floorAt = (x, z) => (onJetty(x, z) ? Math.max(heightAt(x, z), JETTY.deck) : heightAt(x, z));

// where you come in: on the shingle up from the jetty, the castle ahead
export const SPAWN = { at: [-6, waterline(-6) + 11] };
SPAWN.yaw = Math.atan2(-(CASTLE.at[0] - SPAWN.at[0]), -(CASTLE.at[1] - SPAWN.at[1]));

// mulberry32, so the shore is laid the same for everyone
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// What lies about and grows (the MegaKit's models, lib/three/kitScatter):
// boulders along the water's edge and pebbles on the shingle, grass on the
// bank, pines in a dark wood up behind and down either side. `r` is what
// the walk goes round (0: walked through). Nothing on the way down to the
// jetty, nor where you start.
const ROWS = [
  // [model, count, band of `inland` metres, [scale], r a scale (its reach at scale 1, metres), x band]
  // (the kit's models are in metres: a medium boulder 2.2 m round at 1, a pine 7 m tall)
  ['Rock_Medium_1', 14, [-2, 3], [0.35, 0.8], 1.3],
  ['Rock_Medium_3', 12, [-1, 6], [0.3, 0.7], 1.4],
  ['Rock_Big_1', 6, [1, 30], [0.45, 0.85], 2],
  ['Pebble_Round_2', 90, [0, 12], [0.4, 1], 0],
  ['Pebble_Round_4', 70, [0, 12], [0.4, 1], 0],
  ['Grass_Common_Tall', 180, [14, 60], [0.35, 0.6], 0],
  ['Grass_Wispy_Tall', 120, [12, 70], [0.35, 0.6], 0],
  ['Fern_1', 50, [26, 90], [0.5, 0.9], 0],
  // (Scots pines: twice the kit's height, as they stand in a Highland glen)
  ['Pine_3', 46, [34, 150], [1.6, 2.4], 0.25],
  ['Pine_5', 40, [34, 150], [1.5, 2.2], 0.25],
  ['Pine_1', 30, [20, 120], [1.6, 2.4], 0.25, [110, 240]],
];
// (the stretch of shore the scatter covers: the bay, out to where the hills close in)
const NEAR = { x0: -220, x1: 220 };
const CLEARS = [
  { at: [JETTY.x, JETTY.from + 6], r: 9 }, // the way down to the jetty
  { at: SPAWN.at, r: 6 },
];
export function scatterOf({ tier = 'high', seed = 1847 } = {}) {
  const rand = rngOf(seed);
  const out = [];
  for (const [model, count, [d0, d1], [s0, s1], r, band] of ROWS) {
    const grass = model.startsWith('Grass') || model.startsWith('Pebble');
    const n = Math.round(count * (tier === 'low' ? (grass ? 0.25 : 0.6) : tier === 'mid' ? (grass ? 0.6 : 1) : 1));
    for (let k = 0, tries = 0; k < n && tries < n * 20; tries++) {
      const side = band ? (rand() < 0.5 ? -1 : 1) : 1;
      const x = band ? side * (band[0] + rand() * (band[1] - band[0])) : NEAR.x0 + rand() * (NEAR.x1 - NEAR.x0);
      const d = d0 + rand() * (d1 - d0);
      const z = waterline(x) + d;
      if (z > GROUND.z1 - 8 || z < GROUND.z0) continue;
      if (CLEARS.some((c) => Math.hypot(x - c.at[0], z - c.at[1]) < c.r)) continue;
      if (Math.abs(x - JETTY.x) < JETTY.wide + 1 && z < JETTY.from + 2) continue;
      const scale = s0 + rand() * (s1 - s0);
      out.push({ model, x, z, yaw: rand() * Math.PI * 2, scale, r: r * scale });
      k++;
    }
  }
  return out;
}

export const solidsOf = (items) => items.filter((i) => i.r > 0).map((i) => ({ at: [i.x, i.z], r: i.r }));
