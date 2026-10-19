// The others online, as Marios (scene.js's ghosts): the code-made Mario
// (./mario.js) baked into one geometry, as he stands. A ghost is drawn in
// one pale material (middleearth/towns/ghosts.js), so his 39 parts in their
// paints would be 39 draws for nothing; in one piece he's one. The scene
// makes it once and every ghost shares it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeMario } from './index';

export function ghostGeometry() {
  const m = makeMario();
  m.root.updateMatrixWorld(true);
  const parts = [];
  m.root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    // (his parts' shapes are the models' shared ones: copied, placed, and only what a pale figure needs)
    const g = new THREE.BufferGeometry();
    g.setIndex(o.geometry.index.clone());
    g.setAttribute('position', o.geometry.attributes.position.clone());
    g.setAttribute('normal', o.geometry.attributes.normal.clone());
    parts.push(g.applyMatrix4(o.matrixWorld));
  });
  const one = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  return one;
}
