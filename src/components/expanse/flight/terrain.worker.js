// The flight's terrain worker: a leaf's mesh, normals, heights and clutter
// (lib/land/flight/leafMesh.js) made off the main thread, every buffer handed
// back without a copy. One job at a time (runtime/workers.js gives a worker
// one), so a cancel for a queued leaf never reaches here; one for the leaf
// being made comes after its answer, which the pool then ignores. A job of
// `type: 'raster'` is the planet map's (lib/land/flight/mapRaster.js): a 2 km
// square's biomes and heights, asked behind the ground.

import { makeLeaf } from '../../../lib/land/flight/leafMesh.js';
import { fieldKey, planetField } from '../../../lib/land/flight/field.js';
import { rasterFor } from '../../../lib/land/flight/mapRaster.js';

// one field a planet (a round one a landing spot): its noises are built once, not once a leaf
const fields = new Map();

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg || msg.type === 'cancel') return;
  const { key, spec, leaf, n, tier } = msg;
  const fk = fieldKey(spec);
  let field = fields.get(fk);
  if (!field) fields.set(fk, (field = planetField(spec)));
  if (msg.type === 'raster') {
    const { biome, height } = rasterFor(field, leaf);
    self.postMessage({ key, biome, height }, [biome.buffer, height.buffer]);
    return;
  }
  const out = makeLeaf(spec, leaf, { n, field, tier });
  self.postMessage({ ...out, key }, [out.positions.buffer, out.normals.buffer, out.indices.buffer, out.heights.buffer, out.clutter.buffer]);
};
