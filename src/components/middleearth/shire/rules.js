// Hobbiton, the world: the lie of the land, where everything stands, how a
// hobbit walks about it, and the rules of the five things to do there. No
// drawing (./scene.js draws it, ./ShireWorld.jsx drives it), so it can be
// tested on its own.
//
// Metres; +x is east, +z is south, so north is -z. A figure's heading
// (`face`) is the angle that turns its +x round to face (cos face, -sin face),
// the way the toy figures (../mapFigures.js) are made.

import { fbm, makeNoise, smooth } from '../../../lib/paint';
import { newWatchers, stepWatchers } from '../towns/watchers';
import { byFrame } from '../ease';

// The disc you can walk in, and how far the hills go on past it.
export const WORLD = { radius: 64, edge: 104 };
export const WATER_Y = -0.35;

// A seeded random, so the trees and the mushrooms are the same every visit.
export function seeded(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── where everything is ──

export const BAG_END = { x: -18, z: -24, r: 6.5 };
const BENCH = { x: -13.6, z: -18.6 };
// Bagshot Row, under the Hill: Sam's is the yellow door
export const HOLES = [
  { id: 'row1', x: -34, z: -11.5, r: 4, door: 0xb8402c, seed: 3 },
  { id: 'sam', x: -26.5, z: -10.5, r: 4, door: 0xd9a531, seed: 5 },
  { id: 'row3', x: -7, z: -11.5, r: 4, door: 0x2f5f8a, seed: 7 },
  { id: 'row4', x: -42, z: -18, r: 3.6, door: 0x6b3a6a, seed: 9 },
  { id: 'row5', x: 2, z: -19, r: 3.6, door: 0xc96a2a, seed: 11 },
];
export const PARTY_TREE = { x: 20, z: -20, r: 1.5 };
export const PAVILION = { x: 28, z: -10.5, w: 9, d: 6 };
export const CART = { x: 12, z: -12, w: 3, d: 1.8 };
export const POND = { x: -6, z: 14, rx: 12, rz: 7 };
// the stream out of the pond, east to the edge: [x, z] and its width
export const STREAM = { w: 3.4, points: [[4, 14.2], [20, 16], [40, 19.5], [72, 23]] };
export const MILL = { x: -21.5, z: 11, w: 6, d: 5 };
export const BRIDGE = { x: 12, z0: 10.4, z1: 20.4, w: 3.2, rise: 1.3 };
export const INN = { x: 14, z: 34, w: 10, d: 7 };
export const FIELD = { x0: -50, x1: -26, z0: 22, z1: 40, gate: [-40, -36], stile: [-32, -30.5] };
export const BARN = { x: -56.5, z: 31, w: 6, d: 9 };
export const SCARECROW = { x: -38, z: 31 };
// the old tree by the East Road, and the hollow under its roots
export const HOLLOW = { x: 53, z: 7.8, r: 1.3 };
export const ROOT_TREE = { x: 53, z: 9.8, r: 1.2 };
export const PASTURE = { x: 38, z: -32, r: 10 };

// The lanes and paths, as segments with a width. The lane runs through
// Hobbiton east to west; the East Road leaves it for Bree.
export const ROADS = [
  { id: 'lane', a: [-56, -4], b: [45, -4], w: 3.2 },
  { id: 'east1', a: [45, -4], b: [56, 3.4], w: 3.2 },
  { id: 'east2', a: [56, 3.4], b: [74, 13.5], w: 3.2 },
  { id: 'bagend1', a: [-18, -17], b: [-15, -10], w: 1.7 },
  { id: 'bagend2', a: [-15, -10], b: [-13, -4], w: 1.7 },
  { id: 'row', a: [-38, -7.4], b: [2, -7.4], w: 1.4 },
  { id: 'party', a: [8, -4], b: [13.5, -11], w: 1.8 },
  { id: 'south1', a: [11, -4], b: [12, BRIDGE.z0], w: 2.4 },
  { id: 'bridge', a: [12, BRIDGE.z0], b: [12, BRIDGE.z1], w: 2.4 },
  { id: 'south2', a: [12, BRIDGE.z1], b: [14, 30], w: 2.4 },
  { id: 'maggot', a: [-28, -4], b: [-38, 21], w: 1.8 },
  { id: 'mill', a: [-14, -4], b: [-19.5, 7.5], w: 1.4 },
  { id: 'row5', a: [2, -7.4], b: [2, -15], w: 1.4 },
];

const toSeg = (x, z, a, b) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz));
};
export const onRoad = (x, z, roads = ROADS) => roads.some((r) => toSeg(x, z, r.a, r.b) <= r.w / 2);
// 1 in the middle of a road, 0 a little way off it (for painting the ground)
export function roadAmount(x, z) {
  let best = 0;
  for (const r of ROADS) best = Math.max(best, 1 - smooth(r.w * 0.32, r.w * 0.62, toSeg(x, z, r.a, r.b)));
  return best;
}

const streamDist = (x, z) => {
  let d = Infinity;
  const p = STREAM.points;
  for (let i = 0; i < p.length - 1; i++) d = Math.min(d, toSeg(x, z, p[i], p[i + 1]));
  return d;
};
const pondK = (x, z) => Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);

export const onBridge = (x, z) => Math.abs(x - BRIDGE.x) <= BRIDGE.w / 2 && z >= BRIDGE.z0 && z <= BRIDGE.z1;
// in the water: the pond, or the stream (the bridge is over it)
export const inWater = (x, z) => !onBridge(x, z) && (pondK(x, z) < 0.97 || streamDist(x, z) < STREAM.w / 2 - 0.25);

const gauss = (x, z, cx, cz, r) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r));
const noise = makeNoise(41);
const noise2 = makeNoise(77);

// The ground's height: rolling, with the Hill to the north, the Party Field
// and the farm flat, the pond and the stream cut down, and wooded hills
// rising all round past the edge.
export function height(x, z) {
  let h = (fbm(noise, x * 0.035 + 10, z * 0.035 + 10, { octaves: 4 }) - 0.5) * 2.6;
  h += 9 * gauss(x, z, -21, -31, 12.5); // the Hill
  h += 3.2 * gauss(x, z, -42, -24, 8) + 2.6 * gauss(x, z, 2, -24, 7) + 2.4 * gauss(x, z, 38, -36, 10) + 1.8 * gauss(x, z, -6, 42, 9) + 2.2 * gauss(x, z, 34, 40, 10);
  const r = Math.hypot(x, z);
  h += smooth(56, 100, r) * (11 + fbm(noise2, x * 0.05, z * 0.05, { octaves: 3 }) * 12);
  // flat where things are built or held
  h += (0.6 - h) * (1 - smooth(10, 17, Math.hypot(x - 21, z + 14)));
  const inField = Math.max(Math.abs(x - (FIELD.x0 + FIELD.x1) / 2) - (FIELD.x1 - FIELD.x0) / 2, Math.abs(z - (FIELD.z0 + FIELD.z1) / 2) - (FIELD.z1 - FIELD.z0) / 2);
  h += (0.3 - h) * (1 - smooth(-2, 5, inField));
  h += (0.5 - h) * (1 - smooth(5, 10, Math.hypot(x - INN.x, z - INN.z)));
  // the lane is worn a little lower than the verges
  h -= roadAmount(x, z) * 0.12;
  // the water
  const k = pondK(x, z);
  h += (-1.5 - h) * (1 - smooth(0.8, 1.25, k));
  const sd = streamDist(x, z);
  h += (-1.2 - h) * (1 - smooth(STREAM.w * 0.3, STREAM.w * 0.95, sd));
  return h;
}

// The bridge's deck, a gentle hump over the stream.
export function bridgeY(z) {
  const k = Math.max(0, Math.min(1, (z - BRIDGE.z0) / (BRIDGE.z1 - BRIDGE.z0)));
  return 0.35 + Math.sin(k * Math.PI) * BRIDGE.rise;
}
// where a foot lands (or anything else: `at` the ground's height, the
// terrain's as drawn for a leaf, ./ground.js's drawnHeight)
export const groundY = (x, z, at = height) => (onBridge(x, z) ? bridgeY(z) : Math.max(at(x, z), WATER_Y));

// ── what's in the way ──

// The trees: oaks round the edges of things, scattered so they're the same
// every time and never on a road, in the water or in a building.
const box = (id, o, pad = 0) => ({ id, kind: 'box', x: o.x, z: o.z, w: o.w + pad, d: o.d + pad });
const circle = (id, x, z, r) => ({ id, kind: 'circle', x, z, r });
const BUILT = [
  circle('bagend', BAG_END.x, BAG_END.z - 1.2, BAG_END.r * 0.82),
  // each hole's mound: the middle and the shoulders, which leave the door
  // to walk up to, and the stone pillars either side of it
  ...HOLES.flatMap((h) => [
    circle(h.id, h.x, h.z - 0.26 * h.r, 0.48 * h.r),
    circle(`${h.id}-w`, h.x - 0.6 * h.r, h.z - 0.09 * h.r, 0.4 * h.r),
    circle(`${h.id}-e`, h.x + 0.6 * h.r, h.z - 0.09 * h.r, 0.4 * h.r),
    circle(`${h.id}-pw`, h.x - 3.2 * (h.r / 4), h.z + 0.235 * h.r, 0.6),
    circle(`${h.id}-pe`, h.x + 3.2 * (h.r / 4), h.z + 0.235 * h.r, 0.6),
  ]),
  circle('party-tree', PARTY_TREE.x, PARTY_TREE.z, PARTY_TREE.r),
  circle('root-tree', ROOT_TREE.x, ROOT_TREE.z, ROOT_TREE.r),
  circle('scarecrow', SCARECROW.x, SCARECROW.z, 0.35),
  box('mill', MILL),
  box('inn', INN),
  box('barn', BARN),
  box('cart', CART),
  box('tables', { x: PAVILION.x, z: PAVILION.z, w: 6.5, d: 1.6 }),
];

function clearOf(x, z, pad) {
  if (onRoad(x, z) || inWater(x, z) || pondK(x, z) < 1.25 || streamDist(x, z) < STREAM.w + 1) return false;
  if (x > FIELD.x0 - 2 && x < FIELD.x1 + 2 && z > FIELD.z0 - 2 && z < FIELD.z1 + 2) return false;
  if (Math.hypot(x - PASTURE.x, z - PASTURE.z) < PASTURE.r) return false;
  if (Math.hypot(x - 21, z + 14) < 13) return false; // the Party Field
  for (const c of BUILT) {
    if (c.kind === 'circle' && Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
    if (c.kind === 'box' && Math.abs(x - c.x) < c.w / 2 + pad && Math.abs(z - c.z) < c.d / 2 + pad) return false;
  }
  return true;
}

export const TREES = (() => {
  const rand = seeded(23);
  const out = [];
  let tries = 0;
  while (out.length < 64 && tries++ < 4000) {
    const a = rand() * Math.PI * 2;
    const r = 12 + Math.sqrt(rand()) * (WORLD.radius - 10);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!clearOf(x, z, 4)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 5.5)) continue;
    out.push({ x, z, s: 0.8 + rand() * 0.55, kind: Math.floor(rand() * 3), turn: rand() * Math.PI * 2 });
  }
  return out;
})();

// The leaves under them, the day of Bilbo's party, 22 September (the
// Shire's landing has the same: universe/landings/landings.js's
// LEAVES.shire): olive going gold, one in seven russet; how many a square
// metre, how big (a share of a metre's quad), and how many a second the
// trees round you let go (lib/three/flatLitter.js)
export const LEAVES = { colours: ['#a39c34', '#d8a83c', '#b4622c'], density: 0.55, size: 0.28, shed: 0.7 };

// Farmer Maggot's fence, with the gate on the north side and a stile on
// the south: [x0, z0, x1, z1] runs of rail.
export const FENCES = [
  [FIELD.x0, FIELD.z0, FIELD.gate[0], FIELD.z0],
  [FIELD.gate[1], FIELD.z0, FIELD.x1, FIELD.z0],
  [FIELD.x1, FIELD.z0, FIELD.x1, FIELD.z1],
  [FIELD.x1, FIELD.z1, FIELD.stile[1], FIELD.z1],
  [FIELD.stile[0], FIELD.z1, FIELD.x0, FIELD.z1],
  [FIELD.x0, FIELD.z1, FIELD.x0, FIELD.z0],
];

// The garden fences in front of Bag End and the holes, with the gate in the
// middle: [x0, z0, x1, z1].
const GARDENS = [
  [BAG_END.x - 5.2, BAG_END.z + 7.4, BAG_END.x - 0.55, BAG_END.z + 7.4],
  [BAG_END.x + 0.55, BAG_END.z + 7.4, BAG_END.x + 5.2, BAG_END.z + 7.4],
  ...HOLES.flatMap((h) => {
    const z = h.z + 3.94 * (h.r / 4);
    const span = Math.min(3.65, h.r - 0.1);
    return [
      [h.x - span, z, h.x - 0.55, z],
      [h.x + 0.55, z, h.x + span, z],
    ];
  }),
];

// Hedges along the lane: [x0, z0, x1, z1], about a metre thick.
export const HEDGES = [
  [-56, -6.3, -44, -6.3],
  [-56, -1.7, -31, -1.7],
  [-26, -1.7, -16.5, -1.7],
  [16, -1.7, 43, -1.7],
  [34, -6.3, 44, -6.3],
];

export const COLLIDERS = [...BUILT, ...TREES.map((t, i) => circle(`oak${i}`, t.x, t.z, 0.45 * t.s))];

// ── walking ──

export const HOBBIT = { radius: 0.4, walk: 3.4, run: 6.2, accel: 16, turn: 11 };
export const START = { x: 4, z: -4.5, face: Math.PI };

// Push a circle at (x, z) out of everything; returns the new spot.
function push(x, z, rad) {
  for (const c of COLLIDERS) {
    if (c.kind === 'circle') {
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + rad;
      if (d < min && d > 1e-6) {
        x = c.x + (dx / d) * min;
        z = c.z + (dz / d) * min;
      }
    } else {
      const px = Math.max(c.x - c.w / 2, Math.min(x, c.x + c.w / 2));
      const pz = Math.max(c.z - c.d / 2, Math.min(z, c.z + c.d / 2));
      const dx = x - px;
      const dz = z - pz;
      const d = Math.hypot(dx, dz);
      if (d < rad) {
        if (d > 1e-6) {
          x = px + (dx / d) * rad;
          z = pz + (dz / d) * rad;
        } else {
          // inside it: out by the nearest side
          const out = [c.x - c.w / 2 - rad - x, c.x + c.w / 2 + rad - x, c.z - c.d / 2 - rad - z, c.z + c.d / 2 + rad - z];
          const i = out.map(Math.abs).indexOf(Math.min(...out.map(Math.abs)));
          if (i < 2) x += out[i];
          else z += out[i];
        }
      }
    }
  }
  for (const [x0, z0, x1, z1, thick = 0.08] of [...FENCES, ...GARDENS, ...HEDGES.map((h) => [...h, 0.5])]) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz)));
    const px = x0 + t * dx;
    const pz = z0 + t * dz;
    const ex = x - px;
    const ez = z - pz;
    const d = Math.hypot(ex, ez);
    const min = rad + thick;
    if (d < min && d > 1e-6) {
      x = px + (ex / d) * min;
      z = pz + (ez / d) * min;
    }
  }
  return [x, z];
}

// One step of walking. `move` is where the visitor wants to go, already
// turned to the world (the camera does that): { x, z } up to length 1, and
// `run`. Returns the hobbit: where, facing, how fast.
export function stepHobbit(h, { x: mx = 0, z: mz = 0, run = false } = {}, dt) {
  const len = Math.hypot(mx, mz);
  const k = len > 1 ? 1 / len : 1;
  const top = run ? HOBBIT.run : HOBBIT.walk;
  const tx = mx * k * top;
  const tz = mz * k * top;
  // by dt, as the old `min(1, accel·dt/top·2.2)` was at 60 Hz (../ease.js)
  const ease = byFrame((HOBBIT.accel * 2.2) / Math.max(1, top), dt);
  let vx = h.vx + (tx - h.vx) * ease;
  let vz = h.vz + (tz - h.vz) * ease;
  if (len < 0.05 && Math.hypot(vx, vz) < 0.05) {
    vx = 0;
    vz = 0;
  }
  let x = h.x + vx * dt;
  let z = h.z + vz * dt;
  // the water: slide along the bank rather than wade in
  if (inWater(x, z)) {
    if (!inWater(x, h.z)) z = h.z;
    else if (!inWater(h.x, z)) x = h.x;
    else {
      x = h.x;
      z = h.z;
    }
  }
  [x, z] = push(x, z, HOBBIT.radius);
  if (inWater(x, z)) {
    x = h.x;
    z = h.z;
  }
  // the edge of the world
  const r = Math.hypot(x, z);
  if (r > WORLD.radius) {
    x *= WORLD.radius / r;
    z *= WORLD.radius / r;
  }
  const moved = Math.hypot(x - h.x, z - h.z) / Math.max(dt, 1e-6);
  let face = h.face;
  if (len > 0.05) {
    const want = Math.atan2(-mz, mx);
    let d = want - face;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    face += d * byFrame(HOBBIT.turn, dt);
  }
  return { x, z, face, vx: (x - h.x) / Math.max(dt, 1e-6), vz: (z - h.z) / Math.max(dt, 1e-6), speed: moved, running: run && moved > HOBBIT.walk + 0.3 };
}

// Footsteps on the grass: one a stride of ground covered (a longer stride
// running), so they keep pace with his feet at any frame rate. `acc` is how
// far through a stride he is; standing still puts him partway, so the first
// step comes soon after he sets off. Returns [acc, a foot fell].
export const STRIDE = { walk: 0.75, run: 1.15, first: 0.5, still: 0.3 };
export function stepStride(acc, h, dt) {
  if (!(h.speed > STRIDE.still)) return [STRIDE.first, false];
  const next = acc + (h.speed * dt) / (h.running ? STRIDE.run : STRIDE.walk);
  return next >= 1 ? [next - 1, true] : [next, false];
}

// Caught or found, he's put back under a fade to black and out again rather
// than a cut (C-137's 260 ms): `left` is the seconds until the screen is dark
// and he's moved. Returns [left, move him now]; null is no fade.
export const FADE = 0.26;
export function stepFade(left, dt) {
  if (left == null) return [null, false];
  const next = left - dt;
  return next > 0 ? [next, false] : [null, true];
}

export const newHobbit = (at = START) => ({ x: at.x, z: at.z, face: at.face ?? 0, vx: 0, vz: 0, speed: 0, running: false });

// ── what there is to do ──

export const QUESTS = [
  {
    id: 'maggot',
    name: 'Shortcut to mushrooms',
    where: 'Farmer Maggot’s field',
    at: { x: -38, z: 19.5 },
    blurb: 'Ten of Farmer Maggot’s mushrooms. Keep out of his dogs’ sight.',
    go: 'Farmer Maggot’s field is south-west, past the mill. Mind the dogs.',
  },
  {
    id: 'rings',
    name: 'Smoke rings',
    where: 'The bench at Bag End',
    at: { x: BENCH.x, z: BENCH.z + 1.4 },
    blurb: 'Sit with Gandalf and send your smoke rings through his.',
    go: 'Gandalf’s on the bench outside Bag End, up the Hill. Sit with him.',
  },
  {
    id: 'party',
    name: 'Gandalf’s fireworks',
    where: 'The Party Field',
    at: { x: CART.x - 0.5, z: CART.z + 1.9 },
    blurb: 'Light Gandalf’s fireworks and keep the party cheering.',
    go: 'Gandalf’s cart is on the Party Field, by the great tree. Light the fireworks.',
  },
  {
    id: 'ring',
    name: 'Keep it secret, keep it safe',
    where: 'Bag End',
    at: { x: BAG_END.x, z: BAG_END.z + BAG_END.r * 0.94 + 1 },
    blurb: 'Bilbo has gone. He left you something on the mantelpiece.',
    go: 'Bilbo has gone, and left you something. Go into Bag End.',
    needs: 'party',
    locked: 'After the party.',
  },
  {
    id: 'rider',
    name: 'Get off the road!',
    where: 'The East Road',
    at: { x: 44, z: -4 },
    blurb: 'Something is coming up the East Road. Hide, and don’t put it on.',
    go: 'Take the Ring east, out along the East Road.',
    needs: 'ring',
    locked: 'Once you have the Ring.',
  },
];

// What's open, what's next, and whether night has fallen. `done` is the
// ids finished, in any order.
export function progress(done = []) {
  const has = (id) => done.includes(id);
  const quests = QUESTS.map((q) => ({ ...q, done: has(q.id), open: !q.needs || has(q.needs) }));
  const next = quests.find((q) => q.open && !q.done) ?? null;
  const first = !done.length;
  const finished = quests.every((q) => q.done);
  let objective;
  if (finished) objective = 'The road goes ever on. Follow it east, out of the Shire.';
  else if (first) objective = 'It’s Bilbo’s birthday. Maggot’s mushrooms, a smoke with Gandalf, or the fireworks: take your pick.';
  else objective = next.go;
  return { quests, next: next?.id ?? null, objective, finished, sky: finished ? 'dawn' : has('party') ? 'night' : 'day', hasRing: has('ring') };
}

// The places to stop and do something, and how near is near.
export const SPOTS = [
  { id: 'rings', x: BENCH.x, z: BENCH.z + 1.3, r: 2 },
  { id: 'party', x: CART.x - 0.5, z: CART.z + 2, r: 2.4 },
  { id: 'ring', x: BAG_END.x, z: BAG_END.z + BAG_END.r * 0.94 + 0.9, r: 1.9 },
  { id: 'leave', x: 60, z: 11.4, r: 5 },
  // on the side: Lobelia, by the lane at the foot of Bag End's path (LOBELIA)
  { id: 'spoons', x: -12, z: -5.3, r: 2 },
];
export function nearSpot(x, z) {
  let best = null;
  for (const s of SPOTS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r && (!best || d < best.d)) best = { ...s, d };
  }
  return best;
}

// Who's about, and what they say when you come by. Their lines go round in
// turn. `when` keeps someone to part of the evening.
export const CAST = [
  { id: 'sam', name: 'Samwise Gamgee', x: -24, z: -6.6, face: -Math.PI / 2, look: 'sam', lines: ['I ain’t been dropping no eaves, sir, honest!', 'Mr. Frodo, if I take one more step, it’ll be the farthest away from home I’ve ever been.', 'Rosie Cotton’s dancing tonight. I might ask her. I might.'] },
  { id: 'bilbo', name: 'Bilbo Baggins', x: 25.5, z: -14.4, face: Math.PI / 2, look: 'bilbo', when: 'day', lines: ['My dear Bagginses and Boffins, Tooks and Brandybucks…', 'I don’t know half of you half as well as I should like.', 'I’m going on an adventure!'] },
  { id: 'merry', name: 'Merry Brandybuck', x: 10.2, z: -9.6, face: 0, look: 'merry', lines: ['You’re supposed to stick it in the ground!', 'That was good. Let’s get another one.'] },
  { id: 'pippin', name: 'Pippin Took', x: 14.2, z: -9.4, face: Math.PI, look: 'pippin', lines: ['It is in the ground!', 'What about second breakfast?', 'We’ve had one, yes. What about second breakfast?'] },
  { id: 'rosie', name: 'Rosie Cotton', x: 11, z: 29.4, face: Math.PI / 2, look: 'rosie', lines: ['Evening, Mr. Frodo. Is Sam coming down tonight?', 'There’s ale in the Green Dragon and dancing in the field.'] },
  { id: 'maggot', name: 'Farmer Maggot', x: -42.5, z: 19.6, face: 0, look: 'maggot', lines: ['Who’s that? Get out of it! Off my field!', 'You leave my mushrooms be. Grip! Fang! Wolf!'] },
  { id: 'gaffer', name: 'The Gaffer', x: -33, z: -6.8, face: -Math.PI / 2, look: 'gaffer', lines: ['Mr. Bilbo’s a rare one. Rich as you like, and queer with it.', 'Don’t you go getting mixed up in the business of your betters, Sam.'] },
];
export const castFor = (sky) => CAST.filter((c) => !c.when || c.when === sky);
export function nearCast(x, z, sky, r = 2.6) {
  let best = null;
  for (const c of castFor(sky)) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < r && (!best || d < best.d)) best = { ...c, d };
  }
  return best;
}
// Gandalf: on the bench by day, at his cart while the fireworks are on, and
// at dawn at the edge of the Shire seeing you off.
export const GANDALF_LINES = ['A wizard is never late, Frodo Baggins. Nor is he early. He arrives precisely when he means to.', 'All we have to decide is what to do with the time that is given us.', 'You can learn all there is to know about their ways in a month, and after a hundred years they can still surprise you.'];
// the lines the site has the films' own recordings of (lib/clips); the rest
// are said in the speaker's made voice, where it's been made (./voicelines.js)
export const SPOKEN = { 'A wizard is never late, Frodo Baggins. Nor is he early. He arrives precisely when he means to.': 'wizardLate', 'What about second breakfast?': 'secondBreakfast', 'We’ve had one, yes. What about second breakfast?': 'secondBreakfast' };

// ── 1. Shortcut to mushrooms ──

export const inField = (x, z, pad = 0) => x > FIELD.x0 - pad && x < FIELD.x1 + pad && z > FIELD.z0 - pad && z < FIELD.z1 + pad;
export const HUNT = { mushrooms: 10, pick: 1.0, sight: 6.2, cone: 0.62, hear: 2.1, alert: 0.6, chase: 5.2, patrol: 1.7, giveUp: 6, catch: 0.85, look: 1.4, far: 1.2, search: 6 }; // (far, search: the dogs are quick to be sure, and sniff about a while)

export const MUSHROOMS = (() => {
  const rand = seeded(91);
  const out = [];
  let tries = 0;
  while (out.length < HUNT.mushrooms && tries++ < 3000) {
    const x = FIELD.x0 + 2 + rand() * (FIELD.x1 - FIELD.x0 - 4);
    const z = FIELD.z0 + 2.5 + rand() * (FIELD.z1 - FIELD.z0 - 4.5);
    if (Math.hypot(x - SCARECROW.x, z - SCARECROW.z) < 2.2) continue;
    if (out.some((m) => Math.hypot(m.x - x, m.z - z) < 3.4)) continue;
    out.push({ x, z });
  }
  return out;
})();

// The dogs walk their rounds, stopping at each corner to look about.
export const DOG_ROUNDS = [
  [[-46, 26], [-31, 26], [-31, 30]],
  [[-29, 37], [-44, 37], [-44, 33]],
  [[-38, 24.5], [-38, 36], [-34, 33], [-42, 28]],
];

// The dogs are watchers (../towns/watchers.js), as Bree's Nazgûl and
// Moria's troll are: a round each, a cone they see in, your running heard
// close by; and, at last, HUNT's `far` (a moment to be sure of you at the
// edge of their sight) and `search` (losing you, they sniff about where
// they last had you, together, before going back to their rounds). They
// keep to the field. `dogs` is the watchers' own list, so a dog's mode,
// place, heading and look are what the scene draws.
const DOG_WATCH = { ...HUNT, smell: 0, leash: 14 };
const inFieldPush = (x, z) => [Math.max(FIELD.x0 + 0.5, Math.min(FIELD.x1 - 0.5, x)), Math.max(FIELD.z0 + 0.5, Math.min(FIELD.z1 - 0.5, z))];

export function newHunt(picked = []) {
  const watch = newWatchers(DOG_ROUNDS);
  // seeded, so the dogs cast about for you the same way every visit
  return { picked: [...picked], watch, dogs: watch.list, opts: { ...DOG_WATCH, rand: seeded(61) } };
}

// can this dog see (or hear) the hobbit?
export function dogSees(dog, h) {
  const dx = h.x - dog.x;
  const dz = h.z - dog.z;
  const d = Math.hypot(dx, dz);
  if (d < HUNT.hear && h.running) return true;
  if (d > HUNT.sight) return false;
  const ang = Math.atan2(-dz, dx);
  let off = ang - (dog.face + dog.look);
  off = Math.atan2(Math.sin(off), Math.cos(off));
  return Math.abs(off) < HUNT.cone;
}

// One step of the hunt. h: the hobbit. Returns events: { type: 'pick', i },
// 'seen' (a dog's barked), 'lost' (it gave up), 'searching' (it's sniffing
// about where it lost you), 'caught', 'all'; a dog's own carry its `dog` (index).
export function stepHunt(hunt, h, dt) {
  const ev = [];
  const inside = inField(h.x, h.z, -0.2);
  if (inside) {
    MUSHROOMS.forEach((m, i) => {
      if (!hunt.picked.includes(i) && Math.hypot(h.x - m.x, h.z - m.z) < HUNT.pick) {
        hunt.picked.push(i);
        ev.push({ type: 'pick', i, left: HUNT.mushrooms - hunt.picked.length });
        if (hunt.picked.length >= HUNT.mushrooms) ev.push({ type: 'all' });
      }
    });
  }
  // they notice you only in the field, and give up once you're out of it
  const hunting = hunt.dogs.some((d) => d.mode === 'alert' || d.mode === 'chase');
  const active = hunting ? inField(h.x, h.z, 0.5) : inside;
  for (const e of stepWatchers(hunt.watch, h, dt, hunt.opts ?? DOG_WATCH, { active, push: inFieldPush })) ev.push({ type: e.type, dog: e.id });
  return ev;
}
// where Maggot puts you when the dogs catch you
export const MAGGOT_GATE = { x: -38, z: 18.6, face: Math.PI / 2 };

// ── the sheep ──
// In the pasture by the East Road they graze, now and then wander a few
// steps, turning as a sheep turns (not on the spot), and trot off from a
// hobbit who comes right up to them. Seeded, so they go the same way every
// visit; in the rules, so the scene only draws them. A sheep: { x, z, face
// (its heading), want (the heading it's turning to), speed (m/s), walk
// (seconds left of this walk), t (seconds until it thinks again), shy }.
export const FLOCK = { walk: 0.7, trot: 1.6, turn: 3, pace: 4, shy: 2.6, wander: 0.4 };

export function newFlock(n, seed = 7) {
  const rand = seeded(seed);
  const sheep = Array.from({ length: n }, () => {
    const a = rand() * Math.PI * 2;
    const r = PASTURE.r * 0.6 * rand();
    const face = rand() * Math.PI * 2;
    return { x: PASTURE.x + Math.cos(a) * r, z: PASTURE.z + Math.sin(a) * r, face, want: face, speed: 0, walk: 0, t: rand() * 5, shy: false };
  });
  return { sheep, rand };
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// One step. near: [{ x, z }…], whoever's about (the hobbit) for them to shy from.
export function stepFlock(f, dt, { near = [] } = {}) {
  const { rand } = f;
  for (const s of f.sheep) {
    // something close: off at a trot, away from it
    let from = null;
    for (const p of near) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < FLOCK.shy && (!from || d < from.d)) from = { d, p };
    }
    s.shy = Boolean(from);
    if (from) {
      s.want = Math.atan2(-(s.z - from.p.z), s.x - from.p.x);
      s.walk = Math.max(s.walk, 0.8);
    } else {
      s.t -= dt;
      if (s.t <= 0) {
        // a few steps somewhere, or another mouthful
        s.walk = rand() < FLOCK.wander ? 1.5 + rand() * 2 : 0;
        s.want = wrapAngle(s.want + (rand() - 0.5) * 2);
        s.t = 2 + rand() * 4;
      }
    }
    if (s.walk > 0) s.walk = Math.max(0, s.walk - dt);
    s.face = wrapAngle(s.face + wrapAngle(s.want - s.face) * (1 - Math.exp(-FLOCK.turn * dt)));
    const goal = s.walk > 0 ? (s.shy ? FLOCK.trot : FLOCK.walk) : 0;
    s.speed += (goal - s.speed) * (1 - Math.exp(-FLOCK.pace * dt));
    if (s.speed < 1e-3 && goal === 0) s.speed = 0;
    let x = s.x + Math.cos(s.face) * s.speed * dt;
    let z = s.z - Math.sin(s.face) * s.speed * dt;
    const r = Math.hypot(x - PASTURE.x, z - PASTURE.z);
    if (r > PASTURE.r) {
      // the wall: kept in, and turned back in towards the middle
      x = PASTURE.x + ((x - PASTURE.x) / r) * PASTURE.r;
      z = PASTURE.z + ((z - PASTURE.z) / r) * PASTURE.r;
      s.want = Math.atan2(-(PASTURE.z - z), PASTURE.x - x) + (rand() - 0.5) * 0.8;
    }
    s.x = x;
    s.z = z;
  }
  return f;
}

// ── 2. Smoke rings ──
// On the bench, looking out over the Shire. Gandalf's big ring drifts across
// a plane a few metres out (u across, v up, in metres); yours take a moment to
// get there, so lead it. Three through his, in eight puffs.

export const RINGS = { puffs: 8, need: 3, flight: 1.35, depth: 4.2, his: 0.62, mine: 0.2, u: 2.4, v0: 0.2, v1: 2.4 };

export function newRings(seed = 1) {
  const rand = seeded(seed);
  return { t: 0, puffs: RINGS.puffs, hits: 0, mine: [], his: hisRing(rand), rand, state: 'on' };
}
function hisRing(rand) {
  const side = rand() < 0.5 ? -1 : 1;
  return { u: side * (RINGS.u - 0.3), v: RINGS.v0 + 0.5 + rand() * 1.2, vu: -side * (0.35 + rand() * 0.3), vv: (rand() - 0.5) * 0.3, r: RINGS.his, age: 0, bob: rand() * 6 };
}
// a puff aimed at (u, v)
export function puff(s, u, v) {
  if (s.state !== 'on' || s.puffs <= 0 || s.mine.length >= 2) return false;
  s.puffs -= 1;
  s.mine.push({ t: 0, u: Math.max(-RINGS.u, Math.min(RINGS.u, u)), v: Math.max(RINGS.v0, Math.min(RINGS.v1, v)) });
  return true;
}
// where Gandalf's ring will be, `ahead` seconds on (for drawing, and aiming help)
export function hisAt(his, ahead = 0) {
  const t = his.age + ahead;
  return { u: his.u + his.vu * ahead, v: his.v + his.vv * ahead + Math.sin(t * 1.3 + his.bob) * 0.12, r: his.r * (1 + t * 0.03) };
}
// one step: events 'through', 'miss', 'new' (his next ring), 'won', 'out'
export function stepRings(s, dt) {
  const ev = [];
  if (s.state !== 'on') return ev;
  s.t += dt;
  const his = s.his;
  his.age += dt;
  his.u += his.vu * dt;
  his.v += his.vv * dt;
  if (his.v < RINGS.v0 + 0.3 || his.v > RINGS.v1 - 0.2) his.vv *= -1;
  for (let i = s.mine.length - 1; i >= 0; i--) {
    const m = s.mine[i];
    m.t += dt;
    if (m.t < RINGS.flight) continue;
    s.mine.splice(i, 1);
    const at = hisAt(his);
    const off = Math.hypot(m.u - at.u, m.v - at.v);
    if (off < at.r - RINGS.mine * 0.2) {
      s.hits += 1;
      ev.push({ type: 'through', hits: s.hits, off });
      s.his = hisRing(s.rand);
      ev.push({ type: 'new' });
    } else ev.push({ type: 'miss', off });
  }
  if (Math.abs(s.his.u) > RINGS.u + 0.8 || s.his.age > 11) {
    s.his = hisRing(s.rand);
    ev.push({ type: 'new' });
  }
  if (s.hits >= RINGS.need) {
    s.state = 'won';
    ev.push({ type: 'won' });
  } else if (s.puffs <= 0 && s.mine.length === 0) {
    s.state = 'out';
    ev.push({ type: 'out' });
  }
  return ev;
}

// ── 3. Gandalf's fireworks ──
// Click the sky to send a rocket up; the party cheers each burst, more for a
// colour it hasn't just seen, a new part of the sky, and a quick run of them.
// The cheer drains as it waits. Fill it in time and Merry and Pippin light
// the dragon. Sky spots are (u, v): u -1 … 1 across, v 0 … 1 up.

export const SHOW = { time: 40, start: 0.22, drain: 0.05, base: 0.075, fresh: 0.055, spread: 0.045, quick: 0.03, quickGap: 0.85, flight: 0.9, cooldown: 0.22, dragon: 7.5 };
export const COLOURS = ['gold', 'green', 'red', 'blue', 'white'];

export const newShow = () => ({ t: 0, cheer: SHOW.start, rockets: [], recent: [], streak: 0, lastBurst: -9, lastLaunch: -9, state: 'on', dragonT: 0 });

export function launch(show, u, v, colour) {
  if (show.state !== 'on' || show.t - show.lastLaunch < SHOW.cooldown) return false;
  show.lastLaunch = show.t;
  show.rockets.push({ t: 0, u: Math.max(-1, Math.min(1, u)), v: Math.max(0.15, Math.min(1, v)), colour: COLOURS.includes(colour) ? colour : 'gold' });
  return true;
}

// what a burst is worth, given the last few
export function burstScore(recent, b, gap) {
  let s = SHOW.base;
  const last2 = recent.slice(-2).map((r) => r.colour);
  if (!last2.includes(b.colour)) s += SHOW.fresh;
  const near = recent.slice(-3).some((r) => Math.hypot(r.u - b.u, (r.v - b.v) * 1.4) < 0.32);
  if (!near) s += SHOW.spread;
  if (gap < SHOW.quickGap) s += SHOW.quick;
  return s;
}

// one step: events 'burst' { colour, u, v, score }, 'dragon', 'done', 'over'
export function stepShow(show, dt) {
  const ev = [];
  show.t += dt;
  if (show.state === 'dragon') {
    show.dragonT += dt;
    if (show.dragonT >= SHOW.dragon) {
      show.state = 'done';
      ev.push({ type: 'done' });
    }
    return ev;
  }
  if (show.state !== 'on') return ev;
  for (let i = show.rockets.length - 1; i >= 0; i--) {
    const r = show.rockets[i];
    r.t += dt;
    if (r.t < SHOW.flight) continue;
    show.rockets.splice(i, 1);
    const gap = show.t - show.lastBurst;
    const score = burstScore(show.recent, r, gap);
    show.streak = gap < SHOW.quickGap ? show.streak + 1 : 0;
    show.lastBurst = show.t;
    show.recent.push({ colour: r.colour, u: r.u, v: r.v });
    if (show.recent.length > 6) show.recent.shift();
    show.cheer = Math.min(1, show.cheer + score);
    ev.push({ type: 'burst', colour: r.colour, u: r.u, v: r.v, score });
  }
  if (show.cheer >= 1) {
    show.state = 'dragon';
    show.rockets.length = 0;
    ev.push({ type: 'dragon' });
    return ev;
  }
  show.cheer = Math.max(0, show.cheer - SHOW.drain * dt);
  if (show.cheer <= 0 || show.t >= SHOW.time) {
    show.state = 'over';
    ev.push({ type: 'over' });
  }
  return ev;
}

// ── 4. Keep it secret, keep it safe ──
// Inside Bag End, in order: the envelope on the mantel, the Ring into the
// fire, the letters, out with the tongs.
export const RING_STEPS = ['envelope', 'fire', 'letters', 'safe'];
export const nextRingStep = (step) => RING_STEPS[Math.min(RING_STEPS.length - 1, RING_STEPS.indexOf(step) + 1)];
// what each step says, the button that does it, and (`who`) whose words are in it
export const INSIDE_TEXT = {
  envelope: { say: 'Bilbo has gone. On the mantelpiece is an envelope with your name on it.', act: 'Open it' },
  fire: { say: 'A plain gold ring. Gandalf says, “Throw it in the fire.”', act: 'Throw it in the fire', who: 'gandalf' },
  letters: { say: 'Letters in a fiery script come up round the band, and Gandalf goes very still.', act: 'Take it out with the tongs' },
  safe: { say: 'Gandalf: “Keep it secret. Keep it safe.”', act: null, who: 'gandalf' },
};

// Wearing the Ring: the longer it's on, the nearer the Eye. At the top it
// comes off by itself.
export const RING = { gaze: 0.16, ease: 0.3 };
export const stepGaze = (gaze, wearing, dt) => Math.max(0, Math.min(1, gaze + (wearing ? RING.gaze : -RING.ease) * dt));

// ── 5. Get off the road! ──
// Hoofbeats first, then the Rider comes down the East Road towards Hobbiton,
// stops by the old tree and sniffs, then rides on. Be in the hollow under
// the roots, keep still, and don't put the Ring on.

export const RIDER = { warn: 2.6, speed: 4.4, sniff: 6.5, sees: 9, path: [[76, 14.6], [56, 3.4], [45, -4], [28, -4]], stopAt: [54.2, 2.2] };
const RIDER_LEGS = RIDER.path.slice(1).map((b, i) => {
  const a = RIDER.path[i];
  return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
});
const RIDER_LEN = RIDER_LEGS.reduce((n, l) => n + l.len, 0);
// how far along the road the Rider stops
const STOP_S = (() => {
  let best = 0;
  let bestD = Infinity;
  for (let s = 0; s < RIDER_LEN; s += 0.25) {
    const p = riderAt(s);
    const d = Math.hypot(p.x - RIDER.stopAt[0], p.z - RIDER.stopAt[1]);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
})();
export function riderAt(s) {
  let left = Math.max(0, Math.min(RIDER_LEN, s));
  for (const l of RIDER_LEGS) {
    if (left <= l.len) {
      const k = left / l.len;
      return { x: l.a[0] + (l.b[0] - l.a[0]) * k, z: l.a[1] + (l.b[1] - l.a[1]) * k, face: Math.atan2(-(l.b[1] - l.a[1]), l.b[0] - l.a[0]) };
    }
    left -= l.len;
  }
  const last = RIDER_LEGS[RIDER_LEGS.length - 1];
  return { x: last.b[0], z: last.b[1], face: Math.atan2(-(last.b[1] - last.a[1]), last.b[0] - last.a[0]) };
}
export const hidden = (h) => Math.hypot(h.x - HOLLOW.x, h.z - HOLLOW.z) < HOLLOW.r;
// whether the Rider's ride starts: you have the Ring and you've come out
// along the East Road
export const riderTrigger = (h) => h.x > 41 && h.x < 60 && Math.hypot(h.x - HOLLOW.x, h.z - HOLLOW.z) < 22;

export const newRider = () => ({ t: 0, s: 0, phase: 'warn', sniffT: 0, pull: 0 });

// one step: events 'coming', 'sniff', 'found', 'gone'. wearing: the Ring's on.
export function stepRider(r, h, wearing, dt) {
  const ev = [];
  r.t += dt;
  if (r.phase === 'warn') {
    if (r.t >= RIDER.warn) {
      r.phase = 'coming';
      ev.push({ type: 'coming' });
    }
    return ev;
  }
  const at = riderAt(r.s);
  const near = Math.hypot(h.x - at.x, h.z - at.z);
  const seen = !hidden(h) || wearing;
  if (r.phase === 'coming') {
    r.s = Math.min(STOP_S, r.s + RIDER.speed * dt);
    if (wearing || (seen && near < RIDER.sees)) {
      r.phase = 'found';
      ev.push({ type: 'found', why: wearing ? 'ring' : 'seen' });
    } else if (r.s >= STOP_S) {
      r.phase = 'sniff';
      ev.push({ type: 'sniff' });
    }
  } else if (r.phase === 'sniff') {
    r.sniffT += dt;
    r.pull = Math.min(1, r.sniffT / RIDER.sniff);
    if (seen || h.speed > 0.6) {
      r.phase = 'found';
      ev.push({ type: 'found', why: wearing ? 'ring' : h.speed > 0.6 ? 'moved' : 'seen' });
    } else if (r.sniffT >= RIDER.sniff) {
      r.phase = 'leaving';
      ev.push({ type: 'leaving' });
    }
  } else if (r.phase === 'leaving') {
    r.s += RIDER.speed * 1.4 * dt;
    if (wearing && near < RIDER.sees) {
      r.phase = 'found';
      ev.push({ type: 'found', why: 'ring' });
    } else if (r.s >= RIDER_LEN) {
      r.phase = 'gone';
      ev.push({ type: 'gone' });
    }
  }
  return ev;
}
// where you're put back when the Rider finds you
export const RIDER_RETRY = { x: 42, z: -4, face: 0 };

// ── On the side: Bilbo's spoons ──
// Bilbo never did forgive the Sackville-Bagginses for his spoons, so before
// the party he hid the best of the silver about Hobbiton, and Lobelia has
// guessed. She goes round the hiding places in her own order, umbrella and
// all. Get to each one first, two spoons to a waistcoat pocket, and bring
// them up to Bag End's gate. Five home and she's beaten; if she pockets
// two, she's won. Optional: it opens nothing and nothing waits on it.

// where Lobelia stands, at the foot of Bag End's path, when she isn't out
export const LOBELIA = { x: -12, z: -6.7, face: -Math.PI / 2 };
// the task, for the list (it isn't one of QUESTS, so the story never waits on it)
export const SIDE = { id: 'spoons', name: 'Bilbo’s spoons', where: 'Lobelia, at the foot of Bag End’s path', at: { x: -12, z: -4.9 }, blurb: 'Beat Lobelia Sackville-Baggins to the silver spoons Bilbo hid about Hobbiton.' };
export const LOBELIA_LINES = {
  before: ['Bilbo Baggins has hidden the good silver about the place, I know he has. Well, I shall find it.', 'Bag End should have come to us, by rights. Otho says so.', 'Don’t you look at me like that, young Frodo. I’m only taking the air.'],
  after: ['Hmph. Spoons! As if I wanted his old spoons.', 'You’re as bad as your cousin Bilbo, Frodo Baggins. Worse!'],
};
// The toasts where someone says something aloud (in “quotes”; the rest of a
// toast is narration, and isn't said): who says it, and the toast.
export const SAYS = {
  spoons: { who: 'lobelia', text: '“Bilbo’s hidden the good silver about Hobbiton, I know he has,” says Lobelia, and off she goes. Beat her to the spoons: two to a pocket, up to Bag End’s gate. Five home wins.' },
  finders: { who: 'lobelia', text: 'Two spoons in Lobelia’s bag, and that’s that. “Finders keepers,” she says. Ask her again, and she’ll ‘find’ them back.' },
  through: { who: 'gandalf', text: 'Through again! “Well, Frodo Baggins!”' },
};
export const SPOONS = { pocket: 2, need: 5, lose: 2, reach: 1.3, take: 0.9, wait: 2.5, speed: 2.7, home: { x: BAG_END.x, z: BAG_END.z + 8.1, r: 2.5 } };
export const SPOON_SPOTS = [
  { id: 'hedge', where: 'where the lane turns off for Maggot’s', x: -29.4, z: -4.6 },
  { id: 'mill', where: 'by the mill door', x: -18.2, z: 7.1 },
  { id: 'reeds', where: 'in the reeds by the pond', x: -1.5, z: 5.3 },
  { id: 'bridge', where: 'on the bridge', x: 12, z: 13.4 },
  { id: 'dragon', where: 'on the Green Dragon’s step', x: 17.4, z: 29.4 },
  { id: 'tree', where: 'in the roots of the Party Tree', x: 17.6, z: -16.8 },
];
// her round, along the lanes: west to the hedge, the mill, the pond, over
// the bridge to the Green Dragon, back up to the Party Tree, and home
const LOBELIA_ROUTE = [
  [LOBELIA.x, LOBELIA.z],
  [-13.2, -4.6],
  [-29.4, -4.6],
  [-14.2, -3.6],
  [-19.3, 7],
  [-18.2, 7.1],
  [-1.5, 5.3],
  [11.4, 5.6],
  [12, 13.4],
  [12, 20.4],
  [14, 28.8],
  [17.4, 29.4],
  [14, 28.8],
  [12, 20.4],
  [12, 10.4],
  [11, -4],
  [14.6, -10.4],
  [17.6, -16.8],
  [14.6, -10.4],
  [8, -4.2],
  [-10.4, -4.2],
  [LOBELIA.x, LOBELIA.z],
];

// Where something walking a path of [x, z] points is, `s` metres along it.
function along(path, s) {
  let left = Math.max(0, s);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= len && len > 0) {
      const k = left / len;
      return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, face: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) };
    }
    left -= len;
  }
  const [a, b] = path.slice(-2);
  return { x: b[0], z: b[1], face: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) };
}
const pathLength = (path) => path.slice(1).reduce((n, b, i) => n + Math.hypot(b[0] - path[i][0], b[1] - path[i][1]), 0);
export const LOBELIA_LEN = pathLength(LOBELIA_ROUTE);
export const lobeliaAt = (s) => along(LOBELIA_ROUTE, s);

export const newSpoons = () => ({ t: 0, s: 0, carried: [], home: [], hers: [], state: 'on', full: -9 });
// whether spoon i is still where Bilbo hid it
export const spoonLeft = (sp, i) => !sp.carried.includes(i) && !sp.home.includes(i) && !sp.hers.includes(i);
// where she is, or at her post when she isn't out
export const lobeliaNow = (sp) => (sp && sp.state === 'on' ? lobeliaAt(sp.s) : { x: LOBELIA.x, z: LOBELIA.z, face: LOBELIA.face });

// One step: events 'found' { i, carried }, 'full' (your pockets are, and
// there's one at your feet), 'pocketed' { i, hers } (she got there first),
// 'home' { n, home }, 'won', 'lost'. h: the hobbit.
export function stepSpoons(sp, h, dt) {
  const ev = [];
  if (sp.state !== 'on') return ev;
  sp.t += dt;
  if (sp.t > SPOONS.wait) sp.s = Math.min(LOBELIA_LEN, sp.s + SPOONS.speed * dt);
  const her = lobeliaAt(sp.s);
  SPOON_SPOTS.forEach((p, i) => {
    if (!spoonLeft(sp, i)) return;
    if (Math.hypot(h.x - p.x, h.z - p.z) < SPOONS.reach) {
      if (sp.carried.length < SPOONS.pocket) {
        sp.carried.push(i);
        ev.push({ type: 'found', i, carried: sp.carried.length });
        return;
      }
      if (sp.t - sp.full > 3) {
        sp.full = sp.t;
        ev.push({ type: 'full', i });
      }
    }
    if (Math.hypot(her.x - p.x, her.z - p.z) < SPOONS.take) {
      sp.hers.push(i);
      ev.push({ type: 'pocketed', i, hers: sp.hers.length });
    }
  });
  const home = SPOONS.home;
  if (sp.carried.length && Math.hypot(h.x - home.x, h.z - home.z) < home.r) {
    sp.home.push(...sp.carried);
    ev.push({ type: 'home', n: sp.carried.length, home: sp.home.length });
    sp.carried = [];
  }
  if (sp.home.length >= SPOONS.need) {
    sp.state = 'won';
    ev.push({ type: 'won' });
  } else if (sp.hers.length >= SPOONS.lose) {
    sp.state = 'lost';
    ev.push({ type: 'lost' });
  }
  return ev;
}

// ── the camera ──
// The camera sits at `yaw` round the hobbit (0 is due south of him, looking
// north). Forward on the keys is away from the camera.
export function cameraMove(yaw, forward, right) {
  return { x: -Math.sin(yaw) * forward + Math.cos(yaw) * right, z: -Math.cos(yaw) * forward - Math.sin(yaw) * right };
}
// the yaw that puts the camera behind a hobbit facing `face`
export const behindYaw = (face) => Math.atan2(-Math.cos(face), Math.sin(face));
