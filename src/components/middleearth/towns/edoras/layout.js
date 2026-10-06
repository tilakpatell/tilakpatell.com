// Edoras, the land: the hill in the plain of Rohan with the White Mountains
// behind it, the stockade round its foot and the one gate, the road up
// between the thatched halls to the great stair, and Meduseld on the top,
// the Golden Hall; outside the gate, the barrows of the kings along the
// road, white with simbelmynë. The hall inside is its own place (`zone`
// 'hall'); the rest is the hill ('hill'). ./scene.js draws them. No drawing
// here, so it can be tested on its own.
//
// The towns' conventions (../bree/layout.js): metres, +x east, +z south; a
// figure's `face` turns its +x to (cos face, -sin face), so π/2 is north.

import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pushOut, sightClear } from '../walker';

const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });
const box = (id, x, z, w, d, o = {}) => ({ id, kind: 'box', x, z, w, d, turn: 0, ...o });
export const faceTo = (ax, az, bx, bz) => Math.atan2(-(bz - az), bx - ax);
export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── the hill ──
// An oval mound, longer to the west (where the hall stands) than the east
// (where the stair comes up), its top flat where Meduseld stands (`top`
// metres up, within `plateau` of the middle, measured with x shrunk by the
// side's stretch), falling quickly off the top and then gently to the plain
// at `foot`. The stockade runs round just outside the foot, its gate east.
export const HILL = { top: 28, plateau: 16, foot: 72, west: 1.6, east: 1.15 };
export const stretchOf = (x) => (x > 0 ? HILL.east : HILL.west);
const hillR = (x, z) => Math.hypot(x / stretchOf(x), z);
const noise = makeNoise(51);
export function hillHeight(x, z) {
  const r = hillR(x, z);
  let h = HILL.top * (1 - smooth(HILL.plateau, HILL.foot, r) ** 0.6);
  // the plain: a long roll to it, and the mountains away south
  h += (fbm(noise, x * 0.008, z * 0.008, { octaves: 3 }) - 0.5) * 6 * smooth(HILL.foot - 6, HILL.foot + 40, r);
  // (ridged, so the foothills read as hills and not one smooth wall; the
  // White Mountains themselves stand behind them, ./props.js)
  const m = smooth(420, 1300, z);
  if (m > 0) h += m * (60 + 220 * (1 - Math.abs(fbm(noise, x * 0.004, z * 0.004, { octaves: 4 }) * 2 - 1)) ** 1.5);
  return h;
}
export const STOCKADE = { r: HILL.foot + 4, gate: 0, gateW: 7 };
// the stockade's ring, as a radius in the hill's own measure, round its angle
export const onStockade = (x, z) => Math.abs(hillR(x, z) - STOCKADE.r) < 1;

// ── the road and the stair ──
// From the barrows outside, in at the gate, and straight up the east face
// of the hill to the foot of the great stair; the stair climbs to the
// terrace before the doors of Meduseld.
export const GATE = { x: STOCKADE.r * HILL.east, z: 0 };
export const ROAD = { x0: 222, x1: 34, w: 5 };
export const STAIR = { x0: 34, x1: 22, w: 6 };
export const TERRACE = { x0: 12, x1: 22, z0: -8, z1: 8 };
export const onRoad = (x, z, m = 0) => x >= ROAD.x1 - m && x <= ROAD.x0 + m && Math.abs(z) <= ROAD.w / 2 + m;

// ── Meduseld, outside ──
// The Golden Hall on the top of the hill, its doors to the east; the
// terrace before them, where Háma keeps the door.
export const MEDUSELD = { x0: -26, x1: 12, z0: -9, z1: 9, h: 15 };
export const DOORS = { x: 13.6, z: 0, r: 3 };
export const HAMA = { x: 15.6, z: 3.4, face: Math.PI, r: 3.6 };
export const DOOR_GUARDS = [
  { x: 15, z: -4.2, face: 0 },
  { x: 15, z: 4.2, face: 0 },
];
// the terrace, at night: where you watch the mountains for the beacon
export const WATCH = { x: 21, z: 0, face: 0 };

// ── the town ──
// Thatched halls of wood on the slopes, gables to the road, seeded; none on
// the road, the stair, the terrace or the hall.
export const HOUSES = (() => {
  const rand = seeded(907);
  const out = [];
  for (let i = 0; out.length < 70 && i < 3000; i++) {
    const a = rand() * Math.PI * 2;
    const r = 22 + rand() * 46;
    const x = Math.cos(a) * r * stretchOf(Math.cos(a));
    const z = Math.sin(a) * r;
    const w = 6 + rand() * 4;
    const d = 9 + rand() * 6;
    if (Math.abs(z) < ROAD.w / 2 + d / 2 + 2 && x > MEDUSELD.x0 - 4) continue;
    if (x > MEDUSELD.x0 - d && x < TERRACE.x1 + d && Math.abs(z) < 18) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < (o.d + d) / 2 + 2.4)) continue;
    // gable ends to the hill's middle, more or less: halls stand across the slope
    const face = Math.atan2(z, -x) + Math.PI / 2 + (rand() - 0.5) * 0.3;
    out.push({ x, z, y: hillHeight(x, z), w, d, h: 3.4 + rand() * 1.8, face });
  }
  return out;
})();

// ── the barrows ──
// Outside the gate along the road east: the mounds of the kings, eight a
// side, green and white with simbelmynë; the newest, Théodred's, at the
// end on the north side, nearest the gate.
export const BARROWS = Array.from({ length: 16 }, (_, i) => {
  const side = i % 2 ? 1 : -1;
  const k = Math.floor(i / 2);
  return { x: GATE.x + 22 + k * 15, z: side * (ROAD.w / 2 + 9), r: 6.2, h: 3.4 + (k % 3) * 0.5, side };
});
export const THEODRED = { ...BARROWS[0], id: 'theodred' };
// the flowers to be gathered: a cluster on each of seven barrows, on the
// side nearest the road
export const FLOWERS = [2, 5, 6, 9, 10, 13, 15]
  .map((k) => BARROWS[k])
  .map((b, i) => ({ i, x: b.x + (i % 2 ? 2 : -2), z: b.z - Math.sign(b.z) * (b.r - 1.2), r: 1.8 }));
// where you lay them: at the foot of Théodred's barrow, by the road
export const GRAVE = { x: THEODRED.x, z: THEODRED.z - Math.sign(THEODRED.z) * (THEODRED.r + 0.6), r: 2.4 };
export const barrowHeight = (x, z) => {
  let h = 0;
  for (const b of BARROWS) {
    const d = Math.hypot(x - b.x, z - b.z);
    if (d < b.r) h = Math.max(h, b.h * Math.cos((d / b.r) * (Math.PI / 2)) ** 1.5);
  }
  return h;
};
// the ground, everywhere on the hill and the plain: the hill, and the barrows on it
export const groundAt = (x, z) => hillHeight(x, z) + barrowHeight(x, z);

// ── where you can walk ──
// Inside the stockade (but not into the hall's walls), and out of the gate
// along the barrow road.
export const ARRIVE = { x: 214, z: 0, face: Math.PI };
export const insideStockade = (x, z, m = 0) => hillR(x, z) <= STOCKADE.r - 1 - m;
export const onBarrowRoad = (x, z, m = 0) => x >= GATE.x - 2 && x <= ROAD.x0 - m && Math.abs(z) <= 32 - m;
export const walkable = (x, z, m = 0) => (insideStockade(x, z, m) && !(x > MEDUSELD.x0 - 0.4 && x < MEDUSELD.x1 + 0.4 && Math.abs(z) < MEDUSELD.z1 + 0.4)) || onBarrowRoad(x, z, m) || (Math.abs(z) < STOCKADE.gateW / 2 - 0.6 && x > GATE.x - 8 && x < GATE.x + 4);
export const HILL_COLLIDERS = [
  ...HOUSES.map((h, i) => ({ id: `house${i}`, kind: 'box', x: h.x, z: h.z, w: h.d, d: h.w, turn: h.face, top: h.h + 3 })),
  box('meduseld', (MEDUSELD.x0 + MEDUSELD.x1) / 2, 0, MEDUSELD.x1 - MEDUSELD.x0, MEDUSELD.z1 - MEDUSELD.z0, { top: MEDUSELD.h }),
  circle('hama', HAMA.x, HAMA.z, 0.45, { top: 1.9 }),
  ...DOOR_GUARDS.map((g, i) => circle(`doorguard${i}`, g.x, g.z, 0.42, { top: 1.9 })),
];

// ── Meduseld, inside ──
// Long and dim, along z: the doors at the south end, the dais and the
// throne at the north; carved pillars down both sides, the long hearth in
// the middle, the tables along the walls (for the feast); the shields and
// tapestries of the kings on the walls.
export const HALL = { w: 16, z0: -22, z1: 22, h: 12 };
export const PILLARS = Array.from({ length: 7 }, (_, i) => -15 + i * 5).flatMap((z) => [
  [-4.8, z],
  [4.8, z],
]);
export const HEARTH = { x: 0, z: 2, w: 1.8, d: 6 };
export const DAIS = { x: 0, z: -19.4, w: 7, d: 3.2, h: 0.9 };
export const THRONE = { x: 0, z: -19.8 };
export const TABLES = [
  { x: -6.6, z: 2, w: 1.2, d: 16 },
  { x: 6.6, z: 2, w: 1.2, d: 16 },
];
export const HALL_IN = { x: 0, z: 19.5, face: Math.PI / 2 };
export const HALL_EXIT = { x: 0, z: 21, r: 1.8 };
// Gandalf at the foot of the dais, working; the king on the throne; Gríma by it
export const GANDALF = { x: 0, z: -15.6, face: Math.PI / 2 };
export const GRIMA = { x: 2.2, z: -18, face: -Math.PI / 2 };
// where Wormtongue's men come from: the shadows between the pillars
export const SHADOWS = [
  [-6.2, -9],
  [6.2, -9],
  [-6.2, 2],
  [6.2, 2],
  [-6.2, 12],
  [6.2, 12],
];
// at the feast: Gimli's place and Legolas's, across the end of a table
export const FEAST = { gimli: { x: 5.45, z: 7.5, face: 0 }, legolas: { x: 7.65, z: 7.5, face: Math.PI }, r: 3 };
export const HALL_WALLS = [
  [-HALL.w / 2, HALL.z0, HALL.w / 2, HALL.z0, 0.3],
  [-HALL.w / 2, HALL.z0, -HALL.w / 2, HALL.z1, 0.3],
  [HALL.w / 2, HALL.z0, HALL.w / 2, HALL.z1, 0.3],
  [-HALL.w / 2, HALL.z1, HALL.w / 2, HALL.z1, 0.3],
];
export const HALL_COLLIDERS = [
  ...PILLARS.map(([x, z], i) => circle(`pillar${i}`, x, z, 0.55, { top: HALL.h })),
  box('hearth', HEARTH.x, HEARTH.z, HEARTH.w, HEARTH.d, { top: 0.5, low: true }),
  box('dais', DAIS.x, DAIS.z, DAIS.w, DAIS.d, { top: DAIS.h, low: true }),
  ...TABLES.map((t, i) => box(`table${i}`, t.x, t.z, t.w, t.d, { top: 0.9, low: true })),
];
export const inHall = (x, z, m = 0) => Math.abs(x) <= HALL.w / 2 - m && z >= HALL.z0 + m && z <= HALL.z1 - m;
export const clearView = (ax, az, bx, bz) => sightClear(ax, az, bx, bz, HALL_COLLIDERS.filter((c) => c.id.startsWith('pillar')), HALL_WALLS);

// ── the beacons, seen from the terrace ──
// Away east along the White Mountains, the last of the chain from Gondor:
// Halifirien nearest. Bearings from the terrace (a figure's `face`), and
// how far.
export const PEAKS = [-0.42, -0.28, -0.16, -0.05, 0.06, 0.18].map((b, i) => ({ i, bearing: b, dist: 1400 + i * 260, h: 260 + (i % 3) * 60 }));

// ── the muster ──
// Away at dawn: down the road, out of the gate, and across the plain east
// with the host of Rohan. `len` metres from the foot of the stair.
export const MUSTER = { len: 520 };

// A saved spot, if it's fair (the hill and the hall are saved).
export function validAt(saved, zone) {
  const start = zone === 'hall' ? HALL_IN : ARRIVE;
  const back = { zone, ...start };
  if (!saved || saved.zone !== zone || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return back;
  const colliders = zone === 'hall' ? HALL_COLLIDERS : HILL_COLLIDERS;
  const walls = zone === 'hall' ? HALL_WALLS : [];
  if (zone === 'hall' ? !inHall(saved.x, saved.z, 0.4) : !walkable(saved.x, saved.z, 0.3)) return back;
  const [x, z] = pushOut(saved.x, saved.z, 0.4, colliders, walls);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return back;
  return { zone, x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : start.face };
}
