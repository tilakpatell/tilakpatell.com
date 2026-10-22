import { describe, expect, it } from 'vitest';
import { handAngles, swing } from './castle';
import { bakeLand } from '../land';
import { heightAt } from '../terrain';
import { placeById } from '../../rules/places';

describe('the clock tower', () => {
  it('keeps the world’s time on its hands', () => {
    expect(handAngles(12)).toEqual({ hour: 0, minute: 0 });
    expect(handAngles(15).hour).toBeCloseTo(Math.PI / 2, 9);
    expect(handAngles(15.5).minute).toBeCloseTo(Math.PI, 9);
    expect(handAngles(21).hour).toBeCloseTo((3 * Math.PI) / 2, 9);
  });

  it('swings its pendulum there and back, no further than its arc', () => {
    let lo = 0;
    let hi = 0;
    for (let t = 0; t < 20; t += 0.05) {
      lo = Math.min(lo, swing(t));
      hi = Math.max(hi, swing(t));
    }
    expect(hi).toBeGreaterThan(0.1);
    expect(hi).toBeLessThan(0.3);
    expect(lo).toBeCloseTo(-hi, 2);
  });
});

describe('the land, baked', () => {
  it('reads what the field says, between its samples, and the ways where they run', () => {
    const land = bakeLand({ step: 10 });
    for (const id of ['castle', 'lawn', 'pitch', 'station', 'hut']) {
      const [x, z] = placeById(id).at;
      expect(land.heightAt(x, z)).toBeCloseTo(heightAt(x, z), 0);
    }
    expect(land.pathAt(170, -30)).toBeLessThan(1);
    expect(land.coverAt(...placeById('forest').at).forest).toBeGreaterThan(0.8);
    // (past the ground’s edge, the field itself)
    expect(land.heightAt(1000, 1000)).toBe(heightAt(1000, 1000));
  });
});
