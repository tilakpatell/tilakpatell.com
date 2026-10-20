import { describe, expect, it } from 'vitest';
import { ARMS, GRAB, arm } from './watcher.rules';

describe('the Watcher’s arms', () => {
  it('twelve arms, still under the water before the beat', () => {
    expect(ARMS).toBe(12);
    for (let i = 0; i < ARMS; i++) expect(arm(-1, i)).toEqual({ reach: 0, lift: 0, sway: 0 });
  });

  it('come out of the lake by turns and reach toward the shore', () => {
    const out = (t) => Array.from({ length: ARMS }, (_, i) => arm(t, i).reach);
    const early = out(1);
    const late = out(5);
    expect(late.reduce((a, b) => a + b)).toBeGreaterThan(early.reduce((a, b) => a + b));
    expect(new Set(early.map((r) => r.toFixed(3))).size).toBeGreaterThan(1);
    for (let t = 0; t < 12; t += 0.25)
      for (let i = 0; i < ARMS; i++) {
        const a = arm(t, i);
        expect(a.reach).toBeGreaterThanOrEqual(0);
        expect(a.reach).toBeLessThanOrEqual(1);
        expect(a.lift).toBeGreaterThanOrEqual(0);
        expect(a.lift).toBeLessThanOrEqual(1);
      }
  });

  it('the first arm lifts Frodo, lets him go when it is cut, and all go back as the Doors fall', () => {
    expect(arm(GRAB.lift + 1.5, 0).lift).toBeGreaterThan(0.8);
    expect(arm(GRAB.cut + 1, 0).lift).toBeLessThan(0.2);
    for (let i = 1; i < ARMS; i++) expect(arm(GRAB.lift + 1.5, i).lift).toBe(0);
    for (let i = 0; i < ARMS; i++) expect(arm(GRAB.back + 3, i).reach).toBeLessThan(0.1);
  });
});
