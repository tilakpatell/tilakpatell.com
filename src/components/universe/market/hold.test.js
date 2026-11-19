import { describe, expect, it } from 'vitest';
import { holdOps, readHold } from './hold';

const here = { sector: [1, 0, 2], pocket: null };
const there = { sector: [9, 0, 2], pocket: null };

describe('the hold', () => {
  it('stops at its room', () => {
    const h = holdOps([], 10);
    expect(h.add('iron', 7, here)).toBe(7);
    expect(h.add('ice', 7, here)).toBe(3);
    expect(h.used).toBe(10);
    expect(h.free).toBe(0);
    expect(h.add('ice', 1, here)).toBe(0);
  });

  it('takes the oldest first, each lot keeping where it came from', () => {
    const h = holdOps([], 20);
    h.add('spice', 3, here);
    h.add('iron', 1, here);
    h.add('spice', 4, there);
    const out = h.remove('spice', 5);
    expect(out).toEqual([
      { good: 'spice', n: 3, from: here },
      { good: 'spice', n: 2, from: there },
    ]);
    expect(h.count('spice')).toBe(2);
    expect(h.remove('spice', 99)).toEqual([{ good: 'spice', n: 2, from: there }]);
    expect(h.lots).toEqual([{ good: 'iron', n: 1, from: here }]);
  });

  it('has and takes goods across lots, all or nothing', () => {
    const h = holdOps([], 20);
    h.add('exotic', 1, here);
    h.add('iron', 1, here);
    h.add('exotic', 1, there);
    expect(h.has({ exotic: 2 })).toBe(true);
    expect(h.take({ exotic: 2, iron: 2 })).toBe(false);
    expect(h.count('exotic')).toBe(2);
    expect(h.take({ exotic: 2 })).toBe(true);
    expect(h.goods()).toEqual([{ id: 'iron', name: 'Iron ore', n: 1 }]);
  });

  it('reads junk as nothing', () => {
    expect(readHold('x')).toEqual([]);
    expect(readHold([{ good: 'iron', n: 2.7, from: { sector: [1, 'a', 3] } }, { good: 'nope', n: 1 }, null, { good: 'ice', n: -1 }])).toEqual([{ good: 'iron', n: 2, from: { sector: [0, 0, 0], pocket: null } }]);
  });
});
