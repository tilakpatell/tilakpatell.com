import { describe, expect, it } from 'vitest';
import { GOODS } from './goods';
import { MINED_OUT, yieldOf } from './yields';

describe('what working a thing gives', () => {
  it('gives ore from a field and salvage from a wreck, the same each time', () => {
    const f = yieldOf({ kind: 'field', id: 'E:3,1:f2', press: 0 });
    expect(['iron', 'titanium']).toContain(f[0].good);
    expect(yieldOf({ kind: 'field', id: 'E:3,1:f2', press: 0 })).toEqual(f);
    const w = yieldOf({ kind: 'derelict', id: 'E:3,1:d7' }).map((g) => g.good);
    expect(w).toEqual(expect.arrayContaining(['scrap', 'components']));
    expect(MINED_OUT).toBe(5);
  });

  it('gives nothing for a kind that isn’t worked', () => {
    expect(yieldOf({ kind: 'relay', id: 'x' })).toEqual([]);
  });

  it('gives a far graveyard’s relics now and then, and never near home', () => {
    const far = Array.from({ length: 200 }, (_, i) => yieldOf({ kind: 'derelict', id: `w${i}`, area: { id: 'grave' }, d: 12 })).flat();
    expect(far.some((g) => g.good === 'relics')).toBe(true);
    const near = Array.from({ length: 200 }, (_, i) => yieldOf({ kind: 'derelict', id: `w${i}`, area: { id: 'grave' }, d: 3 })).flat();
    expect(near.some((g) => GOODS[g.good].rare)).toBe(false);
  });
});
