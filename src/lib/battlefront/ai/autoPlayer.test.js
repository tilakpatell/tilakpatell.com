import { describe, expect, it } from 'vitest';
import { autoPlayerOf, classOf, loadRulebook, weaponOf } from '../rulebook.js';
import { buildNav } from '../nav.js';
import { newSoldier } from '../soldier.js';
import { difficultyFor } from './difficulty.js';
import { DEFEND_RADIUS, FOLLOW_RADIUS, act, createAutoBrain, noiseFor, reactionFor, think } from './autoPlayer.js';
import { aiOf } from '../rulebook.js';

const rb = loadRulebook();
const ap = autoPlayerOf(rb);
const cls = classOf(rb, 'd-orig-assault');
const soldier = (id, at, team = 2) => newSoldier(cls, { id, team, at, weapon: weaponOf(rb, cls.weapon) });
const belief = (id, at, visible = true, vel = { x: 0, y: 0, z: 0 }) => ({ id, at: { x: at[0], y: at[1], z: at[2] }, vel, hostile: true, visible, confidence: 1, seenAt: 0 });
const world = (over = {}) => ({ nav: null, lineClear: () => true, shields: () => false, squad: null, leaderAt: null, objective: null, task: null, enemies: [], others: [], taken: new Map(), muzzle: null, shoot: () => true, who: () => null, ...over });

describe('the AutoPlayer’s aim and trigger', () => {
  it('reads the server rows: the weapon’s noise × the difficulty’s scale × the side’s factor, and the line-of-fire reaction', () => {
    expect(noiseFor(ap, { family: 'rifle' })).toBe(1.5 * 2);
    expect(noiseFor(ap, { family: 'rifle', difficulty: difficultyFor('rookie', aiOf(rb)) })).toBeCloseTo(1.5 * 7 * 1.2, 9);
    expect(noiseFor(ap, { family: 'rifle', difficulty: difficultyFor('normal', aiOf(rb)) })).toBe(1.5 * 3);
    expect(noiseFor(ap, { family: 'rifle', difficulty: difficultyFor('expert', aiOf(rb)) })).toBeCloseTo(1.5 * 2 * 0.9, 9);
    expect(noiseFor(ap, { family: 'rifle', difficulty: difficultyFor('expert', aiOf(rb)), side: 'friendlies' })).toBe(1.5 * 2);
    expect(noiseFor(ap, { family: 'heavy' })).toBe(1.5 * 2);
    expect(noiseFor(ap, { family: 'sniper' })).toBe(1 * 2);
    expect(noiseFor(ap, { family: 'rifle', mode: 'coop' })).toBeCloseTo(2.5 * 2.3, 9);
    expect(reactionFor(ap)).toBe(0.05);
    expect(reactionFor(ap, difficultyFor('rookie', aiOf(rb)))).toBe(0.1);
    expect(reactionFor(ap, difficultyFor('expert', aiOf(rb)))).toBe(0.025);
    expect(ap.tracker.fov).toBe(140);
    expect(ap.lof).toMatchObject({ timeout: 1.5, prediction: 0.15 });
  });

  it('fires the reaction after its line of fire clears, and keeps the target the timeout after it closes', () => {
    const s = soldier('b', [0, 0, 0]);
    const b = createAutoBrain(s, { ap, rand: () => 0.5 });
    expect(b.noise).toBe(3);
    b.me.beliefs = { e: belief('e', [0, 1, 20]) };
    let w = world();
    expect(think(b, w, 0).fire).toBe(false);
    expect(think(b, w, 0.04).fire).toBe(false);
    const i = think(b, w, 0.05);
    expect(i.fire).toBe(true);
    expect(i.target).toBe('e');
    expect(i.mode).toBe('attack');
    // the line closes: still held through the timeout, then dropped
    w = world({ lineClear: () => false });
    expect(think(b, w, 1).fire).toBe(true);
    b.me.beliefs.e.visible = false;
    expect(think(b, w, 1.2).target).toBe('e');
    expect(think(b, w, 1.2 + 1.5 + 0.1).target).toBe(null);
  });

  it('aims at the target a prediction ahead, with a noise re-drawn every lap, inside its degrees', () => {
    const s = soldier('b', [0, 0, 0]);
    const draws = [0.5, 0.5, 1, 0, 0, 1];
    let k = 0;
    const b = createAutoBrain(s, { ap, rand: () => draws[k++ % draws.length] });
    b.me.beliefs = { e: belief('e', [0, 1.2, 20], true, { x: 10, y: 0, z: 0 }) };
    const i1 = think(b, world(), 0);
    // (the first draws are 0.5: no offset; the target moved 0.15 s × 10 m/s ahead in X)
    expect(i1.aim[0]).toBeCloseTo(1.5, 6);
    expect(i1.aim[2]).toBeCloseTo(20, 6);
    const i2 = think(b, world(), 0.1);
    expect(i2.aim).toEqual(i1.aim);
    const i3 = think(b, world(), 0.25);
    expect(i3.aim).not.toEqual(i1.aim);
    const yaw = Math.atan2(i3.aim[0] - i1.aim[0] + 1.5, 20) - Math.atan2(1.5, 20);
    expect(Math.abs(yaw)).toBeLessThanOrEqual((b.noise * Math.PI) / 180 + 1e-6);
  });

  it('goes to its task, holds inside its radius, follows the leader otherwise, and interacts with nobody near', () => {
    const s = soldier('b', [0, 0, 0]);
    const b = createAutoBrain(s, { ap, rand: () => 0.5 });
    const task = { at: [100, 0], spot: [100, 0], radius: 5, interact: false, reach: 3, role: 'take' };
    const i = think(b, world({ task }), 0);
    expect(i.mode).toBe('objective');
    expect(i.goal).toEqual([100, 0]);
    expect(i.sprint).toBe(true);
    // on the task: a spot inside its radius
    s.at = [100, 0, 0];
    const j = think(b, world({ task }), 1);
    expect(Math.hypot(j.goal[0] - 100, j.goal[1])).toBeLessThanOrEqual(task.radius + 1e-9);
    // an interact task with no enemy believed near: the interaction held
    const arm = { ...task, interact: true };
    const k = think(b, world({ task: arm }), 2);
    expect(k.mode).toBe('interact');
    expect(k.interact).toBe(true);
    // no task: the squad's leader past the follow radius, else the team's objective about the defend radius
    s.at = [0, 0, 0];
    expect(think(b, world({ squad: { leader: 'L' }, leaderAt: [FOLLOW_RADIUS + 3, 0] }), 3).goal).toEqual([FOLLOW_RADIUS + 3, 0]);
    const o = think(b, world({ objective: [50, 50] }), 4);
    expect(Math.hypot(o.goal[0] - 50, o.goal[1] - 50)).toBeLessThanOrEqual(DEFEND_RADIUS + 1e-9);
  });

  it('strafes in a fight, inverting the side on its window, and may dodge-roll a hit', () => {
    const s = soldier('b', [0, 0, 0]);
    const b = createAutoBrain(s, { ap, rand: () => 0.1 });
    b.me.beliefs = { e: belief('e', [0, 1, 20]) };
    const i = think(b, world(), 0);
    expect(Math.abs(i.goal[0])).toBeCloseTo(4, 6);
    expect(b.strafeAt).toBeCloseTo(1.5 + 0.1 * 2, 6);
    expect(i.roll).toBe(null);
    s.lastHurt = 0.5;
    const j = think(b, world(), 0.6);
    expect(j.roll).toEqual([0, -20]);
    expect(b.dodge).toBe(0.2);
    // a bot that drew above the chance keeps its feet
    const c = createAutoBrain(soldier('c', [0, 0, 0]), { ap, rand: () => 0.9 });
    c.s.lastHurt = 0.5;
    expect(think(c, world(), 0.6).roll).toBe(null);
  });

  it('acts on the intent: moves on the site’s navgrid, looks down its aim, shoots when told', () => {
    const nav = buildNav({ heightAt: () => 0, bounds: { min: [-50, -50], max: [50, 50] }, cell: 2, solids: [], cover: aiOf(rb).cover.constants });
    const s = soldier('b', [0, 0, 0]);
    const b = createAutoBrain(s, { ap, rand: () => 0.5 });
    let shots = 0;
    const w = world({ nav, shoot: () => (shots++, true) });
    act(b, { mode: 'objective', goal: [10, 0], stance: 'stand', fire: false, aim: null, sprint: true }, s, 0.05, w, 0);
    expect(s.at[0]).toBeGreaterThan(0);
    expect(s.sprint).toBe(true);
    act(b, { mode: 'attack', goal: null, stance: 'stand', fire: true, aim: [0, 1, 30], sprint: false }, s, 0.05, w, 0.05);
    expect(shots).toBe(1);
    expect(Math.abs(s.yaw)).toBeLessThan(0.1);
  });
});
