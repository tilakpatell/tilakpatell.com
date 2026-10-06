import { describe, expect, it, vi } from 'vitest';
import { STEPS } from '../lib/three/pace';
import { createQuality } from './quality';

// a stand-in pace: `levels` is what each frame() call returns, in turn
const fakePace = (levels, last = STEPS.length - 1) => {
  let i = 0;
  const pace = { level: 0, scale: 1, reset: vi.fn() };
  pace.frame = () => {
    const l = levels[Math.min(i++, levels.length - 1)];
    if (l === null) return null;
    pace.level = l;
    pace.scale = STEPS[Math.min(l, last)];
    return pace.scale;
  };
  return pace;
};

describe('createQuality', () => {
  it('starts at the tier budget, sharpest', () => {
    const q = createQuality({ tier: 'mid', pace: fakePace([null]) });
    expect(q.tier).toBe('mid');
    expect(q.budget.ratio).toBe(1.5);
    expect(q.level).toBe(0);
    expect(q.scale).toBe(1);
    expect(q.ratio).toBe(1.5);
  });

  it("never draws past the screen's own pixels, nor past a module's cap", () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null]), dpr: 1 });
    expect(q.ratio).toBe(1);
    expect(q.ratioUnder(1.5)).toBe(1);
    const sharp = createQuality({ tier: 'high', pace: fakePace([null]), dpr: 3 });
    expect(sharp.ratio).toBe(2);
    expect(sharp.ratioUnder(1.5)).toBe(1.5);
    expect(sharp.ratioUnder(undefined)).toBe(2);
  });

  it('follows the pace down and tells listeners once per change', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([null, 1, null, 1, 0]) });
    const seen = [];
    q.on((l) => seen.push(l));
    expect(q.frame(0)).toBe(null);
    expect(q.frame(16)).toBe(1);
    expect(q.ratio).toBeCloseTo(2 * STEPS[1]);
    expect(q.frame(32)).toBe(null);
    expect(q.frame(48)).toBe(null); // the same level again: no change
    expect(q.frame(64)).toBe(0);
    expect(seen).toEqual([1, 0]);
    expect(q.ratio).toBe(2);
  });

  it('floors once when the last step still misses', () => {
    const last = STEPS.length - 1;
    const q = createQuality({ tier: 'low', pace: fakePace([last, ...Array(400).fill(null)]), floorAfter: 2500 });
    const seen = [];
    q.on((l) => seen.push(l));
    expect(q.frame(0)).toBe(last);
    let now = 0;
    let floored = null;
    for (let i = 1; i < 300 && floored === null; i++) {
      now += 16;
      const r = q.frame(now);
      if (r !== null) floored = { r, now };
    }
    expect(floored.r).toBe(STEPS.length);
    expect(floored.now).toBeGreaterThanOrEqual(2500);
    expect(q.level).toBe(STEPS.length);
    expect(q.scale).toBe(STEPS[last]); // the picture is no softer than the last step
    for (let i = 0; i < 200; i++) expect(q.frame((now += 16))).toBe(null); // once
    expect(seen).toEqual([last, STEPS.length]);
    q.reset();
    expect(q.level).toBe(0);
  });

  it('a listener can leave', () => {
    const q = createQuality({ tier: 'high', pace: fakePace([1, 2]) });
    const fn = vi.fn();
    const off = q.on(fn);
    q.frame(0);
    off();
    q.frame(16);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
