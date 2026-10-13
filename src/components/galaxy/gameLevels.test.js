import { describe, expect, it } from 'vitest';
import { GAME_MENU, gameMenuFor, landsOnSurface, wayDown } from './gameLevels';
import { canLand } from './surface/sites';

describe('the worlds that land in the game', () => {
  it('Hoth, and only Hoth, and it is a world the galaxy lets you land on', () => {
    expect(Object.keys(GAME_MENU)).toEqual(['hoth']);
    expect(gameMenuFor('hoth')).toBe('/battlefront/hoth?from=%2Fgalaxy%2Fhoth');
    expect(gameMenuFor('endor')).toBe(null);
    expect(gameMenuFor(undefined)).toBe(null);
    for (const s of Object.keys(GAME_MENU)) expect(canLand(s)).toBe(true);
  });
  it('a game world has no surface to list or to land on: its briefing shows neither', () => {
    expect(landsOnSurface('hoth')).toBe(false);
    expect(landsOnSurface('endor')).toBe(true);
  });
  it('the way down: the game’s menu for Hoth whatever the district, the surface for the rest', () => {
    expect(wayDown('hoth')).toEqual({ to: '/battlefront/hoth?from=%2Fgalaxy%2Fhoth', game: true });
    expect(wayDown('hoth', 'echo base')).toEqual({ to: '/battlefront/hoth?from=%2Fgalaxy%2Fhoth', game: true });
    expect(wayDown('endor')).toEqual({ to: '/galaxy/endor/surface', game: false });
    expect(wayDown('coruscant', 'level 1313')).toEqual({ to: '/galaxy/coruscant/surface?district=level%201313', game: false });
  });
});
