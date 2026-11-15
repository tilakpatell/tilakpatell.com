// Clouds and life between the systems: nebula pockets, supernova remnants,
// ion storms, leviathan herds, swarms in the nebulae and the debris of old
// battles. None in the core sector, which stays lighter (spec A) and holds
// the hand-made places. Each list from its own rng off the sector's seed.
// Pure (no three.js).
//
// CLOUDS: { [list]: { base, max, count: [least, most], size: [least, most] } }, the table
// REMNANTS, STORMS, POCKETS, SWARMS, HERDS, DEBRIS: the lists
//   a pocket { colors: [c0, c1], form: 'cloud' } and a remnant ({ form: 'shell' }) keep
//   NEBULA_SHOW + size off every hand-made place, so neither is drawn at a baseline pose;
//   a swarm sits in a pocket or a legacy nebula, on a loop of 0.35 × its size; a storm and a
//   herd drift on loops; every mover's extent is its loop's radius

import { hexOf } from '../catalogue';
import { KEEP_OUTS, clearOfKeepOuts } from '../keepOuts';
import { pathAt } from '../paths';
import { hash64, int, range, rngOf } from '../seed';
import { THING_NEAR } from '../things';
import { tint } from '../../../universe/shared/space';
import { dartIn, loopOf, nameIn, placedOf, roomFor } from './place';

export const CLOUDS = Object.freeze({
  remnant: { base: 10, max: 2, count: [1, 2], size: [2500, 6000] },
  storm: { base: 18, max: 4, count: [2, 4], size: [1500, 4000] },
  pocket: { base: 22, max: 6, count: [2, 6], size: [1200, 3000] },
  swarm: { base: 28, max: 9, size: [80, 200] },
  herd: { base: 37, max: 3, count: [1, 3], size: [120, 300] },
  debris: { base: 40, max: 6, count: [2, 6], size: [300, 900] },
});
const POCKET_TINTS = ['nebula', 'engine', 'shot', 'sun'];

const rngFor = (ctx, list) => rngOf(hash64(ctx.seed, list));

// count darts, each a row of `make(rng, at, size)` when it lands
function scatter(ctx, made, list, { show = false, extent = () => 0, make }) {
  if (ctx.core) return [];
  const t = CLOUDS[list];
  const rng = rngFor(ctx, list);
  const n = int(rng, ...t.count);
  const placed = placedOf(made);
  const out = [];
  for (let i = 0; i < n; i++) {
    const size = range(rng, ...t.size);
    const ext = extent(rng, size);
    const at = dartIn(rng, ctx, { size, extent: ext, show }, placed);
    if (!at) continue;
    placed.push({ at, r: size + ext });
    out.push(make(rng, at, size, ext));
  }
  return out;
}

const seedOf = (ctx, list, at) => hash64(ctx.seed, list, at.map((v) => Math.round(v)).join(','));

function pockets(ctx, made) {
  return scatter(ctx, made, 'pocket', {
    show: true,
    make: (rng, at, size) => {
      const a = Math.floor(rng() * POCKET_TINTS.length);
      const b = (a + 1 + Math.floor(rng() * (POCKET_TINTS.length - 1))) % POCKET_TINTS.length;
      return { kind: 'pocket', name: nameIn(rng, ctx), at, size, colors: [hexOf(tint(POCKET_TINTS[a], 0.15)), hexOf(tint(POCKET_TINTS[b], 0.3))], form: 'cloud', seed: seedOf(ctx, 'pocket', at) };
    },
  });
}

function remnants(ctx, made) {
  return scatter(ctx, made, 'remnant', {
    show: true,
    make: (rng, at, size) => ({ kind: 'remnant', name: nameIn(rng, ctx), at, size, colors: [hexOf(tint('engine', 0.2)), hexOf(tint('shot', 0.25))], form: 'shell', seed: seedOf(ctx, 'remnant', at) }),
  });
}

function herds(ctx, made) {
  return scatter(ctx, made, 'herd', {
    extent: (rng) => range(rng, 3000, 8000),
    make: (rng, at, size, radius) => {
      const path = loopOf(rng, at, radius, int(rng, 2, 5));
      return { kind: 'herd', name: nameIn(rng, ctx), at: pathAt(path, 0), size, path, extent: radius, bodies: int(rng, 5, 12), seed: seedOf(ctx, 'herd', at) };
    },
  });
}

function debris(ctx, made) {
  return scatter(ctx, made, 'debris', {
    make: (rng, at, size) => ({ kind: 'debris', name: nameIn(rng, ctx), at, size, seed: seedOf(ctx, 'debris', at) }),
  });
}

function storms(ctx, made) {
  if (ctx.core) return [];
  const t = CLOUDS.storm;
  const rng = rngFor(ctx, 'storm');
  const n = int(rng, ...t.count);
  const placed = placedOf(made);
  const hazards = ctx.systems.filter((s) => s.hazard === 'storm');
  const out = [];
  for (let i = 0; i < n; i++) {
    const size = range(rng, ...t.size);
    const radius = range(rng, 0.4, 1) * size;
    const spec = { size, extent: radius };
    let at = null;
    // (the first wants a system the generator says has storms, 6,000 to 20,000 from its star)
    if (i === 0)
      for (const s of hazards) {
        const a = rng() * 2 * Math.PI;
        const d = range(rng, 6000, 20000);
        const p = [s.at[0] + Math.cos(a) * d, s.at[1] + range(rng, -500, 500), s.at[2] + Math.sin(a) * d];
        if (roomFor(p, spec, ctx, placed)) {
          at = p;
          break;
        }
      }
    at ??= dartIn(rng, ctx, spec, placed);
    if (!at) continue;
    placed.push({ at, r: size + radius });
    const path = loopOf(rng, at, radius, int(rng, 2, 6));
    out.push({ kind: 'storm', name: nameIn(rng, ctx), at: pathAt(path, 0), size, path, extent: radius, seed: seedOf(ctx, 'storm', at) });
  }
  return out;
}

function swarms(ctx, made) {
  if (ctx.core) return [];
  const rng = rngFor(ctx, 'swarm');
  const homes = [...(made.pocket ?? []), ...(ctx.wonders ?? []).filter((w) => w.kind === 'nebula')];
  const out = [];
  for (const n of homes) {
    if (out.length >= CLOUDS.swarm.max) break;
    const size = range(rng, ...CLOUDS.swarm.size);
    const radius = 0.35 * n.size;
    const path = loopOf(rng, n.at, radius, int(rng, 4, 12));
    // (drawn near, not by the nebula renderer, so it keeps the near things' rule)
    if (!clearOfKeepOuts(n.at, (THING_NEAR + 1) * size + radius, KEEP_OUTS)) continue;
    out.push({ kind: 'swarm', name: nameIn(rng, ctx), at: pathAt(path, 0), size, path, extent: radius, nebula: n.id, seed: hash64(ctx.seed, 'swarm', n.id) });
  }
  return out;
}

const list = (name, make) => ({ list: name, base: CLOUDS[name].base, max: CLOUDS[name].max, make });
export const REMNANTS = list('remnant', remnants);
export const STORMS = list('storm', storms);
export const POCKETS = list('pocket', pockets);
export const SWARMS = list('swarm', swarms);
export const HERDS = list('herd', herds);
export const DEBRIS = list('debris', debris);
