import { describe, expect, it } from 'vitest';
import book from '../../../data/bf2017/physics/soldier.json';
import { createPhysics } from '../../../lib/physics/world';
import { GRAVITY } from '../../../lib/physics/soldier';
import { createPlayerBody, walkIntent } from './playerBody';
import { WALK, walker } from './walker';

const row = book.rows[book.default];
const STEP = 1 / 60;
// the walker's world: flat land, nothing solid (the fallback's)
const flat = { heightAt: () => 0, normalAt: () => [0, 1, 0], reach: 500 };
const still = { x: 0, y: 0, run: false, heading: 0 };
const forward = (o = {}) => ({ x: 0, y: 1, run: false, heading: 0, ...o });

// a hand-built level: a floor, a 0.4 m step at z 2 and a 0.5 m one at x 6
async function level() {
  const p = await createPhysics({ gravity: -GRAVITY });
  p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [50, 0.5, 50] }] });
  p.add({ type: 'fixed', position: [0, 0.2, 4], group: 'object', colliders: [{ shape: 'cuboid', args: [1, 0.2, 2] }] });
  p.add({ type: 'fixed', position: [6, 0.25, 4], group: 'object', colliders: [{ shape: 'cuboid', args: [1, 0.25, 2] }] });
  return p;
}
const run = (body, input, seconds) => {
  let out = null;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = body.step(input, STEP);
  return out;
};

describe('walkIntent', () => {
  it('forward at heading 0 is +z at the soldier’s walk, the run his sprint', () => {
    const s = { ...walker(), vx: 0, vz: 3.8 };
    expect(walkIntent(s, forward(), row).vel.z).toBeCloseTo(3.8, 6);
    const r = walkIntent({ ...walker(), vz: 3.8 * 1.57 }, forward({ run: true }), row);
    expect(r.vel.z).toBeCloseTo(3.8 * 1.57, 6);
    expect(r.face).toBeCloseTo(0, 6);
  });

  it('turns with the camera and eases from rest', () => {
    const it = walkIntent(walker(), forward({ heading: Math.PI / 2 }), row);
    expect(it.vel.x).toBeGreaterThan(0);
    expect(it.vel.x).toBeLessThan(3.8);
    expect(Math.abs(it.vel.z)).toBeLessThan(1e-9);
  });

  it('a jump is the record’s height, only from the ground', () => {
    const it = walkIntent(walker(), { ...still, jump: true }, row);
    expect((it.jump * it.jump) / (2 * GRAVITY)).toBeCloseTo(1.1, 6);
    expect(walkIntent({ ...walker(), grounded: false }, { ...still, jump: true }, row).jump).toBe(0);
  });
});

describe('createPlayerBody', () => {
  it('writes back every key the walker sets', async () => {
    const p = await level();
    const st = walker(0, -2, 0, 0);
    const body = createPlayerBody({ physics: p, state: st, row, world: flat });
    const keys = Object.keys(walker());
    for (const k of keys) st[k] = Number.NaN;
    Object.assign(st, { x: 0, y: 0, z: -2, yaw: 0, vy: 0, grounded: true });
    body.step(forward(), STEP);
    for (const k of keys) expect(Number.isFinite(Number(st[k])), k).toBe(true);
    expect(st.pose).toBe('stand');
    body.dispose();
    p.dispose();
  });

  it('climbs a 0.4 m step; a 0.5 m one stops it', async () => {
    const p = await level();
    const st = walker(0, -1, 0, 0);
    const body = createPlayerBody({ physics: p, state: st, row, world: flat });
    run(body, forward(), 2);
    expect(st.y).toBeGreaterThan(0.35);
    expect(st.z).toBeGreaterThan(2.5);
    body.teleport([6, 0, -1], 0);
    let bumped = false;
    for (let i = 0; i < 120; i++) bumped = body.step(forward(), STEP).bumped || bumped;
    expect(st.y).toBeLessThan(0.1);
    expect(st.z).toBeLessThan(2);
    expect(bumped).toBe(true);
    body.dispose();
    p.dispose();
  });

  it('a jump leaves the ground and the landing reports its speed', async () => {
    const p = await level();
    const st = walker(-10, -10, 0, 0);
    const body = createPlayerBody({ physics: p, state: st, row, world: flat });
    run(body, still, 0.3);
    expect(body.step({ ...still, jump: true }, STEP).jumped).toBe(true);
    let top = 0;
    let landed = 0;
    for (let i = 0; i < 90 && !landed; i++) {
      landed = body.step(still, STEP).landed;
      top = Math.max(top, st.y);
    }
    expect(top).toBeGreaterThan(0.9);
    expect(top).toBeLessThan(1.2);
    expect(landed).toBeGreaterThan(3);
    expect(st.grounded).toBe(true);
    body.dispose();
    p.dispose();
  });

  it('crouches after the transition, and will not stand up under a beam', async () => {
    const p = await level();
    p.add({ type: 'fixed', position: [-20, 1.3 + 0.25, 0], group: 'object', colliders: [{ shape: 'cuboid', args: [1, 0.25, 1] }] });
    const st = walker(-20, -3, 0, 0);
    const body = createPlayerBody({ physics: p, state: st, row, world: flat });
    run(body, still, 0.2);
    run(body, { ...still, crouch: true }, 0.1);
    expect(body.pose).toBe('stand');
    run(body, { ...still, crouch: true }, 0.2);
    expect(body.pose).toBe('crouch');
    run(body, forward({ crouch: true }), 1.2);
    expect(st.z).toBeGreaterThan(-1);
    expect(st.z).toBeLessThan(1);
    run(body, still, 0.5);
    expect(body.pose).toBe('crouch');
    body.dispose();
    p.dispose();
  });

  it('walks on the walker until the engine comes, and for good if it fails', async () => {
    let fail;
    const st = walker(0, 0, 0, 0);
    const errors = [];
    const body = createPlayerBody({ physics: new Promise((_, no) => (fail = no)), state: st, row, world: flat, onError: (e) => errors.push(e) });
    body.step(forward(), STEP);
    const z1 = st.z;
    expect(z1).toBeGreaterThan(0);
    fail(new Error('offline'));
    await Promise.resolve();
    await Promise.resolve();
    expect(errors).toHaveLength(1);
    body.step(forward(), STEP);
    expect(st.z).toBeGreaterThan(z1);
    expect(body.ready).toBe(false);
  });

  it('a fall out of the engine’s world is caught on the walker’s ground', async () => {
    const p = await createPhysics({ gravity: -GRAVITY }); // (nothing in it: past the streamed cells)
    const st = walker(0, 0, 0, 0);
    const body = createPlayerBody({ physics: p, state: st, row, world: flat });
    let lowest = 0;
    for (let i = 0; i < 180; i++) {
      body.step(still, STEP);
      lowest = Math.min(lowest, st.y);
    }
    expect(lowest).toBeGreaterThan(-4); // (it trips at 10 m/s: about 3.2 m down)
    expect(st.y).toBeGreaterThan(-4);
    body.dispose();
    p.dispose();
  });

  it('wades no deeper than the knees where the water is deep, as the walker does, and takes the floor with it', async () => {
    // (a lake bed 3 m down under water at 0: the walker holds you at WALK.wade under the top; the body did not)
    const p = await createPhysics({ gravity: -GRAVITY });
    p.add({ type: 'fixed', position: [0, -3.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [50, 0.5, 50] }] });
    const lake = { ...flat, heightAt: () => -3, water: 0 };
    const st = walker(0, 0, -0.5, 0);
    const body = createPlayerBody({ physics: p, state: st, row, world: lake });
    run(body, still, 1);
    expect(st.y).toBeCloseTo(-WALK.wade, 1);
    expect(st.wading).toBeGreaterThan(0.9);
    run(body, forward(), 0.5);
    expect(st.y).toBeCloseTo(-WALK.wade, 1);
    const before = p.world.bodies.len();
    body.dispose();
    expect(p.world.bodies.len()).toBe(before - 2); // (the body and its wading floor)
    p.dispose();
  });

  it('walks a push of a step or two over the ground (a roll, the crowd), up onto what’s there, not into it', async () => {
    const p = await level();
    const st = walker(0, 1, 0, 0);
    const body = createPlayerBody({ physics: p, state: st, row, world: flat });
    run(body, still, 0.3);
    // (pushed on, five centimetres a frame, onto the 0.4 m step at z 2)
    for (let i = 0; i < 60; i++) {
      st.z += 0.05;
      body.step(still, STEP);
    }
    run(body, still, 0.3);
    expect(st.z).toBeGreaterThan(3.5);
    expect(st.y).toBeCloseTo(0.4, 1);
    expect(Math.hypot(st.vx, st.vz)).toBeLessThan(0.5); // (the push gone with it: no slide on)
    body.dispose();
    p.dispose();
  });

  it('a teleport puts the body there and clears the knock', async () => {
    const p = await level();
    const st = walker(-10, -10, 0, 0);
    const body = createPlayerBody({ physics: p, state: st, row, world: flat });
    run(body, still, 0.2);
    body.knock([20, 0, 0]);
    body.teleport([10, 0, -10], 1);
    expect(body.character.knockLeft()).toBe(0);
    run(body, still, 0.3);
    expect(st.x).toBeCloseTo(10, 1);
    expect(st.z).toBeCloseTo(-10, 1);
    // (a write to the state straight, the scene's own teleport, is followed too)
    st.x = -15;
    st.z = 5;
    run(body, still, 0.2);
    expect(st.x).toBeCloseTo(-15, 1);
    expect(st.z).toBeCloseTo(5, 1);
    body.dispose();
    p.dispose();
  });
});
