import { describe, expect, it } from 'vitest';
import { SHARES, loadSteps } from './loadSteps';

const told = () => {
  const seen = [];
  return { seen, steps: loadSteps((value, step) => seen.push([Number(value.toFixed(4)), step])) };
};

describe('loadSteps', () => {
  it('tells each part of the wait in its own share of the bar, under its own words', () => {
    const { seen, steps } = told();
    steps.maps(0.5);
    steps.maps(1);
    steps.shaders(0.5);
    steps.shaders(1);
    steps.near(1);
    steps.prepare(0, 'pictures');
    steps.prepare(1, 'first draw');
    expect(seen).toEqual([
      [0.075, 'load'],
      [0.15, 'load'],
      [0.3, 'shaders'],
      [0.45, 'shaders'],
      [0.5, 'load'],
      [0.5, 'pictures'],
      [0.97, 'first draw'],
    ]);
  });

  it('never goes back: a model that comes in late holds the bar where the shaders left it', () => {
    const { seen, steps } = told();
    steps.shaders(1);
    steps.near(0);
    steps.maps(0.2);
    expect(seen.map(([v]) => v)).toEqual([0.45, 0.45, 0.45]);
    expect(seen.map(([, s]) => s)).toEqual(['shaders', 'load', 'load']);
  });

  it('takes nonsense as nothing done, and too much as all of it', () => {
    const { seen, steps } = told();
    steps.maps(Number.NaN);
    steps.maps(-1);
    steps.maps(3);
    expect(seen.map(([v]) => v)).toEqual([0, 0, 0.15]);
  });

  it('leaves the bar’s last 3% to the tune and the first frame (the runtime’s report)', () => {
    expect(SHARES.prepare[1]).toBe(0.97);
    const ends = Object.values(SHARES);
    for (let i = 1; i < ends.length; i++) expect(ends[i][0]).toBe(ends[i - 1][1]);
  });
});
