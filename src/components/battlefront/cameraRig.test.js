import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { camerasOf, loadRulebook } from '../../lib/battlefront/rulebook.js';
import { SHOULDER, WALL_CLEAR } from '../../lib/three/camera/soldier.js';
import { createCameraRig } from './cameraRig.js';

const rows = camerasOf(loadRulebook());
const body = { at: [0, 0, 0], stance: 'stand' };
const settle = (rig, opts, n = 240) => {
  let pose = null;
  for (let i = 0; i < n; i++) pose = rig.soldier(body, { yaw: 0, pitch: 0 }, { dt: 1 / 60, ...opts });
  return pose;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('lane C’s camera stack under the game’s world', () => {
  it('stands the camera the record’s arm behind the pivot, on the right shoulder', () => {
    const rig = createCameraRig(new THREE.PerspectiveCamera(), rows);
    const p = settle(rig, {});
    // (C's arm runs from the pivot to the camera, the shoulder's step in it)
    expect(p.arm).toBeCloseTo(Math.hypot(rows.soldier.arm, SHOULDER), 3);
    expect(p.at[2]).toBeLessThan(0);
    // (yaw 0 looks down +Z; the right is −X)
    expect(p.at[0]).toBeLessThan(0);
  });

  it('swaps the shoulder', () => {
    const rig = createCameraRig(new THREE.PerspectiveCamera(), rows);
    expect(rig.side()).toBe(1);
    expect(rig.swapShoulder()).toBe(-1);
    expect(settle(rig, {}).at[0]).toBeGreaterThan(0);
  });

  it('draws the arm in to a wall the cast meets and never past it, and lifts it off the floor', () => {
    const rig = createCameraRig(new THREE.PerspectiveCamera(), rows);
    const wall = 1.2;
    const p = settle(rig, { castArm: () => wall });
    expect(p.arm).toBeLessThanOrEqual(wall - WALL_CLEAR + 1e-9);
    const floor = settle(createCameraRig(new THREE.PerspectiveCamera(), rows), { floorAt: () => 3 });
    expect(floor.at[1]).toBeGreaterThanOrEqual(3);
  });

  it('narrows the field to the weapon’s zoom row when aiming, from the cameras’ rows', () => {
    const rig = createCameraRig(new THREE.PerspectiveCamera(), rows);
    const p = settle(rig, { aiming: true, weaponId: 'e11' });
    expect(p.fov).toBeCloseTo(rows.aim.e11[0].fov, 3);
    expect(settle(rig, { aiming: false, weaponId: 'e11' }).fov).toBeCloseTo(70, 3);
  });

  it('puts the pose on three’s camera through C’s rig, the recoil sprung back', () => {
    const camera = new THREE.PerspectiveCamera();
    const rig = createCameraRig(camera, rows);
    rig.set({ at: [1, 2, 3], lookAt: [1, 2, 13], fov: 60 });
    rig.update(1 / 60);
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
    expect(camera.fov).toBe(60);
    rig.kick(0.05);
    rig.update(1 / 60);
    expect(rig.state().recoil).not.toBe(0);
    for (let i = 0; i < 120; i++) rig.update(1 / 60);
    expect(Math.abs(rig.state().recoil)).toBeLessThan(1e-3);
    expect(dist(rig.listener().position, [1, 2, 3])).toBeLessThan(1e-6);
  });
});
