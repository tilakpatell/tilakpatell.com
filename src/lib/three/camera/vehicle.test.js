import { describe, expect, it } from 'vitest';
import cameras from '../../../data/bf2017/cameras.json';
import { TICK, createVehicleMemo, redirect, redirectFor, vehicleLook, vehiclePose } from './vehicle';

const atat = cameras.rows.vehicles['vehicle_ground_at-at_mp'];
const RAD = Math.PI / 180;
const DT = 1 / 60;

describe('vehicleLook', () => {
  it('holds the seat’s pitch limits', () => {
    const memo = createVehicleMemo();
    for (let i = 0; i < 120; i++) vehicleLook(memo, atat.seats[0], { pitch: 2 * RAD }, DT);
    expect(memo.pitch).toBe(24);
    for (let i = 0; i < 240; i++) vehicleLook(memo, atat.seats[0], { pitch: -2 * RAD }, DT);
    expect(memo.pitch).toBe(-35);
  });

  it('coasts on `inertia.none` when the stick is let go, and stops', () => {
    const memo = createVehicleMemo();
    for (let i = 0; i < 30; i++) vehicleLook(memo, atat.seats[0], { yaw: 0.2 * RAD }, DT);
    const v = memo.vy;
    expect(v).toBeGreaterThan(0);
    vehicleLook(memo, atat.seats[0], {}, 1 / TICK);
    expect(memo.vy).toBeCloseTo(v * atat.seats[0].inertia.none, 9);
    for (let i = 0; i < 60; i++) vehicleLook(memo, atat.seats[0], {}, DT);
    expect(Math.abs(memo.vy)).toBeLessThan(1e-3);
  });

  it('a seat with no inertia follows the stick at once', () => {
    const memo = createVehicleMemo();
    vehicleLook(memo, atat.seats[2], { yaw: 0.5 * RAD }, DT);
    expect(memo.yaw).toBeCloseTo(0.5, 9);
  });

  it('the redirect turns motion into the camera’s turn at the conversion rate', () => {
    const chain = redirectFor(atat, 1);
    expect(chain).toHaveLength(4);
    const memo = createVehicleMemo();
    const out = redirect(memo, chain, [1, 0, 0, 0], DT);
    // (no inertia on the first entry: the rate at once)
    expect(out[0]).toBeCloseTo(chain[0].rate, 9);
    expect(redirectFor(atat, 9)).toBeNull();
  });

  it('puts the camera the arm behind the pivot down the look', () => {
    const pose = vehiclePose(createVehicleMemo(), atat.seats[0], {}, DT, { pivot: [0, 10, 0], arm: 8 });
    expect(pose.at[0] + 0).toBe(0);
    expect(pose.at.slice(1)).toEqual([10, -8]);
    expect(pose.roll).toBe(0);
  });
});
