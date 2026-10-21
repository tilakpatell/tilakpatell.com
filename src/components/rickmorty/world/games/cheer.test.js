import { describe, expect, it } from 'vitest';
import { CHEER, newCheer, stepCheer } from './cheer';

// steps a tenth of a second apart, from tick `a` to tick `b`: the last state and when it hopped
const steps = (c, done, a, b) => {
  const hops = [];
  for (let i = a; i <= b; i++) {
    c = stepCheer(c, { done, t: i / 10 });
    if (c.hop) hops.push(i / 10);
  }
  return { c, hops };
};

describe('a crowd cheering its place’s game won', () => {
  it('only notes on the first step of a visit whether the task’s done, and cheers for neither', () => {
    expect(steps(newCheer(), true, 0, 100).hops).toEqual([]);
    expect(steps(newCheer(), false, 0, 100).hops).toEqual([]);
  });

  it('cheers on the beat for six seconds from the step the task’s done', () => {
    const before = steps(newCheer(), false, 0, 9).c;
    const { hops } = steps(before, true, 10, 100);
    expect(CHEER).toEqual({ s: 6, beat: 0.5 });
    expect(hops).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7]);
  });

  it('cheers again only once it’s started afresh, as a place calmed starts it', () => {
    const cheered = steps(steps(newCheer(), false, 0, 9).c, true, 10, 100).c;
    expect(steps(cheered, true, 101, 200).hops).toEqual([]);
    const fresh = steps(newCheer(), false, 0, 0).c;
    expect(steps(fresh, true, 1, 20).hops.slice(0, 3)).toEqual([0.1, 0.6, 1.1]);
  });
});
