import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAVE, clearReward, loadSave, readSave, saveClear, withClear } from './save';

// a localStorage that lives for one test (hq/hq.test.js)
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('Ricochet’s save, one for both views', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reads tp-hq-ricochet in the shape the 3D game writes, clamped', () => {
    expect(SAVE).toBe('tp-hq-ricochet');
    expect(readSave(null)).toEqual({ reached: 1, stars: [] });
    expect(readSave({ reached: 99, stars: [5, -1, '2', null] })).toEqual({ reached: 12, stars: [3, 0, 2, 0] });
    expect(readSave({ reached: 0 }).reached).toBe(1);
  });
  it('keeps the best stars and opens the next room', () => {
    expect(withClear({ reached: 1, stars: [] }, 0, 2)).toEqual({ reached: 2, stars: [2] });
    expect(withClear({ reached: 5, stars: [3] }, 0, 1)).toEqual({ reached: 5, stars: [3] });
    expect(withClear({ reached: 12, stars: [] }, 11, 3).reached).toBe(12);
  });
  it('writes { reached, stars } to tp-hq-ricochet and reads it back', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    saveClear({ reached: 1, stars: [] }, 0, 3);
    expect(JSON.parse(window.localStorage.getItem('tp-hq-ricochet'))).toEqual({ reached: 2, stars: [3] });
    expect(loadSave()).toEqual({ reached: 2, stars: [3] });
  });
  it('gives the Mind Stone and Cap’s achievement for the last room only', () => {
    expect(clearReward(11)).toEqual({ stone: 'mind', achievement: 'captain' });
    expect(clearReward(0)).toBeNull();
    expect(clearReward(10)).toBeNull();
  });
});

