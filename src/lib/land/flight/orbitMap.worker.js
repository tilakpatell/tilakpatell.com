// The orbit-map worker: a planet's map (lib/land/flight/orbitMap.js) baked off
// the main thread, both buffers handed back without a copy. One job at a time
// (runtime/workers.js gives a worker one), so a cancel for a queued bake never
// reaches here, and one for the bake running comes after its answer, which the
// pool then ignores: a cancel is not answered.

import { bakeOrbitMap } from './orbitMap.js';

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg || msg.type === 'cancel') return;
  const { key, spec, width, height } = msg;
  const { rgba, biome } = bakeOrbitMap(spec, { width, height });
  self.postMessage({ key, width, height, rgba, biome }, [rgba.buffer, biome.buffer]);
};
