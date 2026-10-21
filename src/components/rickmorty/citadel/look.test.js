import { describe, expect, it } from 'vitest';
import { alarmGrade } from './look';

describe('the Citadel’s alarm, the one grade it keeps', () => {
  it('changes nothing on an ordinary day', () => {
    expect(alarmGrade(0, 0, false)).toEqual({ vignette: 0, high: [0, 0, 0], shadow: [0, 0, 0] });
  });

  it('closes in and pulses red on red alert, and closes in more while he’s chased', () => {
    const g = alarmGrade(1, 1, true);
    expect(g.vignette).toBeCloseTo(0.3, 5);
    expect(g.high).toEqual([0.05, 0, 0]);
    expect(g.shadow).toEqual([0.025, 0, 0]);
    expect(alarmGrade(0, 0, true).vignette).toBeCloseTo(0.12, 5);
    expect(alarmGrade(0.5, 0, false).vignette).toBeCloseTo(0.09, 5);
  });

  it('writes into the grade it’s given and hands it back, so a frame makes nothing new', () => {
    const out = { vignette: 9, high: [9, 9, 9], shadow: [9, 9, 9] };
    const g = alarmGrade(1, 0.5, false, out);
    expect(g).toBe(out);
    expect(out).toEqual({ vignette: 0.18, high: [0.025, 0, 0], shadow: [0.0125, 0, 0] });
  });
});
