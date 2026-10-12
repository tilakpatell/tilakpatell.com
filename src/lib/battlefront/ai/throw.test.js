import { describe, expect, it } from 'vitest';
import { seeded } from '../../seeded.js';
import { aiOf, classOf, loadRulebook, weaponOf } from '../rulebook.js';
import { newSoldier } from '../soldier.js';
import { field } from '../fixtures/field.js';
import { buildNav } from '../nav.js';
import { addPlayer, createSim, step } from '../sim.js';
import { createKit } from '../kit.js';
import { GRENADES } from '../grenades.js';
import { abilitiesFor, pressAbility, skirmishRole } from './skirmish.js';
import { AUTOPLAYER, DISPERSION, RANGE, TIME, TOKENS, arcClear, createTokens, disperse, flightTime, grenadeGone, grenadeOut, planThrow, pressesAbility, solveThrow, takeToken, tokenFree, tokensFor } from './throw.js';

const rb = loadRulebook();
const ai = aiOf(rb);
const seen = (dist, visible = true) => ({ id: 'e', at: { x: 0, y: 0, z: dist }, visible, confidence: 1, hostile: true });
function bot(cls, kit, { team = 2, seed = 3, id = cls } = {}) {
  const row = classOf(rb, `d-orig-${cls}`);
  const s = newSoldier(row, { id, team, at: [0, 0, 0], weapon: weaponOf(rb, row.weapon), rand: seeded(1), abilities: abilitiesFor(rb, row) });
  s.kit = kit;
  return { s, rand: seeded(seed), role: skirmishRole(row), skirmish: ai.skirmish };
}

describe('the bots’ grenade (finding 34 §4)', () => {
  it('solves the parabola for 0.5 s at 10 m to 2 s at 50 m: 25 m/s forward and 9.8 up at the far end', () => {
    expect(RANGE).toEqual([10, 50]);
    expect(TIME).toEqual([0.5, 2]);
    expect(flightTime(10)).toBe(0.5);
    expect(flightTime(30)).toBeCloseTo(1.25, 9);
    expect(flightTime(50)).toBe(2);
    const far = solveThrow([0, 1.5, 0], [0, 1.5, 50]);
    expect(far.time).toBe(2);
    expect(far.vel[2]).toBeCloseTo(25, 9);
    expect(far.vel[1]).toBeCloseTo(9.8, 9);
    const near = solveThrow([0, 1.5, 0], [0, 0, 10]);
    expect(near.vel[2]).toBeCloseTo(20, 9);
    // (it lands on the point: the fall over the flight)
    expect(1.5 + near.vel[1] * 0.5 - 0.5 * 9.8 * 0.25).toBeCloseTo(0, 9);
    expect(solveThrow([0, 0, 0], [0, 0, 9])).toBe(null);
    expect(solveThrow([0, 0, 0], [0, 0, 51])).toBe(null);
  });

  it('puts the aim point off by 0.5 m at 10 m to 2 m at 50 m', () => {
    expect(DISPERSION).toEqual({ min: 0.5, max: 2 });
    const rand = seeded(7);
    for (const [dist, most] of [[10, 0.5], [30, 1.25], [50, 2]]) {
      let farthest = 0;
      for (let i = 0; i < 200; i++) {
        const p = disperse([0, 0, dist], dist, rand);
        const across = Math.hypot(p[0], p[2] - dist);
        expect(across).toBeLessThanOrEqual(most + 1e-9);
        expect(Math.abs(p[1])).toBeLessThanOrEqual(most + 1e-9);
        farthest = Math.max(farthest, across);
      }
      expect(farthest).toBeGreaterThan(most * 0.8);
    }
  });

  it('refuses an arc a wall or a rise stands in, and takes one that clears it', () => {
    const { vel, time } = solveThrow([0, 1.5, 0], [0, 0, 30]);
    const flat = () => 0;
    expect(arcClear([0, 1.5, 0], vel, { heightAt: flat, time })).toBe(true);
    // a wall 20 m high halfway
    const wall = (a, b) => (a[2] < 15 && b[2] >= 15 && a[1] < 20 ? { t: 0.5, solid: 1 } : null);
    expect(arcClear([0, 1.5, 0], vel, { heightAt: flat, solid: wall, time })).toBe(false);
    // a ridge higher than the arc
    const ridge = (x, z) => (z > 12 && z < 18 ? 12 : 0);
    expect(arcClear([0, 1.5, 0], vel, { heightAt: ridge, time })).toBe(false);
    // a low one it flies over (the arc is 2.5 m up there)
    const low = (x, z) => (z > 12 && z < 18 ? 1.5 : 0);
    expect(arcClear([0, 1.5, 0], vel, { heightAt: low, time })).toBe(true);
  });

  it('rations a team to one grenade in the air and one every 12 to 24 s', () => {
    expect(TOKENS).toMatchObject({ default: { min: 12, max: 24 }, rookie: { min: 24, max: 48 }, expert: { min: 7, max: 14 }, simultaneous: 1 });
    expect(tokensFor('multiplayer:expert')).toBe(TOKENS.expert);
    expect(tokensFor('simultaneous')).toBe(TOKENS.default);
    expect(tokensFor(null)).toBe(TOKENS.default);
    const tokens = createTokens();
    const rand = seeded(5);
    expect(tokenFree(tokens, 2, 0)).toBe(true);
    takeToken(tokens, 2, 0, rand);
    expect(tokens[2].nextAt).toBeGreaterThanOrEqual(12);
    expect(tokens[2].nextAt).toBeLessThanOrEqual(24);
    expect(tokenFree(tokens, 2, 11.9)).toBe(false);
    expect(tokenFree(tokens, 1, 1)).toBe(true);
    expect(tokenFree(tokens, 2, 24.1)).toBe(true);
    // (one still in the air holds the token whatever the clock)
    grenadeOut(tokens, 2);
    expect(tokenFree(tokens, 2, 100)).toBe(false);
    grenadeGone(tokens, 2);
    expect(tokenFree(tokens, 2, 100)).toBe(true);
    grenadeGone(tokens, 2);
    expect(tokens[2].air).toBe(0);
  });

  it('plans a throw at a target 10 to 50 m off with the token free, and none otherwise', () => {
    const tokens = createTokens();
    const base = { from: [0, 1.5, 0], now: 0, rand: seeded(2), team: 2, tokens, heightAt: () => 0 };
    expect(planThrow({ ...base, target: [0, 0, 5] })).toBe(null);
    expect(planThrow({ ...base, target: [0, 0, 60] })).toBe(null);
    const plan = planThrow({ ...base, target: [0, 0, 30] });
    expect(plan.time).toBeGreaterThan(1.1);
    expect(plan.time).toBeLessThan(1.4);
    expect(Math.hypot(plan.to[0], plan.to[2] - 30)).toBeLessThanOrEqual(1.25 + 1e-9);
    // (a plan takes no token: the press does)
    expect(tokenFree(tokens, 2, 0)).toBe(true);
    takeToken(tokens, 2, 0, base.rand);
    expect(planThrow({ ...base, target: [0, 0, 30], now: 5 })).toBe(null);
  });

  it('lets an AutoPlayer press the officer’s turret alone', () => {
    expect(AUTOPLAYER).toMatchObject({ Grenade: false, Sentry: false, Shield: false, Turret: true });
    for (const logic of ['Grenade', 'Sentry', 'Shield', 'Battle_Command', 'Infiltration02', 'ScanPistol']) {
      expect(pressesAbility(logic, { autoPlayer: true })).toBe(false);
      expect(pressesAbility(logic, { autoPlayer: false })).toBe(true);
    }
    expect(pressesAbility('Turret', { autoPlayer: true })).toBe(true);
    const kit = createKit();
    const heavy = bot('heavy', kit);
    expect(pressAbility(heavy, { target: seen(20), now: 10, autoPlayer: true })).toBe(null);
    heavy.s.hp = heavy.s.hpMax * 0.3;
    expect(pressAbility(heavy, { target: seen(20), now: 20, autoPlayer: true })).toBe(null);
    const officer = bot('officer', kit);
    expect(pressAbility(officer, { target: seen(20), now: 10, autoPlayer: true })?.id).toBe('DefaultAbility_Officer_BlasterTurret');
  });

  it('a Skirmish bot throws at the last known position with its team’s token, and its side holds the next for 12 s', () => {
    const kit = createKit();
    const a = bot('assault', kit, { id: 'a' });
    const first = pressAbility(a, { target: seen(30, true), now: 10 });
    expect(first?.id).toBe('DefaultAbility_Assault_ThermalDetonator');
    expect(a.s.throwPlan.time).toBeGreaterThan(1.1);
    expect(Math.hypot(a.s.throwPlan.to[0], a.s.throwPlan.to[2] - 30)).toBeLessThanOrEqual(1.25 + 1e-9);
    expect(kit.tokens[2].nextAt).toBeGreaterThanOrEqual(22);
    // (a second of the side, a moment on: its grenade waits; it presses another ability or nothing)
    const b = bot('assault', kit, { id: 'b', seed: 9 });
    expect(pressAbility(b, { target: seen(30), now: 11 })?.id).not.toBe('DefaultAbility_Assault_ThermalDetonator');
    expect(b.s.throwPlan ?? null).toBe(null);
    // (too near and too far: none)
    const c = bot('assault', createKit(), { id: 'c' });
    c.s.abilities.list[2].bar = c.s.abilities.list[3].bar = 0;
    expect(pressAbility(c, { target: seen(6), now: 10 })).toBe(null);
    expect(pressAbility(c, { target: seen(55), now: 20 })).toBe(null);
  });

  it('a bot’s grenade in the battle is the AI’s: 100 against the player’s 200, out of the team’s one', () => {
    expect(GRENADES.botThermal).toMatchObject({ damage: 100, inner: 1, radius: 5 });
    expect(GRENADES.thermal).toMatchObject({ damage: 200, inner: 2, radius: 6 });
    const sim = createSim({ rulebook: rb, nav: buildNav(field()), seed: 4 });
    const id = addPlayer(sim, { team: 2, classId: 'd-orig-heavy', at: [0, 0, -40], yaw: 0 });
    const s = sim.entities.get(id);
    sim.brains.brains.clear();
    s.bot = true;
    s.throwPlan = planThrow({ from: [0, 1.5, -40], target: [0, 0, -15], now: 0, rand: sim.rand, team: 2, tokens: sim.kit.tokens, heightAt: () => 0 });
    const ev = [];
    for (let i = 0; i < 100; i++) ev.push(...step(sim, [{ id, move: [0, 0], ability: i === 0 ? 1 : 0 }]));
    // (a heavy's impact grenade in a bot's hand is the AI's detonator all the same)
    expect(ev.find((e) => e.type === 'throw').kind).toBe('botThermal');
    const boom = ev.find((e) => e.type === 'explosion');
    expect(Math.hypot(boom.at[0], boom.at[2] + 15)).toBeLessThan(6);
    expect(sim.kit.tokens[2].air).toBe(0);
  });
});
