import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { freeRoom } from './free';

const room = () => {
  const freed = new Set();
  const watch = (x) => (x.addEventListener('dispose', () => freed.add(x)), x);
  const shared = watch(new THREE.MeshStandardMaterial({ map: watch(new THREE.Texture()) }));
  return { root: new THREE.Group(), freed, watch, shared };
};

describe('freeRoom', () => {
  it('gives back every geometry, owned material and texture under a room, and leaves the shared ones', () => {
    const { root, freed, watch, shared } = room();
    const own = watch(new THREE.MeshStandardMaterial({ map: watch(new THREE.Texture()) }));
    const trim = watch(shared.clone());
    trim.map = watch(shared.map.clone());
    root.add(...[shared, own, trim].map((m) => new THREE.Mesh(watch(new THREE.BoxGeometry()), m)));
    expect(freeRoom(root, new Set([shared, shared.map]))).toEqual({ geometries: 3, materials: 2, textures: 2, skeletons: 0 });
    expect(freed.has(shared) || freed.has(shared.map)).toBe(false);
    for (const x of [own, own.map, trim, trim.map]) expect(freed.has(x)).toBe(true);
  });
  it('gives back a figure’s skeleton and its bone texture', () => {
    const { root, freed, watch, shared } = room();
    const bone = new THREE.Bone();
    const skeleton = new THREE.Skeleton([bone]);
    const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), shared);
    mesh.add(bone);
    mesh.bind(skeleton);
    root.add(mesh);
    skeleton.computeBoneTexture();
    const bones = watch(skeleton.boneTexture);
    expect(freeRoom(root, new Set([shared])).skeletons).toBe(1);
    expect(freed.has(bones)).toBe(true);
    expect(skeleton.boneTexture).toBeNull();
  });
  it('gives each thing back once, however many meshes share it', () => {
    const { root } = room();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    let calls = 0;
    geometry.addEventListener('dispose', () => calls++);
    material.addEventListener('dispose', () => calls++);
    root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, [material]));
    expect(freeRoom(root)).toEqual({ geometries: 1, materials: 1, textures: 0, skeletons: 0 });
    expect(calls).toBe(2);
  });
});
