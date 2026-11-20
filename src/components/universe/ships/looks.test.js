import { describe, expect, it } from 'vitest';
import { HOT, SHOWS_FROM, engineList, engineLook, jumpSize, partScale } from './looks';

describe('the engines a tier shows', () => {
  it('leaves Mk I as it was', () => {
    expect(engineLook(1, '#8fd0ff')).toEqual({ r: 1, colour: '#8fd0ff' });
  });

  it('grows the glow a tenth a tier, to two fifths at Mk V', () => {
    expect(engineLook(3, '#8fd0ff').r).toBeCloseTo(1.2, 9);
    expect(engineLook(5, '#8fd0ff').r).toBeCloseTo(1.4, 9);
  });

  it('runs hotter toward blue-white, half the way there at Mk V', () => {
    expect(engineLook(5, '#000000').colour).toBe('#687280');
    expect(engineLook(5, HOT).colour).toBe(HOT);
    expect(engineLook(9, '#ffb060').colour).toBe(engineLook(5, '#ffb060').colour);
    expect(engineLook(3, 'not a colour').colour).toBe('not a colour');
  });

  it('dresses a list of engines', () => {
    const list = [{ at: [0, 0, 0], r: 0.03, colour: '#ffb060' }];
    expect(engineList(list, 1)).toBe(list);
    expect(engineList(list, 5)[0]).toEqual({ at: [0, 0, 0], r: 0.03 * 1.4, colour: engineLook(5, '#ffb060').colour });
  });
});

describe('the parts a tier shows', () => {
  it('wears cargo pods and a dish from Mk III, bigger at Mk V, and jumps out of a wider ring', () => {
    expect(SHOWS_FROM).toEqual({ hold: 3, scanner: 3 });
    expect(partScale(3)).toBe(1);
    expect(partScale(5)).toBeCloseTo(1.4, 9);
    expect(jumpSize(1)).toBe(1);
    expect(jumpSize(5)).toBeCloseTo(1.6, 9);
    expect(jumpSize('x')).toBe(1);
  });
});
