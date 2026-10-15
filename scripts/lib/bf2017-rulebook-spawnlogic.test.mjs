import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldHash as H } from './bf2017-abilities.mjs';
import { mapRow } from './bf2017-rulebook-map.mjs';
import { FAR_SPAWNS, STAGE_CHANGED, spawnLogic, stagePort } from './bf2017-rulebook-spawnlogic.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');

// A fixture level whose Galactic Assault sub-world switches a spawn point and
// an area: the Empire's stage-1 port and a bool into an And; the stage-changed
// event through a 25 s delay and a run-once splitter sets the bool, and a
// geometry trigger round an OBB does the same; a QA layer's point is left out.
function level() {
  const dir = mkdtempSync(join(tmpdir(), 'bf2017-'));
  cpSync(ROOT, dir, { recursive: true });
  const d = 'Levels/MP/Fixture_03';
  mkdirSync(join(dir, 'data', d), { recursive: true });
  const tf = (x, z) => ({ right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 }, trans: { x, y: 10, z } });
  const layer = (name, objects) => writeFileSync(join(dir, 'data', `${d}/${name}.json`), JSON.stringify({ name: `${d}/${name}`, type: 'LayerData', objects: [{ $type: 'LayerData' }, ...objects] }));
  const g = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  layer('FantasyBattle_Logic', [
    { $type: 'SpatialPrefabReferenceObjectData', $guid: g(1), Blueprint: { $asset: 'Gameplay/GameModes/FantasyBattles/PF_GameMode_Conquest_Staged' }, BlueprintTransform: tf(0, 0) },
    { $type: 'AlternateSpawnEntityData', $guid: g(2), Team: 'Team2', Priority: 1, Enabled: false, Transform: tf(10, 0) },
    { $type: 'AlternateSpawnEntityData', $guid: g(3), Team: 'Team1', Priority: 1, Enabled: true, Transform: tf(900, 0) },
  ]);
  layer('FantasyBattle_Spawns', [
    { $type: 'AndEntityData', $guid: g(11), InputCount: 2 },
    { $type: 'BoolEntityData', $guid: g(12), DefaultValue: false },
    { $type: 'EventSplitterEntityData', $guid: g(13), RunOnce: true },
    { $type: 'DelayEntityData', $guid: g(14), Delay: 25, RemoveDuplicateEvents: true },
    { $type: 'GeometryTriggerEntityData', $guid: g(15), Include: 'ATPlayers', TeamOfAllies: 'Team1', RunOnce: true, Enabled: true },
    { $type: 'ConsoleCommandTriggerEntityData', $guid: g(16) },
  ]);
  layer('FantasyBattle_Shapes', [
    { $type: 'SpawnLocationFinderShapeData', $guid: g(21), Team: 'Team2', Enabled: false, Points: [{ x: 0, y: 10, z: 0 }, { x: 20, y: 10, z: 0 }, { x: 20, y: 10, z: 20 }], IsClosed: true, Height: 0 },
    { $type: 'OBBData', $guid: g(22), Transform: tf(5, 5), HalfExtents: { x: 5, y: 5, z: 5 } },
  ]);
  layer('FantasyBattle_Automation', [{ $type: 'AlternateSpawnEntityData', $guid: g(31), Team: 'Team2', Priority: 1, Enabled: false, Transform: tf(30, 0) }]);
  const end = (name, n) => ({ $asset: `${d}/${name}`, $assetType: 'LayerData', $class: g(n) });
  const prop = (s, sf, t, tf2) => ({ Source: s, Target: t, SourceFieldId: sf, TargetFieldId: tf2 });
  const ev = (s, se, t, te) => ({ Source: s, Target: t, SourceEvent: { Id: se }, TargetEvent: { Id: te } });
  const [ga, pt] = [end('FantasyBattle_Logic', 1), end('FantasyBattle_Logic', 2)];
  const [and, bool, split, delay, trig, cons] = [11, 12, 13, 14, 15, 16].map((n) => end('FantasyBattle_Spawns', n));
  const [area, box] = [end('FantasyBattle_Shapes', 21), end('FantasyBattle_Shapes', 22)];
  const qa = end('FantasyBattle_Automation', 31);
  writeFileSync(
    join(dir, 'data', `${d}/FantasyBattle.json`),
    JSON.stringify({
      name: `${d}/FantasyBattle`,
      type: 'SubWorldData',
      objects: [
        {
          $type: 'SubWorldData',
          PropertyConnections: [prop(ga, stagePort(2, 1), and, H('In1')), prop(bool, H('Value'), and, H('In2')), prop(and, H('Out'), pt, H('Enabled')), prop(and, H('Out'), area, H('Enabled')), prop(and, H('Out'), qa, H('Enabled'))],
          EventConnections: [ev(ga, STAGE_CHANGED, delay, H('In')), ev(delay, H('Out'), split, 1723395486), ev(trig, H('OnEnter'), split, 1723395486), ev(split, -137490305, bool, H('SetTrue')), ev(cons, 669233475, bool, H('SetTrue'))],
          LinkConnections: [{ Source: trig, Target: box, SourceFieldId: 838548383, TargetFieldId: 0 }, { Source: ga, Target: end('FantasyBattle_Logic', 3), SourceFieldId: FAR_SPAWNS, TargetFieldId: 0 }],
        },
      ],
    }),
  );
  writeFileSync(join(dir, 'data', `${d}/Fixture_03.json`), JSON.stringify({ name: `${d}/Fixture_03`, type: 'LevelData', objects: [{ $type: 'LevelData' }] }));
  const rows = ['Fixture_03\tLevelData', 'FantasyBattle\tSubWorldData', 'FantasyBattle_Logic\tLayerData', 'FantasyBattle_Spawns\tLayerData', 'FantasyBattle_Shapes\tLayerData', 'FantasyBattle_Automation\tLayerData'];
  const tsv = join(dir, 'data.tsv');
  writeFileSync(tsv, readFileSync(tsv, 'utf8') + rows.map((r) => { const [n, t] = r.split('\t'); return `${d}/${n}\t${t}\tdata/${d}/${n}.json\t100`; }).join('\n') + '\n');
  return { dir, d };
}

describe('the spawn logic’s reader', () => {
  const { dir, d } = level();
  const g = spawnLogic(dir, `${d}/`, 'FantasyBattle');

  it('keeps the graph back from each switched record, by the map rulebook’s ids', () => {
    expect(g.enables).toEqual({ 'FantasyBattle_Logic:2': 'FantasyBattle_Spawns:1.Out', 'FantasyBattle_Shapes:1': 'FantasyBattle_Spawns:1.Out' });
    expect(g.nodes['FantasyBattle_Spawns:1']).toEqual({ type: 'and', n: 2 });
    expect(g.inputs['FantasyBattle_Spawns:1']).toEqual({ In1: `FantasyBattle_Logic:1.${stagePort(2, 1)}`, In2: 'FantasyBattle_Spawns:2.Value' });
    expect(g.nodes['FantasyBattle_Spawns:4']).toMatchObject({ type: 'delay', seconds: 25, dedupe: true });
  });

  it('names the mode prefab’s ports by their stage and its stage-changed event', () => {
    expect(g.nodes['FantasyBattle_Logic:1']).toMatchObject({ type: 'prefab', name: 'PF_GameMode_Conquest_Staged' });
    expect(g.nodes['FantasyBattle_Logic:1'].roles[stagePort(2, 1)]).toEqual({ role: 'stage', team: 2, stage: 1 });
    expect(g.nodes['FantasyBattle_Logic:1'].roles[STAGE_CHANGED]).toEqual({ role: 'stageChanged' });
    expect(stagePort(1, 2)).toBe(985615986);
    expect(stagePort(2, 3)).toBe(985719504);
  });

  it('keeps the events by name, a splitter’s ports as In and Out, and a trigger’s shape', () => {
    expect(g.events[`FantasyBattle_Logic:1.${STAGE_CHANGED}`]).toEqual(['FantasyBattle_Spawns:4.In']);
    expect(g.events['FantasyBattle_Spawns:3.Out']).toEqual(['FantasyBattle_Spawns:2.SetTrue']);
    expect(g.events['FantasyBattle_Spawns:5.OnEnter']).toEqual(['FantasyBattle_Spawns:3.In']);
    expect(g.nodes['FantasyBattle_Spawns:5']).toMatchObject({ type: 'trigger', shapes: ['FantasyBattle_Shapes:2'], allies: 1, once: true });
  });

  it('keeps the mode prefab’s far list: the starfighters’ spawn points, never a soldier’s', () => {
    expect(g.far).toEqual(['FantasyBattle_Logic:3']);
  });

  it('leaves out QA’s records and the console’s commands', () => {
    expect(Object.keys(g.enables)).not.toContain('FantasyBattle_Automation:1');
    expect(g.nodes['FantasyBattle_Spawns:6']).toEqual({ type: 'ignored', record: 'ConsoleCommandTriggerEntityData' });
    expect(g.unsupported).toEqual([]);
  });

  it('the map row carries it under its mode', () => {
    const m = mapRow(dir, `${d}/Fixture_03`);
    expect(Object.keys(m.spawnLogic)).toEqual(['galacticAssault']);
    expect(m.spawnLogic.galacticAssault.enables['FantasyBattle_Logic:2']).toEqual(['FantasyBattle_Spawns:1.Out']);
  });

  it('a level with no such sub-world has none', () => {
    expect(spawnLogic(ROOT, 'Levels/MP/Hoth_01/', 'FantasyBattle')).toBeNull();
  });
});
