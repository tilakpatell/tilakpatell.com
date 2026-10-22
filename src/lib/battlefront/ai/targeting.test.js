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

  // (the source's selection, `TargetSelection.cpp`'s `selectTargets`, on the records' scores; it replaced a
  // hold of the keep-firing time before any switch, which the source spends on firing at a target unseen)
  const seenAt = (id, at, ago, clock = 10) => ({ ...belief(id, at, ago === 0), seenAt: ago == null ? -Infinity : clock - ago });
  const held = (target) => ({ s: { id: 'me', at: [0, 0, 0] }, target, targetSince: 0, me: { now: 10 } });

  it('keeps the target it has while it is seen and no seen one scores higher, whatever the time held', () => {
    expect(system.targeting.visibleTargetLimit).toBe(1);
    const a = seenAt('a', [0, 0, 30], 0);
    // (2 m nearer: inside the current target's own scale, the records' stand-in for the source's 2 m of slack)
    expect(pickTarget(held('a'), [a, seenAt('b', [0, 0, 28], 0)], { system, who, now: 100 })).toBe('a');
    expect(pickTarget(held('a'), [a, seenAt('b', [0, 0, 10], 0)], { system, who, now: 0.5 })).toBe('b');
  });

  it('counts an enemy seen within the visible limit as seen, and leaves an unseen target for a seen one', () => {
    // (half a second out of sight is inside the multiplayer row's second; two seconds is not)
    expect(pickTarget(held('a'), [seenAt('a', [0, 0, 30], 0.5), seenAt('b', [0, 0, 29], 0)], { system, who })).toBe('a');
    expect(pickTarget(held('a'), [seenAt('a', [0, 0, 30], 2), seenAt('b', [0, 0, 60], 0)], { system, who })).toBe('b');
    // (the PvE row's limit is a third of a second)
    expect(pickTarget(held('a'), [seenAt('a', [0, 0, 30], 0.5), seenAt('b', [0, 0, 60], 0)], { system: ai.systemPvE, who })).toBe('b');
  });

  it('keeps an unseen target while no enemy is seen; with none, takes one seen before over one only heard', () => {
    expect(pickTarget(held('a'), [seenAt('a', [0, 0, 30], 5), seenAt('b', [0, 0, 5], 8)], { system, who })).toBe('a');
    expect(pickTarget(held(null), [seenAt('heard', [0, 0, 5], null), seenAt('once', [0, 0, 40], 5)], { system, who })).toBe('once');
    expect(pickTarget(held(null), [seenAt('heard', [0, 0, 5], null)], { system, who })).toBe('heard');
    expect(pickTarget({ s: { id: 'me', at: [0, 0, 0] } }, [], { system, who, now: 0 })).toBe(null);
  });

  it('the coordinator hands each member its own best: the visible limit is seconds, and the records hold no share', () => {
    const scores = new Map([
      ['m1', [{ id: 'x', score: 9 }, { id: 'y', score: 5 }]],
      ['m2', [{ id: 'x', score: 8 }, { id: 'y', score: 6 }]],
      ['m3', [{ id: 'x', score: 7 }, { id: 'y', score: 6.5 }]],
    ]);
    expect([...coordinate(scores, { system }).values()]).toEqual(['x', 'x', 'x']);
    expect([...coordinate(scores, { system: ai.systemPvE }).values()]).toEqual(['x', 'x', 'x']);
    const on = coordinate(scores, { system: { ...ai.systemPvE, targeting: { ...ai.systemPvE.targeting, enableTargetCoordinator: true } } });
    expect([...on.values()]).toEqual(['x', 'x', 'x']);
  });
});
