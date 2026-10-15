import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { instanceStill, makePool } from './instanced';

// a prop as ./models/things.js makes one: a root, the model under it
function prop(geo, mat, x, s = 1) {
  const root = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.5;
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
  root.position.set(x, 0, 2);
  root.rotation.y = x;
  root.scale.setScalar(s);
  root.userData.kind = 'tree';
  return root;
}

describe('the still props, instanced', () => {
  const geo = new THREE.BoxGeometry();
  const mat = new THREE.MeshStandardMaterial();
  const still = (o) => o.userData.kind === 'tree';

  it('draws the props that share a geometry and a material as one mesh, each where it stood', () => {
    const group = new THREE.Group();
    group.position.set(5, 1, 0);
    const roots = [prop(geo, mat, 1), prop(geo, mat, 2, 2), prop(geo, mat, 3)];
    group.add(...roots);
    group.updateMatrixWorld(true);
    const where = roots.map((r) => r.children[0].matrixWorld.clone());
    expect(instanceStill(group, still)).toBe(1);
    const [im] = group.children.filter((o) => o.isInstancedMesh);
    expect(im.count).toBe(3);
    expect(im.geometry).toBe(geo);
    expect(im.material).toBe(mat);
    expect(im.castShadow && im.receiveShadow).toBe(true);
    group.updateMatrixWorld(true);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 3; i++) {
      im.getMatrixAt(i, m);
      m.premultiply(im.matrixWorld);
      m.elements.forEach((v, k) => expect(v).toBeCloseTo(where[i].elements[k], 5));
    }
    // (the props' own meshes are gone from the frame)
    for (const r of roots) expect(r.children).toHaveLength(0);
  });

  it('leaves what moves, what is alone of its kind and a skinned mesh as they were', () => {
    const group = new THREE.Group();
    const moving = prop(geo, mat, 1);
    moving.userData.kind = 'flag';
    const alone = prop(new THREE.SphereGeometry(), mat, 2);
    group.add(moving, alone);
    expect(instanceStill(group, still)).toBe(0);
    expect(moving.children).toHaveLength(1);
    expect(alone.children).toHaveLength(1);
    expect(group.children.some((o) => o.isInstancedMesh)).toBe(false);
  });
});

describe('a pool of instances', () => {
  const geo = new THREE.CircleGeometry();
  const mat = new THREE.MeshBasicMaterial();

  it('gives each a slot, puts it where it is told, and hides what is hidden or let go', () => {
    const pool = makePool(geo, mat, 4);
    const a = pool.add();
    const b = pool.add();
    expect(pool.mesh.count).toBe(2);
    pool.set(a, 1, 2, 3, 0.5, true);
    pool.set(b, 4, 5, 6, 2, false);
    const m = new THREE.Matrix4();
    pool.mesh.getMatrixAt(a, m);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    m.decompose(p, new THREE.Quaternion(), s);
    expect(p.toArray()).toEqual([1, 2, 3]);
    expect(s.toArray()).toEqual([0.5, 0.5, 0.5]);
    // (three reads a matrix of no size as one of size 1: its diagonal says)
    const size = (slot) => (pool.mesh.getMatrixAt(slot, m), [m.elements[0], m.elements[5], m.elements[10]]);
    expect(size(b)).toEqual([0, 0, 0]);
    // (a slot let go is drawn as nothing, and is the next one given)
    pool.remove(a);
    expect(size(a)).toEqual([0, 0, 0]);
    expect(pool.add()).toBe(a);
    expect(pool.mesh.count).toBe(2);
    pool.clear();
    expect(pool.mesh.count).toBe(0);
    expect(pool.add()).toBe(0);
  });

  it('grows when it is full, keeping what it holds', () => {
    const pool = makePool(geo, mat, 1);
    const a = pool.add();
    pool.set(a, 7, 0, 0, 1, true);
    const first = pool.mesh;
    const b = pool.add();
    expect(b).toBe(1);
    expect(pool.mesh).not.toBe(first);
    expect(pool.mesh.count).toBe(2);
    const m = new THREE.Matrix4();
    pool.mesh.getMatrixAt(a, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).x).toBe(7);
  });
});
