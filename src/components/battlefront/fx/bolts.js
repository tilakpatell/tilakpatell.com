// The sim's bolts drawn: a bright streak each, as long as the bolt goes in
// a fortieth of a second, in the weapon row's colour (`red`, `blue`, …),
// glowing past the bloom's threshold. One InstancedMesh, filled each frame.
//
//   createBolts(scene, { max }) → { update(bolts), dispose() }

import * as THREE from 'three';

export const MAX_BOLTS = 256;
export const STREAK = 1 / 40; // s of travel one streak shows
export const BOLT_SPEED = 700; // m/s where a bolt carries none (lane 1's view: the rifles' InitialSpeed)
const COLOURS = { red: [6, 0.35, 0.25], blue: [0.35, 0.8, 6], green: [0.4, 6, 0.5], yellow: [5, 4, 0.5] };

export function createBolts(scene, { max = MAX_BOLTS } = {}) {
  const geo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6, 1, true);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.name = 'bolts';
  scene.add(mesh);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const z = new THREE.Vector3(0, 0, 1);
  const d = new THREE.Vector3();
  const c = new THREE.Color();
  return {
    mesh,
    update(bolts) {
      let n = 0;
      for (const b of bolts) {
        if (n >= max) break;
        const len = (b.speed ?? BOLT_SPEED) * STREAK;
        d.fromArray(b.dir).normalize();
        q.setFromUnitVectors(z, d);
        p.fromArray(b.at).addScaledVector(d, -len / 2);
        s.set(1, 1, len);
        m.compose(p, q, s);
        mesh.setMatrixAt(n, m);
        mesh.setColorAt(n, c.setRGB(...(COLOURS[b.colour] ?? COLOURS.red)));
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
