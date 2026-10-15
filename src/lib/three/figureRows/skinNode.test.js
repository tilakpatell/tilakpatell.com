import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { loadThree } from '../light/three.js';
import { rowLayout, writeRow } from './pose.js';
import { ROWS_AN_INSTANCE, rowNodes, rowVertex } from './skinNode.js';

const IDENTITY = new THREE.Matrix4().elements;

describe('the row’s vertex on the CPU', () => {
  it('puts a part with no skin where its root says', () => {
    const layout = rowLayout(0);
    const array = new Float32Array(layout.floatsARow * ROWS_AN_INSTANCE * 2);
    const root = new THREE.Matrix4().compose(new THREE.Vector3(10, 2, -5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(2, 2, 2));
    writeRow(array, 1 * ROWS_AN_INSTANCE, layout, null, null, root.elements);
    const got = rowVertex(array, layout, 1, { position: [1, 0, 0] });
    const want = new THREE.Vector3(1, 0, 0).applyMatrix4(root);
    got.forEach((v, k) => expect(v).toBeCloseTo(want.getComponent(k), 5));
  });

  it('weighs a vertex between its joints, then the root, and reads the frame before from the second row', () => {
    const layout = rowLayout(2);
    const array = new Float32Array(layout.floatsARow * ROWS_AN_INSTANCE);
    const up = new THREE.Matrix4().makeTranslation(0, 1, 0);
    const along = new THREE.Matrix4().makeTranslation(2, 0, 0);
    const skeleton = { bones: [{ matrixWorld: up }, { matrixWorld: along }], boneInverses: [new THREE.Matrix4(), new THREE.Matrix4()] };
    const root = new THREE.Matrix4().makeTranslation(100, 0, 0);
    writeRow(array, 0, layout, skeleton, IDENTITY, root.elements);
    writeRow(array, 1, layout, skeleton, IDENTITY, new THREE.Matrix4().makeTranslation(99, 0, 0).elements);
    const vertex = { index: [0, 1, 0, 0], weight: [0.5, 0.5, 0, 0], position: [0, 0, 0] };
    expect(rowVertex(array, layout, 0, vertex)).toEqual([101, 0.5, 0]);
    expect(rowVertex(array, layout, 0, { ...vertex, before: true })).toEqual([100, 0.5, 0]);
    // (a bind matrix first, as three's bindMatrix × position)
    expect(rowVertex(array, layout, 0, { ...vertex, bind: new THREE.Matrix4().makeTranslation(0, 0, 3).elements })).toEqual([101, 0.5, 3]);
  });
});

describe('the row’s nodes', () => {
  it('read the rows’ texture, and a grown one put in its place', async () => {
    const { tsl } = await loadThree();
    const map = new THREE.DataTexture(new Float32Array(16 * 4), 4 * 4, 1, THREE.RGBAFormat, THREE.FloatType);
    for (const skinned of [true, false]) {
      const nodes = rowNodes(tsl, { map, skinned });
      expect(nodes.rows.value).toBe(map);
      expect(nodes.position().isNode).toBe(true);
      const bigger = map.clone();
      nodes.rows.value = bigger;
      expect(nodes.rows.value).toBe(bigger);
    }
  });
});
