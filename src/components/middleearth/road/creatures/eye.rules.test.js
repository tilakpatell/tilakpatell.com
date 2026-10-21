import { describe, expect, it } from 'vitest';
import { SWEEP, onYou, sweep } from './eye.rules';

describe('the Eye', () => {
  it('sweeps the same way every SWEEP seconds, within a half turn either way', () => {
    for (let t = 0; t < SWEEP; t += 0.5) {
      expect(sweep(t + SWEEP).yaw).toBeCloseTo(sweep(t).yaw, 9);
      expect(Math.abs(sweep(t).yaw)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    }
  });

  it('pauses at each end of its sweep, and moves between', () => {
    const pauses = [];
    for (let t = 0; t < SWEEP; t += 0.1) if (sweep(t).pause) pauses.push(t);
    expect(pauses.length).toBeGreaterThan(0);
    expect(pauses.length).toBeLessThan(SWEEP / 0.1);
    const moving = [...Array(Math.round(SWEEP / 0.1)).keys()].map((i) => i * 0.1).find((t) => !sweep(t).pause);
    expect(Math.abs(sweep(moving + 0.1).yaw - sweep(moving).yaw)).toBeGreaterThan(0);
  });

  it('is on you within its beam’s half width, the short way round', () => {
    expect(onYou(0.1, 0)).toBe(true);
    expect(onYou(0.5, 0)).toBe(false);
    expect(onYou(Math.PI - 0.05, -Math.PI + 0.05)).toBe(true);
  });
});
