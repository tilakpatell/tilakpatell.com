import { describe, expect, it } from 'vitest';
import { createTokens } from '../../../lib/ai/squad';
import { ENEMY_KINDS, ENEMY_SENSES, buildWorld, newEnemy, newPlayer, segmentClear, stepEnemies } from './rules';
import { ACTIONS, OPTIONS, RETHINK, SHOTS_AT_ONCE, step } from './tactics';

// a yard with one tall wall across it, between the Decepticon and Optimus
const AREA = {
  id: 'yard',
  bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
  spawn: { x: 0, z: 0, yaw: 0 },
  solids: [{ kind: 'box', x: 0, z: 20, hw: 8, hd: 1, top: 30, tag: 'wall' }],
  people: [],
  exits: [],
  missions: [],
};
const OPEN = { ...AREA, bounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 }, solids: [] };

const lcg = (seed = 7) => {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
};

const player = (at = { x: 0, z: 0, yaw: 0 }) => ({ ...newPlayer(AREA, at), y: 0, grounded: true });
// a belief of him as sight gives it: where he is, seen just now
const seen = (p, e) => {
  e.me ??= { pos: { x: e.x, y: e.y, z: e.z }, beliefs: {}, now: 0 };
  const b = { id: 'you', at: { x: p.x, y: p.y, z: p.z }, vel: { x: 0, y: 0, z: 0 }, seenAt: e.me.now, heardAt: -Infinity, confidence: 1, visible: true, timer: 1, hostile: true };
  e.me.beliefs.you = b;
  return b;
};
const chestOf = (p) => p.y + 9.5 * 0.6;

describe('the Decepticons’ tactics', () => {
  it('has an action for every option, and fire besides', () => {
    for (const o of OPTIONS) expect(ACTIONS[o.id], o.id).toBeTruthy();
    expect(Object.keys(ACTIONS).sort()).toEqual(['advance', 'cover', 'fire', 'flank', 'hold', 'search', 'strafe']);
  });

  it('with no belief it holds and scans', () => {
    const world = buildWorld(OPEN);
    const p = player();
    const e = newEnemy('trooper', 30, 30, { id: 'h' });
    const yaws = new Set();
    for (let t = 0; t < 2; t += 1 / 30) {
      step(e, null, p, 1 / 30, world, lcg(), null, null);
      yaws.add(e.yaw.toFixed(3));
    }
    expect(e.state).toBe('hold');
    expect(yaws.size).toBeGreaterThan(10);
    // (and it stays put)
    expect([e.x, e.z]).toEqual([30, 30]);
  });

  it('hurt below half with cover near, it takes cover behind the solid', () => {
    const world = buildWorld(AREA);
    const p = player();
    // off to the wall's side, in the open, with the wall a few steps away
    const e = newEnemy('trooper', 16, 32, { id: 'c' });
    e.hp = ENEMY_KINDS.trooper.hp * 0.3;
    for (let t = 0; t < 4; t += 1 / 30) step(e, seen(p, e), p, 1 / 30, world, lcg(), null, null);
    expect(e.state).toBe('cover');
    expect(e.cover).toBeTruthy();
    expect(segmentClear(world, p.x, chestOf(p), p.z, e.cover.x, e.y + e.h * 0.5, e.cover.z)).toBe(false);
    // it got there, and crouches
    expect(Math.hypot(e.x - e.cover.x, e.z - e.cover.z)).toBeLessThan(1.6);
    expect(e.body).toEqual(expect.objectContaining({ base: 'crouch' }));
  });

  it('sure and in range with a free token it fires once the line is clear', () => {
    const world = buildWorld(AREA);
    const tokens = createTokens({ pools: { shot: SHOTS_AT_ONCE }, timeout: 1 });
    // behind the wall from him: no shot
    const p = player();
    const e = newEnemy('trooper', 0, 40, { id: 'f' });
    e.cooldown = 0;
    let fired = 0;
    for (let t = 0; t < 0.2; t += 1 / 30) fired += step(e, seen(p, e), p, 1 / 30, world, lcg(), tokens, null).events.filter((x) => x.type === 'enemyFire').length;
    expect(fired).toBe(0);
    expect(tokens.count('shot')).toBe(0);
    // he steps out to the side, the line is clear: a shot, and its token held
    p.x = 30;
    let shots = [];
    for (let t = 0; t < 0.5 && !shots.length; t += 1 / 30) shots = step(e, seen(p, e), p, 1 / 30, world, lcg(), tokens, null).shots;
    expect(shots.length).toBe(1);
    expect(shots[0]).toEqual(expect.objectContaining({ from: 'enemy', by: 'f' }));
    expect(tokens.held('shot', 'f')).toBe(true);
  });

  it('a blocked line releases the token', () => {
    const world = buildWorld(AREA);
    const tokens = createTokens({ pools: { shot: SHOTS_AT_ONCE }, timeout: 1 });
    const p = player();
    const e = newEnemy('trooper', 0, 40, { id: 'b' });
    e.cooldown = 0;
    tokens.claim('shot', 'b');
    const r = step(e, seen(p, e), p, 1 / 30, world, lcg(), tokens, null);
    expect(r.shots).toEqual([]);
    expect(tokens.count('shot')).toBe(0);
  });

  it('the token cap holds across five enemies', () => {
    const world = buildWorld(OPEN);
    const tokens = createTokens({ pools: { shot: SHOTS_AT_ONCE }, timeout: 1 });
    const p = player();
    const foes = [0, 1, 2, 3, 4].map((i) => newEnemy('trooper', Math.sin(i * 1.2) * 35, Math.cos(i * 1.2) * 35, { id: `t${i}` }));
    for (const e of foes) e.cooldown = 0;
    const rand = lcg(3);
    let most = 0;
    let total = 0;
    for (let t = 0; t < 6; t += 1 / 30) {
      p.hp = p.maxHp;
      const n = stepEnemies(foes, p, 1 / 30, world, rand, tokens).events.filter((x) => x.type === 'enemyFire').length;
      most = Math.max(most, n);
      total += n;
      expect(tokens.count('shot')).toBeLessThanOrEqual(SHOTS_AT_ONCE);
    }
    expect(most).toBeLessThanOrEqual(SHOTS_AT_ONCE);
    expect(total).toBeGreaterThan(SHOTS_AT_ONCE);
  });

  it('a lost belief searches at the guess, then holds', () => {
    const world = buildWorld(OPEN);
    // further off than it can see: it knows he's there when it comes, then only guesses
    const p = player({ x: 0, z: 0, yaw: 0 });
    const e = newEnemy('trooper', 0, 520, { id: 's' });
    const states = new Set();
    const rand = lcg(5);
    let t = 0;
    for (; t < ENEMY_SENSES.intuition + 1; t += 1 / 30) stepEnemies([e], p, 1 / 30, world, rand);
    for (; t < ENEMY_SENSES.intuition + ENEMY_SENSES.memory + 1; t += 1 / 30) {
      stepEnemies([e], p, 1 / 30, world, rand);
      states.add(e.state);
    }
    expect(states.has('search')).toBe(true);
    expect(e.guess).toBeTruthy();
    expect(e.state).toBe('hold');
  });

  it('flank goes to the player’s other side', () => {
    const world = buildWorld(OPEN);
    const tokens = createTokens({ pools: { shot: SHOTS_AT_ONCE }, timeout: 10 });
    // every shot taken by others, and he's facing this one
    for (const who of ['x', 'y', 'z']) tokens.claim('shot', who);
    const p = player({ x: 0, z: 0, yaw: 0 });
    const e = newEnemy('trooper', 4, 36, { id: 'fl' });
    e.cooldown = 5;
    step(e, seen(p, e), p, 1 / 30, world, lcg(), tokens, null);
    expect(e.state).toBe('flank');
    const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
    expect((e.flankAt.x - p.x) * f.x + (e.flankAt.z - p.z) * f.z).toBeLessThan(0);
  });

  it('thinks again every so often, not every frame', () => {
    expect(RETHINK).toBeCloseTo(0.4);
    const world = buildWorld(OPEN);
    const p = player();
    const e = newEnemy('trooper', 0, 40, { id: 'r' });
    const notes = [];
    const trace = { note: (id, t, r) => r.scores && notes.push(r) };
    for (let t = 0; t < 2; t += 1 / 30) step(e, seen(p, e), p, 1 / 30, world, lcg(), null, trace);
    expect(notes.length).toBeGreaterThanOrEqual(4);
    expect(notes.length).toBeLessThanOrEqual(7);
    expect(notes[0].scores.strafe).toBeGreaterThan(0);
  });

  it('an enemy mid-advance whose belief fades steps on without an error and holds', () => {
    const world = buildWorld(OPEN);
    const p = player();
    const e = newEnemy('trooper', 0, 200, { id: 'ad' });
    const records = [];
    const trace = { note: (id, t, r) => records.push(r) };
    step(e, seen(p, e), p, 1 / 30, world, lcg(), null, trace);
    e.actor.want('advance', {});
    expect(e.actor.current()).toBe('advance');
    // the belief gone between rethinks
    e.think = 1;
    step(e, null, p, 1 / 30, world, lcg(), null, trace);
    expect(records.filter((r) => r.why === 'error')).toEqual([]);
    expect(e.actor.current()).toBe('hold');
    expect(e.state).toBe('hold');
  });

  it('a strafe whose belief fades holds too', () => {
    const world = buildWorld(OPEN);
    const p = player();
    const e = newEnemy('trooper', 0, 40, { id: 'st' });
    const records = [];
    const trace = { note: (id, t, r) => records.push(r) };
    step(e, seen(p, e), p, 1 / 30, world, lcg(), null, trace);
    e.actor.want('strafe', {});
    expect(e.actor.current()).toBe('strafe');
    e.think = 1;
    step(e, null, p, 1 / 30, world, lcg(), null, trace);
    expect(records.filter((r) => r.why === 'error')).toEqual([]);
    expect(e.actor.current()).toBe('hold');
  });
});
