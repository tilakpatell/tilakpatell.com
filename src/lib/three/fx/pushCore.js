// The Force push (./push.js says what it is), without its look: the pool,
// the front's run and its fading, with the material handed in,
// pushMaterial() → a material whose `uniforms` hold uColour and uAge:
// push.js's GLSL, or pushNodes.js's nodes.
//
// createPushWith(pushMaterial, parent) → { ready: Promise, push(from, dir, { colour, pull, reach }) → bool, update(dt), dispose() }

import * as THREE from 'three';
import { floatGeometry } from './debris';
import { loadLookMesh } from './gameLook';

const LIFE = 0.45; // s
const POOL = 3;

export function createPushWith(pushMaterial, parent) {
  const group = new THREE.Group();
  group.name = 'fx-push';
  parent.add(group);
  const pool = [];
  let geo = null;
  const ready = loadLookMesh('force.push')
    .then((gltf) => {
      if (!gltf) return false;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (o.isMesh && !geo) geo = floatGeometry(o.geometry, o.matrixWorld);
      });
      if (!geo) return false;
      // (the dome's base at its origin, 1 across: its own is 3.1 m)
      geo.computeBoundingBox();
      const r = Math.max(geo.boundingBox.max.x, geo.boundingBox.max.y) || 1;
      geo.scale(1 / r, 1 / r, 1 / r);
      for (let i = 0; i < POOL; i++) {
        const mat = pushMaterial();
        const u = mat.uniforms;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = 7;
        group.add(mesh);
        pool.push({ mesh, u, age: 1, pull: false, reach: 4, from: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1) });
      }
      return true;
    })
    .catch(() => false);
  const Z = new THREE.Vector3(0, 0, 1);
  let next = 0;

  return {
    ready,
    // `from` the hand, `dir` the way (Vector3s); `reach` how far it goes (m)
    push(from, dir, { colour = '#c8d8ff', pull = false, reach = 4 } = {}) {
      if (!pool.length) return false;
      const p = pool[next++ % pool.length];
      p.from.copy(from);
      p.dir.copy(dir).normalize();
      p.mesh.position.copy(from);
      p.mesh.quaternion.setFromUnitVectors(Z, p.dir);
      p.u.uColour.value.set(colour);
      Object.assign(p, { age: 0, pull, reach });
      p.mesh.visible = true;
      return true;
    },
    update(dt) {
      for (const p of pool) {
        if (!p.mesh.visible) continue;
        p.age += dt / LIFE;
        if (p.age >= 1) {
          p.mesh.visible = false;
          continue;
        }
        // a front running out along the push, fast and easing (in, for a
        // pull), widening a little as it goes: it leaves the hand, so the
        // camera behind never stands inside it
        const k = p.pull ? 1 - p.age : 1 - (1 - p.age) ** 2;
        const across = 0.5 + k * 1.7;
        p.mesh.position.copy(p.from).addScaledVector(p.dir, k * p.reach * 0.8);
        p.mesh.scale.set(across, across, 0.35 + k * 0.5);
        p.u.uAge.value = p.age;
      }
    },
    dispose() {
      group.removeFromParent();
      for (const p of pool) p.mesh.material.dispose();
      geo?.dispose();
    },
  };
}
