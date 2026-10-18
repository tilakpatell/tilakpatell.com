import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from '../../towns/wraithsShaders';
import * as nodes from './wraithsShaders';

// the kit's uniforms (wraiths.js's U), fresh for each side
const holders = () => ({
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector3(0.05, 0, 0.03) },
  uTorn: { value: new THREE.Texture() },
  uTear: { value: new THREE.Vector2(0.3, 0.5) },
  uRimColor: { value: new THREE.Color(0.6, 0.7, 0.9) },
  uRim: { value: 0.17 },
  uInner: { value: 0.42 },
  uRing: { value: 0 },
  uGhost: { value: new THREE.Color(0.78, 0.83, 0.9) },
});
const make = (M) => {
  const U = holders();
  const t = {
    weave: new THREE.Texture(),
    weaveN: new THREE.Texture(),
    env: new THREE.Texture(),
  };
  return { U, ...M.wraithMaterials(U, t) };
};
const PROPS = ['side', 'transparent', 'opacity', 'visible', 'alphaTest', 'roughness', 'metalness', 'envMapIntensity', 'depthWrite'];
const look = (m) => ({
  ...Object.fromEntries(PROPS.map((k) => [k, m[k]])),
  color: m.color?.getHex(),
  emissive: m.emissive?.getHex(),
  env: Boolean(m.envMap),
  map: Boolean(m.map),
  normalMap: Boolean(m.normalMap),
});

describe('nodes/towns/wraithsShaders, the twin of the Nazgûl’s materials', () => {
  it('exports what the original exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes node materials, each as the classic one is set', () => {
    const a = make(glsl);
    const n = make(nodes);
    expect(Object.keys(n.mats).sort()).toEqual(Object.keys(a.mats).sort());
    for (const k of Object.keys(a.mats)) {
      expect(n.mats[k].isNodeMaterial).toBe(true);
      expect(n.mats[k].type.replace('Node', '')).toBe(a.mats[k].type);
      expect(look(n.mats[k])).toEqual(look(a.mats[k]));
    }
    expect(n.mats.cloth.name).toBe(a.mats.cloth.name);
  });

  it('keeps the kit’s uniforms under the GLSL’s names, following what the kit writes', () => {
    const n = make(nodes);
    const u = n.mats.cloth.uniforms;
    expect(Object.keys(u).sort()).toEqual(Object.keys(holders()).sort());
    for (const k of Object.keys(u)) {
      expect(u[k].isNode).toBe(true);
      if (k !== 'uTorn') expect(u[k].value).toEqual(n.U[k].value);
    }
    expect(u.uTorn.value).toBe(n.U.uTorn.value);
    // (what the kit's tick writes, read when the frame's drawn)
    n.U.uTime.value = 4.5;
    n.setRing(0.7);
    for (const k of ['uTime', 'uRing']) {
      u[k].update({});
      expect(u[k].value).toBe(n.U[k].value);
    }
  });

  it('turns the Ring on and off the same', () => {
    const a = make(glsl);
    const n = make(nodes);
    for (const r of [0, 0.5, 1, 0.001]) {
      a.setRing(r);
      n.setRing(r);
      expect(n.U.uRing.value).toBe(a.U.uRing.value);
      for (const k of Object.keys(a.mats)) expect(look(n.mats[k])).toEqual(look(a.mats[k]));
    }
  });
});
