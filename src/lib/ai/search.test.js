import { describe, expect, it, vi } from 'vitest';
import { seeded } from '../seeded';
import { createSearch, flood } from './search';

const P = (x, z) => ({ x, y: 0, z });
const lost = { at: P(10, 0) };

describe('the search', () => {
  it('a cautious search sends one to the last position and the rest cover, and ends once looked', () => {
    const s = createSearch({ rand: seeded(1), spots: () => [P(20, 0)] });
    s.start(lost);
    expect(s.claim('a', P(0, 0))).toEqual({ at: P(10, 0), phase: 1 });
    expect(s.claim('b', P(0, 5))).toBeNull();
    expect(s.done('a')).toBe(false);
    s.arrive('a');
    expect(s.done('a')).toBe(true);
    expect(s.claim('a', P(10, 0))).toBeNull();
  });

  it('an aggressive search sends three, then sweeps spots', () => {
    const s = createSearch({ rand: seeded(1), spots: () => [P(14, 0), P(30, 0), P(10, 16)] });
    s.start(lost, { aggressive: true });
    for (const id of ['a', 'b', 'c']) expect(s.claim(id, P(0, 0)).phase).toBe(1);
    expect(s.claim('d', P(0, 0))).toBeNull();
    s.arrive('a');
    expect(s.state.phase).toBe(2);
    // the nearest spot to the estimate and the searcher first
    expect(s.claim('a', P(10, 0)).at).toEqual(P(14, 0));
    expect(s.claim('b', P(10, 0)).at).toEqual(P(10, 16));
    expect(s.claim('c', P(10, 0)).at).toEqual(P(30, 0));
    expect(s.claim('d', P(10, 0))).toBeNull();
    expect(s.done('a')).toBe(false);
  });

  it('a spot seen on the way is searched for everyone', () => {
    const s = createSearch({ rand: seeded(1), spots: () => [P(14, 0), P(30, 0)] });
    s.start(lost, { aggressive: true });
    s.claim('a', P(0, 0));
    s.arrive('a');
    const c = s.claim('b', P(10, 0));
    expect(c.at).toEqual(P(14, 0));
    // a sees everything from where it stands: both searched, b's claim dropped
    expect(s.sweep('a', P(10, 0), () => true)).toBe(2);
    expect(s.state.claims.b).toBeUndefined();
    expect(s.claim('b', P(10, 0))).toBeNull();
    // a blocked view sweeps nothing
    const t = createSearch({ spots: () => [P(14, 0)] });
    t.start(lost, { aggressive: true });
    t.claim('a', P(0, 0));
    t.arrive('a');
    expect(t.sweep('a', P(10, 0), () => false)).toBe(0);
  });

  it('the truth pulls a little, and the estimate pulls more', () => {
    // two spots alike but for the truth: the truth decides, gently
    const s = createSearch({ rand: seeded(1), spots: () => [P(10, -10), P(10, 10)] });
    s.start(lost, { aggressive: true, truth: P(10, 30) });
    s.claim('a', P(0, 0));
    s.arrive('a');
    expect(s.claim('a', P(10, 0)).at).toEqual(P(10, 10));
    // and the estimate outweighs it: a spot twice as far from the estimate loses though nearer the truth
    const t = createSearch({ rand: seeded(1), spots: () => [P(14, 0), P(10, 20)] });
    t.start(lost, { aggressive: true, truth: P(10, 30) });
    t.claim('a', P(0, 0));
    t.arrive('a');
    expect(t.claim('a', P(10, 0)).at).toEqual(P(14, 0));
  });

  it('searchers are let go one at a time, stagger apart, and time ends it', () => {
    const s = createSearch({ rand: seeded(2), spots: () => [], time: 10, stagger: 2 });
    s.start(lost, { aggressive: true });
    s.claim('a', P(0, 0));
    s.arrive('a'); // no spots: over
    expect(s.done('a')).toBe(true);
    expect(s.done('b')).toBe(false);
    s.update(1);
    expect(s.done('b')).toBe(false);
    s.update(2);
    expect(s.done('b')).toBe(true);
    const t = createSearch({ spots: () => [P(50, 50)], time: 5 });
    t.start(lost, { aggressive: true });
    t.claim('a', P(0, 0));
    t.arrive('a');
    t.claim('a', P(10, 0));
    t.update(6);
    expect(t.done('a')).toBe(true);
    t.stop();
    expect(t.active).toBe(false);
  });
});

describe('the search’s own randomness', () => {
  it('is seeded when none is given: Math.random is never drawn, and two searches stagger alike', () => {
    const spy = vi.spyOn(Math, 'random');
    const gaps = () => {
      const s = createSearch({ spots: () => [], stagger: 2 });
      s.start(lost, { aggressive: true });
      s.claim('a', P(0, 0));
      s.arrive('a');
      s.done('a');
      return s.state.releaseAt;
    };
    try {
      expect(gaps()).toBe(gaps());
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('the flood', () => {
  // a 21×21 room with a wall across it that leaves a corridor east and a short dead end north
  const grid = (walls) => ({ cell: 1, walkable: (x, z) => x >= 0 && z >= 0 && x < 21 && z < 21 && !walls(x, z) });

  it('prefers a corridor to a dead end', () => {
    const g = grid((x, z) => (z === 2 && x !== 4) || (x === 5 && z > 2) || (x === 3 && z > 2) || z > 4);
    // from (4, 1) heading north: north is a 2-cell dead end (4,3),(4,4); row 1 runs east and west
    const out = flood(g, { x: 4, z: 1 }, { x: 0, z: 1 });
    expect(out).not.toBeNull();
    // the warm centroid lies along the long row, not up the dead end
    expect(out.z).toBeLessThanOrEqual(2);
    expect(out.x).not.toBe(4);
  });

  it('stops in a wide room, within a few cells', () => {
    const out = flood(grid(() => false), { x: 10, z: 10 }, { x: 1, z: 0 }, { perStep: 8 });
    expect(Math.hypot(out.x - 10, out.z - 10)).toBeLessThan(6);
  });

  it('never runs backwards through the barrier', () => {
    const corridor = grid((x, z) => z !== 10);
    const out = flood(corridor, { x: 10, z: 10 }, { x: 1, z: 0 });
    expect(out.x).toBeGreaterThan(10);
    const back = flood(corridor, { x: 10, z: 10 }, { x: -1, z: 0 });
    expect(back.x).toBeLessThan(10);
  });

  it('is null off the grid', () => {
    expect(flood(grid(() => false), { x: -5, z: 0 }, null)).toBeNull();
  });
});
