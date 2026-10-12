import { describe, expect, it } from 'vitest';
import { ENABLED, buildGraph, evalField, findPrefab, stageSets } from './bf2017-stages.mjs';

// a sub-world wired like Hoth's: the prefab's ports through And/Not gates into the areas' Enabled
const PREFAB = 'pf';
const conn = (from, field, to, target = ENABLED) => ({ Source: { $class: from }, SourceFieldId: field, Target: { $class: to }, TargetFieldId: target });
const ports = { 1: [11, 12], 2: [21, 22] };
const layers = {
  L_Logic: { objects: [{ $type: 'SpatialPrefabReferenceObjectData', $guid: PREFAB, Blueprint: { $asset: 'Gameplay/GameModes/FantasyBattles/PF_GameMode_Conquest_Staged' } }, { $type: 'AlternateSpawnEntityData', $guid: 'p1', Team: 'Team2' }] },
  L_Shapes: {
    objects: [
      { $type: 'SpawnLocationFinderShapeData', $guid: 'a1', Team: 'Team2' },
      { $type: 'SpawnLocationFinderShapeData', $guid: 'a2', Team: 'Team2' },
      { $type: 'SpawnLocationFinderShapeData', $guid: 'n1', Team: 'TeamNeutral' },
      { $type: 'SpawnLocationFinderShapeData', $guid: 'static', Team: 'Team1', Enabled: true },
    ],
  },
  L_Spawns: {
    objects: [
      { $type: 'AndEntityData', $guid: 'and', InputCount: 2 },
      { $type: 'NotEntityData', $guid: 'not', In: false },
      { $type: 'BoolEntityData', $guid: 'b', DefaultValue: true },
      { $type: 'BoolEntityData', $guid: 'trig', DefaultValue: false },
      { $type: 'AndEntityData', $guid: 'and2', InputCount: 2 },
    ],
  },
};
const sub = {
  objects: [
    {
      PropertyConnections: [
        conn(PREFAB, 21, 'and', 1), // Team2 stage 1 → And
        conn('b', 0, 'and', 2), // the constant Bool → And
        conn('and', 0, 'a1'), // → a1 enabled in stage 1
        conn('and', 0, 'p1'),
        conn(PREFAB, 21, 'not', 1), // Not(stage 1) → a2: enabled in stage 2
        conn('not', 0, 'a2'),
        conn(PREFAB, 12, 'n1'), // the Team1 stage-2 port opens the neutral area
        conn(PREFAB, 22, 'and2', 1), // stage 2 and a trigger-set Bool
        conn('trig', 0, 'and2', 2),
        conn('and2', 0, 'a1'),
      ],
      EventConnections: [{ Target: { $class: 'trig' } }],
    },
  ],
};

describe('the stage sets from the wiring', () => {
  const g = buildGraph(sub, layers);

  it('reads a chain of gates from a port into an Enabled', () => {
    const on = new Map([[PREFAB, new Map([[21, true]])]]);
    const off = new Map([[PREFAB, new Map([[21, false]])]]);
    expect(evalField(g, 'a1', ENABLED, on)).toBe(true);
    expect(evalField(g, 'a2', ENABLED, on)).toBe(false);
    expect(evalField(g, 'a2', ENABLED, off)).toBe(true);
    expect(evalField(g, 'static', ENABLED, on)).toBe(null);
  });

  it('marks a chain through an event-set Bool as gated', () => {
    const stage2 = new Map([[PREFAB, new Map([[22, true]])]]);
    expect(evalField(g, 'a1', ENABLED, stage2)).toBe('gated');
  });

  it('splits each stage’s areas and points by side, a neutral area to the side whose port opens it', () => {
    const sets = stageSets(g, { prefab: PREFAB, ports, stages: 2, teams: { attack: 2, defend: 1 } });
    expect(sets[0].areas).toEqual({ attack: ['L_Shapes:0'], defend: [], gated: [] });
    expect(sets[0].points).toEqual({ attack: ['L_Logic:1'], defend: [], gated: [] });
    expect(sets[1].areas.attack).toEqual(['L_Shapes:0', 'L_Shapes:1']);
    expect(sets[1].areas.gated).toEqual(['L_Shapes:0']);
    expect(sets[1].areas.defend).toEqual(['L_Shapes:2']);
    expect(findPrefab(layers)).toEqual({ guid: PREFAB, id: 'L_Logic:0' });
  });
});
