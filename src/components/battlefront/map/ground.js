// Hoth's ground from the pack's heightmaps (the `image` layer, in the pack's
// frame): a fine grid over the near map and a coarse one under the whole
// world map, a little lower so the two never fight where they overlap.
// Snow is the game's terrain colour (the lighting record's Enlighten
// `TerrainColor`, 0.55 / 0.59 / 0.64 on Hoth's day) brightened toward
// white by the albedo of packed snow.

import * as THREE from 'three';
import { LAYERS } from '../../../lib/land/layers.js';

export const NEAR_STEP = 4; // m between the near grid's vertices (the map is 1 m a pixel)
export const FAR_STEP = 32; // m: the world map's grid (4 m a pixel)
export const FAR_DROP = 1.5; // m the far grid sits under the near one
const SNOW = new THREE.Color(0.86, 0.9, 0.95);

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
    const m = new THREE.Mesh(grid(layer, far.min, size, FAR_STEP, FAR_DROP), mat.clone());
    m.receiveShadow = true;
    out.add(m);
  }
  return out;
}
