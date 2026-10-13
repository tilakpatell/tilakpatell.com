// An Instant Action round on command posts that asks for the Overhaul's
// logic (ai/botLogicOverhaul.js): its bots are dealt their posts all at once,
// by the mod's table and on its times; a fallen bot is back after six
// seconds; each side's aim noise is drawn again every fifteen.
import { describe, expect, it } from 'vitest';
import gs from '../../data/bf2017/gameSettings.json';
import { fire } from './bolts.js';
import { buildNav } from './nav.js';
import { startInstantAction } from './instantAction.js';
import { SPREAD } from './ai/botLogicOverhaul.js';
import { aiOf, loadLevel, loadRulebook, mapOf, teamsFor } from './rulebook.js';
import { step } from './sim.js';
import { TIME_FOR_CORPSE } from './soldier.js';

const rb = loadRulebook();
await loadLevel('hoth_02');
const map = mapOf(rb, 'hoth_02');
const sides = teamsFor(rb, 'hoth');
const nav = buildNav({ heightAt: () => 0, bounds: { min: map.bounds.min, max: map.bounds.max }, cell: 4, solids: [], cover: aiOf(rb).cover.constants });
const start = (choice = {}) => startInstantAction({ rulebook: rb, gs, nav, seed: 8, level: 'hoth_02', mode: 'supremacy', botLogic: 'overhaul', teams: { 1: sides.light, 2: sides.dark }, bots: { friendly: 6, enemy: 6 }, ...choice });
const bots = (sim, team) => [...sim.entities.values()].filter((e) => e.bot && e.kind === 'soldier' && e.alive && e.team === team);
const posts = (sim) => sim.ga.objectives.map((o) => o.at);
const postOf = (sim, s) => posts(sim).findIndex((at) => at[0] === s.brain.task?.at[0] && at[1] === s.brain.task?.at[1]);
const until = (sim, test, seconds) => {
  for (let i = 0; i < seconds / 0.05 && !test(); i++) step(sim, []);
  return test();
};
const kill = (sim, s) => {
  s.hp = 1;
  s.lastHurt = sim.time;
  const by = [...sim.entities.values()].find((e) => e.kind === 'soldier' && e.team !== s.team);
  fire(sim.bolts, { from: [s.at[0], s.at[1] + 1.2, s.at[2] - 1], dir: [0, 0, 1], speed: 700, team: by.team, owner: by.id, weapon: by.weapon, now: sim.time });
  s.safeUntil = -Infinity;
};

describe('a round on the Overhaul’s logic', () => {
  it('is the mod’s: one dealer for both sides, and no logic a side', () => {
    const { sim, round } = start();
    expect(round.botLogic).toEqual({ kind: 'overhaul', radius: 10, spread: true });
    expect(sim.botLogic.kind).toBe('overhaul');
    expect(sim.botLogic.dealer.started).toBe(false);
    expect(sim.botLogic[1]).toBeUndefined();
  });

  it('gives no bot a post until its first deal, eight seconds and two tenths in: each keeps to where it stands', () => {
    const { sim } = start();
    for (const team of [1, 2])
      for (const s of bots(sim, team)) {
        expect(postOf(sim, s)).toBe(-1);
        expect(Math.hypot(s.brain.task.at[0] - s.at[0], s.brain.task.at[1] - s.at[2])).toBeLessThan(0.01);
      }
    until(sim, () => sim.time >= 8.1, 9);
    for (const s of bots(sim, 1)) expect(postOf(sim, s)).toBe(-1);
    until(sim, () => sim.time >= 8.3, 1);
    for (const team of [1, 2])
      for (const s of bots(sim, team)) {
        expect(postOf(sim, s)).toBeGreaterThanOrEqual(0);
        expect(s.brain.task.radius).toBe(10);
      }
  });

  it('deals a side that holds nothing its two near posts and the middle, each side from its own end', () => {
    const { sim } = start();
    until(sim, () => sim.time >= 8.3, 9);
    expect(sim.ga.objectives.every((o) => o.owner === null)).toBe(true);
    // (six bots take X Y M M Y X: the side's slots 2, 1, 3, 3, 1, 2)
    expect(bots(sim, 1).map((s) => postOf(sim, s))).toEqual([1, 0, 2, 2, 0, 1]);
    expect(bots(sim, 2).map((s) => postOf(sim, s))).toEqual([3, 4, 2, 2, 4, 3]);
  });

  it('deals again every twenty-five seconds, and a tenth of a second after a post changes hands, never twice in five', () => {
    const { sim } = start();
    const owners = () => sim.ga.objectives.map((o) => o.owner).join();
    const deals = [];
    const changes = [];
    let own = owners();
    let tasks = new Map(bots(sim, 2).map((s) => [s.id, s.brain.task]));
    for (let i = 0; i < 60 / 0.05; i++) {
      // (two posts taken by hand, their meters full as a capture leaves them: the second inside the first's five seconds)
      if (i === 400) sim.ga.objectives[2].meter = 1;
      if (i === 420) sim.ga.objectives[4].meter = -1;
      step(sim, []);
      if (owners() !== own) changes.push(sim.time);
      own = owners();
      // (a deal gives every bot of the side out a new order at once)
      const kept = bots(sim, 2).filter((s) => tasks.has(s.id));
      if (kept.length > 1 && kept.every((s) => tasks.get(s.id) !== s.brain.task)) deals.push(sim.time);
      tasks = new Map(bots(sim, 2).map((s) => [s.id, s.brain.task]));
    }
    expect(changes.length).toBeGreaterThanOrEqual(2);
    const [first, second] = changes;
    expect(second - first).toBeLessThan(5);
    expect(deals[0]).toBeCloseTo(8.2, 1);
    // (the first change is let through at once; the second is held to the five seconds' end, and dealt once)
    expect(deals.some((d) => Math.abs(d - (first + 0.1)) < 0.11)).toBe(true);
    expect(deals.filter((d) => d > first + 0.3 && d < first + 5).length).toBe(0);
    expect(deals.some((d) => Math.abs(d - (first + 5.1)) < 0.11)).toBe(true);
    // (the period runs from the start, whatever was dealt between: 33.2 s, and 58.2)
    expect(deals.some((d) => Math.abs(d - 33.3) < 0.16)).toBe(true);
    expect(deals.some((d) => Math.abs(d - 58.3) < 0.16)).toBe(true);
    for (let k = 1; k < deals.length; k++) expect(deals[k] - deals[k - 1]).toBeGreaterThan(5 - 0.06);
  });

  it('a bot that comes in between two deals takes the table’s next entry', () => {
    const { sim } = start();
    until(sim, () => sim.time >= 9, 10);
    const s = bots(sim, 1)[0];
    kill(sim, s);
    expect(until(sim, () => sim.entities.get(s.id)?.alive && sim.entities.get(s.id) !== s, 20)).toBe(true);
    // (six were dealt X Y M M Y X: the seventh entry is M, the middle, if no deal came between)
    const back = sim.entities.get(s.id);
    expect(postOf(sim, back)).toBeGreaterThanOrEqual(0);
    expect(back.brain.task.radius).toBe(10);
  });

  it('brings a fallen bot back six seconds after it is gone, whatever the game’s window', () => {
    const { sim, round } = start();
    expect(round.waves[1].soldiers).toMatchObject({ delay: 6, pause: 0 });
    // (past the game's first window, 15 s: its next would open at 45)
    until(sim, () => sim.time >= 16, 17);
    const s = bots(sim, 1)[0];
    kill(sim, s);
    expect(until(sim, () => sim.deploying.has(s.id), TIME_FOR_CORPSE + 3)).toBe(true);
    const gone = sim.time;
    expect(until(sim, () => sim.entities.get(s.id)?.alive, 20)).toBe(true);
    expect(sim.time - gone).toBeGreaterThanOrEqual(6 - 0.051);
    expect(sim.time - gone).toBeLessThan(6.2);
  });

  it('draws each side’s aim noise scale again every fifteen seconds, one of the mod’s ten', () => {
    const { sim } = start();
    const seen = { 1: new Set(), 2: new Set() };
    const at = [];
    let last = null;
    for (let i = 0; i < 100 / 0.05; i++) {
      step(sim, []);
      const now = `${sim.aimSpread[1]} ${sim.aimSpread[2]}`;
      if (last !== null && now !== last) at.push(sim.time);
      last = now;
      for (const team of [1, 2]) seen[team].add(sim.aimSpread[team]);
    }
    for (const team of [1, 2]) for (const v of seen[team]) expect(SPREAD.scales).toContain(v);
    expect(seen[1].size).toBeGreaterThan(2);
    // (a change is on a multiple of fifteen seconds from the round's first tenth)
    for (const t of at) expect(Math.abs(((t - 0.1 + 7.5) % 15) - 7.5)).toBeLessThan(0.06);
    // (the two sides are drawn apart)
    expect([...seen[1]].join()).not.toBe([...seen[2]].join());
  });

  it('with its spread off the sides’ noise is left as it is', () => {
    const { sim } = start({ overhaul: { spread: false } });
    expect(sim.aimSpread).toBeUndefined();
  });

  it('is not the game’s round: a round that does not ask has a logic a side and no dealer', () => {
    const { sim } = start({ botLogic: 'game' });
    expect(sim.botLogic.kind).toBe('game');
    expect(sim.botLogic[1].team).toBe(1);
    expect(sim.aimSpread).toBeUndefined();
  });
});
