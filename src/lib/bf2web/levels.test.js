import { describe, expect, it } from 'vitest';
import { ENGINE_WORLDS, worldsOf } from './levels.js';
import PLAY from '../../data/bf2web/play.json';
import BOOK from '../../data/bf2017/modes.json';

describe('the worlds the engine plays, off its build', () => {
  it('matches a build’s levels to the worlds whose ground they are, in the game’s spelling or not', () => {
    expect(worldsOf(['Hoth_01'], BOOK.worlds)).toEqual(['hoth']);
    expect(worldsOf(['hoth_02', 'Hoth_01'], BOOK.worlds)).toEqual(['hoth']);
    // (a world's other maps count: Jabba's palace is Tatooine's ground)
    expect(worldsOf(['JabbasPalace_01', 'Endor_04'], BOOK.worlds)).toEqual(['endor', 'tatooine']);
    expect(worldsOf(['Crait_01'], BOOK.worlds)).toEqual([]);
    expect(worldsOf(undefined, BOOK.worlds)).toEqual([]);
    expect(worldsOf(['Hoth_01'], undefined)).toEqual([]);
  });
  it('is the live build’s: Hoth, while bf2-web’s build lists Hoth’s level alone', () => {
    expect(ENGINE_WORLDS).toEqual(worldsOf(PLAY.levels, BOOK.worlds));
    expect(PLAY.levels).toEqual(['Hoth_01']);
    expect(ENGINE_WORLDS).toEqual(['hoth']);
  });
});
