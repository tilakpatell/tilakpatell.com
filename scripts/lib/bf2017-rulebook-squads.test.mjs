import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readWebJson } from './bf2017-ebx.mjs';
import { checkSources } from './bf2017-rulebook.mjs';
import { squadsRow } from './bf2017-rulebook-squads.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');

describe('the squads rulebook', () => {
  const sq = squadsRow(ROOT, { strings: readWebJson(ROOT, 'strings/English.json') });

  it('reads the squad size and the deploy wait from the tactical spawn manager', () => {
    expect(sq.size).toBe(4);
    expect(sq.size_source).toBe('Gameplay/GameModes/Shared/SpawnManager_Shared_MP#TacticalSpawnManagerEntityData.MaxPlayersPerSquad');
    expect(sq).toMatchObject({ maxWait: 10, maxSpawnWait: 2, spawnOnFirstPlayer: true, fallbackToPoint: true, lockKitOnWave: true });
  });

  it('reads the squad-spawn offsets from the friendly position table the manager names', () => {
    expect(sq.offsets).toHaveLength(12);
    expect(sq.offsets[0]).toEqual([0, -3]);
    expect(sq.offsets[1]).toEqual([-1.6, -2.25]);
    expect(sq.offsets.at(-1)).toEqual([0, 3]);
    expect(sq.offsets_source).toMatch(/SpawnManagerEntityData\.FriendlySpawnPositionTables\[0\]/);
    expect(sq).toMatchObject({ attemptOffset: [0, 0, -6], attempts: 2, checkRadius: 1.5, safeEnemyDistance: 50 });
  });

  it('names the squads A to E, five a side from the mode’s forty players', () => {
    expect(sq.names).toEqual(['ID_SPAWN_GROUP_NAME_A', 'ID_SPAWN_GROUP_NAME_B', 'ID_SPAWN_GROUP_NAME_C', 'ID_SPAWN_GROUP_NAME_D', 'ID_SPAWN_GROUP_NAME_E']);
    expect(sq.squadsATeam).toBe(5);
    expect(sq.hq).toEqual({ light: 'ID_SPAWN_GROUP_NAME_REBELHQ', dark: 'ID_SPAWN_GROUP_NAME_IMPERIALHQ' });
    expect(sq.strings.ID_SQUAD_SPAWN_BLOCK_REASON_IN_COMBAT).toBe('IN COMBAT');
    expect(sq.strings.ID_SPAWN_GROUP_NAME_IMPERIALHQ).toBe('IMPERIAL HQ');
    expect(sq.blocked.combat).toBe('ID_SQUAD_SPAWN_BLOCK_REASON_IN_COMBAT');
    expect(sq.blocked.dead).toBe('ID_HUD_SQUADSPAWN_KILLED');
    expect(sq.inCombat).toEqual(['AffectorAppliedToMe', 'AppliedAffectorToOpponent', 'NearGrenade']);
  });

  it('reads the squad list’s place, rows, faces and palette picks from its widgets', () => {
    expect(sq.hud.place).toMatchObject({ anchor: [0, 1], offset: [90, -46], spacing: 32, radar: [256, 256] });
    expect(sq.hud).toMatchObject({ size: [320, 128], row: [320, 32], maxRows: 3 });
    expect(sq.hud.name).toMatchObject({ offset: [40, 0], font: 'Univers520MediumCondensed18px', localFont: 'Univers620BoldCondensed18px' });
    expect(sq.hud.icon).toMatchObject({ box: 32, pin: 22, svg: 26 });
    expect(sq.hud.bar).toMatchObject({ width: 64, height: 32, solidTo: 40 });
    expect(sq.hud.palette).toMatchObject({ dead: 34, party: 41, other: 42, iconDead: 35, icon: 60, local: 42, localIcon: 60 });
    expect(sq.hud.option).toEqual(['Default', 'NoOutline', 'Off']);
  });

  it('reads the deploy screen’s squad strip', () => {
    expect(sq.deploy).toMatchObject({ anchor: [0.5, 1], offset: [0, -132], size: [1152, 112], cell: [288, 112], maxRows: 3 });
  });

  it('names every number’s source', () => {
    expect(checkSources(sq)).toEqual([]);
  });
});
