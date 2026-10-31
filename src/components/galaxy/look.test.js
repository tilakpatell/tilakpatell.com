import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LOOK, keyLight, kickerDir } from './look';

const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

describe('galaxy look', () => {
  it('lifts a low sun to the key’s least height, its bearing kept, and cools its light at the same luminance', () => {
    const sun = new THREE.Color('#fff4e2').multiplyScalar(1.25);
    const { dir, colour } = keyLight([0.68, 0.36, 0.64], sun);
    expect((Math.asin(dir.y) * 180) / Math.PI).toBeCloseTo(LOOK.space.key.least, 1);
    expect(Math.atan2(dir.z, dir.x)).toBeCloseTo(Math.atan2(0.64, 0.68), 6);
    expect(dir.length()).toBeCloseTo(1, 6);
    expect(colour.b).toBeGreaterThanOrEqual(colour.r);
    expect(lum(colour) / lum(sun)).toBeCloseTo(1, 2);
    // (the sun as it came: not changed)
    expect(sun.r).toBeGreaterThan(sun.b);
  });

  it('leaves a sun already high where it is', () => {
    const high = new THREE.Vector3(0.3, Math.sin(Math.PI / 3), 0.2).normalize();
    expect(keyLight(high, '#ffffff').dir.angleTo(high)).toBeLessThan(1e-6);
  });

  it('keeps the key under the post pass’s shoulder for a white hull square to it, and the kicker dim, cool and from the far side below', () => {
    expect(LOOK.space.key.intensity).toBeLessThanOrEqual(3.4);
    const kicker = new THREE.Color(LOOK.space.kicker.colour);
    expect(kicker.b).toBeGreaterThan(kicker.r);
    expect(LOOK.space.kicker.intensity).toBeLessThan(LOOK.space.key.intensity / 4);
    const d = kickerDir([0.68, 0.36, 0.64]);
    expect(d.y).toBeLessThan(0);
    expect(d.dot(new THREE.Vector3(0.68, 0, 0.64))).toBeLessThan(0);
    // (the shade a neutral grey, not navy)
    const amb = new THREE.Color(LOOK.space.ambient);
    expect(amb.b / amb.r).toBeLessThan(1.4);
  });
});
