// Gollum on the Road: the Marshes chapter’s own figure (towns/marshes/
// gollum.js, the one Gollum the towns share), on the Road’s house look,
// standing in for the cast’s until a Meshy gollum.glb is made (the owner’s
// step: the hand-off). A stage hides the cast’s Gollum and puts this one
// where the file would have him, or where its beat wants him; he goes on
// all fours, his gait from the ground he covers.
//
//   createGollum(road, renderer) → { group, at(x, y, z, t, { pose, look, reach, yaw }), dispose() }
//     pose: the figure’s (crouch, crawl, climb, cower, fall); his heading,
//     unless `yaw` is given, from the way he last moved

import * as THREE from 'three';
import { canvasTexture } from '../../../../lib/three/canvasTexture';
import { eyeCanvas } from '../../towns/marshes/canvases';
import { gollum } from '../../towns/marshes/gollum';

const SCALE = 0.8; // the chapter’s Gollum at the Road’s scale (its man is 0.8 of the chapter’s)

export function createGollum(road, renderer) {
  const eye = canvasTexture(eyeCanvas(), renderer, { wrap: false });
  const made = [];
  const M = (o) => {
    const m = road.material(o);
    made.push(m);
    return m;
  };
  const mats = {
    gollumSkin: M({ vertexColors: true }),
    gollumEye: M({ map: eye, emissive: new THREE.Color(0xffffff), emissiveMap: eye, emissiveIntensity: 0.3 }),
    gollumHair: M({ color: 0x3a362e }),
    mouth: M({ color: 0x1a0d0c }),
    tooth: M({ color: 0xb4a472 }),
    loin: M({ vertexColors: true, side: THREE.DoubleSide }),
  };
  const fig = gollum({ mats, tex: { eye }, renderer });
  const group = new THREE.Group();
  group.name = 'road:gollum';
  // (the figure faces +x; the Road’s walkers face +z)
  fig.group.rotation.y = -Math.PI / 2;
  fig.group.scale.setScalar(SCALE);
  group.add(fig.group);
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false; // (skinned: its bounds don’t follow his pose)
    }
  });
  const last = new THREE.Vector3(NaN, 0, 0);
  let yaw = 0;
  return {
    group,
    at(x, y, z, t, { pose = 'crawl', look = 0, reach = 0, yaw: want } = {}) {
      const dx = x - last.x;
      const dz = z - last.z;
      if (want != null) yaw = want;
      else if (Number.isFinite(dx) && Math.hypot(dx, dz) > 1e-3) yaw = Math.atan2(dx, dz);
      last.set(x, y, z);
      group.position.set(x, y, z);
      group.rotation.y = yaw;
      // (his gait reads where he is put: the figure in the world)
      group.updateMatrixWorld(true);
      fig.animate(t, { pose, look, reach });
    },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      for (const m of made) m.dispose();
      eye.dispose();
    },
  };
}
