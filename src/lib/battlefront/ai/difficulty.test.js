import { describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from '../rulebook.js';
import { createSim } from '../sim.js';
import { hothFlatNav } from '../fixtures/hothFlat.js';
import { DEFAULT, DIFFICULTIES, difficultyFor } from './difficulty.js';

const ai = aiOf(loadRulebook());

describe('the game’s difficulties', () => {
  it('names the multiplayer rows and takes the multiplayer default when asked for none', () => {
    expect(DIFFICULTIES).toEqual(expect.arrayContaining(['rookie', 'normal', 'expert']));
    expect(difficultyFor(null, ai).key).toBe(DEFAULT);
    expect(difficultyFor('expert', ai).key).toBe('multiplayer:expert');
    expect(difficultyFor('cooperative:master', ai).key).toBe('cooperative:master');
    expect(() => difficultyFor('impossible', ai)).toThrow(/impossible/);
  });

  it('gives three aim scales in order, rookie widest', () => {
    const [r, n, e] = ['rookie', 'normal', 'expert'].map((d) => difficultyFor(d, ai));
    expect(r.aim.scale).toBeGreaterThan(n.aim.scale);
    expect(n.aim.scale).toBeGreaterThan(e.aim.scale);
    expect(n.aim.scale).toBe(1);
    expect(r.aim.sprint).toBe(3);
    expect(e.aim.sprint).toBe(1.4);
  });

  it('reacts later on rookie, and harder hits on the player from expert', () => {
    const [r, e] = ['rookie', 'expert'].map((d) => difficultyFor(d, ai));
    expect(r.reaction(20)).toBeGreaterThan(e.reaction(20));
    expect(r.damage).toBe(0.75);
    expect(e.damage).toBe(1);
    expect(r.settle(20)).toBeGreaterThan(e.settle(20));
  });

  it('clamps a curve to its range: never extrapolated past MinX..MaxX', () => {
    const r = difficultyFor('rookie', ai);
    const curve = r.curves.reaction;
    expect(curve.min).toBe(5);
    expect(curve.max).toBe(100);
    expect(r.reaction(500)).toBeCloseTo(r.reaction(100), 9);
    expect(r.reaction(-50)).toBeCloseTo(r.reaction(5), 9);
    expect(r.reaction(100)).toBeCloseTo(2.88, 9);
  });

  it('reaches the sim: the bots’ aim lever, the Skirmish bots’ templates and abilities', () => {
    const rb = loadRulebook();
    const nav = hothFlatNav(rb);
    const plain = createSim({ rulebook: rb, nav, seed: 1, bots: { 1: 2, 2: 2 } });
    expect(plain.difficulty).toBe(null);
    const rookie = createSim({ rulebook: rb, nav, seed: 1, bots: { 1: 2, 2: 2 }, difficulty: 'rookie', pve: true });
    expect(rookie.aimScale).toBe(1.5);
    const bot = [...rookie.entities.values()].find((e) => e.bot);
    expect(bot.brain.pve).toBe(true);
    expect(bot.brain.system).toBe(ai.systemPvE);
    expect(bot.brain.difficulty.key).toBe('multiplayer:rookie');
    expect(bot.abilities.list.length).toBe(4);
  });
});
