// The stages' lamps (Gandalf's staff, the Phial, a camp's fire) drawn
// through a few lights the scene always has. three keys every lit
// material's shader by the lights it is drawn under (each light's id, in
// LightsNode's cache key), so a stage's own lights coming into the scene
// and going, a neighbour shown and then not, built every material on the
// Road again at each seam, and on a laptop's built-in chip the world stood
// half drawn while their pipelines came. A stage's lights are put on a
// layer no camera sees (they still say where and how bright), and each
// frame the brightest of them near the camera are copied onto the pool's,
// the rest of the pool left dark.
//
//   createLamps(scene, { count }) → { take(root) → how many, give(root), update(camera), lights, dispose() }
//     take(root): a build's point lights into the pool's care; give(root): let go of them

import * as THREE from 'three';

export const LAMPS = 4; // the pool: Moria's staff, its fill, the shaft on the tomb and the fire in the deep at once
export const UNSEEN = 31; // the layer a stage's own lights are put on

// (a light and every group over it shown)
const shown = (o) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

export function createLamps(scene, { count = LAMPS } = {}) {
  const lights = Array.from({ length: count }, (_, i) => {
    const l = new THREE.PointLight(0xffffff, 0, 1, 2);
    l.name = `road:lamp${i}`;
    scene.add(l);
    return l;
  });
  const own = new Map(); // root → its lights
  const at = new THREE.Vector3();
  const lit = [];
  return {
    lights,
    take(root) {
      const found = [];
      root?.traverse((o) => {
        if (!o.isPointLight || lights.includes(o)) return;
        o.layers.set(UNSEEN);
        found.push(o);
      });
      if (found.length) own.set(root, found);
      return found.length;
    },
    give(root) {
      own.delete(root);
    },
    // (the lamps lit and shown, by how much of them reaches the camera's
    // neighbourhood: their strength over the square of how far off they are)
    update(camera) {
      lit.length = 0;
      for (const list of own.values())
        for (const l of list) {
          if (!(l.intensity > 0) || !shown(l)) continue;
          l.getWorldPosition(at);
          const d = at.distanceTo(camera.position);
          lit.push({ l, x: at.x, y: at.y, z: at.z, w: l.intensity / (1 + d * d) });
        }
      lit.sort((a, b) => b.w - a.w);
      lights.forEach((p, i) => {
        const s = lit[i];
        if (!s) {
          p.intensity = 0;
          return;
        }
        p.position.set(s.x, s.y, s.z);
        p.color.copy(s.l.color);
        p.intensity = s.l.intensity;
        p.distance = s.l.distance;
        p.decay = s.l.decay;
      });
    },
    dispose() {
      for (const l of lights) {
        l.removeFromParent();
        l.dispose();
      }
      own.clear();
    },
  };
}
