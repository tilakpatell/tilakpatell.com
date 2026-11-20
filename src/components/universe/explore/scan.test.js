import { describe, expect, it } from 'vitest';
import { SECTOR } from '../../../lib/space/address.js';
import { createRecord } from './record';
import { sweep } from './scan';
import { SURVEYED, worthOf } from './values';

// a sector at (2, 0, 1) with two systems, a station at the first, and two things
const o = [2 * SECTOR, 0, 1 * SECTOR];
const sector = {
  id: 'E:2,1',
  systems: [
    { i: 0, at: [o[0] + 100, 0, o[2]], planets: [{}, {}] },
    { i: 1, at: [o[0] + 40000, 0, o[2]], planets: [] },
  ],
  stations: [{ i: 0 }],
  extras: { remnants: [{ id: 'E:2,1:x1', kind: 'remnant', at: [o[0] + 200, 0, o[2]] }], giants: [{ id: 'E:2,1:g', kind: 'hole', at: [o[0] + 50000, 0, o[2]] }] },
};
const area = () => ({ richness: 0, d: 2 });

describe('a scan pulse', () => {
  it('scans what’s within its reach, once, paying into the bank', () => {
    const record = createRecord();
    const r = sweep({ sectors: [sector], at: o, reach: 10000, record, areaOf: area });
    expect(r).toMatchObject({ systems: 1, things: 1, surveyed: 0 });
    expect(r.paid).toBe(worthOf('system', 2) + 2 * worthOf('planet', 2) + worthOf('station', 2) + worthOf('remnant', 2));
    expect(record.data).toBe(r.paid);
    expect(sweep({ sectors: [sector], at: o, reach: 10000, record, areaOf: area }).paid).toBe(0);
  });

  it('scans the whole sector at Mk III, a gargantuan among it, and surveys it', () => {
    const record = createRecord();
    const r = sweep({ sectors: [sector, { ...sector, id: 'E:9,9' }], at: o, reach: Infinity, record, areaOf: area });
    expect(r).toMatchObject({ systems: 2, things: 2, surveyed: 1 });
    expect(r.paid).toBeGreaterThan(worthOf('gargantuan', 2) + SURVEYED * worthOf('system', 2));
    expect(record.isScanned([9, 0, 9], 0)).toBe(false);
  });

  it('does nothing with no record or no ship', () => {
    expect(sweep({ sectors: [sector], at: null, reach: 1, record: createRecord() })).toEqual({ systems: 0, things: 0, surveyed: 0, paid: 0 });
  });
});
