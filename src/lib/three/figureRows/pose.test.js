import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { copyRow, growRows, rowLayout, writeRow } from './pose.js';

// a two-joint rig, bound at rest and then posed by hand, far from the origin
function rig() {
  const root = new THREE.Group();
  const hip = new THREE.Bone();
  const knee = new THREE.Bone();
  hip.position.set(0, 1, 0);
  knee.position.set(0, -0.45, 0.02);
  hip.add(knee);
  root.add(hip);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([hip, knee]);
  root.position.set(184.6, 385, -1342.5);
  root.rotation.y = 0.7;
  hip.rotation.set(0.3, -0.2, 0.1);
  knee.rotation.x = 1.1;
  knee.position.y = -0.5;
  root.updateMatrixWorld(true);
  skeleton.update();
  return { root, skeleton };
}

const IDENTITY = new THREE.Matrix4().elements;
// a skeleton of one joint whose skin matrix is `m`
const one = (m) => ({ bones: [{ matrixWorld: m }], boneInverses: [new THREE.Matrix4()] });

describe('a pose as a row', () => {
  it('lays a row out as the root and then four texels a joint', () => {
    expect(rowLayout(2)).toEqual({ joints: 2, texelsARow: 12, floatsARow: 48, rootAt: 0, jointsAt: 16 });
    expect(rowLayout(0)).toEqual({ joints: 0, texelsARow: 4, floatsARow: 16, rootAt: 0, jointsAt: 16 });
    expect(rowLayout(51).texelsARow).toBe(208);
  });

  it('writes the sixteen floats a joint that three’s own skeleton.update() leaves in boneMatrices', () => {
    const { skeleton } = rig();
    const layout = rowLayout(2);
    const array = new Float32Array(layout.floatsARow * 3);
    writeRow(array, 1, layout, skeleton, IDENTITY, IDENTITY);
    const at = layout.floatsARow + layout.jointsAt;
    expect([...array.subarray(at, at + 32)]).toEqual([...skeleton.boneMatrices]);
    expect([...array.subarray(layout.floatsARow, layout.floatsARow + 16)]).toEqual(IDENTITY);
  });

  it('re-bases each joint on the root, and the root puts it back where three had it', () => {
    const { root, skeleton } = rig();
    const layout = rowLayout(2);
    // (a root that turns, and one that only moves: the skin's in rows.js)
    for (const base of [root.matrixWorld, new THREE.Matrix4().makeTranslation(root.position.x, root.position.y, root.position.z)]) {
      const array = new Float32Array(layout.floatsARow);
      const inverse = base.clone().invert();
      writeRow(array, 0, layout, skeleton, inverse.elements, base.elements);
      expect([...array.subarray(0, 16)]).toEqual([...new Float32Array(base.elements)]);
      for (let j = 0; j < 2; j++) {
        const own = new THREE.Matrix4().fromArray(array, layout.jointsAt + j * 16);
        const world = new THREE.Matrix4().multiplyMatrices(skeleton.bones[j].matrixWorld, skeleton.boneInverses[j]);
        // (in the root's frame the joint is near: no thousand-metre float in the row)
        expect(Math.abs(own.elements[12])).toBeLessThan(3);
        expect(Math.abs(own.elements[14])).toBeLessThan(3);
        const want = inverse.clone().multiply(world);
        // (to a hundredth of a millimetre and better: the product is whole before it is a float32)
        for (let k = 0; k < 16; k++) expect(own.elements[k], `joint ${j} float ${k}`).toBeCloseTo(want.elements[k], 6);
        const back = base.clone().multiply(own);
        for (let k = 0; k < 16; k++) expect(back.elements[k], `joint ${j} float ${k}`).toBeCloseTo(world.elements[k], 3);
      }
    }
  });

  it('writes a second row without touching the first', () => {
    const { skeleton } = rig();
    const layout = rowLayout(2);
    const array = new Float32Array(layout.floatsARow * 2);
    writeRow(array, 0, layout, skeleton, IDENTITY, IDENTITY);
    const first = [...array.subarray(0, layout.floatsARow)];
    const other = new THREE.Matrix4().makeScale(7, 7, 7);
    writeRow(array, 1, layout, { bones: [{ matrixWorld: other }, { matrixWorld: other }], boneInverses: skeleton.boneInverses.map(() => new THREE.Matrix4()) }, IDENTITY, new THREE.Matrix4().makeTranslation(1, 2, 3).elements);
    expect([...array.subarray(0, layout.floatsARow)]).toEqual(first);
    expect(array[layout.floatsARow + 12]).toBe(1);
    expect(array[layout.floatsARow + layout.jointsAt]).toBe(7);
  });

  it('writes a part with no skin as its root alone, and no joint past the skeleton’s own', () => {
    const layout = rowLayout(0);
    const array = new Float32Array(layout.floatsARow * 2).fill(9);
    const root = new THREE.Matrix4().makeTranslation(4, 5, 6).elements;
    writeRow(array, 1, layout, null, null, root);
    expect([...array.subarray(16, 32)]).toEqual(root);
    expect(array[0]).toBe(9);
    const wide = rowLayout(3);
    const row = new Float32Array(wide.floatsARow).fill(9);
    writeRow(row, 0, wide, one(new THREE.Matrix4().makeTranslation(1, 0, 0)), IDENTITY, IDENTITY);
    expect(row[wide.jointsAt + 12]).toBe(1);
    expect(row[wide.jointsAt + 16]).toBe(9);
  });

  it('copies a row whole to another, the pose a frame keeps for the next', () => {
    const { skeleton } = rig();
    const layout = rowLayout(2);
    const array = new Float32Array(layout.floatsARow * 2);
    writeRow(array, 0, layout, skeleton, IDENTITY, IDENTITY);
    copyRow(array, layout, 0, 1);
    expect([...array.subarray(layout.floatsARow)]).toEqual([...array.subarray(0, layout.floatsARow)]);
  });

  it('grows and keeps what was written', () => {
    const { skeleton } = rig();
    const layout = rowLayout(2);
    const array = new Float32Array(layout.floatsARow * 2);
    writeRow(array, 1, layout, skeleton, IDENTITY, IDENTITY);
    const bigger = growRows(array, layout, 8);
    expect(bigger.length).toBe(layout.floatsARow * 8);
    expect([...bigger.subarray(0, array.length)]).toEqual([...array]);
    expect([...bigger.subarray(array.length)].every((v) => v === 0)).toBe(true);
    expect(growRows(null, layout, 2).length).toBe(layout.floatsARow * 2);
  });
});
