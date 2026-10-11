import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSources } from './bf2017-rulebook.mjs';
import { kitsRulebook, pointsRulebook } from './bf2017-rulebook-costs.mjs';

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

describe('the kit limits from the PF_KitLimitations_* prefabs', () => {
  const k = kitsRulebook(ROOT, { books: { heroes: { darthvader: { id: 'darthvader', kit: 'Gameplay/Kits/Hero/DarthVader/Kit_Hero_DarthVader' } } }, gameplay: ['Gameplay/Kits/Hero/DarthVader/GP_Hero_DarthVader'] });
  const rows = k.planetaryBattles.rows;

  it('names each row’s kit by its gameplay asset’s Identifier', () => {
    const vader = rows.find((r) => r.kit === 'Gameplay/Kits/Hero/DarthVader/GP_Hero_DarthVader');
    expect(vader).toMatchObject({ id: 'darthvader', kind: 'hero', kitId: 518018118 });
  });

  it('reads a hero’s limit through PF_HeroKitMaxCount and its price from the record', () => {
    const vader = rows.find((r) => r.id === 'darthvader');
    expect(vader.maxCount).toBe(1);
    expect(vader.maxCount_source).toMatch(/PF_HeroKitMaxCount|PF_KitLimitations_PlanetaryBattles/);
    expect(vader.price).toBe(4000);
    expect(vader.price_source).toMatch(/^Online\/BattlepointCostData#/);
  });

  it('reads a unit’s limit from the prefab’s own field', () => {
    const six = rows.filter((r) => r.maxCount === 6);
    expect(six.length).toBeGreaterThan(10);
    expect(six[0].maxCount_source).toMatch(/InterfaceDescriptorData\.Fields\.\d+\.Value$/);
  });

  it('refuses the sequel era’s kits the shared matcher misses (the Flametrooper, the special forces TIE)', () => {
    const more = kitsRulebook(ROOT, { gameplay: ['Gameplay/Kits/Specials/Flametrooper/GP_Special_Flametrooper', 'Gameplay/Kits/Vehicle/TieFighter_SpecialForces/GP_Vehicle_TieFighter_SpecialForces'] });
    const named = more.planetaryBattles.rows.map((r) => r.kit).filter(Boolean);
    expect(named.filter((k) => /Flametrooper|SpecialForces/.test(k))).toEqual([]);
    expect(more.counts.refused).toBeGreaterThanOrEqual(2);
  });

  it('counts what resolved, and every number names its source', () => {
    expect(k.counts.rows).toBeGreaterThan(70);
    expect(k.counts.maxCount).toBeGreaterThan(60);
    expect(checkSources(k)).toEqual([]);
  });
});
