import { describe, expect, it } from 'vitest';
import { loadRulebook } from '../rulebook.js';
import { field } from '../fixtures/field.js';
import { buildNav } from '../nav.js';
import { addPlayer, createSim, step } from '../sim.js';
import { BUCKETS, BURST_GAP, bucketOf, createBuckets, forget, mayHurt } from './buckets.js';

const bot = { id: 'b1', bot: true };
const human = (over = {}) => ({ id: 'p1', bot: false, sprint: false, moving: false, stance: 'stand', ...over });

describe('the bots’ damage buckets (finding 34 §3)', () => {
  it('waits 0.75 s on a sprinter, 0.5 on one moving, 0.25 crouched, 0.1 still', () => {
    expect(BUCKETS).toEqual({ sprint: 0.75, moving: 0.5, crouch: 0.25, still: 0.1 });
    expect(bucketOf(human({ sprint: true, moving: true }))).toBe(0.75);
    expect(bucketOf(human({ moving: true }))).toBe(0.5);
    expect(bucketOf(human({ stance: 'crouch' }))).toBe(0.25);
    expect(bucketOf(human())).toBe(0.1);
    // (the sprint key held while standing still is no sprint)
    expect(bucketOf(human({ sprint: true }))).toBe(0.1);
  });

  it('lets a bot’s bolts hurt a human only once the bucket’s time has passed since its burst began', () => {
    const b = createBuckets();
    const target = human({ sprint: true, moving: true });
    // (bolts every 0.2 s from 10.0, each landing 0.05 s after it left)
    const landed = [10, 10.2, 10.4, 10.6, 10.8, 11].map((shotAt) => mayHurt(b, { shooter: bot, target, shotAt, now: shotAt + 0.05 }));
    expect(landed).toEqual([false, false, false, false, true, true]);
    // (a pause longer than the gap: a new burst, a new wait)
    expect(mayHurt(b, { shooter: bot, target, shotAt: 11 + BURST_GAP + 0.1, now: 11 + BURST_GAP + 0.15 })).toBe(false);
    // (one standing still: the first bolt alone is spared)
    const still = createBuckets();
    expect([20, 20.2].map((shotAt) => mayHurt(still, { shooter: bot, target: human(), shotAt, now: shotAt + 0.05 }))).toEqual([false, true]);
  });

  it('holds nothing between bots, nor on a human’s own bolts, and forgets a shooter', () => {
    const b = createBuckets();
    expect(mayHurt(b, { shooter: bot, target: { id: 'b2', bot: true }, shotAt: 0, now: 0 })).toBe(true);
    expect(mayHurt(b, { shooter: human({ id: 'p2' }), target: human(), shotAt: 0, now: 0 })).toBe(true);
    expect(mayHurt(b, { shooter: null, target: human(), shotAt: 0, now: 0 })).toBe(true);
    const target = human({ moving: true });
    mayHurt(b, { shooter: bot, target, shotAt: 5, now: 5 });
    expect(mayHurt(b, { shooter: bot, target, shotAt: 5.6, now: 5.6 })).toBe(true);
    forget(b, 'b1');
    expect(mayHurt(b, { shooter: bot, target, shotAt: 5.8, now: 5.8 })).toBe(false);
  });

  it('in the battle a bot’s rifle deals half a player’s, and its first bolt at a standing player nothing', () => {
    const rb = loadRulebook();
    const sim = createSim({ rulebook: rb, nav: buildNav(field()), seed: 2 });
    const a = sim.entities.get(addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [0, 0, -40], yaw: 0 }));
    const z = sim.entities.get(addPlayer(sim, { team: 2, classId: 'd-orig-assault', at: [0, 0, -30], yaw: Math.PI }));
    sim.brains.brains.clear();
    a.bot = true;
    z.bot = false;
    const chest = (s) => [s.at[0], s.at[1] + 1.2, s.at[2]];
    const hits = [];
    for (let i = 0; i < 12; i++) hits.push(...step(sim, [{ id: a.id, move: [0, 0], fire: true, aim: chest(z) }]).filter((e) => e.type === 'hit'));
    // (the A280's 36 at 10 m: 18 from a bot)
    expect(hits[0].damage).toBe(0);
    expect(hits[1].damage).toBe(18);
    const back = [];
    for (let i = 0; i < 6; i++) back.push(...step(sim, [{ id: z.id, move: [0, 0], fire: true, aim: chest(a) }]).filter((e) => e.type === 'hit' && e.target === a.id));
    expect(back[0].damage).toBeGreaterThan(30);
  });
});
