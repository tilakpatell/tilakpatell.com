// A city's plan from a few numbers and a seed: its streets (a grid, or
// rings and spokes round its middle), its lots along them filled from a
// world's building kit, each facing its street, its lamps and clutter on
// the pavements, a crowd walking round its blocks and traffic over its
// streets. Pure, and in the place's own frame: siteFrom (sites/index.js)
// turns and moves a place's things and life with it, and widens its flat
// to the city's (docs/superpowers/specs/2026-10-20-galaxy-living-free-
// roam-design.md, 2).
//
//   cityOf(spec, { seed }) → { things, life, flat: { r }, lots }
//   rowsOf(things, foot) → scatter rows, a kind each ({ kind, items: [{ at,
//     yaw, scale, box? }], solid, city }): drawn instanced, a few draws for a
//     city, each building solid over its footprint (`foot`, a kind's [w, d]
//     at scale 1: footprints.json) where it has one
//   spec: {
//     plan: 'grid' | 'rings',
//     r          metres the city spreads to
//     street     a street's width (9)
//     block      a block's side, or a ring's depth (36)
//     plaza      metres round the middle kept open (the landmark's, 0)
//     kit        [{ kind, foot: [w, d], weight = 1, scale = [0.9, 1.15],
//                  face = 0 }]: the buildings, each its footprint at scale 1
//                  (its front along its own +z, turned `face` more)
//     keep       [{ at, r }] more kept open: a landmark, a quest's spot
//     lamps      the kind along the streets ('lamp'), `every` metres (18)
//     clutter    kinds on the pavements (['crates', 'barrels']), `n` a block (2)
//     crowd      { kinds, n, speed = 1.1, name?, says? }: walkers round blocks
//     traffic    { kind, n, y = 14, speed = 14 }: craft over the streets
//   }
//   lots: how many buildings stand, for the checks

import { seeded } from '../../../../lib/seeded.js';

const GAP = 1.5; // metres between a building and its lot's edge
const KERB = 1; // metres a lamp stands in from the street's edge

const pick = (rand, list) => {
  const total = list.reduce((s, k) => s + (k.weight ?? 1), 0);
  let t = rand() * total;
  for (const k of list) if ((t -= k.weight ?? 1) <= 0) return k;
  return list[list.length - 1];
};

// a circle against an axis-aligned square (its middle, its half side)
const touches = (c, x, z, h) => Math.hypot(Math.max(0, Math.abs(x - c.at[0]) - h), Math.max(0, Math.abs(z - c.at[1]) - h)) < c.r;
const clearOf = (keep, x, z, r) => keep.every((c) => Math.hypot(x - c.at[0], z - c.at[1]) >= c.r + r);

// a kit entry's smallest size (its scale's lower end) fitting a lot `along` × `deep`
const SCALE = [0.9, 1.15];
const fitting = (k, along, deep) => {
  const lo = (k.scale ?? SCALE)[0];
  return k.foot[0] * lo <= along - 2 * GAP && k.foot[1] * lo <= deep - 2 * GAP;
};
const fitsIn = (kit, along, deep) => kit.some((k) => fitting(k, along, deep));

// the building that fits a lot `along` × `deep` (metres along its street
// and back from it), scaled to fill it a little at random, never past
// the lot; null for none
function fit(rand, kit, along, deep) {
  const fits = kit.filter((k) => fitting(k, along, deep));
  if (!fits.length) return null;
  const k = pick(rand, fits);
  const [lo, hi] = k.scale ?? SCALE;
  const room = Math.min((along - 2 * GAP) / k.foot[0], (deep - 2 * GAP) / k.foot[1]);
  const scale = Math.min(room, lo + rand() * (hi - lo));
  return { k, scale };
}

// a building on a lot: its middle `deep` back from the street's edge at
// (ex, ez), facing (dx, dz) out to the street
function stand(rand, kit, ex, ez, dx, dz, along, deep, keep) {
  const got = fit(rand, kit, along, deep);
  if (!got) return null;
  const { k, scale } = got;
  const back = GAP + (k.foot[1] * scale) / 2;
  const x = ex - dx * back;
  const z = ez - dz * back;
  const r = (Math.hypot(...k.foot) * scale) / 2;
  if (!clearOf(keep, x, z, r)) return null;
  return { kind: k.kind, at: [x, z], yaw: Math.atan2(dx, dz) + (k.face ?? 0), scale, city: true };
}

function grid(spec, rand, keep) {
  const { r, street = 9, block = 36, plaza = 0, kit } = spec;
  const pitch = block + street;
  const n = Math.ceil(r / pitch);
  const half = block / 2;
  const things = [];
  const blocks = [];
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      const bx = i * pitch;
      const bz = j * pitch;
      if (Math.hypot(bx, bz) + half * Math.SQRT2 > r) continue;
      if (plaza && touches({ at: [0, 0], r: plaza }, bx, bz, half)) continue;
      blocks.push([bx, bz]);
      // (four lots a block, or two, or one, of the ways the kit can fill:
      // each its corner's two streets, one faced)
      const ways = [fitsIn(kit, half, half) ? 0.55 : 0, fitsIn(kit, block, half) ? 0.3 : 0, fitsIn(kit, block, block) ? 0.15 : 0];
      const sum = ways[0] + ways[1] + ways[2];
      if (!sum) continue;
      const roll = rand() * sum;
      const split = roll < ways[0] ? 0 : roll < ways[0] + ways[1] ? 0.6 : 0.9;
      const lots =
        split < 0.55
          ? [
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ].map(([sx, sz]) => ({ x: bx + (sx * half) / 2, z: bz + (sz * half) / 2, w: half, d: half, sides: [[sx, 0], [0, sz]] }))
          : split < 0.85
            ? [-1, 1].map((sz) => ({ x: bx, z: bz + (sz * half) / 2, w: block, d: half, sides: [[0, sz]] }))
            : [{ x: bx, z: bz, w: block, d: block, sides: [[1, 0], [-1, 0], [0, 1], [0, -1]] }];
      for (const lot of lots) {
        const [dx, dz] = lot.sides[Math.floor(rand() * lot.sides.length)];
        const along = dx ? lot.d : lot.w;
        const deep = dx ? lot.w : lot.d;
        const ex = lot.x + (dx * lot.w) / 2;
        const ez = lot.z + (dz * lot.d) / 2;
        const t = stand(rand, kit, ex, ez, dx, dz, along, deep, keep);
        if (t) things.push(t);
      }
    }
  // the streets: every line between the blocks, within the city and off the plaza
  const streets = [];
  for (let i = -n; i < n; i++) {
    const c = (i + 0.5) * pitch;
    const run = Math.sqrt(Math.max(0, r * r - c * c));
    if (run > 0) {
      streets.push({ from: [c, -run], to: [c, run] });
      streets.push({ from: [-run, c], to: [run, c] });
    }
  }
  return { things, blocks, streets, pitch, half };
}

function rings(spec, rand, keep) {
  const { r, street = 9, block = 36, plaza = 0, kit } = spec;
  const things = [];
  const roads = [];
  let lots = 0;
  // ring streets out from the plaza, a ring of lots back to back between
  // each two (or one row facing out, where the kit is too deep for two)
  const two = fitsIn(kit, 30, block / 2);
  for (let R = plaza + street / 2; R + street + block <= r; R += block + street) {
    roads.push(R);
    const inner = R + street / 2;
    const outer = inner + block;
    for (const [row, rad, out] of two
      ? [
          ['in', inner, -1],
          ['out', outer, 1],
        ]
      : [['out', outer, 1]]) {
      const deep = two ? block / 2 : block;
      const mid = row === 'in' ? inner + deep / 2 : outer - deep / 2;
      // (a lot as long as the kit's widest front needs at its least, and a
      // little more, so every kind of it can stand in any lot of the row)
      const len = (Math.max(...kit.map((k) => k.foot[0] * (k.scale ?? SCALE)[0])) + 2 * GAP) * (1 + rand() * 0.3);
      const count = Math.max(4, Math.floor((2 * Math.PI * mid) / len));
      const spokes = Math.max(3, Math.round(count / 6));
      for (let i = 0; i < count; i++) {
        if (i % Math.ceil(count / spokes) === 0) continue; // (a spoke's way through)
        const a = ((i + 0.5) / count) * Math.PI * 2;
        const dx = Math.cos(a) * -out;
        const dz = Math.sin(a) * -out;
        // (the row's edge on its ring street: the inner row faces in, the outer out)
        const ex = Math.cos(a) * rad;
        const ez = Math.sin(a) * rad;
        const t = stand(rand, kit, ex, ez, -dx, -dz, (2 * Math.PI * mid) / count, deep, keep);
        if (t) {
          things.push(t);
          lots++;
        }
      }
    }
  }
  roads.push(roads.length ? roads[roads.length - 1] + block + street : plaza + street / 2);
  return { things, roads, lots };
}

// lamps every `every` metres along a line, alternate sides of it
function lampsAlong(from, to, { kind, every, side }, keep, out) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const ux = (to[0] - from[0]) / len;
  const uz = (to[1] - from[1]) / len;
  for (let s = every / 2, i = 0; s < len; s += every, i++) {
    const k = i % 2 ? side : -side;
    const x = from[0] + ux * s - uz * k;
    const z = from[1] + uz * s + ux * k;
    if (clearOf(keep, x, z, 1)) out.push({ kind, at: [x, z], yaw: Math.atan2(ux, uz), city: true });
  }
}

export function cityOf(spec, { seed = 1 } = {}) {
  const rand = seeded(seed);
  const keep = [...(spec.keep ?? [])];
  const { street = 9, block = 36, plaza = 0 } = spec;
  const lampKind = spec.lamps === undefined ? 'lamp' : spec.lamps;
  const every = spec.every ?? 18;
  const life = [];
  const out = [];
  let lots = 0;
  if ((spec.plan ?? 'grid') === 'grid') {
    const g = grid(spec, rand, keep);
    out.push(...g.things);
    lots = g.things.length;
    if (lampKind) for (const s of g.streets) lampsAlong(s.from, s.to, { kind: lampKind, every, side: street / 2 - KERB }, [...keep, { at: [0, 0], r: plaza }], out);
    // clutter at the blocks' corners, on the pavement
    for (const [bx, bz] of g.blocks)
      for (let i = 0; i < (spec.clutter?.n ?? 2); i++) {
        const kinds = spec.clutter?.kinds ?? ['crates', 'barrels'];
        const c = [rand() < 0.5 ? -1 : 1, rand() < 0.5 ? -1 : 1];
        const x = bx + c[0] * (g.half + 0.8);
        const z = bz + c[1] * (g.half - 2 - rand() * 6);
        if (clearOf(keep, x, z, 1.5)) out.push({ kind: kinds[Math.floor(rand() * kinds.length)], at: [x, z], yaw: rand() * Math.PI * 2, city: true });
      }
    // walkers round blocks, on the pavement; craft over a loop of streets
    const loop = (bx, bz, h) => [
      [bx - h, bz - h],
      [bx + h, bz - h],
      [bx + h, bz + h],
      [bx - h, bz + h],
    ];
    if (spec.crowd && g.blocks.length)
      for (let i = 0; i < spec.crowd.n; i++) {
        const [bx, bz] = g.blocks[Math.floor(rand() * g.blocks.length)];
        const path = loop(bx, bz, g.half + street * 0.25);
        if (rand() < 0.5) path.reverse();
        life.push({ kind: spec.crowd.kinds[i % spec.crowd.kinds.length], path, speed: (spec.crowd.speed ?? 1.1) * (0.85 + rand() * 0.3), ...(spec.crowd.name ? { name: spec.crowd.name } : {}), ...(spec.crowd.says ? { says: spec.crowd.says } : {}), city: true });
      }
    if (spec.traffic)
      for (let i = 0; i < spec.traffic.n; i++) {
        const k = 1 + Math.floor(rand() * Math.max(1, Math.floor(spec.r / g.pitch) - 1));
        const h = (k - 0.5) * g.pitch;
        const path = loop(0, 0, Math.min(h, spec.r * 0.7));
        if (i % 2) path.reverse();
        life.push({ kind: spec.traffic.kind, path, pause: 0, speed: spec.traffic.speed ?? 14, y: (spec.traffic.y ?? 14) + (i % 3) * 4, solid: false, city: true });
      }
  } else {
    const g = rings(spec, rand, keep);
    out.push(...g.things);
    lots = g.lots;
    const circle = (R, n = 16) => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * R, Math.sin((i / n) * Math.PI * 2) * R]);
    if (lampKind)
      for (const R of g.roads) {
        const pts = circle(R + street / 2 - KERB, Math.max(8, Math.round((2 * Math.PI * R) / every)));
        pts.forEach(([x, z], i) => clearOf(keep, x, z, 1) && i % 2 === 0 && out.push({ kind: lampKind, at: [x, z], yaw: 0, city: true }));
      }
    if (spec.crowd && g.roads.length)
      for (let i = 0; i < spec.crowd.n; i++) {
        const R = g.roads[Math.floor(rand() * g.roads.length)] + (rand() < 0.5 ? -1 : 1) * (street / 2 - 1);
        const path = circle(R, 12);
        if (rand() < 0.5) path.reverse();
        life.push({ kind: spec.crowd.kinds[i % spec.crowd.kinds.length], path, speed: (spec.crowd.speed ?? 1.1) * (0.85 + rand() * 0.3), ...(spec.crowd.name ? { name: spec.crowd.name } : {}), ...(spec.crowd.says ? { says: spec.crowd.says } : {}), city: true });
      }
    if (spec.traffic)
      for (let i = 0; i < spec.traffic.n; i++) {
        const path = circle(g.roads[i % g.roads.length], 16);
        if (i % 2) path.reverse();
        life.push({ kind: spec.traffic.kind, path, pause: 0, speed: spec.traffic.speed ?? 14, y: (spec.traffic.y ?? 14) + (i % 3) * 4, solid: false, city: true });
      }
  }
  return { things: out, life, flat: { r: spec.r + 6 }, lots, block, street };
}

// a city's things as scatter rows, a kind each, so a city of a hundred
// buildings is a few instanced draws (placer.scatter), each building's
// footprint a solid box nine tenths of it
export function rowsOf(things, foot = {}) {
  const byKind = new Map();
  for (const t of things) {
    if (!byKind.has(t.kind)) byKind.set(t.kind, []);
    const f = foot[t.kind];
    byKind.get(t.kind).push({ at: t.at, yaw: t.yaw ?? 0, scale: t.scale ?? 1, ...(f ? { box: [f[0] * 0.45, f[1] * 0.45] } : {}) });
  }
  return [...byKind].map(([kind, items]) => ({ kind, items, solid: true, city: true }));
}
