import { describe, expect, it } from 'vitest';
import { CONTACT, bodyRadius, closingSpeed, contact, keptSpeed, knock, shove, sweptSpheres, touchAt } from './contact';

describe('contact', () => {
  it('is a glance under soft and a ram from it', () => {
    expect(contact(1.29, 0.3)).toEqual({ kind: 'glance', damage: 0, punch: 0, keep: CONTACT.glance, push: shove(1.29, 0.3) });
    const r = contact(1.31, 0.3);
    expect(r.kind).toBe('ram');
    expect(r.keep).toBe(CONTACT.slow);
  });
  it('hurts by the other ship’s size and the closing speed, capped', () => {
    expect(contact(14, 0.3).damage).toBeCloseTo(6 + 2.1 + 0.5 * (14 - 1.3), 5);
    expect(contact(12, 0.7).damage).toBeCloseTo(6 + 4.9 + 0.5 * (12 - 1.3), 5);
    expect(contact(300, 2).damage).toBe(CONTACT.most);
  });
  it('is worth one hit on the other ship, one more every punchEvery past soft, at most punchMost', () => {
    expect(contact(1.3, 0.3).punch).toBe(1);
    expect(contact(6.3, 0.3).punch).toBe(2);
    expect(contact(14, 0.3).punch).toBe(3);
    expect(contact(30, 0.3).punch).toBe(CONTACT.punchMost);
  });
  it('bodyRadius is tighter than a laser’s hit radius', () => {
    expect(bodyRadius(0.3)).toBeCloseTo(0.23, 5);
  });
  it('knocks the other ship off its line by shove', () => {
    expect(contact(10, 0.3).push).toBe(shove(10, 0.3));
  });
});

describe('shove', () => {
  it('is a share of the closing speed, less for a bigger ship, capped', () => {
    expect(shove(4, 0.3)).toBeCloseTo(4 * CONTACT.shove, 6);
    expect(shove(4, 1)).toBeCloseTo((4 * CONTACT.shove) / 2, 6);
    expect(shove(300, 0.3)).toBe(CONTACT.shoveMost);
    expect(shove(-2, 0.3)).toBe(0);
  });
});

describe('knock', () => {
  it('adds the knock to its way and rocks it, by its side', () => {
    const o = { vel: { x: 0, y: 0, z: -5 }, bank: 0, side: -1 };
    knock(o, { x: 2, y: 0, z: 0 });
    expect(o.vel).toEqual({ x: 2, y: 0, z: -5 });
    expect(o.bank).toBeCloseTo(-2 * CONTACT.rock, 6);
  });
  it('rocks it no further than it can bank', () => {
    const o = { vel: { x: 0, y: 0, z: 0 }, bank: 1.5 };
    knock(o, { x: 0, y: 0, z: 20 });
    expect(o.bank).toBe(1.6);
  });
});

describe('closingSpeed', () => {
  it('is how fast the two close along the normal, and 0 when they part', () => {
    // normal points from them toward you; you fly at them (−x) at 6, they at you (+x) at 8
    expect(closingSpeed({ x: -6, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeCloseTo(14, 5);
    expect(closingSpeed({ x: 6, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(0);
  });
});

describe('sweptSpheres', () => {
  // targeting.test.js's sweptHit cases, in both point forms
  it('meets a target crossing the way, in arrays and in objects', () => {
    expect(sweptSpheres([0, 0, 0], [0, 0, -1], [-0.5, 0, -0.5], [0.5, 0, -0.5], 0.3)).toBeCloseTo(0.5, 6);
    expect(sweptSpheres({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: -0.5, y: 0, z: -0.5 }, { x: 0.5, y: 0, z: -0.5 }, 0.3)).toBeCloseTo(0.5, 6);
  });
  it('misses one that leaves before the way reaches it', () => {
    expect(sweptSpheres([0, 0, 0], [0, 0, -1], [0, 0, -0.4], [0, 2, -0.4], 0.3)).toBeNull();
  });
  it('counts two that close head on faster than a frame', () => {
    expect(sweptSpheres([0, 0, 0], [0, 0, -1], [0, 0.1, -1.2], [0, 0.1, -0.1], 0.3)).not.toBeNull();
  });
});

describe('touchAt', () => {
  it('is the moment two spheres first touch, not the moment they are nearest', () => {
    // head on: you from z 0 to −1, it still at −0.5, touching within 0.3: first at z −0.2
    expect(touchAt([0, 0, 0], [0, 0, -1], [0, 0, -0.5], [0, 0, -0.5], 0.3)).toBeCloseTo(0.2, 6);
    expect(sweptSpheres([0, 0, 0], [0, 0, -1], [0, 0, -0.5], [0, 0, -0.5], 0.3)).toBeCloseTo(0.5, 6);
  });
  it('is 0 when they already touch, and null when they never do', () => {
    expect(touchAt({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0.1 }, { x: 0, y: 0, z: 0.1 }, 0.3)).toBe(0);
    expect(touchAt([0, 0, 0], [0, 0, -1], [0, 0, -0.4], [0, 2, -0.4], 0.3)).toBeNull();
    expect(touchAt([0, 0, 0], [0, 0, -1], [0, 0, -2], [0, 0, -2], 0.3)).toBeNull(); // not reached this frame
    expect(touchAt([0, 0, 0], [0, 0, 0], [0, 0, -2], [0, 0, -2], 0.3)).toBeNull(); // neither moved
  });
  it('agrees with sweptSpheres on whether they met', () => {
    expect(touchAt([0, 0, 0], [0, 0, -1], [-0.5, 0, -0.5], [0.5, 0, -0.5], 0.3)).not.toBeNull();
    expect(touchAt([0, 0, 0], [0, 0, -1], [0, 0.1, -1.2], [0, 0.1, -0.1], 0.3)).not.toBeNull();
  });
});

describe('keptSpeed', () => {
  it('keeps its share of your speed, either way you fly', () => {
    expect(keptSpeed(6, CONTACT.slow, 12)).toBeCloseTo(1.8, 6);
    expect(keptSpeed(-6, CONTACT.glance, 12)).toBeCloseTo(-5.1, 6);
  });
  it('from twice the boost, throws you back no further than the boost (as a rock does)', () => {
    expect(keptSpeed(24, CONTACT.slow, 12)).toBe(12);
    expect(keptSpeed(30, CONTACT.slow, 12)).toBe(12);
    expect(keptSpeed(300, CONTACT.slow, 12)).toBeCloseTo(90, 6);
  });
  it('just past the boost (its overshoot, a tuned boost) still knocks you back: no step at the boost', () => {
    expect(keptSpeed(12.57, CONTACT.slow, 12)).toBeCloseTo(12.57 * CONTACT.slow, 6);
    expect(keptSpeed(19.2, CONTACT.slow, 12)).toBeCloseTo(7.2, 6);
    expect(keptSpeed(12.01, CONTACT.slow, 12) - keptSpeed(12, CONTACT.slow, 12)).toBeLessThan(0.01);
  });
  it('never speeds you up', () => {
    expect(keptSpeed(0, CONTACT.slow, 12)).toBe(0);
    expect(keptSpeed(12, CONTACT.slow, 12)).toBeCloseTo(3.6, 6);
  });
});
