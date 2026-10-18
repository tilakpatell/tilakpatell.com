// A planet's orbit map, asked for in any state: baked in a worker through the
// page's pool (lib/land/flight/orbitMap.worker.js) and kept in memory for the
// session, at most `cap` maps. A map is a second or three of work, so a bake
// asked twice at once is one bake, and a bake that comes back null (cancelled,
// failed, the pool closed) answers null and is not remembered, so the next ask
// tries again. Nothing here throws. The map is made again each visit, never
// kept between them.
//
// Recency: `get` counts as a use (a hit moves the map to the newest); `peek`
// does not, since a look from a frame loop would otherwise keep every map it
// glances at alive.
//
// Pure apart from the worker factory's `new Worker(new URL(...))`.
//
//   ORBIT_WORKER: the pool's name for the group
//   makeOrbitWorker() → a module Worker (null where there is no Worker)
//   createOrbitMaps({ workers, make = makeOrbitWorker, cap = 16 }) →
//     { get(spec, tier) → Promise<{ width, height, rgba, biome } | null>,
//       peek(spec, tier) → map | null,
//       stats() → { cached, flying },
//       dispose() }

import { orbitMapSize } from './orbitMap.js';

export const ORBIT_WORKER = 'flight-orbit-map';

export const makeOrbitWorker = () =>
  typeof Worker === 'undefined' ? null : new Worker(new URL('./orbitMap.worker.js', import.meta.url), { type: 'module' });

export function createOrbitMaps({ workers, make = makeOrbitWorker, cap = 16 }) {
  workers.define(ORBIT_WORKER, make, { size: 1 });
  const cache = new Map(); // key → map, oldest first
  const flying = new Map(); // key → Promise
  let epoch = 0; // bumped by dispose, so a bake begun before it isn't kept after

  const keyOf = (spec, tier) => {
    const { width, height } = orbitMapSize(tier);
    return { key: `${spec.id}:${width}x${height}`, width, height };
  };

  async function bake(key, spec, width, height) {
    const mine = epoch;
    try {
      const out = await workers.request(ORBIT_WORKER, { key, spec, width, height });
      if (!out || !out.rgba || !out.biome) return null;
      const map = { width: out.width, height: out.height, rgba: out.rgba, biome: out.biome };
      if (mine !== epoch) return map;
      cache.set(key, map);
      while (cache.size > cap) cache.delete(cache.keys().next().value);
      return map;
    } catch {
      return null;
    } finally {
      if (mine === epoch) flying.delete(key);
    }
  }

  return {
    get(spec, tier) {
      try {
        const { key, width, height } = keyOf(spec, tier);
        const hit = cache.get(key);
        if (hit) {
          cache.delete(key);
          cache.set(key, hit);
          return Promise.resolve(hit);
        }
        if (!flying.has(key)) flying.set(key, bake(key, spec, width, height));
        return flying.get(key);
      } catch {
        return Promise.resolve(null);
      }
    },
    peek(spec, tier) {
      try {
        return cache.get(keyOf(spec, tier).key) ?? null;
      } catch {
        return null;
      }
    },
    stats: () => ({ cached: cache.size, flying: flying.size }),
    dispose() {
      epoch++;
      cache.clear();
      flying.clear();
      workers.close(ORBIT_WORKER);
    },
  };
}
