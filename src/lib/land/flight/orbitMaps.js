// Orbit maps as the page asks for them: each baked once in a worker
// (orbitMap.worker.js, through the page's pool, runtime/workers.js) and kept
// in memory, never written anywhere (the endless universe's spec, “Orbit
// matches ground”). A planet's map is keyed by its id and size, so `low` and
// `mid` share one, and the chart a flight lands on doesn't matter: the map is
// the whole sphere's. Two asks at once share one bake. A bake that comes back
// empty (cancelled, failed, or the pool closed) answers null and is kept
// nowhere, so the next ask bakes again. At most `cap` maps are held, the
// least recently used going first; a peek counts as a use.
//
// Never throws: a missing spec, a pool that throws or rejects, or an ask
// after dispose each answer null.
//
//   ORBIT_WORKER → the pool's name for the bake
//   makeOrbitWorker() → the module worker
//   createOrbitMaps({ workers, make = makeOrbitWorker, cap = 16 }) → {
//     get(spec, tier) → Promise<{ width, height, rgba, biome } | null>,
//     peek(spec, tier) → the map if it's held, else null,
//     stats() → { cached, flying },
//     dispose(): the pool's group closed and every map let go }

import { orbitMapSize } from './orbitMap.js';

export const ORBIT_WORKER = 'flight-orbit-map';

export const makeOrbitWorker = () => new Worker(new URL('./orbitMap.worker.js', import.meta.url), { type: 'module' });

const keyOf = (spec, tier) => {
  if (!spec || typeof spec !== 'object' || typeof spec.id !== 'string') return null;
  const { width, height } = orbitMapSize(tier);
  return { key: `${spec.id}:${width}x${height}`, width, height };
};

// the worker's answer as a map, or null when it brought none
const mapOf = (a) => (a && a.rgba && a.biome ? { width: a.width, height: a.height, rgba: a.rgba, biome: a.biome } : null);

export function createOrbitMaps({ workers, make = makeOrbitWorker, cap = 16 }) {
  workers.define(ORBIT_WORKER, make, { size: 1 });
  const cache = new Map(); // key → map, least recently used first
  const flying = new Map(); // key → Promise<map | null>
  let disposed = false;

  const touch = (key) => {
    const map = cache.get(key);
    if (map === undefined) return null;
    cache.delete(key);
    cache.set(key, map);
    return map;
  };
  const keep = (key, map) => {
    cache.set(key, map);
    while (cache.size > cap) cache.delete(cache.keys().next().value);
  };
  const ask = (msg) => {
    try {
      return Promise.resolve(workers.request(ORBIT_WORKER, msg)).catch(() => null);
    } catch {
      return Promise.resolve(null);
    }
  };

  return {
    get(spec, tier) {
      const k = disposed ? null : keyOf(spec, tier);
      if (!k) return Promise.resolve(null);
      const held = touch(k.key);
      if (held) return Promise.resolve(held);
      if (flying.has(k.key)) return flying.get(k.key);
      const p = ask({ key: k.key, spec, width: k.width, height: k.height }).then((answer) => {
        if (flying.get(k.key) === p) flying.delete(k.key);
        const map = disposed ? null : mapOf(answer);
        if (map) keep(k.key, map);
        return map;
      });
      flying.set(k.key, p);
      return p;
    },
    peek(spec, tier) {
      const k = keyOf(spec, tier);
      return k ? touch(k.key) : null;
    },
    stats: () => ({ cached: cache.size, flying: flying.size }),
    dispose() {
      disposed = true;
      flying.clear();
      cache.clear();
      workers.close(ORBIT_WORKER);
    },
  };
}
