import { describe, expect, it } from 'vitest';
import { ORBIT_CYCLE } from './orbits';
import { COMET_PERIOD, keplerE, pathAt, pathSpeed, rowAt } from './paths';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const comet = { type: 'kepler', focus: [100000, 0, -5000], q: 300, e: 0.85, peri: [1, 0, 0], normal: [0, 1, 0], period: COMET_PERIOD, phase: 0 };
const Q = (comet.q * (1 + comet.e)) / (1 - comet.e);
const storm = { type: 'loop', centre: [5, 6, 7], radius: 2000, revs: 4, phase: 0.25, normal: [0, 0, 1], ref: [1, 0, 0] };

describe('paths', () => {
  it('solves Kepler’s equation', () => {
    for (const e of [0, 0.3, 0.85, 0.95]) for (const M of [0, 0.5, 2, Math.PI, 5]) expect(keplerE(M, e) - e * Math.sin(keplerE(M, e))).toBeCloseTo(M, 10);
  });
  it('puts a comet at perihelion at its start, at aphelion half a period on, and between them always', () => {
    expect(COMET_PERIOD).toBe(8 * ORBIT_CYCLE);
    expect(len(pathAt(comet, 0), [comet.focus[0] + comet.q, 0, comet.focus[2]])).toBeLessThan(1e-6);
    expect(len(pathAt(comet, COMET_PERIOD / 2), comet.focus)).toBeCloseTo(Q, 6);
    for (let i = 0; i < 64; i++) {
      const r = len(pathAt(comet, (i / 64) * COMET_PERIOD), comet.focus);
      expect(r).toBeGreaterThanOrEqual(comet.q - 1e-6);
      expect(r).toBeLessThanOrEqual(Q + 1e-6);
    }
  });
  it('never moves faster than its perihelion speed, and stays smooth days or years on', () => {
    const most = pathSpeed(comet);
    for (const t0 of [0, 1234.5, 1.7e9, 1e10]) expect(len(pathAt(comet, t0 + 1), pathAt(comet, t0))).toBeLessThanOrEqual(most + 1e-6);
    for (const k of [1, 3, 1907]) expect(len(pathAt(comet, k * COMET_PERIOD - 1e-3), pathAt(comet, k * COMET_PERIOD + 1e-3))).toBeLessThan(1e-3);
    expect(most).toBeLessThan(0.3);
  });
  it('goes round a loop a whole number of times a cycle, at its radius', () => {
    for (const t of [0, 99, 1e6, 1e10]) expect(len(pathAt(storm, t), storm.centre)).toBeCloseTo(2000, 6);
    expect(len(pathAt(storm, ORBIT_CYCLE - 1e-3), pathAt(storm, ORBIT_CYCLE + 1e-3))).toBeLessThan(1e-2);
    expect(pathSpeed(storm)).toBeCloseTo((2 * Math.PI * 2000 * 4) / ORBIT_CYCLE, 9);
  });
  it('leaves a thing without a path where it is', () => {
    const row = { at: [1, 2, 3] };
    expect(rowAt(row, 5e9)).toBe(row.at);
    expect(rowAt({ at: [0, 0, 0], path: storm }, 99)).toEqual(pathAt(storm, 99));
  });
});
