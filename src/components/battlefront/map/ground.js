// Hoth's ground from the pack's heightmaps (the `image` layer, in the pack's
// frame): a fine grid over the near map and a coarse one round it over the
// rest of the world map, a little lower so the two never fight where they
// meet. The coarse one is cut away under the near map (`cutUnder`): a vertex
// every 32 m spans a hollow or a trench line, and its sheet stood over the
// near ground there, up to 20 m on Hoth and over a fifth of the base: snow a
// soldier walked through.
// Snow is the game's terrain colour (the lighting record's Enlighten
// `TerrainColor`, 0.55 / 0.59 / 0.64 on Hoth's day) brightened toward
// white by the albedo of packed snow.

import * as THREE from 'three';
import { LAYERS } from '../../../lib/land/layers.js';

export const NEAR_STEP = 4; // m between the near grid's vertices (the map is 1 m a pixel)
export const FAR_STEP = 32; // m: the world map's grid (4 m a pixel)
export const FAR_DROP = 1.5; // m the far grid sits under the near one
const SNOW = new THREE.Color(0.546830952, 0.594003737, 0.644479752);

function grid(layer, min, size, step, drop) {
  const n = Math.max(2, Math.round(size / step) + 1);
  const g = new THREE.PlaneGeometry(size, size, n - 1, n - 1);
  g.rotateX(-Math.PI / 2);
  g.translate(min[0] + size / 2, 0, min[1] + size / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, LAYERS.image(p.getX(i), p.getZ(i), layer) - drop);
  g.computeVertexNormals();
  return g;
}

// A grid's quads that lie wholly inside [min, max] on XZ, left out of its
// index (a quad the rectangle's edge crosses stays, so the two grids still
// overlap by a quad at the seam). → how many quads went
export function cutUnder(g, min, max) {
  const p = g.attributes.position;
  const inside = (i) => p.getX(i) >= min[0] && p.getX(i) <= max[0] && p.getZ(i) >= min[1] && p.getZ(i) <= max[1];
  const index = g.index.array;
  const kept = [];
  let cut = 0;
  // (PlaneGeometry: six indices a quad, a b d then b c d)
  for (let q = 0; q < index.length; q += 6) {
    if (inside(index[q]) && inside(index[q + 1]) && inside(index[q + 2]) && inside(index[q + 4])) {
      cut++;
      continue;
    }
    for (let k = 0; k < 6; k++) kept.push(index[q + k]);
  }
  g.setIndex(kept);
  return cut;
}

export function buildGround(layer, terrain = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: SNOW, roughness: 0.82, metalness: 0 });
  const out = new THREE.Group();
  out.name = 'ground';
  const near = terrain.near;
  if (near?.min && near?.size) {
    const size = (near.size[0] - 1) * near.metresPerPixel;
    const m = new THREE.Mesh(grid(layer, near.min, size, NEAR_STEP, 0), mat);
    m.receiveShadow = true;
    out.add(m);
  }
  const far = terrain.far;
  if (far?.min && far?.size) {
    const size = (far.size[0] - 1) * far.metresPerPixel;
    const g = grid(layer, far.min, size, FAR_STEP, FAR_DROP);
    if (near?.min && near?.size) {
      const side = (near.size[0] - 1) * near.metresPerPixel;
      cutUnder(g, near.min, [near.min[0] + side, near.min[1] + side]);
    }
    const m = new THREE.Mesh(g, mat.clone());
    m.receiveShadow = true;
    out.add(m);
  }
  return out;
}
