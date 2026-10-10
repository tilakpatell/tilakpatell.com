import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSources } from './bf2017-rulebook.mjs';
import { pointsRulebook } from './bf2017-rulebook-costs.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');

describe('the Battle Points from Online/BattlepointCostData', () => {
  const p = pointsRulebook(ROOT);

  it('prices the heroes from HeroCostConfig, and refuses the sequel era’s', () => {
    expect(p.cost.heroes.luke).toBe(4000);
    expect(p.cost.heroes.darthvader).toBe(4000);
    expect(p.cost.heroes.default).toBe(4000);
    expect(p.cost.heroes.luke_source).toMatch(/^Online\/BattlepointCostData#BattlepointCostData\.HeroCostConfig\.0\.BattlepointHeroCostEntries\.\d+\.EraCost$/);
    expect(p.cost.heroes.rey).toBeUndefined();
    expect(p.refused).toEqual(expect.arrayContaining(['REY', 'KYLO_REN', 'X_WING_T70', 'FIRSTORDER_JUMPTROOPER', 'JUMPCOP']));
  });

  it('prices the units of the default table by the rulebooks’ ids, the rest by the record’s names', () => {
    expect(p.cost.units.WookieWarrior).toBe(1500);
    expect(p.cost.units.JumpTrooper).toBe(1000);
    expect(p.cost.units.Kit_Vehicle_ATST).toBe(800);
    expect(p.cost.units.Kit_Vehicle_Xwing_T65).toBe(400);
    expect(p.cost.other.DROIDEKA).toBe(1000);
    expect(p.cost.other.FLAMETROOPER).toBeUndefined();
  });

  it('keeps each map’s own table by mode and level key', () => {
    const hoth = p.cost.byMode.galacticAssault.hoth_01;
    expect(hoth.map).toBe('HOTH');
    expect(hoth.units.Kit_Vehicle_Awing).toBe(200);
    expect(hoth.units.EwokRebel).toBe(1500);
    expect(p.cost.byMode.galacticAssault.deathstar02_01.map).toBe('DEATHSTAR2');
    expect(p.cost.byMode.extraction.kessel_01.units.WookieWarrior).toBe(1500);
    expect(p.cost.byMode.galacticAssault.jakku_01).toBeUndefined();
  });

  it('keeps the modes’ settings the record holds beside the costs', () => {
    expect(p.settings.blast.BLAST_SPAWNTIME).toBe(5);
    expect(p.settings.hvv.HEROES_VERSUS_VILLAINS_TDM_TICKETS).toBe(35);
    expect(p.settings.strike.PLANETARY_MISSIONS_BOMB_DETONATE_TIME_1).toBe(60);
    expect(p.settings.galacticAssault.GLOBAL_CAPTURE_POINT_TIME).toBe(60);
    // (a setting in a map's cost table is that map's setting)
    expect(p.cost.byMode.galacticAssault.geonosis_01.settings.GLOBAL_OBJECTIVE_INTERACT_TIME).toBe(30);
    expect(p.settings.global.LIGHTSABER_COSTS_MELEE_VADER).toBe(100);
    expect(p.settings.global.LIGHTSABER_COSTS_MELEE_KYLO).toBeUndefined();
  });

  it('keeps by hand only what the record does not hold', () => {
    expect(p.earn).toMatchObject({ source: 'hand', kill: 100, assist: 50 });
    expect(p.limits).toMatchObject({ source: 'hand', heroesPerTeam: 1, reinforcementsPerTeam: 4 });
    expect(p.bpRate).toMatchObject({ source: 'hand', value: 1 });
    expect(checkSources(p)).toEqual([]);
  });
});
