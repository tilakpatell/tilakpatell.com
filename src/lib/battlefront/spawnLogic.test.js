import { describe, expect, it } from 'vitest';
import hoth from '../../data/bf2017/maps/hoth.json';
import { createLogic, enabled, escortLead, fireEvent, portsOf, setInput, setStage, tick, value } from './spawnLogic.js';

// a hand graph: the stage-1 port and a bool into an And, the And into a spawn
// point; the stage-changed event through a 25 s delay and a run-once splitter
// to the bool; a trigger into the same splitter; an int's change through a
// listener into a select whose case 2 closes a gate
const SPEC = {
  nodes: {
    'L:1': { type: 'prefab', name: 'PF_GameMode_Conquest_Staged', roles: { 985719506: { role: 'stage', team: 2, stage: 1 }, '-474851384': { role: 'stageChanged' } } },
    'S:1': { type: 'and', n: 2 },
    'S:2': { type: 'bool', value: false },
    'S:3': { type: 'splitter', once: true },
    'S:4': { type: 'delay', seconds: 25, once: false, dedupe: true },
    'S:5': { type: 'trigger', shapes: ['Sh:2'], allies: 1, include: 'ATPlayers', once: true, enabled: true },
    'S:6': { type: 'not', value: false },
    'S:7': { type: 'listener' },
    'S:8': { type: 'select', value: 0 },
    'S:9': { type: 'bool', value: true },
    'G:1': { type: 'prefab', name: 'PF_EscortTracker', roles: { '-827789024': { role: 'lead' } } },
  },
  inputs: {
    'S:1': { In1: 'L:1.985719506', In2: 'S:2.Value' },
    'S:6': { In: 'S:1.Out' },
    'S:7': { In: 'G:1.-827789024' },
    'S:8': { Selected: 'S:7.Value' },
  },
  events: {
    'L:1.-474851384': ['S:4.In'],
    'S:4.Out': ['S:3.In'],
    'S:5.OnEnter': ['S:3.In'],
    'S:3.Out': ['S:2.SetTrue'],
    'S:7.Changed': ['S:8.In'],
    'S:8.2': ['S:9.SetFalse'],
  },
  enables: { 'Lo:1': 'S:1.Out', 'Lo:2': 'S:6.Out', 'Lo:3': ['S:9.Value', 'S:2.Value'] },
  trackers: {},
};

describe('the spawn logic', () => {
  it('reads the stage ports and the gates over them', () => {
    const vm = createLogic(SPEC, { stage: 1 });
    expect(enabled(vm, 'Lo:1')).toBe(false);
    expect(enabled(vm, 'Lo:2')).toBe(true);
    expect(enabled(vm, 'Nope:1')).toBeNull();
  });

  it('runs a delay off the stage-changed event, and a run-once splitter only once', () => {
    const vm = createLogic(SPEC, { stage: 1 });
    setStage(vm, 1);
    tick(vm, 24.9);
    expect(enabled(vm, 'Lo:1')).toBe(false);
    tick(vm, 0.2);
    expect(enabled(vm, 'Lo:1')).toBe(true);
    expect(enabled(vm, 'Lo:2')).toBe(false);
    expect(vm.fired.filter((r) => r === 'S:3.Out')).toHaveLength(1);
    fireEvent(vm, 'S:5.OnEnter');
    expect(vm.fired.filter((r) => r === 'S:3.Out')).toHaveLength(1);
  });

  it('a trigger stands in for the timer', () => {
    const vm = createLogic(SPEC, { stage: 1 });
    fireEvent(vm, 'S:5.OnEnter');
    expect(enabled(vm, 'Lo:1')).toBe(true);
  });

  it('a stage the port is not of switches the And off', () => {
    const vm = createLogic(SPEC, { stage: 1 });
    fireEvent(vm, 'S:5.OnEnter');
    setStage(vm, 2);
    expect(enabled(vm, 'Lo:1')).toBe(false);
  });

  it('a listener reports a prefab output’s change, and the select fires its case', () => {
    const vm = createLogic(SPEC, { stage: 1 });
    setInput(vm, 'G:1.-827789024', 1);
    expect(value(vm, 'S:9.Value')).toBe(true);
    setInput(vm, 'G:1.-827789024', 2);
    expect(value(vm, 'S:9.Value')).toBe(false);
    // (on when any of its refs is: a point read twice)
    expect(enabled(vm, 'Lo:3')).toBe(false);
  });

  it('finds the prefab ports by role', () => {
    const vm = createLogic(SPEC);
    expect(portsOf(vm, 'lead')).toEqual([expect.objectContaining({ id: 'G:1', ref: 'G:1.-827789024' })]);
  });
});

describe('the escort tracker', () => {
  const tracker = { walkers: [{ at: [1, 3, 5] }, { at: [1, 4] }] };

  it('leads with the walker furthest on, by its triggers passed', () => {
    let s = escortLead(tracker, [{ passed: 0, alive: true }, { passed: 0, alive: true }]);
    expect(s.lead).toBe(0);
    s = escortLead(tracker, [{ passed: 3, alive: true }, { passed: 1, alive: true }], s);
    expect(s).toMatchObject({ sel: 0, lead: 2 });
    s = escortLead(tracker, [{ passed: 3, alive: true }, { passed: 4, alive: true }], s);
    expect(s).toMatchObject({ sel: 1, lead: 2 });
  });

  it('falls back to the other walker when the lead dies', () => {
    let s = escortLead(tracker, [{ passed: 5, alive: true }, { passed: 1, alive: true }]);
    expect(s.lead).toBe(3);
    s = escortLead(tracker, [{ passed: 5, alive: false }, { passed: 1, alive: true }], s);
    expect(s).toMatchObject({ sel: 1, lead: 1 });
  });
});

// Hoth's own graph (maps/hoth.json), against bf2-re findings/55's run of it
describe('Hoth’s Galactic Assault spawn logic', () => {
  const spec = hoth.rows.spawnLogic.galacticAssault;
  const team = new Map([...hoth.rows.spawns, ...hoth.rows.polygons].map((s) => [s.id, s.team]));
  const areas = new Set(hoth.rows.polygons.map((p) => p.id));
  const on = (vm, t, kind = 'area') =>
    Object.keys(spec.enables)
      .filter((id) => enabled(vm, id) && team.get(id) === t && (kind === 'area') === areas.has(id))
      .map((id) => Number(id.split(':')[1]))
      .sort((a, b) => a - b);
  const lead = (vm, k) => {
    setInput(vm, portsOf(vm, 'lead')[0].ref, k);
    tick(vm, 1.01);
  };
  // a round's way to stage n: stage 1's opening and the walkers' seven steps played out first
  const reach = (n) => {
    const vm = createLogic(spec, { stage: 1 });
    setStage(vm, 1);
    tick(vm, 25.01);
    for (let k = 1; k <= 7; k++) lead(vm, k);
    for (let m = 2; m <= n; m++) setStage(vm, m);
    return vm;
  };

  it('opens on one area a side for 25 s, then the walkers’ first step', () => {
    const vm = createLogic(spec, { stage: 1 });
    setStage(vm, 1);
    expect([on(vm, 1), on(vm, 2)]).toEqual([[11], [9]]);
    expect(on(vm, 2, 'point')).toHaveLength(28);
    tick(vm, 25.01);
    expect([on(vm, 1), on(vm, 2)]).toEqual([
      [27, 37, 64],
      [40, 49, 70],
    ]);
  });

  it('moves both sides’ areas up with the lead walker, eight steps', () => {
    const vm = createLogic(spec, { stage: 1 });
    setStage(vm, 1);
    tick(vm, 25.01);
    lead(vm, 1);
    expect([on(vm, 1), on(vm, 2)]).toEqual([
      [27, 37, 64],
      [22, 48, 55],
    ]);
    lead(vm, 2);
    expect([on(vm, 1), on(vm, 2)]).toEqual([
      [4, 56, 63],
      [18, 34, 42],
    ]);
    for (const k of [3, 4, 5, 6]) lead(vm, k);
    lead(vm, 7);
    expect([on(vm, 1), on(vm, 2)]).toEqual([
      [43, 58, 72],
      [52, 60, 66],
    ]);
  });

  it('stage 2 is the hangars; a point the Empire takes closes the Rebels’ points by it', () => {
    const vm = reach(2);
    expect([on(vm, 1), on(vm, 2)]).toEqual([
      [30, 46, 53, 61, 74],
      [20, 21, 44, 71],
    ]);
    expect(on(vm, 1, 'point')).toHaveLength(17);
    const east = portsOf(vm, 'ownedByTeam2').find((p) => p.id === 'FantasyBattle_Logic:209');
    setInput(vm, east.ref, true);
    expect(on(vm, 1, 'point')).toHaveLength(9);
  });

  it('a gate opened gives the Empire the points inside it', () => {
    const vm = reach(2);
    const before = on(vm, 2, 'point').length;
    fireEvent(vm, portsOf(vm, 'opened').find((p) => p.id === 'FantasyBattle_Logic:91').ref);
    expect(on(vm, 2, 'point').length - before).toBe(7);
  });

  it('stage 3 is the fuel: the Rebels hold the neutral rooms, a spent charge closes the points by it', () => {
    const vm = reach(3);
    expect([on(vm, 0), on(vm, 2)]).toEqual([
      [3, 45, 54],
      [10, 24, 28],
    ]);
    expect(on(vm, 1, 'point')).toHaveLength(12);
    setInput(vm, portsOf(vm, 'destroyed').find((p) => p.id === 'FantasyBattle_Logic:4').ref, true);
    expect(on(vm, 1, 'point')).toHaveLength(8);
  });
});
