import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../../towns/amonhen/sceneShaders';
import * as nodes from './sceneShaders';

const water = () => ({
  uniforms: {
    uSky: { value: new THREE.Color(0x5a6a8a) },
    uDeep: { value: new THREE.Color(0x14182a) },
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xffa070) },
    uGlints: { value: 1 },
  },
});

describe('nodes/towns/amonhen/sceneShaders, the twin of Amon Hen’s lake', () => {
  it('exports what the original exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes the lake a node material, its uniforms the GLSL’s, the sky’s shared', () => {
    const w = water();
    const a = glsl.lakeMaterial(w);
    const n = nodes.lakeMaterial(w);
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.uniforms).sort()).toEqual(
      Object.keys(a.uniforms)
        .filter((k) => k.startsWith('u'))
        .sort(),
    );
    for (const k of ['uSky', 'uDeep', 'uSun', 'uSunColor']) expect(n.uniforms[k]).toBe(w.uniforms[k]);
    expect(n.uniforms.uTime.value).toBe(a.uniforms.uTime.value);
    expect([n.transparent, n.depthWrite, n.fog]).toEqual([a.transparent, a.depthWrite, a.fog]);
    expect(n.toneMapped).toBe(false);
  });
});
