// The grounds as heights: a hand-placed field (the design’s §4.3), pure, so
// the ground’s mesh, the scatter, the walk, the lake’s shallows and the
// Map all read one land, in Node as in the browser. Read in the order it is
// summed:
//
//   the base     a low rolling land, the moor rising behind to the north,
//                hills over the far shore and round the edges
//   the loch     the Black Lake, a long water along a spine from the west,
//                past under the castle’s cliff and up its arm to the
//                north-east, its shore ragged, a strand at the edge, the
//                bed falling away under it
//   the knolls   the stone circle’s on the lake’s north shore west of the
//                castle, the Owlery’s north of it
//   the cuts     the ravine the viaduct crosses, and the glen the road runs
//                down from it to the station at the arm’s head
//   the crag     the castle’s plateau, level at CASTLE_FLOOR, cliffs to the
//                lake on the south and west, its shoulder falling gently
//                east to the lawns and north to the Willow’s slope
//   the flats    levelled ground where something stands: the pitch, the
//                greenhouses, the hut, the boathouse’s ledge, the station’s
//                platform, the willow, Hogsmeade’s field (Lane F’s)
//
//   heightAt(x, z) → metres (the lake’s water is at LAKE, 0)
//   shoreAt(x, z) → metres from the loch’s edge (negative out on the water)
//   isWater(x, z) → the ground there is under the lake
//   cover(x, z) → { forest, moor, lawn, shore, rock } 0…1: what the ground is,
//     for the paint and the scatter (rock: the cliffs and the knolls’ flanks)
//   pathAt(x, z) → metres to the nearest path’s middle, and PATHS: the worn
//     ways ([{ id, width, points: [[x, z], …] }]), painted into the ground
//   slopeAt(x, z) → rise over run
//   LAKE, LOCH (the spine), FLATS, SKIRT (how far past the ground’s edge the land is drawn)

import { CASTLE_FLOOR, HALF, placeById } from '../rules/places';

export const LAKE = 0;
export const SKIRT = 1300; // m past the middle the land runs, under the far hills (ground.js draws to here)

const at = (id) => placeById(id).at;

// The loch’s spine, west to north-east: [x, z, half its width]. It runs on
// past the ground to the west, so the water leaves the picture as a loch
// does, and ends in a head at the north-east, the station on its shore and
// Hogsmeade on the rise beyond.
export const LOCH = [
  [-1500, 300, 340],
  [-560, 255, 300],
  [-260, 228, 255],
  [0, 248, 197],
  [220, 252, 170],
  [420, 165, 130],
  [522, -38, 104],
  [578, -250, 90],
  [612, -410, 74],
  [626, -486, 54],
  [630, -520, 34],
];

// The worn ways: the doors’ steps down to the lawn, the lawn to the pitch
// and the greenhouses, the slope down past the Willow to the hut, the stone
// circle down to the hut, the Owlery’s path, the forest path, and the road
// from the viaduct’s end down the glen to the station and on to Hogsmeade.
export const PATHS = [
  { id: 'lawn', width: 3.2, points: [[66, -8], [96, -10], [130, -18], [170, -30], [215, -42], [252, -48]] },
  { id: 'greenhouses', width: 2.4, points: [[130, -18], [140, 0], [148, 18], [150, 26]] },
  { id: 'pitch-south', width: 2.4, points: [[215, -42], [250, -4], [292, 34]] },
  { id: 'willow', width: 2.6, points: [[-60, -128], [-96, -150], [-128, -166], [-170, -196], [-212, -218], [-242, -228]] },
  { id: 'circle', width: 2.2, points: [[-232, -100], [-248, -140], [-252, -186], [-250, -222]] },
  { id: 'owlery', width: 2, points: [[-40, -128], [-36, -170], [-32, -214], [-30, -252]] },
  { id: 'forest', width: 2, points: [[-262, -232], [-300, -252], [-338, -272], [-382, -300], [-420, -320], [-450, -330]] },
  { id: 'road', width: 4.2, points: [[214, -228], [262, -268], [318, -312], [384, -354], [448, -400], [506, -438], [536, -470], [572, -524], [612, -572], [646, -604], [664, -620]] },
  { id: 'castle-north', width: 2.6, points: [[-60, -128], [-30, -128], [10, -122], [60, -116], [96, -106]] },
];

// The levelled places: [x, z] or a polygon’s middle, how far round it is
// level (`r`, or `rx`/`rz` for an oval), how far it eases back into the
// land, and the height (`y`, else the land’s own at the middle).
export const FLATS = [
  { id: 'pitch', at: at('pitch'), rx: 58, rz: 98, ease: 34, y: 8 },
  { id: 'greenhouses', at: at('greenhouses'), r: 30, ease: 16 },
  { id: 'hut', at: [-254, -238], r: 30, ease: 22 },
  { id: 'willow', at: at('willow'), r: 14, ease: 14 },
  { id: 'boathouse', at: [-25, 54], r: 11, ease: 7, y: 1.2 },
  { id: 'station', at: [548, -472], rx: 16, rz: 48, turn: -0.42, ease: 16, y: 4.6 },
  { id: 'hogsmeade', at: at('hogsmeade'), r: 66, ease: 30 },
];

// the crag: its middle, its radii, its turn, and how far its sides fall
// (metres) to the south (the cliff over the lake), the west, the north and
// the east (the lawns’ long slope)
const CRAG = { at: [-6, -46], rx: 128, rz: 90, turn: 0.12, fall: { s: 16, w: 22, n: 64, e: 150 } };
const KNOLLS = [
  { id: 'stone-circle', at: at('stone-circle'), top: 37, flat: 20, r: 70, stretch: 1.25, turn: 0.4 },
  { id: 'owlery', at: [-30, -266], top: 50, flat: 9, r: 62, stretch: 1.3, turn: 1.1 },
  // (the far side of the ravine, where the viaduct comes down: the glen runs on from it)
  { id: 'viaduct-end', at: [232, -246], top: 38, flat: 14, r: 92, stretch: 1.6, turn: -0.7 },
];
// the ravine under the viaduct and the glen below it: a line, the floor’s
// height at its first and last point, the floor’s half width, the banks’ slope
const CUTS = [
  { id: 'ravine', line: [[70, -250], [118, -196], [156, -160], [196, -126], [236, -96]], floor: [24, 10], half: 5, bank: 1.7 },
  { id: 'glen', line: [[214, -228], [318, -312], [448, -400], [530, -462], [560, -500]], floor: [33, 4.2], half: 26, bank: 0.42 },
];

// Value noise from a table: a 256 × 256 lattice of numbers −1…1 made once
// from a seeded hash, read between its corners and tiled, a seed being an
// offset into it. The field is read a few hundred thousand times as the
// ground is built, and hashing every corner (lib/land’s noise2) cost a
// fifth of a microsecond a read; the table is a tenth of that.
const SIDE = 256;
const LATTICE = (() => {
  const t = new Float32Array(SIDE * SIDE);
  let a = 0x9e3779b9;
  for (let i = 0; i < t.length; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = a;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    t[i] = (((r ^ (r >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }
  return t;
})();
export function noise2(x, z, seed = 0) {
  const px = x + seed * 37.17;
  const pz = z + seed * 91.73;
  const ix = Math.floor(px);
  const iz = Math.floor(pz);
  const fx = px - ix;
  const fz = pz - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const i0 = ix & (SIDE - 1);
  const i1 = (ix + 1) & (SIDE - 1);
  const j0 = (iz & (SIDE - 1)) * SIDE;
  const j1 = ((iz + 1) & (SIDE - 1)) * SIDE;
  const a = LATTICE[j0 + i0];
  const b = LATTICE[j0 + i1];
  const c = LATTICE[j1 + i0];
  const d = LATTICE[j1 + i1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const clamp01 = (x) => (x > 0 ? (x < 1 ? x : 1) : 0);
const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const fbm = (x, z, octaves, seed) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f, z * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
};

// distance from (x, z) to a segment, and how far along it (0…1)
function toSegment(x, z, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = clamp01(((x - ax) * dx + (z - az) * dz) / l2);
  const ex = x - ax - dx * t;
  const ez = z - az - dz * t;
  SEG.d = Math.sqrt(ex * ex + ez * ez);
  SEG.t = t;
  return SEG;
}
// (one answer reused: the field is read a few hundred thousand times as the ground is built)
const SEG = { d: 0, t: 0 };

// a polyline’s nearest point: the distance and how far along it (0…1 of its
// length); its segments’ lengths worked out once a line
const LENGTHS = new WeakMap();
function lengthsOf(line) {
  let l = LENGTHS.get(line);
  if (!l) {
    const each = [];
    let total = 0;
    for (let i = 1; i < line.length; i++) {
      const len = Math.sqrt((line[i][0] - line[i - 1][0]) ** 2 + (line[i][1] - line[i - 1][1]) ** 2);
      each.push(len);
      total += len;
    }
    l = { each, total: total || 1 };
    LENGTHS.set(line, l);
  }
  return l;
}
const NEAR = { d: 0, along: 0 };
function toLine(x, z, line) {
  const { each, total } = lengthsOf(line);
  let best = Infinity;
  let along = 0;
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    const s = toSegment(x, z, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
    if (s.d < best) {
      best = s.d;
      along = (run + s.t * each[i - 1]) / total;
    }
    run += each[i - 1];
  }
  NEAR.d = best;
  NEAR.along = along;
  return NEAR;
}

// The loch’s signed edge: the distance to its spine less its half width
// there, ragged by a slow noise and a quicker one (negative on the water)
export function shoreAt(x, z) {
  let best = Infinity;
  for (let i = 1; i < LOCH.length; i++) {
    const [ax, az, aw] = LOCH[i - 1];
    const [bx, bz, bw] = LOCH[i];
    const s = toSegment(x, z, ax, az, bx, bz);
    best = Math.min(best, s.d - (aw + (bw - aw) * s.t));
  }
  return best + fbm(x / 95, z / 95, 3, 41) * 22 + noise2(x / 23, z / 23, 43) * 4;
}

function base(x, z) {
  let h = 9 + fbm(x / 260, z / 260, 4, 3) * 7 + fbm(x / 70, z / 70, 3, 5) * 2.2;
  // the moor rising behind the castle, and the hills round the other sides
  h += 70 * smooth((-z - 240) / 460) * (1 - 0.25 * smooth((x - 250) / 300));
  h += 58 * smooth((z - 480) / 260);
  h += 48 * smooth((-x - 520) / 220);
  h += 36 * smooth((x - 640) / 160) * smooth((z + 200) / 300);
  // past the ground’s edge the land goes up into hills, under the far range
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > HALF + 80) h += 110 * smooth((edge - HALF - 80) / 520) * (0.65 + 0.35 * fbm(x / 300, z / 300, 3, 9));
  // a heathery roughness on the high ground
  if (h > 30) h += (h - 30) * 0.06 * fbm(x / 34, z / 34, 3, 13);
  return h;
}

// the land at a point before the loch: under it, the strand and then the bed
function withLoch(h, x, z) {
  const sd = shoreAt(x, z);
  if (sd >= 44) return h;
  if (sd >= 0) {
    // (a gentle strand up from the water, easing into the land behind)
    const strand = 0.25 + sd * 0.06;
    return strand + (h - strand) * smooth(sd / 44);
  }
  // the bed: shelving at the edge, then falling away to the deeps
  return Math.max(-28, 0.25 + sd * 0.07 - 24 * smooth(-sd / 95));
}

function withKnolls(h, x, z) {
  for (const k of KNOLLS) {
    const dx = x - k.at[0];
    const dz = z - k.at[1];
    // (stretched along its own line and ragged round its foot, so it reads as a hill and not a mound)
    const c = Math.cos(k.turn ?? 0);
    const s = Math.sin(k.turn ?? 0);
    const u = (dx * c + dz * s) / (k.stretch ?? 1);
    const v = -dx * s + dz * c;
    const plain = Math.sqrt(u * u + v * v);
    if (plain >= k.r * 1.3) continue;
    const d = plain * (1 + 0.22 * noise2(Math.atan2(v, u) * 1.6 + 9, k.r, 67));
    if (d >= k.r) continue;
    const t = clamp01((d - k.flat) / (k.r - k.flat));
    // (rough on its flanks, level on top, where something stands)
    const flank = 1 - smooth(t);
    const rough = t > 0 ? fbm(x / 9, z / 9, 2, 61) * 2.4 * Math.sin(Math.PI * t) : 0;
    h = Math.max(h, k.top * flank + h * (1 - flank) + rough);
  }
  return h;
}

const BOX = new WeakMap();
function boxOf(line, pad) {
  let b = BOX.get(line);
  if (!b) {
    const xs = line.map((p) => p[0]);
    const zs = line.map((p) => p[1]);
    b = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...zs) - pad, Math.max(...zs) + pad];
    BOX.set(line, b);
  }
  return b;
}
function withCuts(h, x, z) {
  for (const c of CUTS) {
    // (a cut reaches no further than its banks could climb to the moor’s top)
    const b = boxOf(c.line, c.half + 140 / c.bank);
    if (x < b[0] || x > b[1] || z < b[2] || z > b[3]) continue;
    const { d, along } = toLine(x, z, c.line);
    const floor = c.floor[0] + (c.floor[1] - c.floor[0]) * along;
    const cut = floor + Math.max(0, d - c.half) * c.bank;
    if (cut < h) h = cut + (h - cut) * 0.04 * smooth((d - c.half) / 30);
  }
  return h;
}

// the crag’s top over the land: level within its oval, falling at its own
// rate on each side, a little rock in its cliffs
function crag(x, z) {
  const c = Math.cos(CRAG.turn);
  const s = Math.sin(CRAG.turn);
  const dx = x - CRAG.at[0];
  const dz = z - CRAG.at[1];
  const u = dx * c + dz * s;
  const v = -dx * s + dz * c;
  if (Math.abs(u) > CRAG.rx + CRAG.fall.e + 20 || Math.abs(v) > CRAG.rz + CRAG.fall.e + 20) return -Infinity;
  const q = Math.sqrt((u / CRAG.rx) ** 2 + (v / CRAG.rz) ** 2);
  const ragged = fbm(x / 40, z / 40, 3, 71) * 0.07;
  const out = (q - 1 - ragged) * Math.min(CRAG.rx, CRAG.rz); // metres outside its edge, near enough
  if (out <= 0) return CASTLE_FLOOR;
  // which side: south (+v), west (−u), north (−v), east (+u), blended by the angle
  const a = Math.atan2(v, u);
  const { s: fs, w: fw, n: fn, e: fe } = CRAG.fall;
  const k = (ang) => Math.max(0, Math.cos(a - ang)) ** 2;
  const ws = k(Math.PI / 2);
  const ww = k(Math.PI);
  const wn = k(-Math.PI / 2);
  const we = k(0);
  const fall = (fs * ws + fw * ww + fn * wn + fe * we) / (ws + ww + wn + we || 1);
  const t = out / fall;
  if (t >= 1) return -Infinity;
  const rock = fall < 40 ? fbm(x / 7, z / 7, 2, 73) * 2.5 * Math.sin(Math.PI * t) : 0;
  return CASTLE_FLOOR * (1 - smooth(t)) + rock;
}

const FLAT_Y = new Map();
function withFlats(h, x, z, raw) {
  for (const f of FLATS) {
    const dx = x - f.at[0];
    const dz = z - f.at[1];
    let d;
    if (Math.abs(dx) > 160 || Math.abs(dz) > 160) continue;
    if (f.r != null) d = Math.sqrt(dx * dx + dz * dz) - f.r;
    else {
      const c = Math.cos(f.turn ?? 0);
      const s = Math.sin(f.turn ?? 0);
      const u = dx * c + dz * s;
      const v = -dx * s + dz * c;
      const q = Math.sqrt((u / f.rx) ** 2 + (v / f.rz) ** 2);
      d = (q - 1) * Math.min(f.rx, f.rz);
    }
    if (d >= f.ease) continue;
    // (a flat with no height of its own takes the land’s at its middle, worked out once)
    let y = f.y;
    if (y == null) {
      if (!FLAT_Y.has(f.id)) FLAT_Y.set(f.id, raw(f.at[0], f.at[1]));
      y = FLAT_Y.get(f.id);
    }
    h = y + (h - y) * smooth(d / f.ease);
  }
  return h;
}

// everything but the flats, so a flat can read the land under its middle
function shaped(x, z) {
  let h = base(x, z);
  h = withLoch(h, x, z);
  h = withKnolls(h, x, z);
  h = withCuts(h, x, z);
  return Math.max(h, crag(x, z));
}

export function heightAt(x, z) {
  return withFlats(shaped(x, z), x, z, shaped);
}

export const isWater = (x, z) => heightAt(x, z) < LAKE;

export function slopeAt(x, z, e = 1) {
  const sx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const sz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return Math.hypot(sx, sz);
}

export function pathAt(x, z) {
  let best = Infinity;
  for (const p of PATHS) best = Math.min(best, toLine(x, z, p.points).d - p.width / 2);
  return best;
}

// What the ground is at a point. The forest lies west of the hut and north
// over the moor’s western half, its edge ragged; the moor is the high
// ground behind; the lawn is the low green round the castle’s east and
// north; the shore the strand; rock the steep.
export function cover(x, z, h = heightAt(x, z), slope = null) {
  const n = fbm(x / 70, z / 70, 3, 91);
  const sd = shoreAt(x, z);
  const dry = smooth((sd - 6) / 20);
  const west = smooth((-x - 300 + n * 50) / 70);
  const north = smooth((-z - 330 + n * 50) / 70) * smooth((-x + 160 + n * 40) / 90);
  const forest = clamp01(Math.max(west, north)) * dry;
  const moor = smooth((-z - 470 + n * 60) / 90) * (1 - forest * 0.85) + smooth((h - 52) / 25) * (1 - forest) * 0.6;
  const s = slope ?? slopeAt(x, z, 1.5);
  const rock = smooth((s - 0.75) / 0.5);
  const shore = (1 - smooth((sd - 2) / 10)) * (sd > -1 ? 1 : 0);
  const lawn = clamp01(1 - forest - clamp01(moor) - rock) * dry;
  return { forest, moor: clamp01(moor), lawn, shore, rock };
}
