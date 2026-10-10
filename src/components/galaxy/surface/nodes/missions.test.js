import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { columnMaterial, meterMaterial } from './missions';

describe('the assault’s posts as nodes', () => {
  it('a column: added on, both sides, its colour, clock and alpha', () => {
    const m = columnMaterial('#ff5533', 0.45);
    expect(m).toMatchObject({ isNodeMaterial: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    expect(Object.keys(m.uniforms).sort()).toEqual(['uAlpha', 'uColor', 'uTime']);
    expect(m.uniforms.uAlpha.value).toBe(0.45);
    m.uniforms.uColor.value.set('#00ff00');
    expect(m.uniforms.uColor.value.getHex()).toBe(0x00ff00);
  });

  it('a meter: added on, one side, filled by uFill', () => {
    const m = meterMaterial('#33ff55');
    expect(m).toMatchObject({ transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending });
    expect(m.uniforms.uFill.value).toBe(1);
    expect(m.maskNode?.isNode).toBe(true);
  });
});
