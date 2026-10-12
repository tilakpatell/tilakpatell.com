import { describe, expect, it } from 'vitest';
import { BUDGET_ROWS, COLUMNS, budget } from './budgets';
import { LEVELS } from './device';

describe('how much each quality level draws', () => {
  it('has a row for every level, and every column in each', () => {
    expect(Object.keys(BUDGET_ROWS)).toEqual(LEVELS);
    for (const level of LEVELS) for (const col of COLUMNS) expect(BUDGET_ROWS[level], `${level}.${col}`).toHaveProperty(col);
  });

  it('holds the spec’s numbers', () => {
    expect(LEVELS.map((l) => budget(l).tris)).toEqual([0.8e6, 1.5e6, 3e6, Infinity]);
    expect(LEVELS.map((l) => budget(l).calls)).toEqual([350, 500, 700, 1500]);
    expect(LEVELS.map((l) => budget(l).modelsMB)).toEqual([20, 40, 60, 240]);
    expect(LEVELS.map((l) => budget(l).props)).toEqual([0.5, 0.75, 1, 1.5]);
    expect(LEVELS.map((l) => budget(l).lod1)).toEqual([true, true, true, false]);
    expect(LEVELS.map((l) => budget(l).grass)).toEqual([0.25, 0.5, 1, 2]);
    expect(LEVELS.map((l) => budget(l).terrain)).toEqual([0.5, 0.75, 1, 2]);
    expect(LEVELS.map((l) => budget(l).cut)).toEqual(['.lo', '', '.hq', '.ultra']);
    expect(LEVELS.map((l) => budget(l).water)).toEqual([0.5, 0.75, 1, 2]);
    expect(LEVELS.map((l) => budget(l).near)).toEqual([30, 45, 70, 110]);
    expect(LEVELS.map((l) => budget(l).mid)).toEqual([90, 140, 220, 400]);
    expect(LEVELS.map((l) => budget(l).leaves)).toEqual([0, 256, 1024, 2048]);
    // (lane N4: the boot slice's bytes and a visit's, in megabytes)
    expect(LEVELS.map((l) => budget(l).bootMB)).toEqual([3, 6, 12, 12]);
    expect(LEVELS.map((l) => budget(l).visitMB)).toEqual([40, 120, 400, 1200]);
  });

  it('lets a visit pull more than its boot slice, on every level', () => {
    for (const level of LEVELS) expect(budget(level).visitMB, level).toBeGreaterThan(budget(level).bootMB);
  });

  it('has fourteen columns, the kit’s three last', () => {
    expect(COLUMNS.length).toBe(14);
    expect(COLUMNS.slice(-3)).toEqual(['near', 'mid', 'leaves']);
  });

  it('ends a kit model’s full band before its LOD1 band', () => {
    for (const level of LEVELS) expect(budget(level).near, level).toBeLessThan(budget(level).mid);
  });

  it('puts no triangle ceiling on ultra', () => {
    expect(budget('ultra').tris).toBe(Infinity);
  });

  it('rises from low to ultra in every number', () => {
    // (but the boot slice, the same nine cells and the same grid on high and ultra: its bytes hold there)
    const holds = { bootMB: ['ultra'] };
    for (const col of COLUMNS) {
      const values = LEVELS.map((l) => budget(l)[col]);
      if (typeof values[0] !== 'number') continue;
      for (let i = 1; i < values.length; i++) {
        if (holds[col]?.includes(LEVELS[i])) expect(values[i], `${col} at ${LEVELS[i]}`).toBe(values[i - 1]);
        else expect(values[i], `${col} at ${LEVELS[i]}`).toBeGreaterThan(values[i - 1]);
      }
    }
  });

  it('reads an unknown level as high', () => {
    expect(budget('max')).toBe(BUDGET_ROWS.high);
    expect(budget()).toBe(BUDGET_ROWS.high);
  });

  it('keeps its rows from being changed by a reader', () => {
    expect(Object.isFrozen(budget('high'))).toBe(true);
  });
});
