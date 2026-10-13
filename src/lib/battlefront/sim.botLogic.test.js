// An Instant Action round on command posts: the bots take their posts from
// the game's bot logic (ai/botLogic.js), on their spawn and when the orphans
// are called.
import { describe, expect, it } from 'vitest';
import gs from '../../data/bf2017/gameSettings.json';
import { buildNav } from './nav.js';
import { startInstantAction } from './instantAction.js';
import { aiOf, loadLevel, loadRulebook, mapOf, teamsFor } from './rulebook.js';
import { step } from './sim.js';

const rb = loadRulebook();
// (Hoth's Supremacy level, with Hoth's own sides: the teams table holds the first level's alone)
await loadLevel('hoth_02');
const map = mapOf(rb, 'hoth_02');
const sides = teamsFor(rb, 'hoth');
const nav = buildNav({ heightAt: () => 0, bounds: { min: map.bounds.min, max: map.bounds.max }, cell: 4, solids: [], cover: aiOf(rb).cover.constants });
const start = (choice = {}) => startInstantAction({ rulebook: rb, gs, nav, seed: 8, level: 'hoth_02', mode: 'supremacy', teams: { 1: sides.light, 2: sides.dark }, bots: { friendly: 6, enemy: 6 }, ...choice });
// (the soldiers: an officer's turret is a bot's with no mind of its own)
const bots = (sim, team) => [...sim.entities.values()].filter((e) => e.bot && e.kind === 'soldier' && e.alive && e.team === team);
const posts = (sim) => sim.ga.objectives.map((o) => o.at);
const postOf = (sim, s) => posts(sim).findIndex((at) => at[0] === s.brain.task?.at[0] && at[1] === s.brain.task?.at[1]);

describe('a round on command posts', () => {
  it('has the game’s five posts and a bot logic a side', () => {
    const { sim, round } = start();
    expect(sim.ga.objectives).toHaveLength(5);
    expect(round.botLogic.timers).toMatchObject({ switchAfter: 120, invalidFor: 180, orphansEvery: 60 });
    expect(sim.botLogic[1].team).toBe(1);
    expect(sim.botLogic[2].priorities).toEqual([3, 4, 2]);
  });

  it('sends every bot to a post from its making, within the level’s radius', () => {
    const { sim, round } = start();
    for (const team of [1, 2])
      for (const s of bots(sim, team)) {
        expect(postOf(sim, s)).toBeGreaterThanOrEqual(0);
        expect(s.brain.task.radius).toBe(round.botLogic.radius);
      }
  });

  it('keeps a bot’s post while the round runs, and not the commander’s plan', () => {
    const { sim } = start();
    const before = new Map(bots(sim, 1).map((s) => [s.id, postOf(sim, s)]));
    for (let i = 0; i < 200; i++) step(sim, []);
    for (const s of bots(sim, 1)) if (before.has(s.id)) expect(postOf(sim, s)).toBe(before.get(s.id));
  });

  it('sends the side’s bots again when the orphans are called: a second after a post changes hands, or a minute after the last call', () => {
    const { sim } = start();
    const owners = () => sim.ga.objectives.map((o) => o.owner).join();
    const calls = [];
    const captures = [];
    let own = owners();
    let tasks = new Map(bots(sim, 2).map((s) => [s.id, s.brain.task]));
    for (let i = 0; i < 130 / 0.05; i++) {
      step(sim, []);
      if (owners() !== own) captures.push(sim.time);
      own = owners();
      // (a call gives every bot of the side out a new order at once)
      const kept = bots(sim, 2).filter((s) => tasks.has(s.id));
      if (kept.length > 1 && kept.every((s) => tasks.get(s.id) !== s.brain.task)) calls.push(sim.time);
      tasks = new Map(bots(sim, 2).map((s) => [s.id, s.brain.task]));
    }
    expect(calls.length).toBeGreaterThan(0);
    let last = 0.5; // (the first spawn's half second)
    for (const t of calls) {
      const afterCapture = captures.some((c) => Math.abs(t - (c + 1)) < 0.11);
      const onTime = Math.abs(t - (last + 60)) < 0.11;
      expect(afterCapture || onTime).toBe(true);
      last = t;
    }
  });
});
