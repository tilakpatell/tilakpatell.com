import { describe, expect, it } from 'vitest';
import * as glsl from '../glsl/saber';
import * as nodes from './saber';

// The duel’s two shaders as nodes, against the GLSL ones: the same names
// and flags.
const FLAGS = ['name', 'transparent', 'depthWrite', 'depthTest', 'blending', 'side', 'premultipliedAlpha', 'toneMapped', 'fog'];

describe('the duel’s shaders as nodes', () => {
  for (const k of ['bladeGlowMaterial', 'trailMaterial']) {
    it(`${k} keeps the GLSL one’s name and flags`, () => {
      const o = glsl[k]();
      const n = nodes[k]();
      expect(n.isNodeMaterial).toBe(true);
      for (const f of FLAGS) expect([f, n[f]]).toEqual([f, o[f]]);
      expect(Object.keys(n.uniforms ?? {})).toEqual(Object.keys(o.uniforms));
    });
  }
});
