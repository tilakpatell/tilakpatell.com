import { describe, expect, it } from 'vitest';
import hoth from '../../src/data/bf2017/maps/hoth.json' with { type: 'json' };
import { spotFrom } from './bf2017-level-spots.mjs';

describe('spotFrom', () => {
  it('lands at the first team’s first spawn area in Galactic Assault (Hoth: the Imperial side’s)', () => {
    const s = spotFrom(hoth.rows);
    expect(s.spot.map(Math.round)).toEqual([115, -1363]);
    expect(s.from).toBe('FantasyBattle_Shapes:4');
  });

  it('takes the first spawn point where a mode has no areas, with its heading', () => {
    const rows = { spawns: [{ id: 'a', mode: 'galacticAssault', team: 2, enabled: true, at: [9, 0, 9], yaw: 1 }, { id: 'b', mode: 'galacticAssault', team: 1, enabled: true, at: [514.3, 230, 105.6], yaw: -0.2 }], polygons: [] };
    expect(spotFrom(rows)).toEqual({ spot: [514.3, 105.6], yaw: -0.2, from: 'b' });
  });

  it('says so when the map has nowhere to land', () => {
    expect(spotFrom({ spawns: [], polygons: [] })).toBe(null);
  });
});
