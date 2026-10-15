// A unit's own body size: a row's `body` in metres, the soldier's by default.
import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { buildNav } from './nav.js';
import { field } from './fixtures/field.js';
import { createBolts, fire, step as stepBolts } from './bolts.js';
import { bodyOf, capsulesOf, chestOf, eyeOf, newSoldier } from './soldier.js';
import { addPlayer, createSim, view } from './sim.js';
import { muzzleOf } from './core.js';

const rb = loadRulebook();
const row = rb.classes['l-orig-assault'];
const top = (s) => Math.max(...capsulesOf(s).map((c) => Math.max(c.a[1], c.b[1]) + (c.part === 'head' ? c.r : 0)));
const make = (cls, stance = 'stand') => Object.assign(newSoldier(cls, { id: 'x', team: 1, at: [0, 0, 0] }), { stance });

describe('a unit with no body of its own', () => {
  it('is the soldier’s: 1.7 m standing, 1.15 m crouched, its chest for the aim at 1.4 m, its eye at 1.55 m', () => {
    expect(bodyOf(row)).toEqual({ stand: 1.7, crouch: 1.15, chest: 1.4, eye: 1.55 });
    expect(bodyOf(null)).toEqual({ stand: 1.7, crouch: 1.15, chest: 1.4, eye: 1.55 });
  });

  it('is hit, aimed at and looks out as before, to the number', () => {
    const s = make(row);
    expect(top(s)).toBeCloseTo(1.7, 9);
    expect(chestOf(s)).toEqual([0, 1.7 * 0.7, 0]);
    expect(eyeOf(s)).toEqual([0, 1.55, 0]);
    expect(muzzleOf(s)[1]).toBe(1.55 - 0.15);
    const c = make(row, 'crouch');
    expect(top(c)).toBeCloseTo(1.15, 9);
    expect(chestOf(c)).toEqual([0, 1.15 * 0.7, 0]);
    expect(eyeOf(c)).toEqual([0, 1, 0]);
  });
});

describe('a unit 1.47 m tall', () => {
  const small = { ...row, body: { stand: 1.47 } };

  it('takes what its row leaves out in the soldier’s proportions', () => {
    const b = bodyOf(small);
    expect(b.stand).toBe(1.47);
    expect(b.crouch).toBeCloseTo((1.15 * 1.47) / 1.7, 9);
    expect(b.chest).toBeCloseTo((1.4 * 1.47) / 1.7, 9);
    expect(b.eye).toBeCloseTo((1.55 * 1.47) / 1.7, 9);
    expect(bodyOf({ ...row, body: { stand: 1.47, crouch: 1, chest: 1.2, eye: 1.3 } })).toEqual({ stand: 1.47, crouch: 1, chest: 1.2, eye: 1.3 });
  });

  it('is aimed at and looks out by its own heights, standing and crouched', () => {
    const s = make(small);
    expect(top(s)).toBeCloseTo(1.47, 9);
    expect(chestOf(s)[1]).toBeCloseTo(1.47 * 0.7, 9);
    expect(eyeOf(s)[1]).toBeCloseTo((1.55 * 1.47) / 1.7, 9);
    const c = make(small, 'crouch');
    expect(top(c)).toBeCloseTo((1.15 * 1.47) / 1.7, 9);
    expect(chestOf(c)[1]).toBeCloseTo(((1.15 * 1.47) / 1.7) * 0.7, 9);
    expect(eyeOf(c)[1]).toBeLessThan(eyeOf(s)[1]);
  });

  it('is missed by a bolt that takes a soldier in the head', () => {
    const shot = (cls) => {
      const s = make(cls);
      s.at = [0, 0, 20];
      const bolts = createBolts();
      fire(bolts, { from: [0, 1.6, 0], dir: [0, 0, 1], speed: 700, range: 200, ttl: 3, team: 2, owner: 'y', weapon: rb.weapons.a280, now: 0 });
      const ev = stepBolts(bolts, 0.05, { bodies: [{ id: s.id, team: 1, alive: true, safe: false, at: s.at, capsules: capsulesOf(s) }], nav: null, now: 0.05 });
      return ev.find((e) => e.type === 'hit') ?? null;
    };
    expect(shot(row)).toMatchObject({ target: 'x', part: 'head' });
    expect(shot(small)).toBe(null);
  });
});

describe('the sim’s soldiers', () => {
  const nav = buildNav(field());

  it('carry their body in the view: a trooper’s the soldier’s, a hero’s its own physics row’s', () => {
    const sim = createSim({ rulebook: rb, nav, seed: 1 });
    const t = addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [-40, 0, -40] });
    const yoda = addPlayer(sim, { team: 1, hero: 'yoda', at: [-44, 0, -40] });
    const vader = addPlayer(sim, { team: 2, hero: 'darthvader', at: [-48, 0, -40] });
    const v = view(sim);
    const of = (id) => v.entities.find((e) => e.id === id).body;
    expect(of(t)).toEqual({ stand: 1.7, crouch: 1.15, chest: 1.4, eye: 1.55 });
    // (a hero's crouch does not shrink it: DefaultHeroPhysics)
    expect(of(yoda)).toMatchObject({ stand: 1.2, crouch: 1.2, eye: 1 });
    expect(of(vader)).toMatchObject({ stand: 1.95, crouch: 1.95, eye: 1.55 });
    expect(top(sim.entities.get(yoda))).toBeCloseTo(1.2, 9);
  });
});
