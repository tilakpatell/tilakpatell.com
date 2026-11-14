// Room for a thing in a sector's lists: the clearances every list keeps, a
// dart thrown until one fits, and a name. Pure (no three.js).
//
// The keep-outs are every row of KEEP_OUTS, not the ctx's `outs`:
// keepOutsNear keeps only the keep-outs whose sphere touches the sector's
// cube, which for most of the core's neighbours is none, while a list's
// clearances run to 46,000 (a cloud's NEBULA_SHOW).
//
// NEBULA_SHOW: how far off a cloud is drawn (its renderer's reach), so a pocket or a remnant
//   keeps that much more clear of the hand-made places
// roomFor(at, { size, extent = 0, show = false, own = null }, ctx, placed) → boolean, clear of:
//   every keep-out by (THING_NEAR + 1) × size + extent (show: NEBULA_SHOW + size + extent);
//   every system but `own` by its reach + size + extent; every legacy wonder but a nebula by its
//   size + size; every beacon by 3,000; every row placed before it ([{ at, r }], r its size and
//   extent) by r + size + extent; and the gargantuans' solids (ctx.keeps, [{ at, r }]) by
//   r + size + extent
// dartIn(rng, ctx, spec, placed, tries = 40) → [x, y, z] | null: darts in the cube
//   CUBE_HALF − size − extent round the sector's middle, until roomFor, so the row's whole
//   extent stays in its own sector, where a neighbour's lists, which don't know it, can't reach
// nameIn(rng, ctx) → a name, in the culture of the sector's distance from home

import { CUBE_HALF } from '../cube';
import { KEEP_OUTS, clearOfKeepOuts } from '../keepOuts';
import { nameOf } from '../names';
import { range } from '../seed';
import { cultureOf } from '../systems';
import { THING_NEAR } from '../things';

export const NEBULA_SHOW = 40000;
const BEACON_GAP = 3000;

const far = (a, b, r) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz >= r * r;
};

export function roomFor(at, { size, extent = 0, show = false, own = null }, ctx, placed = []) {
  const clear = show ? NEBULA_SHOW + size + extent : (THING_NEAR + 1) * size + extent;
  if (!clearOfKeepOuts(at, clear, KEEP_OUTS)) return false;
  for (const s of ctx.systems) if (s.id !== own && !far(at, s.at, s.reach + size + extent)) return false;
  for (const w of ctx.wonders ?? []) if (w.kind !== 'nebula' && !far(at, w.at, w.size + size)) return false;
  for (const b of Object.values(ctx.beacons ?? {})) if (!far(at, b.at, BEACON_GAP)) return false;
  for (const p of placed) if (!far(at, p.at, p.r + size + extent)) return false;
  for (const k of ctx.keeps ?? []) if (!far(at, k.at, k.r + size + extent)) return false;
  return true;
}

export function dartIn(rng, ctx, spec, placed = [], tries = 40) {
  const half = CUBE_HALF - spec.size - (spec.extent ?? 0);
  if (half <= 0) return null;
  for (let t = 0; t < tries; t++) {
    const at = ctx.origin.map((o) => o + range(rng, -half, half));
    if (roomFor(at, spec, ctx, placed)) return at;
  }
  return null;
}

export function nameIn(rng, ctx) {
  const n = nameOf(rng, cultureOf(rng, ctx.d ?? 0));
  return n[0].toUpperCase() + n.slice(1);
}
