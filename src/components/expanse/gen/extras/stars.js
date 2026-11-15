// Dead stars, young stars and wormholes between the systems: pulsars and
// magnetars with beams sweeping, stars still forming in their dust, and one
// wormhole a sector that throws you far away, one way. None in the core.
// Pure (no three.js).
//
// STARS: { [list]: { base, max, count, size } }
// WORMHOLES (w8), PULSARS (w12–w14, a pulsar seven in ten, else a magnetar, its beam's reach
//   25 × its size its extent), PROTOSTARS (w15–w17): the lists
// wormholeExit(from, universe) → { sector: [sx, sy, sz], key, at, heading, side }: the one
//   rule for a one-way throw. from is { seed, sector: [sx, sy, sz] } (a wormhole row is one;
//   another lane's rift can pass its own). 30 to 80 sectors away along a direction even in 3D,
//   150 inside one of that sector's four beacons, facing in; heading is the ship's (atan2 of
//   minus the facing's x and z)

import { sectorKey } from '../../../../lib/space/address.js';
import { beaconsOf } from '../sector';
import { hash64, int, range, rngOf, sectorSeedOf } from '../seed';
import { dartIn, nameIn, placedOf } from './place';

export const STARS = Object.freeze({
  wormhole: { base: 8, max: 1, count: [1, 1], size: [60, 140] },
  pulsar: { base: 12, max: 3, count: [1, 3], size: [40, 90] },
  protostar: { base: 15, max: 3, count: [1, 3], size: [300, 700] },
});
const BEAM = 25;
const INWARD = { n: [0, 0, 1], s: [0, 0, -1], e: [-1, 0, 0], w: [1, 0, 0] };

function scatter(ctx, made, list, make) {
  if (ctx.core) return [];
  const t = STARS[list];
  const rng = rngOf(hash64(ctx.seed, list));
  const n = int(rng, ...t.count);
  const placed = placedOf(made);
  const out = [];
  for (let i = 0; i < n; i++) {
    const size = range(rng, ...t.size);
    const kind = make.kind(rng);
    const extent = kind === 'pulsar' || kind === 'magnetar' ? BEAM * size : 0;
    const at = dartIn(rng, ctx, { size, extent }, placed);
    if (!at) continue;
    placed.push({ at, r: size + extent });
    out.push({ kind, name: nameIn(rng, ctx), at, size, ...(extent ? { extent } : {}), ...make.more(ctx), seed: hash64(ctx.seed, list, i) });
  }
  return out;
}

const wormholes = (ctx, made) => scatter(ctx, made, 'wormhole', { kind: () => 'wormhole', more: (c) => ({ sector: [c.sx, c.sy, c.sz] }) });
const pulsars = (ctx, made) => scatter(ctx, made, 'pulsar', { kind: (rng) => (rng() < 0.7 ? 'pulsar' : 'magnetar'), more: () => ({}) });
const protostars = (ctx, made) => scatter(ctx, made, 'protostar', { kind: () => 'protostar', more: () => ({}) });

export function wormholeExit(from, universe) {
  const rng = rngOf(hash64(from.seed, 'exit'));
  const dist = range(rng, 30, 80);
  const z = rng() * 2 - 1;
  const a = rng() * 2 * Math.PI;
  const r = Math.sqrt(1 - z * z);
  const dir = [r * Math.cos(a), z, r * Math.sin(a)];
  const sector = from.sector.map((v, k) => v + Math.round(dir[k] * dist));
  const [sx, sy, sz] = sector;
  const beacons = beaconsOf(sx, sz, sectorSeedOf(universe, sx, sy, sz), sy);
  const side = ['n', 'e', 's', 'w'][Math.floor(rng() * 4)];
  const b = beacons[side];
  const into = INWARD[side];
  const at = [b.at[0] + into[0] * 150, b.at[1], b.at[2] + into[2] * 150];
  return { sector, key: sectorKey(sx, sy, sz), at, heading: Math.atan2(-into[0], -into[2]), side };
}

const list = (name, make) => ({ list: name, base: STARS[name].base, max: STARS[name].max, make });
export const WORMHOLES = list('wormhole', wormholes);
export const PULSARS = list('pulsar', pulsars);
export const PROTOSTARS = list('protostar', protostars);
