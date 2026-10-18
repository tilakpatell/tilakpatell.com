// The small things of a sector: a 20 x 20 x 20 lattice of cells, each with at
// most one rock, ice, derelict or rogue, so space is populated in every
// direction. The cell's slot and a 32-bit hash of the sector seed fix what
// sits in it, so any one cell can be rebuilt alone, in any order, and give
// what the whole list gives. Pure (no three.js), so it runs in Node.
//
// THING_BASE (wonder ids from here up are lattice slots), THING_CELLS, THING_JITTER, THING_NEAR
// THING_KINDS: the table of kinds, { kind, weight, size: [least, most], look: { color, lit }, place?(site, ctx) }
//   (place may return a new [x, y, z] in absolute space or null to drop the site; it runs before the clearance checks)
// SECTOR_EXTRAS: whole-sector lists { list, base, max, make(ctx) → [{ kind, at, size, ... }] }
// thingsOf(ctx, extras = SECTOR_EXTRAS, kinds = THING_KINDS) → { things: ThingSet, extras: { [list]: Row[] } }
//   ctx is { sx, sy, sz, origin, seed, systems, outs }
//   ThingSet is { count, slot: Uint16Array, kind: Uint8Array (index into kinds), at: Float32Array (xyz from the origin), size: Float32Array }
// thingInCell(ctx, slot, kinds = THING_KINDS) → { kind (index), at (from the origin), size } | null
//   (cells run in slot order ix + 20 * (iy + 20 * iz), centre = origin - 57000 + 6000 * (ix, iy, iz))
// thingSeed(sectorSeed, n) → bigint
// thingRow(sector, i) → { id, n, kind (name), at (absolute), size, seed, name }
//   (sector carries { sx, sy, sz, origin, seed, things })

import { SECTOR, spaceId } from '../../../lib/space/address.js';
import { clearOfKeepOuts } from './keepOuts';
import { nameOf } from './names';
import { hash64, rngOf } from './seed';
import { systemReach } from './systems';

export const THING_BASE = 64;
export const THING_CELLS = 20;
export const THING_JITTER = 0.8;
export const THING_NEAR = 8;

export const THING_KINDS = [
  { kind: 'rock', weight: 6, size: [20, 120], look: { color: '#8a8178', lit: true } },
  { kind: 'ice', weight: 2, size: [15, 90], look: { color: '#cfe3ee', lit: true } },
  { kind: 'derelict', weight: 1, size: [30, 140], look: { color: '#6d727c', lit: true } },
  { kind: 'rogue', weight: 0.4, size: [100, 260], look: { color: '#4a3f38', lit: true } },
];

export const SECTOR_EXTRAS = [];

const CELL = SECTOR / THING_CELLS;
const HALF = CELL / 2;
const SLOTS = THING_CELLS ** 3;
const SKIN = SECTOR / 2 + CELL; // systems further out than this can't touch a thing
const BUCKET = 12000;

export const thingSeed = (sectorSeed, n) => hash64(sectorSeed, 'thing', n);

// A murmur3-style finaliser over four words; no BigInt, so 8,000 cells stay cheap.
function mix(a, b, c, d) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ b;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) ^ c;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) ^ d;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
const unit = (a, b, c, d) => mix(a, b, c, d) / 4294967296;

const key = (bx, by, bz) => (bx + 1000) * 4000000 + (by + 1000) * 2000 + (bz + 1000);

// Per ctx and kinds, the parts worth doing once: the seed halves, the total
// weight and a coarse bucket grid of the systems. A pure cache, so the order
// of asking changes nothing.
const prepared = new WeakMap();
function prepare(ctx, kinds) {
  let byKinds = prepared.get(ctx);
  if (!byKinds) prepared.set(ctx, (byKinds = new Map()));
  let p = byKinds.get(kinds);
  if (p) return p;
  const seed = BigInt(ctx.seed);
  const maxSize = Math.max(...kinds.map((k) => k.size[1]));
  const grid = new Map();
  const [ox, oy, oz] = ctx.origin;
  for (const s of ctx.systems) {
    const reach = (s.reach ?? systemReach(s)) + maxSize;
    const e = [s.at[0] - ox, s.at[1] - oy, s.at[2] - oz];
    if (e.some((v) => Math.abs(v) - reach > SKIN)) continue;
    const lo = e.map((v) => Math.floor((v - reach) / BUCKET));
    const hi = e.map((v) => Math.floor((v + reach) / BUCKET));
    const row = { at: s.at, reach: reach - maxSize };
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let z = lo[2]; z <= hi[2]; z++) {
          const k = key(x, y, z);
          const list = grid.get(k);
          if (list) list.push(row);
          else grid.set(k, [row]);
        }
  }
  p = {
    h0: Number(seed & 0xffffffffn) | 0,
    h1: Number((seed >> 32n) & 0xffffffffn) | 0,
    total: kinds.reduce((t, k) => t + k.weight, 0),
    grid,
  };
  byKinds.set(kinds, p);
  return p;
}

function cell(ctx, p, kinds, slot) {
  const { h0, h1 } = p;
  let r = unit(h0, h1, slot, 1) * p.total;
  let ki = kinds.length - 1;
  for (let i = 0; i < kinds.length; i++) {
    if ((r -= kinds[i].weight) <= 0) {
      ki = i;
      break;
    }
  }
  const [least, most] = kinds[ki].size;
  const size = least + unit(h0, h1, slot, 2) * (most - least);
  const ix = slot % THING_CELLS;
  const iy = Math.floor(slot / THING_CELLS) % THING_CELLS;
  const iz = Math.floor(slot / (THING_CELLS * THING_CELLS));
  const jit = THING_JITTER * HALF;
  const rel = [ix, iy, iz].map(
    (c, a) => -SECTOR / 2 + HALF + CELL * c + (unit(h0, h1, slot, 3 + a) * 2 - 1) * jit,
  );
  let at = [ctx.origin[0] + rel[0], ctx.origin[1] + rel[1], ctx.origin[2] + rel[2]];
  const place = kinds[ki].place;
  if (place) {
    at = place({ slot, kind: kinds[ki].kind, at, size }, ctx);
    if (!at) return null;
  }
  if (!clearOfKeepOuts(at, (THING_NEAR + 1) * size, ctx.outs ?? [])) return null;
  const near = p.grid.get(
    key(
      Math.floor((at[0] - ctx.origin[0]) / BUCKET),
      Math.floor((at[1] - ctx.origin[1]) / BUCKET),
      Math.floor((at[2] - ctx.origin[2]) / BUCKET),
    ),
  );
  if (near) {
    for (const s of near) {
      const dx = at[0] - s.at[0];
      const dy = at[1] - s.at[1];
      const dz = at[2] - s.at[2];
      const min = s.reach + size;
      if (dx * dx + dy * dy + dz * dz < min * min) return null;
    }
  }
  return {
    kind: ki,
    at: [at[0] - ctx.origin[0], at[1] - ctx.origin[1], at[2] - ctx.origin[2]],
    size,
  };
}

export function thingInCell(ctx, slot, kinds = THING_KINDS) {
  return cell(ctx, prepare(ctx, kinds), kinds, slot);
}

export function thingsOf(ctx, extras = SECTOR_EXTRAS, kinds = THING_KINDS) {
  const p = prepare(ctx, kinds);
  const slot = new Uint16Array(SLOTS);
  const kind = new Uint8Array(SLOTS);
  const at = new Float32Array(SLOTS * 3);
  const size = new Float32Array(SLOTS);
  let count = 0;
  for (let s = 0; s < SLOTS; s++) {
    const t = cell(ctx, p, kinds, s);
    if (!t) continue;
    slot[count] = s;
    kind[count] = t.kind;
    at.set(t.at, count * 3);
    size[count] = t.size;
    count++;
  }
  const things = {
    count,
    slot: slot.slice(0, count),
    kind: kind.slice(0, count),
    at: at.slice(0, count * 3),
    size: size.slice(0, count),
  };
  const lists = {};
  for (const e of extras) {
    if (e.base + e.max > THING_BASE) throw new Error(`extra ${e.list} reaches into the lattice's ids`);
    lists[e.list] = e
      .make(ctx)
      .slice(0, e.max)
      .map((row, k) => ({ ...row, id: spaceId([ctx.sx, ctx.sy, ctx.sz], { wonder: e.base + k }) }));
  }
  return { things, extras: lists };
}

export function thingRow(sector, i) {
  const t = sector.things;
  const n = THING_BASE + t.slot[i];
  const seed = thingSeed(sector.seed, n);
  const name = nameOf(rngOf(seed), 'core');
  return {
    id: spaceId([sector.sx, sector.sy, sector.sz], { wonder: n }),
    n,
    kind: THING_KINDS[t.kind[i]].kind,
    at: [
      sector.origin[0] + t.at[i * 3],
      sector.origin[1] + t.at[i * 3 + 1],
      sector.origin[2] + t.at[i * 3 + 2],
    ],
    size: t.size[i],
    seed,
    name: name[0].toUpperCase() + name.slice(1),
  };
}
