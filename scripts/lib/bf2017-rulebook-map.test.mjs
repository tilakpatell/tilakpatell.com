import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapRow } from './bf2017-rulebook-map.mjs';
import { checkSources } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');

describe('the map row', () => {
  const m = mapRow(ROOT, 'hoth_01');

  it('finds the level and its modes', () => {
    expect(m.level).toBe('Levels/MP/Hoth_01/Hoth_01');
    expect(m.modes).toEqual(['galacticAssault']);
  });

  it('reads the spawns', () => {
    expect(m.spawns).toHaveLength(12);
    expect(m.spawns[0]).toMatchObject({ mode: 'galacticAssault', team: 2, priority: 1, enabled: false, layer: 'FantasyBattle_Logic' });
    expect(m.spawns[0].at[1]).toBeCloseTo(313.18, 2);
    expect(m.spawns[0].id).toMatch(/^FantasyBattle_Logic:\d+$/);
  });

  it('duplicate spawns collapse', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bf2017-'));
    cpSync(ROOT, dir, { recursive: true });
    const file = join(dir, 'data', 'Levels/MP/Hoth_01/FantasyBattle_Logic.json');
    const a = JSON.parse(readFileSync(file, 'utf8'));
    const first = a.objects.findIndex((o) => o.$type === 'AlternateSpawnEntityData');
    a.objects.push(structuredClone(a.objects[first]), structuredClone(a.objects[first]));
    writeFileSync(file, JSON.stringify(a));
    expect(mapRow(dir, 'hoth_01').spawns).toHaveLength(12);
  });

  it('a spawn or box without a transform is missing, never a throw', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bf2017-'));
    cpSync(ROOT, dir, { recursive: true });
    const file = join(dir, 'data', 'Levels/MP/Hoth_01/FantasyBattle_Logic.json');
    const a = JSON.parse(readFileSync(file, 'utf8'));
    delete a.objects.find((o) => o.$type === 'AlternateSpawnEntityData').Transform;
    writeFileSync(file, JSON.stringify(a));
    const m2 = mapRow(dir, 'hoth_01');
    expect(m2.spawns).toHaveLength(11);
    expect(m2._missing.some((x) => x.startsWith('transform:'))).toBe(true);
  });

  it('reads the shapes', () => {
    expect(m.polygons).toHaveLength(54);
    expect(m.polygons[0]).toMatchObject({ team: 2, enabled: false });
    expect(m.volumes.filter((v) => v.layer === 'FantasyBattle_Shapes')).toHaveLength(16);
    expect(m.volumes.find((v) => v.layer === 'FantasyBattle_Shapes').y).toBeCloseTo(817.5338, 4);
    expect(m.spheres).toHaveLength(2);
    expect(m.boxes).toHaveLength(2);
  });

  it('reads the walkers’ paths, locators and cameras', () => {
    expect(m.waypoints.length).toBeGreaterThanOrEqual(1);
    expect(m.waypoints[0].points.length).toBeGreaterThanOrEqual(2);
    expect(m.waypoints[0].points[0]).toHaveLength(3);
    expect(m.locators.length).toBeGreaterThanOrEqual(1);
    expect(m.cameras[0]).toMatchObject({ focalLength: 35 });
  });

  it('reads the objective strings, the terrain and the vehicle spawns', () => {
    expect(m.strings).toContain('ID_FANTASYBATTLES_HOTH_FUEL_SILO');
    expect(m.terrain.world.file).toMatch(/hoth_01_terrain_height\.png$/);
    expect(m.vehicleSpawns[0]).toMatchObject({ blueprint: 'Gameplay/Vehicles/Mount/Tauntaun/Mount_Tauntaun' });
    expect(m.vehicleSpawns[0].at).toHaveLength(3);
    expect(m.bounds.min[0]).toBeLessThan(m.bounds.max[0]);
  });

  it('names every number’s source', () => {
    expect(checkSources(m)).toEqual([]);
  });
});

describe('a space level’s row (Starfighter Assault)', () => {
  const m = mapRow(ROOT, 'sb_endor_01');

  it('finds the level under Levels/Space and its mode', () => {
    expect(m.level).toBe('Levels/Space/SB_Endor_01/SB_Endor_01');
    expect(m.modes).toEqual(['starfighter']);
  });

  it('reads the launch points by team', () => {
    expect(m.spawns).toHaveLength(6);
    expect(new Set(m.spawns.map((s) => s.team))).toEqual(new Set([1, 2]));
    expect(m.spawns.every((s) => s.layer === 'SpaceBattle_Logic' && s.mode === 'starfighter')).toBe(true);
  });

  it('reads the phases in the game’s order, and who attacks', () => {
    const sb = m.spaceBattle;
    expect(sb).toMatchObject({ attacker: 2, defender: 1 });
    expect(sb.phases.map((p) => p.name)).toEqual(['Phase 1 - Corvettes', 'Phase 2 - Mines', 'Phase 3 - MC80', 'Intermission']);
    expect(sb.phases[0].objectives.map((o) => o.name)).toEqual(['CR90_A', 'CR90_B', 'CR90_C']);
    expect(sb.phases[1].objectives).toHaveLength(6);
    expect(sb.phases[2].objectives).toHaveLength(8);
    expect(sb.phases[0].objectives[0]).toMatchObject({ team: 1, metric: 'KillCount', showHealth: true });
    // (the phases' words are the stage strings; a TIE bomber flight's are its own)
    expect(sb.phases[0].objectives[0].attack).toBeNull();
    const bombers = sb.secondary.filter((o) => o.icon === 'TIEBomber');
    expect(bombers).toHaveLength(2);
    expect(bombers[0].attack.instruction).toMatch(/^[0-9A-F]{8}$/);
  });

  it('reads the objectives’ prefabs where the level puts them', () => {
    const mines = m.prefabs.filter((p) => p.name === 'PF_Endor_SpaceBattles_Transmitter_Objective');
    expect(mines).toHaveLength(6);
    expect(mines[0].at).toHaveLength(3);
    expect(m.prefabs.filter((p) => p.name === 'PF_CorvetteCR90_01')).toHaveLength(3);
    expect(m.strings).toContain('ID_SPACEBATTLES_OBJ_TEAM_2_ENDOR_PHASE_1');
  });

  it('reads the capital ships the mode’s sub-level places, without the end of round’s room', () => {
    const placed = m.placed.starfighter;
    expect(placed.some((p) => p.mesh === 'mc80_mainhull_01')).toBe(true);
    expect(placed.some((p) => p.mesh === 'stardestroyer_hull_01_sb_endor')).toBe(true);
    expect(placed.filter((p) => p.mesh === 'corvettecr90_01')).toHaveLength(3);
    expect(placed.some((p) => /nowhere/.test(p.mesh))).toBe(false);
    expect(placed[0].quat).toHaveLength(4);
    // (the Star Destroyer, turned half round, has its bounds' middle ahead of its pivot)
    const isd = placed.find((p) => p.mesh === 'stardestroyer_hull_01_sb_endor');
    expect(isd.r).toBeGreaterThan(800);
    expect(isd.centre).toHaveLength(3);
    expect(m.terrain).toBeUndefined();
  });

  it('names every number’s source', () => {
    expect(checkSources(m)).toEqual([]);
  });
});
