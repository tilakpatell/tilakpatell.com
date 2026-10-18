import { describe, expect, it } from 'vitest';
import { spaceId } from '../../../lib/space/address.js';
import { PRINTED, digest, plainSector } from './fixtures/fingerprint';
import fingerprint from './fixtures/fingerprint.json';
import { KEEP_OUTS, keepOutsNear } from './keepOuts';
import { UNIVERSE, universeOf } from './seed';
import { beaconsOf, makeSector } from './sector';
import { fullSector, placeOf } from './space';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('the legacy prefix', () => {
  it.each(PRINTED)('keeps sector %i,%i exactly as makeSector made it', (sx, sz) => {
    const s = fullSector(UNIVERSE, sx, 0, sz, { things: false });
    const old = makeSector(UNIVERSE, sx, sz);
    expect(s.legacy).toEqual({ systems: old.systems.length, wonders: old.wonders.length });
    expect(s.wonders).toHaveLength(old.wonders.length);
    expect(digest(plainSector(s, s.legacy))).toBe(fingerprint[s.id].sha256);
  });
  it('indexes straight on from the legacy part', () => {
    for (const [sx, sy, sz] of [[1, 0, 0], [5, 0, 5], [2, -3, 1], [0, 0, 0]]) {
      const s = fullSector(UNIVERSE, sx, sy, sz, { things: false });
      s.systems.forEach((sys, i) => {
        expect(sys.i).toBe(i);
        expect(sys.id).toBe(spaceId([sx, sy, sz], i));
      });
    }
  });
});

describe('counts and places', () => {
  it('fills a middle-layer sector past its legacy part', () => {
    for (const [sx, sz] of [[1, 0], [5, 5], [-3, -6]]) {
      const s = fullSector(UNIVERSE, sx, 0, sz, { things: false });
      expect(s.systems.length).toBeGreaterThanOrEqual(s.legacy.systems + 180);
      expect(s.systems.length).toBeLessThanOrEqual(s.legacy.systems + 300);
    }
  });
  it('fills the home sector with no wonders', () => {
    const s = fullSector(UNIVERSE, 0, 0, 0, { things: false });
    expect(s.systems.length).toBeGreaterThanOrEqual(90);
    expect(s.systems.length).toBeLessThanOrEqual(150);
    expect(s.wonders).toEqual([]);
    expect(s.legacy).toEqual({ systems: 0, wonders: 0 });
  });
  it('lifts an upper sector to its own height', () => {
    const s = fullSector(UNIVERSE, 2, -3, 1, { things: false });
    expect(s.id).toBe('E:2,1,-3');
    expect(s.origin).toEqual([240000, -360000, 120000]);
    expect(s.wonders).toEqual([]);
    expect(s.legacy).toEqual({ systems: 0, wonders: 0 });
    const ys = s.systems.map((x) => x.at[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(60000);
    expect(s.beacons).toEqual(beaconsOf(2, 1, s.seed, -3));
    for (const b of Object.values(s.beacons)) expect(Math.abs(b.at[1] - s.origin[1])).toBeLessThanOrEqual(200);
  });
  it('gives no things when asked for none', () => {
    const s = fullSector(UNIVERSE, 1, 0, 0, { things: false });
    expect(s.things.count).toBe(0);
    expect(s.things.at).toHaveLength(0);
    expect(s.things.slot).toHaveLength(0);
    expect(s.extras).toEqual({});
  });
});

describe('spacing', () => {
  it.each([[0, 0, 0], [1, 0, 0], [-2, 0, 3], [2, -3, 1], [0, 1, 0]])('keeps %i,%i,%i apart', (sx, sy, sz) => {
    const s = fullSector(UNIVERSE, sx, sy, sz, { things: false });
    const outs = keepOutsNear(sx, sy, sz);
    const at = s.systems.map((x) => x.at);
    for (let a = 0; a < at.length; a++)
      for (let b = a + 1; b < at.length; b++) expect(dist(at[a], at[b])).toBeGreaterThanOrEqual(6000);
    const beacons = Object.values(s.beacons).map((b) => b.at);
    for (const sys of s.systems.slice(s.legacy.systems)) {
      for (let k = 0; k < 3; k++) expect(Math.abs(sys.at[k] - s.origin[k])).toBeLessThanOrEqual(58000);
      for (const w of s.wonders) expect(dist(sys.at, w.at)).toBeGreaterThanOrEqual(3000);
      for (const b of beacons) expect(dist(sys.at, b)).toBeGreaterThanOrEqual(3000);
      for (const o of outs) expect(dist(sys.at, o.at)).toBeGreaterThanOrEqual(o.r + sys.reach);
    }
  });
});

describe('determinism', () => {
  it('gives the same sector twice', () => {
    expect(fullSector(UNIVERSE, 3, 0, -2)).toEqual(fullSector(UNIVERSE, 3, 0, -2));
  });
  it('differs in another universe, and keeps the core’s keep-outs', () => {
    const other = universeOf('elsewhere');
    const a = fullSector(UNIVERSE, 3, 0, -2, { things: false });
    const b = fullSector(other, 3, 0, -2, { things: false });
    expect(b.systems.slice(0, 3).map((s) => s.seed)).not.toEqual(a.systems.slice(0, 3).map((s) => s.seed));
    expect(b.systems.slice(b.legacy.systems).map((s) => s.at)).not.toEqual(
      a.systems.slice(a.legacy.systems).map((s) => s.at),
    );
    const core = fullSector(other, 0, 0, 0, { things: false });
    expect(keepOutsNear(0, 0, 0)).toHaveLength(KEEP_OUTS.length);
    for (const s of core.systems) for (const o of KEEP_OUTS) expect(dist(s.at, o.at)).toBeGreaterThanOrEqual(o.r + s.reach);
  });
});

describe('placeOf', () => {
  const U = UNIVERSE;
  const sector = fullSector(U, 1, 0, 0);
  it('finds every system, planet, moon, wonder and a sample of things', () => {
    sector.systems.forEach((s) => {
      expect(placeOf(U, s.id)).toMatchObject({ kind: 'system' });
      expect(placeOf(U, s.id).row).toEqual(s);
      s.planets.forEach((p) => {
        expect(placeOf(U, p.id)).toMatchObject({ kind: 'planet' });
        expect(placeOf(U, p.id).row).toEqual(p);
        p.moonList.forEach((m) => expect(placeOf(U, m.id).row).toEqual(m));
      });
    });
    sector.wonders.forEach((w) => expect(placeOf(U, w.id)).toMatchObject({ kind: 'wonder' }));
    const n = sector.things.count;
    for (let k = 0; k < 200; k++) {
      const i = Math.floor((k * n) / 200);
      const r = placeOf(U, spaceId([1, 0, 0], { wonder: 64 + sector.things.slot[i] }));
      expect(r.kind).toBe('thing');
      expect(r.row.size).toBe(sector.things.size[i]);
    }
  });
  it('reads the old and the 3D spelling alike', () => {
    expect(placeOf(U, 'e:1,0,0:3:2').row).toBe(placeOf(U, 'E:1,0:3:2').row);
  });
  it('answers null for nothing', () => {
    expect(placeOf(U, 'E:1,0:99999')).toBeNull();
    expect(placeOf(U, 'E:1,0:w60')).toBeNull();
    expect(placeOf(U, 'beacon:E:1,0:n')).toBeNull();
    expect(placeOf(U, 'E:1,0:0:99')).toBeNull();
  });
  it('resolves sectors above the middle layer too', () => {
    expect(placeOf(U, 'E:2,1,-3:5').row.id).toBe('E:2,1,-3:5');
  });
});

describe('speed', () => {
  it('makes ten middle-layer sectors in under 600 ms', () => {
    fullSector(UNIVERSE, 9, 0, 9);
    const t = performance.now();
    for (let k = 0; k < 10; k++) fullSector(UNIVERSE, 10 + k, 0, 3);
    const ms = performance.now() - t;
    console.log(`ten sectors: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(600);
  });
});
