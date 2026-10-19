import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { planet } from './space';
import { dimmer } from './dim';

describe('what fades as the jump takes it', () => {
  it('dims a planet’s light, surface and atmosphere together, and gives them back', () => {
    const world = planet({ radius: 10, strength: 1.1, tint: 0xf3dcc0 });
    const light = world.group.children.find((o) => o.isDirectionalLight);
    const atmo = world.group.children.find((o) => o.material?.uniforms?.uStrength);
    const colour = world.body.material.color.clone();
    const dim = dimmer(world.group);
    dim(0.25);
    expect(light.intensity).toBeCloseTo(2.6 * 0.25, 6);
    expect(atmo.material.uniforms.uStrength.value).toBeCloseTo(1.1 * 0.25, 6);
    expect(world.body.material.color.r).toBeCloseTo(colour.r * 0.25, 6);
    dim(1);
    expect(light.intensity).toBeCloseTo(2.6, 6);
    expect(atmo.material.uniforms.uStrength.value).toBeCloseTo(1.1, 6);
    expect(world.body.material.color.equals(colour)).toBe(true);
  });

  it('dims a glow too, and a material shared by two meshes once', () => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x808080, emissive: 0xffffff, emissiveIntensity: 0.8 });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(), mat), new THREE.Mesh(new THREE.BoxGeometry(), mat));
    const before = mat.color.r;
    dimmer(g)(0.5);
    expect(mat.emissiveIntensity).toBeCloseTo(0.4, 6);
    expect(mat.color.r).toBeCloseTo(before * 0.5, 6);
  });

  it('takes a light given on its own, and nothing at all', () => {
    const l = new THREE.DirectionalLight(0xffffff, 2);
    dimmer(l, null)(0);
    expect(l.intensity).toBe(0);
  });
});
