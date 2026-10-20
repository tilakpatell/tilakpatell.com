import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rng, pick, range } from './rng';
import { STONE_IDS, earnStone, earnedStones, heistComplete, forgetStones, heistRecord, recordTry, SOUL_HALVES } from './stones';
import { createFeel } from './feel';

describe('the seeded random source', () => {
  it('gives the same numbers for the same seed', () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });

  it('gives different numbers for different seeds, all in [0, 1)', () => {
    const a = rng(1);
    const b = rng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      if (x === b()) same++;
    }
    expect(same).toBeLessThan(3);
  });

  it('treats a seed of 0 as a valid seed', () => {
    expect(Number.isFinite(rng(0)())).toBe(true);
  });

  it('picks from a list and a range', () => {
    const r = rng(7);
    for (let i = 0; i < 40; i++) {
      expect(['a', 'b', 'c']).toContain(pick(r, ['a', 'b', 'c']));
      const v = range(r, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(5);
    }
  });
});

// a localStorage that lives for one test
const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('the stone heist', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: memoryStorage(), dispatchEvent: vi.fn() });
    vi.stubGlobal('CustomEvent', class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts with no stones', () => {
    expect(earnedStones()).toEqual([]);
    expect(heistComplete()).toBe(false);
  });

  it('keeps a stone once earned, and says so once', () => {
    expect(earnStone('power')).toBe(true);
    expect(earnStone('power')).toBe(false);
    expect(earnedStones()).toEqual(['power']);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('ignores names that are not stones', () => {
    expect(earnStone('aether')).toBe(false);
    expect(earnedStones()).toEqual([]);
  });

  it('needs both Clint and Natasha for the Soul Stone', () => {
    expect(earnStone(SOUL_HALVES[0])).toBe(false);
    expect(earnedStones()).toEqual([]);
    expect(earnStone(SOUL_HALVES[1])).toBe(true);
    expect(earnedStones()).toEqual(['soul']);
  });

  it('completes the heist with all six, in the gauntlet’s order', () => {
    for (const id of ['space', 'time', 'power', 'mind', 'reality']) earnStone(id);
    expect(heistComplete()).toBe(false);
    for (const half of SOUL_HALVES) earnStone(half);
    expect(heistComplete()).toBe(true);
    expect(earnedStones()).toEqual(STONE_IDS);
  });

  it('survives storage that is broken or holds junk', () => {
    window.localStorage.setItem('tp-hq-stones', '{not json');
    expect(earnedStones()).toEqual([]);
    window.localStorage.setItem('tp-hq-stones', JSON.stringify(['power', 'nonsense', 42]));
    expect(earnedStones()).toEqual(['power']);
    vi.stubGlobal('window', { get localStorage() { throw new Error('blocked'); }, dispatchEvent: vi.fn() });
    expect(earnedStones()).toEqual([]);
    expect(() => earnStone('mind')).not.toThrow();
  });

  it('forgets everything on request', () => {
    earnStone('power');
    forgetStones();
    expect(earnedStones()).toEqual([]);
  });
  it('writes when each stone was first won to the heist record, and adds no event', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    earnStone('power');
    now.mockReturnValue(9000);
    earnStone('power');
    earnStone('soul-clint');
    now.mockReturnValue(12000);
    earnStone('soul-natasha');
    expect(heistRecord()).toEqual({ stones: { power: 1000, soul: 12000 }, tries: {} });
    expect(JSON.parse(window.localStorage.getItem('tp-hq-heist')).v).toBe(1);
    expect(JSON.parse(window.localStorage.getItem('tp-hq-stones'))).toEqual(['power', 'soul-clint', 'soul-natasha', 'soul']);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
  it('gives stones held before the record no time, and the next stone its own', () => {
    window.localStorage.setItem('tp-hq-stones', JSON.stringify(['power', 'mind']));
    expect(heistRecord()).toEqual({ stones: { power: null, mind: null }, tries: {} });
    expect(window.localStorage.getItem('tp-hq-heist')).toBe(null);
    const now = vi.spyOn(Date, 'now').mockReturnValue(5000);
    earnStone('time');
    expect(heistRecord().stones).toEqual({ power: null, mind: null, time: 5000 });
    now.mockRestore();
  });
  it('counts a try each time a game starts', () => {
    for (const g of ['stark', 'stark', 'cap', 'nowhere']) recordTry(g);
    expect(heistRecord().tries).toEqual({ stark: 2, cap: 1 });
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
  it('keeps no record, and never throws, when storage is blocked', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('blocked'); }, dispatchEvent: vi.fn() });
    expect(() => recordTry('stark')).not.toThrow();
    expect(() => earnStone('mind')).not.toThrow();
    expect(heistRecord()).toEqual({ stones: {}, tries: {} });
  });
});

describe('game feel', () => {
  const cam = () => ({ position: { x: 0, y: 0, z: 0 }, rotation: { z: 0 }, fov: 60, updateProjectionMatrix: vi.fn() });

  it('shakes in proportion to trauma squared, capped, and settles', () => {
    const c = cam();
    const feel = createFeel({ seed: 3 });
    feel.trauma(0.3);
    expect(feel.state().trauma).toBeCloseTo(0.3);
    feel.trauma(5);
    expect(feel.state().trauma).toBe(1);
    for (let i = 0; i < 120; i++) feel.update(1 / 60, c);
    expect(feel.state().trauma).toBe(0);
  });

  it('does not move the camera when calm', () => {
    const c = cam();
    const feel = createFeel({ seed: 3, calm: true });
    feel.trauma(1);
    feel.punch(8);
    feel.update(1 / 60, c);
    expect(c.position.x).toBe(0);
    expect(c.fov).toBe(60);
  });

  it('holds the game in hitstop, then lets go', () => {
    const feel = createFeel({ seed: 1 });
    feel.hitstop(80);
    expect(feel.scale(1 / 60)).toBeLessThan(0.2);
    for (let i = 0; i < 10; i++) feel.scale(1 / 60);
    expect(feel.scale(1 / 60)).toBe(1);
  });

  it('punches the field of view and eases it back', () => {
    const c = cam();
    const feel = createFeel({ seed: 1, baseFov: 60 });
    feel.punch(6);
    feel.update(1 / 60, c);
    expect(c.fov).toBeGreaterThan(60);
    for (let i = 0; i < 120; i++) feel.update(1 / 60, c);
    expect(c.fov).toBeCloseTo(60, 1);
  });
});

// (the level, which is the visitor's pick or Auto by the chip, not the device's class)
describe('the stage’s tier from the site’s level', () => {
  it('reads lib/device’s detail: Low picked by hand is low, Ultra is high', async () => {
    const { tierOfDetail } = await import('./stage.js');
    expect(tierOfDetail('low')).toBe('low');
    expect(tierOfDetail('mid')).toBe('medium');
    expect(tierOfDetail('high')).toBe('high');
    expect(tierOfDetail('ultra')).toBe('high');
    expect(tierOfDetail(undefined)).toBe('medium');
  });
});
