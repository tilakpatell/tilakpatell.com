import { describe, expect, it } from 'vitest';
import { GOOD_NAME } from '../catalog';
import { RARE_OF } from '../ships/tiers';
import { FAMILIES, GOODS, goodById, isGood } from './goods';

describe('the goods', () => {
  it('gives every good a family, a name and a whole price', () => {
    for (const g of Object.values(GOODS)) {
      expect(FAMILIES).toContain(g.family);
      expect(g.name).toBeTruthy();
      expect(Number.isInteger(g.base) && g.base > 0).toBe(true);
    }
  });

  it('has every rare a ship’s tier takes, and its pure grade, named as the lock names it', () => {
    for (const rare of new Set(Object.values(RARE_OF))) {
      expect(goodById(rare)).toMatchObject({ rare: true });
      expect(goodById(`${rare}-pure`)).toMatchObject({ rare: true, pure: true });
      expect(GOOD_NAME[rare].toLowerCase()).toContain(goodById(rare).name.toLowerCase());
      expect(GOOD_NAME[`${rare}-pure`].toLowerCase()).toContain(goodById(`${rare}-pure`).name.toLowerCase());
    }
  });

  it('knows a good by its id only', () => {
    expect(isGood('spice')).toBe(true);
    expect(isGood('toString')).toBe(false);
    expect(goodById('nothing')).toBe(null);
    expect(goodById('contraband').contraband).toBe(true);
  });
});
