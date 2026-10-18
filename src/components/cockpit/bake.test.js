import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sky } from './space';
import { isNebula } from './bake';

// (the bake finds a sky's nebula by its uniforms, space.js being a GLSL
// original that isn't edited: this holds the two together)
describe('the nebula a cockpit bakes once', () => {
  it('is found in every sky space.js makes, and nothing else in it', () => {
    const s = sky({ count: 10 });
    const found = [];
    s.group.traverse((o) => isNebula(o) && found.push(o));
    expect(found).toHaveLength(1);
    expect(found[0].material.side).toBe(THREE.BackSide);
    expect(found[0].renderOrder).toBe(-10);
  });

  it('still answers to the fade the sky is told', () => {
    const s = sky({ count: 10 });
    let dome = null;
    s.group.traverse((o) => isNebula(o) && (dome = o));
    s.set({ fade: 0.25 });
    expect(dome.material.uniforms.uFade.value).toBe(0.25);
  });

  it('is never a plain mesh, a star field or nothing', () => {
    expect(isNebula(null)).toBe(false);
    expect(isNebula(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()))).toBe(false);
    expect(isNebula(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial({ uniforms: { uFade: { value: 1 } } })))).toBe(false);
  });
});
