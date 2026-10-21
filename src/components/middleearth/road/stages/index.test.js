import { describe, expect, it } from 'vitest';
import { MODES, STAGES, modeAt, stageById } from './index';
import { endOf } from '../line';
import { roadFor } from '../terrain';

describe('the sixteen stages', () => {
  it('are in the road’s order, Bag End to the Havens', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['hobbiton', 'shire-edge', 'bree', 'weathertop', 'ford', 'rivendell', 'caradhras', 'moria', 'lorien', 'anduin', 'marshes', 'ithilien', 'cirith-ungol', 'gorgoroth', 'minas-tirith', 'havens']);
  });

  it('each has a length of 150 to 300 m, a way of travelling, a date, a name and a place on the sheet', () => {
    for (const s of STAGES) {
      expect(s.length).toBeGreaterThanOrEqual(150);
      expect(s.length).toBeLessThanOrEqual(300);
      expect(MODES).toContain(s.mode);
      expect(s.date).toMatch(/^\d{1,2} [A-Z][a-z]+ 30(18|19|21)$/);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.place.length).toBeGreaterThan(0);
    }
    expect(new Set(STAGES.map((s) => s.place)).size).toBe(16);
  });

  it('the cards’ words are the design’s (§5): sentence case, curly quotes', () => {
    expect(STAGES[1]).toMatchObject({ name: 'The Shire’s edge', date: '24 September 3018' });
    expect(STAGES[15]).toMatchObject({ name: 'The Grey Havens', date: '29 September 3021' });
    for (const s of STAGES) expect(s.name).not.toMatch(/'/);
  });

  it('each road starts at the origin and ends on x = 0 heading along +z, so the seams meet', () => {
    for (const s of STAGES) {
      const road = roadFor(s.id);
      const start = road.pointAt(0);
      expect([start.x, start.z]).toEqual([0, 0]);
      expect(start.tangent[2]).toBeCloseTo(1, 3);
      const end = endOf(road);
      expect(end.at[0]).toBeCloseTo(0, 6);
      expect(end.heading).toBeCloseTo(0, 3);
      expect(road.length).toBeCloseTo(s.length, 0);
    }
  });

  it('a stage’s modes switch its way of travelling once passed: on Asfaloth at the Ford from the ride', () => {
    const ford = stageById('ford');
    expect(modeAt(ford, 0)).toBe('walk');
    expect(modeAt(ford, 79.9)).toBe('walk');
    expect(modeAt(ford, 80)).toBe('horse');
    expect(modeAt(ford, ford.length)).toBe('horse');
    expect(modeAt(stageById('bree'), 50)).toBe('walk');
    for (const s of STAGES) for (const m of s.modes ?? []) {
      expect(MODES).toContain(m.mode);
      expect(m.at).toBeGreaterThan(0);
      expect(m.at).toBeLessThan(s.length);
    }
  });
});
