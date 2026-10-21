import { describe, expect, it } from 'vitest';
import { MERES, POOLS, clearOf, hollowsOf } from './water';
import { stageById } from '../index';

const ALL = [...POOLS, ...MERES];

describe('the Dead Marshes’ water', () => {
  it('keeps every mere 4 m or more off the track, and none on another', () => {
    for (const m of MERES) expect(Math.abs(m.at[0]) - m.r).toBeGreaterThanOrEqual(4);
    for (const [i, a] of ALL.entries())
      for (const b of ALL.slice(i + 1)) expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1])).toBeGreaterThan(a.r + b.r);
  });
  it('lies all the way over the marsh, after the cliff and before Dagorlad’s slag', () => {
    const zs = ALL.map((p) => p.at[1]);
    expect(Math.min(...zs)).toBeLessThanOrEqual(45);
    expect(Math.max(...zs)).toBeGreaterThanOrEqual(115);
  });
  it('is sunk in the ground and left unplanted there', () => {
    const g = stageById('marshes').ground;
    const islands = g.spec.relief.filter((l) => l.type === 'island');
    expect(islands).toEqual([...hollowsOf(POOLS, -1.6), ...hollowsOf(MERES, -1.1)]);
    expect(g.clear).toEqual(clearOf(ALL));
    // (the layers there before keep their places, and so their seeds: the mountains sixth)
    expect(g.spec.relief.findIndex((l) => l.type === 'mountains')).toBe(5);
  });
});
