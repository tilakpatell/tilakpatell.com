import { describe, expect, it } from 'vitest';
import { HOUSE_IDS, sort } from './sorting';
import { CORES, FLEX, WOODS, inchesSaid, wandFor } from './wand';

const ALL = [];
for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) ALL.push([a, b, c]);

describe('the wand', () => {
  it('is the same wand for the same answers', () => {
    for (const answers of ALL) {
      const { house } = sort(answers);
      expect(wandFor([...answers], house)).toEqual(wandFor(answers, house));
    }
  });

  it('takes its wood from the house, its core from the three, nine to fourteen inches in quarters', () => {
    for (const answers of ALL) {
      const { house } = sort(answers);
      const w = wandFor(answers, house);
      expect(WOODS[house]).toContain(w.wood);
      expect(CORES).toContain(w.core);
      expect(FLEX).toContain(w.flex);
      expect(w.inches).toBeGreaterThanOrEqual(9);
      expect(w.inches).toBeLessThanOrEqual(14);
      expect((w.inches * 4) % 1).toBe(0);
    }
  });

  it('says itself as the card says it', () => {
    const w = wandFor([0, 0, 0], 'gryffindor');
    expect(w.said).toMatch(/^Holly, (dragon heartstring|phoenix feather), (nine|ten|eleven|twelve|thirteen|fourteen)( and (a quarter|a half|three-quarter))? inches\. [A-Z][a-z ]+\.$/);
    for (const answers of ALL) expect(wandFor(answers, sort(answers).house).said).not.toMatch(/['"]|undefined|NaN/);
  });

  it('writes a length as a wandmaker says one', () => {
    expect(inchesSaid(11.75)).toBe('eleven and three-quarter inches');
    expect(inchesSaid(9)).toBe('nine inches');
    expect(inchesSaid(12.5)).toBe('twelve and a half inches');
    expect(inchesSaid(14)).toBe('fourteen inches');
  });

  it('finds every core and a spread of lengths across the answers', () => {
    const cores = new Set();
    const lengths = new Set();
    for (const answers of ALL) {
      const w = wandFor(answers, sort(answers).house);
      cores.add(w.core);
      lengths.add(w.inches);
    }
    expect(cores.size).toBe(3);
    expect(lengths.size).toBeGreaterThan(10);
  });

  it('has four woods for each house, none shared', () => {
    const all = HOUSE_IDS.flatMap((h) => WOODS[h]);
    expect(all).toHaveLength(16);
    expect(new Set(all).size).toBe(16);
    expect(() => wandFor([0, 0, 0], 'durmstrang')).toThrow();
  });
});
