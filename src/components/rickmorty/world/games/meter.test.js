import { describe, expect, it } from 'vitest';
import { DESTINATIONS, destinationById } from '../dimensions/destinations';
import { KINDS, METER, METER_OFF, kindOf } from './meter';
import { dealReadout } from './deal';
import { findReadout } from './find';
import { freezeReadout } from './freeze';
import { powerReadout } from './power';

describe('one meter for a place’s game', () => {
  it('knows which game a place runs, if any', () => {
    expect(kindOf(destinationById('microverse'))).toBe('power');
    expect(kindOf(destinationById('customs'))).toBe(null);
    expect(kindOf(null)).toBe(null);
  });

  it('finds no place running two games, so one meter will do', () => {
    for (const d of DESTINATIONS) expect(KINDS.filter((k) => d[k]).length, d.id).toBeLessThanOrEqual(1);
  });

  it('names each game’s meter, and every name’s its own', () => {
    for (const k of KINDS) expect(METER[k], k).toMatchObject({ title: expect.any(String), label: expect.any(String) });
    expect(new Set(KINDS.map((k) => METER[k].title)).size).toBe(KINDS.length);
    expect(METER.power).toEqual({ title: 'The world’s charge', label: 'Charge' });
    expect(METER.find).toEqual({ title: 'Pick-up time', label: 'Time' });
  });

  it('is off as each game’s readout is off, when no game runs', () => {
    expect(METER_OFF).toEqual(powerReadout(null));
    expect(METER_OFF).toEqual(dealReadout(null));
    expect(METER_OFF).toEqual(freezeReadout(null));
    expect(METER_OFF).toEqual(findReadout(null));
  });
});
