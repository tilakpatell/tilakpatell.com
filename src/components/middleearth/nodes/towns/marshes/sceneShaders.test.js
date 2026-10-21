import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../../towns/marshes/sceneShaders';
import * as nodes from './sceneShaders';

const water = () => ({
  uniforms: {
    uSky: { value: new THREE.Color(0.3, 0.35, 0.3) },
    uDeep: { value: new THREE.Color(0.02, 0.03, 0.02) },
  },
});
const plain = (v) => (v?.toArray ? v.toArray() : v);

describe('nodes/towns/marshes/sceneShaders, the twin of the marsh’s water', () => {
  it('exports what the GLSL module exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes a node material whose uniforms carry the GLSL’s names and values', () => {
    const w = water();
    const a = glsl.marshMaterial(w);
    const n = nodes.marshMaterial(w);
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.uniforms).sort()).toEqual(
      Object.keys(a.uniforms)
        .filter((k) => k.startsWith('u'))
        .sort(),
    );
    for (const k of Object.keys(n.uniforms)) expect(plain(n.uniforms[k].value), k).toEqual(plain(a.uniforms[k].value));
    expect([n.fog, n.toneMapped, n.transparent]).toEqual([true, false, false]);
  });

  it('follows the town’s water, which the sky writes', () => {
    const w = water();
    const n = nodes.marshMaterial(w);
    w.uniforms.uDeep.value = new THREE.Color(0.5, 0.5, 0.5);
    n.uniforms.uDeep.update({});
    expect(n.uniforms.uDeep.value.toArray()).toEqual([0.5, 0.5, 0.5]);
  });
});
