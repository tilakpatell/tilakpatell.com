import { describe, expect, it } from 'vitest';
import { ENABLED, buildGraph, evalField, findPrefab, hash, openingBools, stageSets, stepStates } from './bf2017-stages.mjs';

// a sub-world wired like Hoth's: the prefab's ports through And/Not gates into the areas' Enabled
const PREFAB = 'pf';
const conn = (from, field, to, target = ENABLED) => ({ Source: { $class: from }, SourceFieldId: field, Target: { $class: to }, TargetFieldId: target });
const event = (from, id, to, toId) => ({ Source: { $class: from }, SourceEvent: { Id: id }, Target: { $class: to }, TargetEvent: { Id: toId } });
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
      // (a gate's opening, from a node the layers do not hold)
      EventConnections: [event('door', 1, 'trig', hash('SetTrue'))],
    },
  ],
};

// the walkers' stage: a selector on the escort tracker's int steps the areas forward, and a room open only as the round starts
const walk = {
  L_Logic: {
    objects: [
      { $type: 'SpatialPrefabReferenceObjectData', $guid: PREFAB, Blueprint: { $asset: 'Gameplay/GameModes/FantasyBattles/PF_GameMode_Conquest_Staged' } },
      { $type: 'AIWaypointsShapeData', $guid: 'path', Waypoints: [{ $ref: 2 }, { $ref: 3 }, { $ref: 4 }] },
      { $type: 'VehicleWaypointData', SchematicsNameHash: 100 },
      { $type: 'VehicleWaypointData', SchematicsNameHash: 101 },
      { $type: 'VehicleWaypointData', SchematicsNameHash: 102 },
      { $type: 'AlternateSpawnEntityData', $guid: 'pt0', Team: 'Team2' },
      { $type: 'AlternateSpawnEntityData', $guid: 'ptOpen', Team: 'Team1' },
    ],
  },
  L_Shapes: {
    objects: [
      { $type: 'SpawnLocationFinderShapeData', $guid: 'x0', Team: 'Team2' },
      { $type: 'SpawnLocationFinderShapeData', $guid: 'x1', Team: 'Team2' },
      { $type: 'SpawnLocationFinderShapeData', $guid: 'xo', Team: 'Team2' },
      { $type: 'SpawnLocationFinderShapeData', $guid: 'd0', Team: 'Team1' },
      { $type: 'SpawnLocationFinderShapeData', $guid: 'late', Team: 'Team2' },
    ],
  },
  L_Spawns: {
    objects: [
      { $type: 'SelectEventEntityData', $guid: 'sel', Events: ['Zero', 'One'] },
      { $type: 'EventSplitterEntityData', $guid: 'sp0' },
      { $type: 'EventSplitterEntityData', $guid: 'sp1' },
      { $type: 'BoolEntityData', $guid: 's0', DefaultValue: false },
      { $type: 'BoolEntityData', $guid: 's1', DefaultValue: false },
      { $type: 'AndEntityData', $guid: 'g0' },
      { $type: 'AndEntityData', $guid: 'g1' },
      { $type: 'AndEntityData', $guid: 'go' },
      { $type: 'DelayEntityData', $guid: 'dly', Delay: 25 },
      { $type: 'BoolEntityData', $guid: 'ob', DefaultValue: true },
      { $type: 'AndEntityData', $guid: 'gp' },
    ],
  },
  L_Gameplay: {
    objects: [
      { $type: 'IntEntityData', $guid: 'trk' },
      { $type: 'WaypointTriggerEntityData', $guid: 'w1' },
    ],
  },
};
const walkSub = {
  objects: [
    {
      PropertyConnections: [
        conn(PREFAB, 21, 'g0', 1), // Team2 stage 1 and the first step's Bool → x0 and pt0
        conn('s0', 0, 'g0', 2),
        conn('g0', 0, 'x0'),
        conn('g0', 0, 'pt0'),
        conn(PREFAB, 21, 'g1', 1), // … and the second step's → x1
        conn('s1', 0, 'g1', 2),
        conn('g1', 0, 'x1'),
        conn(PREFAB, 21, 'go', 1), // … and the opening Bool → xo
        conn('ob', 0, 'go', 2),
        conn('go', 0, 'xo'),
        conn(PREFAB, 11, 'gp', 1), // Team1 stage 1 and the opening Bool → ptOpen
        conn('ob', 0, 'gp', 2),
        conn('gp', 0, 'ptOpen'),
        conn(PREFAB, 11, 'd0'), // the defenders' area through every step
        conn(PREFAB, 22, 'late'), // stage 2
        conn('trk', 0, 'sel', 5), // the tracker's int drives the selector
      ],
      EventConnections: [
        event('sel', hash('Zero'), 'sp0', 9),
        event('sp0', 8, 's0', hash('SetTrue')),
        event('sel', hash('One'), 'sp1', 9),
        event('sp1', 8, 's1', hash('SetTrue')),
        event('sp1', 8, 's0', hash('SetFalse')),
        event(PREFAB, 7, 'dly', 6), // the prefab's start event → 25 s → the opening Bool false
        event('dly', 5, 'ob', hash('SetFalse')),
        event('w1', 3, 'trk', 4), // a waypoint trigger counts into the tracker
      ],
      // (the trigger's waypoint, by its name hash: the path's second)
      LinkConnections: [{ Source: { $class: 'w1' }, Target: { $class: 'path' }, TargetFieldId: 101 }],
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
    // (no selector, no delayed Bool: no steps, no opening)
    expect(sets[0].steps).toBeUndefined();
    expect(sets[0].opening).toBeUndefined();
  });
});

describe('the sets a walker’s progress switches inside a stage', () => {
  const g = buildGraph(walkSub, walk);

  it('hashes a name as the export does', () => {
    expect(hash('SetTrue')).toBe(-1541066415 >>> 0);
  });

  it('reads the selector’s steps: each event sets its Bool true and the one before false', () => {
    const steps = stepStates(g);
    expect(steps.selector).toBe('L_Spawns:0');
    expect(steps.tracker).toBe('L_Gameplay:0');
    expect(steps.states.map((s) => [s.get('s0'), s.get('s1')])).toEqual([
      [true, false],
      [false, true],
    ]);
    // the trigger that counts into the tracker sits at the path's second waypoint
    expect(steps.at).toEqual({ 'L_Logic:1': [1] });
    expect(stepStates(buildGraph(sub, layers))).toBe(null);
  });

  it('finds the Bools the prefab’s start event shuts through a Delay', () => {
    expect([...openingBools(g, PREFAB)]).toEqual([['ob', 25]]);
  });

  it('gives the first stage its steps and its opening, a later stage the last step’s state', () => {
    const sets = stageSets(g, { prefab: PREFAB, ports, stages: 2, teams: { attack: 2, defend: 1 } });
    // the stage's whole set: every step's and the opening's together
    expect(sets[0].areas).toEqual({ attack: ['L_Shapes:0', 'L_Shapes:1', 'L_Shapes:2'], defend: ['L_Shapes:3'], gated: [] });
    expect(sets[0].points).toEqual({ attack: ['L_Logic:5'], defend: ['L_Logic:6'], gated: [] });
    expect(sets[0].steps).toEqual({
      by: 'escort',
      selector: 'L_Spawns:0',
      tracker: 'L_Gameplay:0',
      at: { 'L_Logic:1': [1] },
      areas: { attack: [[0], [1]], defend: [[3], [3]] },
      points: { attack: [[5], []], defend: [[], []] },
    });
    expect(sets[0].opening).toEqual({ seconds: 25, areas: { attack: [2], defend: [] }, points: { attack: [], defend: [6] } });
    expect(sets[1].areas).toEqual({ attack: ['L_Shapes:4'], defend: [], gated: [] });
    expect(sets[1].steps).toBeUndefined();
    expect(sets[1].opening).toBeUndefined();
  });
});
