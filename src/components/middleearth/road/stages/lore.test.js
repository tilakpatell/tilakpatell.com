import { describe, expect, it } from 'vitest';
import { LORE_OF } from './registry';

// a card’s date as a year of the Third Age (the Second’s before it)
const yearOf = (date) => {
  const age = date.match(/^(Second|Third) Age (\d{1,4})$/);
  if (age) return (age[1] === 'Second' ? -3441 : 0) + Number(age[2]);
  const day = date.match(/^\d{1,2} [A-Z][a-z]+ (\d{4})$/);
  return day ? Number(day[1]) : NaN;
};

describe('the lore cards, every stage written so far', () => {
  for (const [id, cards] of Object.entries(LORE_OF)) {
    it(`${id}: two to four cards, short, the site’s spelling and quotes, in the Tale of Years’ order`, () => {
      expect(cards.length).toBeGreaterThanOrEqual(2);
      expect(cards.length).toBeLessThanOrEqual(4);
      let last = -Infinity;
      for (const c of cards) {
        expect(c.text.length, c.title).toBeLessThanOrEqual(240);
        expect(c.title.length).toBeGreaterThan(0);
        expect(c.text, c.title).not.toMatch(/['"]/);
        expect(c.text, c.title).not.toMatch(/!/);
        expect(c.text, c.title).not.toMatch(/\b(color|gray|center)\b|[a-z]izes?\b|[a-z]ized\b/i);
        const y = yearOf(c.date);
        expect(Number.isFinite(y), c.date).toBe(true);
        expect(y, c.title).toBeGreaterThanOrEqual(last);
        last = y;
      }
      const ats = cards.map((c) => c.at);
      expect(ats).toEqual([...ats].sort((a, b) => a - b));
    });
  }
});
