// The Citadel of Ricks as modelled for the site (Meshy, Phase 3 of the Rick
// and Morty multiverse: the show's brass disc and teal dome, four arms out to
// glass saucers, the crystal hanging under it), which takes over from the one
// deepspace.js builds once it's loaded. It's fitted to that one's frame: as
// wide as the built dome across its middle, turned so its arms lie along
// deep.js's CITADEL_PARTS (which the siege and the ship's collisions use),
// its disc where the dome's is. Lit as deepspace's own models are: Lambert,
// its colour glowing a little so its far side isn't black.
//
//   citadelModel(group, k, owned) → Promise<boolean> (true once it's in `group`)

import * as THREE from 'three';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';

const CITADEL_MODEL = '/models/c137/rm/citadel-exterior.glb';

export function citadelModel(group, k, owned = []) {
  return loadGLTF(CITADEL_MODEL)
    .then((gltf) => {
      if (!gltf?.scene || !group.parent) return false;
      const model = cloneScene(gltf);
      model.traverse((o) => {
        if (!o.isMesh) return;
        const map = o.material.map ?? null;
        o.material = new THREE.MeshLambertMaterial({ map, emissive: map ? 0xffffff : 0x000000, emissiveMap: map, emissiveIntensity: 0.32 });
        owned.push(o.material);
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      // (its saucers' rims are its widest; its disc is 0.55 of that, the
      // dome's 12.5 across its middle; the disc is 0.6 of the way up it)
      const kk = (2 * 22.7 * k) / Math.max(size.x, size.z);
      model.scale.setScalar(kk);
      model.position.set(0, -(box.min.y + size.y * 0.6) * kk, 0);
      model.rotation.y = -0.25;
      group.add(model);
      return true;
    })
    .catch((e) => {
      if (import.meta.env?.DEV) console.error('citadel model', e);
      return false;
    });
}
