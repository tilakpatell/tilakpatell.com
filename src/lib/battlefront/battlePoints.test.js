import { describe, expect, it } from 'vitest';
import { loadRulebook, teamsFor } from './rulebook.js';
import { ASSIST_WINDOW, balance, buy, canBuy, createPoints, earn, hit, kill, offers } from './battlePoints.js';

const rb = loadRulebook();
const t = teamsFor(rb, 'hoth');
const fresh = () => createPoints({ rulebook: rb, teams: { 1: t.light, 2: t.dark } });

describe('Battle Points', () => {
  it('pays 100 a kill and 50 an assist to a second shooter inside the window', () => {
    const bp = fresh();
    hit(bp, 'v', 'a', 1);
    hit(bp, 'v', 'b', 2);
    hit(bp, 'v', 'c', 2 - ASSIST_WINDOW - 1);
    kill(bp, { by: 'a', target: 'v', now: 2 + ASSIST_WINDOW - 0.5 });
    expect(balance(bp, 'a')).toBe(100);
    expect(balance(bp, 'b')).toBe(50);
    expect(balance(bp, 'c')).toBe(0);
  });

  it('pays 10 a second on a moving meter', () => {
    const bp = fresh();
    for (let i = 0; i < 200; i++) earn(bp, 'a', 'objectiveTick', 0.05);
    expect(balance(bp, 'a')).toBeCloseTo(100, 6);
  });

  it('offers a hero at 4000 and not at 3999', () => {
    const bp = fresh();
    earn(bp, 'a', 'objectiveTick', 399.9);
    const hero = (o) => o.find((x) => x.kind === 'hero');
    expect(hero(offers(bp, 'a', 1)).affordable).toBe(false);
    earn(bp, 'a', 'objectiveTick', 0.1);
    expect(balance(bp, 'a')).toBeCloseTo(4000, 6);
    expect(hero(offers(bp, 'a', 1))).toMatchObject({ affordable: true, available: true, cost: 4000 });
  });

  it('one hero at a time', () => {
    const bp = fresh();
    earn(bp, 'a', 'kill', 90);
    const o = offers(bp, 'a', 1, { out: { heroes: 1, reinforcements: 0 } }).find((x) => x.kind === 'hero');
    expect(o).toMatchObject({ available: false, why: 'limit' });
    expect(canBuy(bp, 'a', o)).toBe(false);
  });

  it('debits a buy and refuses the same hero once one is out', () => {
    const bp = fresh();
    earn(bp, 'a', 'kill', 90);
    const o = offers(bp, 'a', 1).find((x) => x.id === 'luke');
    expect(buy(bp, 'a', o)).toEqual({ ok: true });
    expect(balance(bp, 'a')).toBe(5000);
    const again = offers(bp, 'a', 1, { out: { heroes: 1, reinforcements: 0 } }).find((x) => x.id === 'luke');
    expect(buy(bp, 'a', again)).toEqual({ ok: false, why: 'limit' });
    expect(balance(bp, 'a')).toBe(5000);
  });

  it('prices a reinforcement by its kind and refuses one it cannot afford', () => {
    const bp = fresh();
    const o = offers(bp, 'a', 1).find((x) => x.id === 'WookieWarrior');
    expect(o.cost).toBe(2000);
    expect(buy(bp, 'a', o)).toEqual({ ok: false, why: 'points' });
  });
});
