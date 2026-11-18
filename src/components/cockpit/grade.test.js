import { describe, expect, it } from 'vitest';
import { GRADE, bloomSize, gradeOf, whiteOutAt } from './grade';
import { PLANS } from './timeline';

describe('the launches’ grade', () => {
  it('has a row for every launch, each a curve, an exposure and a bloom', () => {
    expect(Object.keys(GRADE).sort()).toEqual(Object.keys(PLANS).sort());
    for (const [id, g] of Object.entries(GRADE)) {
      expect(['neutral', 'none'], id).toContain(g.tone);
      expect(g.exposure, id).toBeGreaterThan(0.5);
      expect(g.exposure, id).toBeLessThan(2);
      const b = g.bloom;
      for (const k of ['threshold', 'knee', 'strength', 'veil', 'sharpness']) expect(typeof b[k], `${id}.${k}`).toBe('number');
      // (only what's past lit paint glares: a lit button or a glint stays a point)
      expect(b.threshold, id).toBeGreaterThanOrEqual(1);
      // (the veil a lens's scatter, a few per cent, not a fog)
      expect(b.veil, id).toBeLessThanOrEqual(0.05);
      expect(b.sharpness, id).toBeGreaterThan(0);
      expect(b.sharpness, id).toBeLessThan(1);
    }
  });

  it('takes the Falcon’s for a launch it doesn’t know', () => {
    expect(gradeOf('nope')).toBe(GRADE.falcon);
    expect(gradeOf('rv')).toBe(GRADE.rv);
  });

  it('burns into the white as the flash rises, and leaves the picture alone without one', () => {
    expect(whiteOutAt(0)).toEqual({ lift: 1, glow: 1 });
    const half = whiteOutAt(0.5);
    const full = whiteOutAt(1);
    expect(half.lift).toBeGreaterThan(1);
    expect(full.lift).toBeGreaterThan(half.lift);
    expect(full.glow).toBeGreaterThan(half.glow);
    expect(whiteOutAt(3)).toEqual(full);
    expect(whiteOutAt(-1)).toEqual(whiteOutAt(0));
  });

  it('works the bloom out at half the frame, its long side capped', () => {
    expect(bloomSize(1280, 720)).toEqual([640, 360]);
    expect(bloomSize(3840, 2160)).toEqual([640, 360]);
    expect(bloomSize(1080, 2400)).toEqual([288, 640]);
    expect(bloomSize(40, 40)).toEqual([64, 64]);
  });
});
