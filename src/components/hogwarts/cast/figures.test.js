import { describe, expect, it } from 'vitest';
import { HEIGHTS, STAND_IN, heightOf, moveFor } from './figures';
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
});
