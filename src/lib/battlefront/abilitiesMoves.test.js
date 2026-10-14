import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { field } from './fixtures/field.js';
import { buildNav } from './nav.js';
import { addPlayer, createSim, step } from './sim.js';
import { createAbilities, state } from './abilities.js';
import { abilitiesFor } from './ai/skirmish.js';
import { kitOfUnit } from './abilitiesUnit.js';
import { JUMP_PACK, RUSH, STRIKE } from './abilitiesMoves.js';
import { weaponOf } from './rulebook.js';
import { createGun } from './weapons.js';

const rb = loadRulebook();
const SLOT = { left: 1, middle: 2, right: 3 };
const idle = (id) => ({ id, move: [0, 0] });
const run = (sim, inputs, n) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(...step(sim, inputs(i)));
  return out;
};

// a hero or a reinforcement (`unit`) at the origin facing +z, and a trooper `gap` m in front of it
function duel(unitId, { gap = 6, kind = 'hero', foe = 'd-orig-assault', team = 1 } = {}) {
  const sim = createSim({ rulebook: rb, nav: buildNav(field()), seed: 3 });
  const me = addPlayer(sim, { team, classId: 'l-orig-assault', at: [0, 0, -40], yaw: 0 });
  const them = addPlayer(sim, { team: 3 - team, classId: foe, at: [0, 0, -40 + gap], yaw: Math.PI });
  const s = sim.entities.get(me);
  const t = sim.entities.get(them);
  for (const e of [s, t]) e.bot = false;
  sim.brains.brains.clear();
  const row = kind === 'hero' ? rb.heroes[unitId] : rb.reinforcements[unitId];
  Object.assign(s, { unit: kind, unitId, hp: row.health, hpMax: row.health });
  s.abilities = createAbilities(abilitiesFor(rb, { abilities: row.abilities }));
  const primary = kitOfUnit(unitId).primary;
  s.gun = primary ? createGun(weaponOf(rb, primary), { rand: sim.rand }) : null;
  return { sim, s, t, me, them };
}
const press = (id, slot, held = slot) => (i) => [{ id, move: [0, 0], ability: i === 0 ? slot : 0, abilityHeld: held }];

describe('the heroes’ and reinforcements’ abilities, played', () => {
  it('pushes a trooper in front of Luke off his feet for 150, once the key is held through the 0.5 s wind-up', () => {
    const { sim, s, t, me } = duel('luke', { gap: 6 });
    const before = t.at[2];
    run(sim, press(me, SLOT.left), 14);
    expect(t.hpMax - t.hp).toBeCloseTo(150, 6);
    expect(t.alive).toBe(true === t.hp > 0);
    expect(state(s.abilities, SLOT.left)).toBe('recharge');
    const other = duel('luke', { gap: 6 });
    other.t.hp = other.t.hpMax = 400;
    run(other.sim, press(other.me, SLOT.left), 14);
    // (shoved away from Luke, and down for the request's second)
    expect(other.t.at[2]).toBeGreaterThan(before + 1);
    expect(other.t.disabledUntil).toBeGreaterThan(other.sim.time);
  });

  it('calls Luke’s push off when the key is let go in its wind-up', () => {
    const { sim, s, t, me } = duel('luke', { gap: 6 });
    run(sim, (i) => [{ id: me, move: [0, 0], ability: i === 0 ? SLOT.left : 0, abilityHeld: i < 3 ? SLOT.left : 0 }], 14);
    expect(t.hp).toBe(t.hpMax);
    expect(state(s.abilities, SLOT.left)).toBe('ready');
  });

  it('chokes the one in front of Vader for 1.5 s: held where he stands, 86 a second', () => {
    const { sim, t, me } = duel('darthvader', { gap: 8 });
    t.hp = t.hpMax = 1000;
    run(sim, press(me, SLOT.right), 4);
    expect(t.heldBy).toBe(me);
    const at = [...t.at];
    run(sim, (i) => [idle(me), { id: t.id, move: [0, 1] }], 30);
    expect(Math.hypot(t.at[0] - at[0], t.at[2] - at[2])).toBeLessThan(0.05);
    // (1 up front, then 86 a second in 0.5 s ticks over the 1.5 s grip)
    expect(1000 - t.hp).toBeCloseTo(1 + 86 * 1.5, 6);
    expect(t.heldBy ?? null).toBe(null);
  });

  it('carries Luke forward through his dash, cutting the trooper in his way once', () => {
    const { sim, s, t, me } = duel('luke', { gap: 5 });
    t.hp = t.hpMax = 400;
    const z = s.at[2];
    run(sim, press(me, SLOT.right), 40);
    expect(s.at[2] - z).toBeGreaterThan(RUSH.speed * 0.5);
    expect(t.hpMax - t.hp).toBeCloseTo(100, 6);
  });

  it('cuts with a saber hero’s trigger: 130 at the strike’s window, one strike each half second', () => {
    const { sim, t, me } = duel('luke', { gap: 2.5 });
    t.hp = t.hpMax = 1000;
    const ev = run(sim, () => [{ id: me, move: [0, 0], fire: true, aim: [t.at[0], t.at[1] + 1.2, t.at[2]] }], 20);
    const hits = ev.filter((e) => e.type === 'hit' && e.by === me);
    expect(hits.length).toBe(Math.floor((20 * 0.05 - STRIKE.hit) / STRIKE.every) + 1);
    expect(hits[0].damage).toBeCloseTo(130, 6);
  });

  it('strikes with the Emperor’s lightning, 14 every tenth of a second, on the one in his cone', () => {
    const { sim, t, me } = duel('emperor', { gap: 8 });
    t.hp = t.hpMax = 1000;
    run(sim, () => [{ id: me, move: [0, 0], fire: true, aim: [t.at[0], t.at[1] + 1.2, t.at[2]] }], 10);
    expect(1000 - t.hp).toBeCloseTo(14 * 5, 6);
    expect(t.disabledUntil).toBeGreaterThan(sim.time);
  });

  it('gives Vader his rage: 0.92 of the damage and a 200 shield while it lasts', () => {
    const { sim, s, me } = duel('darthvader', { gap: 30 });
    run(sim, press(me, SLOT.middle), 3);
    expect(s.over?.hp).toBe(200);
    expect(s.stack.entries.find((e) => e.property === 'ArmorMultiplier')?.value).toBe(0.92);
    run(sim, () => [idle(me)], 220);
    expect(s.stack.entries.find((e) => e.property === 'ArmorMultiplier')).toBeUndefined();
  });

  it('lifts a jump trooper on its pack’s thrust and sets it down again', () => {
    const { sim, s, me } = duel('JumpTrooper', { gap: 40, kind: 'reinforcement', team: 2, foe: 'l-orig-assault' });
    const p = JUMP_PACK.Ability_Special_Shared_JumpPack;
    let top = 0;
    run(sim, (i) => {
      top = Math.max(top, s.at[1]);
      return press(me, SLOT.left)(i);
    }, 60);
    // (thrust 28 for 0.5 s with the gravity off, then −20: up 0.5·28·0.5² + (14²)/(2·20))
    expect(top).toBeGreaterThan(0.5 * p.up * p.accelerate ** 2);
    expect(s.air ?? null).toBe(null);
    expect(s.at[1]).toBeCloseTo(0, 6);
  });

  it('throws Han’s detonite charge, its own projectile, and it blasts', () => {
    const { sim, me } = duel('hansolo', { gap: 15 });
    const ev = run(sim, press(me, SLOT.left), 80);
    expect(ev.some((e) => e.type === 'explosion' && e.kind === 'Ability_HanSolo_DemolitionGrenade')).toBe(true);
  });
});
