import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from '../../../towns/edoras/folkShaders';
import * as nodes from './folkShaders';

// the kit's uniforms (folk.js's `uniforms`)
const holders = () => ({
  uTime: { value: 0 },
  uRide: { value: 0 },
  uCyc: { value: 0 },
  uReach: { value: 0 },
  uFlut: { value: 0 },
  uCoat: {
    value: [0x6a3a1c, 0x8a4a22, 0x9a9a98, 0x1c1814, 0xa88a58, 0x3a2416].map((c) => new THREE.Color(c)),
  },
  uMane: {
    value: [0x1c1410, 0x3a2414, 0xe8e4dc, 0x0e0c0a, 0x2a2014, 0x141010].map((c) => new THREE.Color(c)),
  },
  uCloak: {
    value: [0x24401f, 0x2a4a2a, 0x3a5a2a, 0x4a3a1a, 0x1a3a2a].map((c) => new THREE.Color(c)),
  },
  uPlume: {
    value: [0xf8f6f0, 0xd8c8a0, 0x24401f, 0x8a2a1a, 0x1a1a1a].map((c) => new THREE.Color(c)),
  },
});
const PROPS = ['type', 'vertexColors', 'flatShading', 'side', 'transparent', 'depthWrite'];
const look = (m) => Object.fromEntries(PROPS.map((k) => [k, k === 'type' ? m.type.replace('Node', '') : m[k]]));
const both = (M) => {
  const u = holders();
  return {
    u,
    host: M.hostMaterial(u),
    banner: M.bannerMaterial(u, true),
    flag: M.bannerMaterial(u, false),
  };
};

describe('nodes/towns/edoras/folkShaders, the twin of the host’s materials', () => {
  it('exports what the original exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes Lambert node materials set as the classic ones are', () => {
    const a = both(glsl);
    const n = both(nodes);
    for (const k of ['host', 'banner', 'flag']) {
      expect(n[k].isNodeMaterial).toBe(true);
      expect(look(n[k])).toEqual(look(a[k]));
    }
  });

  it('keeps the kit’s uniforms under the GLSL’s names, following what its tick writes', () => {
    const n = both(nodes);
    for (const k of ['host', 'banner', 'flag']) {
      const u = n[k].uniforms;
      expect(Object.keys(u).sort()).toEqual(Object.keys(n.u).sort());
      for (const name of ['uTime', 'uRide', 'uCyc', 'uReach', 'uFlut']) {
        n.u[name].value = 0.25 + name.length;
        u[name].update({});
        expect(u[name].value).toBe(n.u[name].value);
      }
      for (const name of ['uCoat', 'uMane', 'uCloak', 'uPlume']) expect(u[name].array.map((c) => c.getHex())).toEqual(n.u[name].value.map((c) => c.getHex()));
    }
  });
});
