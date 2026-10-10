import { describe, expect, it } from 'vitest';
import { camerasOf, loadRulebook, mapOf } from '../../lib/battlefront/rulebook.js';
import { FOV_DEFAULT, OVERVIEW_FOV, overviewPose, soldierPose, vehiclePose } from './camera.js';

const rb = loadRulebook();
const cam = camerasOf(rb);
const body = { at: [0, 0, 0], stance: 'stand' };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// the pose settled: the same input held for a few seconds
function settle(opts, steps = 200) {
  let prev = null;
  for (let i = 0; i < steps; i++) prev = soldierPose(body, cam, { dt: 1 / 60, ...opts, prev });
  return prev;
}

describe('the soldier’s camera, from the trooper’s records', () => {
  it('puts the camera the arm’s length behind the pivot at pitch 0', () => {
    const p = settle({ yaw: 0, pitch: 0 });
    expect(p.arm).toBeCloseTo(cam.soldier.arm, 3);
    expect(p.at[2]).toBeLessThan(p.pivot[2]);
    expect(dist(p.at, p.pivot)).toBeGreaterThan(cam.soldier.arm);
  });

  it('shortens the arm toward the reduced length as the pitch steepens, clamped to the max pitch', () => {
    const p = settle({ yaw: 0, pitch: (60 * Math.PI) / 180 });
    expect(p.arm).toBeGreaterThan(0.5 * cam.soldier.arm);
    expect(p.arm).toBeLessThan(cam.soldier.arm);
    expect(p.pitch).toBeCloseTo((cam.soldier.maxPitch * Math.PI) / 180, 6);
  });

  it('pulls in to a wall at 0.6 m less the padding, at the record’s blend-in rate, and out at the blend-out', () => {
    const castArm = () => 0.6;
    const free = settle({ yaw: 0, pitch: 0 });
    const one = soldierPose(body, cam, { yaw: 0, pitch: 0, dt: 0.1, prev: free, castArm });
    const target = 0.6 - cam.soldier.collision.padding;
    const gap = free.arm - target;
    // never past the wall, then eased the rest of the way in at the record's rate
    expect(gap).toBeGreaterThan(0);
    expect(one.arm).toBeLessThanOrEqual(0.6 + 1e-9);
    const two = soldierPose(body, cam, { yaw: 0, pitch: 0, dt: 0.1, prev: one, castArm });
    expect(one.arm - two.arm).toBeCloseTo((one.arm - target) * cam.soldier.collision.blendIn * 0.1, 3);
    const held = settle({ yaw: 0, pitch: 0, castArm });
    expect(held.arm).toBeCloseTo(target, 3);
    const back = soldierPose(body, cam, { yaw: 0, pitch: 0, dt: 0.1, prev: held });
    expect(back.arm - held.arm).toBeCloseTo((free.arm - target) * cam.soldier.collision.blendOut * 0.1, 3);
  });

  it('eases the field of view to the weapon’s sights while aiming, and back', () => {
    expect(settle({ yaw: 0, pitch: 0 }).fov).toBeCloseTo(FOV_DEFAULT, 3);
    expect(settle({ yaw: 0, pitch: 0, aiming: true, weaponId: 'a280c' }).fov).toBeCloseTo(cam.aim.a280c[0].fov, 3);
    const half = soldierPose(body, cam, { yaw: 0, pitch: 0, aiming: true, weaponId: 'a280c', dt: 0.05, prev: settle({ yaw: 0, pitch: 0 }) });
    expect(half.fov).toBeLessThan(FOV_DEFAULT);
    expect(half.fov).toBeGreaterThan(cam.aim.a280c[0].fov);
  });
});

describe('the deploy screen’s overview', () => {
  it('picks the level’s camera that faces the objective, at 35 mm on a 36 mm frame', () => {
    const map = mapOf(rb, 'hoth');
    const c0 = map.cameras.find((c) => c.mode === 'galacticAssault');
    const ahead = [c0.at[0] + Math.sin(c0.yaw) * 100, c0.at[1] + Math.sin(c0.pitch) * 100, c0.at[2] + Math.cos(c0.yaw) * 100];
    const p = overviewPose(map, ahead);
    expect(p.id).toBe(c0.id);
    expect(p.fov).toBeCloseTo(OVERVIEW_FOV, 6);
    expect(OVERVIEW_FOV).toBeCloseTo((2 * Math.atan(18 / 35) * 180) / Math.PI, 6);
  });
});

describe('a vehicle seat’s camera', () => {
  it('holds the pitch within the seat’s limits', () => {
    const seat = { pitch: [-35, 24], inertia: { input: 0.8, none: 0.5 } };
    const p = vehiclePose({ at: [0, 0, 0], yaw: 0 }, seat, { yaw: 0, pitch: 1.2 }, 1 / 60, null);
    expect(p.pitch).toBeCloseTo((24 * Math.PI) / 180, 6);
  });
});
