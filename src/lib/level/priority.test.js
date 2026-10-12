import { describe, expect, it } from 'vitest';
import { HEADING, bootCells, coarseHidden, coarseReach, headingOf, prefetchAhead, priorityOf } from './priority.js';

const at = { position: [0, 0], heading: [0, 1], tier: 'high' };

describe('priorityOf', () => {
  it('ranks a near large thing ahead over a far small one behind', () => {
    const nearAhead = priorityOf({ x: 0, z: 40, r: 10 }, at);
    const farBehind = priorityOf({ x: 0, z: -400, r: 2 }, at);
    expect(nearAhead).toBeGreaterThan(farBehind);
  });

  it('weighs the heading: the same thing ahead before behind, by 1 ± HEADING', () => {
    const ahead = priorityOf({ x: 0, z: 100, r: 5 }, at);
    const behind = priorityOf({ x: 0, z: -100, r: 5 }, at);
    expect(ahead / behind).toBeCloseTo((1 + HEADING) / (1 - HEADING), 6);
  });

  it('counts a thing you stand in as full size, and ignores the heading without one', () => {
    expect(priorityOf({ x: 1, z: 1, r: 10 }, { position: [0, 0] })).toBe(1);
    expect(priorityOf({ x: 0, z: 50, r: 5 }, { position: [0, 0], heading: null })).toBeCloseTo(0.1, 9);
  });
});

describe('headingOf', () => {
  it('is the unit step between two places, or null for no move', () => {
    expect(headingOf([0, 0], [3, 4])).toEqual([0.6, 0.8]);
    expect(headingOf([1, 1], [1, 1])).toBeNull();
    expect(headingOf(null, [1, 1])).toBeNull();
  });
});

const cells = {};
for (let x = -8; x < 8; x++) for (let z = -8; z < 8; z++) cells[`${x},${z}`] = {};
const pack = { cell: 128, cells };

describe('bootCells', () => {
  it('is your cell and its eight neighbours, yours first', () => {
    const keys = bootCells(pack, [10, 10]);
    expect(keys[0]).toBe('0,0');
    expect(keys).toHaveLength(9);
    expect(new Set(keys)).toEqual(new Set(['-1,-1', '0,-1', '1,-1', '-1,0', '0,0', '1,0', '-1,1', '0,1', '1,1']));
  });

  it('leaves out the cells the pack has not got', () => {
    expect(bootCells(pack, [-8 * 128 + 5, 10]).length).toBe(6);
  });
});

describe('prefetchAhead', () => {
  it('takes the two cells beyond the mid ring along the heading', () => {
    // (high: mid 220 m, two rings of 128 m cells; so the third and fourth ahead)
    expect(prefetchAhead(pack, { position: [10, 10], heading: [0, 1], tier: 'high' })).toEqual(['0,3', '0,4']);
  });

  it('turns with the heading, and asks nothing standing still', () => {
    expect(prefetchAhead(pack, { position: [10, 10], heading: [-1, 0], tier: 'high' })).toEqual(['-3,0', '-4,0']);
    expect(prefetchAhead(pack, { position: [10, 10], heading: null, tier: 'high' })).toEqual([]);
  });
});

describe('coarseReach', () => {
  it('is a ring of 512 m cells on low, two on mid, the whole grid above', () => {
    expect(coarseReach('low')).toBe(1);
    expect(coarseReach('mid')).toBe(2);
    expect(coarseReach('high')).toBe(Infinity);
    expect(coarseReach('ultra')).toBe(Infinity);
  });
});

describe('coarseHidden', () => {
  it('hides a coarse cell once every mesh in it the fine path draws has come', () => {
    const loaded = new Set([1, 2]);
    expect(coarseHidden([1, 2], { loaded: (m) => loaded.has(m), drawn: () => true })).toBe(true);
    expect(coarseHidden([1, 2, 3], { loaded: (m) => loaded.has(m), drawn: () => true })).toBe(false);
  });

  it('counts a mesh the fine path does not draw (beyond its reach) as come', () => {
    expect(coarseHidden([1, 3], { loaded: (m) => m === 1, drawn: (m) => m !== 3 })).toBe(true);
  });

  it('keeps an empty cell shown (nothing to stand in for it yet means nothing to hide)', () => {
    expect(coarseHidden([], { loaded: () => true, drawn: () => true })).toBe(false);
  });
});
