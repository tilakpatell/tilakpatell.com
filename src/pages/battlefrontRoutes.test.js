import { describe, expect, it } from 'vitest';
import { menuRouteFor, wayBack } from '../components/battlefront';
import { GAME_MENU } from '../components/galaxy/gameLevels';

describe('the galaxy’s way into the game', () => {
  it('each row is the Battlefront world’s own menu route, and its way back is that world', () => {
    for (const [system, to] of Object.entries(GAME_MENU)) {
      expect(to).toBe(menuRouteFor(system, { from: `/galaxy/${system}` }));
      expect(wayBack(to.slice(to.indexOf('?')))).toMatchObject({ to: `/galaxy/${system}` });
    }
  });
});
