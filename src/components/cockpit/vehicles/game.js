// The game's own cockpit, from the pilot's seat: Star Wars Battlefront II
// (2017)'s cockpit mesh as lane V imported it (surface/<kind>cockpit.glb,
// stood in its hull's frame: facing +z, standing on the hull's ground, in
// metres), for the galaxy's cockpit view (galaxy/scene.js's buildCab) in
// place of the built cab where the game has one (lane S1 of the
// galaxy-in-space design, decision 2). Turned to face −z, as the intro's
// built cabs are, and moved so the pilot's eye is at EYE. The game's cockpit
// GLBs carry no camera node, so the eye is a share of the cockpit's box
// (EYE_AT, each checked by a shot: docs/superpowers/evidence/bf2017-space/s1/).
// The game's fake ambient-occlusion plane (a bare quad the game's shader
// fades, `FakeAO`) is left out; its window glass stays as the import made it.
//
//   COCKPITS: kind → the game's cockpit file
//   placeCab(root, kind, box?) → the eye, root turned and moved (pure of the renderer)
//   build({ renderer, load }) → the cab, in the built cabs' shape (vehicles/xwing.js)
//   cab(kind) → { build }, what galaxy/cabs.js imports for a kind

import * as THREE from 'three';
import { cloneScene, loadGLTF } from '../../../lib/three/gltfCache';
import { disposeTree } from '../../../lib/three/renderer';

export const COCKPITS = {
  xwing: '/models/galaxy/surface/xwingcockpit.glb',
  falcon: '/models/galaxy/surface/falconcockpit.glb',
};

// where the pilot's eye is in the cockpit's box, as shares of its width (the
// pilot's side: the Falcon's is the left seat), height and depth (0 the
// back, 1 the nose): read off the cockpit shots, 2026-10-11 (`_source`:
// docs/superpowers/evidence/bf2017-space/s1/cockpit-xwing.webp, -falcon.webp)
export const EYE_AT = {
  xwing: [0.5, 0.74, 0.34],
  falcon: [0.66, 0.64, 0.3],
};
// the cab scene's eye, as the built cabs have it (xwing.js's is 1.02 up)
export const EYE = [0, 1.02, 0];
const NOSE = Math.PI; // (the hull's frame faces +z; a cab faces −z)

// the cockpit turned nose to −z and moved so the pilot's eye is at EYE
export function placeCab(root, kind, box = new THREE.Box3().setFromObject(root)) {
  const at = EYE_AT[kind] ?? [0.5, 0.7, 0.3];
  const size = box.getSize(new THREE.Vector3());
  // (the eye in the hull's frame, then through the same turn the cockpit takes)
  const eye = new THREE.Vector3(box.min.x + size.x * at[0], box.min.y + size.y * at[1], box.min.z + size.z * at[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), NOSE);
  root.rotation.y = NOSE;
  root.position.set(EYE[0] - eye.x, EYE[1] - eye.y, EYE[2] - eye.z);
  root.updateMatrixWorld(true);
  return [...EYE];
}

// the game's materials as the cab wants them: the fake-AO quad gone, the
// glass drawn last, the rest as the import made them
export function dressCab(root) {
  const gone = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (/fakeao/i.test(m.name)) gone.push(o);
      else if (m.transparent) o.renderOrder = 10;
    }
  });
  for (const o of gone) o.removeFromParent();
  return gone.length;
}

export async function build({ kind, load = loadGLTF } = {}) {
  const url = COCKPITS[kind];
  if (!url) throw new Error(`${kind}: the game has no cockpit for it (vehicles/game.js)`);
  const gltf = await load(url);
  if (!gltf) throw new Error(`${url}: the cockpit did not load`);
  const root = cloneScene(gltf);
  dressCab(root);
  const inside = new THREE.Group();
  inside.add(root);
  const eye = placeCab(root, kind);
  const outside = new THREE.Group();
  // (a soft fill from the pilot's side, over the room environment the scene
  // gives the cab: the game lights its cockpits from the sky outside)
  const fill = new THREE.HemisphereLight(0xcfd8e6, 0x2a2622, 0.9);
  inside.add(fill);
  return {
    inside,
    outside,
    eye,
    rest: [0, -0.1],
    range: [1.4, 0.45],
    hfov: 88,
    vmin: 56,
    vmax: 96,
    exposure: 1.0,
    envIntensity: 0.7,
    bloom: [0.6, 0.45, 0.8],
    flash: '#eef5ff',
    rumble: 0.9,
    triggers: [],
    game: true,
    resize() {},
    launch() {},
    update() {},
    dispose() {
      disposeTree(root);
    },
  };
}

export const cab = (kind) => ({ build: (opts) => build({ ...opts, kind }) });
