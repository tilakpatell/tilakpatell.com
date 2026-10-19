import { describe, expect, it } from 'vitest';
import { entered, holdsOf, left, rigAt } from './beats';

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
  });
});
