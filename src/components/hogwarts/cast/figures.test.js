import { describe, expect, it } from 'vitest';
import { HEIGHTS, STAND_IN, cutOf, heightOf, moveFor } from './figures';
import CAST from '../../../../public/models/hogwarts/cast/cast.json';
import { NAMES } from '../rules/lines';

describe('the cast’s figures', () => {
  it('stands everyone who speaks in by a figure until Lane B’s is made, one line a name', () => {
    for (const who of Object.keys(NAMES)) {
      if (who === 'hat' || who === 'prefect') continue;
      expect(STAND_IN[who], who).toBeTruthy();
    }
    for (const v of Object.values(STAND_IN)) expect(v).toMatch(/^[a-z]+$/);
  });

  it('sizes Hagrid half again a man, Flitwick and the elves under a metre, the students as children', () => {
    expect(heightOf('hagrid')).toBe(2.6);
    expect(heightOf('flitwick')).toBeLessThan(1);
    expect(heightOf('elf')).toBeLessThan(1);
    expect(heightOf('firstyear')).toBeLessThan(1.5);
    expect(heightOf('mcgonagall')).toBeGreaterThan(1.6);
    for (const h of Object.values(HEIGHTS)) expect(h).toBeGreaterThan(0.5);
  });

  it('paces the feet as locomotion reads them: still, walking, running', () => {
    expect(moveFor(0, 1, 3)).toBe(0);
    expect(moveFor(1, 1, 3)).toBeGreaterThan(0.3);
    expect(moveFor(1, 1, 3)).toBeLessThan(0.55);
    expect(moveFor(10, 1, 3)).toBe(1);
  });

  it('takes Lane B’s cut for the tier: hq on high, the plain one on mid, lo on low', () => {
    const entry = CAST.figures.snape;
    expect(cutOf(entry, 'high')).toBe('snape.hq.glb');
    expect(cutOf(entry, 'ultra')).toBe('snape.hq.glb');
    expect(cutOf(entry, 'mid')).toBe('snape.glb');
    expect(cutOf(entry, 'low')).toBe('snape.lo.glb');
    expect(cutOf({ cuts: { mid: 'x.glb' } }, 'high')).toBe('x.glb');
    expect(cutOf(null, 'high')).toBeNull();
    // (every figure Lane B lists has its cuts and its own walk)
    for (const [name, e] of Object.entries(CAST.figures)) {
      expect(cutOf(e, 'mid'), name).toBeTruthy();
      expect(e.clips?.walk, name).toBeTruthy();
    }
  });
});
