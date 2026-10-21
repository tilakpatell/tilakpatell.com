import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { instanced, partsOf, stoodOn } from './models';

// a model as a kit's family file has one: a named node holding two boxes,
// one above the other, off the origin
function family() {
  const scene = new THREE.Group();
  const node = new THREE.Group();
  node.name = 'Thing';
  node.position.set(5, 0, -3);
  const mat = new THREE.MeshStandardMaterial({ color: 0x336699 });
  const low = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), mat);
  low.position.y = 0.5;
  const high = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  high.position.y = 1.5;
  node.add(low, high);
  scene.add(node);
  return { scene, mat };
}
const boundsOf = (parts) => {
  const box = new THREE.Box3();
  for (const p of parts) {
    const g = p.geometry.clone().applyMatrix4(p.local);
    g.computeBoundingBox();
    box.union(g.boundingBox);
  }
  return box;
};

describe('a model’s parts', () => {
  it('takes the named node’s meshes, its foot’s middle at the origin, `tall` high', () => {
    const { scene } = family();
    const parts = partsOf(scene, { node: 'Thing', tall: 4 });
    expect(parts).toHaveLength(2);
    const b = boundsOf(parts);
    expect(b.min.y).toBeCloseTo(0, 5);
    expect(b.max.y).toBeCloseTo(4, 5);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(0, 5);
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(0, 5);
  });
  it('paints them in the toon look, unless they come painted (`paint: false`)', () => {
    const a = family();
    expect(partsOf(a.scene, { node: 'Thing', tall: 2 })[0].material.isMeshToonMaterial).toBe(true);
    const b = family();
    const kept = partsOf(b.scene, { tall: 2, paint: false });
    expect(kept[0].material).toBe(b.mat);
  });
  it('takes the whole model when no node is named, and none for a node that isn’t there', () => {
    const { scene } = family();
    expect(partsOf(scene, { tall: 2, paint: false })).toHaveLength(2);
    expect(partsOf(scene, { node: 'Nothing', tall: 2 })).toBeNull();
  });
});

describe('parts drawn as instances', () => {
  it('stands one instance at each placement, turned and scaled', () => {
    const { scene } = family();
    const parts = partsOf(scene, { node: 'Thing', tall: 2, paint: false });
    const meshes = instanced(parts, [
      { x: 10, z: 0 },
      { x: -4, z: 7, turn: Math.PI / 2, s: 2 },
    ], { shadows: false });
    expect(meshes).toHaveLength(2);
    for (const m of meshes) {
      expect(m.isInstancedMesh).toBe(true);
      expect(m.count).toBe(2);
      expect(m.castShadow).toBe(false);
    }
    const at = new THREE.Matrix4();
    const p = new THREE.Vector3();
    meshes[0].getMatrixAt(1, at);
    p.setFromMatrixPosition(at);
    expect(p.x).toBeCloseTo(-4, 5);
    expect(p.z).toBeCloseTo(7, 5);
    expect(instanced(parts, [], { shadows: true })).toEqual([]);
  });
  it('lifts an instance to its `y`', () => {
    const { scene } = family();
    const parts = partsOf(scene, { node: 'Thing', tall: 2, paint: false });
    const [mesh] = instanced(parts, [{ x: 0, z: 0, y: 3 }], { shadows: true });
    const at = new THREE.Matrix4();
    mesh.getMatrixAt(0, at);
    expect(new THREE.Vector3().setFromMatrixPosition(at).y).toBeGreaterThanOrEqual(3);
  });
});

describe('a model stood in place', () => {
  it('stands `h` tall on its spot, centred', () => {
    const { scene } = family();
    const held = stoodOn(scene, { x: 20, z: -6, y: 1, h: 6, turn: 0.4 });
    held.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(held);
    expect(b.min.y).toBeCloseTo(1, 4);
    expect(b.max.y).toBeCloseTo(7, 4);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(20, 4);
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(-6, 4);
  });
});
