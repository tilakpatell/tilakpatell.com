// The sim with Galactic Assault: the fallen wait, deploy on the wave, buy
// what their points allow; out of bounds kills; spawn protection.
import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { buildNav } from './nav.js';
import { field } from './fixtures/field.js';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { createBolts, fire, step as stepBolts } from './bolts.js';
import { OOB_SECONDS, addPlayer, createSim, deploy, step, view } from './sim.js';
import { earn } from './battlePoints.js';
import { TIME_FOR_CORPSE } from './soldier.js';
import { WAVE, isProtected } from './spawn.js';

const rb = loadRulebook();
const hoth = hothFlatNav(rb);
const until = (sim, test, seconds) => {
  for (let i = 0; i < seconds / 0.05 && !test(); i++) step(sim);
  return test();
};
const kill = (sim, s) => {
  s.hp = 1;
  s.lastHurt = sim.time;
  // a bolt from an enemy a metre off
  const by = [...sim.entities.values()].find((e) => e.kind === 'soldier' && e.team !== s.team);
  fire(sim.bolts, { from: [s.at[0], s.at[1] + 1.2, s.at[2] - 1], dir: [0, 0, 1], speed: 700, team: by.team, owner: by.id, weapon: by.weapon, now: sim.time });
  s.safeUntil = -Infinity;
};

describe('the sim in Galactic Assault', () => {
  const sim = createSim({ rulebook: rb, nav: hoth, seed: 3, bots: { 1: 8, 2: 8 }, mode: 'galacticAssault' });

  it('deploys both teams in their first stage’s areas, with the walkers', () => {
    const v = view(sim);
    expect(v.mode.stage.id).toBe('walkers');
    expect(v.teams[1].alive).toBe(8);
    expect([...sim.entities.values()].filter((e) => e.kind === 'walker')).toHaveLength(2);
    const z = (t) => [...sim.entities.values()].filter((e) => e.team === t && e.kind === 'soldier').map((e) => e.at[2]);
    expect(Math.max(...z(2))).toBeGreaterThan(Math.max(...z(1)));
  });

  it('takes a fallen bot off after TimeForCorpse and brings it back on the next wave', () => {
    const s = [...sim.entities.values()].find((e) => e.team === 2 && e.kind === 'soldier');
    kill(sim, s);
    expect(until(sim, () => !s.alive, 1)).toBe(true);
    const t = s.diedAt;
    const tickets = sim.ga.tickets;
    expect(until(sim, () => sim.deploying.has(s.id), TIME_FOR_CORPSE + 0.2)).toBe(true);
    expect(sim.time).toBeLessThanOrEqual(t + TIME_FOR_CORPSE + 0.1);
    expect(sim.ga.tickets).toBeLessThanOrEqual(tickets);
    const next = Math.ceil(sim.time / WAVE) * WAVE;
    expect(until(sim, () => sim.entities.get(s.id)?.alive, WAVE + 1)).toBe(true);
    expect(sim.time).toBeLessThanOrEqual(next + 0.1);
    expect(isProtected(sim.entities.get(s.id), sim.time)).toBe(true);
  });

  it('refuses a player a hero it cannot afford, then deploys it with the points', () => {
    const me = addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [0, 0, -1300] });
    sim.entities.delete(me);
    sim.deploying.set(me, { id: me, team: 1, bot: false, since: sim.time });
    expect(deploy(sim, me, { kind: 'hero', id: 'luke' })).toEqual({ ok: false, why: 'points' });
    earn(sim.bp, me, 'kill', 40);
    expect(deploy(sim, me, { kind: 'hero', id: 'luke' })).toEqual({ ok: true });
    expect(sim.entities.get(me)).toMatchObject({ unit: 'hero', hp: 750 });
  });
});

describe('out of bounds and protection', () => {
  it('kills a soldier 12 s outside its team’s bounds, counting down', () => {
    const nav = buildNav(field());
    const zone = { points: [[-10, -10], [10, -10], [10, 10], [-10, 10]] };
    const sim = createSim({ rulebook: rb, nav, seed: 1, oob: { 1: [zone], 2: [zone] } });
    const id = addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [40, 0, -40] });
    for (let i = 0; i < 40; i++) step(sim);
    expect(view(sim).entities.find((e) => e.id === id).oob).toBeCloseTo(OOB_SECONDS - 2, 0);
    let ev = [];
    for (let i = 0; i < 200; i++) ev = ev.concat(step(sim));
    expect(sim.entities.get(id).alive).toBe(false);
    expect(ev.find((e) => e.type === 'kill')).toMatchObject({ target: id, why: 'oob' });
  });

  it('passes a bolt through a protected body', () => {
    const body = (safe) => ({ id: 't', team: 1, alive: true, safe, at: [0, 0, 10], capsules: [{ part: 'chest', a: [0, 1, 10], b: [0, 1.5, 10], r: 0.3 }] });
    for (const safe of [true, false]) {
      const bolts = createBolts();
      fire(bolts, { from: [0, 1.2, 0], dir: [0, 0, 1], speed: 700, team: 2, owner: 'x' });
      const ev = stepBolts(bolts, 0.05, { bodies: [body(safe)], nav: null });
      expect(ev.some((e) => e.type === 'hit')).toBe(!safe);
    }
  });

  it('ends protection when the protected one fires', () => {
    const sim = createSim({ rulebook: rb, nav: buildNav(field()), seed: 1 });
    const id = addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [0, 0, -40] });
    const s = sim.entities.get(id);
    s.safeUntil = sim.time + 3;
    step(sim, [{ id, fire: true, aim: [0, 1.2, 0] }]);
    expect(isProtected(s, sim.time)).toBe(false);
  });
});

describe('the deploy screen in the view', () => {
  it('opens for a waiting player with the offers and their points', () => {
    const sim = createSim({ rulebook: rb, nav: hoth, seed: 4, bots: { 1: 2, 2: 2 }, mode: 'galacticAssault' });
    sim.deploying.set('p9', { id: 'p9', team: 2, bot: false, since: 0 });
    earn(sim.bp, 'p9', 'kill', 10);
    const d = view(sim, { player: 'p9' }).deploy;
    expect(d).toMatchObject({ open: true, team: 2, points: 1000 });
    expect(d.offers.find((o) => o.kind === 'hero')).toMatchObject({ affordable: false });
    expect(d.offers.find((o) => o.id === 'JumpTrooper')).toMatchObject({ affordable: true, cost: 1000 });
    expect(view(sim).deploy.open).toBe(false);
  });
});
