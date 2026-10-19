// The crebain, drawn: the flock (crebain.rules.js’s boids) as one instanced
// draw of black wing pairs, each turned along its flight and its wings
// beating on its own beat. Unlit: against a hard blue sky a crow is a black
// shape and nothing else.
//
//   createCrebain({ count, seed }) → {
//     mesh,
//     start(at)            the flock gathered there, still
//     update(dt, goal)     flown on toward the goal (stepped twenty times a second)
//     dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { newFlock, step } from './crebain.rules';

const STEP = 1 / 20; // s: the flock is stepped at this rate, drawn every frame between
const FLAP = 13; // rad/s

// a bird: two wings off a body, its beak along +z, its wingspan 0.9 m
function wingGeo() {
  const g = new THREE.BufferGeometry();
  const beak = [0, 0, 0.26];
  const tail = [0, 0.02, -0.22];
  const left = [0.46, 0.06, -0.06];
  const right = [-0.46, 0.06, -0.06];
  const elbowL = [0.2, 0.04, 0.06];
  const elbowR = [-0.2, 0.04, 0.06];
  g.setAttribute('position', new THREE.Float32BufferAttribute([...beak, ...elbowL, ...tail, ...elbowL, ...left, ...tail, ...beak, ...tail, ...elbowR, ...elbowR, ...tail, ...right], 3));
  g.computeVertexNormals();
  return g;
}

export function createCrebain({ count = 300, seed = 3 } = {}) {
  const material = new MeshBasicNodeMaterial({ color: 0x0b0b0d, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(wingGeo(), material, count);
  mesh.name = 'crebain';
  // (the flock flies far from where it was made: its bounds are never where it is)
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  let flock = newFlock(count, { seed });
  let acc = 0;
  let t = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const place = () => {
    const k = Math.min(1, acc / STEP);
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const vx = flock.v[ix];
      const vy = flock.v[ix + 1];
      const vz = flock.v[ix + 2];
      // (between steps, carried on along its heading)
      p.set(flock.p[ix] + vx * STEP * k, flock.p[ix + 1] + vy * STEP * k, flock.p[ix + 2] + vz * STEP * k);
      const speed = Math.hypot(vx, vy, vz) || 1;
      e.set(-Math.asin(vy / speed), Math.atan2(vx, vz), Math.sin(t * 0.7 + i) * 0.3);
      q.setFromEuler(e);
      s.set(1, Math.sin(t * FLAP + i * 2.399) * 1.4, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  return {
    mesh,
    start(at) {
      flock = newFlock(count, { seed, at });
      acc = 0;
      place();
    },
    update(dt, goal) {
      t += dt;
      acc += dt;
      // (a frame that fell behind steps at most four times: the flock slows rather than the frame)
      for (let n = 0; acc >= STEP && n < 4; n++) {
        flock = step(flock, STEP, goal);
        acc -= STEP;
      }
      acc = Math.min(acc, STEP);
      place();
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      mesh.removeFromParent();
    },
  };
}
