// Space outside the cockpit's glass: the twin (src/components/cockpit/
// spaceNodes.js) against space.js. The sky (the nebula along its band, the
// stars), a planet lit from one side with its atmosphere, and the jump at
// speed with the tunnel open, each at a fixed moment.
import * as THREE from 'three';
import * as SO from '../../../src/components/cockpit/space.js';
import * as SN from '../../../src/components/cockpit/spaceNodes.js';

const far = (camera) => {
  camera.near = 0.1;
  camera.far = 4000;
  camera.updateProjectionMatrix();
};

const sky = (S) => ({ scene, camera }) => {
  far(camera);
  camera.position.set(0, 0, 0);
  // (along the band, where the nebula gathers)
  camera.lookAt(1, 0.2, -0.3);
  const s = S.sky({ seed: 4, count: 5200 });
  s.set({ px: 1, fade: 1 });
  scene.add(s.group);
};

const planet = (S) => ({ scene, camera }) => {
  far(camera);
  scene.background = new THREE.Color(0x000000);
  camera.position.set(0, 0, 340);
  camera.lookAt(0, 0, 0);
  const p = S.planet({ radius: 100, sun: [1, 0.3, 0.4], tint: 0x6688aa });
  scene.add(p.group);
};

const jump = (S, { throttle, tunnel }) => ({ scene, camera }) => {
  far(camera);
  scene.background = new THREE.Color(0x000000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  const h = S.hyperspace({ count: 1800 });
  h.resize(256, 256, 1);
  h.update(0.35, 1.7, { throttle, tunnel });
  scene.add(h.group);
};

export default {
  'cockpit-space:sky': { node: sky(SN), classic: sky(SO) },
  'cockpit-space:planet': { node: planet(SN), classic: planet(SO) },
  'cockpit-space:streaks': { node: jump(SN, { throttle: 0.55, tunnel: 0 }), classic: jump(SO, { throttle: 0.55, tunnel: 0 }) },
  'cockpit-space:tunnel': { node: jump(SN, { throttle: 1, tunnel: 0.8 }), classic: jump(SO, { throttle: 1, tunnel: 0.8 }) },
};
