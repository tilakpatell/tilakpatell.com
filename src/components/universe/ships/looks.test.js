import { describe, expect, it } from 'vitest';
import { HOT, engineLook, engineList } from './looks';

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
