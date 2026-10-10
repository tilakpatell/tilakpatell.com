import { describe, expect, it } from 'vitest';
import LIBRARY from '../../../../data/bf2017/library.json';
import { GAME_FOR, modelFor } from './bf2017-game-for';
import { gameName } from './bf2017-slug';
import { SURFACE_MODELS } from './index';

const INDEX = new Set(LIBRARY.map((r) => r.name));

describe('the worlds’ props, the game’s', () => {
  it('maps only kinds the site has, each to an object in the library’s index', () => {
    for (const [kind, game] of Object.entries(GAME_FOR)) {
      expect(SURFACE_MODELS[kind], kind).toBeTruthy();
      expect(INDEX.has(gameName(game)), game).toBe(true);
    }
  });

  it('keeps the site’s own on low, and where the game’s is not published (Review Focus 2)', () => {
    const models = { [GAME_FOR.barrel]: { url: '/x.glb' } };
    expect(modelFor('barrel', 'low', models)).toBeNull();
    expect(modelFor('barrel', 'mid', models)).toBe(GAME_FOR.barrel);
    expect(modelFor('barrel', 'ultra', models)).toBe(GAME_FOR.barrel);
    expect(modelFor('vaporator', 'high', models)).toBeNull();
    expect(modelFor('lamp', 'high', models)).toBeNull();
  });
});
