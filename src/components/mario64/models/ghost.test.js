import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ghostGeometry } from './ghost';
import { makeMario } from './index';

describe('the pale Mario of the others online', () => {
  it('is the code-made Mario in one piece: one geometry, so one draw a ghost', () => {
    const g = ghostGeometry();
    const m = makeMario();
    let tris = 0;
    m.root.updateMatrixWorld(true);
    m.root.traverse((o) => o.isMesh && o.visible && (tris += o.geometry.index.count / 3));
    expect(g.index.count / 3).toBe(tris);
    expect(Object.keys(g.attributes).sort()).toEqual(['normal', 'position']);
    g.dispose();
  });

  it('stands where Mario stands: feet at naught, his height, facing as he does', () => {
    const g = ghostGeometry();
    g.computeBoundingBox();
    const m = makeMario();
    m.root.updateMatrixWorld(true);
    // (precise: each part's own corners, not its box turned)
    const box = new THREE.Box3().setFromObject(m.root, true);
    expect(g.boundingBox.min.y).toBeCloseTo(box.min.y, 3);
    expect(g.boundingBox.max.y).toBeCloseTo(box.max.y, 3);
    expect(g.boundingBox.max.z).toBeCloseTo(box.max.z, 3);
    g.dispose();
  });
});
