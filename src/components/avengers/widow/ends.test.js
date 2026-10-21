import { describe, expect, it } from 'vitest';
import { CAUGHT, levelEnd } from './ends';

describe('a level’s end card, in the 3D game’s words', () => {
  it('words a cleared level as the 3D game does', () => {
    expect(levelEnd({ turns: 16, takedowns: 0, bites: 0, stone: false }, 0)).toEqual({ won: true, kicker: 'Level 1 · Patrol · clear', title: 'Unseen.', line: '16 turns. One more line of her file, declassified.', stone: null, half: 'Natasha’s', stoneText: 'Natasha’s half of the Soul Stone. Clint has the other half, at the range.' });
    expect(levelEnd({ turns: 46, takedowns: 2, bites: 1, stone: true, both: true }, 7)).toMatchObject({ kicker: 'Level 8 · The archive · clear', title: 'The file is out.', line: '46 turns · 2 takedowns · 1 bite. Every line of it.', stone: 'soul', half: null, stoneText: 'Natasha’s half of the Soul Stone, and Clint’s: the Soul Stone is yours.' });
    expect(levelEnd({ turns: 30, takedowns: 1, bites: 0, stone: true, both: false }, 7)).toMatchObject({ stone: 'soul', half: 'Natasha’s' });
  });
  it('says who saw her', () => {
    expect(CAUGHT).toEqual({ guard: 'A guard saw you.', camera: 'The camera saw you.', laser: 'You stood in a live laser.' });
  });
});
