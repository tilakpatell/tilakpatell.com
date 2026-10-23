import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createFootHand } from './footHand';
import { METRE, offset, person } from './foot';
import { footWeapon } from './footArms';
import { HAND_FX } from '../../lib/arms/behaviours';

const R = 18;
const me = person([0, 1, 0], [0, 0, 1]);
const trooper = { id: 7, alive: true, hp: 3, ...person(offset(me, 4 * METRE, 0, R).n, [0, 0, 1]) };
const from = new THREE.Vector3(0, R + METRE, 0);
const dir = new THREE.Vector3(0, 0, 1);

const play = (gun, o = {}) => {
  const root = new THREE.Group();
  const hand = createFootHand({ root, metre: METRE });
  const struck = [];
  const shoved = [];
  const lines = [];
  // (the scene's line from the muzzle: the trooper 4 m on, if the line's that wide; else the ground 9 m on)
  const line = (a, d, reach, girth) => (lines.push({ reach, girth }), o.miss ? { at: [0, R, 9 * METRE], target: null } : { at: [0, R + METRE, 4 * METRE], target: trooper });
  const ctx = { line, charge: null, damage: 2, me, strike: (t, d, along, how) => struck.push({ id: t.id, d, how }), shove: (t, s, lift) => shoved.push({ id: t.id, s, lift }), ...o };
  const was = hand.shot(footWeapon(gun, {}), from, dir, ctx);
  hand.frame(1 / 60, footWeapon(gun, {}), null, 0);
  const drawn = root.children.filter((m) => m.visible).map((m) => m.name);
  hand.dispose();
  return { was, struck, shoved, drawn, lines };
};

describe('the skill tree’s guns past a bolt, on the planets', () => {
  it('lands the particle beam at once on whoever the line meets, drawn as a beam, and ash', () => {
    const r = play('particle');
    expect(r.was).toBe(true);
    expect(r.struck).toEqual([{ id: 7, d: 2, how: 'particle' }]);
    expect(r.drawn).toEqual(expect.arrayContaining(['hand-beam', 'hand-beam-core', 'hand-beam-end']));
  });

  it('throws whoever the gauntlet’s blast meets, harder the longer it was held', () => {
    const light = play('gauntlet', { charge: 0 });
    const full = play('gauntlet', { charge: 1 });
    expect(full.was).toBe(true);
    expect(full.struck[0]).toMatchObject({ id: 7, how: 'gauntlet' });
    expect(full.drawn).toContain('hand-blast');
    expect(full.shoved[0].lift).toBeCloseTo(HAND_FX.gauntlet.lift[1] * METRE);
    expect(light.shoved[0].lift).toBeCloseTo(HAND_FX.gauntlet.lift[0] * METRE);
  });

  it('leaves the gauntlet’s press (charging) and every other gun to the bolt', () => {
    expect(play('gauntlet').was).toBe(false);
    expect(play('amban').was).toBe(false);
    expect(play('blaster').was).toBe(false);
  });

  it('hits nobody the line misses, the beam drawn to where it stops all the same', () => {
    const r = play('particle', { miss: true });
    expect(r.struck).toEqual([]);
    expect(r.drawn).toContain('hand-beam');
  });

  it('looks along its own line, the gun’s reach, wider than a bolt, the full blast wider still', () => {
    const beam = play('particle').lines[0];
    expect(beam.reach).toBeCloseTo(footWeapon('particle', {}).range * METRE);
    expect(beam.girth).toBeGreaterThan(0);
    const light = play('gauntlet', { charge: 0 }).lines[0];
    const full = play('gauntlet', { charge: 1 }).lines[0];
    expect(full.girth).toBeGreaterThan(light.girth);
    expect(light.girth).toBeGreaterThan(beam.girth);
  });
});
