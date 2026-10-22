import { describe, expect, test } from 'vitest';
import { DIFFICULTIES } from '../../../../lib/battlefront/ai/difficulty';
import { DEFAULT_DIFFICULTY, difficultyFrom, difficultyLabel, difficultyName, nextDifficulty } from './difficulty';

describe('the ground war’s difficulty', () => {
  test('one of the game’s multiplayer names, Normal by default', () => {
    expect(DEFAULT_DIFFICULTY).toBe('normal');
    expect(DIFFICULTIES).toContain(DEFAULT_DIFFICULTY);
    expect(difficultyName('expert')).toBe('expert');
    expect(difficultyName('EXPERT')).toBe('expert');
    expect(difficultyName('nightmare')).toBe('normal');
    expect(difficultyName(null)).toBe('normal');
  });
  test('the address wins over what was kept, which wins over the default', () => {
    expect(difficultyFrom('rookie', 'expert')).toBe('rookie');
    expect(difficultyFrom(null, 'expert')).toBe('expert');
    expect(difficultyFrom(null, null)).toBe('normal');
  });
  test('the Menu goes round them in the game’s order, and names each', () => {
    const seen = [DEFAULT_DIFFICULTY];
    for (let i = 1; i < DIFFICULTIES.length; i++) seen.push(nextDifficulty(seen[i - 1]));
    expect(new Set(seen).size).toBe(DIFFICULTIES.length);
    expect(nextDifficulty(seen[seen.length - 1])).toBe(DEFAULT_DIFFICULTY);
    expect(difficultyLabel('rookie')).toBe('Rookie');
  });
});
