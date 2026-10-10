import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './recolour';
import * as nodes from './recolourNodes';

describe('recolourNodes, the twin of recolour', () => {
  it('exports what recolour exports, but the GLSL string; the same mean', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).filter((k) => k !== 'recolourShader').sort());
    expect(nodes.REF).toBe(glsl.REF);
    const img = { width: 2, height: 1, data: Uint8Array.from([200, 30, 30, 255, 30, 200, 30, 10]) };
    expect(nodes.meanLuma(img)).toBe(glsl.meanLuma(img));
  });

  it('recolours once: a node material, its colour set, the same uniforms', () => {
    const a = glsl.recolour(new THREE.MeshLambertMaterial({ map: new THREE.Texture() }), '#3a8a30', { ref: 0.3 });
    const n = nodes.recolour(new THREE.MeshLambertMaterial({ map: new THREE.Texture() }), '#3a8a30', { ref: 0.3 });
    expect(n.isNodeMaterial).toBe(true);
    expect(n.color.getHex()).toBe(a.color.getHex());
    expect(Object.keys(n.userData.recolour).sort()).toEqual(Object.keys(a.userData.recolour).sort());
    expect(n.userData.recolour.uRecolour.value.getHex()).toBe(0x3a8a30);
    expect(n.userData.recolour.uRecolourRef.value).toBe(0.3);
    expect(nodes.recolour(n, '#ffffff')).toBe(n);
    expect(n.customProgramCacheKey()).toContain('|recolour');
  });
});
