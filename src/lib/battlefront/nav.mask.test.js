import { describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from './rulebook.js';
import { field } from './fixtures/field.js';
import { buildNav, canStep, cellAt, coverSlots, findPath, firstSolid, heightAt, lineClear, standAt, walkable } from './nav.js';
import { CLIMB, buildMask, buildWalkMask } from './navMask.js';

const cover = aiOf(loadRulebook()).cover.constants;

// rectangles of the ground a capsule cannot stand in, each with its top
const RECTS = [
  { x: [-60, 60], z: [-51, -49], top: 2.5 }, // a wall across the south, 2 m thick
  { x: [-80, -78], z: [70, 90], top: 1.0 }, // a low wall in the north-west: crouch cover
  { x: [79.9, 80.1], z: [-80, -79.9], top: 3 }, // a post thinner than a cell, between the cells' middles
];
const inRect = (q, x, z, r) => x > q.x[0] - r && x < q.x[1] + r && z > q.z[0] - r && z < q.z[1] + r;
const blockedAt = (x, y, z, r) => RECTS.some((q) => inRect(q, x, z, r));
const topAt = (x, z) => Math.max(0, ...RECTS.filter((q) => inRect(q, x, z, 0.3)).map((q) => q.top));
const mask = buildMask({ bounds: field().bounds, cell: 2, fine: 0.5, heightAt: () => 0, blockedAt, topAt, capsule: { step: 0.4, height: 1.7, radius: 0.3 } });
const nav = buildNav({ ...field(), cover, mask });

describe('the navgrid over the nav mask', () => {
  it('detours round a wall only the mask knows', () => {
    const plain = buildNav({ ...field(), cover });
    expect(findPath(plain, [0, -60], [0, -40]).length).toBe(2);
    const p = findPath(nav, [0, -60], [0, -40]);
    expect(p).not.toBeNull();
    expect(p.some(([x]) => Math.abs(x) > 60)).toBe(true);
  });

  it('is not walkable on a fine-blocked spot inside an open cell', () => {
    const [c, r] = cellAt(nav, 80, -80);
    expect(nav.solid[r * nav.cols + c]).toBe(0);
    expect(walkable(nav, 80, -79.95)).toBe(false);
    expect(walkable(nav, 81, -79.95)).toBe(true);
    // and inside the wall, everywhere
    expect(walkable(nav, 0, -50)).toBe(false);
    expect(walkable(nav, 0, -48.2)).toBe(true);
  });

  it('stops a line of sight below the mask’s top and lets it pass above', () => {
    const hit = firstSolid(nav, [0, 1, -60], [0, 1, -40]);
    expect(hit.solid).toBe(-2);
    expect(hit.at[2]).toBeGreaterThanOrEqual(-52); // (the blocked cells' edge: the wall's 2 m grown by the capsule)
    expect(hit.at[2]).toBeLessThan(-48);
    expect(lineClear(nav, [0, 3, -60], [0, 3, -40])).toBe(true);
  });

  it('puts cover slots on the mask’s edges, crouch behind the low wall and stand behind the high', () => {
    const low = coverSlots(nav, [-79, 80], 6).filter((s) => s.solid === -2);
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((s) => s.height === 'crouch')).toBe(true);
    // (the slot faces out of the wall: the wall is between it and a threat beyond)
    const east = low.find((s) => s.at[0] > -78);
    expect(east.normal).toEqual([1, 0]);
    expect(east.at[0]).toBeCloseTo(-78 + cover['CrouchCoverOcclusionSettings.OcclusionCheckDist'], 1);
    const high = coverSlots(nav, [0, -47], 3).filter((s) => s.solid === -2);
    expect(high.length).toBeGreaterThan(0);
    expect(high.every((s) => s.height === 'stand')).toBe(true);
  });

  it('ignores a mask built for another grid', () => {
    const other = buildMask({ bounds: { min: [-50, -50], max: [50, 50] }, cell: 2, heightAt: () => 0, blockedAt, topAt });
    const n = buildNav({ ...field(), cover, mask: other });
    expect(n.mask).toBeNull();
    expect(walkable(n, 0, -50)).toBe(true);
  });

  it('lets a box buried under the ground block nothing', () => {
    const buried = { at: [40, -2, -20], half: [3, 1, 3], yaw: 0 };
    const n = buildNav({ ...field(), solids: [...field().solids, buried], cover });
    expect(walkable(n, 40, -20)).toBe(true);
    const [c, r] = cellAt(n, 40, -20);
    expect(n.solid[r * n.cols + c]).toBe(0);
    expect(coverSlots(n, [40, -20], 6).filter((s) => s.solid === 2)).toEqual([]);
  });
});

// The walk mask on the field: a snow pile (a cone 1.2 m tall, 3 m round, at
// [40, 40]) and a wall 2 m tall (x 60…61, z −10…10), walked from the field's south-west
const pile = (x, z) => Math.max(0, 1.2 * (1 - Math.hypot(x - 40, z - 40) / 3));
const inWall = (x, z, r = 0) => x >= 60 - r && x < 61 + r && Math.abs(z) < 10 + r;
const walk = buildWalkMask({
  bounds: field().bounds,
  cell: 2,
  fine: 0.5,
  heightAt: () => 0,
  surfacesAt: (x, z, top, bottom) => [inWall(x, z) ? 2 : pile(x, z) || null].filter((h) => h !== null && h <= top && h >= bottom),
  freeAt: (x, y, z) => !(inWall(x, z, 0.3) && y < 1.95) && !(pile(x, z) > 0 && y < pile(x, z) - 0.05),
  topAt: (x, z) => (inWall(x, z) ? 2 : 0),
  seeds: [[-99, 0, -99]],
  capsule: { step: 0.4, height: 1.7, radius: 0.3 },
  rays: { start: 1.2, end: -4 },
});
const walked = buildNav({ ...field(), heightAt: () => 0, solids: [], cover, mask: walk });

describe('the navgrid over the walk mask', () => {
  it('stands a soldier on the pile, the height rising with it', () => {
    expect(standAt(walked, 40, 40)).toBeCloseTo(1.1, 0);
    expect(heightAt(walked, 40, 40)).toBeCloseTo(standAt(walked, 40, 40), 5);
    expect(standAt(walked, 40, 42.5)).toBeLessThan(standAt(walked, 40, 41));
    expect(standAt(walked, 40, 50)).toBe(0);
    expect(heightAt(walked, 0, 0)).toBe(0);
  });

  it('steps onto the pile and off it, never up the wall', () => {
    expect(canStep(walked, 40, 44, 40, 43.5)).toBe(true);
    expect(canStep(walked, 40, 40.5, 40, 40)).toBe(true);
    expect(canStep(walked, 59.5, 0, 60.2, 0)).toBe(false);
    expect(walkable(walked, 60.5, 0)).toBe(false);
    expect(walkable(walked, 62, 0)).toBe(true);
  });

  it('never lifts a soldier beside a face it cannot step, and keeps the climb', () => {
    expect(standAt(walked, 59.6, 0)).toBe(0);
    expect(walk.climb).toBe(CLIMB);
    // (a mask with no stands: the ground alone, every step a walk)
    expect(standAt(nav, 0, 0)).toBe(0);
    expect(canStep(nav, 0, 17, 0, 17.5)).toBe(true);
  });

  it('lets a soldier put where the mask has no room step out of it', () => {
    expect(walkable(walked, 60.5, 0)).toBe(false);
    expect(canStep(walked, 60.2, 0, 59.2, 0)).toBe(true);
  });
});

// A bank in the ground itself: 3 m up north of z 0, walked from both sides.
const bank = (x, z) => (z >= 0 ? 3 : 0);
const banked = buildWalkMask({
  bounds: field().bounds,
  cell: 2,
  fine: 0.5,
  heightAt: bank,
  surfacesAt: () => [],
  freeAt: () => true,
  bareAt: () => true,
  seeds: [
    [0, 0, -50],
    [0, 3, 50],
  ],
  capsule: { step: 0.4, height: 1.7, radius: 0.3 },
  rays: { start: 1.2, end: -4 },
});
const onBank = buildNav({ ...field(), heightAt: bank, solids: [], cover, mask: banked });
const plainBank = buildNav({ ...field(), heightAt: bank, solids: [], cover });

describe('the navgrid over a walk mask on steep ground', () => {
  it('stands a soldier at the ground’s own height, not the grid’s middles’', () => {
    expect(heightAt(onBank, 10.3, -0.2)).toBe(0);
    expect(heightAt(onBank, 10.3, 0.2)).toBe(3);
    expect(heightAt(plainBank, 10.3, -0.2)).toBe(0);
    // (a grid made by hand, with no height function: bilinear over its middles, as before)
    expect(heightAt({ ...plainBank, ground: null }, 10.3, 0)).toBeCloseTo(1.5, 5);
  });

  it('is walkable to the bank’s foot and its brink, where the grid’s slope flag shut both cells', () => {
    const [c, r] = cellAt(onBank, 10, -0.5);
    expect(onBank.walk[r * onBank.cols + c]).toBe(0);
    expect(walkable(plainBank, 10, -0.5)).toBe(false);
    expect(walkable(plainBank, 10, 0.5)).toBe(false);
    expect(walkable(onBank, 10, -0.5)).toBe(true);
    expect(walkable(onBank, 10, 0.5)).toBe(true);
  });

  it('never steps up the bank, and drops off it', () => {
    expect(canStep(onBank, 10, -0.2, 10, 0.2)).toBe(false);
    expect(canStep(onBank, 10, 0.2, 10, -0.2)).toBe(true);
    // (along its foot and along its brink: no rise)
    expect(canStep(onBank, 10.2, -0.2, 10.7, -0.2)).toBe(true);
    expect(canStep(onBank, 10.2, 0.2, 10.7, 0.2)).toBe(true);
  });

  it('keeps the paths off the bank: the slope flag is still theirs', () => {
    expect(findPath(onBank, [0, -20], [0, 20])).toBeNull();
  });
});
