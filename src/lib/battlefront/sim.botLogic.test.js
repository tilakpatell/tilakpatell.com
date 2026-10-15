// An Instant Action round on command posts: the bots take their posts from
// the game's bot logic (ai/botLogic.js), on their spawn and when the orphans
// are called.
import { describe, expect, it } from 'vitest';
import gs from '../../data/bf2017/gameSettings.json';
import { fire } from './bolts.js';
import { buildNav } from './nav.js';
import { startInstantAction } from './instantAction.js';
import { aiOf, loadLevel, loadRulebook, mapOf, teamsFor } from './rulebook.js';
import { deploy, step } from './sim.js';

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

// a bot shot down (shot at each step until it falls: it is walking), and the soldier that comes back under its name
const fall = (sim, s) => {
  const by = [...sim.entities.values()].find((e) => e.kind === 'soldier' && e.team !== s.team);
  for (let i = 0; i < 100 && s.alive; i++) {
    s.hp = 1;
    s.lastHurt = sim.time;
    s.safeUntil = -Infinity;
    fire(sim.bolts, { from: [s.at[0], s.at[1] + 1.2, s.at[2] - 1], dir: [0, 0, 1], speed: 700, team: by.team, owner: by.id, weapon: by.weapon, now: sim.time });
    step(sim, []);
  }
  return !s.alive;
};
const waiting = (sim, was) => {
  for (let i = 0; i < 20 / 0.05 && !sim.deploying.has(was.id); i++) step(sim, []);
  return sim.deploying.has(was.id);
};
const back = (sim, was) => {
  for (let i = 0; i < 60 / 0.05; i++) {
    step(sim, []);
    const e = sim.entities.get(was.id);
    if (e && e !== was && e.alive) return e;
  }
  return null;
};
const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const flat = (e) => [e.at[0], e.at[2]];

describe('where a side comes back in', () => {
  // a round past its setup (a shot counts and a post's meter makes its owner), each side's first places kept
  const live = (choice) => {
    const { sim, round } = start(choice);
    const home = {};
    for (const team of [1, 2]) home[team] = [0, 1].map((k) => bots(sim, team).reduce((n, e) => n + flat(e)[k], 0) / bots(sim, team).length);
    for (let i = 0; i < 20 / 0.05; i++) step(sim, []);
    return { sim, round, home };
  };
  // post C taken for a team's side by hand, its meter full as a capture leaves it
  const take = (sim, team) => {
    const side = sim.M.sideOf(sim.ga, team);
    sim.ga.objectives[2].meter = side === 'attack' ? 1 : -1;
    step(sim, []);
    expect(sim.ga.objectives[2].owner).toBe(side);
  };
  // a fallen bot sent in at a spawn point, as its wave would send it when it is not to come in on a squadmate
  const sendIn = (sim, s) => {
    expect(fall(sim, s)).toBe(true);
    expect(waiting(sim, s)).toBe(true);
    expect(deploy(sim, s.id, { kind: 'class', id: sim.teams[s.team].classes[0], spawn: 'point' }).ok).toBe(true);
    return flat(sim.entities.get(s.id));
  };

  it('is its first places while it holds no post', () => {
    const { sim, home } = live();
    expect(far(sendIn(sim, bots(sim, 1)[0]), home[1])).toBeLessThan(20);
  });

  it('is a post it holds, on the post’s own spawn points; the side that holds none, its first places', () => {
    const { sim, home } = live();
    take(sim, 1);
    expect(far(sendIn(sim, bots(sim, 1)[0]), sim.ga.objectives[2].at)).toBeLessThan(16);
    expect(far(sendIn(sim, bots(sim, 2)[0]), home[2])).toBeLessThan(20);
  });

  it('is not a post an enemy stands near: its first places again', () => {
    const { sim, home } = live();
    take(sim, 1);
    const foe = bots(sim, 2)[0];
    const c = sim.ga.objectives[2].at;
    [foe.at[0], foe.at[2]] = [c[0] + 12, c[1]];
    expect(far(sendIn(sim, bots(sim, 1)[0]), home[1])).toBeLessThan(20);
  });

  it('is on a squadmate as often as the settings say: half the time in Instant Action, always under the Overhaul', () => {
    expect(start().round.ap[1].spawn.squad).toBe(0.5);
    expect(start({ botLogic: 'overhaul' }).round.ap[1].spawn.squad).toBe(1);
    // (a side told never to: its fallen bot is sent in at a spawn point, though a squadmate stands free)
    const { sim } = live();
    sim.instantAction.ap[1].spawn.squad = 0;
    const s = bots(sim, 1)[0];
    expect(fall(sim, s)).toBe(true);
    const again = back(sim, s);
    expect(again).not.toBeNull();
    const how = sim.events.filter((e) => e.type === 'deploy' && e.id === s.id).pop();
    expect(how.spawn).toBe('point');
  });
});

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
