import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './marks';
import * as nodes from './marksNodes';

const sheet = () => {
  const t = new THREE.DataTexture(new Uint8Array(4 * 4 * 4).fill(200), 4, 4);
  t.userData.look = { grid: [2, 2], name: 'impact', rampV: 0.25 };
  return t;
};
const KEYS = ['transparent', 'depthWrite', 'blending', 'toneMapped', 'fog', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'side'];

describe('marksNodes, the twin of marks', () => {
  for (const mode of ['decal', 'decal-colour', 'glow', 'sprite']) {
    it(`a ${mode}: a node material, the same flags and uniforms`, () => {
      const ramp = sheet();
      const opts = { texture: sheet(), ramp: mode === 'decal' ? null : ramp, mode, channel: 'g', count: 4, life: 1 };
      const a = glsl.createSheetFx(new THREE.Group(), opts);
      const b = nodes.createSheetFx(new THREE.Group(), opts);
      const [ma, mb] = [a.mesh.material, b.mesh.material];
      expect(mb.isNodeMaterial).toBe(true);
      for (const k of KEYS) expect(mb[k]).toBe(ma[k]);
      const own = Object.keys(ma.uniforms).filter((k) => k.startsWith('u')).sort();
      expect(Object.keys(mb.uniforms).sort()).toEqual(own);
      expect(mb.uniforms.uGrid.value.toArray()).toEqual([2, 2]);
      expect(mb.uniforms.uChan.value.toArray()).toEqual([0, 1, 0, 0]);
      expect(mb.uniforms.uHasRamp.value).toBe(ma.uniforms.uHasRamp.value);
      expect(mb.uniforms.uRampV.value).toBe(ma.uniforms.uRampV.value);
      expect(b.mesh.name).toBe(a.mesh.name);
      expect(b.mesh.renderOrder).toBe(a.mesh.renderOrder);
    });
  }

  it('the same pool: a mark added, aged and gone', () => {
    const b = nodes.createSheetFx(new THREE.Group(), { texture: sheet(), mode: 'glow', count: 2, life: 1 });
    b.add(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), { tint: [1, 0, 0] });
    b.update(0.5);
    expect(b.mesh.count).toBe(1);
    expect(b.mesh.geometry.attributes.aInfo.getX(0)).toBeCloseTo(0.5);
    b.update(0.6);
    expect(b.busy).toBe(0);
    b.dispose();
  });
});
