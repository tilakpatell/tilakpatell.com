import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SWING, applySway, swayOf } from './wind.js';

describe('swayOf', () => {
  it('a stiff light twig sways quicker than a soft heavy frond', () => {
    const twig = swayOf({ scale: 0.05, stiffness: 22.551, damping: 0.879, mass: 0.1, wiggle: 1 });
    const fern = swayOf({ scale: 0.2, stiffness: 8, damping: 0.7, mass: 4, wiggle: 0.3 });
    expect(twig.trunkHz).toBeGreaterThan(fern.trunkHz);
    // (√(22.551 / 0.1) / 2π: about 2.4 Hz)
    expect(twig.trunkHz).toBeCloseTo(2.39, 1);
    expect(twig.leaf).toBeGreaterThan(fern.leaf);
  });
  it('the wind pushes by WindScale, the damping bounding the swing; no WindScale, no sway', () => {
    const a = swayOf({ scale: 0.2, stiffness: 8, damping: 0.7, mass: 1 });
    const b = swayOf({ scale: 0.4, stiffness: 8, damping: 0.7, mass: 1 });
    expect(b.strength).toBeCloseTo(a.strength * 2, 4);
    const loose = swayOf({ scale: 0.2, stiffness: 8, damping: 0.0001, mass: 1 });
    expect(loose.strength).toBeLessThanOrEqual(0.2 * 0.4 * SWING.max + 1e-9);
    expect(swayOf({ scale: 0, stiffness: 8, damping: 1.6 })).toBeNull();
    expect(swayOf(null)).toBeNull();
  });
});

describe('applySway', () => {
  it('puts the house’s sway on a classic material, driven by the world’s clock', async () => {
    const time = { value: 0 };
    const m = await applySway(new THREE.MeshStandardMaterial(), swayOf({ scale: 0.2, stiffness: 8, damping: 0.7, mass: 1, wiggle: 0.3 }), { time, dir: new THREE.Vector2(1, 0) });
    expect(m.userData.wind.uWindTime).toBe(time);
    expect(m.userData.wind.uWindStrength.value).toBeGreaterThan(0);
  });
  it('on a node renderer, the same sway through lane T’s twin, as its node material', async () => {
    const m = await applySway(new THREE.MeshStandardMaterial(), swayOf({ scale: 0.2, stiffness: 8, damping: 0.7, mass: 1, wiggle: 0.3 }), { time: { value: 0 }, dir: new THREE.Vector2(1, 0), nodes: true });
    expect(m.isNodeMaterial).toBe(true);
    expect(m.userData.wind).toBeTruthy();
  });
  it('leaves a material that does not sway alone', async () => {
    const m = new THREE.MeshStandardMaterial();
    expect(await applySway(m, null, { time: { value: 0 } })).toBe(m);
  });
});
