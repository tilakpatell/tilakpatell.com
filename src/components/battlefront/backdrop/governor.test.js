import { describe, expect, it } from 'vitest';
import { STEPS, createGovernor, startStep } from './governor';

const FRAME = 1000 / 60;
// a window of 60 frames drawn, `late` of them late
const run = (g, late, { frame = FRAME } = {}) => {
  let out = null;
  for (let i = 0; i < 60; i++) out = g.frame(i < late ? frame * 2 : frame, frame) ?? out;
  return out;
};

describe('the backdrop’s governor', () => {
  it('starts from the device: high at the top, mid one down, low near the bottom, the page one more, reduced motion still', () => {
    expect(startStep({ level: 'ultra' })).toBe(0);
    expect(startStep({ level: 'mid' })).toBe(1);
    expect(startStep({ level: 'low' })).toBe(3);
    expect(startStep({ level: 'high', page: true })).toBe(1);
    expect(startStep({ level: 'high', reduced: true })).toBe(STEPS.length - 1);
    expect(STEPS.at(-1).still).toBe(true);
  });

  it('steps down after a window with six late frames, and not before', () => {
    const g = createGovernor({ start: 0 });
    expect(run(g, 5)).toBe(null);
    expect(run(g, 6)).toBe(1);
    expect(g.step).toBe(1);
  });

  it('never steps past the still', () => {
    const g = createGovernor({ start: STEPS.length - 1 });
    expect(run(g, 60)).toBe(null);
  });

  it('steps up after five clean windows, never above the top', () => {
    const g = createGovernor({ start: 2 });
    for (let i = 0; i < 4; i++) expect(run(g, 1)).toBe(null);
    expect(run(g, 0)).toBe(1);
    const top = createGovernor({ start: 0 });
    for (let i = 0; i < 6; i++) expect(run(top, 0)).toBe(null);
  });

  it('does not try again a step that failed in the last 20 s', () => {
    let t = 0;
    const g = createGovernor({ start: 0, now: () => t });
    expect(run(g, 10)).toBe(1);
    for (let i = 0; i < 5; i++) expect(run(g, 0)).toBe(null);
    t = 21000;
    for (let i = 0; i < 4; i++) run(g, 0);
    expect(run(g, 0)).toBe(0);
  });

  it('counts late against the display’s own frame where it is slower than 60 Hz', () => {
    const g = createGovernor({ start: 0 });
    expect(run(g, 0, { frame: 20 })).toBe(null);
  });
});
