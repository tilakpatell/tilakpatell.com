// A side’s bots see by the game’s cone (sensing.js): the difficulty row’s range and angle until any of them
// sees an enemy, the wider alerted ones for every one of them after.
import { describe, expect, it } from 'vitest';
import { loadRulebook } from '../rulebook.js';
import { buildNav } from '../nav.js';
import { createSim, step } from '../sim.js';

const rb = loadRulebook();
const nav = buildNav({ heightAt: () => 0, bounds: { min: [-200, -200], max: [200, 200] }, cell: 2, solids: [] });

function stage(enemyAt) {
  const sim = createSim({ rulebook: rb, nav, seed: 4, bots: { 1: 2, 2: 1 } });
  const [a, mate] = [...sim.entities.values()].filter((e) => e.kind === 'soldier' && e.team === 1);
  const d = [...sim.entities.values()].find((e) => e.kind === 'soldier' && e.team === 2);
  a.at = [0, 0, 0];
  mate.at = [6, 0, 0];
  d.at = enemyAt;
  // (the bot looks toward +z; its mate looks away)
  const hold = () => {
    a.yaw = 0;
    mate.yaw = Math.PI;
    d.yaw = Math.PI;
  };
  return { sim, a, mate, d, hold };
}

describe('a side’s sight', () => {
  it('reaches the default row’s 60 m before the side is alerted: an enemy 80 m ahead is not seen', () => {
    const { sim, a, d, hold } = stage([0, 0, 80]);
    for (let i = 0; i < 6; i++) {
      hold();
      step(sim);
    }
    expect(a.brain.senses.sight.range).toBe(60);
    expect(a.brain.me.beliefs[d.id]?.visible ?? false).toBe(false);
    expect(sim.brains.alerted?.[1] ?? false).toBe(false);
  });

  it('once one bot sees an enemy, every bot of its side sees out to 250 m and 90° either side', () => {
    const { sim, a, mate, d, hold } = stage([0, 0, 40]);
    for (let i = 0; i < 12; i++) {
      hold();
      step(sim);
    }
    expect(a.brain.me.beliefs[d.id]?.visible).toBe(true);
    expect(sim.brains.alerted[1]).toBe(true);
    expect(mate.brain.senses.sight.range).toBe(250);
    expect(mate.brain.senses.sight.cone).toBeCloseTo(0, 6);
  });
});
