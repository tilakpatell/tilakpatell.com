import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeSteve, stride } from './others';

describe('a Steve for the others online', () => {
  it('stands a player’s height, in six boxes, feet at naught, looking along +z', () => {
    const f = makeSteve();
    const box = new THREE.Box3().setFromObject(f.group);
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(box.max.y).toBeCloseTo(1.8, 2);
    expect(f.top).toBeCloseTo(1.8, 2);
    let meshes = 0;
    f.group.traverse((o) => o.isMesh && meshes++);
    expect(meshes).toBe(6);
    // (his face, the head's front, is on +z)
    expect(f.face.position.z).toBeGreaterThan(0);
    f.dispose();
  });

  it('swings his arms and legs against each other as he walks, and stands still when he stops', () => {
    const f = makeSteve();
    stride(f, 0.2, { moving: true, motion: null, speed: 4.3 });
    expect(f.legs[0].rotation.x).toBeCloseTo(-f.legs[1].rotation.x, 6);
    expect(f.arms[0].rotation.x).toBeCloseTo(-f.legs[0].rotation.x, 6);
    expect(Math.abs(f.legs[0].rotation.x)).toBeGreaterThan(0.1);
    for (let i = 0; i < 60; i++) stride(f, 0.2 + i / 60, { moving: false }, 1 / 60);
    expect(Math.abs(f.legs[0].rotation.x)).toBeLessThan(0.02);
    f.dispose();
  });
});

describe('the light they wear', () => {
  it('lights the ghosts alone (every block is its own light), as the day lights the world', async () => {
    const { ghostLight, lightGhosts } = await import('./others');
    const l = ghostLight();
    expect(l.isHemisphereLight).toBe(true);
    lightGhosts(l, 1);
    const noon = l.intensity;
    lightGhosts(l, 0);
    expect(l.intensity).toBeLessThan(noon);
    // (never quite out: a ghost at night is still a pale figure, as the towns' are by their lamps)
    expect(l.intensity).toBeGreaterThan(0);
    l.dispose();
  });
});
