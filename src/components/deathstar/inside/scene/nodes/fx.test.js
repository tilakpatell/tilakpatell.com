import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../glsl/fx';
import * as nodes from './fx';
import { createFx } from '../fx';
import { buildShaders } from './fixtures/build';

// The fight’s three shaders as nodes, against the GLSL ones: the same
// names and flags (the blend, the premultiplied colour, the scorch’s pull
// towards the eye), node materials built whole, and fx.js drawing with them.
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

  it('is what fx.js draws with, each mesh building its shaders whole', () => {
    const scene = new THREE.Scene();
    const fx = createFx(scene);
    const names = fx.meshes.map((m) => m.material.name);
    expect(names).toEqual(['ds-bolt', 'ds-glow', 'ds-puff', 'ds-scorch']);
    for (const mesh of fx.meshes.slice(1)) {
      expect(mesh.material.isNodeMaterial).toBe(true);
      const { vertex, fragment } = buildShaders(mesh, { scene });
      expect(vertex).toMatch(/fn main/);
      expect(fragment).toMatch(/fn main/);
    }
    // (the sprites and the puffs read their places per instance; a sprite outside its glow is let go)
    expect(buildShaders(fx.meshes[1], { scene }).vertex).toMatch(/aAt/);
    expect(buildShaders(fx.meshes[1], { scene }).fragment).toMatch(/discard/);
    expect(buildShaders(fx.meshes[3], { scene }).vertex).toMatch(/aBurn/);
    fx.dispose();
  });
});
