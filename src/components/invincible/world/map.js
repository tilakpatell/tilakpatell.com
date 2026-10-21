// The Graysons' city and what's round it, as plain data: where the land is
// and how high, where the water is, every block, tower, house and bridge,
// and the places to go. Pure (no drawing), from a seed, so the flying
// (./flight.js) can bump into exactly what the scene (./scene.js) draws.
//
// Metres, y up, the ground at 0 in town, +z south. Downtown is round the
// origin on a grid of 80 m blocks; the river runs north to south east of
// it into the sea to the south; the suburbs are west, past a green belt;
// the hills rise to the north. Every solid thing is a box ({ x0, x1, z0,
// z1, y0, y1 }), found by `near` through a grid, never by a scan.

export const WORLD = { half: 3200, ceiling: 9000 }; // (fly up through the ceiling and you're in space: ./orbit.js)
// downtown's grid: street centre lines at x = 80i + 40 (and z the same),
// so block i is centred on 80i; a block's lot is 60 m, inside a 4 m pavement
export const GRID = { cell: 80, street: 20, walk: 4 };
export const LOT = (GRID.cell - GRID.street) / 2; // half a lot: 30 m
export const RIVER = { x0: 1050, x1: 1250 };
export const COAST = 2200; // the sea, south of here
export const BEACH = 60; // the sand before it
export const HILLS = -2300; // the land rises north of here
const VALLEY = 450; // how far from its banks the river's valley through the hills reaches
export const WATER_Y = -2.5; // the river and the sea
// the city's blocks: lots wholly inside this
export const CITY = { x0: -1640, x1: 2620, z0: HILLS + 90, z1: COAST - BEACH - 30 };
// the suburbs: N–S streets every 140 m west from x = −1700, E–W every 70 m
export const SUBURB = { x1: -1700, x0: -3100, cx: 140, cz: 70, street: 12 };
export const BRIDGES = [-1160, -440, 360, 1160]; // the streets that cross the river (z)

// ── numbers from a seed ──
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash2 = (i, j, k = 0) => {
  let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(k | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// smooth value noise, about 1 across a `size`
function vnoise(x, z, size) {
  const fx = x / size;
  const fz = z / size;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash2(i, j, 7);
  const b = hash2(i + 1, j, 7);
  const c = hash2(i, j + 1, 7);
  const d = hash2(i + 1, j + 1, 7);
  return a + (b - a) * s(u) + (c - a) * s(v) + (a - b - c + d) * s(u) * s(v);
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ── the land ──

// How high the land is: flat in town, the river's bed, the beach running
// down into the sea, and the hills to the north, which the river has worn a
// valley through (its banks at the town's level, so the embankments meet
// them, and the slopes rising away: not a slot with walls a hill high).
export function groundAt(x, z) {
  if (z > COAST - BEACH) {
    const t = Math.min(1, (z - (COAST - BEACH)) / BEACH);
    return z > COAST ? -10 : -4 * t;
  }
  if (x > RIVER.x0 && x < RIVER.x1) return -8;
  if (z < HILLS) {
    const t = (HILLS - z) / 900;
    const n = vnoise(x, z, 420) * 0.65 + vnoise(x, z, 160) * 0.35;
    const bank = Math.max(RIVER.x0 - x, x - RIVER.x1);
    return Math.pow(Math.min(t, 2.2), 1.3) * (90 + 140 * n) * smooth(0, 0.25, t) * smooth(0, VALLEY, bank);
  }
  return 0;
}

export const waterAt = (x, z) => groundAt(x, z) < WATER_Y;

// What kind of land a point is.
export function zoneAt(x, z) {
  if (z > COAST - BEACH) return z > COAST - BEACH * 0.4 ? 'sea' : 'beach';
  if (x > RIVER.x0 - 15 && x < RIVER.x1 + 15) return 'river';
  if (z < HILLS) return 'hills';
  if (x <= SUBURB.x1 + SUBURB.street / 2 && x >= SUBURB.x0) return 'suburb';
  if (x >= CITY.x0 && x <= CITY.x1 && z >= CITY.z0 && z <= CITY.z1) return 'city';
  return 'green';
}

// The town block a point is in (its lot, inside the pavement), or null on a
// street, the river's banks or outside the city: { i, j, cx, cz, kind }.
export function blockAt(x, z) {
  const i = Math.round(x / GRID.cell);
  const j = Math.round(z / GRID.cell);
  const cx = i * GRID.cell;
  const cz = j * GRID.cell;
  if (Math.abs(x - cx) > LOT || Math.abs(z - cz) > LOT) return null;
  const kind = blockKind(i, j);
  return kind ? { i, j, cx, cz, kind } : null;
}

// 'plaza' (the Guardians' hall), 'park', 'gda', 'lot' (a car park), 'built', or null (no block here)
export function blockKind(i, j) {
  const cx = i * GRID.cell;
  const cz = j * GRID.cell;
  if (cx - LOT < CITY.x0 || cx + LOT > CITY.x1 || cz - LOT < CITY.z0 || cz + LOT > CITY.z1) return null;
  if (cx + LOT > RIVER.x0 - 15 && cx - LOT < RIVER.x1 + 15) return null;
  if (i === 0 && j === 0) return 'plaza';
  if (i === 20 && j === -5) return 'gda';
  if (i === 1 && j === 0) return 'bank'; // the bank, east of the plaza across the street
  if (i >= -4 && i <= -2 && j >= -13 && j <= -9) return 'park'; // the city's big park, north of downtown
  if (i >= 4 && i <= 6 && j >= 18 && j <= 21) return 'park'; // the waterfront park
  const r = hash2(i, j, 1);
  if (r < 0.035) return 'park';
  const d = Math.hypot(cx, cz);
  if (d > 900 && r < 0.035 + (d > 1500 ? 0.12 : 0.05)) return 'lot';
  return 'built';
}

// how downtown a point is: 1 in the middle, to 0 far out
const coreAt = (x, z) => Math.exp(-((Math.hypot(x - 60, z + 80) / 720) ** 2));

// ── the suburbs ──
// block (a, m): a counts west from the arterial at x = −1700, m south from z = 0
export const subBlock = (a, m) => ({ cx: SUBURB.x1 - SUBURB.cx / 2 - SUBURB.cx * a, cz: SUBURB.cz * m, w: SUBURB.cx - SUBURB.street, d: SUBURB.cz - SUBURB.street });
const SUB_A = Math.floor((SUBURB.x1 - SUBURB.x0) / SUBURB.cx); // 10 blocks across
const SUB_M = [Math.ceil((HILLS + 80) / SUBURB.cz), Math.floor((COAST - BEACH - 40) / SUBURB.cz)];

// The places to go: the Graysons' house, the high school, Burger Mart on
// the strip, the Guardians of the Globe's hall downtown and the GDA's
// unmarked block on the east bank.
const HOME = { a: 2, m: 4, lot: 2 };
const SCHOOL = { a: 6, m: -6 };
const FIELD = { a: 6, m: -5 };
const BURGER = { a: 0, m: 10 };
export const PLACES = [
  { id: 'home', name: 'The Graysons’', line: 'Home. Mom’s car is in the drive.' },
  { id: 'school', name: 'The high school', line: 'Senior year. Try not to fly to class.' },
  { id: 'burgermart', name: 'Burger Mart', line: 'Your shift started ten minutes ago.' },
  { id: 'guardians', name: 'The Guardians’ hall', line: 'The Guardians of the Globe meet here. Met here.' },
  { id: 'gda', name: 'The GDA', line: 'An office block nobody notices, which is the point.' },
];

// ── the whole map ──
export function buildWorld(seed = 11) {
  const r = rng(seed);
  const buildings = [];
  const houses = [];
  const shops = [];
  const trees = [];
  const landmarks = [];
  const boxes = [];
  const places = [];
  const box = (b) => {
    const out = { id: boxes.length, y0: 0, ...b };
    boxes.push(out);
    return out;
  };

  // downtown and the city round it
  const i0 = Math.ceil(CITY.x0 / GRID.cell);
  const i1 = Math.floor(CITY.x1 / GRID.cell);
  const j0 = Math.ceil(CITY.z0 / GRID.cell);
  const j1 = Math.floor(CITY.z1 / GRID.cell);
  const lot = LOT * 2;
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const kind = blockKind(i, j);
      const cx = i * GRID.cell;
      const cz = j * GRID.cell;
      if (kind === 'park') {
        for (let k = 0; k < 26; k++) {
          const x = cx + (r() - 0.5) * lot * 0.92;
          const z = cz + (r() - 0.5) * lot * 0.92;
          if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue; // the paths
          trees.push([x, z, 3 + r() * 3, 0]);
        }
        continue;
      }
      if (kind === 'bank') {
        // the bank: on the block's west half, its door on the pavement facing the hall
        const bank = { id: 'bank', x: cx - 12, z: cz, w: 24, d: 24, h: 12 };
        landmarks.push(bank);
        box({ x0: bank.x - bank.w / 2, x1: bank.x + bank.w / 2, z0: bank.z - bank.d / 2, z1: bank.z + bank.d / 2, y1: bank.h, landmark: 'bank' });
        continue;
      }
      if (kind !== 'built') continue;
      const core = coreAt(cx, cz);
      const far = Math.hypot(cx, cz) > 1500;
      // a downtown block is one or two towers; further out, more and smaller
      const roll = r();
      const split = core > 0.6 ? (roll < 0.55 ? 1 : 2) : core > 0.25 ? (roll < 0.3 ? 1 : 2) : far && roll < 0.25 ? 1 : roll < 0.45 ? 3 : 4;
      const parts =
        split === 1
          ? [[0, 0, 1, 1]]
          : split === 2
            ? r() < 0.5
              ? [[-0.25, 0, 0.5, 1], [0.25, 0, 0.5, 1]]
              : [[0, -0.25, 1, 0.5], [0, 0.25, 1, 0.5]]
            : [[-0.25, -0.25, 0.5, 0.5], [0.25, -0.25, 0.5, 0.5], [-0.25, 0.25, 0.5, 0.5], [0.25, 0.25, 0.5, 0.5]];
      for (const [ox, oz, sx, sz] of parts) {
        if (split === 3 && r() < 0.25) continue; // a gap: a yard, a car park
        const inset = 1.5 + r() * 2.5;
        const w = Math.max(9, lot * sx - inset * 2);
        const d = Math.max(9, lot * sz - inset * 2);
        let h;
        if (core > 0.25) h = 30 + core * (120 + r() * 200) * (r() < 0.12 ? 0.4 : 1);
        else if (far && split === 1) h = 8 + r() * 8; // a warehouse
        else h = 9 + r() * 22 + core * 90;
        h = Math.round(Math.min(330, h));
        const roll2 = r();
        const kindW = h > 90 ? (roll2 < 0.7 ? 'glass' : roll2 < 0.9 ? 'stone' : 'concrete') : h > 40 ? (roll2 < 0.4 ? 'glass' : roll2 < 0.75 ? 'stone' : 'concrete') : roll2 < 0.55 ? 'brick' : roll2 < 0.85 ? 'stone' : 'concrete';
        const tall = h > 80;
        const top = tall && r() < 0.6 ? { w: w * (0.55 + r() * 0.2), d: d * (0.55 + r() * 0.2), h: Math.round(Math.min(360 - h, h * (0.12 + r() * 0.28))) } : null;
        const roof = tall && !top && r() < 0.25 ? 'spire' : !tall && kindW !== 'glass' && r() < 0.22 ? 'tank' : 'flat';
        const b = { id: buildings.length, x: cx + ox * lot, z: cz + oz * lot, w, d, h, kind: kindW, tone: r(), roof, top, zone: core > 0.25 ? 'core' : far ? 'outer' : 'mid' };
        buildings.push(b);
        box({ x0: b.x - w / 2, x1: b.x + w / 2, z0: b.z - d / 2, z1: b.z + d / 2, y1: h, building: b.id });
        if (top) box({ x0: b.x - top.w / 2, x1: b.x + top.w / 2, z0: b.z - top.d / 2, z1: b.z + top.d / 2, y0: h, y1: h + top.h, building: b.id });
      }
    }

  // the Guardians' hall, on the plaza at the centre: a domed hall on a podium
  {
    const hall = { id: 'guardians', x: 0, z: 0, w: 34, d: 34, h: 16, dome: 15 };
    landmarks.push(hall);
    box({ x0: -17, x1: 17, z0: -17, z1: 17, y1: 16, landmark: 'guardians' });
    box({ x0: -9, x1: 9, z0: -9, z1: 9, y0: 16, y1: 29, landmark: 'guardians' });
    places.push({ ...PLACES.find((p) => p.id === 'guardians'), x: 0, z: 0, door: [0, 21], face: 0, r: 10 });
  }
  // the GDA: an office block, a hangar and a helipad behind a fence
  {
    const cx = 20 * GRID.cell;
    const cz = -5 * GRID.cell;
    const office = { id: 'gda-office', x: cx - 12, z: cz + 14, w: 32, d: 18, h: 14 };
    const hangar = { id: 'gda-hangar', x: cx + 8, z: cz - 12, w: 40, d: 28, h: 13 };
    landmarks.push(office, hangar, { id: 'gda-pad', x: cx + 18, z: cz + 16, r: 8 });
    for (const b of [office, hangar]) box({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2, y1: b.h, landmark: b.id });
    places.push({ ...PLACES.find((p) => p.id === 'gda'), x: office.x, z: office.z, door: [office.x, office.z + office.d / 2 + 4], face: 0, r: 10 });
  }
  // the bridges over the river: low decks, the streets carried across
  for (const z of BRIDGES) box({ x0: RIVER.x0 - 16, x1: RIVER.x1 + 16, z0: z - 9, z1: z + 9, y0: -1.2, y1: 0.4, bridge: true });

  // the suburbs: houses on lawns, both sides of every E–W street; the strip
  // along the arterial; the school and its field; Burger Mart
  for (let a = 0; a < SUB_A; a++)
    for (let m = SUB_M[0]; m <= SUB_M[1]; m++) {
      const B = subBlock(a, m);
      const is = (o) => o.a === a && o.m === m;
      if (is(SCHOOL)) {
        const s = { id: 'school', x: B.cx, z: B.cz + 2, w: 96, d: 38, h: 12 };
        landmarks.push(s);
        box({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2, y1: s.h, landmark: 'school' });
        places.push({ ...PLACES.find((p) => p.id === 'school'), x: s.x, z: s.z, door: [s.x, s.z + s.d / 2 + 4], face: 0, r: 12 });
        continue;
      }
      if (is(FIELD)) {
        landmarks.push({ id: 'field', x: B.cx, z: B.cz, w: B.w - 8, d: B.d - 6 });
        continue;
      }
      if (is(BURGER)) {
        const s = { id: 'burgermart', x: B.cx + 30, z: B.cz, w: 22, d: 16, h: 6 };
        landmarks.push(s);
        box({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2, y1: s.h, landmark: 'burgermart' });
        // the door faces the arterial, east
        places.push({ ...PLACES.find((p) => p.id === 'burgermart'), x: s.x, z: s.z, door: [s.x + s.w / 2 + 4, s.z], face: Math.PI / 2, r: 10 });
        continue;
      }
      if (a === 0) {
        // the strip: low shops facing the arterial, their car parks in front
        for (const oz of [-0.25, 0.25]) {
          const w = 26 + r() * 10;
          const d = 18 + r() * 6;
          const s = { x: B.cx - B.w / 2 + 6 + w / 2 + r() * 8, z: B.cz + oz * B.d, w, d, h: 5 + r() * 4, tone: r() };
          shops.push(s);
          box({ x0: s.x - w / 2, x1: s.x + w / 2, z0: s.z - d / 2, z1: s.z + d / 2, y1: s.h, shop: true });
        }
        continue;
      }
      // five lots a row, two rows: the north row faces the street to the north
      for (const side of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          const lw = B.w / 5;
          const w = 10 + r() * 4;
          const d = 9 + r() * 2.5;
          const x = B.cx - B.w / 2 + lw * (k + 0.5) + (r() - 0.5) * 2;
          const front = B.cz + side * (B.d / 2); // the lot's street edge
          const z = front - side * (8 + d / 2);
          const home = HOME.a === a && HOME.m === m && HOME.lot === k && side === -1;
          const h = { x, z, w, d, h: 6 + r() * 1.8, yaw: side < 0 ? Math.PI : 0, tone: r(), roof: r(), home };
          houses.push(h);
          box({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y1: h.h + 2.2, house: houses.length - 1 });
          // a tree on the front lawn and one out back
          if (!home && r() < 0.8) trees.push([x + (r() < 0.5 ? -1 : 1) * (w / 2 + 1.2 + r() * 1.5), front - side * (3 + r() * 2), 2.4 + r() * 1.6, 1]);
          if (r() < 0.7) trees.push([x + (r() - 0.5) * lw * 0.6, z - side * (d / 2 + 4 + r() * 3), 2.6 + r() * 1.8, 1]);
          if (home) {
            places.push({ ...PLACES.find((p) => p.id === 'home'), x, z, door: [x, front - side * 5.5], face: side < 0 ? Math.PI : 0, r: 9 });
          }
        }
      }
    }

  // the green belt and the hills: woods
  for (let k = 0; k < 2600; k++) {
    const x = (r() * 2 - 1) * (WORLD.half - 60);
    const z = -WORLD.half + 60 + r() * (WORLD.half - 60 + HILLS - 40);
    if (vnoise(x, z, 260) < 0.42) continue;
    const s = 4 + r() * 4;
    // (none in the river or on its embankments; the size is drawn first all the same, so the rest of the woods stay where they were)
    if (zoneAt(x, z) !== 'river') trees.push([x, z, s, 2]);
  }
  for (let k = 0; k < 500; k++) {
    const x = SUBURB.x1 + 8 + r() * (CITY.x0 - SUBURB.x1 - 16);
    const z = CITY.z0 + r() * (CITY.z1 - CITY.z0);
    trees.push([x, z, 3 + r() * 3, 0]);
  }

  // the index: a 100 m grid of which boxes touch each square
  const grid = new Map();
  for (const b of boxes) {
    for (let gx = Math.floor(b.x0 / 100); gx <= Math.floor(b.x1 / 100); gx++)
      for (let gz = Math.floor(b.z0 / 100); gz <= Math.floor(b.z1 / 100); gz++) {
        const key = gx * 1000 + gz;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(b);
      }
  }
  return { seed, buildings, houses, shops, trees, landmarks, boxes, places, grid, stamp: new Uint32Array(boxes.length), visit: { n: 0 } };
}

// The boxes that might be within r of (x, z) (some a little further). In
// the mirror city (./dimensions.js: a world with `mirror`), the map is
// reflected in x: the boxes round (−x, z), each given back reflected (made
// once each, kept on the world by the box's id).
export function near(world, x, z, r, out = []) {
  out.length = 0;
  const v = ++world.visit.n;
  const mx = world.mirror ? -x : x;
  const flip = world.mirror ? (world.mirrored ??= []) : null;
  for (let gx = Math.floor((mx - r) / 100); gx <= Math.floor((mx + r) / 100); gx++)
    for (let gz = Math.floor((z - r) / 100); gz <= Math.floor((z + r) / 100); gz++) {
      const list = world.grid.get(gx * 1000 + gz);
      if (!list) continue;
      for (const b of list) {
        if (world.stamp[b.id] === v) continue;
        world.stamp[b.id] = v;
        out.push(flip ? (flip[b.id] ??= { ...b, x0: -b.x1, x1: -b.x0, x: b.x == null ? undefined : -b.x }) : b);
      }
    }
  return out;
}

// Whether a saved place (./InvWorld.jsx keeps where he was standing) is
// somewhere to start from: three numbers, in the world, under the top of the
// sky, not under the land, not out over the water and not inside anything.
// On a roof or a bridge's deck is somewhere to stand (./flight.js stands him
// on it), and so is the pavement right by a wall: his size is ./flight.js's
// FLY (R 0.45, H 1.8) a shade narrower, as collide() leaves him exactly R
// off a wall. Anything else, a stale or broken save among it, and he starts
// at SPAWN instead.
const BODY = { r: 0.4, h: 1.8 };
const ON = 0.1; // (his feet within this of a box's top: standing on it, not in it)
export function isSafeStart(world, at) {
  if (!world?.grid || !at || typeof at !== 'object') return false;
  const { x, y, z } = at;
  if (![x, y, z].every(Number.isFinite)) return false;
  if (Math.abs(x) > WORLD.half || Math.abs(z) > WORLD.half || y >= WORLD.ceiling) return false;
  if (waterAt(x, z) || y < groundAt(x, z) - 0.5) return false;
  const { r, h } = BODY;
  return !near(world, x, z, r, []).some((b) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r && y < b.y1 - ON && y + h > b.y0);
}

// Where you start: on the Graysons' front lawn, looking toward downtown.
export const SPAWN = (() => {
  const B = subBlock(HOME.a, HOME.m);
  const x = B.cx - B.w / 2 + (B.w / 5) * (HOME.lot + 0.5) + 6;
  const z = B.cz - B.d / 2 + 2.5;
  return { x, y: groundAt(x, z), z, face: Math.atan2(-x, -z) };
})();
