import { describe, expect, it } from 'vitest';
import { parseSpaceId } from '../../../lib/space/address.js';
import { UNIVERSE } from './seed';
import { fullSector, placeIn, placeOf, wonderPlace } from './space';
import { STATION_BASE } from './stations';
import { THING_BASE, thingsOf } from './things';

const row = (k) => ({ kind: 'beacon', at: [k, 0, 0], size: 20 });
const counting = () => {
  const calls = { n: 0, seen: [] };
  const lists = [
    { list: 'testHigh', base: 20000, max: 9999, make: (ctx) => (calls.n++, calls.seen.push(ctx), [row(1), row(2), row(3)]) },
    { list: 'testLow', base: 8, max: 4, make: (ctx, made) => (calls.n++, (calls.made = made), [row(4)]) },
  ];
  return { calls, lists };
};

describe('sector lists of any length', () => {
  const { calls, lists } = counting();
  const s = fullSector(UNIVERSE, 1, 0, 0, { extras: lists });
  const plain = fullSector(UNIVERSE, 1, 0, 0);
  it('numbers a high list from its base, and finds its rows by number', () => {
    expect(s.extras.testHigh.map((r) => r.id)).toEqual(['E:1,0:w20000', 'E:1,0:w20001', 'E:1,0:w20002']);
    expect(wonderPlace(s, 20001, lists)).toEqual({ kind: 'extra', row: s.extras.testHigh[1], sector: s });
    expect(wonderPlace(s, 20003, lists)).toBeNull();
    expect(wonderPlace(s, 8, lists).row).toBe(s.extras.testLow[0]);
  });
  it('tells a list the lists made before it, ids on', () => {
    expect(calls.made.testHigh.map((r) => r.id)).toEqual(s.extras.testHigh.map((r) => r.id));
  });
  it('hands a list the stations, beacons, wonders and where the sector is', () => {
    const ctx = calls.seen[0];
    expect(ctx.stations).toEqual(plain.stations);
    expect(ctx.beacons).toEqual(plain.beacons);
    expect(ctx.wonders).toEqual(plain.wonders);
    expect([ctx.d, ctx.core, ctx.universe]).toEqual([1, false, UNIVERSE]);
  });
  it('throws on a list that is neither low nor high, or shares ids', () => {
    const at = (base, max) => ({ list: `l${base}`, base, max, make: () => [] });
    const ctx = { sx: 1, sy: 0, sz: 0, origin: [0, 0, 0], seed: 1n, systems: [], outs: [] };
    for (const bad of [[at(60, 5)], [at(500, 5)], [at(25000, 5)], [at(20000, 10000)], [at(20000, 5), { ...at(20000, 3), list: 'other' }]])
      expect(() => thingsOf(ctx, bad, undefined, { lattice: false })).toThrow();
  });
  it('still finds the stations, the lattice and the legacy wonders, and nothing in the gaps', () => {
    const st = s.stations[0];
    expect(wonderPlace(s, STATION_BASE + st.i, lists).row).toBe(st);
    const n = THING_BASE + s.things.slot[0];
    expect(wonderPlace(s, n, lists).kind).toBe('thing');
    const w = [[2, 0], [-1, 0], [0, 1], [1, 1], [-2, 0], [3, 0]].map(([x, z]) => fullSector(UNIVERSE, x, 0, z, { things: false })).find((o) => o.wonders.length);
    expect(wonderPlace(w, 0, lists)).toEqual({ kind: 'wonder', row: w.wonders[0], sector: w });
    for (const n of [60, 8064, 9999]) expect(wonderPlace(s, n, lists)).toBeNull();
    expect(placeIn(s, parseSpaceId('E:1,0:w60'))).toBeNull();
  });
  it('makes the lists alone without a lattice, and nothing at all without things', () => {
    const a = counting();
    const only = fullSector(UNIVERSE, 1, 0, 0, { lattice: false, extras: a.lists });
    expect(only.things.count).toBe(0);
    expect(a.calls.n).toBe(2);
    const b = counting();
    const none = fullSector(UNIVERSE, 1, 0, 0, { things: false, extras: b.lists });
    expect(b.calls.n).toBe(0);
    expect(none.extras).toEqual({});
    expect(none.systems.map((x) => [x.id, x.at, x.seed])).toEqual(plain.systems.map((x) => [x.id, x.at, x.seed]));
    expect(none.stations).toEqual(plain.stations);
  });
  it('resolves a lattice id as it did', () => {
    const p = placeOf(UNIVERSE, 'e:1,0:w64');
    const own = placeIn(plain, parseSpaceId('E:1,0:w64'));
    expect(p?.row ?? null).toEqual(own?.row ?? null);
  });
});
