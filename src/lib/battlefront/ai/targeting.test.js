import { describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from '../rulebook.js';
import { coordinate, pickTarget, scoreTargets } from './targeting.js';

const ai = aiOf(loadRulebook());
const system = ai.system;
const brain = { s: { id: 'me', at: [0, 0, 0] } };
const belief = (id, at, visible = true) => ({ id, at: { x: at[0], y: at[1] ?? 0, z: at[2] ?? at[1] }, visible, confidence: 1, hostile: true });
const at = (x, z, y = 0) => belief(`t${x},${z}`, [x, y, z]);
const ents = new Map();
const who = (id) => ents.get(id) ?? null;

describe('targeting: the AI system’s target scores', () => {
  it('reads the multiplayer system', () => {
    expect(system.targeting.humanPreferenceScale).toBe(2.5);
  });

  it('prefers a visible target to a nearer one behind a wall, and never one the senses have not seen', () => {
    const wall = belief('hidden', [0, 0, 20], false);
    const seen = belief('seen', [0, 0, 30], true);
    const scores = scoreTargets(brain, [wall, seen], { system, who });
    expect(scores[0].id).toBe('seen');
    // (an enemy no belief holds is not a candidate, however near)
    ents.set('ghost', { id: 'ghost', at: [0, 0, 1], bot: true, hp: 100, hpMax: 100, alive: true });
    expect(scoreTargets(brain, [seen], { system, who }).map((s) => s.id)).toEqual(['seen']);
  });

  it('prefers a human player to a bot at the same distance', () => {
    ents.set('human', { id: 'human', bot: false, hp: 100, hpMax: 100, alive: true, at: [0, 0, 25] });
    ents.set('bot', { id: 'bot', bot: true, hp: 100, hpMax: 100, alive: true, at: [25, 0, 0] });
    const scores = scoreTargets(brain, [belief('bot', [25, 0, 0]), belief('human', [0, 0, 25])], { system, who });
    expect(scores[0].id).toBe('human');
    expect(scores[0].score / scores[1].score).toBeCloseTo(2.5, 5);
  });

  it('a wounded human at 30 m outscores a whole one at 25 m by the low-health scale, where a row has one', () => {
    ents.set('wounded', { id: 'wounded', bot: false, hp: 20, hpMax: 100, alive: true, at: [0, 0, 30] });
    ents.set('whole', { id: 'whole', bot: false, hp: 100, hpMax: 100, alive: true, at: [25, 0, 0] });
    const both = [belief('wounded', [0, 0, 30]), belief('whole', [25, 0, 0])];
    // (the multiplayer row's scale is 1: health changes nothing)
    expect(system.targeting.currentHumanTargetLowHealthDistScale).toBe(1);
    expect(scoreTargets(brain, both, { system, who })[0].id).toBe('whole');
    const keen = { ...system, targeting: { ...system.targeting, currentHumanTargetLowHealthDistScale: 0.5 } };
    expect(scoreTargets(brain, both, { system: keen, who })[0].id).toBe('wounded');
  });

  it('keeps the current target over a slightly nearer one, and a high one costs more', () => {
    const a = at(0, 30);
    const b = at(0, 27);
    expect(scoreTargets(brain, [a, b], { system, who, current: a.id })[0].id).toBe(a.id);
    const up = at(0, 20, 10);
    const level = at(20, 25);
    expect(scoreTargets(brain, [up, level], { system, who })[0].id).toBe(level.id);
  });

  it('holds a target for the system’s keep-firing time before it switches', () => {
    const a = belief('a', [0, 0, 30]);
    const near = belief('b', [0, 0, 10]);
    const held = { s: { id: 'me', at: [0, 0, 0] }, target: 'a', targetSince: 0 };
    ents.set('a', { id: 'a', bot: true, hp: 100, hpMax: 100, alive: true, at: [0, 0, 30] });
    expect(pickTarget(held, [a, near], { system, who, now: 1 })).toBe('a');
    expect(pickTarget(held, [a, near], { system, who, now: system.shooting.keepFiringAtAITime + 0.1 })).toBe('b');
    expect(pickTarget({ s: held.s }, [], { system, who, now: 0 })).toBe(null);
  });

  it('the coordinator spreads a squad over its targets by the visible limit, and lets all fire when the limit is whole', () => {
    const scores = new Map([
      ['m1', [{ id: 'x', score: 9 }, { id: 'y', score: 5 }]],
      ['m2', [{ id: 'x', score: 8 }, { id: 'y', score: 6 }]],
      ['m3', [{ id: 'x', score: 7 }, { id: 'y', score: 6.5 }]],
    ]);
    expect([...coordinate(scores, { system }).values()]).toEqual(['x', 'x', 'x']);
    // (the PvE row switches the coordinator off: each its own best)
    expect([...coordinate(scores, { system: ai.systemPvE }).values()]).toEqual(['x', 'x', 'x']);
    const spread = coordinate(scores, { system: { ...ai.systemPvE, targeting: { ...ai.systemPvE.targeting, enableTargetCoordinator: true } } });
    expect(spread.get('m1')).toBe('x');
    expect(new Set(spread.values())).toEqual(new Set(['x', 'y']));
  });
});
