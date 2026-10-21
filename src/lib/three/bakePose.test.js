import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bakePose } from './bakePose';

// a 1 m box standing on the origin, skinned to two bones: its lower half
// to the root bone, its upper half to a bone at y = 0.5
function figure() {
  const geo = new THREE.BoxGeometry(0.4, 1, 0.4, 1, 2, 1).translate(0, 0.5, 0);
  const pos = geo.attributes.position;
  const idx = [];
  const wt = [];
  for (let i = 0; i < pos.count; i++) {
    const up = pos.getY(i) > 0.75 ? 1 : 0;
    idx.push(up, 0, 0, 0);
    wt.push(1, 0, 0, 0);
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  const chest = new THREE.Bone();
  chest.name = 'Chest';
  chest.position.y = 0.5;
  hips.add(chest);
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  const root = new THREE.Group();
  root.add(hips, mesh);
  root.position.set(3, 0, 2); // (off the origin: the bake is in the root's own space)
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([hips, chest]));
  const bend = new THREE.AnimationClip('bend', 1, [
    new THREE.QuaternionKeyframeTrack('Chest.quaternion', [0, 1], [...new THREE.Quaternion().toArray(), ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2).toArray()]),
  ]);
  return { root, mesh, chest, bend };
}

// where the skinned mesh draws vertex i now, in the root's space
function drawn(root, mesh, i) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  return mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(toRoot);
}

describe('a rigged figure stood in a pose as plain geometry', () => {
  it('lands every vertex where the skinned mesh draws it in the clip’s pose', () => {
    const { root, mesh, chest, bend } = figure();
    const geo = bakePose(root, bend, 1);
    expect(geo).toBeTruthy();
    expect(geo.attributes.skinIndex).toBeUndefined();
    chest.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const want = drawn(root, mesh, i);
      const p = new THREE.Vector3().fromBufferAttribute(geo.attributes.position, i);
      expect(p.distanceTo(want)).toBeLessThan(1e-5);
    }
    // (the upper half has turned over: its top is off to the side now)
    geo.computeBoundingBox();
    expect(geo.boundingBox.max.y).toBeLessThan(0.95);
  });

  it('turns the normals with their bones', () => {
    const { root, mesh, bend } = figure();
    const geo = bakePose(root, bend, 1);
    const n = mesh.geometry.attributes.normal;
    const i = [...Array(n.count).keys()].find((k) => n.getY(k) > 0.99 && mesh.geometry.attributes.skinIndex.getX(k) === 1);
    const after = new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, i);
    expect(after.length()).toBeCloseTo(1, 5);
    // up, turned a quarter round z: pointing −x
    expect(after.x).toBeCloseTo(-1, 4);
    expect(after.y).toBeCloseTo(0, 4);
  });

  it('keeps the uvs and the index', () => {
    const { root, mesh, bend } = figure();
    const geo = bakePose(root, bend, 0.5);
    expect(geo.index.count).toBe(mesh.geometry.index.count);
    expect([...geo.attributes.uv.array]).toEqual([...mesh.geometry.attributes.uv.array]);
  });

  it('stands it at rest with no clip, and leaves the figure as it found it', () => {
    const { root, mesh, chest } = figure();
    const geo = bakePose(root, null);
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const want = drawn(root, mesh, i);
      expect(new THREE.Vector3().fromBufferAttribute(geo.attributes.position, i).distanceTo(want)).toBeLessThan(1e-5);
    }
    expect(chest.quaternion.equals(new THREE.Quaternion())).toBe(true);
  });

  it('gives nothing for a model with no skinned mesh', () => {
    const root = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry()));
    expect(bakePose(root, null)).toBeNull();
  });
});
