import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { createSim, step } from './sim.js';
import { earn } from './battlePoints.js';
import { BEST, endCard } from './eor.js';

const rb = loadRulebook();

describe('the end card', () => {
  it('names the winner and makes the one with the most points the mvp', () => {
    const sim = createSim({ rulebook: rb, nav: hothFlatNav(rb), seed: 2, bots: { 1: 6, 2: 6 }, mode: 'galacticAssault' });
    for (let i = 0; i < 40; i++) step(sim);
    const ids = [...sim.stats.keys()];
    earn(sim.bp, ids[3], 'kill', 5);
    earn(sim.bp, ids[8], 'kill', 2);
    sim.ga.result = { winner: 1, why: 'wiped', stage: 0 };
    const card = endCard(sim);
    expect(card).toMatchObject({ winner: 1, why: 'wiped', stage: 0 });
    expect(card.duration).toBeCloseTo(2, 6);
    expect(card.mvp).toMatchObject({ id: ids[3], points: 500 });
    expect(card.best).toHaveLength(2 * BEST);
    expect(card.teams[1].points + card.teams[2].points).toBe(700);
  });
});
