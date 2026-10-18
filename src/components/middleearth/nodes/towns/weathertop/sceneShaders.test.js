import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../../towns/weathertop/sceneShaders';
import * as nodes from './sceneShaders';

const water = () => ({
  uniforms: {
    uSky: { value: new THREE.Color(0x2a3e66) },
    uDeep: { value: new THREE.Color(0x060a14) },
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xa4b8ec) },
    uGlints: { value: 1 },
  },
});

describe('nodes/towns/weathertop/sceneShaders, the twin of Weathertop’s river', () => {
  it('exports what the original exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes the river a node material, its uniforms the GLSL’s, the sky’s shared', () => {
    const w = water();
    const a = glsl.riverMaterial(w);
    const n = nodes.riverMaterial(w);
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.uniforms).sort()).toEqual(
      Object.keys(a.uniforms)
        .filter((k) => k.startsWith('u'))
        .sort(),
    );
    for (const k of ['uSky', 'uDeep', 'uSun', 'uSunColor']) {
      expect(n.uniforms[k]).toBe(w.uniforms[k]);
      expect(a.uniforms[k]).toBe(w.uniforms[k]);
    }
    for (const k of ['uTime', 'uFlood']) expect(n.uniforms[k].value).toBe(a.uniforms[k].value);
    expect([n.transparent, n.depthWrite, n.fog]).toEqual([a.transparent, a.depthWrite, a.fog]);
    expect(n.toneMapped).toBe(false);
  });
});
