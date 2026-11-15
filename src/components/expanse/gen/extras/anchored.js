// Things anchored at the stations: a fleet at anchor over a station's pole,
// and a shipyard over the other pole of its star. Each from its station's own
// seed. Neither is made in the core sector, which stays lighter (spec A).
// Pure (no three.js).
//
// FLEET = { share, size, ships }; YARD = { share, size }
// FLEETS (w50000 +), YARDS (w60000 +): the lists

import { KEEP_OUTS, clearOfKeepOuts } from '../keepOuts';
import { hash64, int, range, rngOf } from '../seed';
import { poleHeight } from '../stations';
import { nameIn } from './place';

export const FLEET = Object.freeze({ share: 0.5, size: [80, 220], ships: [3, 7] });
export const YARD = Object.freeze({ share: 0.25, size: [120, 300] });

const systemOf = (ctx, st) => ctx.systems[st.i];

function fleetsOf(ctx) {
  if (ctx.core) return [];
  const out = [];
  for (const st of ctx.stations ?? []) {
    const seed = hash64(st.seed, 'fleet');
    const rng = rngOf(seed);
    if (!(rng() < FLEET.share)) continue;
    const size = range(rng, ...FLEET.size);
    const ships = int(rng, ...FLEET.ships);
    const sys = systemOf(ctx, st);
    const side = Math.sign(st.at[1] - sys.at[1]) || 1;
    const at = [st.at[0], st.at[1] + side * (3 * st.size + size), st.at[2]];
    const name = nameIn(rng, ctx);
    if (!clearOfKeepOuts(at, 9 * size, KEEP_OUTS)) continue;
    out.push({ kind: 'fleet', name, at, size, station: st.id, system: sys.id, faction: sys.faction, ships, seed });
  }
  return out;
}

function yardsOf(ctx) {
  if (ctx.core) return [];
  const out = [];
  for (const st of ctx.stations ?? []) {
    const seed = hash64(st.seed, 'yard');
    const rng = rngOf(seed);
    if (!(rng() < YARD.share)) continue;
    const size = range(rng, ...YARD.size);
    const sys = systemOf(ctx, st);
    const h = poleHeight(sys, size);
    if (h === null) continue;
    const side = Math.sign(st.at[1] - sys.at[1]) || 1;
    const at = [sys.at[0], sys.at[1] - side * h, sys.at[2]];
    const name = nameIn(rng, ctx);
    if (!clearOfKeepOuts(at, 9 * size, KEEP_OUTS)) continue;
    out.push({ kind: 'shipyard', name, at, size, station: st.id, system: sys.id, seed });
  }
  return out;
}

export const FLEETS = { list: 'fleet', base: 50000, max: 9999, make: fleetsOf };
export const YARDS = { list: 'shipyard', base: 60000, max: 9999, make: yardsOf };
