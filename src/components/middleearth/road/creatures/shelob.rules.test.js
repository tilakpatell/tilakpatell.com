import { describe, expect, it } from 'vitest';
import { FEAR, GROUPS, legsAt, retreat } from './shelob.rules';

describe('Shelob', () => {
  it('walks on eight legs in two groups of four, one group always down', () => {
    expect(GROUPS.flat().sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (let t = 0; t < 3; t += 0.03) {
      const legs = legsAt(t, { speed: 2 });
      expect(legs).toHaveLength(8);
      const up = GROUPS.map((g) => g.some((i) => legs[i].lift > 0));
      expect(up[0] && up[1]).toBe(false);
      for (const g of GROUPS) for (const i of g) expect(legs[i].lift).toBeCloseTo(legs[g[0]].lift, 9);
    }
  });

  it('stands with every leg down when still', () => {
    expect(legsAt(1.2, { speed: 0 }).every((l) => l.lift === 0)).toBe(true);
  });

  it('gives way to the Phial’s light only when it is bright on her', () => {
    expect(retreat(0)).toBe(false);
    expect(retreat(FEAR - 0.01)).toBe(false);
    expect(retreat(FEAR)).toBe(true);
    expect(retreat(1)).toBe(true);
    expect(retreat(NaN)).toBe(false);
  });
});
