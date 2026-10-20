import { describe, expect, it } from 'vitest';
import { replay } from './tumble.rules';

describe('a tumble’s replay', () => {
  it('stands still before its beat, and is put back when the walker goes back before it', () => {
    expect(replay(null, null)).toEqual({ reset: false, run: 0 });
    expect(replay(3, null)).toEqual({ reset: true, run: 0 });
  });

  it('runs on by the time that passed, from the start when it begins', () => {
    expect(replay(null, 0.5)).toEqual({ reset: true, run: 0.5 });
    expect(replay(1, 1.25)).toEqual({ reset: false, run: 0.25 });
  });

  it('a step back in its own time plays it again from the start, the same way', () => {
    expect(replay(4, 2)).toEqual({ reset: true, run: 2 });
  });

  it('a beat long done (a jump past it) runs at most a settled while, not forever', () => {
    const r = replay(null, Infinity);
    expect(r.reset).toBe(true);
    expect(Number.isFinite(r.run)).toBe(true);
    expect(r.run).toBeGreaterThan(0);
    expect(replay(2, 10000).run).toBeLessThanOrEqual(replay(null, Infinity).run);
  });
});
