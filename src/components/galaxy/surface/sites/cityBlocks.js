// A city of blocks from the Downtown City MegaKit (public/kit/city/,
// docs/assets/city-packs.md): a grid of blocks, each built round wall to
// wall with brick tenements facing its four streets (a corner building at
// each corner, those between scaled together to fill the side exactly),
// taller toward the middle; its streets laid from the kit's tiles (two
// lanes and a pavement each side, a tile every 6 m), a square of asphalt
// where two cross with a rounded kerb at each corner and a crosswalk over
// each way in; a block that holds a landmark paved as a square round it.
// Pure, and in the place's frame, as city.js's cityOf, which hands
// `plan: 'blocks'` here.
//
//   blocksOf(spec, { seed }) → { rows, life, flat: { r }, lots, paving }
//     flat: the ground kept flat, the city and the streets round its edge
//     rows: scatter rows, a kit model each ({ kind, model, items: [{ at,
//       yaw, scale, stretch?, box? }], solid, shadow, sink, city }): a
//       building's box its footprint off its origin ([hw, hd, ox, oz] at
//       scale 1, placer.js)
//     paving: as cityOf's (its streets, and its squares as wide ones)
//   spec: {
//     r          metres the city spreads to
//     block      [x, z]: a block's sides, kerb to kerb, each a multiple of
//                the street tile's 6 m ([84, 48])
//     plaza      metres round the middle made squares (0)
//     marks      [{ at, r }]: landmarks (the place's own things); a block
//                holding one's middle is made a square
//     keep       [{ at, r }]: kept clear of buildings (a person, a quest's spot)
//     lamps      the kind along the pavements ('lamp'), `every` metres (24)
//     crowd, traffic: as cityOf's, on the pavements and over the streets
//   }
//
// The kit's tiles are laid with their kerbs a fifth as high (`stretch`) and
// lifted to stand on the ground, so you walk the pavement as the road and
// never stand in it.

import { seeded } from '../../../../lib/seeded.js';

const KIT = 'kit:city/';
const TILE = 6; // metres of street a Street_2Lane is
const STREET = 12; // and across: 6 of road, 3 of pavement each side
const WALK = 3; // a pavement
const FLAT = 0.2; // the kerbs' height kept
const ROAD = 0.02; // metres the road stands over the ground

// The buildings, measured from the kit's files: each faces its own +z, its
// origin on its front wall; `x` its walls' span across its front, `d` how
// deep it goes back, `h` how high, at scale 1. The large one is the
// corner's: its -x side is a front too.
const BUILDINGS = {
  large: { model: `${KIT}Building_Large_2`, x: [-9.32, 11.32], d: 16.32, h: 28 },
  medium: { model: `${KIT}Building_Medium_2_001`, x: [-7.53, 7.53], d: 12.49, h: 25 },
  small: { model: `${KIT}Building_Small_1`, x: [-7.23, 5.23], d: 12.23, h: 17 },
};
const width = (b) => b.x[1] - b.x[0];
const CORNER = BUILDINGS.large;

// what a block builds by how far out it is (its middle over the city's r):
// the tall ones at the middle, raised a little more there, the low ones out
const ZONES = [
  { to: 0.4, weights: { large: 3, medium: 1, small: 0 }, stretch: [1.05, 1.25] },
  { to: 0.75, weights: { large: 1, medium: 2, small: 1 }, stretch: [0.95, 1.12] },
  { to: Infinity, weights: { large: 0, medium: 1, small: 2 }, stretch: [0.9, 1.04] },
];
const SCALE = [0.8, 1.25]; // a side's buildings scaled together, no further

const pick = (rand, weights) => {
  const list = Object.entries(weights).filter(([, w]) => w > 0);
  let t = rand() * list.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of list) if ((t -= w) <= 0) return k;
  return list[list.length - 1][0];
};
const within = (rand, [a, b]) => a + rand() * (b - a);
const clearOf = (keep, x, z, r) => keep.every((c) => Math.hypot(x - c.at[0], z - c.at[1]) >= c.r + r);
// (three's turn about y: a model's (x, z) at `yaw`)
const turn = (x, z, yaw) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];

// the buildings that fill `gap` metres of a side, scaled together to fill
// it exactly: of a few runs picked by the zone's weights, the one scaled
// nearest its own size (null if none fits)
export function fillSide(rand, weights, gap) {
  let best = null;
  for (let t = 0; t < 8; t++) {
    const run = [];
    let sum = 0;
    while (sum < gap) {
      const k = pick(rand, weights);
      run.push(k);
      sum += width(BUILDINGS[k]);
      const s = gap / sum;
      if (s >= SCALE[0] && s <= SCALE[1] && (!best || Math.abs(Math.log(s)) < Math.abs(Math.log(best.scale)))) best = { run: [...run], scale: s };
    }
  }
  return best;
}

// a building, its front wall's left end at `from` along a side (the side's
// point at u: at + n·out + t·u), facing n
function building(b, side, from, s, stretch) {
  const { c, n, t, out, yaw } = side;
  const u = from - b.x[0] * s;
  const at = [c[0] + n[0] * out + t[0] * u, c[1] + n[1] * out + t[1] * u];
  const ox = (b.x[0] + b.x[1]) / 2;
  const oz = -b.d / 2;
  const [mx, mz] = turn(ox * s, oz * s, yaw);
  return { model: b.model, item: { at, yaw, scale: s, stretch, box: [(width(b) / 2) * 0.95, (b.d / 2) * 0.95, ox, oz] }, mid: [at[0] + mx, at[1] + mz], r: (Math.hypot(width(b), b.d) * s) / 2 };
}

// a block's four sides, each its outward normal, its way along (the
// model's +x when it faces out), how far out its front is and how long
const sidesOf = (c, hx, hz) =>
  [
    [0, -1, hx, hz],
    [1, 0, hz, hx],
    [0, 1, hx, hz],
    [-1, 0, hz, hx],
  ].map(([nx, nz, half, out]) => {
    const yaw = Math.atan2(nx, nz);
    return { c, n: [nx, nz], t: [Math.cos(yaw), -Math.sin(yaw)], yaw, half, out };
  });

export function blocksOf(spec, { seed = 1 } = {}) {
  const rand = seeded(seed);
  const { r, plaza = 0 } = spec;
  const [bx, bz] = spec.block ?? [84, 48];
  const keep = spec.keep ?? [];
  const marks = spec.marks ?? [];
  const lampKind = spec.lamps === undefined ? 'lamp' : spec.lamps;
  const every = spec.every ?? 24;
  const px = bx + STREET;
  const pz = bz + STREET;
  const hx = bx / 2;
  const hz = bz / 2;
  const rows = new Map(); // model → items
  const put = (model, item) => (rows.get(model) ?? rows.set(model, []).get(model)).push(item);
  const blocks = [];
  for (let i = -Math.ceil(r / px); i <= Math.ceil(r / px); i++)
    for (let j = -Math.ceil(r / pz); j <= Math.ceil(r / pz); j++) {
      const c = [i * px, j * pz];
      // (the block within the city, the streets round it a little past: the flat's)
      if (Math.hypot(Math.abs(c[0]) + hx, Math.abs(c[1]) + hz) > r) continue;
      const inside = (q) => Math.abs(q.at[0] - c[0]) <= hx && Math.abs(q.at[1] - c[1]) <= hz;
      const near = Math.hypot(Math.max(0, Math.abs(c[0]) - hx), Math.max(0, Math.abs(c[1]) - hz));
      blocks.push({ c, square: (plaza > 0 && near < plaza) || marks.some(inside) });
    }

  // the buildings round each block that isn't a square
  let lots = 0;
  for (const b of blocks.filter((q) => !q.square)) {
    const zone = ZONES.find((z) => Math.hypot(...b.c) / r < z.to);
    for (const side of sidesOf(b.c, hx, hz)) {
      const placed = [building(CORNER, side, -side.half, 1, within(rand, zone.stretch))];
      const gap = 2 * side.half - width(CORNER) - CORNER.d;
      const fill = fillSide(rand, zone.weights, gap);
      let from = -side.half + width(CORNER);
      for (const k of fill?.run ?? []) {
        placed.push(building(BUILDINGS[k], side, from, fill.scale, within(rand, zone.stretch)));
        from += width(BUILDINGS[k]) * fill.scale;
      }
      for (const p of placed)
        if (clearOf(keep, p.mid[0], p.mid[1], p.r)) {
          put(p.model, p.item);
          lots++;
        }
    }
  }

  // the streets: a tile every 6 m along each side of every block (a side
  // two blocks share laid once), a crossing at each corner
  const streets = new Map();
  const crossings = new Map();
  const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
  for (const { c } of blocks) {
    for (const sz of [-1, 1]) streets.set(key(c[0], c[1] + sz * (hz + STREET / 2)), { at: [c[0], c[1] + sz * (hz + STREET / 2)], along: [1, 0], len: bx });
    for (const sx of [-1, 1]) streets.set(key(c[0] + sx * (hx + STREET / 2), c[1]), { at: [c[0] + sx * (hx + STREET / 2), c[1]], along: [0, 1], len: bz });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) crossings.set(key(c[0] + sx * (hx + STREET / 2), c[1] + sz * (hz + STREET / 2)), [c[0] + sx * (hx + STREET / 2), c[1] + sz * (hz + STREET / 2)]);
  }
  const paving = [];
  for (const s of streets.values()) {
    const yaw = s.along[0] ? 0 : Math.PI / 2;
    for (let u = -s.len / 2 + TILE / 2; u < s.len / 2; u += TILE) {
      const at = [s.at[0] + s.along[0] * u, s.at[1] + s.along[1] * u];
      put(`${KIT}Street_2Lane`, { at, yaw });
      put(`${KIT}Decal_BrokenLine_Straight`, { at, yaw });
    }
    // (a crosswalk over the way in at each end, a manhole and a drain between)
    for (const e of [-1, 1]) put(`${KIT}Decal_Crosswalk`, { at: [s.at[0] + s.along[0] * e * (s.len / 2 - 2.6), s.at[1] + s.along[1] * e * (s.len / 2 - 2.6)], yaw });
    const m = (rand() - 0.5) * s.len * 0.6;
    put(`${KIT}Prop_ManholeCover`, { at: [s.at[0] + s.along[0] * m + s.along[1] * 1.4, s.at[1] + s.along[1] * m - s.along[0] * 1.4], yaw });
    const half = s.len / 2 + STREET / 2;
    paving.push({ a: [s.at[0] - s.along[0] * half, s.at[1] - s.along[1] * half], b: [s.at[0] + s.along[0] * half, s.at[1] + s.along[1] * half], w: STREET });
  }
  for (const [x, z] of crossings.values()) {
    // (the asphalt square's origin is its corner: 9 m scaled to the street's 12)
    put(`${KIT}Street_Asphalt_9x9`, { at: [x + STREET / 2, z + STREET / 2], yaw: 0, scale: STREET / 9 });
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const at = [x + sx * (STREET / 2 - WALK / 2), z + sz * (STREET / 2 - WALK / 2)];
        // (its kerb's curve toward the crossing's middle: the tile's own is to its -x, +z)
        put(`${KIT}Sidewalk_Corner_Round_3m`, { at, yaw: Math.atan2(-sx, -sz) + Math.PI / 4 });
        // (two bollards inside the curve, round from the block's corner)
        for (const a of [0.45, 1.12]) put(`${KIT}Prop_Bollard`, { at: [x + sx * (STREET / 2 - 2.6 * Math.cos(a)), z + sz * (STREET / 2 - 2.6 * Math.sin(a))], yaw: 0 });
      }
  }

  // the squares: paved from kerb to kerb, planters round their edge
  for (const { c } of blocks.filter((q) => q.square)) {
    for (let x = -hx + WALK / 2; x < hx; x += WALK) for (let z = -hz + WALK / 2; z < hz; z += WALK) put(`${KIT}Sidewalk_NoCurb_3m`, { at: [c[0] + x, c[1] + z], yaw: 0 });
    for (let x = -hx + 6; x < hx - 3; x += 12)
      for (const sz of [-1, 1]) {
        const at = [c[0] + x, c[1] + sz * (hz - 1.5)];
        if (clearOf([...keep, ...marks], at[0], at[1], 1.2)) put(`${KIT}Prop_Planter_Single`, { at, yaw: 0 });
      }
    paving.push({ a: [c[0] - hx, c[1]], b: [c[0] + hx, c[1]], w: bz });
  }

  // lamps along every pavement, a kerb's width in from the road
  const lamps = [];
  if (lampKind)
    for (const s of streets.values())
      for (const side of [-1, 1]) {
        const off = side * (STREET / 2 - WALK + 0.5);
        for (let u = -s.len / 2 + every / 2; u < s.len / 2 - 2; u += every) {
          const at = [s.at[0] + s.along[0] * u + s.along[1] * off, s.at[1] + s.along[1] * u - s.along[0] * off];
          if (clearOf([...keep, ...marks], at[0], at[1], 1)) lamps.push({ at, yaw: s.along[0] ? 0 : Math.PI / 2 });
        }
      }

  // walkers round the blocks on their pavements; craft over the streets
  const life = [];
  const loop = ([x, z], ax, az) => [
    [x - ax, z - az],
    [x + ax, z - az],
    [x + ax, z + az],
    [x - ax, z + az],
  ];
  if (spec.crowd && blocks.length)
    for (let i = 0; i < spec.crowd.n; i++) {
      const b = blocks[Math.floor(rand() * blocks.length)];
      const path = loop(b.c, hx + WALK / 2, hz + WALK / 2);
      if (rand() < 0.5) path.reverse();
      life.push({ kind: spec.crowd.kinds[i % spec.crowd.kinds.length], path, speed: (spec.crowd.speed ?? 1.1) * (0.85 + rand() * 0.3), ...(spec.crowd.name ? { name: spec.crowd.name } : {}), ...(spec.crowd.says ? { says: spec.crowd.says } : {}), city: true });
    }
  if (spec.traffic && blocks.length)
    for (let i = 0; i < spec.traffic.n; i++) {
      const k = 1 + Math.floor(rand() * 2);
      const path = loop([0, 0], Math.min((k - 0.5) * px, r * 0.7), Math.min((k - 0.5) * pz, r * 0.7));
      if (i % 2) path.reverse();
      life.push({ kind: spec.traffic.kind, path, pause: 0, speed: spec.traffic.speed ?? 14, y: (spec.traffic.y ?? 14) + (i % 3) * 4, solid: false, city: true });
    }

  // each model's row: the tiles flattened and lifted so the road stands
  // ROAD over the ground (a tile's road is 0.15 under its pavement; the
  // asphalt square's 0.15 under its origin, at its scale; a road marking
  // a little over the road; a prop on the pavement or the road)
  const LIFT = {
    Street_2Lane: ROAD + 0.15 * FLAT,
    Sidewalk_Corner_Round_3m: ROAD + 0.15 * FLAT,
    Sidewalk_NoCurb_3m: ROAD + 0.15 * FLAT,
    Street_Asphalt_9x9: ROAD + 0.15 * (STREET / 9) * FLAT,
    Decal_BrokenLine_Straight: ROAD + 0.015 + 0.13 * FLAT,
    Decal_Crosswalk: ROAD + 0.015 + 0.15 * FLAT,
    Prop_ManholeCover: ROAD + 0.01,
    Prop_Bollard: ROAD + 0.15 * FLAT,
    Prop_Planter_Single: ROAD + 0.15 * FLAT,
  };
  const out = [];
  for (const [model, items] of rows) {
    const name = model.slice(KIT.length);
    const tile = name in LIFT && !name.startsWith('Prop_');
    const solid = name.startsWith('Building_') || name === 'Prop_Planter_Single';
    out.push({ kind: 'citykit', model, items: tile ? items.map((it) => ({ ...it, stretch: FLAT })) : items, solid, shadow: !tile, sink: name in LIFT ? -LIFT[name] : 0.1, city: true });
  }
  if (lamps.length) out.push({ kind: lampKind, items: lamps, solid: true, city: true });
  return { rows: out, life, flat: { r: r + STREET + 6 }, lots, block: [bx, bz], street: STREET, paving };
}
