import { describe, expect, it } from 'vitest';
import { budget } from '../src/lib/budgets.js';
import { KNOWN_OVER, baselineOf, limitsFor, overBy } from './galaxy-budget.mjs';

describe('what the galaxy check holds a world to', () => {
  it('holds a world to its baseline +10%, under its level’s row', () => {
    const l = limitsFor({ id: 'tatooine', quality: 'high', row: budget('high'), base: { calls: 76, triangles: 819247 } });
    expect(l.calls).toBeCloseTo(83.6);
    expect(l.tris).toBeCloseTo(901171.7);
    expect(l.mb).toBe(60);
    expect(l.frame).toBe(Infinity);
  });

  it('caps a world with no baseline at the row', () => {
    expect(limitsFor({ id: 'new', quality: 'mid', row: budget('mid'), base: null })).toMatchObject({ calls: 500, tris: 1.5e6, mb: 40 });
  });

  it('puts no triangle ceiling on ultra, and a frame-time one only on a real graphics chip', () => {
    expect(limitsFor({ id: 'x', quality: 'ultra', row: budget('ultra'), base: null, realGpu: false })).toMatchObject({ tris: Infinity, frame: Infinity });
    expect(limitsFor({ id: 'x', quality: 'ultra', row: budget('ultra'), base: null, realGpu: true }).frame).toBe(16.7);
  });

  it('holds a world known to be over its row to its own baseline +10% until it’s trimmed, and says so', () => {
    expect(KNOWN_OVER.endor).toMatch(/TODO/);
    const l = limitsFor({ id: 'endor', quality: 'high', row: budget('high'), base: { calls: 234, triangles: 3345258 } });
    expect(l.tris).toBeCloseTo(3345258 * 1.1);
    expect(l.known).toBe(KNOWN_OVER.endor);
    expect(overBy({ calls: 234, triangles: 3345258, glbMB: 12.7, p95: 1 }, l)).toEqual([]);
    expect(overBy({ calls: 234, triangles: 3.8e6, glbMB: 12.7, p95: 1 }, l)).toEqual(['tris 3800000 > 3679784']);
    // (a world with no baseline gets no such pass)
    expect(limitsFor({ id: 'endor', quality: 'high', row: budget('high'), base: null }).tris).toBe(3e6);
  });

  it('fails a world that drew nothing while it was measured, rather than calling it light', () => {
    const l = limitsFor({ id: 'kamino', quality: 'high', row: budget('high'), base: { calls: 99, triangles: 1084196 } });
    expect(overBy({ calls: 0, triangles: 0, glbMB: 8.8, p95: 1 }, l)).toEqual(['drew nothing (no draw calls in the measured frames)']);
  });

  it('fails a world that drew far less than its baseline (held back, not lighter)', () => {
    const l = limitsFor({ id: 'yavin', quality: 'high', row: budget('high'), base: { calls: 78, triangles: 1727485 } });
    expect(overBy({ calls: 1, triangles: 1, glbMB: 9.9, p95: 1 }, l)).toEqual(['drew far less than its baseline (1 of 78 draw calls): held back while measured']);
    // (a real trim, to a third of the calls, still passes)
    expect(overBy({ calls: 26, triangles: 600000, glbMB: 9.9, p95: 1 }, l)).toEqual([]);
  });

  it('tightens every limit by the scale, to see it fail', () => {
    const l = limitsFor({ id: 'tatooine', quality: 'high', row: budget('high'), base: { calls: 100, triangles: 1e6 }, scale: 0.5 });
    expect(l.calls).toBeCloseTo(55);
    expect(l.tris).toBeCloseTo(550000);
    expect(l.mb).toBe(30);
  });
});

describe('baselineOf: what a run is held to beside its row', () => {
  const list = [{ id: 'endor', calls: 234, triangles: 3345258 }];
  it('is the world’s own baseline for its main map', () => {
    expect(baselineOf(list, 'endor')).toEqual(list[0]);
    expect(baselineOf(list, 'naboo')).toBe(null);
  });
  it('is none for a district: another map, which the world’s baseline never measured (the row alone, and no floor)', () => {
    expect(baselineOf(list, 'endor', 'village')).toBe(null);
    const l = limitsFor({ id: 'endor', quality: 'high', row: budget('high'), base: baselineOf(list, 'endor', 'village') });
    expect(l).toMatchObject({ calls: 700, tris: 3e6, floor: 0 });
  });
});
