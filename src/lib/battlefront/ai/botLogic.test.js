// Instant Action's bot logic: which command post a bot is sent to, as the
// game's graph wires it.
import { describe, expect, it } from 'vitest';
import gs from '../../../data/bf2017/gameSettings.json';
import { seeded } from '../../seeded.js';
import { ORPHAN, PRIORITIES, SPAWN, captured, createBotLogic, pickSlot, slotValid, stepBotLogic, timersFor } from './botLogic.js';

// five posts, each the other side's and quiet, unless said
const posts = (over = {}) => [0, 1, 2, 3, 4].map((i) => ({ enabled: true, owner: 2, beingCaptured: false, progress: 0, ...(over[i] ?? {}) }));
const timers = timersFor(gs);
const logic = (team = 1, seed = 1) => createBotLogic({ team, rand: seeded(seed), timers });
const share = (list, i) => list.filter((x) => x === i).length / list.length;

describe('the graph’s numbers', () => {
  it('are the record’s splits, the levels’ priorities and the settings’ timers', () => {
    expect(SPAWN).toEqual([20, 20, 30, 30]);
    expect(ORPHAN).toEqual([25, 25, 50]);
    expect(PRIORITIES).toEqual({ 1: [0, 1, 2], 2: [3, 4, 2] });
    expect(timers).toMatchObject({ switchAfter: 120, invalidFor: 180, orphansEvery: 60 });
    expect(timers.sources.switchAfter).toBe('CaptureProgress_SwitchCPTimer_Mode8');
    expect(timers.sources.invalidFor).toBe('CaptureProgress_ResetTimer_Mode8');
    expect(timers.sources.orphansEvery).toBe('TriggerOrphansTimer_Mode8');
  });
});

describe('a post a bot may be sent to', () => {
  it('is enabled, and the other side’s or one of its own with the enemy on it', () => {
    const l = logic(1);
    expect(slotValid(l, posts(), 0, 0)).toBe(true);
    expect(slotValid(l, posts({ 0: { enabled: false } }), 0, 0)).toBe(false);
    expect(slotValid(l, posts({ 0: { owner: 1 } }), 0, 0)).toBe(false);
    expect(slotValid(l, posts({ 0: { owner: 0 } }), 0, 0)).toBe(true);
  });

  it('counts the enemy on its own post two seconds after they come, and for five after they go', () => {
    const l = logic(1);
    const hot = posts({ 0: { owner: 1, beingCaptured: true } });
    const cold = posts({ 0: { owner: 1 } });
    stepBotLogic(l, hot, 0);
    expect(slotValid(l, hot, 0, 0)).toBe(false);
    for (let t = 0.05; t < 2.06; t += 0.05) stepBotLogic(l, hot, t);
    expect(slotValid(l, hot, 0, 2.05)).toBe(true);
    for (let t = 2.1; t < 7.0; t += 0.05) stepBotLogic(l, cold, t);
    expect(slotValid(l, cold, 0, 6.95)).toBe(true);
    for (let t = 7.0; t < 7.3; t += 0.05) stepBotLogic(l, cold, t);
    expect(slotValid(l, cold, 0, 7.25)).toBe(false);
  });
});

describe('a bot that spawns', () => {
  it('goes to its side’s first or second post one time in five each, to the random pick or to any of the five three in ten each', () => {
    const l = logic(1, 7);
    const picks = Array.from({ length: 6000 }, () => pickSlot(l, posts(), 0, 'spawn'));
    // (the random pick is never the side's first or second post; any of the five is one in five each)
    expect(share(picks, 0)).toBeGreaterThan(0.26 - 0.03);
    expect(share(picks, 0)).toBeLessThan(0.26 + 0.03);
    expect(share(picks, 1)).toBeGreaterThan(0.26 - 0.03);
    expect(share(picks, 1)).toBeLessThan(0.26 + 0.03);
    for (const i of [2, 3, 4]) expect(share(picks, i)).toBeGreaterThan(0.03);
    expect(share(picks, 2) + share(picks, 3) + share(picks, 4)).toBeGreaterThan(0.48 - 0.03);
  });

  it('team 2’s first and second posts are the fourth and the fifth', () => {
    const l = logic(2, 3);
    const picks = Array.from({ length: 4000 }, () => pickSlot(l, posts({ 0: { owner: 1 }, 1: { owner: 1 }, 2: { owner: 1 }, 3: { owner: 1 }, 4: { owner: 1 } }), 0, 'spawn'));
    expect(share(picks, 3)).toBeGreaterThan(0.2);
    expect(share(picks, 4)).toBeGreaterThan(0.2);
    expect(share(picks, 0)).toBeLessThan(0.15);
  });

  it('is sent on down the letters from a post it may not go to, and to any of the five past the last', () => {
    // (team 1 holds A and B, quiet: the first and second choices both land on C, the next that may be gone to)
    const held = posts({ 0: { owner: 1 }, 1: { owner: 1 } });
    const l = logic(1, 5);
    const picks = Array.from({ length: 4000 }, () => pickSlot(l, held, 0, 'spawn'));
    // (A and B are reached only by the any-of-the-five branch, which checks nothing: 30 in 100, one in five each)
    expect(share(picks, 0)).toBeLessThan(0.06 + 0.02);
    expect(share(picks, 1)).toBeLessThan(0.06 + 0.02);
    expect(share(picks, 2)).toBeGreaterThan(0.4);
    // (every post its own and quiet: the chain runs out and any of the five is taken)
    const all = posts({ 0: { owner: 1 }, 1: { owner: 1 }, 2: { owner: 1 }, 3: { owner: 1 }, 4: { owner: 1 } });
    const lost = logic(1, 9);
    const any = Array.from({ length: 5000 }, () => pickSlot(lost, all, 0, 'spawn'));
    for (const i of [0, 1, 2, 3, 4]) expect(share(any, i)).toBeGreaterThan(0.1);
  });
});

describe('an orphaned bot', () => {
  it('goes to its side’s first or second post one time in four each, else to any of the five', () => {
    const l = logic(1, 11);
    const picks = Array.from({ length: 6000 }, () => pickSlot(l, posts(), 0, 'orphan'));
    expect(share(picks, 0)).toBeGreaterThan(0.35 - 0.03);
    expect(share(picks, 0)).toBeLessThan(0.35 + 0.03);
    for (const i of [2, 3, 4]) expect(share(picks, i)).toBeLessThan(0.1 + 0.03);
  });
});

describe('the random pick', () => {
  it('is a post the side may go to that is not its first or second, and leaves one it makes no progress on', () => {
    const l = logic(1, 2);
    stepBotLogic(l, posts(), 0);
    const first = l.random;
    expect([2, 3, 4]).toContain(first);
    // (two minutes with no progress there: not to be gone to for three, and another is picked)
    for (let t = 1; t <= timers.switchAfter + 1; t += 1) stepBotLogic(l, posts(), t);
    expect(slotValid(l, posts(), first, timers.switchAfter + 1)).toBe(false);
    expect(l.random).not.toBe(first);
    expect(slotValid(l, posts(), first, timers.switchAfter + 1 + timers.invalidFor + 1)).toBe(true);
  });

  it('is kept while the side makes progress on it', () => {
    const l = logic(1, 2);
    stepBotLogic(l, posts(), 0);
    const first = l.random;
    for (let t = 1; t <= timers.switchAfter * 2; t += 1) stepBotLogic(l, posts({ [first]: { progress: 0.3 } }), t);
    expect(l.random).toBe(first);
  });
});

describe('the orphans', () => {
  it('are called half a second after the first spawn, then every minute', () => {
    const l = logic(1, 4);
    pickSlot(l, posts(), 10, 'spawn');
    const at = [];
    for (let t = 10; t < 200; t += 0.05) if (stepBotLogic(l, posts(), t)) at.push(Math.round(t * 10) / 10);
    expect(at).toEqual([70.5, 130.5, 190.5]);
  });

  it('are called a second after a post changes hands, not again inside the cool-down', () => {
    const l = logic(1, 4);
    pickSlot(l, posts(), 0, 'spawn');
    const at = [];
    const run = (from, to) => {
      for (let t = from; t < to; t += 0.05) if (stepBotLogic(l, posts(), t)) at.push(Math.round(t * 10) / 10);
    };
    captured(l, 5);
    run(0, 8);
    // (a second capture three seconds on: inside the cool-down, no call)
    captured(l, 8);
    run(8, 26);
    // (one past it calls again)
    captured(l, 26);
    run(26, 30);
    expect(at).toEqual([6, 27]);
  });
});
