// The cameras against what breaks a camera (the fidelity design's lane C,
// review focus): a wall, the floor, the pole, a corner, a zoom changed
// mid-zoom. All pure, scripted casts.
import { describe, expect, it } from 'vitest';
import cameras from '../../../data/bf2017/cameras.json';
import { FOV_DEFAULT, aimFov } from './aim';
import { WALL_CLEAR, createSoldierMemo, soldierPose } from './soldier';
import { createVehicleMemo, vehicleLook } from './vehicle';

const rows = cameras.rows;
const RAD = Math.PI / 180;
const DT = 1 / 60;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(...a);
  return a.map((v) => v / l);
};

// solid where x < 0 and where z < 0: a 90° corner's two walls
const corner = (from, dir, len) => {
  let best = null;
  for (const k of [0, 2]) {
    if (dir[k] < -1e-9) {
      const t = -from[k] / dir[k];
      if (t >= 0 && t <= len && (best == null || t < best)) best = t;
    }
  }
  return best;
};

describe('the soldier camera against a wall', () => {
  it('a wall behind at 0.6 m: never clips, blends in, then back out at blendOut', () => {
    const memo = createSoldierMemo();
    // (a wall behind the figure: the plane z = −0.6, the soldier facing +z)
    const wall = (from, dir) => (dir[2] < -1e-9 ? (from[2] + 0.6) / -dir[2] : null);
    let pose = soldierPose({ at: [0, 0, 0] }, rows, { dt: DT, castArm: () => null, memo });
    let hit = null;
    const cast = (from, dir, len) => (hit = wall(from, dir, len));
    for (let i = 0; i < 180; i++) {
      pose = soldierPose({ at: [0, 0, 0] }, rows, { dt: DT, castArm: cast, memo });
      // never nearer the wall down the arm than WALL_CLEAR
      expect(pose.arm).toBeLessThanOrEqual(hit - WALL_CLEAR + 1e-9);
      expect(pose.at[2]).toBeGreaterThan(-0.6);
    }
    const close = memo.len;
    // the wall gone: out at blendOut (3 per second), slower than in (5)
    pose = soldierPose({ at: [0, 0, 0] }, rows, { dt: 0.1, castArm: () => null, memo });
    const full = Math.hypot(rows.soldier.arm, 0.35);
    const outShare = (memo.len - close) / (full - close);
    expect(outShare).toBeCloseTo(1 - Math.exp(-rows.soldier.collision.blendOut * 0.1), 6);
  });

  it('the ground is a floor for the arm', () => {
    // looking up hard on a slope rising behind: the camera stays over it
    const floorAt = (x, z) => -z * 2;
    const pose = soldierPose({ at: [0, 0, 0] }, rows, { pitch: 55 * RAD, floorAt });
    expect(pose.at[1]).toBeGreaterThanOrEqual(floorAt(pose.at[0], pose.at[2]) + rows.soldier.collision.padding - 1e-9);
  });
});

describe('the pole', () => {
  it('pitch holds at ±55 with no roll through a 720° sweep', () => {
    let worst = 0;
    for (const sign of [1, -1]) {
      for (let a = 0; a <= 720; a += 3) {
        const pose = soldierPose({ at: [0, 0, 0] }, rows, { yaw: a * RAD, pitch: sign * 80 * RAD });
        expect(Math.abs(pose.pitch)).toBeCloseTo(55 * RAD, 9);
        const f = norm(sub(pose.lookAt, pose.at));
        const right = norm(cross(f, [0, 1, 0]));
        const up = cross(right, f);
        // (the right stays level and the up leans only by the pitch: no roll)
        worst = Math.max(worst, Math.abs(right[1]), Math.abs(up[1] - Math.cos(55 * RAD)));
        expect(pose.roll).toBe(0);
      }
    }
    expect(worst).toBeLessThan(0.001);
  });
});

describe('a corner for 10 s', () => {
  it('a walker pressed into a 90° corner, the camera orbiting: no step over 2 cm', () => {
    const memo = createSoldierMemo();
    let last = null;
    let worst = 0;
    for (let i = 0; i < 600; i++) {
      const t = i * DT;
      // (pressed in: the body pushed back off the walls by half a centimetre either way)
      const feet = [0.35 + 0.005 * Math.sin(t * 37), 0, 0.35 + 0.005 * Math.cos(t * 41)];
      // the camera orbiting at 10° a second, the look bobbing a little
      let hit = null;
      const cast = (from, dir, len) => (hit = corner(from, dir, len));
      const pose = soldierPose({ at: feet }, rows, { yaw: (10 * t + 200) * RAD, pitch: 10 * RAD * Math.sin(t), dt: DT, castArm: cast, memo });
      // on the open side of both walls, never nearer a wall down the arm than WALL_CLEAR
      for (const k of [0, 2]) expect(pose.at[k]).toBeGreaterThan(0);
      if (hit != null) expect(pose.arm).toBeLessThanOrEqual(hit - WALL_CLEAR + 1e-9);
      if (last) worst = Math.max(worst, dist(pose.at, last));
      last = pose.at;
    }
    expect(worst).toBeLessThan(0.02);
  });
});

describe('the zoom during a zoom', () => {
  it('released at 0.1 s, the field eases back from where it was, never from the target', () => {
    const s = {};
    aimFov(s, rows, 0, {});
    let fov;
    for (let i = 0; i < 6; i++) fov = aimFov(s, rows, DT, { aiming: true, weaponId: 'e11' });
    const mid = fov;
    expect(mid).toBeLessThan(FOV_DEFAULT);
    expect(mid).toBeGreaterThan(55);
    // released: the next frame is next to where it was, not a jump from 55
    const curve = [];
    for (let i = 0; i < 30; i++) curve.push(aimFov(s, rows, DT, { aiming: false, weaponId: 'e11' }));
    expect(Math.abs(curve[0] - mid)).toBeLessThan(0.5);
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1] - 1e-9);
    expect(curve.at(-1)).toBe(FOV_DEFAULT);
  });
});

describe('the seat change mid-inertia', () => {
  it('AT-AT driver to gunner: the look carries its rate and settles under the new limits within a second', () => {
    const atat = rows.vehicles['vehicle_ground_at-at_mp'];
    const memo = createVehicleMemo();
    // the driver swinging right, the stick let go near the limit
    for (let i = 0; i < 300 && memo.yaw < 44; i++) vehicleLook(memo, atat.seats[0], { yaw: 0.6 * RAD }, DT);
    const before = memo.yaw;
    vehicleLook(memo, atat.seats[0], {}, DT);
    const lastStep = memo.yaw - before;
    expect(lastStep).toBeGreaterThan(0);
    // the gunner's seat: yaw ±37.5, the look outside it
    const steps = [];
    let prev = memo.yaw;
    for (let i = 0; i < 60; i++) {
      vehicleLook(memo, atat.seats[1], {}, DT);
      steps.push(memo.yaw - prev);
      prev = memo.yaw;
    }
    // no snap: each frame's move near the last one's, never a jump
    expect(Math.abs(steps[0] - lastStep)).toBeLessThan(1);
    for (const s of steps) expect(Math.abs(s)).toBeLessThan(1);
    // under the new limit within a second
    expect(memo.yaw).toBeLessThanOrEqual(atat.seats[1].yaw[1] + 0.05);
    expect(memo.yaw).toBeGreaterThan(atat.seats[1].yaw[1] - 1e-9);
  });
});
