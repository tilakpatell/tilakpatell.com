import { describe, expect, it } from 'vitest';
import { ENTRY, HOUSES, HOUSE_IDS, PASSWORDS, QUESTIONS, entryFor, hatPicks, houseColours, seedOf, sort } from './sorting';

// every one of the 64 ways through the three questions
const ALL = [];
for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) ALL.push([a, b, c]);

describe('the Sorting', () => {
  it('asks three questions with four answers each, every answer weighing to the four houses', () => {
    expect(QUESTIONS).toHaveLength(3);
    for (const q of QUESTIONS) {
      expect(q.answers).toHaveLength(4);
      for (const a of q.answers) {
        expect(a.weights).toHaveLength(4);
        expect(a.weights.every((w) => Number.isInteger(w) && w >= 0)).toBe(true);
        expect(Math.max(...a.weights)).toBeGreaterThan(0);
      }
    }
  });

  it('sorts every set of answers into one of the four houses', () => {
    for (const answers of ALL) expect(HOUSE_IDS).toContain(sort(answers).house);
  });

  it('sorts the same answers the same way every time', () => {
    for (const answers of ALL) {
      const a = sort(answers);
      const b = sort([...answers]);
      expect(b).toEqual(a);
      expect(a.seed).toBe(seedOf(answers));
    }
  });

  it('can reach every house, each by a fair share of the ways through', () => {
    const count = Object.fromEntries(HOUSE_IDS.map((h) => [h, 0]));
    for (const answers of ALL) count[sort(answers).house]++;
    for (const h of HOUSE_IDS) expect(count[h], h).toBeGreaterThanOrEqual(8);
  });

  it('sends the plain answers where they point', () => {
    expect(sort([0, 0, 0]).house).toBe('gryffindor');
    expect(sort([2, 3, 1]).house).toBe('slytherin');
    expect(sort([1, 2, 2]).house).toBe('ravenclaw');
    expect(sort([3, 1, 3]).house).toBe('hufflepuff');
  });

  it('breaks a tie by the first answer', () => {
    // Gryffindor and Hufflepuff tie at 5: the first answer leant to Hufflepuff
    const r = sort([3, 0, 0]);
    expect(r.scores.gryffindor).toBe(r.scores.hufflepuff);
    expect(r.house).toBe('hufflepuff');
    // three tied at 4 (Gryffindor, Ravenclaw, Hufflepuff): the door opened first
    const g = sort([0, 2, 3]);
    expect([g.scores.gryffindor, g.scores.ravenclaw, g.scores.hufflepuff]).toEqual([4, 4, 4]);
    expect(g.house).toBe('gryffindor');
  });

  it('goes to the seed only when the first answer cannot break the tie either', () => {
    for (const answers of ALL) {
      const r = sort(answers);
      const top = Math.max(...Object.values(r.scores));
      const tied = HOUSE_IDS.filter((h) => r.scores[h] === top);
      if (tied.length < 2) continue;
      const first = QUESTIONS[0].answers[answers[0]].weights;
      const best = Math.max(...tied.map((h) => first[HOUSE_IDS.indexOf(h)]));
      expect(tied.filter((h) => first[HOUSE_IDS.indexOf(h)] === best)).toContain(r.house);
    }
  });

  it('says a thought, a word on the runner-up when close, and calls the house', () => {
    for (const answers of ALL) {
      const r = sort(answers);
      expect(r.said.at(-1)).toContain(HOUSES[r.house].name);
      expect(r.said).toHaveLength(r.close ? 3 : 2);
      expect(r.second).not.toBe(r.house);
      for (const line of r.said) {
        expect(line).not.toMatch(/['"]/);
        expect(line.length).toBeLessThan(110);
      }
    }
  });

  it('gives a password from the list, the same for the same answers', () => {
    for (const answers of ALL) {
      expect(PASSWORDS).toContain(sort(answers).password);
      expect(sort(answers).password).toBe(sort(answers).password);
    }
  });

  it('refuses anything but three answers in range', () => {
    expect(() => sort([0, 0])).toThrow();
    expect(() => sort([0, 0, 4])).toThrow();
    expect(() => sort([0, -1, 0])).toThrow();
    expect(() => sort(null)).toThrow();
  });

  it('reads an answer off a silent visitor, always in range, the same for the same seed', () => {
    for (let s = 0; s < 200; s++)
      for (let q = 0; q < 3; q++) {
        const a = hatPicks(s * 7919, q);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(4);
        expect(hatPicks(s * 7919, q)).toBe(a);
      }
  });

  it('writes its questions and answers in the site’s own, curly-quoted words', () => {
    for (const q of QUESTIONS) for (const text of [q.ask, ...q.answers.map((a) => a.text)]) {
      expect(text).not.toMatch(/['"]/);
      expect(text).toMatch(/^[A-Z]/);
    }
  });

  it('gives the HUD its house colours once sorted, and nothing before', () => {
    expect(houseColours('ravenclaw')).toEqual({ '--hp-house': HOUSES.ravenclaw.colours[0], '--hp-house-2': HOUSES.ravenclaw.colours[1] });
    expect(houseColours(null)).toEqual({});
    for (const h of HOUSE_IDS) for (const c of HOUSES[h].colours) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('says how each common room is got into, with the password where there is one', () => {
    for (const h of HOUSE_IDS) expect(ENTRY[h]).toBeTruthy();
    expect(entryFor('gryffindor', 'Toffee comet')).toBe('The Fat Lady, seventh floor. The password is “Toffee comet”.');
    expect(entryFor('ravenclaw', 'Toffee comet')).not.toContain('Toffee');
  });
});
