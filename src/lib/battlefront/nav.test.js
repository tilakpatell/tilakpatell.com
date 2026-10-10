import { describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from './rulebook.js';
import { CRATE, HILL, WALL, field, fieldHeight } from './fixtures/field.js';
import { buildNav, cellAt, coverSlots, findPath, firstSolid, heightAt, lineClear, nearestMainland, nearestSlot, walkable } from './nav.js';

const cover = aiOf(loadRulebook()).cover.constants;
const nav = buildNav({ ...field(), cover });

describe('the navgrid', () => {
  it('is 100 by 100 cells of 2 m', () => {
    expect(nav.cols).toBe(100);
    expect(nav.rows).toBe(100);
    expect(cellAt(nav, -99, -99)).toEqual([0, 0]);
    expect(cellAt(nav, 101, 0)).toBeNull();
  });

  it('is not walkable inside the wall, and is beside it', () => {
    expect(walkable(nav, 0, 20)).toBe(false);
    expect(walkable(nav, 14, 20.2)).toBe(false);
    expect(walkable(nav, 0, 17)).toBe(true);
    expect(walkable(nav, 0, 18.8)).toBe(true);
    expect(walkable(nav, 18, 20)).toBe(true);
  });

  it('marks the hill’s steep flank unwalkable', () => {
    // the flank's steepest ring is half way out: the slope there is 1.5 × height / r
    const x = HILL.at[0] + HILL.r / 2;
    const z = HILL.at[1];
    const rise = fieldHeight(x + 2, z) - fieldHeight(x, z);
    expect(Math.abs(rise)).toBeGreaterThan(0.9 * 2);
    expect(walkable(nav, x, z)).toBe(false);
    expect(walkable(nav, HILL.at[0] + HILL.r + 4, z)).toBe(true);
  });

  it('reads heights bilinearly', () => {
    expect(heightAt(nav, 0, 0)).toBe(0);
    expect(heightAt(nav, HILL.at[0], HILL.at[1])).toBeGreaterThan(HILL.height * 0.9);
  });

  it('finds a path round the wall', () => {
    const p = findPath(nav, [0, 0], [0, 40]);
    expect(p).not.toBeNull();
    expect(p[0]).toEqual([0, 0]);
    expect(p.at(-1)).toEqual([0, 40]);
    for (const [x, z] of p) expect(Math.abs(x) > 15 || z < 19 || z > 21).toBe(true);
    // and every leg stays on open ground
    for (let i = 1; i < p.length; i++)
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        expect(walkable(nav, p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t)).toBe(true);
      }
  });

  it('finds a path round a blocked cell', () => {
    // bots standing east of the wall close that way: the path goes round the west end
    const blocked = new Set();
    for (let x = 15; x <= 99; x += 2) for (let z = 17; z <= 23; z += 2) blocked.add(cellAt(nav, x, z)[1] * nav.cols + cellAt(nav, x, z)[0]);
    const p = findPath(nav, [10, 10], [10, 30], { blocked });
    expect(p).not.toBeNull();
    expect(p.some(([x]) => x < -15)).toBe(true);
  });

  it('gives up on a goal it cannot reach', () => {
    const blocked = new Set();
    for (let c = 0; c < nav.cols; c++) blocked.add(cellAt(nav, -99 + c * 2, 51)[1] * nav.cols + c);
    expect(findPath(nav, [0, 0], [0, 80], { blocked })).toBeNull();
  });

  it('sees over the wall and not through it', () => {
    expect(lineClear(nav, [0, 1, 0], [0, 1, 40])).toBe(false);
    expect(lineClear(nav, [0, 3, 0], [0, 3, 40])).toBe(true);
    const hit = firstSolid(nav, [0, 1, 0], [0, 1, 40]);
    expect(hit.at[2]).toBeCloseTo(WALL.at[2] - WALL.half[2], 5);
    // a thin slant through the wall's corner is still stopped
    expect(lineClear(nav, [-20, 1, 0], [20, 1, 40])).toBe(false);
  });

  it('places cover slots along the wall and the crate, as the game spaces them', () => {
    const south = coverSlots(nav, [0, 18], 20).filter((s) => s.solid === 0 && s.normal[1] < -0.5).sort((a, b) => a.at[0] - b.at[0]);
    expect(south.length).toBeGreaterThan(10);
    expect(south[1].at[0] - south[0].at[0]).toBeCloseTo(cover.SlotSpacing, 5);
    expect(south.every((s) => s.height === 'stand')).toBe(true);
    const crate = coverSlots(nav, [CRATE.at[0], CRATE.at[2]], 3).filter((s) => s.solid === 1);
    expect(crate.length).toBeGreaterThan(0);
    expect(crate.every((s) => s.height === 'crouch')).toBe(true);
  });

  it('finds the nearest slot that shields from a threat', () => {
    const s = nearestSlot(nav, [0, 0, 10], [0, 40]);
    expect(s.normal[1]).toBeLessThan(0);
    expect(s.at[2]).toBeLessThan(WALL.at[2]);
  });

  it('places a point in a walled-off pocket on the main region instead', () => {
    // a 6 m pen of four walls round (40, -40)
    const pen = [
      { at: [40, 1, -44], half: [4, 1, 0.5], yaw: 0 },
      { at: [40, 1, -36], half: [4, 1, 0.5], yaw: 0 },
      { at: [36, 1, -40], half: [0.5, 1, 4], yaw: 0 },
      { at: [44, 1, -40], half: [0.5, 1, 4], yaw: 0 },
    ];
    const n = buildNav({ ...field(), solids: [...field().solids, ...pen], cover });
    expect(walkable(n, 40, -40)).toBe(true);
    const p = nearestMainland(n, 40, -40);
    expect(Math.max(Math.abs(p[0] - 40), Math.abs(p[1] + 40))).toBeGreaterThan(4);
    expect(findPath(n, p, [0, 0])).not.toBe(null);
    expect(nearestMainland(n, 0, 0)).toEqual([0, 0]);
  });
});
