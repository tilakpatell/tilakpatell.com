import { describe, expect, it } from 'vitest';
import { CHEER, newCheer, stepCheer } from './cheer';
import { hopOf } from '../dimensions/crowdPose';
import { WORLDS } from '../dimensions/worlds';

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
    expect(CHEER).toEqual({ s: 6, beat: 1.5 });
    expect(hops).toEqual([1, 2.5, 4, 5.5, 7]);
  });

  it('lets a hop ripple through the biggest gathering before the next beat starts another', () => {
    // (each beat starts every gathering's hop again: one that hasn't landed is cut short)
    const counts = Object.values(WORLDS).flatMap((w) => [...(w.crowd?.gather ?? []), ...(w.stands ?? [])].map((g) => g.n?.high ?? 0));
    const most = Math.max(...counts);
    let landed = 0;
    for (let t = 0; t < 3; t += 0.005) if (hopOf(t, 0, most - 1) > 0) landed = t;
    expect(CHEER.beat).toBeGreaterThan(landed);
  });

  it('cheers again only once it’s started afresh, as a place calmed starts it', () => {
    const cheered = steps(steps(newCheer(), false, 0, 9).c, true, 10, 100).c;
    expect(steps(cheered, true, 101, 200).hops).toEqual([]);
    const fresh = steps(newCheer(), false, 0, 0).c;
    expect(steps(fresh, true, 1, 40).hops.slice(0, 3)).toEqual([0.1, 1.6, 3.1]);
  });
});
