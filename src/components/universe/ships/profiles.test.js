import { describe, expect, it } from 'vitest';
import { MAX_TIER, PROFILES, SYSTEMS, SYSTEM_LABEL, coreStats, profileOf } from './profiles';

const atTier = (kind, n) => coreStats(kind, Object.fromEntries(SYSTEMS.map((s) => [s, n])));

describe('the ships and their systems', () => {
  it('has seven systems, each with a label, to Mk V', () => {
    expect(SYSTEMS).toEqual(['engines', 'pulse', 'hyperdrive', 'shields', 'scanner', 'hold', 'reactor']);
    for (const s of SYSTEMS) expect(SYSTEM_LABEL[s]).toBeTruthy();
    expect(MAX_TIER).toBe(5);
  });

  it('gives the Falcon its own Mk I', () => {
    expect(coreStats('falcon')).toEqual({
      engines: 1,
      agility: 0.9,
      pulse: 1.1,
      shields: 1.1,
      scanReach: 10000,
      scanEvery: 8,
      hold: 12,
      range: 3,
      recharge: 0.9,
      reactor: 0,
      signature: 'falcon',
    });
  });

  it('multiplies the ship’s own Mk I by the ladder', () => {
    expect(coreStats('xwing', { engines: 5 }).engines).toBeCloseTo(1.1 * 1.32, 9);
    expect(coreStats('rv', { pulse: 5 }).pulse).toBeCloseTo(0.95 * 4, 9);
    expect(coreStats('cruiser', { shields: 3 }).shields).toBeCloseTo(0.9 * 1.4, 9);
    expect(coreStats('falcon', { hyperdrive: 5 }).recharge).toBeCloseTo(0.9 * 0.6, 9);
  });

  it('holds each ship’s hold and jump range to the spec’s rows', () => {
    const holds = { xwing: [6, 30], falcon: [12, 60], cruiser: [10, 50], rv: [16, 80] };
    for (const [kind, [lo, hi]] of Object.entries(holds)) {
      expect(atTier(kind, 1).hold).toBe(lo);
      expect(atTier(kind, 5).hold).toBe(hi);
    }
    const ranges = { xwing: [2, 4, 8, 14, 24], falcon: [3, 6, 12, 22, 40], cruiser: [2, 4, 8, 16, 32], rv: [2, 4, 7, 13, 24] };
    for (const [kind, row] of Object.entries(ranges)) expect(row.map((_, i) => atTier(kind, i + 1).range)).toEqual(row);
  });

  it('gives the Falcon and the RV the bigger reactors at Mk V', () => {
    expect(atTier('xwing', 5).reactor).toBe(5);
    expect(atTier('cruiser', 5).reactor).toBe(5);
    expect(atTier('falcon', 5).reactor).toBe(6);
    expect(atTier('rv', 5).reactor).toBe(8);
  });

  it('reaches the whole sector from scanner Mk III', () => {
    expect([1, 2, 3, 4, 5].map((n) => coreStats('neutral', { scanner: n }).scanReach)).toEqual([10000, 25000, Infinity, Infinity, Infinity]);
    expect(coreStats('cruiser').scanReach).toBe(12500);
    expect(coreStats('rv').scanReach).toBe(9000);
    expect(coreStats('cruiser').scanEvery).toBe(6);
  });

  it('keeps every ship’s Mk I within 15 % of today’s numbers', () => {
    for (const kind of ['xwing', 'falcon', 'cruiser', 'rv']) {
      const c = coreStats(kind);
      for (const k of ['engines', 'agility', 'pulse', 'shields']) {
        expect(c[k]).toBeGreaterThanOrEqual(0.85);
        expect(c[k]).toBeLessThanOrEqual(1.15);
      }
    }
  });

  it('flies a garage build, or a kind it doesn’t know, as a neutral ship', () => {
    const built = coreStats('falcon', {}, { build: { hull: 'dart' } });
    expect(built.signature).toBe(null);
    expect(built.hold).toBe(10);
    expect(built.range).toBe(2);
    expect(built.engines).toBe(1);
    expect(profileOf('nobody', null)).toBe(PROFILES.neutral);
    expect(profileOf('xwing', { hull: 'dart' })).toBe(PROFILES.neutral);
  });

  it('reads junk tiers as the nearest that is', () => {
    expect(coreStats('xwing', { engines: 9 }).engines).toBeCloseTo(1.1 * 1.32, 9);
    expect(coreStats('xwing', { engines: 'x' }).engines).toBeCloseTo(1.1, 9);
    expect(coreStats('xwing', { engines: 0 }).engines).toBeCloseTo(1.1, 9);
    expect(coreStats('xwing', null).engines).toBeCloseTo(1.1, 9);
  });
});
