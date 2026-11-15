// Generated stations drawn: one procedural station, original to the site (a
// hub, a ring on four spokes, a docking arm), as two instanced meshes, its
// hull and its lights, so every station in view is two draw calls at most and
// none at all when there's none. A station is drawn only while the camera is
// inside its system's reach (scenePlaces.js says which, and how grown in).
//
// createStationLook(group, { prepare }) → { update(rows), dispose() }
//   rows: [{ at: [x, y, z] (the map's frame), size, grow (0…1) }], the
//   first MAX drawn, each at its at, scaled by size × grow; prepare(mesh) is
//   called once a mesh, on the first update (the scene's shader warm-up,
//   which scene.js declares after it makes the places)

import * as THREE from 'three';
import { glowMat, parts } from '../kit';
import { PALETTE } from '../palette';
import { hot } from '../../../lib/three/canvasTexture';

export const MAX = 8;

// (a station of size 1: its ring's outer edge at about 1, the scale its row's size gives it)
function hullGeometry() {
  const spoke = (a) => [new THREE.BoxGeometry(0.06, 0.06, 0.62), [Math.sin(a) * 0.38, 0, Math.cos(a) * 0.38], [0, a, 0]];
  return parts([
    [new THREE.CylinderGeometry(0.16, 0.16, 0.5, 16), [0, 0, 0]],
    [new THREE.SphereGeometry(0.2, 16, 8), [0, 0.28, 0]],
    [new THREE.TorusGeometry(0.78, 0.07, 8, 48), [0, 0, 0], [Math.PI / 2, 0, 0]],
    spoke(0),
    spoke(Math.PI / 2),
    spoke(Math.PI),
    spoke((3 * Math.PI) / 2),
    // (the docking arm, out along the pole, and its cradle)
    [new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), [0, -0.5, 0]],
    [new THREE.BoxGeometry(0.3, 0.05, 0.3), [0, -0.76, 0]],
  ]);
}
function lightGeometry() {
  const lamp = (a) => [new THREE.BoxGeometry(0.05, 0.05, 0.05), [Math.sin(a) * 0.86, 0, Math.cos(a) * 0.86]];
  return parts([...Array.from({ length: 12 }, (_, i) => lamp((i / 12) * Math.PI * 2)), [new THREE.BoxGeometry(0.34, 0.02, 0.02), [0, -0.79, 0]]]);
}

export function createStationLook(group, { prepare = () => {} } = {}) {
  const hullMat = new THREE.MeshStandardMaterial({ color: PALETTE.bone.hex, roughness: 0.6, metalness: 0.4, emissive: new THREE.Color(PALETTE.grey.hex).multiplyScalar(0.08) });
  const lightMat = glowMat(hot(PALETTE.sun.hex, 2.2));
  const meshes = [new THREE.InstancedMesh(hullGeometry(), hullMat, MAX), new THREE.InstancedMesh(lightGeometry(), lightMat, MAX)];
  for (const m of meshes) {
    m.count = 0;
    m.visible = false;
    m.frustumCulled = false; // (the instances are spread over a system: the mesh's own bounds say nothing)
    group.add(m);
  }
  let warmed = false;
  const mat = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  return {
    update(rows) {
      if (!warmed) {
        warmed = true;
        for (const m of meshes) prepare(m);
      }
      const n = Math.min(MAX, rows.length);
      for (let i = 0; i < n; i++) {
        const r = rows[i];
        const k = Math.max(1e-6, r.size * r.grow);
        mat.compose(pos.set(r.at[0], r.at[1], r.at[2]), q, scale.set(k, k, k));
        for (const m of meshes) m.setMatrixAt(i, mat);
      }
      for (const m of meshes) {
        m.count = n;
        m.visible = n > 0;
        if (n) m.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      for (const m of meshes) {
        group.remove(m);
        m.geometry.dispose();
        m.material.dispose();
        m.dispose();
      }
    },
  };
}
