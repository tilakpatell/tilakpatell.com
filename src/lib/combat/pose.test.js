import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { basisOf, bobOf, capitalPose, fighterPose, runnerPose, hunterPose, pieceCapitalPose, playerPose, yxzBasis } from './pose.js';

// the battle scene's old orient, kept here as the reference it must equal
const oldOrient = (fwd, up, bank = 0) => {
  const vz = new THREE.Vector3(fwd.x, fwd.y, fwd.z).normalize();
  const vx = new THREE.Vector3().crossVectors(new THREE.Vector3(up.x, up.y, up.z), vz);
  if (vx.lengthSq() < 1e-8) vx.set(1, 0, 0);
  vx.normalize();
  const vy = new THREE.Vector3().crossVectors(vz, vx);
  if (bank) {
    const c = Math.cos(bank);
    const s = Math.sin(bank);
    const tmp = vx.clone().multiplyScalar(c).addScaledVector(vy, s);
    vy.multiplyScalar(c).addScaledVector(vx, -s);
    vx.copy(tmp);
  }
  return new THREE.Matrix4().makeBasis(vx, vy, vz).elements;
};
const rnd = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
const close = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 5));

describe('basisOf', () => {
  it('equals the matrix the scene made before, for random fwd, up and bank', () => {
    const r = rnd(7);
    for (let i = 0; i < 20; i++) {
      const fwd = { x: r(), y: r(), z: r() };
      const up = { x: r(), y: r(), z: r() };
      const bank = i % 4 === 0 ? 0 : r() * 2;
      const b = basisOf(fwd, up, bank);
      const m = oldOrient(fwd, up, bank);
      expect(b).toBeInstanceOf(Float32Array);
      expect(b.length).toBe(9);
      const cols = [0, 1, 2, 4, 5, 6, 8, 9, 10].map((k) => m[k]);
      close(Array.from(b), cols);
    }
  });
  it('falls back to x = (1, 0, 0) when up is along the nose', () => {
    const b = basisOf({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 });
    close(Array.from(b), [1, 0, 0, 0, 0, -1, 0, 1, 0]);
  });
});

describe('bobOf', () => {
  it('is 0 when reduced and the drawing’s sine otherwise', () => {
    expect(bobOf({ id: 3 }, 5, true)).toBe(0);
    expect(bobOf({ id: 3 }, 5, false)).toBe(Math.sin(5 * 0.3 + 3) * 0.15);
  });
});

describe('poses', () => {
  it('capitalPose rides the bob, scaled by its size', () => {
    const cap = { id: 2, pos: { x: 1, y: 2, z: 3 }, fwd: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 }, size: 40 };
    const p = capitalPose(cap, 4, false);
    const bob = bobOf(cap, 4, false);
    expect(p.at0).toEqual([1, 2 + bob, 3]);
    expect(p.at1).toEqual(p.at0);
    expect(p.scale).toBe(40);
  });
  it('fighterPose runs from prev to seen (or pos), banked about world up', () => {
    const f = { prev: { x: 0, y: 0, z: 0 }, pos: { x: 3, y: 0, z: 0 }, seen: { x: 1, y: 0, z: 0 }, fwd: { x: 1, y: 0.2, z: 0.5 }, bank: 0.4, size: 2 };
    const p = fighterPose(f);
    expect(p.at0).toEqual([0, 0, 0]);
    expect(p.at1).toEqual([1, 0, 0]);
    close(Array.from(p.basis), Array.from(basisOf(f.fwd, { x: 0, y: 1, z: 0 }, 0.4)));
    expect(fighterPose({ ...f, seen: undefined }).at1).toEqual([3, 0, 0]);
    expect(p.scale).toBe(2);
  });
  it('runnerPose has no bank', () => {
    const r = { prev: { x: 0, y: 0, z: 0 }, pos: { x: 1, y: 1, z: 1 }, fwd: { x: 0, y: 0, z: 1 }, bank: 1, size: 5 };
    close(Array.from(runnerPose(r).basis), Array.from(basisOf(r.fwd, { x: 0, y: 1, z: 0 })));
  });
  it('hunterPose’s z axis is normalize(vel), and the roll is −bank', () => {
    const h = { pos: { x: 1, y: 2, z: 3 }, vel: { x: 3, y: 1, z: -2 }, bank: 0.3, type: { size: 7 } };
    const p = hunterPose(h);
    const n = new THREE.Vector3(3, 1, -2).normalize();
    close([p.basis[6], p.basis[7], p.basis[8]], [n.x, n.y, n.z]);
    close(Array.from(p.basis), Array.from(basisOf(h.vel, { x: 0, y: 1, z: 0 }, -0.3)));
    expect(p.scale).toBe(7);
    expect(p.at1).toEqual([1, 2, 3]);
  });
  it('playerPose is the YXZ Euler of pitch, heading and −bank, nose −z', () => {
    const s = { x: 5, y: 6, z: 7, pitch: 0.3, heading: 1.1, bank: 0.5 };
    const p = playerPose(s, { x: 4, y: 6, z: 7 });
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.3, 1.1, -0.5, 'YXZ')).elements;
    close(Array.from(p.basis), [0, 1, 2, 4, 5, 6, 8, 9, 10].map((k) => m[k]));
    // the nose (−z) points where the heading goes
    const nose = [-p.basis[6], -p.basis[7], -p.basis[8]];
    const want = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0.3, 1.1, 0, 'YXZ'));
    close(nose, [want.x, want.y, want.z]);
    expect(p.at0).toEqual([4, 6, 7]);
    expect(p.at1).toEqual([5, 6, 7]);
    expect(p.scale).toBe(1);
    expect(playerPose(s, [4, 6, 7]).at0).toEqual([4, 6, 7]);
  });
});

describe('yxzBasis and pieceCapitalPose', () => {
  it('yxzBasis is three’s YXZ Euler for random angles', () => {
    const r = rnd(3);
    for (let i = 0; i < 12; i++) {
      const [p, y, z] = [r() * 3, r() * 3, r() * 3];
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(p, y, z, 'YXZ')).elements;
      close(Array.from(yxzBasis(p, y, z)), [0, 1, 2, 4, 5, 6, 8, 9, 10].map((k) => m[k]));
    }
  });
  it('pieceCapitalPose turns the unit model by (pitch, heading + π, roll) at its length, nose along forward(heading)', () => {
    const c = { at: [10, 2, -4], heading: 0.7, pitch: 0.1, roll: -0.2, len: 16 };
    const p = pieceCapitalPose(c);
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.1, 0.7 + Math.PI, -0.2, 'YXZ')).elements;
    close(Array.from(p.basis), [0, 1, 2, 4, 5, 6, 8, 9, 10].map((k) => m[k]));
    expect(p.at0).toEqual([10, 2, -4]);
    expect(p.at1).toEqual([10, 2, -4]);
    expect(p.scale).toBe(16);
    // level, the nose (+z of the model) points along forward(heading): (−sin h, 0, −cos h)
    const level = pieceCapitalPose({ at: [0, 0, 0], heading: 0.7, len: 1 });
    close([level.basis[6], level.basis[7], level.basis[8]], [-Math.sin(0.7), 0, -Math.cos(0.7)]);
  });
});
