import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../glsl/saber';
import * as nodes from './saber';
import { createSabers } from '../saber';
import { buildShaders } from './fixtures/build';

// The duel’s two shaders as nodes, against the GLSL ones: the same names
// and flags, and saber.js drawing with them, each built whole.
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

  it('is what saber.js draws with, each mesh building its shaders whole', () => {
    const scene = new THREE.Scene();
    const sabers = createSabers(scene, { tier: 'low' });
    const byName = Object.fromEntries(sabers.meshes.map((m) => [m.name, m]));
    expect(byName['saber-sprites'].material.name).toBe('ds-saber-glow');
    expect(byName['saber-trails'].material.name).toBe('ds-trail');
    for (const name of ['saber-sprites', 'saber-trails']) {
      const { vertex, fragment } = buildShaders(byName[name], { scene });
      expect(vertex).toMatch(/fn main/);
      expect(fragment).toMatch(/fn main/);
    }
    // (a ripple’s band rides in the sprite’s size; the trail fades by its edge)
    expect(buildShaders(byName['saber-sprites'], { scene }).vertex).toMatch(/aSize/);
    expect(buildShaders(byName['saber-trails'], { scene }).vertex).toMatch(/aEdge/);
    sabers.dispose();
  });
});
