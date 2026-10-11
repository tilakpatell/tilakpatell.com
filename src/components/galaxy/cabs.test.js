import { describe, expect, it } from 'vitest';
import { CABS, GAME_CABS } from './cabs';
import { SHIP_MODELS } from '../universe/shipModels';

describe('the cockpit each ship shows', () => {
  it('is the game’s own for the X-wing and the Falcon, the built cab for the RV and the cruiser', async () => {
    expect(Object.keys(CABS).sort()).toEqual(['cruiser', 'falcon', 'rv', 'xwing']);
    expect([...GAME_CABS].sort()).toEqual(['falcon', 'xwing']);
    for (const kind of GAME_CABS) {
      const mod = await CABS[kind]();
      const game = await import('../cockpit/vehicles/game');
      expect(typeof mod.build).toBe('function');
      expect(game.COCKPITS[kind], kind).toMatch(/cockpit\.glb$/);
      // (the ship flown is the game's too: the cockpit matches its hull)
      expect(SHIP_MODELS[kind], kind).toMatch(/^\/models\/galaxy\/surface\//);
    }
    for (const kind of ['rv', 'cruiser']) {
      const mod = await CABS[kind]();
      expect(typeof mod.build, kind).toBe('function');
      expect(mod.cab, kind).toBeUndefined(); // (a built cab, not the game's)
    }
  });
});
