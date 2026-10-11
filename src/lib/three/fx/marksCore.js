// The game's sheets drawn as the galaxy's effects (./marks.js says how),
// without their look: the pool, the instances and their ageing, with the
// material handed in, sheetMaterial({ texture, ramp, mode, channel, fog,
// grid, additive }) → a material: marks.js's GLSL, or marksNodes.js's nodes.
//
// createSheetFxWith(sheetMaterial, parent, { texture, ramp, mode, channel, count, life, fog })
//   → { mesh, add(at, normal, { size, frame, tint, bright, life, grow }), update(dt), clear(), dispose() }

import * as THREE from 'three';

export function createSheetFxWith(sheetMaterial, parent, { texture, ramp = null, mode = 'glow', channel = 'r', count = 32, life = 1, fog = true } = {}) {
  const grid = texture.userData.look?.grid ?? [1, 1];
  const geo = new THREE.PlaneGeometry(1, 1);
  const info = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  info.setUsage(THREE.DynamicDrawUsage);
  tint.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aInfo', info);
  geo.setAttribute('aTint', tint);
  const additive = mode === 'glow' || mode === 'sprite';
  const mat = sheetMaterial({ texture, ramp, mode, channel, fog, grid, additive });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = additive ? 7 : 2;
  mesh.name = `fx-${texture.userData.look?.name ?? 'sheet'}-${mode}`;
  parent.add(mesh);

  const live = [];
  const free = Array.from({ length: count }, () => ({ at: new THREE.Vector3(), q: new THREE.Quaternion(), age: 0, life, size: 1, grow: 0, frame: 0, bright: 1, tint: [1, 1, 1] }));
  const m4 = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  const n = new THREE.Vector3();

  return {
    mesh,
    // `at`, `normal` Vector3s (copied); grow: how much bigger by the end
    add(at, normal, { size = 1, frame = 0, tint: c = [1, 1, 1], bright = 1, life: l = life, grow = 0, spin = Math.random() * Math.PI * 2 } = {}) {
      const f = free.pop() ?? live.shift();
      if (!f) return null;
      f.at.copy(at);
      n.copy(normal ?? Z).normalize();
      f.q.setFromUnitVectors(Z, n);
      // a turn about its own normal, so no two marks lie alike
      f.q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, spin));
      Object.assign(f, { age: 0, life: l, size, grow, frame, bright });
      f.tint = c;
      live.push(f);
      return f;
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const f = live[i];
        f.age += dt / f.life;
        if (f.age >= 1) {
          live.splice(i, 1);
          free.push(f);
        }
      }
      for (let i = 0; i < live.length; i++) {
        const f = live[i];
        mesh.setMatrixAt(i, m4.compose(f.at, f.q, s.setScalar(f.size * (1 + f.grow * Math.sqrt(f.age)))));
        info.setXYZW(i, f.age, f.frame, 0, f.bright);
        tint.setXYZ(i, f.tint[0], f.tint[1], f.tint[2]);
      }
      mesh.count = live.length;
      if (live.length) {
        mesh.instanceMatrix.needsUpdate = true;
        info.needsUpdate = true;
        tint.needsUpdate = true;
      }
    },
    get busy() {
      return live.length;
    },
    clear() {
      free.push(...live.splice(0));
      mesh.count = 0;
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}
