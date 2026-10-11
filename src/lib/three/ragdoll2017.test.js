import { describe, expect, it } from 'vitest';
import book from '../../data/bf2017/physics/ragdoll.json';
import { skeleton } from './fixtures/gameSkeleton';
import { floorCollide, ragdollOf, rig2017 } from './ragdoll2017';

const TROOPER = ragdollOf(book, 'stormtroopershared');

const flat = floorCollide(() => 0);
const run = (rag, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) rag.step(dt);
};

describe('the game’s ragdoll rows', () => {
  it('gives the trooper fifteen bodies and the impulse cap', () => {
    expect(TROOPER.bodies).toHaveLength(15);
    expect(TROOPER.maxImpulse).toBe(1000);
    expect(TROOPER.impulseLifetime).toBe(10);
  });

  it('gives a partial row the trooper’s bodies, and nothing for an unknown id', () => {
    const ewok = ragdollOf(book, 'hero_lightsaber_ewok');
    expect(ewok.partial).toBe(true);
    expect(ewok.bodies).toHaveLength(15);
    expect(ragdollOf(book, 'nobody')).toBe(null);
  });
});

describe('rig2017', () => {
  it('makes a point a body and sticks along the bodies’ tree', () => {
    const rag = rig2017(skeleton(), TROOPER, { collide: flat });
    expect(rag.body.n).toBe(15);
    expect(rag.point('Spine2')).toBe(null);
    expect(rag.point('LeftHand')).toBeTruthy();
    expect(rag.mass).toBeGreaterThan(80);
    // the upper arm hangs off the spine's point, not a shoulder's: they stay as far apart as they began
    const arm = rag.point('LeftArm');
    const spine = rag.point('Spine');
    const d0 = Math.hypot(arm.x - spine.x, arm.y - spine.y, arm.z - spine.z);
    run(rag, 0.5);
    const a = rag.point('LeftArm');
    const s = rag.point('Spine');
    expect(Math.hypot(a.x - s.x, a.y - s.y, a.z - s.z)).toBeCloseTo(d0, 1);
  });

  it('caps a kick by maxImpulse over the whole mass, and a second kick in the frame takes what is left', () => {
    const rag = rig2017(skeleton(), TROOPER, { collide: flat, speed: 0 });
    const first = rag.kick([800, 0, 0]);
    const second = rag.kick([800, 0, 0]);
    expect(first).toBe(800);
    expect(second).toBeCloseTo(200, 6);
    expect(rag.kick([800, 0, 0])).toBe(0);
    const x0 = rag.point('Spine').x;
    rag.step(1 / 60);
    // 1000 N·s over ~94 kg is under 11 m/s: under 0.2 m in the first step
    expect(rag.point('Spine').x - x0).toBeLessThan(0.2);
    expect(rag.point('Spine').x - x0).toBeGreaterThan(0.1);
  });

  it('holds the falling push under the cap too, and the allowance comes back over the lifetime', () => {
    const rag = rig2017(skeleton(), TROOPER, { collide: flat, speed: 100, push: { x: 1, y: 0, z: 0 } });
    expect(rag.kick([500, 0, 0])).toBe(0); // (the fall spent it all)
    run(rag, 5);
    expect(rag.kick([1000, 0, 0])).toBeGreaterThan(400);
  });

  it('settles on a flat floor within six seconds, every point at or over it', () => {
    const rag = rig2017(skeleton(), TROOPER, { collide: flat, push: { x: 0, y: 0, z: 1 }, speed: 3 });
    run(rag, 6.5);
    expect(rag.settled).toBe(true);
    for (let i = 0; i < rag.body.n; i++) expect(rag.body.pos[i * 3 + 1]).toBeGreaterThanOrEqual(-1e-6);
    expect(rag.centre()[1]).toBeLessThan(0.4);
  });
});

describe('rig2017’s hit at a bone', () => {
  const centroid = (rag) => {
    const c = [0, 0, 0];
    for (let i = 0; i < rag.body.n; i++) for (let k = 0; k < 3; k++) c[k] += rag.body.pos[i * 3 + k] / rag.body.n;
    return c;
  };

  it('kicks the bone it is given: the head moves more than the feet in the first step', () => {
    const rag = rig2017(skeleton(), TROOPER, { speed: 0, gravity: 0 });
    const head0 = rag.point('Head').x;
    const foot0 = rag.point('LeftFoot').x;
    expect(rag.kickAt('Head', [50, 0, 0])).toBe(50);
    rag.step(1 / 60);
    expect(rag.point('Head').x - head0).toBeGreaterThan(Math.abs(rag.point('LeftFoot').x - foot0) * 3);
  });

  it('moves the whole body at the impulse over its mass (50 N·s on the trooper’s 94 kg)', () => {
    const rag = rig2017(skeleton(), TROOPER, { speed: 0, gravity: 0 });
    const c0 = centroid(rag);
    rag.kickAt('Spine', [50, 0, 0]);
    run(rag, 0.2);
    const c1 = centroid(rag);
    const speed = (c1[0] - c0[0]) / 0.2;
    expect(speed).toBeGreaterThan((50 / rag.mass) * 0.75);
    expect(speed).toBeLessThan((50 / rag.mass) * 1.25);
  });

  it('spends the same allowance as kick, and takes nothing at a bone it has not got', () => {
    const rag = rig2017(skeleton(), TROOPER, { speed: 0 });
    rag.kick([1000, 0, 0]);
    expect(rag.kickAt('Head', [50, 0, 0])).toBe(0);
    const fresh = rig2017(skeleton(), TROOPER, { speed: 0 });
    expect(fresh.kickAt('Spine2', [50, 0, 0])).toBe(0);
  });

  it('weighs its momentum by the bodies’ masses', () => {
    const rag = rig2017(skeleton(), TROOPER, { speed: 0, gravity: 0 });
    expect(rag.momentum()).toBeCloseTo(0, 9);
    rag.body.push({ x: 1, y: 0, z: 0 });
    expect(rag.momentum()).toBeCloseTo(rag.mass, 6);
  });

  it('settles by the game’s SettleMomentum on a flat floor, the hips over it', () => {
    const rag = rig2017(skeleton(), TROOPER, { collide: flat, speed: 0 });
    rag.kickAt('Head', [0, 0, 50]);
    let t = 0;
    while (!rag.settled && t < 7) {
      rag.step(1 / 60);
      t += 1 / 60;
    }
    expect(rag.settled).toBe(true);
    expect(t).toBeLessThan(6);
    const hips = TROOPER.bodies.find((b) => b.bone === 'Hips');
    expect(rag.point('Hips').y).toBeGreaterThanOrEqual(hips.radius - 1e-6);
    expect(rag.momentum()).toBeLessThan(TROOPER.settleMomentum * 2);
  });
});

describe('floorCollide', () => {
  it('reads a number, a { y } or nothing', () => {
    const p = { x: 0, y: 0.01, z: 0 };
    expect(floorCollide(() => ({ y: 0.5 }))(p, 0.1)).toBe(true);
    expect(p.y).toBeCloseTo(0.6, 9);
    expect(floorCollide(() => null)({ x: 0, y: -5, z: 0 }, 0.1)).toBe(false);
  });
});
