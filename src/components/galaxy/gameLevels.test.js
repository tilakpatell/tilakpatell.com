import { describe, expect, it } from 'vitest';
import { GAME_MENU, freeRoamOnly, gameMenuFor, groundBattle, wayDown } from './gameLevels';
import { systemById } from './systems';
import { canLand } from './surface/sites';

describe('the worlds that land in the game', () => {
  it('Hoth, and only Hoth, and it is a world the galaxy lets you land on', () => {
    expect(Object.keys(GAME_MENU)).toEqual(['hoth']);
    expect(gameMenuFor('hoth')).toBe('/battlefront/hoth?from=%2Fgalaxy%2Fhoth');
    expect(gameMenuFor('endor')).toBe(null);
    expect(gameMenuFor(undefined)).toBe(null);
    for (const s of Object.keys(GAME_MENU)) expect(canLand(s)).toBe(true);
  });
  it('a world the engine plays is free roam on its surface, and no other world is held to that', () => {
    expect(freeRoamOnly('hoth')).toBe(true);
    expect(freeRoamOnly('endor')).toBe(false);
    expect(freeRoamOnly(undefined)).toBe(false);
  });
  it('the way down: the engine first for Hoth whatever the district, its free roam on its own button, the surface for the rest', () => {
    expect(wayDown('hoth')).toEqual({ to: '/battlefront/hoth?from=%2Fgalaxy%2Fhoth', game: true });
    expect(wayDown('hoth', 'echo base')).toEqual({ to: '/battlefront/hoth?from=%2Fgalaxy%2Fhoth', game: true });
    expect(wayDown('hoth', null, { free: true })).toEqual({ to: '/galaxy/hoth/surface?mode=free', game: false });
    expect(wayDown('hoth', 'base', { free: true })).toEqual({ to: '/galaxy/hoth/surface?district=base&mode=free', game: false });
    expect(wayDown('endor')).toEqual({ to: '/galaxy/endor/surface', game: false });
    expect(wayDown('coruscant', 'level 1313')).toEqual({ to: '/galaxy/coruscant/surface?district=level%201313', game: false });
  });
});

describe('the battle on a world’s ground', () => {
  it('is the game’s menu for a game world, the surface’s assault for the rest, and nothing where there is neither', () => {
    expect(groundBattle(systemById('hoth'))).toBe('/battlefront/hoth?from=%2Fgalaxy%2Fhoth');
    expect(groundBattle(systemById('endor'))).toBe('/galaxy/endor/surface?mission=assault');
    expect(groundBattle(systemById('dagobah'))).toBe(null);
    expect(groundBattle(null)).toBe(null);
  });
});
