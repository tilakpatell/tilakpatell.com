// Things round the systems: asteroid and ice fields at a system's edge,
// comets on long ellipses round its star, and mining rigs in the fields.
// Each comes from its system's own seed, so a system's stars and planets are
// the same whether it has one or not. Pure (no three.js).
//
// FIELD, COMET, RIG: the numbers each is drawn from
// FIELDS, COMETS, RIGS: the lists (w20000 +, w30000 +, w40000 +)
// tailOf(row, t) → { dir, length }: a comet's tail, pointing from its star, longest at
//   perihelion (its full `tail` within 2 q, a share 0.15 of it at most past 13.3 q)

import { SECTOR } from '../../../../lib/space/address.js';
import { KEEP_OUTS, clearOfKeepOuts } from '../keepOuts';
import { COMET_PERIOD, pathAt, pathSpeed, rowAt } from '../paths';
import { hash64, range, rngOf } from '../seed';
import { nameIn, roomFor } from './place';

export const FIELD = Object.freeze({ share: 1 / 3, ice: 0.3, size: [250, 700], out: [1.15, 1.6], height: 300 });
export const COMET = Object.freeze({ share: 0.25, size: [6, 20], q: [1.2, 2.0], Q: [1.5, 3], tail: [60, 160], tilt: 0.6, fast: 0.25 });
export const RIG = Object.freeze({ share: 1 / 3, size: [40, 90] });

const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const sphere = (rng) => {
  const z = rng() * 2 - 1;
  const a = rng() * 2 * Math.PI;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a), z];
};

function fieldsOf(ctx) {
  const out = [];
  const placed = [];
  for (const sys of ctx.systems) {
    const seed = hash64(sys.seed, 'field');
    const rng = rngOf(seed);
    if (!(rng() < FIELD.share)) continue;
    const size = range(rng, ...FIELD.size);
    const ice = rng() < FIELD.ice;
    const a = rng() * 2 * Math.PI;
    const out1 = range(rng, ...FIELD.out) * sys.reach;
    const h = range(rng, -FIELD.height, FIELD.height);
    const name = nameIn(rng, ctx);
    const at = [sys.at[0] + Math.cos(a) * out1, sys.at[1] + h, sys.at[2] + Math.sin(a) * out1];
    if (!roomFor(at, { size, own: sys.id }, ctx, placed)) continue;
    placed.push({ at, r: size });
    out.push({ kind: ice ? 'icefield' : 'field', name, at, size, system: sys.id, seed });
  }
  return out;
}

function inCube(focus, origin, reach) {
  for (let k = 0; k < 3; k++) if (Math.abs(focus[k] - origin[k]) + reach > SECTOR / 2) return false;
  return true;
}

function cometsOf(ctx) {
  const out = [];
  for (const sys of ctx.systems) {
    const seed = hash64(sys.seed, 'comet');
    const rng = rngOf(seed);
    if (!(rng() < COMET.share)) continue;
    const size = range(rng, ...COMET.size);
    const q = range(rng, ...COMET.q) * sys.star.size;
    const Q = range(rng, ...COMET.Q) * sys.reach;
    const tail = range(rng, ...COMET.tail);
    const peri = sphere(rng);
    // (a normal near the star's up, tilted by at most COMET.tilt, then square to peri)
    const lean = sphere(rng);
    const k = Math.sin(COMET.tilt) * rng();
    const n0 = [lean[0] * k, 1, lean[2] * k];
    const d = n0[0] * peri[0] + n0[1] * peri[1] + n0[2] * peri[2];
    const normal = unit([n0[0] - d * peri[0], n0[1] - d * peri[1], n0[2] - d * peri[2]]);
    const phase = rng();
    const name = nameIn(rng, ctx);
    const e = (Q - q) / (Q + q);
    const path = { type: 'kepler', focus: [...sys.at], q, e, peri, normal, period: COMET_PERIOD, phase };
    if (!(pathSpeed(path) < COMET.fast)) continue;
    const span = Q + tail;
    if (!clearOfKeepOuts(sys.at, span + 9 * size, KEEP_OUTS)) continue;
    if (!inCube(sys.at, ctx.origin, span)) continue;
    if (ctx.systems.some((o) => o !== sys && Math.hypot(o.at[0] - sys.at[0], o.at[1] - sys.at[1], o.at[2] - sys.at[2]) < span + o.reach)) continue;
    if ((ctx.keeps ?? []).some((g) => Math.hypot(g.at[0] - sys.at[0], g.at[1] - sys.at[1], g.at[2] - sys.at[2]) < g.r + span + size)) continue;
    out.push({ kind: 'comet', name, at: pathAt(path, 0), size, system: sys.id, star: [...sys.at], path, tail, extent: Q, seed });
  }
  return out;
}

function rigsOf(ctx, made) {
  const out = [];
  for (const f of made.field ?? []) {
    const seed = hash64(f.seed, 'rig');
    const rng = rngOf(seed);
    if (!(rng() < RIG.share)) continue;
    const size = range(rng, ...RIG.size);
    out.push({ kind: 'rig', name: nameIn(rng, ctx), at: [...f.at], size, field: f.id, system: f.system, seed });
  }
  return out;
}

export function tailOf(row, t) {
  const at = rowAt(row, t);
  const v = [at[0] - row.star[0], at[1] - row.star[1], at[2] - row.star[2]];
  const r = Math.hypot(v[0], v[1], v[2]);
  return { dir: [v[0] / r, v[1] / r, v[2] / r], length: row.tail * Math.min(1, Math.max(0.15, (2 * row.path.q) / r)) };
}

export const FIELDS = { list: 'field', base: 20000, max: 9999, make: fieldsOf };
export const COMETS = { list: 'comet', base: 30000, max: 9999, make: cometsOf };
export const RIGS = { list: 'rig', base: 40000, max: 9999, make: rigsOf };
