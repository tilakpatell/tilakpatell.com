// The orbit map's worker: a planet's equirectangular map (orbitMap.js) baked
// off the main thread, its two buffers handed back without a copy. One job at
// a time (runtime/workers.js gives a worker one), so a cancel for a queued
// bake never reaches here; one for the bake being made comes after its
// answer, which the pool then ignores. A bake it can't make (no spec, or one
// whose ground throws) is answered with its key alone, which orbitMaps.js
// reads as none, and the worker lives on for the next.
//
// Messages: { key, spec, width, height } in, and back
// { key, width, height, rgba, biome } (rgba and biome transferred) or { key }.

import { bakeOrbitMap } from './orbitMap.js';

const bake = (spec, width, height) => {
  try {
    return bakeOrbitMap(spec, { width, height });
  } catch {
    return null;
  }
};

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg || msg.type === 'cancel') return;
  const { key, spec, width, height } = msg;
  const map = bake(spec, width, height);
  if (!map) {
    self.postMessage({ key });
    return;
  }
  self.postMessage({ key, ...map }, [map.rgba.buffer, map.biome.buffer]);
};
