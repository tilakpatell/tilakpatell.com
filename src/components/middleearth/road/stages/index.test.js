import { describe, expect, it } from 'vitest';
import { MODES, STAGES } from './index';

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
});
