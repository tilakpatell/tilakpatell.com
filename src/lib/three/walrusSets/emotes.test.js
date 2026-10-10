import { describe, expect, it } from 'vitest';
import { EMOTE_HEROES, EMOTE_SET, FRONTEND_IDLE, SOLDIER_VICTORY, victoryFor } from './emotes';

describe('the heroes’ emotes, victories and stage poses', () => {
  it('gives each hero its four emotes, its victories, its defeat and its stage idle', () => {
    const luke = EMOTE_SET('luke');
    expect(luke['emote.1']).toBe('E_Luke_01_Conflict');
    expect(luke['emote.4']).toBe('E_Luke_04_Greetings');
    expect(luke['victory.1']).toBe('EoR_Luke_Victory_01');
    expect(luke['frontend.idle']).toContain('UI_FrontEnd_Luke_MainMenu_01');
    expect(luke.defeat).toContain('A_Luke_Defeated_01');
    expect(EMOTE_SET('vader')['victory.2']).toBe('EoR_DarthVader_Victory_02');
    expect(EMOTE_SET('bobafett')['emote.1']).toBe('E_Boba_01_Price');
  });
  it('names a stage idle for every hero (lane M’s loadout stage plays frontend.idle)', () => {
    for (const h of EMOTE_HEROES) expect(FRONTEND_IDLE[h], h).toBeTruthy();
    expect(EMOTE_SET('palpatine')['frontend.idle']).toContain('UI_FrontEnd_Palpatine_MainMenu_01');
  });
  it('has no set for a kind that isn’t a hero, and the soldiers’ victories apart', () => {
    expect(EMOTE_SET('stormtrooper')).toEqual({});
    expect(SOLDIER_VICTORY['victory.1']).toContain('EoR_Assault_Victory_01');
  });
  it('picks a victory the figure has, by the round, none from a figure without', () => {
    const clips = { idle: 1, 'victory.1': 1, 'victory.3': 1 };
    expect(victoryFor(clips, 0)).toBe('victory.1');
    expect(victoryFor(clips, 1)).toBe('victory.3');
    expect(victoryFor(clips, 7)).toBe('victory.3');
    expect(victoryFor({ idle: 1 }, 0)).toBe(null);
    expect(victoryFor(null)).toBe(null);
  });
});
