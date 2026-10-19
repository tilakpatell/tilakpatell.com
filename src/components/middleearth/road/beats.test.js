import { describe, expect, it } from 'vitest';
import { entered, fxAt, holdsOf, left, rigAt, stepBeats } from './beats';

const B = [
  { id: 'a', at: 0, hold: 6, rig: 'wide', params: { at: [0, 5, 0], lookAt: [0, 0, 10] } },
  { id: 'b', at: 40, hold: 0, rig: 'side' },
  { id: 'c', at: 120, hold: 14, rig: 'crane', cut: 0 },
];

describe('a stage’s beats', () => {
  it('entered: the beats crossed walking forward, [from, to)', () => {
    expect(entered(B, 0, 200)).toEqual(['a', 'b', 'c']);
    expect(entered(B, 1, 40)).toEqual([]);
    expect(entered(B, 1, 40.01)).toEqual(['b']);
    expect(entered(B, 50, 40)).toEqual([]);
  });

  it('left: the beats crossed walking back, the mirror of entered', () => {
    for (const [a, b] of [[0, 200], [10, 130], [39, 41], [120, 121]]) expect(left(B, b, a)).toEqual(entered(B, a, b));
    expect(left(B, 0, 200)).toEqual([]);
  });

  it('the holds sum', () => {
    expect(holdsOf(B)).toBe(20);
  });

  it('the camera keeps a beat’s rig from its mark for its reach, then follows', () => {
    expect(rigAt(B, 41)).toMatchObject({ id: 'b', rig: 'side', since: 1 });
    expect(rigAt(B, 120)).toMatchObject({ id: 'c', rig: 'crane', cut: 0 });
    expect(rigAt(B, 70)).toEqual(null);
    expect(rigAt(B, 39.9)).toEqual(null);
    expect(rigAt(B, 119.9999999)).toMatchObject({ id: 'c', since: 0 });
  });

  it('a step forward begins each beat it reaches, once; the clock stopping on a mark counts', () => {
    let r = stepBeats({}, B, { from: 0, to: 0, dt: 0.1 });
    expect(r.fired).toEqual(['a']);
    r = stepBeats(r.since, B, { from: 0, to: 0, dt: 0.1 });
    expect(r.fired).toEqual([]);
    expect(r.since.a).toBeCloseTo(0.1);
    r = stepBeats(r.since, B, { from: 39.5, to: 40, dt: 0.1 });
    expect(r.fired).toEqual(['b']);
  });

  it('a step back undoes the beats it goes back over; a jump marks those behind as done, unplayed', () => {
    let r = stepBeats({}, B, { from: 0, to: 130, dt: 0.1 });
    expect(r.fired).toEqual(['a', 'b', 'c']);
    r = stepBeats(r.since, B, { from: 130, to: 100, dt: 0.1 });
    expect(Object.keys(r.since).sort()).toEqual(['a', 'b']);
    r = stepBeats(r.since, B, { from: 100, to: 121, dt: 0.1 });
    expect(r.fired).toEqual(['c']);
    const j = stepBeats({}, B, { from: 0, to: 60, jumped: true });
    expect(j.fired).toEqual([]);
    expect(j.since).toEqual({ a: Infinity, b: Infinity });
  });

  it('the effects: a black veil whole, then lifting; the vision on for its seconds', () => {
    const beats = [
      { id: 'o', at: 0, fx: [{ kind: 'black', at: 0, seconds: 6 }] },
      { id: 'd', at: 10, fx: [{ kind: 'vision', at: 6, seconds: 0.4 }] },
    ];
    expect(fxAt(beats, { o: 1 }).black).toBe(1);
    expect(fxAt(beats, { o: 4.8 }).black).toBeCloseTo(0.5, 5);
    expect(fxAt(beats, { o: 7 }).black).toBe(0);
    expect(fxAt(beats, { o: Infinity }).black).toBe(0);
    expect(fxAt(beats, { d: 6.2 }).vision).toBe(true);
    expect(fxAt(beats, { d: 6.5 }).vision).toBe(false);
    expect(fxAt(beats, { d: 5 }).vision).toBe(false);
  });
});
