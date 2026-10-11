import { describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from './rulebook.js';
import { field } from './fixtures/field.js';
import { buildNav, cellAt, coverSlots, findPath, firstSolid, lineClear, walkable } from './nav.js';
import { buildMask } from './navMask.js';

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
