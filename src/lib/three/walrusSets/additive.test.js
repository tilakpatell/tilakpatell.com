import { describe, expect, it } from 'vitest';
import { ADD_SET, additiveFor, hitSide } from './additive';

describe('the additive layer’s set', () => {
  it('names the aims, the hits by side and the leans', () => {
    for (const n of ['aim.up', 'aim.down', 'aim.left', 'aim.right', 'hit.front', 'hit.back', 'hit.left', 'hit.right', 'lean.left', 'lean.right']) expect(ADD_SET[`add.${n}`], n).toBeTruthy();
    expect([].concat(ADD_SET['add.hit.front'])).toContain('Rifle_Stand_HitReact_Front1');
  });
  it('weighs the four aims by pitch and yaw, none past straight ahead', () => {
    expect(additiveFor(0, 0)).toEqual({ up: 0, down: 0, left: 0, right: 0 });
    const up = additiveFor(Math.PI / 6, 0);
    expect(up.up).toBeCloseTo(0.5);
    expect(up.down).toBe(0);
    expect(additiveFor(-Math.PI, 0).down).toBe(1);
    const left = additiveFor(0, Math.PI / 4);
    expect(left.left).toBeCloseTo(0.5);
    expect(left.right).toBe(0);
    expect(additiveFor(0, -Math.PI).right).toBe(1);
    expect(additiveFor(NaN, undefined)).toEqual({ up: 0, down: 0, left: 0, right: 0 });
  });
  it('tells the side a bolt came in from, by the figure’s facing', () => {
    // (facing +z at yaw 0; a bolt from ahead of it, behind it, its left (+x), its right)
    expect(hitSide([0, 1], 0)).toBe('front');
    expect(hitSide([0, -1], 0)).toBe('back');
    expect(hitSide([1, 0], 0)).toBe('left');
    expect(hitSide([-1, 0], 0)).toBe('right');
    // (turned half round, ahead is behind)
    expect(hitSide([0, 1], Math.PI)).toBe('back');
    expect(hitSide(null, 0)).toBe('front');
  });
});
