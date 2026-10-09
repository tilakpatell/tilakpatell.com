import { describe, expect, it } from 'vitest';
import { FINGERS, POSES, gripFor, mix } from './handPoses';

const total = (p) => FINGERS.reduce((s, f) => s + p[f].reduce((a, b) => a + b, 0), 0);

describe('POSES', () => {
  it('gives every pose a curl for each joint of each finger, and a spread', () => {
    for (const [name, p] of Object.entries(POSES)) {
      expect(p.thumb, name).toHaveLength(2);
      for (const f of FINGERS) expect(p[f], `${name} ${f}`).toHaveLength(3);
      expect(Number.isFinite(p.spread), name).toBe(true);
      for (const v of [...p.thumb, ...FINGERS.flatMap((f) => p[f])]) expect(Number.isFinite(v)).toBe(true);
    }
  });
  it('closes a fist further than a hand at rest, and a hand at rest further than an open one', () => {
    expect(total(POSES.fist)).toBeGreaterThan(total(POSES.relaxed));
    expect(total(POSES.relaxed)).toBeGreaterThan(total(POSES.open));
    expect(total(POSES.open)).toBe(0);
  });
  it('points with the index straight and the rest closed, and leaves the thumb up for a thumbs-up', () => {
    expect(POSES.point.index).toEqual([0, 0, 0]);
    expect(POSES.point.middle[1]).toBeGreaterThan(1);
    expect(POSES.thumbs.thumb.every((c) => c <= 0)).toBe(true);
    expect(POSES.thumbs.ring[1]).toBeGreaterThan(1);
    expect(POSES.spread.spread).toBeGreaterThan(POSES.open.spread);
  });
});

describe('gripFor', () => {
  it('closes further round a thinner grip, never past a joint’s reach', () => {
    const pistol = gripFor(0.014, 0.09);
    const rifle = gripFor(0.028, 0.09);
    expect(total(pistol)).toBeGreaterThan(total(rifle));
    for (const f of FINGERS) for (const c of pistol[f]) expect(c).toBeLessThanOrEqual(1.6);
  });
  it('wraps a finger’s length round the grip’s girth, out to the finger’s middle', () => {
    const g = gripFor(0.03, 0.09);
    const want = 0.09 / (0.03 + 0.009);
    expect(g.middle.reduce((a, b) => a + b)).toBeCloseTo(want, 6);
  });
  it('keeps the trigger’s index straighter than the grip’s', () => {
    expect(POSES.trigger.index[0]).toBeLessThan(POSES.grip.index[0]);
    expect(POSES.trigger.middle).toEqual(POSES.grip.middle);
  });
});

describe('mix', () => {
  it('runs from one pose to the other', () => {
    expect(mix(POSES.open, POSES.fist, 0)).toEqual(POSES.open);
    expect(mix(POSES.open, POSES.fist, 1)).toEqual(POSES.fist);
    const half = mix(POSES.open, POSES.fist, 0.5);
    expect(half.index[1]).toBeCloseTo(POSES.fist.index[1] / 2, 9);
    expect(half.spread).toBeCloseTo((POSES.open.spread + POSES.fist.spread) / 2, 9);
  });
});
