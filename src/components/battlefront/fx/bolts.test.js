import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CATCH_UP, CONVERGE, STREAK, createBolts, drawnBolt } from './bolts.js';

// a sim bolt as the view gives one: fired from the eye along +Z, first seen
// a step out (700 m/s × 0.05 s), the gun 0.3 m to the side and below
const from = [0, 1.4, 0];
const dir = [0, 0, 1];
const bolt = (travelled) => ({ id: 1, owner: 'a', from, dir, at: [0, 1.4, travelled], travelled, speed: 700, colour: 'red' });
const muzzle = [-0.3, 1.3, 0.4];
const len = 700 * STREAK;
const close = (a, b, eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe('a bolt drawn from the gun', () => {
  it('ends where the sim’s stopped, a wall nearer than the converge distance, from the muzzle', () => {
    const b = { ...bolt(8), ended: true };
    expect(close(drawnBolt(b, { muzzle, age: 0, first: 8 }).head, muzzle)).toBe(true);
    const { head } = drawnBolt(b, { muzzle, age: CATCH_UP, first: 8 });
    expect(close(head, b.at)).toBe(true);
  });

  it('leaves the muzzle the frame it is first seen, though the sim has it a step out', () => {
    const { head, tail } = drawnBolt(bolt(35), { muzzle, age: 0, first: 35 });
    expect(close(head, muzzle)).toBe(true);
    expect(close(tail, muzzle)).toBe(true);
  });

  it('is on the sim’s line once caught up and past the converge distance', () => {
    const b = bolt(35 + 700 * CATCH_UP);
    const { head, tail } = drawnBolt(b, { muzzle, age: CATCH_UP, first: 35 });
    expect(close(head, b.at)).toBe(true);
    expect(close(tail, [0, 1.4, b.travelled - len])).toBe(true);
  });

  it('slides from the gun onto the line within the converge distance, never behind the muzzle', () => {
    let last = Infinity;
    for (const age of [0.005, 0.01, 0.02, 0.04]) {
      const b = bolt(35 + 700 * age);
      const { head, tail } = drawnBolt(b, { muzzle, age, first: 35 });
      const off = Math.hypot(head[0], head[1] - 1.4);
      expect(off).toBeLessThanOrEqual(last);
      last = off;
      expect(tail[2]).toBeGreaterThanOrEqual(muzzle[2] - 1e-9);
      if (head[2] - from[2] >= CONVERGE) expect(off).toBeLessThan(1e-9);
    }
    expect(CONVERGE).toBe(15);
  });

  it('starts from the sim’s own start without a gun to leave', () => {
    const { head } = drawnBolt(bolt(35), { muzzle: null, age: 0, first: 35 });
    expect(close(head, from)).toBe(true);
  });
});

describe('the bolts’ mesh', () => {
  it('anchors each bolt at its owner’s muzzle when first seen, and lets go of it when gone', () => {
    const scene = new THREE.Scene();
    const bolts = createBolts(scene);
    let at = new THREE.Vector3(...muzzle);
    const asked = [];
    const muzzleOf = (id, out) => (asked.push(id), out.copy(at));
    bolts.update([bolt(35)], { muzzleOf, now: 10 });
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    bolts.mesh.getMatrixAt(0, m);
    p.setFromMatrixPosition(m);
    expect(p.distanceTo(new THREE.Vector3(...muzzle))).toBeLessThan(1e-6);
    expect(asked).toEqual(['a']);
    // (the gun moves on; the bolt doesn't follow it)
    at = new THREE.Vector3(9, 9, 9);
    bolts.update([bolt(35 + 700 * 0.2)], { muzzleOf, now: 10.2 });
    expect(asked).toEqual(['a']);
    bolts.mesh.getMatrixAt(0, m);
    p.setFromMatrixPosition(m);
    expect(p.z).toBeCloseTo(35 + 140 - len / 2, 6);
    expect(bolts.count()).toBe(1);
    bolts.update([], { muzzleOf, now: 10.3 });
    expect(bolts.mesh.count).toBe(0);
    expect(bolts.count()).toBe(0);
    bolts.dispose();
  });

  it('still draws a bare list as the sim gives it (no owner, no muzzle)', () => {
    const scene = new THREE.Scene();
    const bolts = createBolts(scene);
    bolts.update([{ at: [0, 1, 50], dir: [0, 0, 1], colour: 'blue' }]);
    const m = new THREE.Matrix4();
    bolts.mesh.getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).z).toBeCloseTo(50 - len / 2, 6);
    bolts.dispose();
  });
});
