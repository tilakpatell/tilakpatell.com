import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { beamMaterial } from './activity';

describe('the activity’s beam as nodes', () => {
  it('added on, both sides, no depth written, its colour and clock where the frame code writes them', () => {
    const m = beamMaterial('#55aaff');
    expect(m).toMatchObject({ isNodeMaterial: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    expect(m.uniforms.uColor.value.getHex()).toBe(0x55aaff);
    m.uniforms.uTime.value = 4;
    expect(m.uniforms.uTime.value).toBe(4);
  });
});
