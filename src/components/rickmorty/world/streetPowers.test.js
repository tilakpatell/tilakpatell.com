import { describe, expect, it } from 'vitest';
import { POWERS } from '../../universe/shared/flying';
import { createStreetPowers } from './streetPowers';

const cruiser = (o = {}) => ({ x: 0, y: 12, z: 0, yaw: 0, ...o });
const patrol = (o = {}) => ({ x: 0, y: 14, z: 20, yaw: Math.PI / 2, ...o });
// the big one charged (five patrols' worth)
const charged = (p) => {
  for (let i = 0; i < 5; i++) p.kill();
  return p;
};
const shotsOver = (p, secs, ctx) => {
  const out = [];
  for (let t = 0; t < secs; t += 1 / 60) out.push(...p.step(1 / 60, { now: 10 + t, cruiser: cruiser(), at: patrol(), flying: true, ...ctx }));
  return out;
};

describe('the cruiser’s powers over the street', () => {
  it('carries the cruiser’s own pair, or the one picked for it with the skill tree’s carry', () => {
    const p = createStreetPowers();
    p.setCrew(null, null);
    expect(p.view()).toMatchObject({ primary: { id: 'portal' }, ultimate: { id: 'wubba' } });
    p.setCrew({ primary: 'odds', ultimate: 'salvo' }, null);
    expect(p.view()).toMatchObject({ primary: { id: 'odds' }, ultimate: { id: 'salvo' } });
  });
  it('portals onto the patrol’s tail, facing its way, and cools down', () => {
    const p = createStreetPowers();
    p.setCrew(null, null);
    const r = p.press('primary', { now: 0, cruiser: cruiser(), at: patrol() });
    expect(r.ok).toBe(true);
    expect(r.portal.x).toBeCloseTo(-POWERS.portal.behind);
    expect(r.portal.z).toBeCloseTo(20);
    expect(r.portal.yaw).toBeCloseTo(Math.PI / 2);
    p.step(1, { now: 1, cruiser: cruiser(), at: patrol(), flying: true });
    expect(p.view().primary.phase).toBe('cooling');
  });
  it('hops on ahead with nobody in reach', () => {
    const p = createStreetPowers();
    p.setCrew(null, null);
    const r = p.press('primary', { now: 0, cruiser: cruiser(), at: null });
    expect(r.portal).toMatchObject({ x: 0, z: POWERS.portal.hop, yaw: 0 });
  });
  it('won’t fire the big one till it’s charged; then the death ray burns straight ahead', () => {
    const p = createStreetPowers();
    p.setCrew(null, null);
    expect(p.press('ultimate', { now: 0, cruiser: cruiser(), at: patrol() })).toMatchObject({ ok: false, why: 'charging' });
    charged(p);
    expect(p.press('ultimate', { now: 10, cruiser: cruiser(), at: patrol() }).ok).toBe(true);
    const shots = shotsOver(p, 1);
    expect(shots.length).toBeGreaterThanOrEqual(9);
    expect(shots[0].dir).toEqual([0, 0, 1]);
    expect(shots[0].damage).toBeCloseTo(POWERS.wubba.punch);
  });
  it('hits harder with the skill tree’s overcharge', () => {
    const p = createStreetPowers();
    p.setCrew(null, { bigPunch: 1.25 });
    charged(p).press('ultimate', { now: 10, cruiser: cruiser(), at: patrol() });
    expect(shotsOver(p, 0.2)[0].damage).toBeCloseTo(POWERS.wubba.punch * 1.25);
  });
  it('sends four homing torpedoes with a salvo, and Chewie shoots at the patrol with the quad guns', () => {
    const p = createStreetPowers();
    p.setCrew({ primary: 'portal', ultimate: 'salvo' }, null);
    charged(p).press('ultimate', { now: 10, cruiser: cruiser(), at: patrol() });
    const torps = shotsOver(p, 1);
    expect(torps).toHaveLength(POWERS.salvo.count);
    expect(torps.every((s) => s.homing > 0)).toBe(true);
    const q = createStreetPowers({ rand: () => 0 });
    q.setCrew({ primary: 'portal', ultimate: 'quad' }, null);
    charged(q).press('ultimate', { now: 10, cruiser: cruiser(), at: patrol() });
    const bolts = shotsOver(q, 1);
    expect(bolts.length).toBeGreaterThanOrEqual(4);
    expect(bolts[0].dir[2]).toBeGreaterThan(0.9); // (at the patrol, ahead)
  });
  it('throws Walt’s crystal, to go off where it lands', () => {
    const p = createStreetPowers();
    p.setCrew({ primary: 'portal', ultimate: 'heisenberg' }, null);
    charged(p).press('ultimate', { now: 10, cruiser: cruiser(), at: patrol() });
    const [c] = shotsOver(p, 0.2);
    expect(c.tag).toBe('crystal');
  });
  it('says what the powers do to the fight while they’re on', () => {
    const odds = createStreetPowers();
    odds.setCrew({ primary: 'odds', ultimate: 'wubba' }, null);
    odds.press('primary', { now: 0, cruiser: cruiser(), at: patrol() });
    expect(odds.mods()).toMatchObject({ ghost: true });
    const focus = createStreetPowers();
    focus.setCrew({ primary: 'focus', ultimate: 'wubba' }, null);
    focus.press('primary', { now: 0, cruiser: cruiser(), at: patrol() });
    expect(focus.mods().slow).toBeCloseTo(POWERS.focus.slow);
    const magnets = createStreetPowers();
    magnets.setCrew({ primary: 'magnets', ultimate: 'heisenberg' }, null);
    magnets.press('primary', { now: 0, cruiser: cruiser(), at: patrol() });
    expect(magnets.mods().daze).toBe(true);
    expect(createStreetPowers().mods()).toMatchObject({ ghost: false, slow: 1, daze: false });
  });
});
