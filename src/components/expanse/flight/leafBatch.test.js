import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createLeafBatch } from './leafBatch';

// a leaf's answer as the worker sends it: a grid of `n` × `n` quads, `size`
// metres a side, at height `h`
const answer = (n = 4, size = 64, h = 0) => {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let iz = 0; iz <= n; iz++)
    for (let ix = 0; ix <= n; ix++) {
      positions.push((ix * size) / n, h, (iz * size) / n);
      normals.push(0, 1, 0);
    }
  for (let iz = 0; iz < n; iz++)
    for (let ix = 0; ix < n; ix++) {
      const a = iz * (n + 1) + ix;
      indices.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
    }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint32Array(indices) };
};
const leaf = (x0, z0, size = 64) => ({ key: `${x0},${z0}`, x0, z0, size });
const shown = (batch) => {
  const out = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < batch.mesh.instanceCount; i++) {
    if (!batch.mesh.getVisibleAt(i)) continue;
    batch.mesh.getMatrixAt(i, m);
    out.push([m.elements[12], m.elements[14]]);
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};

describe('the ground’s leaves as one batch', () => {
  it('draws each leaf where it stands, hidden until shown, in one object', () => {
    const batch = createLeafBatch(new THREE.MeshLambertMaterial(), { slots: 4 });
    const a = batch.add(leaf(0, 0), answer());
    const b = batch.add(leaf(64, 0), answer());
    expect(shown(batch)).toEqual([]);
    batch.show(a, true);
    batch.show(b, true);
    expect(shown(batch)).toEqual([
      [0, 0],
      [64, 0],
    ]);
    batch.show(a, false);
    expect(shown(batch)).toEqual([[64, 0]]);
    expect(batch.mesh.isBatchedMesh).toBe(true);
    expect(batch.live()).toBe(2);
  });

  it('takes a freed slot for the next leaf rather than growing', () => {
    const batch = createLeafBatch(new THREE.MeshLambertMaterial(), { slots: 2 });
    const a = batch.add(leaf(0, 0), answer());
    batch.add(leaf(64, 0), answer());
    batch.remove(a);
    expect(batch.live()).toBe(1);
    const c = batch.add(leaf(0, 64), answer(4, 64, 5));
    batch.show(c, true);
    expect(batch.mesh.maxInstanceCount).toBe(2);
    expect(shown(batch)).toEqual([[0, 64]]);
    // (the slot holds the new leaf's own heights)
    const box = batch.mesh.getBoundingBoxAt(c.geometry, new THREE.Box3());
    expect(box.min.y).toBe(5);
  });

  it('grows when every slot is in use, the leaves it held kept', () => {
    const batch = createLeafBatch(new THREE.MeshLambertMaterial(), { slots: 1 });
    const made = [0, 64, 128, 192, 256].map((x) => batch.add(leaf(x, 0), answer()));
    for (const h of made) batch.show(h, true);
    expect(batch.live()).toBe(5);
    expect(shown(batch)).toEqual([0, 64, 128, 192, 256].map((x) => [x, 0]));
    expect(batch.mesh.maxInstanceCount).toBeGreaterThanOrEqual(5);
  });

  it('takes a bigger leaf than its slots hold into a slot of its own size', () => {
    const batch = createLeafBatch(new THREE.MeshLambertMaterial(), { slots: 4 });
    const small = batch.add(leaf(0, 0), answer(2));
    batch.remove(small);
    const big = batch.add(leaf(0, 0), answer(8));
    batch.show(big, true);
    expect(big.geometry).not.toBe(small.geometry);
    const box = batch.mesh.getBoundingBoxAt(big.geometry, new THREE.Box3());
    expect(box.max.x).toBe(64);
  });

  it('frees its buffers once, on dispose', () => {
    const batch = createLeafBatch(new THREE.MeshLambertMaterial(), { slots: 2 });
    batch.add(leaf(0, 0), answer());
    let freed = 0;
    batch.mesh.geometry.addEventListener('dispose', () => freed++);
    batch.dispose();
    expect(freed).toBe(1);
    expect(batch.live()).toBe(0);
  });
});
