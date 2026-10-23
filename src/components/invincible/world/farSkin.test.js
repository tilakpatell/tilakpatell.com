import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { preciseSkin } from './farSkin';

// a two-bone arm, skinned, under a holder at `at`
function arm(at) {
  const geo = new THREE.BoxGeometry(0.2, 2, 0.2, 1, 4, 1).translate(0, 1, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 1 ? 1 : 0)), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap((_, v) => { const y = geo.attributes.position.getY(v) / 2; return [1 - y, y, 0, 0]; }), 4));
  const root = new THREE.Bone();
  const elbow = new THREE.Bone();
  elbow.position.y = 1;
  root.add(elbow);
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  mesh.add(root);
  const holder = new THREE.Group();
  holder.add(mesh);
  holder.updateMatrixWorld(true);
  // (bound where it loads, at the origin, as every figure is; then carried out there)
  mesh.bind(new THREE.Skeleton([root, elbow]));
  elbow.rotation.z = 0.7;
  holder.position.set(...at);
  holder.rotation.y = 0.4;
  holder.updateMatrixWorld(true);
  return { holder, mesh };
}
// a vertex as the shader skins it, in the mesh's own space (bind inverse × Σ weight × bone × bind × p)
function shaderVertex(mesh, i) {
  mesh.skeleton.update();
  const p = new THREE.Vector4().fromBufferAttribute(mesh.geometry.attributes.position, i).setW(1).applyMatrix4(mesh.bindMatrix);
  const out = new THREE.Vector4(0, 0, 0, 0);
  const m = new THREE.Matrix4();
  for (let k = 0; k < 4; k++) {
    const w = mesh.geometry.attributes.skinWeight.getComponent(i, k);
    if (!w) continue;
    m.fromArray(mesh.skeleton.boneMatrices, mesh.geometry.attributes.skinIndex.getComponent(i, k) * 16);
    out.addScaledVector(p.clone().applyMatrix4(m), w);
  }
  return out.applyMatrix4(mesh.bindMatrixInverse);
}

describe('a skinned figure far out', () => {
  it('skins every vertex where three would, near the origin', () => {
    const { holder, mesh } = arm([3, 0, -2]);
    const before = [...Array(mesh.geometry.attributes.position.count).keys()].map((i) => shaderVertex(mesh, i));
    const p = preciseSkin(holder);
    before.forEach((v, i) => {
      expect(shaderVertex(mesh, i).sub(v).length()).toBeLessThan(1e-5);
    });
    p.undo();
    expect(mesh.bindMode).toBe(THREE.AttachedBindMode);
    before.forEach((v, i) => expect(shaderVertex(mesh, i).sub(v).length()).toBeLessThan(1e-5));
  });
  it('sends small numbers up 400 km out', () => {
    const { holder, mesh } = arm([86000, 64500, -410000]);
    preciseSkin(holder);
    mesh.skeleton.update();
    expect(Math.max(...mesh.skeleton.boneMatrices.map(Math.abs))).toBeLessThan(10);
  });
});
