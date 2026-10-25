// The neighbourhood round the Smiths' street: what used to be lawn out to
// the hedges is a town now. Two cross roads (north–south, at CROSS) and two
// back roads (east–west, at BACK) make blocks of it; houses line them, a park
// with a pond and a bandstand fills the block north of the Smiths' back
// yards, and a row of shops with a cinema, a parking lot and a water tower
// the block south of the school's. Pure data, no three.js: ./rules.js reads
// what's in the way and what there is to touch, ./street.js and
// ./town/scene.js draw it. The main road, its houses and everything on it
// are rules.js's, as they were.
//
// Headings: a house's `turn` is street.js's (0: its front to the south, +z);
// a person's `face` is rules.js's (0 east, π/2 north). +z is south.

// the street as it was first laid out (the trees along it are drawn from this, so they keep their places)
export const LANE = { x0: -150, x1: 150, z0: -55, z1: 55 };
// the street and its town, out to the hedges
export const TOWN = { x0: -150, x1: 150, z0: -150, z1: 150 };

// a side road: 8 m of asphalt, level with the lawns, and 2 m of sidewalk either side
export const SIDE = { w: 8, walk: 2 };
const HALF = SIDE.w / 2 + SIDE.walk; // 6: from a side road's middle to its sidewalk's outer edge
export const CROSS = [-91, 91]; // the cross roads' x
export const BACK = [-62, 62]; // the back roads' z
const MAIN = 7; // the main road's sidewalks' outer edge (rules.js's ROAD: 5 m of asphalt and 2 of sidewalk either side)

// ── the roads ──
// Rectangles { id, x0, x1, z0, z1, kind: 'road' | 'walk' }: the cross roads
// stop at the main road's sidewalk, the back roads run hedge to hedge; a
// sidewalk stops where it meets a road across it.
const rect = (id, kind, x0, x1, z0, z1) => ({ id, kind, x0, x1, z0, z1 });
const spans = (from, to, cuts) => {
  // [from, to] with each [a, b] in `cuts` taken out
  const out = [];
  let at = from;
  for (const [a, b] of [...cuts].sort((p, q) => p[0] - q[0])) {
    if (b <= at || a >= to) continue;
    if (a > at) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < to) out.push([at, to]);
  return out;
};
export const ROADS = [
  ...CROSS.flatMap((c, i) => [
    ...[
      [TOWN.z0, -MAIN],
      [MAIN, TOWN.z1],
    ].map(([z0, z1], j) => rect(`cross${i}-${j}`, 'road', c - SIDE.w / 2, c + SIDE.w / 2, z0, z1)),
    ...[-1, 1].flatMap((s) =>
      [
        ...spans(TOWN.z0, -MAIN, BACK.map((b) => [b - SIDE.w / 2, b + SIDE.w / 2])),
        ...spans(MAIN, TOWN.z1, BACK.map((b) => [b - SIDE.w / 2, b + SIDE.w / 2])),
      ].map(([z0, z1], j) => rect(`cross${i}-walk${s < 0 ? 'w' : 'e'}${j}`, 'walk', s < 0 ? c - HALF : c + SIDE.w / 2, s < 0 ? c - SIDE.w / 2 : c + HALF, z0, z1)),
    ),
  ]),
  ...BACK.flatMap((b, i) => [
    rect(`back${i}`, 'road', TOWN.x0 - 20, TOWN.x1 + 20, b - SIDE.w / 2, b + SIDE.w / 2),
    ...[-1, 1].flatMap((s) =>
      spans(TOWN.x0 - 20, TOWN.x1 + 20, CROSS.map((c) => [c - SIDE.w / 2, c + SIDE.w / 2])).map(([x0, x1], j) =>
        rect(`back${i}-walk${s < 0 ? 'n' : 's'}${j}`, 'walk', x0, x1, s < 0 ? b - HALF : b + SIDE.w / 2, s < 0 ? b - SIDE.w / 2 : b + HALF),
      ),
    ),
  ]),
];
export const onRoad = (x, z, pad = 0) => ROADS.some((r) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad);

// ── the hedge's gaps ──
// Where a road runs out through the hedge, closed with striped barriers as
// the main road is: [from, to] along each side (x for north and south, z
// for west and east).
export const GAPS = {
  ns: CROSS.map((c) => [c - HALF, c + HALF]),
  we: [[-MAIN, MAIN], ...BACK.map((b) => [b - HALF, b + HALF])],
};

// ── the blocks ──
// the park, north of the Smiths' back yards, and the shops, south of the school's
export const PARK = { x0: -68, x1: 68, z0: -146, z1: -70 };
export const SHOPS_BLOCK = { x0: -68, x1: 68, z0: 70, z1: 146 };

// ── the houses ──
// Drawn as the street's neighbours are (./buildings.js's designs), 12 m wide
// and 10 deep, each with a drive from its front to the road. Along the cross
// roads, both sides, facing the road, but where the main road's houses and
// the back roads are; along the back roads, between them and the main
// road's back yards, facing the back road, but where the Gotron stands.
const LOOKS = ['colonial', 'ranch', 'colonial', 'ranch', 'ranch', 'colonial'];
const TINTS = [0xe9c9a1, 0xb7d3c6, 0xe7b8b0, 0xc2cfe6, 0xf0dd9a, 0xd9bfd8, 0xf2e6cf, 0xc9dfb0, 0xf0a0a8];
const ROOFS = [0x5d5f6c, 0x6e4a36, 0x7a4038, 0x56606e, 0x4f5a52, 0x6b4c3b];
const HOUSE = { w: 12, d: 10 };
const ALONG_CROSS = [36, 80, 98, 116, 134].flatMap((z) => [-z, z]);
const ALONG_BACK = { '-1': [-58, -40, -22, -4, 14, 32, 50], 1: [-58, -40, -24, 22, 40, 58] };
let n = 0;
const house = (id, x, z, turn, drive) => {
  const i = n++;
  // (its footprint: w across its front, d deep; turned a quarter, they swap on the ground)
  const side = Math.abs(Math.sin(turn)) > 0.5;
  return { id, x, z, turn, w: side ? HOUSE.d : HOUSE.w, d: side ? HOUSE.w : HOUSE.d, h: 5.5, roof: 8, look: LOOKS[i % LOOKS.length], tint: TINTS[(i * 4) % TINTS.length], roofTint: ROOFS[(i * 5) % ROOFS.length], drive };
};
export const TOWN_HOUSES = [
  // the cross roads': 16 m from the road's middle, the drive on their south side
  ...CROSS.flatMap((c, i) =>
    [-1, 1].flatMap((s) =>
      ALONG_CROSS.map((z) => {
        const x = c + s * 16;
        // (front to the road: west for those east of it, east for those west)
        const front = c + s * (16 - HOUSE.d / 2);
        return house(`town-c${i}${s < 0 ? 'w' : 'e'}${z < 0 ? 'n' : 's'}${Math.abs(z)}`, x, z, s < 0 ? Math.PI / 2 : -Math.PI / 2, { x0: Math.min(front, c + s * HALF), x1: Math.max(front, c + s * HALF), z0: z + 3, z1: z + 6 });
      }),
    ),
  ),
  // the back roads': 16 m in from the road's middle, toward the main road
  ...BACK.flatMap((b, i) => {
    const s = Math.sign(b);
    return ALONG_BACK[s].map((x) => {
      const z = b - s * 16;
      const front = b - s * (16 - HOUSE.d / 2);
      return house(`town-b${i}x${x}`, x, z, s < 0 ? Math.PI : 0, { x0: x + 3, x1: x + 6, z0: Math.min(front, b - s * HALF), z1: Math.max(front, b - s * HALF) });
    });
  }),
];

// ── the park ──
// A pond in the middle (an ellipse: in the way, and Morty's stones skip on
// it), a gravel path round it and up from the back road, a bandstand on the
// east lawn, a statue where the path comes in, flowerbeds and rocks.
export const POND = { x: -12, z: -110, rx: 22, rz: 13 };
export const PATH_RING = { x: POND.x, z: POND.z, rx: POND.rx + 7, rz: POND.rz + 6, w: 2.2 };
// (its floor a step up off the lawn, its roof on eight posts round the rim)
export const BANDSTAND = { x: 38, z: -104, r: 5, h: 0.3, posts: 8 };
export const STATUE = { x: 6, z: -79, r: 1.1, face: Math.PI };
// where the path up from the back road meets the ring, on its south side
const RING_AT_0 = PATH_RING.z + PATH_RING.rz * Math.sqrt(1 - ((0 - PATH_RING.x) / PATH_RING.rx) ** 2);
// the paths as straight pieces [x0, z0, x1, z1] (the ring is drawn round PATH_RING)
export const PATHS = [
  [0, PARK.z1, 0, RING_AT_0],
  [PATH_RING.x + PATH_RING.rx, POND.z, BANDSTAND.x - BANDSTAND.r, BANDSTAND.z],
  [BANDSTAND.x, BANDSTAND.z + BANDSTAND.r, BANDSTAND.x + 8, PARK.z1],
];
// whether (x, z) is in the pond, `pad` metres out from its edge
export const inPond = (x, z, pad = 0) => ((x - POND.x) / (POND.rx + pad)) ** 2 + ((z - POND.z) / (POND.rz + pad)) ** 2 <= 1;
// where Morty stands to skip a stone: the south shore, on the ring path, facing north over the water
export const SKIP_AT = { x: POND.x + 4, z: POND.z + POND.rz + 1.6, face: Math.PI / 2 };
export const FLOWERBEDS = [
  { x: -8, z: -84, r: 2.4 },
  { x: 8, z: -84, r: 2.4 },
  { x: 54, z: -86, r: 3 },
  { x: -50, z: -132, r: 3 },
  { x: 24, z: -132, r: 2.6 },
];
export const ROCKS = [
  [-32, -104, 1.2],
  [-34, -112, 0.9],
  [6, -121, 1.1],
  [9, -100, 0.8],
  [-20, -97.5, 0.7],
];

// ── the shops ──
// A row facing north onto the south back road, each a box of a shop with
// its name over the window (the names are the site's own); the cinema in
// the middle, taller, with its marquee. Behind them a parking lot and the
// water tower.
const ROW_Z = 80;
export const SHOPS = [
  { id: 'plumbusplus', name: 'PLUMBUS PLUS', x: -52, w: 22, h: 6, tint: 0xd9b26a, awning: 0x3a7ac8 },
  { id: 'szechuan', name: 'SZECHUAN PALACE', x: -27, w: 22, h: 6, tint: 0xc84a3a, awning: 0xf2c84a },
  { id: 'cinema', name: 'THE HERPSON', x: 0, w: 26, h: 9.5, tint: 0x6a3a7a, awning: null },
  { id: 'fleeb', name: 'FLEEB JUICE', x: 27, w: 22, h: 6, tint: 0x7ac8a0, awning: 0xe85a8a },
  { id: 'pawn', name: 'PAWN & LOAN', x: 52, w: 22, h: 6, tint: 0xa8a49a, awning: 0x5a8a3a },
].map((s) => ({ ...s, z: ROW_Z, d: 14, front: ROW_Z - 7 }));
export const LOT = { x0: -60, x1: 60, z0: 94, z1: 122 };
export const LOT_CARS = [
  { id: 'lotcar0', x: -48, z: 100, tint: 0xc84a3a },
  { id: 'lotcar1', x: -30, z: 100, tint: 0xe9dcc6 },
  { id: 'lotcar2', x: 6, z: 100, tint: 0x3a6ab8 },
  { id: 'lotcar3', x: 34, z: 116, tint: 0xa8acb0 },
  { id: 'lotcar4', x: -12, z: 116, tint: 0x5a8a4a },
].map((c) => ({ ...c, w: 2.2, d: 4.6 }));
export const WATER_TOWER = { x: 50, z: 134, r: 4.5, legs: 3.6, h: 22 };

// ── the trees, the lights and the signs ──
// Street lights along the side roads, on the sidewalks' outer edges, every
// 24 m or so, clear of the junctions and the drives; a stop sign where each
// side road meets another.
export const LIGHTS = (() => {
  const out = [];
  const clear = (x, z) => !TOWN_HOUSES.some((h) => h.drive && x > h.drive.x0 - 1.2 && x < h.drive.x1 + 1.2 && z > h.drive.z0 - 1.2 && z < h.drive.z1 + 1.2);
  for (const c of CROSS)
    for (let z = TOWN.z0 + 12; z < TOWN.z1 - 6; z += 24) {
      if (Math.abs(z) < MAIN + 4 || BACK.some((b) => Math.abs(z - b) < HALF + 4)) continue;
      const x = c + (z < 0 ? -1 : 1) * (HALF - 0.4);
      if (clear(x, z)) out.push({ id: `light-c${c}z${z}`, x, z, face: z < 0 ? 0 : Math.PI });
    }
  for (const b of BACK)
    for (let x = TOWN.x0 + 10; x < TOWN.x1 - 6; x += 24) {
      if (CROSS.some((c) => Math.abs(x - c) < HALF + 4)) continue;
      const z = b + (b < 0 ? 1 : -1) * (HALF - 0.4);
      if (clear(x, z)) out.push({ id: `light-b${b}x${x}`, x, z, face: b < 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  return out;
})();
export const SIGNS = [
  // where the cross roads come out onto the main road, and where they cross the back roads
  ...CROSS.flatMap((c) => [-1, 1].map((s) => ({ id: `stop-c${c}m${s}`, x: c + SIDE.w / 2 + 0.6, z: s * (MAIN + 0.8), face: s < 0 ? -Math.PI / 2 : Math.PI / 2 }))),
  ...CROSS.flatMap((c) => BACK.map((b) => ({ id: `stop-c${c}b${b}`, x: c - HALF + 0.5, z: b - Math.sign(b) * (HALF + 0.5), face: b < 0 ? Math.PI / 2 : -Math.PI / 2 }))),
];

// ── the missing-cat posters ──
// Five of them, one on a street light at each corner of town and one by
// the bandstand: read every one and the cat's story is told (the `posters`
// thing to do). Each is a hotspot on the light's sidewalk side.
// (four on the street lights nearest the town's corners, read from the
// sidewalk beside the post; the fifth on the bandstand's south-west post)
const POSTER_AT = [
  [-91, -130],
  [91, -100],
  [-91, 106],
  [91, 130],
];
const lightNear = ([x, z]) => LIGHTS.reduce((a, l) => (Math.hypot(l.x - x, l.z - z) < Math.hypot(a.x - x, a.z - z) ? l : a));
export const POSTERS = [
  ...POSTER_AT.map(lightNear).map((l, i) => {
    // (the side of the post toward the road's middle)
    const c = CROSS.find((cx) => Math.abs(l.x - cx) < HALF);
    return { id: `poster${i + 1}`, x: l.x + (l.x < c ? 0.7 : -0.7), z: l.z, on: l.id };
  }),
  { id: 'poster5', x: BANDSTAND.x - (BANDSTAND.r + 0.9) * Math.SQRT1_2, z: BANDSTAND.z + (BANDSTAND.r + 0.9) * Math.SQRT1_2, on: 'bandstand' },
];

// ── what's in the way ──
// Plain shapes for rules.js: { kind: 'box', id, x, z, w, d, turn? } or
// { kind: 'circle', id, x, z, r }.
const box = (id, x, z, w, d, turn = 0) => ({ kind: 'box', id, x, z, w, d, turn });
const circle = (id, x, z, r) => ({ kind: 'circle', id, x, z, r });
// the pond as a run of circles along its long axis, each inside the
// ellipse (as tall as it is there, and at the ends no wider than the curve
// of its tip), so the shore's within a hand of where the water is
const pondCircles = () => {
  const out = [];
  const k = 9;
  const tip = POND.rx - (POND.rz * POND.rz) / POND.rx; // (the centre of the circle that fits the tip)
  for (let i = 0; i < k; i++) {
    const cx = -tip + (2 * tip * i) / (k - 1);
    const r = Math.min(POND.rz * Math.sqrt(1 - (cx / POND.rx) ** 2), POND.rx - Math.abs(cx)) * 0.98;
    out.push(circle(`pond${i}`, POND.x + cx, POND.z, r));
  }
  return out;
};
export const TOWN_SOLIDS = [
  ...TOWN_HOUSES.map((h) => box(h.id, h.x, h.z, h.w, h.d)),
  ...SHOPS.map((s) => box(`shop-${s.id}`, s.x, s.z, s.w, s.d)),
  ...LOT_CARS.map((c) => box(c.id, c.x, c.z, c.w, c.d)),
  ...pondCircles(),
  // the bandstand's posts round its rim (its floor's a step up, walked onto: TOWN_STEPS)
  ...Array.from({ length: BANDSTAND.posts }, (_, i) => {
    const a = (i / BANDSTAND.posts) * Math.PI * 2 + Math.PI / BANDSTAND.posts;
    return circle(`bandstand-post${i}`, BANDSTAND.x + Math.cos(a) * (BANDSTAND.r - 0.35), BANDSTAND.z + Math.sin(a) * (BANDSTAND.r - 0.35), 0.14);
  }),
  circle('statue', STATUE.x, STATUE.z, STATUE.r),
  ...[0, 1, 2, 3].map((i) => circle(`tower-leg${i}`, WATER_TOWER.x + Math.cos((i * Math.PI) / 2 + Math.PI / 4) * WATER_TOWER.legs, WATER_TOWER.z + Math.sin((i * Math.PI) / 2 + Math.PI / 4) * WATER_TOWER.legs, 0.35)),
  ...LIGHTS.map((l) => circle(l.id, l.x, l.z, 0.2)),
  ...SIGNS.map((s) => circle(s.id, s.x, s.z, 0.12)),
  ...ROCKS.map(([x, z, r], i) => circle(`rock${i}`, x, z, r * 0.8)),
];
// what the cruiser flies over, as rules.js's ROOFS are ({ x, z, w, d, roof }: its footprint and its top)
export const TOWN_ROOFS = [
  ...TOWN_HOUSES.map((h) => ({ id: h.id, x: h.x, z: h.z, w: h.w, d: h.d, roof: h.roof })),
  ...SHOPS.map((s) => ({ id: `shop-${s.id}`, x: s.x, z: s.z, w: s.w, d: s.d, roof: s.h + 0.5 })),
  { id: 'water-tower', x: WATER_TOWER.x, z: WATER_TOWER.z, w: WATER_TOWER.r * 2, d: WATER_TOWER.r * 2, roof: WATER_TOWER.h },
  { id: 'bandstand', x: BANDSTAND.x, z: BANDSTAND.z, w: BANDSTAND.r * 2, d: BANDSTAND.r * 2, roof: BANDSTAND.h + 5.4 },
];
// what Morty steps up onto: the bandstand's floor
export const TOWN_STEPS = [{ id: 'bandstand', kind: 'circle', x: BANDSTAND.x, z: BANDSTAND.z, r: BANDSTAND.r, top: BANDSTAND.h }];

// ── the town's trees ──
// Round puffs as the street's, the same every visit: round the park's edge
// and its lawns, along the shops' lot and in the houses' front gardens.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function treeFitsTown(x, z, { gap = 2 } = {}) {
  if (x < TOWN.x0 + 3 || x > TOWN.x1 - 3 || z < TOWN.z0 + 3 || z > TOWN.z1 - 3) return false;
  // (the main street's own, out to its back yards, is the rules' to plant)
  if (Math.abs(z) < 36) return false;
  if (onRoad(x, z, 1.2)) return false;
  if (inPond(x, z, 3)) return false;
  if (Math.hypot(x - BANDSTAND.x, z - BANDSTAND.z) < BANDSTAND.r + 3) return false;
  if (Math.hypot(x - STATUE.x, z - STATUE.z) < 4) return false;
  if (Math.hypot(x - WATER_TOWER.x, z - WATER_TOWER.z) < WATER_TOWER.legs + 3) return false;
  if (FLOWERBEDS.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 1.5)) return false;
  if (ROCKS.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < r + 1.5)) return false;
  if (x > LOT.x0 - 2 && x < LOT.x1 + 2 && z > LOT.z0 - 2 && z < LOT.z1 + 2) return false;
  if ([...TOWN_HOUSES, ...SHOPS].some((h) => Math.abs(x - h.x) < h.w / 2 + gap && Math.abs(z - h.z) < h.d / 2 + gap)) return false;
  if (TOWN_HOUSES.some((h) => x > h.drive.x0 - 1.5 && x < h.drive.x1 + 1.5 && z > h.drive.z0 - 1.5 && z < h.drive.z1 + 1.5)) return false;
  // (nor on a path, nor in front of a shop)
  if (PATHS.some(([x0, z0, x1, z1]) => segDist(x, z, x0, z0, x1, z1) < 2)) return false;
  const ring = Math.hypot((x - PATH_RING.x) / PATH_RING.rx, (z - PATH_RING.z) / PATH_RING.rz);
  if (Math.abs(ring - 1) * Math.min(PATH_RING.rx, PATH_RING.rz) < 2.2) return false;
  if (SHOPS.some((s) => Math.abs(x - s.x) < s.w / 2 && z > s.front - 5 && z < s.front)) return false;
  if ([...LIGHTS, ...SIGNS, ...POSTERS].some((l) => Math.hypot(x - l.x, z - l.z) < 2)) return false;
  // (the Gotron and its ferret, on the lot behind the houses across the street: ./rules.js's VEHICLES)
  if (x > -19 && x < 14 && z > 36 && z < 50) return false;
  return true;
}
function segDist(px, pz, x0, z0, x1, z1) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
}
export const TOWN_TREES = (() => {
  const rand = seeded(2026);
  const out = [];
  for (let tries = 0; out.length < 110 && tries < 20000; tries++) {
    const x = TOWN.x0 + 3 + rand() * (TOWN.x1 - TOWN.x0 - 6);
    const z = (rand() < 0.5 ? -1 : 1) * (36 + rand() * (TOWN.z1 - 39));
    if (!treeFitsTown(x, z) || out.some((t) => Math.hypot(t.x - x, t.z - z) < 7.5)) continue;
    out.push({ x, z, s: 0.85 + rand() * 0.6, kind: Math.floor(rand() * 3), turn: rand() * Math.PI * 2 });
  }
  return out;
})();

// ── what there is to touch, and who's about ──
// Hotspots as rules.js's spot() takes them: [id, x, z, label, verb]
// (./words.js has what's said); the people as rules.js's PEOPLE are,
// wanderers along paths that cross nothing solid (the town's brains walk
// through what's in the way: ../npc.js, with no solids for the street).
const ringPoint = (a) => [PATH_RING.x + Math.cos(a) * PATH_RING.rx, PATH_RING.z + Math.sin(a) * PATH_RING.rz];
const cinema = SHOPS.find((s) => s.id === 'cinema');
const title = (name) => name.toLowerCase().replace(/(^|\s|&\s)([a-z])/g, (m) => m.toUpperCase());
export const TOWN_SPOTS = [
  ['pond', SKIP_AT.x, SKIP_AT.z, 'The pond', 'Skip a stone'],
  ['bandstand', BANDSTAND.x - (BANDSTAND.r + 0.4) * Math.SQRT1_2, BANDSTAND.z + (BANDSTAND.r + 0.4) * Math.SQRT1_2 + 1.6, 'The bandstand', 'Look'],
  ['statue', STATUE.x - 1.9, STATUE.z, 'The statue', 'Read the plaque'],
  ...SHOPS.filter((s) => s !== cinema).map((s) => [s.id, s.x - 1.5, s.front - 1.4, title(s.name), 'Look in']),
  ['cinema', cinema.x, cinema.front - 1.4, 'The Herpson', 'Buy a ticket'],
  ['watertower', WATER_TOWER.x, WATER_TOWER.z - WATER_TOWER.r - 2.2, 'The water tower', 'Look up'],
  ...POSTERS.map((p) => [p.id, p.x, p.z, 'A poster', 'Read']),
  ['cinemaagent', cinema.x + 6.2, cinema.front - 5.4, 'Federation agent', 'Talk'],
];
export const TOWN_PEOPLE = [
  // Principal Vagina, jogging the ring round the pond
  { id: 'principal-jog', who: 'principal', x: ringPoint(0)[0], z: ringPoint(0)[1], face: Math.PI / 2, ai: { wander: Array.from({ length: 12 }, (_, i) => ringPoint((-i / 12) * Math.PI * 2)), speed: 1.9, pause: 0.2, bark: { r: 4.5, every: 16, lines: ['Morty. Jogging. Don’t make it a thing.', 'The doctor said thirty minutes a day. He didn’t say which thirty.', 'Is that a stone in your hand, Smith? This is a school-free zone. Throw it.'] } } },
  // a Mr. Meeseeks on the pond's west shore, asked to help with the ducks
  { id: 'meeseeks-park', who: 'meeseeks', x: POND.x - POND.rx - 3, z: POND.z, face: 0, ai: { wander: [[POND.x - POND.rx - 3, POND.z], [POND.x - POND.rx - 2.5, POND.z - 5], [POND.x - POND.rx - 3.5, POND.z + 4]], speed: 1.1, pause: 1.5, bark: { r: 5, every: 12, lines: ['I’m Mr. Meeseeks! I’m helping a man feed the ducks!', 'There are no ducks, Morty! Existence is pain without ducks!', 'Can you see any ducks? Look at me! Can you see any ducks?'] } } },
  // the Federation's patrols, one along each back road
  { id: 'patrol-north', who: 'gromflomite', x: -70, z: BACK[0] + 2.6, face: 0, ai: { wander: [[-70, BACK[0] + 2.6], [70, BACK[0] + 2.6]], speed: 1.2, pause: 3, bark: { r: 4, every: 18, lines: ['Move along, citizen.', 'The Federation thanks you for your compliance. Keep complying.'] } } },
  { id: 'patrol-south', who: 'gromflomite', x: 70, z: BACK[1] - 2.6, face: Math.PI, ai: { wander: [[70, BACK[1] - 2.6], [-70, BACK[1] - 2.6]], speed: 1.2, pause: 3, bark: { r: 4, every: 18, lines: ['Papers. No? Fine. Nobody has papers.', 'Earth is a valued member of the Federation. Smile.'] } } },
  // a policeman walking the east cross road's sidewalk up from the main road, asking after the cat
  { id: 'cop-beat', who: 'cop', x: CROSS[1] + SIDE.w / 2 + 0.3, z: 12, face: -Math.PI / 2, ai: { wander: [[CROSS[1] + SIDE.w / 2 + 0.3, 12], [CROSS[1] + SIDE.w / 2 + 0.3, 48]], speed: 0.9, pause: 4, bark: { r: 4.5, every: 18, lines: ['Seen a cat, son? Talks? If he talks to you, walk away.', 'Keep it moving. The Federation says loitering’s for adults now.'] } } },
];
// (the agent at the cinema stands still: a person in the way, talked to)
export const TOWN_STANDING = [{ id: 'cinemaagent', who: 'fedagent', x: cinema.x + 6.2, z: cinema.front - 4, face: Math.PI / 2 }];
// the things to do the town adds (rules.js's TASKS, at the end of the list;
// the pond's `touch`, its hint on a touch screen: rules.js's hintOf)
export const TOWN_TASKS = [
  { id: 'pond', name: 'Skip a stone five times', hint: 'The park’s north of the Smiths’ back yard, past the back road. At the pond, E picks a stone up; E again throws it, with the bar in the green.', touch: 'The park’s north of the Smiths’ back yard, past the back road. At the pond, tap Skip a stone to pick one up, then tap again to throw it, with the bar in the green.' },
  { id: 'posters', name: 'Read every missing-cat poster', hint: 'Someone’s put posters up round town: on four street lights, one near each corner, and on the bandstand. Read all five.' },
];
