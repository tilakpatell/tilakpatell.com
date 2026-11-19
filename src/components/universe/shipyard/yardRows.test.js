import { describe, expect, it } from 'vitest';
import { RAIL } from './rail';
import { BUILD_SLOTS } from './parts';
import { STOCK_BUILD } from './build';
import { STOCK } from '../outfit';
import { GROUPS, idsIn, rowsFor, statusOf } from './yardRows';

const STOCK_DRAFT = { build: null, tune: null, loadout: { paint: STOCK } };
const row = (o = {}) => ({ id: 'srb', name: 'Twin SRBs', open: true, hint: 'Win a race', item: { key: 'part:booster:srb', price: 600 }, ...o });

describe('the shipyard’s list', () => {
  it('sorts every slot on the rail into one of the front door’s groups, once', () => {
    const all = GROUPS.flatMap(([, slots]) => slots);
    expect([...all].sort()).toEqual([...RAIL].sort());
    expect(new Set(all).size).toBe(all.length);
    expect(GROUPS.map(([g]) => g)).toEqual(['Looks', 'Performance', 'Weapons', 'Frame']);
  });

  it('has rows for every slot, each named, with an id', () => {
    for (const slot of RAIL) {
      const tuning = BUILD_SLOTS.includes(slot) && slot !== 'hull';
      const rows = rowsFor(slot, [], tuning, 'falcon');
      expect(rows.length, slot).toBeGreaterThan(0);
      for (const r of rows) {
        expect(typeof r.id).toBe('string');
        expect(r.name.length).toBeGreaterThan(0);
      }
    }
    // (a stock ship's tune starts with the ship as it came)
    expect(rowsFor('wings', [], true, 'falcon')[0]).toMatchObject({ name: 'As it came', id: STOCK_BUILD.wings });
  });

  it('knows what’s staged and what’s flown, on a stock ship and in a build', () => {
    expect(idsIn('paint', STOCK_DRAFT, { loadout: { paint: STOCK } })).toMatchObject({ isBuild: false, tuning: false, staged: STOCK, flown: STOCK });
    expect(idsIn('wings', STOCK_DRAFT, { loadout: {} })).toMatchObject({ isBuild: true, tuning: true, staged: STOCK_BUILD.wings });
    expect(idsIn('hull', { ...STOCK_DRAFT, build: { hull: 'dart' } }, { build: null, loadout: {} })).toMatchObject({ tuning: false, staged: 'dart', flown: null });
  });

  it('says on each row what it is to you', () => {
    const ids = { staged: STOCK, flown: STOCK };
    expect(statusOf(row({ id: STOCK }), null, ids)).toEqual({ kind: 'fitted', text: 'Fitted' });
    expect(statusOf(row(), { kind: 'buy' }, ids)).toEqual({ kind: 'price', text: '600 ¢' });
    expect(statusOf(row(), { kind: 'short' }, ids).kind).toBe('short');
    expect(statusOf(row(), { kind: 'owned', text: 'Owned' }, ids)).toEqual({ kind: 'owned', text: 'Owned' });
    expect(statusOf(row({ open: false }), null, ids)).toEqual({ kind: 'locked', text: 'Locked' });
    expect(statusOf(row(), { kind: 'locked', text: 'Needs Mk II' }, ids).kind).toBe('locked');
    // (staged: its price while it's still to buy; flown but swapped out in the draft: flying)
    expect(statusOf(row(), { kind: 'buy' }, { staged: 'srb', flown: STOCK })).toEqual({ kind: 'staged', text: '600 ¢' });
    expect(statusOf(row(), { kind: 'owned', text: 'Owned' }, { staged: 'srb', flown: STOCK })).toEqual({ kind: 'staged', text: 'Staged' });
    expect(statusOf(row(), { kind: 'owned', text: 'Owned' }, { staged: STOCK, flown: 'srb' })).toEqual({ kind: 'flown', text: 'Flying' });
  });
});
