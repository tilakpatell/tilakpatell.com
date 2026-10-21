import { describe, expect, it } from 'vitest';
import { lineCadence, shotPunch } from './gunRules';

// (the weapons' numbers as universe/weaponTable.js has them)
const flak = { punch: 0.45, cadence: 2 };
const heavy = { punch: 8, cadence: 3.2 };

describe('the galaxy’s guns, every line', () => {
  it('lands the fitted guns’ punch, times the pickup’s, times the weapon’s', () => {
    expect(shotPunch(flak, { punch: 1.5 }, { punch: 2 })).toBeCloseTo(1.5 * 2 * 0.45);
    expect(shotPunch(heavy, {}, {})).toBeCloseTo(8);
  });
  it('fires each line at the ship’s pace times its own', () => {
    expect(lineCadence(0.12, heavy)).toBeCloseTo(0.384);
    expect(lineCadence(0.2, flak)).toBeCloseTo(0.4);
  });
});
