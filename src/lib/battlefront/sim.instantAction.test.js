// An Instant Action round in the sim: its caps are the commanders' and the
// offers', its waves bring the fallen back, its length is the ground's.
import { describe, expect, it } from 'vitest';
import gs from '../../data/bf2017/gameSettings.json';
import { offers } from './battlePoints.js';
import { fire } from './bolts.js';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { supremacy } from './fixtures/modeLevels.js';
import { DEFAULTS, applyRound, roundFor, startInstantAction } from './instantAction.js';
import { BLEED_SECONDS, SETUP_SECONDS, createMode, tick } from './modes/supremacy.js';
import { loadRulebook } from './rulebook.js';
import { step } from './sim.js';
import { TIME_FOR_CORPSE } from './soldier.js';

const rb = loadRulebook();
const ME = DEFAULTS.team;
const THEM = 3 - ME;
const start = (choice = {}) => startInstantAction({ rulebook: rb, gs, nav: hothFlatNav(rb), seed: 5, mode: 'galacticAssault', bots: { friendly: 4, enemy: 4 }, ...choice });
const until = (sim, test, seconds) => {
  for (let i = 0; i < seconds / 0.05 && !test(); i++) step(sim);
  return test();
};
const kill = (sim, s) => {
  s.hp = 1;
  s.lastHurt = sim.time;
  const by = [...sim.entities.values()].find((e) => e.kind === 'soldier' && e.team !== s.team);
  fire(sim.bolts, { from: [s.at[0], s.at[1] + 1.2, s.at[2] - 1], dir: [0, 0, 1], speed: 700, team: by.team, owner: by.id, weapon: by.weapon, now: sim.time });
  s.safeUntil = -Infinity;
};

describe('a round’s caps', () => {
  it('are each side’s commander’s: the bots’ heroes and reinforcements', () => {
    const { sim } = start({ heroes: { enemy: false }, reinforcements: { enemyCount: 2 } });
    expect(sim.commanders[THEM].caps).toEqual({ heroes: 0, reinforcements: 2 });
    expect(sim.commanders[ME].caps).toEqual({ heroes: 3, reinforcements: 10 });
  });

  it('are the offers’ limits: a side with its heroes off is offered none', () => {
    const { sim } = start({ heroes: { enemy: false } });
    const bot = (team) => [...sim.entities.values()].find((e) => e.bot && e.team === team).id;
    const heroes = (team) => offers(sim.bp, bot(team), team).filter((o) => o.kind === 'hero');
    expect(heroes(THEM).length).toBeGreaterThan(0);
    expect(heroes(THEM).every((o) => !o.available && o.why === 'limit')).toBe(true);
    expect(heroes(ME).some((o) => o.why === 'limit')).toBe(false);
  });

  it('set each side’s own limit on what it may have out', () => {
    const { sim } = start();
    expect(sim.bp.limits[ME]).toEqual({ heroesPerTeam: 4, reinforcementsPerTeam: 12 });
  });
});

describe('a round’s waves', () => {
  it('are each team’s side’s and stage’s table', () => {
    const { sim, round } = start();
    for (const team of [1, 2]) expect(sim.waves[team].table).toBe(round.wavesBy[sim.M.sideOf(sim.ga, team)][sim.ga.stage]);
  });

  it('bring a fallen bot back in its side’s window, not on the ten-second wave', () => {
    const { sim } = start();
    const team = [1, 2].find((t) => sim.M.sideOf(sim.ga, t) === 'attack');
    const { spawn, pause } = sim.waves[team].table.soldiers;
    expect([spawn, pause]).toEqual([5, 30]);
    // (past the first window: the next opens at 35 s, three ten-second waves on)
    until(sim, () => sim.time >= 8, 9);
    const s = [...sim.entities.values()].find((e) => e.bot && e.team === team && e.alive);
    kill(sim, s);
    expect(until(sim, () => sim.deploying.has(s.id), TIME_FOR_CORPSE + 3)).toBe(true);
    expect(sim.time).toBeLessThan(30);
    expect(until(sim, () => sim.entities.get(s.id)?.alive, 40)).toBe(true);
    expect(sim.time).toBeGreaterThanOrEqual(spawn + pause - 0.051);
    expect(sim.time).toBeLessThan(spawn + pause + spawn);
  });
});

describe('a round’s length', () => {
  it('is the ground’s reinforcements and how fast the side behind bleeds', () => {
    const fake = { ga: createMode({ map: supremacy() }), bp: { rate: 1 } };
    applyRound(fake, roundFor(gs, { mode: 'supremacy', length: 'short', bpRate: 'fast' }));
    expect(fake.ga.tickets).toEqual({ attack: 50, defend: 50 });
    expect(fake.ga.bleedEvery).toBe(BLEED_SECONDS / 2);
    expect(fake.bp.rate).toBe(2);
  });

  it('a short round’s bleed takes two where the game’s takes one', () => {
    const soldier = (id, side, x, z) => ({ id, side, at: [x, 0, z], alive: true, interact: false });
    const world = (soldiers) => ({ soldiers, alive: { attack: soldiers.length, defend: 0 } });
    const bled = (every) => {
      const m = createMode({ map: supremacy() });
      if (every) m.bleedEvery = every;
      tick(m, SETUP_SECONDS + 0.05);
      for (let t = 0; t < 21; t++) tick(m, 1, world([soldier('a', 'attack', -80, 0)]));
      const before = m.tickets.defend;
      tick(m, BLEED_SECONDS + 0.05, world([]));
      return before - m.tickets.defend;
    };
    expect(bled(null)).toBe(1);
    expect(bled(BLEED_SECONDS / 2)).toBe(2);
  });
});
