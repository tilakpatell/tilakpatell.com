import { describe, expect, it } from 'vitest';
import { homeOn, nearTarget, steerRound } from './roundRules';

const angle = (a, b) => Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b)));
const round = (o = {}) => ({ v: [0, 0, -10], homing: 2, target: { at: { x: 10, y: 0, z: 0 } }, age: 0.5, life: 2, ...o });
const scratch = [0, 0, 0];

describe('a homing round', () => {
  it('runs straight for its first 0.12 s, off the rails', () => {
    const d = round({ age: 0.05 });
    steerRound(d, { x: 0, y: 0, z: 0 }, 0.016, scratch);
    expect(d.v).toEqual([0, 0, -10]);
  });
  it('turns onto its target at its homing rate, keeping its speed', () => {
    const d = round();
    steerRound(d, { x: 0, y: 0, z: 0 }, 0.1, scratch);
    expect(angle([0, 0, -10], d.v)).toBeCloseTo(0.2, 5);
    expect(Math.hypot(...d.v)).toBeCloseTo(10, 5);
  });
  it('keeps going with no target', () => {
    const d = round({ target: null });
    steerRound(d, { x: 0, y: 0, z: 0 }, 0.1, scratch);
    expect(d.v).toEqual([0, 0, -10]);
  });
  it('snaps into a near target, never a siege part', () => {
    const at = { x: 0, y: 0, z: 0 };
    expect(nearTarget({ target: { at: { x: 0.5, y: 0, z: 0 }, size: 0.3 } }, at)).toBe(true);
    expect(nearTarget({ target: { at: { x: 0.7, y: 0, z: 0 }, size: 0.3 } }, at)).toBe(false);
    expect(nearTarget({ target: { at: { x: 0.1, y: 0, z: 0 }, size: 0.3, siegePart: 0 } }, at)).toBe(false);
    expect(nearTarget({ target: null }, at)).toBe(false);
  });
  it('homes on its target by id: straight on while it is gone, onto it again when it is back', () => {
    const t = { id: 'h1', at: { x: 10, y: 0, z: 0 }, size: 0.3 };
    let foes = [t];
    const find = (id) => foes.find((c) => c.id === id) ?? null;
    const here = { x: 0, y: 0, z: 0 };
    const d = round({ target: null, targetId: 'h1' });
    expect(homeOn(d, find)).toBe(t);
    steerRound(d, here, 0.1, scratch);
    expect(angle([0, 0, -10], d.v)).toBeCloseTo(0.2, 5);
    foes = []; // (shot down: gone from the foes)
    const straight = [...d.v];
    expect(homeOn(d, find)).toBeNull();
    steerRound(d, here, 0.1, scratch);
    expect(d.v).toEqual(straight);
    foes = [t]; // (back: out of hiding, say)
    expect(homeOn(d, find)).toBe(t);
    steerRound(d, here, 0.1, scratch);
    expect(angle(straight, d.v)).toBeCloseTo(0.2, 5);
    expect(homeOn(round({ targetId: null }), () => t)).toBeNull(); // (nothing locked when it went)
  });
});
