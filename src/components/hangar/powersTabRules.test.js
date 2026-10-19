import { describe, expect, it } from 'vitest';
import { choicesOf, lengthsOf } from './powersTabRules';

describe('the Hangar’s powers', () => {
  it('offer each slot the ship’s own first, then the other crews’, each locked till the node that lends it', () => {
    const g = choicesOf('xwing', 'primary', []);
    expect(g.map((c) => c.id)).toEqual(['focus', 'odds', 'portal', 'magnets']);
    expect(g[0]).toMatchObject({ crew: 'xwing', own: true, locked: false, opens: null });
    expect(g[2]).toMatchObject({ crew: 'cruiser', own: false, locked: true, opens: 'Portal tech' });
    expect(choicesOf('xwing', 'primary', ['cruiser'])[2].locked).toBe(false);
    expect(choicesOf('rv', 'ultimate', []).map((c) => c.id)).toEqual(['heisenberg', 'salvo', 'quad', 'wubba']);
  });
  it('offer nothing to a ship with no powers', () => {
    expect(choicesOf('nope', 'primary', [])).toEqual([]);
    expect(choicesOf(null, 'ultimate', null)).toEqual([]);
  });
  it('say a power’s lengths with the skills on them', () => {
    expect(lengthsOf('focus', {})).toEqual({ dur: 5, cool: 22 });
    expect(lengthsOf('focus', { powerDur: 1.2, powerCool: 0.85 })).toEqual({ dur: 6, cool: 18.7 });
    expect(lengthsOf('salvo', { powerDur: 1.2 }).cool).toBe(null);
  });
});
