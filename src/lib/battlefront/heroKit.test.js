// The heroes on the sim: their kit, the saber's chain and block, the jump,
// and their abilities with the records' numbers.
import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { buildNav } from './nav.js';
import { field } from './fixtures/field.js';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { addPlayer, createSim, deploy, step, view } from './sim.js';
import { earn } from './battlePoints.js';
import { slotsOf } from './kit.js';
import { HERO_KIT, heroAbilities, heroClass } from './hero.js';

const rb = loadRulebook();
const nav = buildNav(field());
// (a flat stretch of the field, clear of its wall, crate and hill)
const AT = [-40, 0, -40];
const fresh = () => createSim({ rulebook: rb, nav, seed: 7 });
const run = (sim, n, input = () => []) => {
  const ev = [];
  for (let i = 0; i < n; i++) ev.push(...step(sim, input(i)));
  return ev;
};
const trooper = (sim, at, yaw = 0) => sim.entities.get(addPlayer(sim, { team: 1, classId: 'l-orig-assault', at, yaw }));

describe('a hero deploys on its own kit', () => {
  it('buys Luke at 4,000 Battle Points in Galactic Assault, with his health, no gun and his three abilities', () => {
    const sim = createSim({ rulebook: rb, nav: hothFlatNav(rb), seed: 3, bots: { 1: 0, 2: 0 }, mode: 'galacticAssault' });
    const me = addPlayer(sim, { team: 1, classId: 'l-orig-assault', at: [0, 0, -1300] });
    sim.entities.delete(me);
    sim.deploying.set(me, { id: me, team: 1, bot: false, since: sim.time });
    expect(deploy(sim, me, { kind: 'hero', id: 'luke' })).toEqual({ ok: false, why: 'points' });
    earn(sim.bp, me, 'kill', 40);
    expect(deploy(sim, me, { kind: 'hero', id: 'luke' })).toEqual({ ok: true });
    const s = sim.entities.get(me);
    expect(s).toMatchObject({ unit: 'hero', unitId: 'luke', hp: 750, gun: null });
    expect(s.hero.saber).toBeTruthy();
    expect(slotsOf(s).map((a) => a.id)).toEqual(['Ability_Luke_ForcePush', 'Ability_Luke_ForceRepulse', 'Ability_Luke_Dash']);
    const e = view(sim).entities.find((x) => x.id === me);
    expect(e).toMatchObject({ unit: 'hero', unitId: 'luke', weapon: null });
  });

  it('gives a blaster hero its own weapon, and every hero its health, body and drive from the records', () => {
    const base = rb.classes['l-orig-assault'];
    expect(heroClass(rb, 'hansolo', base)).toMatchObject({ weapon: 'hansolo', health: 650, height: 1.7, drive: { speed: 4.25 } });
    expect(heroClass(rb, 'bobafett', base).weapon).toBe('boba');
    expect(heroClass(rb, 'bossk', base)).toMatchObject({ weapon: 'v10', drive: { speed: 4.35 } });
    expect(heroClass(rb, 'darthvader', base)).toMatchObject({ weapon: null, health: 800, height: 1.95, drive: { speed: 4.25 } });
    expect(heroClass(rb, 'yoda', base)).toMatchObject({ height: 1.2, jump: { height: 1.6 } });
    expect(heroClass(rb, 'luke', base)).toMatchObject({ drive: { speed: 4.725, back: 0.89, strafe: 0.935, sprint: 1.7 } });
    for (const id of Object.keys(HERO_KIT.heroes)) {
      const rows = heroAbilities(rb, id);
      expect(rows[0].id, id).toBe('Ability_Evade_CharacterState');
      expect(rows.slice(1).map((r) => r.slot), id).toEqual([1, 2, 3]);
      for (const r of rows.slice(1)) expect(r.hero.kind, `${id} ${r.id}`).toBeTruthy();
    }
  });

  it('walks at the saber drive’s 4.725 m/s, sprints at ×1.7 and backs off at 0.89', () => {
    const sim = fresh();
    const id = addPlayer(sim, { team: 2, hero: 'luke', at: AT });
    const s = sim.entities.get(id);
    const go = (move, sprint = false) => {
      const a = s.at.slice();
      run(sim, 20, () => [{ id, move, look: 0, sprint }]);
      return Math.hypot(s.at[0] - a[0], s.at[2] - a[2]);
    };
    expect(go([0, 1])).toBeCloseTo(4.725, 1);
    expect(go([0, 1], true)).toBeCloseTo(4.725 * 1.7, 1);
    expect(go([0, -1])).toBeCloseTo(4.725 * 0.89, 1);
  });
});

describe('the saber', () => {
  it('strikes a trooper ahead in the chain: 130 lands in the kill window, the second strike from 0.5 s', () => {
    const sim = fresh();
    const id = addPlayer(sim, { team: 2, hero: 'luke', at: AT });
    const t = trooper(sim, [AT[0], 0, AT[2] + 2.5], 0);
    const hits = run(sim, 40, () => [{ id, move: [0, 0], look: 0, fire: true }]).filter((e) => e.type === 'hit' && e.target === t.id);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0]).toMatchObject({ part: 'saber', damage: 160 });
    // (struck from behind: the trooper faces away, +30)
    expect(hits[0].t).toBeGreaterThanOrEqual(0.42);
    expect(hits[0].t).toBeLessThan(0.75);
    expect(t.alive).toBe(false);
  });

  it('holds its block: a bolt from the front turned back at the shooter, nothing landing on the hero', () => {
    const sim = fresh();
    const id = addPlayer(sim, { team: 2, hero: 'luke', at: AT });
    const s = sim.entities.get(id);
    const t = trooper(sim, [AT[0], 0, AT[2] + 15], Math.PI);
    const ev = run(sim, 30, () => [
      { id, move: [0, 0], look: 0, aiming: true },
      { id: t.id, move: [0, 0], look: Math.PI, fire: true, aim: [s.at[0], s.at[1] + 1.2, s.at[2]] },
    ]);
    expect(s.hp).toBe(750);
    expect(ev.filter((e) => e.type === 'deflect' && e.by === id).length).toBeGreaterThan(0);
    expect(s.hero.saber.state.stamina).toBeLessThan(100);
  });

  it('jumps on the Force jump’s eased rise and lands again', () => {
    const sim = fresh();
    const id = addPlayer(sim, { team: 2, hero: 'luke', at: AT });
    const s = sim.entities.get(id);
    const ground = s.at[1];
    let top = 0;
    run(sim, 40, (i) => {
      top = Math.max(top, s.at[1] - ground);
      return [{ id, move: [0, 0], look: 0, jump: i === 0 }];
    });
    expect(top).toBeGreaterThan(3);
    expect(top).toBeLessThan(5);
    expect(s.hero.air).toBe(null);
    expect(s.at[1]).toBeCloseTo(ground, 5);
  });
});

describe('the abilities, on the records’ numbers', () => {
  it('Luke’s push: the troopers in its 30° cone within 12 m take 150 and are thrown back', () => {
    const sim = fresh();
    const id = addPlayer(sim, { team: 2, hero: 'luke', at: AT });
    const near = trooper(sim, [AT[0], 0, AT[2] + 6], Math.PI);
    const wide = trooper(sim, [AT[0] + 8, 0, AT[2] + 3], Math.PI);
    near.hp = near.hpMax = 1000;
    const was = near.at[2];
    const ev = run(sim, 30, (i) => [{ id, move: [0, 0], look: 0, aim: [AT[0], 1.4, AT[2] + 50], ability: i === 0 ? 1 : 0 }]);
    const hit = ev.find((e) => e.type === 'hit' && e.target === near.id);
    expect(hit).toMatchObject({ part: 'force', damage: 150 });
    expect(hit.t).toBeGreaterThanOrEqual(0.5);
    expect(near.at[2] - was).toBeGreaterThan(5);
    expect(ev.find((e) => e.type === 'hit' && e.target === wide.id)).toBeUndefined();
  });

  it('Vader’s choke holds one in its cone and takes 86 a second for 1.5 s', () => {
    const sim = fresh();
    const id = addPlayer(sim, { team: 2, hero: 'darthvader', at: AT });
    const t = trooper(sim, [AT[0], 0, AT[2] + 8], Math.PI);
    t.hp = t.hpMax = 1000;
    t.cls = { ...t.cls, regen: null };
    run(sim, 50, (i) => [{ id, move: [0, 0], look: 0, aim: [AT[0], 1.4, AT[2] + 50], ability: i === 0 ? 3 : 0 }]);
    expect(1000 - t.hp).toBeCloseTo(86 * 1.5, -1);
  });

  it('Luke’s rush carries him into the trooper ahead for 100', () => {
    const sim = fresh();
    const id = addPlayer(sim, { team: 2, hero: 'luke', at: AT });
    const t = trooper(sim, [AT[0], 0, AT[2] + 7], Math.PI);
    t.hp = t.hpMax = 1000;
    const ev = run(sim, 50, (i) => [{ id, move: [0, 0], look: 0, aim: [AT[0], 1.4, AT[2] + 50], ability: i === 0 ? 3 : 0 }]);
    expect(ev.find((e) => e.type === 'hit' && e.target === t.id)).toMatchObject({ damage: 100 });
  });

  it('Han throws his detonator, which bursts where it rests', () => {
    const sim = fresh();
    const id = addPlayer(sim, { team: 2, hero: 'hansolo', at: AT });
    const ev = run(sim, 80, (i) => [{ id, move: [0, 0], look: 0, aim: [AT[0], 1.4, AT[2] + 20], ability: i === 0 ? 1 : 0 }]);
    expect(ev.find((e) => e.type === 'throw' && e.by === id)).toBeTruthy();
    expect(ev.find((e) => e.type === 'explosion' && e.by === id)).toBeTruthy();
  });

  it('Vader’s throw flies out and back, cutting what it passes', () => {
    const sim = fresh();
    const id = addPlayer(sim, { team: 2, hero: 'darthvader', at: AT });
    const t = trooper(sim, [AT[0], 0, AT[2] + 9], Math.PI);
    t.hp = t.hpMax = 1000;
    const ev = run(sim, 60, (i) => [{ id, move: [0, 0], look: 0, aim: [AT[0], 1.4, AT[2] + 50], ability: i === 0 ? 1 : 0 }]);
    expect(ev.find((e) => e.type === 'hit' && e.target === t.id)).toMatchObject({ part: 'saber', damage: 130 });
    expect(sim.entities.get(id).hero.thrown).toBe(null);
  });
});
