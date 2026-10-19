import { describe, expect, it } from 'vitest';
import { COOLDOWN, DREAD_DOWN, DREAD_UP, canWear, newRing, stepRing, wear } from './ring';

const run = (r, s, n = Math.round(s * 60)) => {
  let x = r;
  const events = [];
  for (let i = 0; i < n; i++) {
    x = stepRing(x, 1 / 60);
    if (x.torn) events.push('torn');
  }
  return [x, events];
};

describe('the Ring', () => {
  it('starts off, the world as it is', () => {
    expect(newRing()).toMatchObject({ worn: false, vision: 0, dread: 0, torn: false });
  });

  it('drains the world in about 0.4 s when it goes on, and back when it comes off', () => {
    const [on] = run(wear(newRing(), true), 0.45);
    expect(on.vision).toBe(1);
    const [off] = run(wear(on, false), 0.45);
    expect(off.vision).toBe(0);
  });

  it('brings the Eye closer while it is worn, and lets it go slower than it came', () => {
    const [on] = run(wear(newRing(), true), 10);
    expect(on.dread).toBeCloseTo(10 * DREAD_UP, 1);
    const [off] = run(wear(on, false), 4);
    expect(off.dread).toBeCloseTo(Math.max(0, 10 * DREAD_UP - 4 * DREAD_DOWN), 1);
  });

  it('is torn off when the Eye arrives, once, and cannot go back on for a while', () => {
    const [x, events] = run(wear(newRing(), true), 1 / DREAD_UP + 0.5);
    expect(events).toEqual(['torn']);
    expect(x.worn).toBe(false);
    expect(canWear(x)).toBe(false);
    expect(wear(x, true).worn).toBe(false);
    const [later] = run(x, COOLDOWN + 0.1);
    expect(canWear(later)).toBe(true);
    expect(wear(later, true).worn).toBe(true);
  });
});
