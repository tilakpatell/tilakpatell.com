import { describe, expect, it } from 'vitest';
import { loadRulebook } from '../rulebook.js';
import { buildNav } from '../nav.js';
import { field } from '../fixtures/field.js';
import { addPlayer, createSim } from '../sim.js';
import { SQUAD_SIZE, alert, createSquads, deliver, squadOf, update } from './squad.js';
import { createBrain } from './soldierBrain.js';
import { aiOf } from '../rulebook.js';

const rb = loadRulebook();

function camp(n) {
  const sim = createSim({ rulebook: rb, nav: buildNav(field()), seed: 3 });
  const ids = [];
  for (let i = 0; i < n; i++) {
    const id = addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [-40 + i * 10, 0, -40] });
    const s = sim.entities.get(id);
    s.bot = true;
    s.brain = createBrain(s, { ai: aiOf(rb), rand: sim.rand });
    ids.push(id);
  }
  return { sim, ids };
}

describe('squads', () => {
  it('are four to a squad by order, led by the first alive', () => {
    const { sim, ids } = camp(6);
    const squads = createSquads(sim);
    expect(squads.list.map((q) => q.members.length)).toEqual([SQUAD_SIZE, 2]);
    expect(squadOf(squads, ids[0]).leader).toBe(ids[0]);
    sim.entities.get(ids[0]).alive = false;
    update(squads, sim);
    expect(squadOf(squads, ids[1]).leader).toBe(ids[1]);
  });

  it('hold with nobody in sight, and retreat when they believe they are outnumbered', () => {
    const { sim, ids } = camp(2);
    const squads = createSquads(sim);
    expect(squadOf(squads, ids[0]).posture).toBe('hold');
    const foes = [];
    for (let i = 0; i < 6; i++) foes.push(addPlayer(sim, { team: 2, classId: 'd-orig-assault', at: [-40 + i * 4, 0, -10] }));
    const me = sim.entities.get(ids[0]);
    for (const id of foes) {
      const f = sim.entities.get(id);
      me.brain.me.beliefs[id] = { id, at: { x: f.at[0], y: 1, z: f.at[2] }, vel: { x: 0, y: 0, z: 0 }, confidence: 1, visible: true, hostile: true };
    }
    update(squads, sim);
    expect(squadOf(squads, ids[0]).posture).toBe('retreat');
  });

  it('spread an alert at the template’s 2 m/s: one 10 m off hears it after 5 s', () => {
    const { sim, ids } = camp(2);
    const squads = createSquads(sim);
    const from = sim.entities.get(ids[0]);
    const mate = sim.entities.get(ids[1]);
    expect(Math.hypot(mate.at[0] - from.at[0], mate.at[2] - from.at[2])).toBeCloseTo(10, 6);
    alert(squads, from, { id: 'enemy', at: [0, 1, 40] }, 0);
    expect(deliver(squads, sim, 4.9)).toHaveLength(0);
    expect(mate.brain.me.beliefs.enemy).toBeUndefined();
    expect(deliver(squads, sim, 5)).toHaveLength(1);
    expect(mate.brain.me.beliefs.enemy.at.z).toBe(40);
  });
});
