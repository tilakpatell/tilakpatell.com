import { describe, expect, it } from 'vitest';
import { SHACK, VILLAGE, buildingAt } from '../../rules/hogsmeade';
import { BEANS, LINES, TUNNEL, beanFor, lookOf, onTunnel, shackFront, streetSide, tunnelSamples, walkYaw } from './plan';

const close = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe('Hogsmeade’s insides, as data', () => {
  it('turn a direction into the walk’s yaw and back', () => {
    for (const dir of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-0.6, 0.8],
    ])
      expect(close(lookOf(walkYaw(dir)), dir)).toBe(true);
    // (yaw 0 looks along −z, as a room’s spawn does)
    expect(close(lookOf(0), [0, -1])).toBe(true);
  });

  it('let you out of each shop into the street, a step from its door, facing away from it', () => {
    for (const id of ['honeydukes', 'broomsticks', 'hogshead']) {
      const b = buildingAt(id);
      const out = streetSide(id);
      const door = [b.door[0] - VILLAGE.at[0], b.door[1] - VILLAGE.at[1]];
      expect(Math.hypot(out.at[0] - door[0], out.at[1] - door[1])).toBeCloseTo(1.6, 6);
      // (looking away from the building’s middle: the way you came out)
      const mid = [b.at[0] - VILLAGE.at[0], b.at[1] - VILLAGE.at[1]];
      const look = lookOf(out.yaw);
      expect(look[0] * (out.at[0] - mid[0]) + look[1] * (out.at[1] - mid[1])).toBeGreaterThan(0);
    }
    expect(streetSide('nowhere')).toBeNull();
  });

  it('put you down the Shack’s hill toward the street when its door is open', () => {
    const f = shackFront();
    const shack = [SHACK.at[0] - VILLAGE.at[0], SHACK.at[1] - VILLAGE.at[1]];
    expect(Math.hypot(f.at[0] - shack[0], f.at[1] - shack[1])).toBeCloseTo(6, 6);
    // (nearer the street’s middle line than the Shack is, and looking on toward it)
    const offLine = ([x, z]) => Math.abs(x * VILLAGE.axis[1] - z * VILLAGE.axis[0]);
    expect(offLine(f.at)).toBeLessThan(offLine(shack));
    const look = lookOf(f.yaw);
    expect(offLine([f.at[0] + look[0], f.at[1] + look[1]])).toBeLessThan(offLine(f.at));
  });

  it('have a bean for every number, the same one each time, and lines one sentence long', () => {
    expect(new Set(BEANS).size).toBe(BEANS.length);
    expect(beanFor(3)).toBe(beanFor(3 + BEANS.length));
    expect(BEANS).toContain(beanFor(-7.5));
    expect(LINES.beans('toffee')).toBe('You try one from the box. It tastes of toffee.');
    for (const [k, v] of Object.entries(LINES)) if (typeof v === 'string') expect(v, k).toMatch(/[.!]$/);
  });

  it('lay the passage under the Willow at about sixty metres, evenly stepped, and find where you are on it', () => {
    const list = tunnelSamples(0.5);
    const length = list.at(-1).s;
    expect(length).toBeGreaterThan(55);
    expect(length).toBeLessThan(70);
    for (let i = 1; i < list.length - 1; i++) expect(list[i].s - list[i - 1].s).toBeCloseTo(0.5, 1);
    expect(list[0].at).toEqual(TUNNEL.points[0]);
    expect(close(list.at(-1).at, TUNNEL.points.at(-1), 1e-3)).toBe(true);
    const mid = list[60];
    const here = onTunnel(mid.at[0] + mid.dir[1] * 0.5, mid.at[1] - mid.dir[0] * 0.5);
    expect(here.s).toBeCloseTo(mid.s, 0);
    expect(here.off).toBeCloseTo(0.5, 1);
    expect(here.y).toBeCloseTo(mid.y, 1);
    // (down under the lawn, then up the Shack’s hill)
    expect(Math.min(...list.map((p) => p.y))).toBeLessThan(-1.5);
    expect(list.at(-1).y).toBeGreaterThan(list[0].y);
  });
});
