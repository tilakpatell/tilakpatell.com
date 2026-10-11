import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { djb, mapRow } from './bf2017-rulebook-map.mjs';
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

// A fixture level with Strike's layer (Domination, the game's own id for it):
// the carried objective, its drop-off, the two sides' spawns, and a bomb the
// layer names without a transform (Review Focus 2)
function strikeLevel() {
  const dir = mkdtempSync(join(tmpdir(), 'bf2017-'));
  cpSync(ROOT, dir, { recursive: true });
  const tf = (x, z) => ({ right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 }, trans: { x, y: 10, z } });
  const at = (p) => join(dir, 'data', `Levels/MP/Fixture_02/${p}.json`);
  mkdirSync(join(dir, 'data', 'Levels/MP/Fixture_02'), { recursive: true });
  writeFileSync(at('Fixture_02'), JSON.stringify({ objects: [{ $type: 'LevelData' }] }));
  writeFileSync(at('Domination'), JSON.stringify({ objects: [{ $type: 'SubWorldData' }] }));
  const bp = (n, logic = false) => ({ $type: logic ? 'LogicPrefabReferenceObjectData' : 'SpatialPrefabReferenceObjectData', Blueprint: { $asset: `Gameplay/GameModes/Domination/${n}` } });
  writeFileSync(
    at('Domination_Logic'),
    JSON.stringify({
      objects: [
        { $type: 'LayerData' },
        { $type: 'AlternateSpawnEntityData', Team: 'Team1', Priority: 1, Enabled: true, Transform: tf(-50, 0) },
        { $type: 'AlternateSpawnEntityData', Team: 'Team2', Priority: 1, Enabled: true, Transform: tf(50, 0) },
        { ...bp('PF_Strike_CTF'), Transform: tf(0, 20) },
        { ...bp('Pf_FlagDropOff'), Transform: tf(-60, 5) },
        bp('PF_Strike_Bombs', true),
      ],
    }),
  );
  const tsv = join(dir, 'data.tsv');
  writeFileSync(tsv, readFileSync(tsv, 'utf8') + ['Fixture_02\tLevelData', 'Domination\tSubWorldData', 'Domination_Logic\tLayerData'].map((r) => { const [n, t] = r.split('\t'); return `Levels/MP/Fixture_02/${n}\t${t}\tdata/Levels/MP/Fixture_02/${n}.json\t100`; }).join('\n') + '\n');
  return dir;
}

describe('a level with Strike', () => {
  const m = mapRow(strikeLevel(), 'Levels/MP/Fixture_02/Fixture_02');

  it('reads Strike from its Domination layer: the two sides’ spawns, the objective and its drop-off', () => {
    expect(m.modes).toEqual(['strike']);
    expect(m.spawns.map((s) => [s.mode, s.team, s.at[0]])).toEqual([['strike', 1, -50], ['strike', 2, 50]]);
    expect(m.prefabs.filter((p) => p.at).map((p) => [p.name, p.at[0], p.at[2]])).toEqual([['PF_Strike_CTF', 0, 20], ['Pf_FlagDropOff', -60, 5]]);
  });

  it('lists the objective it cannot place under unplaced (Review Focus 2)', () => {
    expect(m.unplaced).toEqual([expect.objectContaining({ mode: 'strike', layer: 'Domination_Logic', name: 'PF_Strike_Bombs' })]);
  });
});

describe('the mode prefabs’ input names', () => {
  it('are the graphs’ djb2-xor hashes of the names', () => {
    // (the hashes Naboo's Strike and Jabba's palace's Extraction wire)
    expect(djb('BombALocation').toString(16)).toBe('97ae711b');
    expect(djb('CP1Overtime').toString(16)).toBe('965d909c');
    expect(djb('CheckpointPosition1').toString(16)).toBe('c7a11ce7');
    expect(djb('CaptureDuration').toString(16)).toBe('8ae4eedf');
  });
});
