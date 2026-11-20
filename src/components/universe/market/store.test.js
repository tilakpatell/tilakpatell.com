import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { EMPTY_FOR, MARKET_KEY, SHIPS_KEY, createMarket } from './store';

const memory = (init = {}) => {
  const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const open = (local, t = 1000) => createMarket({ saves: createSaves({ local, session: memory() }), now: () => t, later: (fn) => (fn(), 1), cancel: () => {} });
const here = { sector: [3, 0, 1], pocket: null };

describe('the market’s saves', () => {
  it('keeps a crew’s hold, a field emptied and a wreck salvaged across a reload', () => {
    const local = memory();
    const a = open(local);
    a.hold('rv', 16).add('iron', 5, here);
    a.empty('E:3,1:f2', 1000);
    a.salvage('E:3,1:d7');
    const b = open(local);
    expect(b.hold('rv', 16).count('iron')).toBe(5);
    expect(b.hold('xwing', 6).used).toBe(0);
    expect(b.isEmpty('E:3,1:f2', 1000 + EMPTY_FOR - 1)).toBe(true);
    expect(b.isEmpty('E:3,1:f2', 1000 + EMPTY_FOR)).toBe(false);
    expect(b.salvaged('E:3,1:d7')).toBe(true);
    expect(b.salvaged('E:3,1:d8')).toBe(false);
  });

  it('remembers what you sold at a station, fading', () => {
    const m = open(memory());
    m.note('s1', 'food', 10, 0);
    expect(m.yours('s1', 'food', 0)).toBe(10);
    expect(m.yours('s1', 'food', 15 * 60 * 1000)).toBeCloseTo(5, 6);
    m.note('s1', 'food', -5, 15 * 60 * 1000);
    expect(m.yours('s1', 'food', 15 * 60 * 1000)).toBeCloseTo(0, 6);
  });

  it('gives the wallet the crew’s hold as its cargo', () => {
    const m = open(memory());
    m.hold('cruiser', 10).add('exotic', 2, here);
    const cargo = m.cargo('cruiser', 10);
    expect(cargo.has({ exotic: 2 })).toBe(true);
    expect(cargo.take({ exotic: 2 })).toBe(true);
    expect(m.hold('cruiser', 10).count('exotic')).toBe(0);
  });

  it('shocks a price for a while, and not for keeps', () => {
    const m = open(memory());
    m.shock('s1', 'medicine', 2, 5000);
    expect(m.shockOf('s1', 'medicine', 4999)).toBe(2);
    expect(m.shockOf('s1', 'medicine', 5000)).toBe(1);
  });

  it('reads junk saves as nothing', () => {
    const local = memory({ [SHIPS_KEY]: { v: 1, data: 'x' }, [MARKET_KEY]: { v: 1, data: { yours: 3, emptied: [1], salvaged: 'no' } } });
    const m = open(local);
    expect(m.hold('rv', 16).used).toBe(0);
    expect(m.salvaged('no')).toBe(false);
  });
});

describe('the cargo pod', () => {
  it('keeps one pod across a reload, and forgets an empty one', () => {
    const local = memory();
    const a = open(local);
    a.setPod({ crew: 'rv', at: [1, 2, 3], sector: [0, 0, 0], t: 5, lots: [{ good: 'iron', n: 4, from: here }] });
    expect(open(local).pod()).toMatchObject({ crew: 'rv', at: [1, 2, 3], lots: [{ good: 'iron', n: 4 }] });
    open(local).setPod({ crew: 'rv', at: [1, 2, 3], lots: [] });
    expect(open(local).pod()).toBe(null);
  });
});
