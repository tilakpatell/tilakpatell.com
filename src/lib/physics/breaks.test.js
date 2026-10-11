import { describe, expect, it } from 'vitest';
import { BREAK, createHullCap, splitBreak } from './breaks.js';

describe('splitBreak', () => {
  it('hulls for the pieces over 0.5 m, a burst for the rest', () => {
    const s = splitBreak({ size: 1, mass: 40, pieces: [0.7, 0.6, 0.4, 0.2, 0.1] });
    expect(s.hulls).toBe(2);
    expect(s.sizes).toEqual([0.7, 0.6]);
    expect(s.burst).toBe(BREAK.burstMin);
  });

  it('the table: a crate, a wall section, a speeder, a pebble', () => {
    const rows = [
      [{ size: 1, mass: 40, pieces: 6 }, { hulls: 6, burst: 200 }],
      [{ size: 3, mass: 900, pieces: 8 }, { hulls: 8, burst: 1800 }],
      [{ size: 3, mass: 900, pieces: 24 }, { hulls: 8, burst: 2000 }],
      [{ size: 4.5, mass: 1200, pieces: 12 }, { hulls: 8, burst: 2000 }],
      [{ size: 0.4, mass: 2, pieces: 4 }, { hulls: 0, burst: 200 }],
    ];
    for (const [input, want] of rows) {
      const got = splitBreak(input);
      expect({ hulls: got.hulls, burst: got.burst }).toEqual(want);
    }
  });

  it('never more than 8 hulls a break, the biggest kept, the rest into the burst', () => {
    const s = splitBreak({ size: 2, mass: 100, pieces: [0.6, 0.9, 0.7, 0.8, 1.1, 0.55, 0.65, 0.75, 0.95, 1.0] });
    expect(s.hulls).toBe(8);
    expect(s.sizes[0]).toBe(1.1);
    expect(s.sizes.at(-1)).toBe(0.65);
    expect(s.burst).toBeGreaterThan(splitBreak({ size: 2, mass: 100, pieces: [] }).burst);
  });

  it('shares the mass by volume, so the hulls weigh no more than the thing', () => {
    const s = splitBreak({ size: 1, mass: 40, pieces: [0.8, 0.6, 0.3] });
    const total = s.masses.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(40);
    expect(s.masses[0]).toBeGreaterThan(s.masses[1]);
  });

  it('fewer hulls where the cap allows fewer, their particles into the burst', () => {
    const s = splitBreak({ size: 3, mass: 900, pieces: 24 }, { room: 3 });
    expect(s.hulls).toBe(3);
    expect(s.burst).toBe(2000);
  });

  it('a break that is not numbers breaks into nothing', () => {
    expect(splitBreak({ size: NaN, mass: 1, pieces: 3 })).toMatchObject({ hulls: 0, burst: 0 });
    expect(splitBreak({})).toMatchObject({ hulls: 0, burst: 0 });
  });
});

describe('createHullCap', () => {
  it('grants up to the cap and frees a slot when a hull goes', () => {
    const cap = createHullCap({ max: 4 });
    expect(cap.take(3)).toBe(3);
    expect(cap.take(3)).toBe(1);
    expect(cap.room()).toBe(0);
    cap.give(2);
    expect(cap.room()).toBe(2);
    expect(cap.stats()).toMatchObject({ live: 2, max: 4, refused: 2 });
  });

  it('counts a ragdoll’s bodies too, and a break during its fall gets the room left (Review Focus 4)', () => {
    const cap = createHullCap({ max: 64 });
    const release = cap.hold(15);
    expect(cap.room()).toBe(49);
    expect(cap.take(60)).toBe(49);
    expect(cap.stats().held).toBe(15);
    release();
    release();
    expect(cap.stats().held).toBe(0);
    expect(cap.room()).toBe(15);
  });

  it('a hold is counted even past the cap, so a body always falls; breaks wait', () => {
    const cap = createHullCap({ max: 8 });
    cap.take(8);
    const release = cap.hold(15);
    expect(cap.room()).toBe(0);
    expect(cap.take(1)).toBe(0);
    cap.give(8);
    expect(cap.room()).toBe(0);
    release();
    expect(cap.room()).toBe(8);
  });
});
