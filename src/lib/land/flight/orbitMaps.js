// The orbit maps a page asks for, baked in a worker (./orbitMap.worker.js,
// through runtime/workers.js's pool) and kept in memory only: at most `cap`,
// the least recently used dropped first. Never stored anywhere else; a map
// is made again when it is wanted again. Two asks for one map make one bake;
// a bake that comes back null (cancelled, failed) is not kept, so the next
// ask bakes again.
//
//   ORBIT_WORKER → the pool's name for it; makeOrbitWorker() → the worker
//   createOrbitMaps({ workers, make, cap = 16 }) → { get(spec, tier) → Promise<map | null>,
//     peek(spec, tier) → map | null, stats() → { cached, flying }, dispose() }
//   (a map: { width, height, rgba (sRGB bytes, alpha 0 under water), biome })

import { orbitMapSize } from './orbitMap.js';

export const ORBIT_WORKER = 'flight-orbit-map';
export const makeOrbitWorker = () => new Worker(new URL('./orbitMap.worker.js', import.meta.url), { type: 'module' });

export function createOrbitMaps({ workers, make = makeOrbitWorker, cap = 16 } = {}) {
  workers.define(ORBIT_WORKER, make, { size: 1 });
  const cached = new Map(); // key → map, the most recent last
  const flying = new Map(); // key → Promise<map | null>

  const keyOf = (spec, tier) => {
    const { width, height } = orbitMapSize(tier);
    return { key: `${spec.id}:${width}x${height}`, width, height };
  };

  const peek = (spec, tier) => {
    const { key } = keyOf(spec, tier);
    const map = cached.get(key);
    if (!map) return null;
    cached.delete(key);
    cached.set(key, map);
    return map;
  };

  function get(spec, tier) {
    const { key, width, height } = keyOf(spec, tier);
    const map = peek(spec, tier);
    if (map) return Promise.resolve(map);
    if (flying.has(key)) return flying.get(key);
    const job = Promise.resolve()
      .then(() => workers.request(ORBIT_WORKER, { key, spec, width, height }))
      .catch(() => null)
      .then((answer) => {
        flying.delete(key);
        if (!answer?.rgba) return null;
        const out = { width: answer.width, height: answer.height, rgba: answer.rgba, biome: answer.biome };
        cached.set(key, out);
        while (cached.size > cap) cached.delete(cached.keys().next().value);
        return out;
      });
    flying.set(key, job);
    return job;
  }

  return {
    get,
    peek,
    stats: () => ({ cached: cached.size, flying: flying.size }),
    dispose() {
      workers.close(ORBIT_WORKER);
      cached.clear();
      flying.clear();
    },
  };
}
