import { describe, expect, it } from 'vitest';
import * as glsl from '../bodyShaders';
import * as nodes from './bodyShaders';
import { FAMILY_SURFACES } from './bodyFamilies';
import { FAMILIES, LOOKS, buildBody } from './bodies';

// (the GLSL’s strings have no twin of their own: the node material draws
// its own vertex stage, and the noise and the march are the lib’s twins)
const STRINGS = ['NOISE', 'ATMO', 'SHELL_FRAG', 'SHELL_VERT', 'SURFACE_VERT', 'SURFACE_HEAD', 'CLOUDS', 'SHIELD_FRAG', 'SHIELD_VERT'];

describe('nodes/bodyShaders, the twin of ../bodyShaders', () => {
  it('has the original’s function, the shield’s colour and the lib’s twins of what it re-exported', () => {
    const kept = Object.keys(glsl).filter((k) => !STRINGS.includes(k));
    expect(kept).toEqual(['surfaceFrag']);
    expect(Object.keys(nodes).sort()).toEqual(['inscatter', 'noiseWith', 'shieldFrag', 'surfaceFrag']);
  });

  it('has a ground for every family bodies.js names', () => {
    expect(Object.keys(FAMILY_SURFACES).sort()).toEqual(Object.keys(FAMILIES).sort());
  });

  it('makes a colour node for every look’s surface (its skin where it wears one) and for the shield', () => {
    for (const id of Object.keys(LOOKS)) {
      const b = buildBody(id, { r: 30, tier: 'ultra' });
      const m = b.surface.material;
      expect(m.colorNode?.isNode, id).toBe(true);
      const again = nodes.surfaceFrag(LOOKS[id].family, FAMILIES[LOOKS[id].family].slots, { skin: 'SKIN' in m.defines, uniforms: m.uniforms, defines: m.defines });
      expect(again.isNode, id).toBe(true);
      b.dispose();
    }
    const s = buildBody('scarif', { r: 30 });
    expect(s.group.children.at(-1).material.colorNode.isNode).toBe(true);
  });
});
