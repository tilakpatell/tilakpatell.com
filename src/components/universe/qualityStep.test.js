import { describe, expect, it } from 'vitest';
import { STEPS } from '../../lib/three/pace';
import { stepAt } from './qualityStep';

// The runtime's quality level as the map draws it: the pace's steps
// through the post, then the floor
describe('the map at a quality level', () => {
  it('sharpest at 0, everything on', () => {
    expect(stepAt(0)).toEqual({ sharpness: 1, step: 0, blasts: 'full', relief: 1, floor: false });
  });

  it('each step softer through the post, the blasts pops from 2 and the relief flat from 3', () => {
    expect(STEPS.map((_, l) => stepAt(l).sharpness)).toEqual(STEPS);
    expect(stepAt(1).blasts).toBe('full');
    expect(stepAt(2)).toMatchObject({ step: 2, blasts: 'pop', relief: 1, floor: false });
    expect(stepAt(3)).toMatchObject({ step: 3, blasts: 'pop', relief: 0, floor: false });
    expect(stepAt(STEPS.length - 1)).toMatchObject({ sharpness: STEPS.at(-1), floor: false });
  });

  it('one past the steps is the floor, at the softest step', () => {
    expect(stepAt(STEPS.length)).toEqual({ sharpness: STEPS.at(-1), step: STEPS.length - 1, blasts: 'pop', relief: 0, floor: true });
    expect(stepAt(STEPS.length + 3).floor).toBe(true);
  });

  it('no level is the floor (fromScene’s onSlow, a watchdog’s old call)', () => {
    expect(stepAt().floor).toBe(true);
    expect(stepAt(undefined).floor).toBe(true);
    expect(stepAt(Number.NaN).floor).toBe(true);
  });

  it('back up as asked (the calibration walks the steps, sharpest first)', () => {
    expect(stepAt(4).step).toBe(4);
    expect(stepAt(0)).toMatchObject({ step: 0, blasts: 'full', relief: 1 });
    expect(stepAt(-2).step).toBe(0);
    expect(stepAt(1.7).step).toBe(1);
  });

  it('pops on a low tier, or once the map has gone low, at any step', () => {
    expect(stepAt(0, { tier: 'low' }).blasts).toBe('pop');
    expect(stepAt(0, { low: true }).blasts).toBe('pop');
    expect(stepAt(0, { tier: 'mid' }).blasts).toBe('full');
  });
});
