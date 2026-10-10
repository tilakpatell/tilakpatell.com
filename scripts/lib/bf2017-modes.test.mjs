import { describe, expect, it } from 'vitest';
import { modesOf, modesRulebook } from './bf2017-modes.mjs';
import { stringHash } from './bf2017-ebx.mjs';

// (a cut of the levels' subworld lists, as the web build's manifests have them)
const HOTH = ['Cinematics', 'Cloudy', 'EOR', 'FantasyBattle', 'HeroArena', 'Hoth_01', 'HvsVIntro', 'Lobby', 'Mode6', 'Mode6_Intro', 'Mode9', 'Outro_Team1', 'PlanetaryMissions', 'TeamDeathmatch', 'TeamDeathmatch_Online', 'TeamDeathmatch_Skirmish'];
const SB_ENDOR = ['Art', 'Cinematics', 'IntroTeam1_NIS', 'Lobby', 'Mode7', 'Mode7_Intro', 'SB_Endor_01', 'SpaceArcadeTeamBattle', 'SpaceBattle'];
const strings = { strings: { [stringHash('ID_RP_GAMEMODE_PLANETARYBATTLES')]: 'Galactic Assault', [stringHash('ID_PLAY_SCR_SKIRMISH')]: 'ARCADE', [stringHash('ID_RP_LEVEL_HOTH')]: 'Hoth' } };

describe('the modes a level carries', () => {
  it('reads its mode layers, not its art, light or cinematics', () => {
    expect(modesOf(HOTH)).toEqual(['galacticAssault', 'hvv', 'blast', 'showdown', 'coop', 'arcade']);
    expect(modesOf(SB_ENDOR)).toEqual(['starfighter', 'heroStarfighters', 'arcade']);
    // (a layer's case and its misspellings, as the levels have them)
    expect(modesOf(['mode6', 'TeamDeathmatch_Skrimish'])).toEqual(['blast', 'showdown']);
    expect(modesOf(['Levels/MP/Geonosis_01/HeroesVsVillains', { name: 'Extraction' }])).toEqual(['hvv', 'extraction']);
  });
  it('gathers the levels by the galaxy’s world, ground and space, and names them', () => {
    const book = modesRulebook([
      { level: 'Levels/MP/Hoth_01/Hoth_01', subworlds: HOTH },
      { level: 'Levels/Space/SB_Endor_01/SB_Endor_01', subworlds: SB_ENDOR },
      { level: 'Levels/MP/Endor_02/Endor_02', subworlds: ['Mode3', 'TeamDeathmatch'] },
    ], strings);
    expect(book.worlds.hoth).toEqual({ ground: ['hoth_01'], space: [], modes: ['galacticAssault', 'hvv', 'blast', 'showdown', 'coop', 'arcade'] });
    expect(book.worlds.endor.space).toEqual(['sb_endor_01']);
    expect(book.worlds.endor.modes).toEqual(['starfighter', 'blast', 'ewokHunt', 'heroStarfighters', 'arcade']);
    expect(book.levels.sb_endor_01.space).toBe(true);
    expect(book.names.modes.galacticAssault).toEqual({ id: 'ID_RP_GAMEMODE_PLANETARYBATTLES', text: 'Galactic Assault' });
    expect(book.names.modes.arcade.text).toBe('Arcade');
    expect(book.names.worlds.hoth.text).toBe('Hoth');
  });
  it('refuses the sequel era’s levels', () => {
    const book = modesRulebook([
      { level: 'Levels/MP/Jakku_01/Jakku_01', subworlds: ['FantasyBattle'] },
      { level: 'S1/Levels/Crait_01/Crait_01', subworlds: ['FantasyBattle'] },
      { level: 'Levels/Space/SB_Resurgent_01/SB_Resurgent_01', subworlds: ['SpaceBattle'] },
    ]);
    expect(book.worlds).toEqual({});
  });
});
