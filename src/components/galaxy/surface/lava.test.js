import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createLava } from './lava';
import { bakeLavaField } from './lavaRules';

const sun = new THREE.Vector3(0.3, 0.8, 0.2).normalize();
const site = { sky: { horizon: '#b4441c' }, water: { level: 2.5, color: '#ff3c06', deep: '#240703', kind: 'lava', glow: 2.1 } };
const field = bakeLavaField((x) => (x < 0 ? -3 : 4), () => 2.5, { half: 64, n: 16 });

describe('the lava, drawn', () => {
  it('a world of it is one plane at its level, out to the horizon', () => {
    const l = createLava({ site, lava: { level: 2.5, pools: [] }, field, sunDir: sun, sunColor: '#ffb27a' });
    const planes = l.mesh.children;
    expect(planes).toHaveLength(1);
    expect(planes[0].position.y).toBe(2.5);
    planes[0].geometry.computeBoundingBox();
    expect(planes[0].geometry.boundingBox.max.x).toBeGreaterThan(5000);
    expect(l.glow.isHemisphereLight).toBe(true);
    l.dispose();
  });

  it('pools are a disc each, at their own level, lit by a light of their own', () => {
    const pools = [{ x: 300, z: 260, r: 22, level: 7.5 }, { x: 270, z: 280, r: 13, level: 8.2 }];
    const l = createLava({ site: { ...site, water: null }, lava: { level: null, pools }, field, sunDir: sun, sunColor: '#ffe2c0' });
    expect(l.mesh.children).toHaveLength(2);
    expect(l.mesh.children[1].position.toArray()).toEqual([270, 8.2, 280]);
    const lights = l.glow.children.filter((c) => c.isPointLight);
    expect(lights).toHaveLength(2);
    expect(lights[0].position.y).toBeGreaterThan(7.5);
    l.dispose();
  });

  it('has a crust of plates with fire in the cracks, crusting at the banks, in the fog', () => {
    const l = createLava({ site, lava: { level: 2.5, pools: [] }, field, sunDir: sun, sunColor: '#ffb27a' });
    const m = l.mesh.children[0].material;
    expect(m.fragmentShader).toContain('worley(');
    expect(m.fragmentShader).toContain('blackbody(');
    expect(m.fragmentShader).toContain('uField');
    expect(m.fragmentShader).toContain('#include <fog_fragment>');
    expect(m.uniforms.uField.value.image.width).toBe(16);
    l.dispose();
  });

  it('flows: its clock moves with update', () => {
    const l = createLava({ site, lava: { level: 2.5, pools: [] }, field, sunDir: sun, sunColor: '#ffb27a' });
    l.update(12.5);
    expect(l.mesh.children[0].material.uniforms.uTime.value).toBe(12.5);
    l.dispose();
  });

  it('a lighter version on a small screen', () => {
    const l = createLava({ site, lava: { level: 2.5, pools: [] }, field, sunDir: sun, sunColor: '#ffb27a', small: true });
    expect(l.mesh.children[0].material.defines.LITE).toBe(1);
    l.dispose();
  });
});
