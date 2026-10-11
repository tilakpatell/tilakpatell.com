import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import book from '../../../data/bf2017/physics/ragdoll.json';
import death from '../../../data/bf2017/physics/death.json';
import { skeleton } from '../../../lib/three/fixtures/gameSkeleton.js';
import { CORPSES, LEAD, RAGDOLLS, RANGE, SINK, createRagdolls } from './ragdolls.js';

// a figure as figures.js holds one: a model on the game's skeleton and its mixer
function figure(x = 0, z = 0) {
  const bones = skeleton();
  const model = new THREE.Group();
  model.add(bones.Hips.parent);
  model.position.set(x, 0, z);
  model.updateMatrixWorld(true);
  return { model, mixer: { stopAllAction: vi.fn() }, bones };
}
const world = (b) => b.getWorldPosition(new THREE.Vector3());
const make = (opts = {}) => createRagdolls({ book, floorAt: () => 0, ...opts });
const run = (r, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) r.update(dt);
};

describe('the constants', () => {
  it('caps the falling bodies by tier, and lies for the trooper’s corpse time', () => {
    expect(RAGDOLLS).toEqual({ high: 6, mid: 4, low: 2 });
    expect(RANGE).toBe(60);
    expect(LEAD).toBe(0.2);
    expect(CORPSES).toBe(24);
    expect(make().lie).toBe(death.rows.stormtroopershared.timeForCorpse);
    expect(make().lie).toBe(10);
  });
});

describe('createRagdolls', () => {
  it('lets the death clip lead, then hands the body to the ragdoll', () => {
    const r = make();
    const f = figure();
    expect(r.fall('a', f, { fall: null, vel: [0, 0] })).toBe(true);
    r.update(LEAD / 2);
    expect(r.handed('a')).toBe(false);
    expect(f.mixer.stopAllAction).not.toHaveBeenCalled();
    r.update(LEAD / 2 + 0.01);
    expect(r.handed('a')).toBe(true);
    expect(f.mixer.stopAllAction).toHaveBeenCalled();
    expect(r.count()).toMatchObject({ active: 1, settled: 0 });
  });

  it('refuses one over the cap or out of range, and one not on the game’s skeleton (they keep the clip)', () => {
    const r = make({ max: 2 });
    const eye = [0, 2, 0];
    expect(r.fall('a', figure(), { eye })).toBe(true);
    expect(r.fall('b', figure(), { eye })).toBe(true);
    expect(r.fall('c', figure(), { eye })).toBe(false);
    expect(make().fall('far', figure(100, 0), { eye })).toBe(false);
    const meshy = figure();
    meshy.bones.Spine.name = 'Spine01';
    meshy.model.add(Object.assign(new THREE.Bone(), { name: 'head_end' }));
    expect(make().fall('m', meshy, {})).toBe(false);
    expect(r.has('c')).toBe(false);
  });

  it('pushes the bone the bolt struck first, the way the shot went', () => {
    const r = make({ lead: 0 });
    const f = figure();
    const head = world(f.bones.Head);
    const foot0 = world(f.bones.LeftFoot);
    r.fall('a', f, { fall: { part: 'head', at: [head.x, head.y, head.z], dir: [1, 0, 0], weapon: 'e11' } });
    r.update(1 / 60);
    r.update(1 / 60);
    const dHead = world(f.bones.Head).x - head.x;
    const dFoot = world(f.bones.LeftFoot).x - foot0.x;
    expect(dHead).toBeGreaterThan(0);
    expect(dHead).toBeGreaterThan(Math.abs(dFoot) * 3);
  });

  it('lays the body on the level’s ground and freezes it there once settled', () => {
    const r = make({ lead: 0, floorAt: () => 0.5 });
    const f = figure();
    f.model.position.y = 0.5;
    f.model.updateMatrixWorld(true);
    r.fall('a', f, { fall: { part: 'chest', at: null, dir: [0, 0, 1], weapon: 'e11' } });
    run(r, 7);
    expect(r.settled('a')).toBe(true);
    expect(r.count()).toMatchObject({ active: 0, settled: 1 });
    const hips = world(f.bones.Hips);
    expect(hips.y).toBeGreaterThan(0.5);
    expect(hips.y).toBeLessThan(0.9);
    run(r, 1);
    expect(world(f.bones.Hips).distanceTo(hips)).toBeLessThan(1e-9);
  });

  it('frees a settled body’s place under the cap', () => {
    const r = make({ lead: 0, max: 1 });
    r.fall('a', figure(), {});
    expect(r.fall('b', figure(), {})).toBe(false);
    run(r, 7);
    expect(r.fall('b', figure(), {})).toBe(true);
  });

  it('keeps no more than the cap lying: the oldest is hidden', () => {
    const r = make({ lead: 0, corpses: 1 });
    const a = figure();
    const b = figure(2, 0);
    r.fall('a', a, {});
    run(r, 7);
    expect(a.model.visible).toBe(true);
    r.fall('b', b, {});
    run(r, 7);
    expect(a.model.visible).toBe(false);
    expect(b.model.visible).toBe(true);
    expect(r.handed('a')).toBe(true);
    expect(r.count().settled).toBe(1);
  });

  it('sinks a corpse after its time, then hides it', () => {
    const r = make({ lead: 0, lie: 8 });
    const f = figure();
    r.fall('a', f, {});
    run(r, 8);
    const y0 = f.model.position.y;
    run(r, SINK / 2);
    expect(f.model.position.y).toBeLessThan(y0);
    expect(f.model.visible).toBe(true);
    run(r, SINK / 2 + 0.05);
    expect(f.model.visible).toBe(false);
    expect(r.handed('a')).toBe(true);
  });

  it('forgets a body the sim took away', () => {
    const r = make({ lead: 0 });
    r.fall('a', figure(), {});
    r.update(1 / 60);
    r.drop('a');
    expect(r.has('a')).toBe(false);
    expect(r.handed('a')).toBe(false);
    expect(r.count()).toMatchObject({ active: 0, settled: 0 });
  });

  it('waits for the ragdoll book when it comes as a promise', async () => {
    const r = createRagdolls({ book: Promise.resolve(book), floorAt: () => 0 });
    expect(r.fall('a', figure(), {})).toBe(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(r.fall('a', figure(), {})).toBe(true);
  });
});
