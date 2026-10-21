import { describe, expect, it } from 'vitest';
import { CLIPS } from '../../../lib/clips';
import { ERU, GANDALF, VALAR, nearestStar } from './valar';

describe('the sky outside the window', () => {
  it('sets each of the Valar in the sky once, under the One’s light', () => {
    expect(VALAR.length).toBeGreaterThanOrEqual(8);
    expect(new Set(VALAR.map((v) => v.id)).size).toBe(VALAR.length);
    for (const v of VALAR) {
      expect(v.at[1], v.id).toBeGreaterThan(ERU.at[1]);
      for (const [x, y] of v.stars) {
        expect(x, v.id).toBeGreaterThanOrEqual(0);
        expect(x, v.id).toBeLessThanOrEqual(1);
        expect(y, v.id).toBeGreaterThanOrEqual(0);
        expect(y, v.id).toBeLessThan(0.7);
      }
      for (const [i, j] of v.lines) {
        expect(v.stars[i], `${v.id} ${i}`).toBeTruthy();
        expect(v.stars[j], `${v.id} ${j}`).toBeTruthy();
      }
    }
  });

  it('keeps the figures apart, so each can be pointed at', () => {
    for (const a of VALAR) for (const b of VALAR) if (a !== b) expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]), `${a.id} ${b.id}`).toBeGreaterThan(0.1);
  });

  it('says each in the site’s voice, and plays only clips the site has', () => {
    for (const v of [...VALAR, ERU, GANDALF]) {
      expect(v.say, v.id).not.toMatch(/!/);
      expect(v.say, v.id).not.toMatch(/['"]/);
      expect(v.say.length, v.id).toBeGreaterThan(30);
      if (v.clip) expect(CLIPS[v.clip], v.id).toBeTruthy();
    }
  });

  it('finds the figure nearest a point, or nothing out of reach', () => {
    expect(nearestStar(VALAR, VALAR[0].at)?.id).toBe(VALAR[0].id);
    expect(nearestStar(VALAR, [0.5, 0.95])).toBeNull();
  });
});
