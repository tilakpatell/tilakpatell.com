import { describe, expect, it } from 'vitest';
import { seedOf } from './seed';

// a sessionStorage of our own
const store = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

describe('the visit’s seed', () => {
  it('seedOf reads ?seed first, then the visit’s, which it keeps', () => {
    const session = store();
    expect(seedOf({ search: '?seed=4121', session })).toBe(4121);
    // (an address's seed is the address's: it isn't kept as the visit's)
    expect(session.getItem('tp-visit-seed')).toBeNull();
    const visit = seedOf({ search: '', session });
    expect(Number.isInteger(visit)).toBe(true);
    expect(session.getItem('tp-visit-seed')).toBe(String(visit));
    expect(seedOf({ search: '', session })).toBe(visit);
    expect(seedOf({ search: '?seed=5', session })).toBe(5);
    expect(seedOf({ search: '', session })).toBe(visit);
    // one already made is read back
    const older = store();
    older.setItem('tp-visit-seed', '77');
    expect(seedOf({ search: '', session: older })).toBe(77);
  });

  it('keeps one for the page when there’s no session to keep it in', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const a = seedOf({ search: '', session: broken });
    expect(Number.isInteger(a)).toBe(true);
    expect(seedOf({ search: '', session: broken })).toBe(a);
    expect(seedOf({ search: '', session: null })).toBe(a);
  });
});
