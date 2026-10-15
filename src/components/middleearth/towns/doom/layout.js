// Mordor, the land: the plain of Gorgoroth west of Mount Doom, the road
// the orc column marches down, the rocks to hide behind from the Eye, the
// mountain's road up to the Sammath Naur, and the rock in the lava at the
// end. One world (`zone` 'plain' and 'slope' are the same ground, the
// mountain at its middle), but for the Crack of Doom, which is inside the
// mountain and drawn apart (`zone` 'crack'). No drawing here, so it can be
// tested on its own.
//
// The towns' conventions (../bree/layout.js): metres, +x east, +z south; a
// figure's `face` turns its +x to (cos face, -sin face).

import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pushOut } from '../walker';

const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });
const seeded = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

// Mount Doom, its foot all round about `r` from its middle (./scene.js
// turns the kit's mountain so its road starts due west, at FOOT)
export const DOOM = { x: 0, z: 0, r: 545, h: 320 };
// Barad-dûr, far off to the north-east, and the Eye at its top
export const BARAD = { x: 760, z: -1260 };
export const EYE_AT = { x: BARAD.x, y: 400, z: BARAD.z };

// ── the column ──
// The road the orcs march you down, east, into the plain.
export const MARCH_ROAD = [
  [-830, 58],
  [-800, 45],
  [-762, 32],
];
export const MARCH_LEN = (() => {
  let n = 0;
  for (let i = 1; i < MARCH_ROAD.length; i++) n += Math.hypot(MARCH_ROAD[i][0] - MARCH_ROAD[i - 1][0], MARCH_ROAD[i][1] - MARCH_ROAD[i - 1][1]);
  return n;
})();
// the point `d` metres down it: [x, z, angle]
export function alongMarch(d) {
  let left = Math.max(0, d);
  for (let i = 1; i < MARCH_ROAD.length; i++) {
    const [ax, az] = MARCH_ROAD[i - 1];
    const [bx, bz] = MARCH_ROAD[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (left <= len || i === MARCH_ROAD.length - 1) {
      const u = Math.min(1, left / len);
      return [ax + (bx - ax) * u, az + (bz - az) * u, Math.atan2(bz - az, bx - ax)];
    }
    left -= len;
  }
  return [MARCH_ROAD[0][0], MARCH_ROAD[0][1], 0];
}
// the camp where it halts, at the road's end
export const CAMP = { x: -748, z: 46 };

// ── the crossing ──
// From the end of the road east across the open plain to the foot of the
// mountain, under the Eye.
export const CROSS = { west: -760, east: -538, north: -46, south: 76 };
export const CROSS_START = { x: -754, z: 28, face: 0 };
export const FOOT = { x: -552, z: 0, r: 7 };
// rocks to hide behind: [x, z, r]
export const ROCKS = (() => {
  const rand = seeded(23);
  const out = [];
  for (let n = 0; n < 3000 && out.length < 34; n++) {
    const x = CROSS.west + 14 + rand() * (CROSS.east - CROSS.west - 22);
    const z = CROSS.north + 6 + rand() * (CROSS.south - CROSS.north - 12);
    if (Math.hypot(x - CROSS_START.x, z - CROSS_START.z) < 8 || Math.hypot(x - FOOT.x, z - FOOT.z) < 10) continue;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < 14) continue;
    if (out.some(([ox, oz]) => Math.hypot(x - ox, z - oz) < 9)) continue;
    out.push([x, z, 1.4 + rand() * 1.1]);
  }
  return out;
})();
export const CROSS_COLLIDERS = ROCKS.map(([x, z, r], i) => circle(`rock${i}`, x, z, r, { top: 2 * r }));
export const CROSS_WALLS = [
  [CROSS.west, CROSS.north, CROSS.east, CROSS.north, 0.4],
  [CROSS.west, CROSS.south, CROSS.east, CROSS.south, 0.4],
  [CROSS.west, CROSS.north, CROSS.west, CROSS.south, 0.4],
  [CROSS.east, CROSS.north, CROSS.east, CROSS.south, 0.4],
];
// Hidden from the Eye: in the shadow a rock throws away from it.
export function covered(x, z, rocks = ROCKS) {
  let dx = x - EYE_AT.x;
  let dz = z - EYE_AT.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  return rocks.some(([rx, rz, r]) => {
    const vx = x - rx;
    const vz = z - rz;
    const along = vx * dx + vz * dz;
    if (along < 0 || along > r * 2.6) return false;
    return Math.hypot(vx - along * dx, vz - along * dz) < r * 0.95;
  });
}

// ── the ground ──
const noise = makeNoise(37);
export function groundHeight(x, z) {
  const r = Math.hypot(x - DOOM.x, z - DOOM.z);
  // the plain: ash and cinder, low and broken, flat at the mountain's
  // foot and dug away under it (the mountain is the kit's)
  let h = (fbm(noise, x * 0.02, z * 0.02, { octaves: 3 }) - 0.5) * 4;
  h += (fbm(noise, x * 0.12 + 7, z * 0.12, { octaves: 2 }) - 0.5) * 0.8;
  h *= smooth(DOOM.r, DOOM.r + 90, r);
  h -= smooth(DOOM.r - 4, DOOM.r - 40, r) * 14;
  // flat enough along the road and round the camp
  const road = Math.min(...[0, 1].map((i) => segDist(x, z, MARCH_ROAD[i], MARCH_ROAD[i + 1])));
  h *= 0.35 + 0.65 * smooth(3, 9, road);
  return h;
}
function segDist(x, z, [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

// the rock in the lava, out on the plain north of the crossing, as the
// mountain comes down; the eagles carry you off west
export const REFUGE = { x: -620, z: -130 };

// ── the Crack of Doom ──
// Inside the mountain: in at the door (x = 0), along the spur to its
// broken tip over the fire.
export const EDGE = { x: 14 };

// A saved spot, if it's fair (only the crossing is walked).
export function validAt(saved) {
  const back = { zone: 'plain', ...CROSS_START };
  if (!saved || saved.zone !== 'plain' || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return back;
  if (saved.x < CROSS.west || saved.x > CROSS.east || saved.z < CROSS.north || saved.z > CROSS.south) return back;
  const [x, z] = pushOut(saved.x, saved.z, 0.4, CROSS_COLLIDERS, CROSS_WALLS);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return back;
  return { zone: 'plain', x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}
