import { describe, expect, it } from 'vitest';
import cameras from '../../../data/bf2017/cameras.json';
import { PIVOT, SHOULDER, armFor, createSoldierMemo, cullFor, soldierPose } from './soldier';

const rows = cameras.rows;
const RAD = Math.PI / 180;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('soldierPose', () => {
  it('puts the camera the arm behind the pivot at pitch 0, a shoulder to the side', () => {
    const pose = soldierPose({ at: [0, 0, 0] }, rows, { yaw: 0, pitch: 0 });
    // (forward +z at yaw 0: behind is −z, the right is −x)
    expect(pose.at[2]).toBeCloseTo(-rows.soldier.arm, 6);
    expect(pose.at[0]).toBeCloseTo(-SHOULDER, 6);
    expect(pose.at[1]).toBeCloseTo(PIVOT.stand, 6);
    expect(pose.roll).toBe(0);
    // the view is forward
    expect(pose.lookAt[2] - pose.at[2]).toBeCloseTo(1, 6);
  });

  it('the left shoulder mirrors the right', () => {
    const r = soldierPose({ at: [0, 0, 0] }, rows, { side: 1 });
    const l = soldierPose({ at: [0, 0, 0] }, rows, { side: -1 });
    expect(l.at[0]).toBeCloseTo(-r.at[0], 6);
  });

  it('looking up draws the arm in between the reduced pitches', () => {
    expect(armFor(rows.soldier, 0)).toBe(rows.soldier.arm);
    expect(armFor(rows.soldier, 5)).toBe(rows.soldier.arm);
    expect(armFor(rows.soldier, 70)).toBeCloseTo(rows.soldier.reducedArm.length, 6);
    // pitch 60 asked, 55 given: the arm between half of it and all of it
    const pose = soldierPose({ at: [0, 0, 0] }, rows, { pitch: 60 * RAD });
    expect(pose.pitch).toBeCloseTo(55 * RAD, 6);
    expect(pose.arm).toBeGreaterThan(0.5 * rows.soldier.arm);
    expect(pose.arm).toBeLessThan(rows.soldier.arm);
  });

  it('a wall at 0.6 m draws the arm in at blendIn, never past the wall', () => {
    const memo = createSoldierMemo();
    const free = () => null;
    soldierPose({ at: [0, 0, 0] }, rows, { pitch: 0, side: 1, dt: 1 / 60, castArm: free, memo });
    const start = memo.len;
    const target = 0.6 - rows.soldier.collision.padding;
    let pose;
    for (let i = 0; i < 6; i++) pose = soldierPose({ at: [0, 0, 0] }, rows, { pitch: 0, dt: 1 / 60, castArm: () => 0.6, memo });
    // after 0.1 s the blend has gone about blendIn × 0.1 of the gap, not all
    const gone = (start - memo.len) / (start - target);
    expect(gone).toBeGreaterThan(0.3);
    expect(gone).toBeLessThan(0.6);
    expect(pose.arm).toBeLessThanOrEqual(0.6);
    for (let i = 0; i < 120; i++) pose = soldierPose({ at: [0, 0, 0] }, rows, { pitch: 0, dt: 1 / 60, castArm: () => 0.6, memo });
    expect(pose.arm).toBeCloseTo(target, 3);
  });

  it('a cast with no answer this frame keeps the last hit', () => {
    const memo = createSoldierMemo();
    soldierPose({ at: [0, 0, 0] }, rows, { dt: 1 / 60, castArm: () => 0.6, memo });
    const pose = soldierPose({ at: [0, 0, 0] }, rows, { dt: 1 / 60, castArm: () => undefined, memo });
    expect(pose.arm).toBeLessThanOrEqual(0.6);
  });

  it('takes a ray hit as the physics queries answer it', () => {
    const memo = createSoldierMemo();
    const pose = soldierPose({ at: [0, 0, 0] }, rows, { dt: 1 / 60, castArm: () => ({ dist: 0.6 }), memo });
    expect(pose.arm).toBeLessThanOrEqual(0.6);
  });

  it('the cull distance by stance', () => {
    expect(cullFor(rows.soldier, 'prone')).toBe(0.32);
    expect(cullFor(rows.soldier, 'nonsense')).toBe(rows.soldier.cull.stand);
    expect(soldierPose({ at: [0, 0, 0] }, rows, { stance: 'crouch' }).cull).toBe(1.5);
  });

  it('starts from x, y, z as well as at', () => {
    const a = soldierPose({ x: 3, y: 1, z: -2 }, rows, {});
    const b = soldierPose({ at: [3, 1, -2] }, rows, {});
    expect(dist(a.at, b.at)).toBe(0);
  });
});
