import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { litWindows as glslWindows } from '../props/windows';
import { litWindows, shaftMaterial, shieldMaterial } from './props';

describe('the props’ shaders as nodes', () => {
  it('lit windows: a node material, the same uniforms, once', () => {
    const a = glslWindows(new THREE.MeshStandardMaterial(), { seed: 4, density: 0.4, cell: [2, 3] });
    const n = litWindows(new THREE.MeshStandardMaterial(), { seed: 4, density: 0.4, cell: [2, 3] });
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.userData.windows).sort()).toEqual(Object.keys(a.userData.windows).sort());
    for (const k of Object.keys(a.userData.windows)) {
      const v = a.userData.windows[k].value;
      expect(n.userData.windows[k].value?.toArray?.() ?? n.userData.windows[k].value).toEqual(v?.toArray?.() ?? v);
    }
    expect(litWindows(n)).toBe(n);
    expect(n.customProgramCacheKey()).toContain('|windows');
  });

  it('the shield and the shafts: added on, see-through, no depth written, their uniforms where the frame code writes them', () => {
    const s = shieldMaterial();
    expect(s).toMatchObject({ isNodeMaterial: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    expect(Object.keys(s.uniforms).sort()).toEqual(['uColor', 'uTime']);
    s.uniforms.uTime.value = 2;
    expect(s.uniforms.uTime.value).toBe(2);
    const f = shaftMaterial('#ffeeaa', 0.7);
    expect(f).toMatchObject({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    expect(f.uniforms.uK.value).toBe(0.7);
    expect(f.uniforms.uColor.value.getHex()).toBe(0xffeeaa);
  });
});
