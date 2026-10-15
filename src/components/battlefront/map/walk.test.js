import { beforeAll, describe, expect, it } from 'vitest';
import { createPhysics } from '../../../lib/physics/world.js';
import { addHeightfield } from '../../../lib/physics/heightfield.js';
import BODY from '../../../data/bf2017/physics/soldier.json';
import { classOf, loadRulebook } from '../../../lib/battlefront/rulebook.js';
import { newSoldier } from '../../../lib/battlefront/soldier.js';
import { buildNav } from '../../../lib/battlefront/nav.js';
import { addPlayer, createSim, step } from '../../../lib/battlefront/sim.js';
import { createWalker, fromPackFrame, toPackFrame } from './walk.js';

const ROW = BODY.rows[BODY.default];
// (a pack at Hoth's origin, turned none: the export's frame is the pack's shifted)
const PACK = { origin: [205, 362.3, -1540], yaw: 0 };
const DT = 1 / 30;
const RB = loadRulebook();
const ASSAULT = classOf(RB, 'd-orig-assault');
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
    for (let i = 0; i < 30; i++) (w.mover(s, [0, 1], DT), w.step());
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
    for (let i = 0; i < 60; i++) (w.mover(s, [0, 1], DT), w.step());
    expect(toPackFrame(PACK, s.at)[2]).toBeLessThan(2 - 0.1 - ROW.radius + 0.05);
    w.dispose();
    physics.remove(wall);
    physics.remove(g);
  });

  it('is held in the air while nothing is under it, and drops when a floor comes', () => {
    const s = soldier(fromPackFrame(PACK, [100, 10, 100]));
    const w = createWalker({ physics, pack: PACK, row: ROW, at: s.at });
    for (let i = 0; i < 30; i++) (w.mover(s, [0, 0], DT), w.step());
    expect(w.held).toBe(true);
    expect(toPackFrame(PACK, s.at)[1]).toBeCloseTo(10, 0);
    // (the stream brings the floor under it)
    const g = ground(68, 68, 0);
    physics.world.step();
    for (let i = 0; i < 90; i++) (w.mover(s, [0, 0], DT), w.step());
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
    (w.mover(s, [0, 0], DT), w.step());
    s.at = fromPackFrame(PACK, [10, 0, -10]);
    for (let i = 0; i < 5; i++) (w.mover(s, [0, 0], DT), w.step());
    const p = toPackFrame(PACK, s.at);
    expect(p[0]).toBeCloseTo(10, 1);
    expect(p[2]).toBeCloseTo(-10, 1);
    w.dispose();
    physics.remove(g);
  });
});

// A hero on the body: the sim's own soldier (its drive, its jump's arc, its rush) moved by the walker, over a
// navgrid whose ground is 40 m over the body's, as the mountain's snow is over Echo Base's floors
describe('a hero on the soldier’s body', () => {
  const EAST = Math.PI / 2;
  const hero = (id = 'luke') => {
    const sim = createSim({ rulebook: RB, nav: buildNav({ heightAt: () => PACK.origin[1] + 40, bounds: { min: [150, -1600], max: [260, -1480] } }), seed: 7 });
    const s = sim.entities.get(addPlayer(sim, { team: 2, hero: id, at: PACK.origin, yaw: EAST }));
    s.at = fromPackFrame(PACK, [0, 0, 0]);
    const w = createWalker({ physics, pack: PACK, row: ROW, at: s.at });
    s.mover = w.mover;
    const run = (n, input) => {
      for (let i = 0; i < n; i++) (step(sim, [{ id: s.id, look: EAST, move: [0, 0], ...input(i) }]), w.step());
    };
    // (stood on the ground first)
    run(5, () => ({}));
    return { sim, s, w, run };
  };

  it('walks by the hero’s drive: ahead at 4.725 m/s, backing off at 0.89 of it', () => {
    const g = ground(-32, -32);
    physics.world.step();
    const { s, w, run } = hero();
    const go = (move) => {
      const a = s.at.slice();
      run(10, () => ({ move }));
      return Math.hypot(s.at[0] - a[0], s.at[2] - a[2]);
    };
    expect(go([1, 0])).toBeCloseTo(4.725 / 2, 1);
    expect(go([-1, 0])).toBeCloseTo((4.725 * 0.89) / 2, 1);
    w.dispose();
    physics.remove(g);
  });

  it('jumps on the hero’s own arc and lands on the body’s ground, never on the grid’s', () => {
    const g = ground(-32, -32);
    physics.world.step();
    const { s, w, run } = hero();
    const floor = s.at[1];
    let top = 0;
    run(40, (i) => {
      top = Math.max(top, s.at[1] - floor);
      return { jump: i === 0 };
    });
    expect(top).toBeGreaterThan(3);
    expect(top).toBeLessThan(5);
    expect(s.hero.air).toBe(null);
    expect(s.at[1]).toBeCloseTo(floor, 1);
    w.dispose();
    physics.remove(g);
  });

  it('rushes on the body: Luke’s dash carries him about 5 m and stops at a wall the grid knows nothing of', () => {
    const g = ground(-32, -32);
    physics.world.step();
    const { s, w, run } = hero();
    const from = toPackFrame(PACK, s.at);
    run(30, (i) => ({ aim: fromPackFrame(PACK, [40, 1.4, 0]), ability: i === 0 ? 3 : 0 }));
    const p = toPackFrame(PACK, s.at);
    expect(p[0] - from[0]).toBeGreaterThan(4);
    expect(Math.abs(p[1])).toBeLessThan(0.1);
    w.dispose();
    const wall = physics.add({ type: 'fixed', position: [2, 1, 0], group: 'object', colliders: [{ shape: 'cuboid', args: [0.1, 1, 5] }] });
    physics.world.step();
    const b = hero();
    b.run(30, (i) => ({ aim: fromPackFrame(PACK, [40, 1.4, 0]), ability: i === 0 ? 3 : 0 }));
    expect(toPackFrame(PACK, b.s.at)[0]).toBeLessThan(2 - 0.1 - ROW.radius + 0.05);
    b.w.dispose();
    physics.remove(wall);
    physics.remove(g);
  });
});
