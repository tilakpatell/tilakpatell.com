// The Falcon's cockpit, finer (./falcon.js builds the rest): what a real one
// is crowded with past its consoles and its web of frame. Rivets round the
// canopy's rings, facing you; conduit in bundles along the hull under the
// glass and round the tube behind it, clamped every so often; rows of
// rotary knobs on the consoles; switches on the overhead banks. Each kind
// one draw (../greebles.js).
//
// falconDetail({ cone, onFace, faceQuat, overhead, mats }) → { group, toggles }
//   cone: { point(u, a, inset), z(u), r(u), glass, r0, z0 } (falcon.js's cone)
//   onFace(k, u, v, lift) / faceQuat(k): a place on console k's face, and its turn
//   overhead: the overhead banks' meshes (planes facing the seat)
//   toggles: Matrix4s for the Falcon's own switch draw, the overhead's rows

import * as THREE from 'three';
import { conduit, knobs, rivets } from '../greebles';

// the canopy's rings ([u, depth]: where each is along the cone, its depth)
const RINGS = [
  [0, 0.1],
  [0.4, 0.06],
  [0.74, 0.06],
  [1, 0.07],
];
// knob rows on the console faces: [face, from u, to u, v, how many]
const KNOBS = [
  [0, -0.17, -0.02, 0.13, 4],
  [1, -0.24, 0.0, 0.14, 5],
  [2, -0.16, -0.09, 0.12, 2],
  [2, 0.09, 0.16, 0.12, 2],
  [3, 0.0, 0.24, 0.14, 5],
  [4, -0.02, 0.17, 0.13, 4],
];

export function falconDetail({ cone, onFace, faceQuat, overhead, mats }) {
  const group = new THREE.Group();
  const toward = new THREE.Vector3(0, 0, 1);

  // rivets on each ring's face towards you, round the glass's reach
  const spots = [];
  for (const [u, depth] of RINGS) {
    const reachA = cone.glass + 0.15;
    const arc = 2 * reachA * cone.r(u);
    const n = Math.round(arc / 0.085);
    for (let i = 0; i <= n; i++) {
      const a = -reachA + (i / n) * 2 * reachA;
      const p = cone.point(u, a);
      p.z = cone.z(u) + depth / 2 + 0.0035;
      spots.push({ at: p, n: toward });
    }
  }
  group.add(rivets(spots, mats.trim));

  // conduit: along the hull under the glass's edge each side, from the back
  // ring down towards the console, and round the tube behind, beside the seats
  for (const side of [-1, 1]) {
    const a = side * (cone.glass + 0.34);
    const under = [0, 0.18, 0.36, 0.52].map((u) => cone.point(u, a, 0.035).toArray());
    group.add(conduit(under, mats.trim, { count: 3, radius: 0.0075, clampMat: mats.black, seed: side > 0 ? 4 : 9 }));
    const b = side * (Math.PI / 2 + 0.42);
    const behind = [cone.z0 - 0.02, cone.z0 + 0.35, cone.z0 + 0.75, cone.z0 + 1.15].map((z) => [Math.sin(b) * (cone.r0 - 0.04), 1.24 + Math.cos(b) * (cone.r0 - 0.04), z]);
    group.add(conduit(behind, mats.black, { count: 4, radius: 0.009, gap: 0.024, clampMat: mats.trim, every: 0.34, seed: side > 0 ? 6 : 2 }));
  }

  // rotary knobs along the tops of the console faces, each at its own setting
  const knobSpots = [];
  let s = 0;
  for (const [k, u0, u1, v, n] of KNOBS) {
    const q = faceQuat(k);
    const out = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? u0 : u0 + ((u1 - u0) * i) / (n - 1);
      knobSpots.push({ at: onFace(k, u, v, 0.001), n: out, spin: ((s++ * 2.399) % (Math.PI * 2)) - Math.PI });
    }
  }
  group.add(knobs(knobSpots, mats.black, { radius: 0.0085, height: 0.011 }));

  // two rows of switches on each overhead bank (drawn with the Falcon's own)
  const toggles = [];
  const flip = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const [b, panel] of overhead.entries()) {
    panel.updateWorldMatrix(true, false);
    const q = panel.getWorldQuaternion(new THREE.Quaternion());
    for (const [v, n] of [
      [0.18, 8],
      [0.12, 8],
      [-0.14, 6],
    ]) {
      for (let i = 0; i < n; i++) {
        const at = new THREE.Vector3((i - (n - 1) / 2) * 0.034, v, 0.004).applyMatrix4(panel.matrixWorld);
        flip.setFromEuler(e.set((i + b) % 3 === 0 ? -0.35 : 0.35, 0, 0));
        toggles.push(new THREE.Matrix4().compose(at, q.clone().multiply(flip), new THREE.Vector3(1.2, 1.2, 1.2)));
      }
    }
  }
  return { group, toggles };
}
