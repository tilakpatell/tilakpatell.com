import { describe, expect, it } from 'vitest';
import { COVERS, RULES, createWorld, mulberry32, resolve, segmentBox, segmentCircle, step } from './sim.js';

const DT = 1 / 30;
const idle = { mx: 0, mz: 0, yaw: 0, fire: false };
// a world with no bots in the way: two actors facing each other across open ground
const duel = () => {
  const w = createWorld({ seed: 3, perTeam: 1 });
  w.covers = [];
  const [a, b] = w.actors;
  Object.assign(a, { x: 0, z: -10, yaw: 0 });
  Object.assign(b, { x: 0, z: 0, hp: RULES.hp, still: true });
  return { w, a, b };
};

describe('the geometry', () => {
  it('a segment enters a box where it crosses its face', () => {
    expect(segmentBox(-5, 0, 5, 0, { x: 0, z: 0, hx: 1, hz: 1 })).toBeCloseTo(0.4, 6);
    expect(segmentBox(-5, 2, 5, 2, { x: 0, z: 0, hx: 1, hz: 1 })).toBeNull();
  });
  it('a segment meets a circle within its radius and not beside it', () => {
    expect(segmentCircle(0, 0, 10, 0, 5, 0.4, 0.5)).toBeCloseTo(0.5, 6);
    expect(segmentCircle(0, 0, 10, 0, 5, 0.6, 0.5)).toBeNull();
  });
  it('a circle is pushed out of a box from either side, and from inside', () => {
    const box = [{ x: 0, z: 0, hx: 2, hz: 1 }];
    const p = { x: 2.2, z: 0 };
    resolve(p, 0.5, box, 30);
    expect(p.x).toBeCloseTo(2.5, 6);
    const q = { x: 0.5, z: 0.1 };
    resolve(q, 0.5, box, 30);
    expect(Math.abs(q.z)).toBeCloseTo(1.5, 6);
  });
  it('the generator is the same for the same seed', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('a bolt', () => {
  it('hits an enemy for the bolt damage', () => {
    const { w, a, b } = duel();
    a.cool = 0;
    step(w, { ...idle, fire: true }, DT);
    for (let i = 0; i < 30; i++) step(w, idle, DT);
    expect(b.hp).toBeLessThanOrEqual(RULES.hp - RULES.boltDamage);
  });
  it('stops at cover', () => {
    const { w, a, b } = duel();
    w.covers = [{ x: 0, z: -5, hx: 3, hz: 0.5 }];
    a.cool = 0;
    step(w, { ...idle, fire: true }, DT);
    for (let i = 0; i < 60; i++) step(w, idle, DT);
    expect(b.hp).toBe(RULES.hp);
    expect(w.bolts.length).toBe(0);
  });
  it('does not hurt a teammate', () => {
    const { w, a, b } = duel();
    b.team = 0;
    a.cool = 0;
    step(w, { ...idle, fire: true }, DT);
    for (let i = 0; i < 30; i++) step(w, idle, DT);
    expect(b.hp).toBe(RULES.hp);
  });
});

describe('a match', () => {
  it('a kill scores, and the fallen return at full health after the respawn time', () => {
    const { w, a, b } = duel();
    b.hp = RULES.boltDamage;
    a.cool = 0;
    step(w, { ...idle, fire: true }, DT);
    for (let i = 0; i < 20; i++) step(w, idle, DT);
    expect(w.score[0]).toBe(1);
    expect(b.dead).toBeGreaterThan(0);
    for (let i = 0; i < Math.ceil(RULES.respawn / DT) + 2; i++) step(w, idle, DT);
    expect(b.dead).toBeLessThanOrEqual(0);
    expect(b.hp).toBe(RULES.hp);
  });
  it('nobody walks into cover', () => {
    const w = createWorld({ seed: 2 });
    const me = w.actors[0];
    for (let i = 0; i < 300; i++) {
      step(w, { mx: Math.sin(i / 20), mz: Math.cos(i / 15), yaw: 0, fire: false }, DT);
      for (const c of COVERS) {
        const inside = Math.abs(me.x - c.x) < c.hx - 1e-6 && Math.abs(me.z - c.z) < c.hz - 1e-6;
        expect(inside).toBe(false);
      }
    }
  });
  it('bots alone finish a match inside ten minutes, the same way each time', () => {
    const run = () => {
      const w = createWorld({ seed: 7 });
      w.actors[0].player = false;
      let t = 0;
      while (!w.over && t < 600) { step(w, idle, DT); t += DT; }
      return { over: w.over, winner: w.winner, score: [...w.score], t: Math.round(t) };
    };
    const a = run();
    expect(a.over).toBe(true);
    expect(a.t).toBeGreaterThan(20);
    expect(run()).toEqual(a);
  });
});
