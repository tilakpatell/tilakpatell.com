// Cirith Ungol, the land: the shelf above the Morgul road, the stairs up
// the cliff, Shelob's tunnels and the pass, and the courtyard of the Tower.
// Each is its own place in its own coordinates (`zone` 'vale', 'stairs',
// 'lair', 'tower'), drawn apart by ./scene.js. No drawing here, so it can
// be tested on its own.
//
// The towns' conventions (../bree/layout.js): metres, +x east, +z south; a
// figure's `face` turns its +x to (cos face, -sin face).

import { fbm, makeNoise } from '../../../../lib/paint';
import { pushOut } from '../walker';
import { STAIRS } from './rules';

const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });

// ── the Morgul vale ──
// You crouch on a shelf of rock; the city is across the valley to the
// south, its bridge before it, the road from the bridge running past
// below you.
export const HIDE = { x: 0, z: 0, face: Math.PI / 2 };
export const CITY = { x: 30, z: 240, h: 90 };
export const BRIDGE = { x: 24, z: 150, len: 70 };
export const MORGUL_ROAD = [
  [BRIDGE.x, BRIDGE.z - BRIDGE.len / 2],
  [10, 70],
  [-20, 24],
  [-120, 10],
];
// the direction you look to see the city, from the hide
export const CITY_YAW = Math.atan2(CITY.x - HIDE.x, CITY.z - HIDE.z);

// ── the stairs ──
// Switchbacks up the cliff face (which faces +z): `stairAt(s)` gives the
// point `s` metres up the stair, as [x, y, z].
const STAIR_TURNS = 6;
export const STAIR_RISE = 70;
export function stairAt(s) {
  const k = Math.max(0, Math.min(1, s / STAIRS.len));
  const leg = Math.min(STAIR_TURNS - 1, Math.floor(k * STAIR_TURNS));
  const u = k * STAIR_TURNS - leg;
  const dir = leg % 2 ? -1 : 1;
  const x = dir * (u - 0.5) * 22;
  return [x, k * STAIR_RISE, 1.2 + 0.4 * Math.sin(k * 23)];
}

// ── Shelob's lair ──
// Tunnels through the rock, west to east: the way in at (0, 0), the way
// out to the pass at the east. Tunnels are corridors between walls.
const T = 3;
// each tunnel: [x0, z0, x1, z1] along its middle
export const TUNNELS = [
  [0, 0, 18, 0],
  [18, 0, 18, -16],
  [18, -16, 40, -16],
  [40, -16, 40, 6],
  [40, 6, 62, 6],
  [18, 0, 18, 14],
  [18, 14, 32, 14],
  [62, 6, 62, -8],
  [62, -8, 80, -8],
];
export const LAIR_IN = { x: 1.5, z: 0, face: 0 };
export const LAIR_OUT = { x: 79, z: -8, r: 2.5 };
// whether a point is inside the tunnels
export function inTunnels(x, z) {
  return TUNNELS.some(([x0, z0, x1, z1]) => x >= Math.min(x0, x1) - T / 2 && x <= Math.max(x0, x1) + T / 2 && z >= Math.min(z0, z1) - T / 2 && z <= Math.max(z0, z1) + T / 2);
}
export const lairBlocked = (x, z) => !inTunnels(x, z);
// Shelob's rounds through them
export const SHELOB_ROUNDS = [
  [
    [40, -16],
    [40, 6],
    [62, 6],
    [62, -8],
    [62, 6],
    [40, 6],
    [40, -16],
    [18, -16],
  ],
];
export const SHELOB_START = { x: 40, z: -16 };
// the pass, beyond: where she has Frodo, and where Sam fights her
export const PASS = { x: 96, z: -8 };

// ── the Tower ──
// Its courtyard, the orcs brawling in it, and the door to the stair.
export const COURT = { w: 44, d: 30 };
export const TOWER_IN = { x: -COURT.w / 2 + 2, z: COURT.d / 2 - 3, face: 0.55 };
export const TOWER_DOOR = { x: COURT.w / 2 - 2.5, z: -COURT.d / 2 + 3, r: 2.4 };
export const TOWER_PILLARS = [
  [-12, -6],
  [-12, 6],
  [0, -8],
  [0, 4],
  [12, -6],
  [12, 6],
];
export const ORC_ROUNDS = [
  [
    [-16, -12],
    [-16, 12],
  ],
  [
    [-6, 12],
    [6, -12],
  ],
  [
    [16, 12],
    [6, 12],
    [16, -2],
  ],
];
// orcs fighting among themselves over the mithril, standing in a knot
export const BRAWL = { x: 4, z: 9, r: 2.6 };
export const TOWER_COLLIDERS = [...TOWER_PILLARS.map(([x, z], i) => circle(`pillar${i}`, x, z, 1, { top: 12 })), circle('brawl', BRAWL.x, BRAWL.z, BRAWL.r, { top: 2 })];
export const TOWER_WALLS = [
  [-COURT.w / 2, -COURT.d / 2, COURT.w / 2, -COURT.d / 2, 0.5],
  [-COURT.w / 2, COURT.d / 2, COURT.w / 2, COURT.d / 2, 0.5],
  [-COURT.w / 2, -COURT.d / 2, -COURT.w / 2, COURT.d / 2, 0.5],
  [COURT.w / 2, -COURT.d / 2, COURT.w / 2, COURT.d / 2, 0.5],
];

// The ground of each: a little rough
const noise = makeNoise(47);
export const roughHeight = (x, z) => (fbm(noise, x * 0.1, z * 0.1, { octaves: 2 }) - 0.5) * 0.4;

// A saved spot, if it's fair (only the walkable places are saved).
export function validAt(saved, zone) {
  const start = zone === 'tower' ? TOWER_IN : LAIR_IN;
  const back = { zone, ...start };
  if (!saved || saved.zone !== zone || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return back;
  if (zone === 'lair' && !inTunnels(saved.x, saved.z)) return back;
  if (zone === 'tower') {
    const [x, z] = pushOut(saved.x, saved.z, 0.4, TOWER_COLLIDERS, TOWER_WALLS);
    if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return back;
  }
  return { zone, x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}
