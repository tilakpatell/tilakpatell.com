// Birds: a flock, each bird a pair of wings (two instanced triangles, one
// draw a side) flapping and gliding on its own slow loop round the flock's
// middle, rising and falling a little, banking into its turn; small and
// dark against the sky, as birds are. The Road's flocks (the crebain over
// Hollin black and many) and a galaxy world's (surface/flocks.js).
//
//   createBirds({ at: [x, y, z], count, radius, height, size, colour, speed, seed, name }) → { mesh, update(dt), dispose }
//     at: the flock's middle, y over the ground there
//   flight(bird, t) → { x, y, z, yaw, bank, flap } (pure: where a bird is at t)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { seeded } from '../seeded.js';

export function flight(b, t) {
  const a = b.phase + (t * b.speed) / b.radius;
  const r = b.radius * (1 + 0.18 * Math.sin(t * 0.21 + b.phase * 3));
  // (each loop a little off round, and up and down, so the flock never moves as one)
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r * b.squash;
  const y = b.height + Math.sin(t * 0.37 + b.phase * 5) * b.height * 0.12;
  const yaw = Math.atan2(-Math.sin(a), Math.cos(a) * b.squash);
  // flapping in bursts, then gliding with the wings held a little up
  const burst = Math.sin(t * 0.6 + b.phase * 7) > -0.2;
  const flap = burst ? Math.sin(t * b.rate) * 0.75 : 0.18;
  return { x, y, z, yaw, bank: 0.35, flap };
}

export function createBirds({ at = [0, 30, 0], count = 18, radius = 40, height = 0, size = 0.5, colour = 0x2a2622, speed = 9, seed = 1, name = 'birds' } = {}) {
  const rng = seeded(seed);
  const birds = Array.from({ length: count }, () => ({
    phase: rng() * Math.PI * 2,
    radius: radius * (0.5 + rng() * 0.8),
    squash: 0.6 + rng() * 0.4,
    height: height + (rng() - 0.5) * radius * 0.25,
    speed: speed * (0.8 + rng() * 0.4),
    rate: 9 + rng() * 5,
    size: size * (0.8 + rng() * 0.4),
  }));
  // a wing: from the body's line out to its tip, swept back
  const wing = (side) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.22, 0, 0, -0.18, side * 1, 0, -0.12], 3));
    g.computeVertexNormals();
    return g;
  };
  const material = new MeshBasicNodeMaterial({ color: colour, side: THREE.DoubleSide });
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...at);
  const sides = [1, -1].map((side) => {
    const mesh = new THREE.InstancedMesh(wing(side), material, count);
    mesh.frustumCulled = false;
    group.add(mesh);
    return { side, mesh };
  });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let t = rng() * 100;
  const place = () => {
    birds.forEach((b, i) => {
      const f = flight(b, t);
      p.set(f.x, f.y, f.z);
      s.setScalar(b.size);
      for (const { side, mesh } of sides) {
        q.setFromEuler(e.set(0, f.yaw, side * f.flap + f.bank, 'YXZ'));
        mesh.setMatrixAt(i, m.compose(p, q, s));
      }
    });
    for (const { mesh } of sides) mesh.instanceMatrix.needsUpdate = true;
  };
  place();
  return {
    mesh: group,
    update(dt) {
      t += dt;
      place();
    },
    dispose() {
      group.removeFromParent();
      for (const { mesh } of sides) mesh.geometry.dispose();
      material.dispose();
    },
  };
}
