import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { wallMaterial } from './hvv';

describe('the hvv arena’s edge as nodes', () => {
  it('a wall: added on, both sides, no depth, its colour and clock', () => {
    const m = wallMaterial();
    expect(m).toMatchObject({ isNodeMaterial: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    expect(Object.keys(m.uniforms).sort()).toEqual(['uColor', 'uTime']);
    expect(m.uniforms.uColor.value.getHex()).toBe(new THREE.Color('#bcd8ff').getHex());
    m.uniforms.uTime.value = 3;
    expect(m.uniforms.uTime.value).toBe(3);
    expect(m.colorNode?.isNode && m.opacityNode?.isNode).toBe(true);
  });
});
