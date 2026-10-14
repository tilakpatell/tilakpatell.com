import { beforeAll, describe, expect, it } from 'vitest';
import { createPhysics } from '../../../lib/physics/world.js';
import { addHeightfield } from '../../../lib/physics/heightfield.js';
import BODY from '../../../data/bf2017/physics/soldier.json';
import { classOf, loadRulebook } from '../../../lib/battlefront/rulebook.js';
import { newSoldier } from '../../../lib/battlefront/soldier.js';
import { createWalker, fromPackFrame, toPackFrame } from './walk.js';

const ROW = BODY.rows[BODY.default];
// (a pack at Hoth's origin, turned none: the export's frame is the pack's shifted)
const PACK = { origin: [205, 362.3, -1540], yaw: 0 };
const DT = 1 / 30;
const ASSAULT = classOf(loadRulebook(), 'd-orig-assault');
const soldier = (at) => newSoldier(ASSAULT, { id: 'p', team: 2, at: [...at] });

let physics;
beforeAll(async () => {
  physics = await createPhysics();
});

// a flat 64 m ground in the pack's frame at height h, its corner at (x, z)
const ground = (x, z, h = 0) => addHeightfield(physics, { heights: new Float32Array(65 * 65).fill(h), n: 65, size: 64, x, z });

describe('the player on the soldier’s body', () => {
  it('turns places between the export’s frame and the pack’s', () => {
    expect(toPackFrame(PACK, [215, 370, -1530])).toEqual([10, expect.closeTo(7.7, 5), 10]);
    expect(fromPackFrame(PACK, [10, 7.7, 10]).map((v) => Math.round(v * 1000) / 1000)).toEqual([215, 370, -1530]);
    const turned = { origin: [0, 0, 0], yaw: Math.PI / 2 };
    const back = fromPackFrame(turned, toPackFrame(turned, [3, 1, 4]));
    expect(back.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([3, 1, 4]);
  });

  it('walks the ground at the soldier’s speed and stands on it', () => {
    const g = ground(-32, -32);
    physics.world.step();
    const s = soldier(fromPackFrame(PACK, [0, 0, 0]));
    const w = createWalker({ physics, pack: PACK, row: ROW, at: s.at });
    for (let i = 0; i < 30; i++) w.mover(s, [0, 1], DT);
    const p = toPackFrame(PACK, s.at);
    // (a second of walking ahead (+z) at the record's walk, 3.8 m/s, on the ground)
    expect(p[2]).toBeGreaterThan(3);
    expect(p[2]).toBeLessThan(4.2);
    expect(Math.abs(p[1])).toBeLessThan(0.1);
    expect(s.grounded).toBe(true);
    w.dispose();
    physics.remove(g);
  });

  it('stops at a wall, where the 2D grid would have let it through', () => {
    const g = ground(-32, -32);
    const wall = physics.add({ type: 'fixed', position: [0, 1, 2], group: 'object', colliders: [{ shape: 'cuboid', args: [5, 1, 0.1] }] });
    physics.world.step();
    const s = soldier(fromPackFrame(PACK, [0, 0, 0]));
    const w = createWalker({ physics, pack: PACK, row: ROW, at: s.at });
    for (let i = 0; i < 60; i++) w.mover(s, [0, 1], DT);
    expect(toPackFrame(PACK, s.at)[2]).toBeLessThan(2 - 0.1 - ROW.radius + 0.05);
    w.dispose();
    physics.remove(wall);
    physics.remove(g);
  });

  it('is held in the air while nothing is under it, and drops when a floor comes', () => {
    const s = soldier(fromPackFrame(PACK, [100, 10, 100]));
    const w = createWalker({ physics, pack: PACK, row: ROW, at: s.at });
    for (let i = 0; i < 30; i++) w.mover(s, [0, 0], DT);
    expect(w.held).toBe(true);
    expect(toPackFrame(PACK, s.at)[1]).toBeCloseTo(10, 0);
    // (the stream brings the floor under it)
    const g = ground(68, 68, 0);
    physics.world.step();
    for (let i = 0; i < 90; i++) w.mover(s, [0, 0], DT);
    expect(w.held).toBe(false);
    expect(Math.abs(toPackFrame(PACK, s.at)[1])).toBeLessThan(0.1);
    w.dispose();
    physics.remove(g);
  });

  it('a place written to the soldier is a teleport', () => {
    const g = ground(-32, -32);
    physics.world.step();
    const s = soldier(fromPackFrame(PACK, [0, 0, 0]));
    const w = createWalker({ physics, pack: PACK, row: ROW, at: s.at });
    w.mover(s, [0, 0], DT);
    s.at = fromPackFrame(PACK, [10, 0, -10]);
    for (let i = 0; i < 5; i++) w.mover(s, [0, 0], DT);
    const p = toPackFrame(PACK, s.at);
    expect(p[0]).toBeCloseTo(10, 1);
    expect(p[2]).toBeCloseTo(-10, 1);
    w.dispose();
    physics.remove(g);
  });
});
