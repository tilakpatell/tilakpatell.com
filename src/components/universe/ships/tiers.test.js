import { describe, expect, it } from 'vitest';
import { SYSTEMS } from './profiles';
import { MK, RARE_OF, TIER_PRICE, coreOf, tierItem, tierKey, tierOf, tiersOf } from './tiers';

const owning = (...keys) => {
  const set = new Set(keys);
  return (key) => set.has(key);
};

describe('a tier as an item', () => {
  it('prices each step up as the spec does', () => {
    expect(TIER_PRICE).toEqual([0, 0, 600, 2000, 6000, 15000]);
    expect(MK).toEqual(['', 'Mk I', 'Mk II', 'Mk III', 'Mk IV', 'Mk V']);
  });

  it('keys a tier by the crew, the system and its number', () => {
    expect(tierKey('falcon', 'engines', 2)).toBe('tier:falcon:engines:2');
  });

  it('makes Mk II free of needs and each after it need the one before', () => {
    expect(tierItem('falcon', 'engines', 2)).toEqual({
      key: 'tier:falcon:engines:2',
      id: 'tier:falcon:engines:2',
      kind: 'tier',
      slot: 'engines',
      name: 'Engines Mk II',
      price: 600,
      needs: {},
      from: null,
      stock: false,
    });
    expect(tierItem('falcon', 'engines', 3).needs).toEqual({ owns: 'tier:falcon:engines:2' });
    expect(tierItem('falcon', 'engines', 3).price).toBe(2000);
  });

  it('asks Mk IV for two of its system’s rare and Mk V for four pure', () => {
    expect(tierItem('rv', 'engines', 4).needs).toEqual({ owns: 'tier:rv:engines:3', goods: { exotic: 2 } });
    expect(tierItem('rv', 'engines', 5).needs).toEqual({ owns: 'tier:rv:engines:4', goods: { 'exotic-pure': 4 } });
    expect(tierItem('rv', 'hyperdrive', 4).needs.goods).toEqual({ voidcrystal: 2 });
    for (const s of SYSTEMS) expect(RARE_OF[s]).toBeTruthy();
  });

  it('has no item for Mk I or past Mk V, nor for a system there isn’t', () => {
    expect(tierItem('falcon', 'engines', 1)).toBe(null);
    expect(tierItem('falcon', 'engines', 6)).toBe(null);
    expect(tierItem('falcon', 'warp', 2)).toBe(null);
  });

  it('counts only the unbroken run from Mk II', () => {
    expect(tierOf(owning(), 'falcon', 'engines')).toBe(1);
    expect(tierOf(owning('tier:falcon:engines:2', 'tier:falcon:engines:3'), 'falcon', 'engines')).toBe(3);
    expect(tierOf(owning('tier:falcon:engines:3'), 'falcon', 'engines')).toBe(1);
    expect(tierOf(owning('tier:xwing:engines:2'), 'falcon', 'engines')).toBe(1);
    expect(tierOf(null, 'falcon', 'engines')).toBe(1);
  });

  it('lists every system’s tier for a crew', () => {
    const t = tiersOf(owning('tier:rv:hold:2'), 'rv');
    expect(Object.keys(t)).toEqual(SYSTEMS);
    expect(t.hold).toBe(2);
    expect(t.engines).toBe(1);
  });
});

describe('the core a wallet owns', () => {
  it('is Mk I with no wallet, and the tiers owned with one', () => {
    expect(coreOf(null, 'rv').reactor).toBe(0);
    const wallet = { owns: (key) => ['tier:rv:reactor:2', 'tier:rv:reactor:3'].includes(key) };
    expect(coreOf(wallet, 'rv').reactor).toBe(3);
    expect(coreOf(wallet, 'rv', { hull: 'dart' }).reactor).toBe(2);
  });
});
