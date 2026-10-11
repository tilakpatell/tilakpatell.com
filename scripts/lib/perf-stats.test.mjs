import { describe, expect, it } from 'vitest';
import { DROP_MS, frameStdev } from './perf-stats.mjs';

describe('the spread of frame-to-frame times', () => {
  it('is 0 for an even pace', () => {
    expect(frameStdev([16.7, 16.7, 16.7, 16.7])).toBe(0);
  });

  it('is the population standard deviation of the deltas: 16 and 18 alternating is 1 ms', () => {
    expect(frameStdev([16, 18, 16, 18])).toBeCloseTo(1, 12);
  });

  it('drops a pause (a tab in the background): deltas over 250 ms are not frames, as lib/three/pace drops them', () => {
    expect(DROP_MS).toBe(250);
    expect(frameStdev([16, 18, 4000, 16, 18])).toBeCloseTo(1, 12);
    expect(frameStdev([16, 18, 250, 16, 18])).toBeGreaterThan(1);
  });

  it('is null with fewer than two frames to compare', () => {
    expect(frameStdev([])).toBeNull();
    expect(frameStdev([16])).toBeNull();
    expect(frameStdev([16, 900])).toBeNull();
  });
});
