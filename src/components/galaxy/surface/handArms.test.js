import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createHandArms } from './handArms';
import { WEAPONS } from './weaponRules';

const make = () => {
  const parent = new THREE.Group();
  return { parent, hand: createHandArms({ parent, muzzle: () => new THREE.Vector3(0, 1.4, 0.5) }) };
};
const shown = (parent, name) => parent.getObjectByName(name).visible;

describe('the skill tree’s guns in the hand', () => {
  it('lift the surface’s floor between shots only for the beam, the stream and the charge', () => {
    const { hand } = make();
    for (const id of ['particle', 'm60', 'gauntlet']) expect(hand.unfloored(WEAPONS[id]), id).toBe(true);
    for (const id of ['amban', 'blaster', 'dlt19']) expect(hand.unfloored(WEAPONS[id]), id).toBe(false);
  });
  it('walk the M60’s aim up more over a run, starting again after a pause', () => {
    const { hand } = make();
    const w = WEAPONS.m60;
    const first = hand.climb(w, 0, false);
    let last = first;
    for (let i = 1; i < 12; i++) last = hand.climb(w, i * w.every, false);
    expect(last).toBeGreaterThan(first);
    expect(hand.climb(w, 5, false)).toBeCloseTo(first);
    expect(hand.climb(WEAPONS.rifle, 6, false)).toBe(0);
  });
  it('charge the gauntlet while F is held, and fire its share when it’s let go', () => {
    const { parent, hand } = make();
    const w = WEAPONS.gauntlet;
    expect(hand.step(0, w, false)).toBeNull();
    hand.charge(0);
    hand.charge(0.3); // (held: still the first press's)
    expect(hand.step(0.6, w, true)).toBeNull();
    hand.frame(1 / 60);
    expect(shown(parent, 'hand-charge')).toBe(true);
    expect(hand.step(0.6, w, false)).toBeCloseTo(0.6 / w.charge);
    expect(hand.charging).toBe(false);
    hand.charge(1);
    expect(hand.step(9, w, false)).toBe(1);
    // (another gun in hand drops a charge)
    hand.charge(10);
    expect(hand.step(10.5, WEAPONS.blaster, false)).toBeNull();
    expect(hand.charging).toBe(false);
  });
  it('draw the beam while its shots keep coming, and put it away after', () => {
    const { parent, hand } = make();
    hand.beam(new THREE.Vector3(0, 1.4, 0.5), new THREE.Vector3(0, 1.4, 20));
    hand.frame(1 / 60);
    expect(shown(parent, 'hand-beam')).toBe(true);
    expect(parent.getObjectByName('hand-beam').scale.z).toBeCloseTo(19.5);
    hand.frame(0.3);
    expect(shown(parent, 'hand-beam')).toBe(false);
    hand.blast(new THREE.Vector3(), new THREE.Vector3(0, 0, 5), 2);
    hand.frame(1 / 60);
    expect(shown(parent, 'hand-blast')).toBe(true);
    hand.clear();
    expect(shown(parent, 'hand-blast')).toBe(false);
    hand.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
