import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../../towns/minastirith/propsShaders';
import * as nodes from './propsShaders';

const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
const PITCH = { EAVE: 0.4, RIDGE: 1.5 };

describe('nodes/towns/minastirith/propsShaders, the twin of Minas Tirith’s patches', () => {
  it('exports what the original exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('returns what it patched: the GLSL its material, the twin a node material', () => {
    const U = { uTime: { value: 0 } };
    const a = M({});
    expect(glsl.swayBanner(a, U)).toBe(a);
    expect(glsl.houseShader(a)).toBe(a);
    expect(glsl.roofShader(a, PITCH)).toBe(a);
  });

  it('makes standard node materials keeping the original’s own', () => {
    const map = new THREE.Texture();
    const make = [(P) => P.swayBanner(M({ map, alphaTest: 0.5 }), { uTime: { value: 2 } }), (P) => P.houseShader(M({ map, emissiveMap: map, roughness: 0.9 })), (P) => P.roofShader(M({ map, normalMap: map, roughness: 0.72 }), PITCH)];
    for (const f of make) {
      const a = f(glsl);
      const n = f(nodes);
      expect(n.isNodeMaterial).toBe(true);
      expect(n.isMeshStandardNodeMaterial).toBe(true);
      expect([n.map, n.roughness, n.alphaTest, n.emissiveMap]).toEqual([a.map, a.roughness, a.alphaTest, a.emissiveMap]);
    }
  });

  it('keys each patch’s program by the GLSL’s tag', () => {
    const tex = () => new THREE.Texture();
    const keys = [nodes.swayBanner(M({}), { uTime: { value: 0 } }), nodes.houseShader(M({ map: tex(), emissiveMap: tex() })), nodes.roofShader(M({ map: tex() }), PITCH)].map((m) => m.customProgramCacheKey());
    expect(keys[0]).toContain('minas-banner');
    expect(keys[1]).toContain('minas-house');
    expect(keys[2]).toContain('minas-roof');
  });
});
