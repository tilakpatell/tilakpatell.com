import { describe, expect, it } from 'vitest';
import { BREAK, createHullCap } from '../../physics/breaks.js';
import { createPhysics } from '../../physics/world.js';
import { DEBRIS_FX, createDebris, debrisDefs } from './debris.js';

// effects.js's face, as debris uses it: what was spawned, and how many
const fakeEffects = () => {
  const spawned = [];
  return { spawned, spawn: (name, at, quat, scale, opts) => spawned.push({ name, at, opts }) };
};
const ground = (p) => p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [40, 0.5, 40] }] });

describe('createDebris', () => {
  it('a crate breaks into a few hulls the player can hit and a burst on the GPU', async () => {
    const physics = await createPhysics();
    const fx = fakeEffects();
    const debris = createDebris(fx, physics);
    debris.break([0, 1, 0], 1, [0, 2, 0]);
    const s = debris.stats();
    expect(s.hulls).toBe(6);
    expect(fx.spawned).toHaveLength(1);
    expect(fx.spawned[0].name).toBe(DEBRIS_FX);
    expect(fx.spawned[0].opts.burst).toBe(BREAK.burstMin);
    expect(s.particles).toBe(BREAK.burstMin);
    physics.dispose();
  });

  it('holds 64 live hulls however many breaks come, the rest as particles', async () => {
    const physics = await createPhysics();
    const debris = createDebris(fakeEffects(), physics);
    for (let i = 0; i < 20; i++) debris.break([i * 3, 2, 0], 2.5, [0, 0, 0]);
    const s = debris.stats();
    expect(s.hulls).toBe(BREAK.live);
    expect(s.refused).toBeGreaterThan(0);
    expect(s.breaks).toBe(20);
    physics.dispose();
  });

  it('a hull asleep 2 s becomes a static instance and frees its slot', async () => {
    const physics = await createPhysics();
    ground(physics);
    const statics = [];
    const debris = createDebris(fakeEffects(), physics, { onStatic: (pose) => statics.push(pose) });
    debris.break([0, 0.6, 0], 1, [0, 0, 0]);
    const n = debris.stats().hulls;
    expect(n).toBeGreaterThan(0);
    for (let f = 0; f < 60 * 8 && debris.stats().hulls; f++) {
      physics.step(1 / 60);
      debris.update(1 / 60);
    }
    const s = debris.stats();
    expect(s.hulls).toBe(0);
    expect(s.statics).toBe(n);
    expect(statics).toHaveLength(n);
    expect(statics[0].position[1]).toBeLessThan(1);
    expect(statics[0].quaternion).toHaveLength(4);
    expect(debris.cap.room()).toBe(BREAK.live);
    physics.dispose();
  });

  it('the live cap counts a ragdoll’s bodies too (Review Focus 4)', async () => {
    const physics = await createPhysics();
    const cap = createHullCap();
    const debris = createDebris(fakeEffects(), physics, { cap });
    const release = cap.hold(60);
    debris.break([0, 1, 0], 1, [0, 0, 0]);
    expect(debris.stats().hulls).toBe(4);
    release();
    debris.break([5, 1, 0], 1, [0, 0, 0]);
    expect(debris.stats().hulls).toBe(10);
    physics.dispose();
  });

  it('a seed gives the same pieces in the same places', async () => {
    const run = async () => {
      const physics = await createPhysics();
      ground(physics);
      const debris = createDebris(fakeEffects(), physics, { seed: 9 });
      debris.break([0, 1, 0], 1.5, [1, 2, 0]);
      for (let f = 0; f < 30; f++) physics.step(1 / 60);
      const out = debris.hulls().map((h) => h.body.position().map((v) => +v.toFixed(5)));
      physics.dispose();
      return out;
    };
    expect(await run()).toEqual(await run());
  });

  it('a break that is not numbers, or a disposed world, makes nothing and throws nothing', async () => {
    const physics = await createPhysics();
    const fx = fakeEffects();
    const debris = createDebris(fx, physics);
    debris.break([NaN, 0, 0], 1);
    debris.break([0, 0, 0], NaN);
    physics.dispose();
    debris.break([0, 1, 0], 1);
    expect(debris.stats().hulls).toBe(0);
    expect(fx.spawned).toHaveLength(0);
  });

  it('its burst record collides with the depth buffer and lives no longer than 3 s', () => {
    const def = debrisDefs()[DEBRIS_FX];
    expect(def.emitters[0].collide).toBe(true);
    expect(def.emitters[0].loop).toBe(false);
    expect(def.emitters[0].maxCount).toBe(BREAK.burstMax);
    expect(def.emitters[0].lifetime.random[1]).toBeLessThanOrEqual(3);
  });
});
