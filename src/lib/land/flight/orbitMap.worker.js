// A planet's orbit map (./orbitMap.js) made off the main thread: a 512 × 256
// bake is a second and more of noise. One job at a time (runtime/workers.js
// gives a worker one), so a cancel never reaches a job here but the one being
// made, whose answer the pool then ignores; the cancel itself is ignored.
// Both buffers go back transferred, without a copy.
//
// Message in: { key, spec, width, height }; out: { key, width, height, rgba, biome }

import { bakeOrbitMap } from './orbitMap.js';

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg || msg.type === 'cancel') return;
  const { key, spec, width, height } = msg;
  const { rgba, biome } = bakeOrbitMap(spec, { width, height });
  self.postMessage({ key, width, height, rgba, biome }, [rgba.buffer, biome.buffer]);
};
