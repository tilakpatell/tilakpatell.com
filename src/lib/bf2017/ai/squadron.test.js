import { describe, expect, it } from 'vitest';
import SQUADRON from '../../../data/bf2017/ai.squadron.json';
import { seeded } from '../../seeded.js';
import { DOGFIGHT, createSquadronMind, unreadNodes } from './squadron.js';

const tree = SQUADRON.rows.trees[DOGFIGHT];
const me = (over = {}) => ({ at: [0, 0, 0], fwd: [0, 0, 1], up: [0, 1, 0], speed: 100, ...over });
const enemy = (at, fwd = [0, 0, 1]) => ({ id: 'e', at, fwd, vel: fwd.map((v) => v * 100) });
const world = (over = {}) => ({ self: me(), nearestEnemy: () => null, attackers: () => [], areas: () => null, waypoints: () => null, ...over });

function run(mind, w, seconds, dt = 0.1) {
  const out = [];
  for (let t = 0; t < seconds; t += dt) out.push({ ...mind.tick(dt, w), node: mind.active });
  return out;
}

describe('the squadron behaviour tree (the game’s dogfight)', () => {
  it('is the record’s tree', () => {
    expect(DOGFIGHT).toBe('PF_DogfightBehaviour');
    expect(tree.nodes[tree.root].kind).toBe('Selector');
  });

  it('with no target lands in follow-path or fly-forward, never in attack', () => {
    const mind = createSquadronMind(tree, { rand: seeded(1) });
    const flat = run(mind, world(), 5);
    expect(flat.every((c) => c.node === 'DogfightingFlyForward')).toBe(true);
    expect(flat.some((c) => c.fire || c.missile)).toBe(false);
    const path = createSquadronMind(tree, { rand: seeded(1) });
    const along = run(path, world({ waypoints: () => [[0, 0, 400], [400, 0, 800]] }), 5);
    expect(along.every((c) => c.node === 'FollowWaypoints')).toBe(true);
  });

  it('attacks a target between the attack rule’s 100 and 500 m, and turns toward it', () => {
    const mind = createSquadronMind(tree, { rand: seeded(1) });
    const c = mind.tick(0.1, world({ nearestEnemy: () => enemy([200, 0, 300]) }));
    expect(mind.active).toBe('DogfightingAttack');
    expect(c.yaw).toBeGreaterThan(0);
    expect(c.throttle).toBeGreaterThan(0);
  });

  it('a target inside 100 m: it evades or flies on, never attacks', () => {
    const mind = createSquadronMind(tree, { rand: seeded(1) });
    const near = run(mind, world({ nearestEnemy: () => enemy([0, 0, 60]) }), 3);
    expect(near.some((c) => c.node === 'DogfightingAttack')).toBe(false);
    expect(near.every((c) => ['DogfightingFlyForward', 'DogfightingEvade'].includes(c.root))).toBe(true);
  });

  it('an enemy on its tail inside 125 m and 75° makes it evade, by the evade node’s manoeuvres', () => {
    const mind = createSquadronMind(tree, { rand: seeded(2) });
    const tail = enemy([0, 0, -80], [0, 0, 1]);
    const w = world({ nearestEnemy: () => tail, attackers: () => [tail] });
    const ticks = run(mind, w, 6);
    expect(ticks.every((c) => c.root === 'DogfightingEvade')).toBe(true);
    expect(new Set(ticks.map((c) => c.node)).size).toBeGreaterThan(1);
    // (off its tail, or farther than 125 m, it does not)
    const wide = createSquadronMind(tree, { rand: seeded(2) });
    wide.tick(0.1, world({ nearestEnemy: () => enemy([0, 0, -300]), attackers: () => [enemy([0, 0, -300])] }));
    expect(wide.rootActive).not.toBe('DogfightingEvade');
  });

  it('the cannon rule’s bursts stop at its 2 s and rest 1.5 s; the missile locks after 3 s', () => {
    const mind = createSquadronMind(tree, { rand: seeded(1) });
    const ahead = enemy([0, 0, 300]);
    const ticks = run(mind, world({ nearestEnemy: () => ahead }), 8, 0.05);
    let longest = 0;
    let run_ = 0;
    let rest = Infinity;
    let since = 0;
    let wasFiring = false;
    for (const c of ticks) {
      if (c.fire) {
        if (!wasFiring && since > 0) rest = Math.min(rest, since);
        run_ += 0.05;
        since = 0;
      } else {
        longest = Math.max(longest, run_);
        run_ = 0;
        since += 0.05;
      }
      wasFiring = c.fire;
    }
    longest = Math.max(longest, run_);
    expect(longest).toBeGreaterThan(1.5);
    expect(longest).toBeLessThanOrEqual(2 + 1e-6);
    expect(rest).toBeGreaterThanOrEqual(1.5 - 1e-6);
    const first = ticks.findIndex((c) => c.missile);
    expect(first * 0.05).toBeGreaterThanOrEqual(3 - 1e-6);
  });

  it('counts the node kinds it does not fly', () => {
    createSquadronMind(SQUADRON.rows.trees.PF_SquadronAI, { rand: seeded(1) }).tick(0.1, world());
    expect(unreadNodes.has('FlyFormation') || unreadNodes.has('ProximateWaypoints')).toBe(true);
  });
});
