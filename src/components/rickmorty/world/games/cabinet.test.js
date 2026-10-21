import { describe, expect, it } from 'vitest';
import { CABINETS, MARQUEES, TUNING, newCabinet, playable, stepCabinet } from './cabinet';

const DT = 1 / 60;
const run = (seed, brain, max = 60 * 120) => {
  let g = newCabinet({ seed });
  const events = [];
  for (let i = 0; i < max && g.phase === 'play'; i++) {
    g = stepCabinet(g, brain(g, i), DT);
    events.push(...g.events);
  }
  return { g, events };
};
// a player who smashes the lowest plumbus in reach, when the stick isn't stuck
const careful = (g) => {
  if (g.stuck > 0) return {};
  const low = g.drops.filter((d) => d.y >= TUNING.reach).sort((a, b) => b.y - a.y)[0];
  return low ? { smash: low.lane } : {};
};
const sleeper = () => ({});
// one who presses a chute every step, round and round
const masher = (g, i) => ({ smash: i % 3 });

describe('Plumbus Smash', () => {
  it('names the walkway’s three games, and only Plumbus Smash plays', () => {
    expect(Object.values(CABINETS).map((c) => c.name)).toEqual(['Space Mortyball', 'Plumbus Smash', 'Cronenberg Crush']);
    expect(MARQUEES).toEqual({ cabinet1: 'SPACE MORTYBALL', cabinet2: 'PLUMBUS SMASH', cabinet3: 'CRONENBERG CRUSH' });
    expect(Object.keys(MARQUEES)).toEqual(['cabinet1', 'cabinet2', 'cabinet3']);
    expect(playable('cabinet2')).toBe(true);
    for (const id of ['cabinet1', 'cabinet3', 'nope', undefined]) expect(playable(id), String(id)).toBe(false);
    expect(newCabinet()).toMatchObject({ game: 'cabinet2', score: 0, target: 10000, lives: TUNING.lives, phase: 'play', drops: [] });
  });

  it('drops the same plumbuses from the same seed', () => {
    const lanes = (seed) => run(seed, sleeper, 60 * 30).events.filter((e) => e.type === 'drop').slice(0, 20).map((e) => e.lane);
    expect(lanes(7)).toEqual(lanes(7));
    expect(lanes(7)).not.toEqual(lanes(8));
    for (const lane of lanes(7)) expect([0, 1, 2]).toContain(lane);
  });

  it('smashes the lowest plumbus in reach, and nothing out of reach', () => {
    const g = { ...newCabinet({ seed: 2 }), next: 99, drops: [{ id: 1, lane: 0, y: 0.7 }, { id: 2, lane: 0, y: 0.9 }, { id: 3, lane: 1, y: 0.3 }] };
    const hit = stepCabinet(g, { smash: 0 }, 0);
    expect(hit.drops.map((d) => d.id)).toEqual([1, 3]);
    expect(hit.score).toBe(TUNING.smash);
    expect(hit.events).toEqual([{ type: 'smash', lane: 0 }]);
    const whiff = stepCabinet(hit, { smash: 1 }, 0);
    expect(whiff.stuck).toBe(TUNING.stuck);
    expect(whiff.score).toBe(TUNING.smash);
    expect(whiff.drops).toHaveLength(2);
    expect(whiff.events).toEqual([{ type: 'whiff', lane: 1 }]);
    // stuck: a press does nothing, even at a plumbus in reach
    const stuck = stepCabinet(whiff, { smash: 0 }, 0);
    expect(stuck.drops).toHaveLength(2);
    expect(stuck.score).toBe(TUNING.smash);
    expect(stuck.events).toEqual([]);
  });

  it('loses a life to a plumbus that reaches the end, and the game to three', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { g, events } = run(seed, sleeper);
      expect(g, `seed ${seed}`).toMatchObject({ phase: 'lost', lives: 0, smashed: 0, score: 0 });
      expect(events.filter((e) => e.type === 'miss')).toHaveLength(3);
      expect(events.at(-1)).toEqual({ type: 'lost' });
    }
  });

  it('is beaten by a careful player on every seed', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { g, events } = run(seed, careful);
      expect(g.phase, `seed ${seed}`).toBe('won');
      expect(g.score).toBeGreaterThanOrEqual(10000);
      expect(events.filter((e) => e.type === 'won')).toHaveLength(1);
    }
  });

  it('isn’t beaten by mashing every chute', () => {
    const lost = [1, 2, 3, 4, 5, 6].filter((seed) => run(seed, masher).g.phase === 'lost');
    expect(lost.length).toBeGreaterThanOrEqual(5);
  });

  it('changes nothing once won or lost', () => {
    for (const brain of [careful, sleeper]) {
      const { g } = run(4, brain);
      const after = stepCabinet(g, { smash: 1 }, 1);
      expect(after).toEqual({ ...g, events: [] });
    }
  });

  it('takes perks, and reads none until the shop', () => {
    expect(newCabinet({ seed: 3, perks: { hearts: 1, slow: 1, stun: 1, laser: 1 } })).toEqual(newCabinet({ seed: 3 }));
  });

  it('holds a long step to a tenth of a second', () => {
    const g = { ...newCabinet({ seed: 5 }), next: 99, drops: [{ id: 1, lane: 2, y: 0 }] };
    expect(stepCabinet(g, {}, 5).drops[0].y).toBeCloseTo(0.1 / TUNING.fall[0], 6);
  });
});
