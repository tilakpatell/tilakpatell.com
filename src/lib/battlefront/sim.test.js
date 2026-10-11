import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { field } from './fixtures/field.js';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { buildNav, walkable } from './nav.js';
import { STEP, addPlayer, createSim, drain, step, view } from './sim.js';

const rb = loadRulebook();
const hoth = hothFlatNav(rb);

describe('the sim', () => {
  it('fills both teams with bots on walkable ground at the front', () => {
    const sim = createSim({ rulebook: rb, nav: hoth, seed: 1, bots: { 1: 4, 2: 4 } });
    const all = [...sim.entities.values()];
    expect(all).toHaveLength(8);
    expect(all.filter((e) => e.team === 1)).toHaveLength(4);
    for (const e of all) expect(walkable(hoth, e.at[0], e.at[2])).toBe(true);
    expect(new Set(all.filter((e) => e.team === 2).map((e) => e.cls.id)).size).toBe(4);
    expect(all.find((e) => e.team === 1).cls.faction).toBe('L');
  });

  it('steps 50 ms at a time', () => {
    const sim = createSim({ rulebook: rb, nav: hoth, seed: 1 });
    step(sim);
    expect(sim.time).toBeCloseTo(STEP, 9);
    step(sim);
    expect(sim.time).toBeCloseTo(2 * STEP, 9);
  });

  it('lets a player shoot a soldier 20 m ahead', () => {
    const sim = createSim({ rulebook: rb, nav: buildNav(field()), seed: 1 });
    const me = addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [0, 0, -40], yaw: 0 });
    const them = addPlayer(sim, { team: 2, classId: 'd-orig-assault', at: [0, 0, -20], yaw: Math.PI });
    const target = sim.entities.get(them);
    let hit = null;
    for (let i = 0; i < 20 && !hit; i++) {
      const ev = step(sim, [{ id: me, fire: true, aim: [target.at[0], target.at[1] + 1.2, target.at[2]] }]);
      hit = ev.find((e) => e.type === 'hit');
    }
    expect(hit).toBeTruthy();
    expect(hit.target).toBe(them);
    expect(target.hp).toBeLessThan(target.hpMax);
    expect(drain(sim).some((e) => e.type === 'shot')).toBe(true);
    expect(sim.events).toHaveLength(0);
  });

  it('gives one battle from one seed', () => {
    const run = (seed) => {
      const sim = createSim({ rulebook: rb, nav: hoth, seed, bots: { 1: 4, 2: 4 } });
      for (let i = 0; i < 600; i++) step(sim);
      return JSON.stringify(sim.events) + JSON.stringify([...sim.entities.values()].map((e) => [e.at, e.hp]));
    };
    expect(run(7)).toBe(run(7));
  });

  it('hands out one view, refreshed', () => {
    const sim = createSim({ rulebook: rb, nav: hoth, seed: 1, bots: { 1: 2, 2: 2 } });
    const a = view(sim);
    step(sim);
    const b = view(sim);
    expect(b).toBe(a);
    expect(b.entities).toHaveLength(4);
    expect(b.teams[1].alive).toBe(2);
    expect(b.time).toBeCloseTo(STEP, 9);
  });

  it('tells a bolt’s kill where the shot went, where it struck and with what; an out-of-bounds kill has none', () => {
    const sim = createSim({ rulebook: rb, nav: buildNav(field()), seed: 1 });
    const me = addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [0, 0, -40], yaw: 0 });
    const them = addPlayer(sim, { team: 2, classId: 'd-orig-assault', at: [0, 0, -20], yaw: Math.PI });
    const target = sim.entities.get(them);
    let kill = null;
    let hit = null;
    for (let i = 0; i < 400 && !kill; i++) {
      // (the gun cools between bursts: a press every other step)
      const ev = step(sim, [{ id: me, fire: i % 2 === 0, aim: [target.at[0], target.at[1] + 1.2, target.at[2]] }]);
      hit ??= ev.find((e) => e.type === 'hit');
      kill = ev.find((e) => e.type === 'kill');
    }
    expect(kill).toBeTruthy();
    expect(kill).toMatchObject({ by: me, target: them, weapon: sim.entities.get(me).gun.row.id });
    expect(Math.hypot(...kill.dir)).toBeCloseTo(1, 6);
    expect(kill.dir[2]).toBeGreaterThan(0.9);
    expect(kill.at).toHaveLength(3);
    expect(kill.at[2]).toBeCloseTo(-20, 0);
    expect(hit.dir).toHaveLength(3);
    expect(hit.at).toHaveLength(3);

    const zone = { points: [[-10, -10], [10, -10], [10, 10], [-10, 10]] };
    const away = createSim({ rulebook: rb, nav: buildNav(field()), seed: 1, oob: { 1: [zone], 2: [zone] } });
    const lost = addPlayer(away, { team: 1, classId: 'l-orig-assault', at: [40, 0, -40] });
    let ev = [];
    for (let i = 0; i < 300; i++) ev = ev.concat(step(away));
    const oob = ev.find((e) => e.type === 'kill' && e.target === lost);
    expect(oob.why).toBe('oob');
    expect(oob.dir).toBeUndefined();
    expect(oob.at).toBeUndefined();
  });
});
