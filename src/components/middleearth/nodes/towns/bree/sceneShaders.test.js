import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../../towns/bree/sceneShaders';
import * as nodes from './sceneShaders';
import { NAZGUL } from '../../../towns/bree/story';

const plain = (v) => (v?.toArray ? v.toArray() : v);

describe('nodes/towns/bree/sceneShaders, the twin of the Nazgûl’s sight', () => {
  it('exports what the GLSL module exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes a node material a Rider whose uniforms carry the GLSL’s names and values', () => {
    for (const i of [0, 1]) {
      const a = glsl.sightMaterial(NAZGUL, i);
      const n = nodes.sightMaterial(NAZGUL, i);
      expect(n.isNodeMaterial).toBe(true);
      expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
      for (const k of Object.keys(n.uniforms)) expect(plain(n.uniforms[k].value), k).toEqual(plain(a.uniforms[k].value));
      expect([n.transparent, n.depthWrite, n.side, n.fog, n.toneMapped]).toEqual([true, false, THREE.DoubleSide, false, false]);
    }
  });
});
