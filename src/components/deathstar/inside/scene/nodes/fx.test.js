import { describe, expect, it } from 'vitest';
import * as glsl from '../glsl/fx';
import * as nodes from './fx';

// The fight’s three shaders as nodes, against the GLSL ones: the same
// names and flags (the blend, the premultiplied colour, the scorch’s pull
// towards the eye).
const FLAGS = ['name', 'transparent', 'depthWrite', 'depthTest', 'blending', 'side', 'premultipliedAlpha', 'toneMapped', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'fog'];

describe('the fight’s effects as nodes', () => {
  for (const k of ['spriteMaterial', 'puffMaterial', 'scorchMaterial']) {
    it(`${k} keeps the GLSL one’s name and flags`, () => {
      const o = glsl[k]();
      const n = nodes[k]();
      expect(n.isNodeMaterial).toBe(true);
      for (const f of FLAGS) expect([f, n[f]]).toEqual([f, o[f]]);
      expect(Object.keys(n.uniforms ?? {})).toEqual(Object.keys(o.uniforms));
    });
  }

  it('leaves its premultiplied colours as the shader made them, as the GLSL’s blend took them', () => {
    for (const m of [nodes.puffMaterial(), nodes.scorchMaterial()]) {
      const out = { isNode: true };
      expect(m.setupPremultipliedAlpha(null, out)).toBe(out);
    }
  });
});
