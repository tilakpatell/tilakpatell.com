import { describe, expect, it } from 'vitest';
import { abilityOf, aiOf, camerasOf, cardOf, classOf, heroOf, lightingOf, loadRulebook, mapOf, pointsOf, reinforcementOf, spawnsFor, squadsOf, stagesOf, stringOf, teamsFor, uiOf, vehicleOf, volumeOf, weaponOf } from './rulebook.js';

describe('the rulebook', () => {
  const rb = loadRulebook();

  it('is one frozen object', () => {
    expect(Object.isFrozen(rb)).toBe(true);
  });

  it('reads weapons, classes, heroes, reinforcements, vehicles, abilities and cards by id', () => {
    expect(weaponOf(rb, 'a280c').firing.rof).toBe(600);
    expect(classOf(rb, 'l-orig-assault').health).toBe(150);
    expect(heroOf(rb, 'darthvader').health).toBe(800);
    expect(reinforcementOf(rb, 'RebelJumpTrooper').kind).toBe('aerial');
    expect(vehicleOf(rb, 'Vehicle_Ground_AT-AT_MP').health).toBe(40000);
    expect(abilityOf(rb, 'Ability_DarthVader_ForceChoke_02').recharge).toBe(25);
    expect(cardOf(rb, 'SC_Trooper_01_AssaultTraining').kind).toBe('passive');
  });

  it('throws on an id that is not there, naming it', () => {
    expect(() => weaponOf(rb, 'nope')).toThrow(/nope/);
    expect(() => heroOf(rb, 'rey')).toThrow(/rey/);
    expect(() => mapOf(rb, 'jakku')).toThrow(/jakku/);
  });

  it('gives a level’s teams for an era', () => {
    const t = teamsFor(rb, 'hoth');
    expect(t.light.heroes).toContain('luke');
    expect(t.dark.classes).toContain('d-orig-assault');
  });

  it('reads Hoth’s map, stages, spawns and volumes', () => {
    const map = mapOf(rb, 'hoth');
    expect(stagesOf(rb, 'hoth', 'galacticAssault').stages).toHaveLength(3);
    expect(stagesOf(rb, 'hoth', 'blast')).toBeNull();
    expect(spawnsFor(map, { mode: 'galacticAssault', team: 2 }).length).toBeGreaterThan(50);
    const stage = stagesOf(rb, 'hoth', 'galacticAssault').stages[1];
    expect(spawnsFor(map, { mode: 'galacticAssault', ids: stage.spawns.attack })).toHaveLength(stage.spawns.attack.length);
    expect(volumeOf(map, 'FantasyBattle_Shapes:33').kind).toBe('shape');
    expect(() => volumeOf(map, 'FantasyBattle_Shapes:999')).toThrow(/999/);
  });

  it('reads the look, the cameras, the HUD, the AI, the points and the strings', () => {
    expect(lightingOf(rb, 'hoth').lights.length).toBeGreaterThan(100);
    expect(camerasOf(rb).soldier.arm).toBe(1.2);
    expect(Object.keys(uiOf(rb).widgets)).toContain('SpawnOverlayScreen');
    expect(aiOf(rb).tactics.AIRebelSoldierTactics.engage.distance).toBe(40);
    expect(pointsOf(rb).cost.heroes.default).toBe(4000);
    const silo = stringOf(rb, 'ID_FANTASYBATTLES_HOTH_FUEL_SILO');
    expect(silo).toBeTruthy();
    expect(silo).not.toBe('ID_FANTASYBATTLES_HOTH_FUEL_SILO');
    expect(stringOf(rb, 'ID_NOT_THERE')).toBe('ID_NOT_THERE');
  });

  it('reads the squads, and their words beside the strings', () => {
    expect(squadsOf(rb).size).toBe(4);
    expect(squadsOf(rb).offsets[0]).toEqual([0, -3]);
    expect(stringOf(rb, 'ID_SQUAD_SPAWN_BLOCK_REASON_IN_COMBAT')).toBe('IN COMBAT');
    expect(stringOf(rb, 'ID_SPAWN_GROUP_NAME_A')).toBe('A');
  });
});
