// The Overhaul's adaptive difficulty as a driver (its records: mods/iao-v2.json):
// each side's aim noise scale drawn again, evenly, from ten, every fifteen
// seconds, the first a tenth in; and the same as a difficulty row for a battle
// whose bots take one.
import { describe, expect, it } from 'vitest';
import book from '../../../data/bf2017/mods/iao-v2.json';
import { aiOf, loadRulebook } from '../rulebook.js';
import { seeded } from '../../seeded.js';
import { ADAPTIVE, ADAPTIVE_NAME, adaptiveDifficulty, createAdaptive, scaleOf, stepAdaptive } from './adaptive.js';
import { DIFFICULTIES, difficultyFor } from './difficulty.js';

const ai = aiOf(loadRulebook());

describe('the adaptive difficulty’s numbers', () => {
  it('are the mod’s records’: ten scales, every fifteen seconds, a tenth’s lag', () => {
    expect(ADAPTIVE).toEqual({ every: book.adaptive.every, lag: book.adaptive.lag, scales: book.adaptive.scales });
    expect(ADAPTIVE.every).toBe(15);
    expect(ADAPTIVE.scales).toEqual([0.15, 0.3, 0.6, 0.8, 1, 1.1, 1.35, 1.55, 1.95, 2.5]);
    expect(book.adaptive._source.every).toMatch(/#\d+\.Delay$/);
  });

  it('is a setting of its own, not one of the difficulty’s names', () => {
    expect(DIFFICULTIES).not.toContain(ADAPTIVE_NAME);
  });
});

describe('the driver', () => {
  const run = (until, rand = seeded(3)) => {
    const d = createAdaptive({ now: 0 });
    const at = [];
    for (let k = 0; k * 0.05 <= until + 1e-9; k++) {
      const t = Math.round(k * 0.05 * 100) / 100;
      if (stepAdaptive(d, t, rand)) at.push(t);
    }
    return { d, at };
  };

  it('starts both sides at one, then draws a tenth of a second in and every fifteen after', () => {
    const d = createAdaptive({ now: 2 });
    expect([scaleOf(d, 1), scaleOf(d, 2)]).toEqual([1, 1]);
    expect(run(46).at).toEqual([0.1, 15.1, 30.1, 45.1]);
  });

  it('draws each side one of the ten, evenly', () => {
    const d = createAdaptive();
    const rand = seeded(9);
    const seen = new Map();
    for (let k = 0; k < 4000; k++) {
      stepAdaptive(d, d.next, rand);
      for (const side of [1, 2]) seen.set(d[side], (seen.get(d[side]) ?? 0) + 1);
    }
    expect([...seen.keys()].sort((a, b) => a - b)).toEqual(ADAPTIVE.scales);
    for (const n of seen.values()) expect(n / 8000).toBeCloseTo(0.1, 1);
  });

  it('draws team 1’s scale, then team 2’s, from the battle’s own generator', () => {
    const d = createAdaptive();
    stepAdaptive(d, 0.1, () => 0.05);
    expect([d[1], d[2]]).toEqual([0.15, 0.15]);
    const draws = [0.95, 0.35];
    stepAdaptive(d, 15.1, () => draws.shift());
    expect([d[1], d[2]]).toEqual([2.5, 0.8]);
  });

  it('is one where there is no driver', () => {
    expect(scaleOf(null, 1)).toBe(1);
    expect(stepAdaptive(null, 5)).toBe(false);
  });
});

describe('as a difficulty', () => {
  it('is the base row with its aim widened by the side’s scale now', () => {
    const d = createAdaptive();
    stepAdaptive(d, 0.1, () => 0.95);
    const normal = difficultyFor('normal', ai);
    const row = adaptiveDifficulty(d, 2, ai);
    expect(row.key).toBe(normal.key);
    expect(row.adaptive).toBe(2.5);
    expect(row.aim.scale).toBeCloseTo(normal.aim.scale * 2.5, 9);
    expect(row.reaction(20)).toBe(normal.reaction(20));
    expect(adaptiveDifficulty(d, 1, ai, 'expert').aim.scale).toBeCloseTo(difficultyFor('expert', ai).aim.scale * 2.5, 9);
  });

  it('is the base row itself before the first draw', () => {
    expect(adaptiveDifficulty(createAdaptive(), 1, ai).aim).toEqual(difficultyFor('normal', ai).aim);
  });
});
