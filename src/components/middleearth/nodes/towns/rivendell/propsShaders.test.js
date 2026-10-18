import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../../towns/rivendell/propsShaders';
import * as nodes from './propsShaders';

const valueOf = (v) => (v?.toArray ? v.toArray() : v);
const own = (u) =>
  Object.keys(u)
    .filter((k) => k.startsWith('u'))
    .sort();

describe('nodes/towns/rivendell/propsShaders, the twin of the falls’ shaders', () => {
  it('exports what the original exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('shares uniform nodes under the GLSL’s names and values', () => {
    const a = glsl.waterfallUniforms();
    const n = nodes.waterfallUniforms();
    expect(Object.keys(n).sort()).toEqual(own(a));
    for (const k of Object.keys(n)) {
      expect(n[k].isNode, k).toBe(true);
      expect(valueOf(n[k].value), k).toEqual(valueOf(a[k].value));
    }
  });

  it('makes node materials with the GLSL’s uniforms, sharing the kit’s', () => {
    const map = new THREE.Texture();
    const U = glsl.waterfallUniforms();
    const N = nodes.waterfallUniforms();
    const make = [(P, u) => P.fallMaterial(u), (P, u) => P.mistMaterial(u, map), (P, u) => P.foamMaterial(u, 4)];
    for (const f of make) {
      const a = f(glsl, U);
      const n = f(nodes, N);
      expect(n.isNodeMaterial).toBe(true);
      expect(Object.keys(n.uniforms).sort()).toEqual(own(a.uniforms));
      for (const k of Object.keys(n.uniforms)) {
        const v = a.uniforms[k].value;
        if (v?.isTexture) expect(n.uniforms[k].value).toBe(map);
        else {
          expect(n.uniforms[k], k).toBe(N[k]);
          expect(valueOf(n.uniforms[k].value), k).toEqual(valueOf(v));
        }
      }
      // (fog as the GLSL had it, tone mapped as its chunk was)
      expect([n.transparent, n.depthWrite, n.side, n.fog, n.toneMapped]).toEqual([a.transparent, a.depthWrite, a.side, true, true]);
    }
  });

  it('follows a plain { value } handed in instead', () => {
    const U = glsl.waterfallUniforms();
    const n = nodes.fallMaterial(U);
    U.uTime.value = 7;
    n.uniforms.uTime.update({});
    expect(n.uniforms.uTime.value).toBe(7);
  });
});
