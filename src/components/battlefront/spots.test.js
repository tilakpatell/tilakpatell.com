import { describe, expect, it } from 'vitest';
import { loadRulebook, mapOf, stagesOf } from '../../lib/battlefront/rulebook.js';
import { SPOTS, spotsOf } from './spots.js';

const rb = loadRulebook();
const spots = spotsOf(mapOf(rb, 'hoth'), stagesOf(rb, 'hoth', 'galacticAssault'));
const byName = Object.fromEntries(spots.map((s) => [s.name, s]));

describe('the gallery’s spots, from the level’s own records', () => {
  it('names nine places, lane 5’s three shots making the twelve', () => {
    expect(spots.map((s) => s.name)).toEqual(SPOTS);
    expect(SPOTS).toHaveLength(9);
    for (const s of spots) {
      expect(s.at).toHaveLength(3);
      expect(s.lookAt).toHaveLength(3);
      expect(s.fov).toBeGreaterThan(20);
      expect(s.source).toMatch(/FantasyBattle_/);
    }
  });

  it('stands under the first AT-AT’s path, low, looking up the way it walks', () => {
    const w = byName.walker;
    expect(w.source).toBe('FantasyBattle_Logic:123');
    expect(w.lookAt[1]).toBeGreaterThan(w.at[1]);
  });

  it('takes the hangar mouth at the low sun and from inside under the interior record', () => {
    expect(byName.hangar.weather).toBe('sunset');
    expect(byName.hangarInside.weather).toBe('interior');
    expect(byName.hangar.source).toBe('FantasyBattle_Shapes:33');
  });

  it('frames the first uplink, and five of the level’s own cameras as the game placed them', () => {
    expect(byName.uplink.source).toBe('FantasyBattle_Logic:274');
    const cams = spots.filter((s) => s.name.startsWith('camera'));
    expect(cams).toHaveLength(5);
    expect(cams[0].at).toEqual(mapOf(rb, 'hoth').cameras[0].at);
  });
});
