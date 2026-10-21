import { describe, expect, it, vi } from 'vitest';
import { LOADERS, WARM_R, doorNear, warmDoor } from './warm';
import { PLACES, START } from './rules';

describe('the doors, fetched ahead', () => {
  it('names the door within 15 m, and none from the start', () => {
    expect(WARM_R).toBe(15);
    for (const p of PLACES) {
      expect(doorNear(p.x + 10, p.z)).toBe(p.id);
      expect(doorNear(p.x + 16, p.z)).toBe(null);
    }
    expect(doorNear(START.x, START.z)).toBe(null); // the nearest door is 33 m from the start; doors are 36 m apart at the closest
  });
  it('has a game to fetch for every door', () => {
    expect(Object.keys(LOADERS).sort()).toEqual(PLACES.map((p) => p.id).sort());
  });
  it('fetches a door’s game once, and warms its module', async () => {
    const warm = vi.fn(() => Promise.resolve());
    const loaders = { stark: vi.fn(() => Promise.resolve([{}, {}, { default: { warm } }])) };
    const warmed = new Set();
    const a = warmDoor('stark', { loaders, warmed });
    expect(warmDoor('stark', { loaders, warmed })).toBe(null);
    await a;
    expect(loaders.stark).toHaveBeenCalledTimes(1);
    expect(warm).toHaveBeenCalledTimes(1);
    expect(warmDoor('nowhere', { loaders, warmed })).toBe(null);
  });
  it('tries again after a fetch that failed', async () => {
    const loaders = { stark: vi.fn(() => Promise.reject(new Error('offline'))) };
    const warmed = new Set();
    await warmDoor('stark', { loaders, warmed });
    expect(warmed.has('stark')).toBe(false);
    const again = warmDoor('stark', { loaders, warmed });
    expect(again).not.toBe(null);
    await again;
    expect(loaders.stark).toHaveBeenCalledTimes(2);
  });
});
