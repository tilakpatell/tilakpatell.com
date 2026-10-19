import { describe, expect, it } from 'vitest';
import { DROP, EYE, newStone, nearest, stepStone } from './stone';

const PINS = [
  { id: 'a', at: [0, 0] },
  { id: 'b', at: [100, 0] },
  { id: 'c', at: [0, 100] },
];

describe('the Palantír', () => {
  it('looks at the pin nearest the middle of the stone', () => {
    expect(nearest(PINS, [10, 5])?.id).toBe('a');
    expect(nearest(PINS, [80, 10])?.id).toBe('b');
    expect(nearest(PINS, [400, 400], 60)).toBeNull();
  });

  it('lets the gaze grow while held still, and rest while turned', () => {
    let s = stepStone(newStone(), 1, { held: true, turning: false });
    expect(s.gaze).toBeCloseTo(1);
    s = stepStone(s, 1, { held: true, turning: true });
    expect(s.gaze).toBeCloseTo(1);
  });

  it('opens the Eye at EYE seconds and drops the stone at DROP', () => {
    let s = newStone();
    let dropped = 0;
    for (let t = 0; t < DROP + 1; t += 0.1) {
      s = stepStone(s, 0.1, { held: true, turning: false });
      if (s.dropped) dropped++;
      if (t > EYE + 0.2 && t < DROP - 0.2) expect(s.eye).toBeGreaterThan(0);
    }
    expect(dropped).toBe(1);
    expect(s.held).toBe(false);
  });

  it('forgets the gaze when put down', () => {
    let s = stepStone(newStone(), 10, { held: true, turning: false });
    s = stepStone(s, 1, { held: false });
    expect(s.gaze).toBe(0);
    expect(s.eye).toBe(0);
  });
});
