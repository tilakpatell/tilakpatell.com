import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CLOTH_PART, LAG, reskinCloth } from './clothFallback.js';

// a kama of three vertices behind the hips: the left edge on the left shin,
// the right edge on the right shin, the middle half on each thigh
function kama() {
  const bone = (name, x, y) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, 0);
    return b;
  };
  const hips = bone('Hips', 0, 1);
  const lt = bone('LeftUpLeg', 0.1, 0);
  const rt = bone('RightUpLeg', -0.1, 0);
  const ls = bone('LeftLeg', 0, -0.45);
  const rs = bone('RightLeg', 0, -0.45);
  hips.add(lt, rt);
  lt.add(ls);
  rt.add(rs);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0.12, 0.6, -0.1, -0.12, 0.6, -0.1, 0, 0.7, -0.1], 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([3, 0, 0, 0, 4, 0, 0, 0, 1, 2, 0, 0], 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 0.5, 0.5, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial({ name: 'mat_cape' }));
  mesh.add(hips);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([hips, lt, rt, ls, rs]));
  return mesh;
}
const weightsOf = (mesh, v) => {
  const out = {};
  const { skinIndex: si, skinWeight: sw } = mesh.geometry.attributes;
  for (let k = 0; k < 4; k++) if (sw.getComponent(v, k) > 0) out[mesh.skeleton.bones[si.getComponent(v, k)].name] = sw.getComponent(v, k);
  return out;
};

describe('reskinCloth', () => {
  it('names the cloth slots the bodies carry', () => {
    for (const n of ['mat_cape', 'd_assault_orig_ho_01_cape', 'Kama', 'mat_robe']) expect(CLOTH_PART.test(n)).toBe(true);
    expect(CLOTH_PART.test('mat_body')).toBe(false);
  });

  it('moves every leg weight to the thighs and the hips, by the side the vertex sits', () => {
    const m = kama();
    expect(reskinCloth(m)).toBe(3);
    for (let v = 0; v < 3; v++) {
      const w = weightsOf(m, v);
      expect(w.LeftLeg ?? 0).toBe(0);
      expect(w.RightLeg ?? 0).toBe(0);
      expect(w.Hips).toBeCloseTo(LAG, 5);
      expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    }
    // (the left edge on the left thigh, the right edge on the right, the middle on both alike)
    expect(weightsOf(m, 0).LeftUpLeg ?? 0).toBeGreaterThan(weightsOf(m, 0).RightUpLeg ?? 0);
    expect(weightsOf(m, 1).RightUpLeg ?? 0).toBeGreaterThan(weightsOf(m, 1).LeftUpLeg ?? 0);
    expect(weightsOf(m, 2).LeftUpLeg).toBeCloseTo(weightsOf(m, 2).RightUpLeg, 5);
  });

  it('does a geometry once', () => {
    const m = kama();
    reskinCloth(m);
    expect(reskinCloth(m)).toBe(0);
  });
});
