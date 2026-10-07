import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createNpcs, scheduleBudget } from './npcs';
import { createTrace } from '../../lib/ai/trace';
import { current } from '../../lib/ai/inspect';
import { seeded } from '../../lib/seeded';
import { NPCS } from './npcs/index';

// a fleet that draws nothing, so the drawing runs in Node
const fleet = {
  want() {},
  loaded: () => true,
  make: () => ({ group: new THREE.Group(), size: { x: 1, y: 1, z: 1 }, update() {}, dispose() {} }),
};
const nemesis = Object.values(NPCS).find((c) => c.brain === 'nemesis');
const you = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 8 };
const world = () => ({ you, hunters: [], stations: [], solids: [], stims: [] });

describe('the characters, drawn', () => {
  it('createNpcs passes the schedule’s due set through', () => {
    const trace = createTrace();
    const agents = [];
    let done = 0;
    const schedule = {
      add: (a) => agents.push(a),
      drop: (a) => agents.splice(agents.indexOf(a), 1),
      // only the first one is ever due
      frame: () => ({ due: [{ agent: agents[0], sense: true, think: true, dt: 0.1 }], stats: {} }),
      done: () => (done += 1),
      stats: () => ({}),
    };
    const npcs = createNpcs(new THREE.Group(), { fleet, rand: seeded(1), schedule, trace });
    const a = npcs.add(nemesis, { x: 0, y: 0, z: -30 });
    const b = npcs.add(nemesis, { x: 0, y: 0, z: 30 });
    expect(agents).toHaveLength(2);
    for (let i = 0; i < 10; i++) npcs.update(1 / 60, i / 60, world());
    expect(trace.agents()).toEqual([a]);
    expect(trace.last(b)).toBeNull();
    expect(done).toBe(10);
    npcs.remove(b);
    expect(agents).toHaveLength(1);
    npcs.dispose();
  });

  it('makes its own schedule and trace, puts them on the inspector, and takes them off again', () => {
    const npcs = createNpcs(new THREE.Group(), { fleet });
    const n = npcs.add(nemesis, { x: 0, y: 0, z: -30 });
    for (let i = 0; i < 30; i++) npcs.update(1 / 60, i / 60, world());
    expect(npcs.ai.trace.last(n)).not.toBeNull();
    expect(npcs.ai.stats()).toMatchObject({ agents: 1 });
    expect(current()?.worldId).toBe('universe');
    expect(current().agents()).toEqual([expect.objectContaining({ id: n, kind: nemesis.brain })]);
    npcs.dispose();
    expect(current()).toBeNull();
  });

  it('the characters’ and the hunters’ schedules share the tier’s budget, half each', () => {
    expect(scheduleBudget('low')).toEqual({ ms: 0.25 });
    expect(scheduleBudget('mid')).toEqual({ ms: 0.5 });
    expect(scheduleBudget('high')).toEqual({ ms: 1 });
    expect(scheduleBudget('ultra')).toEqual({ ms: 0.5 });
    expect(scheduleBudget()).toEqual({ ms: 0.5 });
  });
});
