import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sky } from './space';
import { cubeTurn, isNebula } from './bake';

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

  it('is read turned as the dome has turned since it was baked (the RV tilts its sky)', () => {
    const at = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -0.4, 0.05));
    const now = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0.3, 0.12, 'YXZ'));
    const e = cubeTurn(at.clone().invert(), now);
    // three's uniform: the inverse of the rotation envMapRotation names
    const read = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(e)).transpose();
    const d = new THREE.Vector3(0.3, 0.5, -0.8).normalize();
    // where the dome's own shader would look (its local direction now), as
    // a world direction at the bake
    const want = d.clone().applyQuaternion(now.clone().invert()).applyQuaternion(at);
    const got = d.clone().applyMatrix3(read);
    expect(got.distanceTo(want)).toBeLessThan(1e-6);
    // and unturned, nothing moves
    const still = cubeTurn(at.clone().invert(), at);
    expect(Math.abs(still.x) + Math.abs(still.y) + Math.abs(still.z)).toBeLessThan(1e-6);
  });
});
