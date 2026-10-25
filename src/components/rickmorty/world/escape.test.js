import { describe, expect, it } from 'vitest';
import { madeIt } from './escape';

// Anatomy Park's run, its clock started at 100 s with 30 s on it
const RUN = { area: 'anatomy', task: 'anatomy', s: 30, at: 100 };

describe('a place left in a hurry, judged at the press of its portal home', () => {
  it('is made by an escape stepped into 0.1 s before its end', () => {
    expect(madeIt(RUN, 'anatomy-portal', 100 + 30 - 0.1)).toBe(true);
    expect(madeIt(RUN, 'anatomy-portal', 100)).toBe(true);
  });

  it('is made at exactly its time, and not a moment after', () => {
    expect(madeIt(RUN, 'anatomy-portal', 130)).toBe(true);
    expect(madeIt(RUN, 'anatomy-portal', 130.01)).toBe(false);
  });

  it('isn’t made through another link, nor with no clock running', () => {
    expect(madeIt(RUN, 'garage-portal', 110)).toBe(false);
    expect(madeIt(RUN, 'squanch-portal', 110)).toBe(false);
    expect(madeIt(RUN, undefined, 110)).toBe(false);
    expect(madeIt(null, 'anatomy-portal', 110)).toBe(false);
  });
});
