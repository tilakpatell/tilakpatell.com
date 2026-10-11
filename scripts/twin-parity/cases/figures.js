// The crews' figures and the portal a kill opens: portalFx.js's disc (the
// show's swirl, open and then flashing shut, with its motes and the figure
// clipped at its plane) against portalFxNodes.js's, and footFigures.js's
// figures built from shapes (no GLSL of their own) on either renderer.
import * as THREE from 'three';
import * as PO from '../../../src/lib/three/portalFx.js';
import * as PN from '../../../src/lib/three/portalFxNodes.js';
import { built } from '../../../src/components/universe/footFigures.js';
import { METRE } from '../../../src/components/universe/foot.js';

// (the swallow draws where the cut lands, the motes and their sizes at
// random: the same draws on both sides. A node material makes more objects
// than a ShaderMaterial, each drawing a uuid at random too, so those draws
// are left to the real Math.random and out of the swallow's sequence)
const seededRandom = (run) => {
  const had = Math.random;
  let s = 7;
  Math.random = () => (/generateUUID/.test(new Error().stack) ? had() : ((s = (s * 16807) % 2147483647) - 1) / 2147483646);
  try {
    return run();
  } finally {
    Math.random = had;
  }
};

const person = () => {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.2, 4, 12).translate(0, 0.82, 0), new THREE.MeshStandardMaterial({ color: 0xd8c0a0, roughness: 0.8 }));
  root.add(body);
  return root;
};

// a figure swallowed, stepped to `when` ('open': a third of a second in;
// 'shut': just after the cut, mid-flash)
const portal = (P, when) => ({ scene, camera }) =>
  seededRandom(() => {
    camera.position.set(0.5, 1.3, 2.2);
    camera.lookAt(0, 0.9, -0.6);
    const parent = new THREE.Group();
    scene.add(parent);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x556644 }));
    parent.add(ground);
    const root = person();
    parent.add(root);
    const fx = P.createPortalFx({ parent });
    const h = fx.swallow({ root, tall: 1.8, up: new THREE.Vector3(0, 1, 0), push: new THREE.Vector3(0, 0, -1), seed: 2.5 });
    if (when === 'open') for (let i = 0; i < 15; i++) fx.update(0.02);
    else {
      while (!h.cut) fx.update(0.02);
      for (let i = 0; i < 3; i++) fx.update(0.02);
    }
  });

const artoo = () => ({ scene, camera }) => {
  camera.position.set(1.6, 1.2, 2.6);
  camera.lookAt(0, 0.5, 0);
  const fig = built({ id: 'artoo', tall: 1.09, src: { built: 'artoo' } });
  fig.update(0.5, 0);
  // (built in map units: back to metres to be seen)
  const stand = new THREE.Group();
  stand.scale.setScalar(1 / METRE);
  stand.add(fig.model);
  scene.add(stand);
};

export default {
  'figures:portal:open': { node: portal(PN, 'open'), classic: portal(PO, 'open') },
  'figures:portal:shut': { node: portal(PN, 'shut'), classic: portal(PO, 'shut') },
  'figures:built': { node: artoo(), classic: artoo() },
};
