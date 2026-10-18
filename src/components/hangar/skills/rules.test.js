import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../Achievements';
import { BATTLEFRONT, BRANCHES, KEYS, NODES } from './tree';
import { canCarry, canTake, effectsOf, keyMet, legendRank, maxPoints, pointsOf, readSkills, resetCost, treeCost } from './rules';

const all = Object.keys(ACHIEVEMENTS);
const countable = all.filter((id) => !BATTLEFRONT.includes(id)).length;
const plenty = { earned: 70, achievements: [KEYS.starwars[0], KEYS.rickmorty[0], KEYS.breakingbad[0], KEYS.universe[0]] };

describe('the skill tree', () => {
  it('costs 60, between four fifths of the most the site gives and the most', () => {
    expect(treeCost()).toBe(60);
    expect(0.8 * maxPoints(countable)).toBeLessThanOrEqual(treeCost());
    expect(treeCost()).toBeLessThanOrEqual(maxPoints(countable));
    expect(maxPoints(countable)).toBe(70);
  });
  it('names only achievements there are', () => {
    for (const id of [...Object.values(KEYS).flat(), ...BATTLEFRONT]) expect(ACHIEVEMENTS[id], id).toBeTruthy();
  });
  it('opens every branch from two first-row nodes that need nothing, and asks no other branch for anything', () => {
    for (const b of BRANCHES) {
      const first = Object.values(NODES).filter((n) => n.branch === b && n.row === 1);
      expect(first).toHaveLength(2);
      for (const n of first) expect(n.key).toBeUndefined();
    }
  });
  it('costs 15 a branch', () => {
    for (const b of BRANCHES) expect(Object.values(NODES).filter((n) => n.branch === b).reduce((s, n) => s + n.cost, 0)).toBe(15);
  });
});

describe('the points', () => {
  it('come from levels, Legend ranks and achievements', () => {
    const p = pointsOf({ level: 3, xp: 200, achievements: Array.from({ length: 12 }, (_, i) => all[i]) });
    expect(p.levels).toBe(2);
    expect(p.legend).toBe(0);
    expect(p.deeds).toBe(2);
    expect(p.earned).toBe(4);
  });
  it('rank Legend past level eleven, at most ten times', () => {
    expect(legendRank(13999)).toBe(0);
    expect(legendRank(14000)).toBe(1);
    expect(legendRank(17000)).toBe(2);
    expect(legendRank(1e9)).toBe(10);
  });
  it('count no Battlefront achievement, and no more than fifty from them all', () => {
    expect(pointsOf({ level: 1, xp: 0, achievements: BATTLEFRONT }).deeds).toBe(0);
    expect(pointsOf({ level: 1, xp: 0, achievements: all }).deeds).toBeLessThanOrEqual(50);
  });
});

describe('taking a node', () => {
  it('needs one of the row above, in its own branch', () => {
    expect(canTake([], 'deflectors', plenty).why).toBe('parent');
    expect(canTake(['afterburn'], 'deflectors', plenty).ok).toBe(true);
    expect(canTake(['trigger'], 'deflectors', plenty).why).toBe('parent');
  });
  it('needs its universe’s key where it has one', () => {
    const path = ['afterburn', 'deflectors', 'slipstream'];
    expect(canTake(path, 'kesselrun', { earned: 70, achievements: [] }).why).toBe('key');
    expect(canTake(path, 'kesselrun', plenty).ok).toBe(true);
    expect(keyMet('starwars', [KEYS.starwars[0]])).toBe(true);
    expect(keyMet('starwars', [KEYS.rickmorty[0]])).toBe(false);
  });
  it('waits for what isn’t here yet, and for the points', () => {
    const soon = Object.keys(NODES).find((id) => NODES[id].soon);
    expect(canTake(['trigger', 'loader', 'longlock'], soon, plenty).why).toBe('soon');
    expect(canTake([], 'afterburn', { earned: 0, achievements: [] }).why).toBe('points');
    expect(canTake(['afterburn'], 'afterburn', plenty).why).toBe('taken');
  });
});

describe('the nodes kept', () => {
  it('stand in the order taken while the points last', () => {
    expect(readSkills({ nodes: ['afterburn', 'trim', 'deflectors'] }, { earned: 2, achievements: [] })).toEqual(['afterburn', 'trim']);
  });
  it('drop what’s unknown, what lost its parent and what isn’t here yet', () => {
    const soon = Object.keys(NODES).find((id) => NODES[id].soon);
    expect(readSkills({ nodes: ['nope', 'deflectors', 'afterburn', soon] }, plenty)).toEqual(['afterburn']);
    expect(readSkills('junk', plenty)).toEqual([]);
    expect(readSkills(null, plenty)).toEqual([]);
  });
});

describe('what they do', () => {
  it('adds and multiplies, and is neutral for what’s not taken', () => {
    const fx = effectsOf(['afterburn', 'trigger', 'racks']);
    expect(fx.boost).toBeCloseTo(0.1);
    expect(fx.cadence).toBeCloseTo(0.92);
    expect(fx.ammo).toBe(1);
    expect(fx.accel).toBe(0);
    expect(fx.regen).toBe(1);
    expect(fx.carry).toEqual([]);
  });
  it('lets any ship carry a crew’s pair once its node is taken', () => {
    expect(canCarry(effectsOf([]), 'xwing', 'cruiser')).toBe(false);
    expect(canCarry(effectsOf(['b-cruiser']), 'xwing', 'cruiser')).toBe(true);
    expect(canCarry(effectsOf([]), 'xwing', 'xwing')).toBe(true);
  });
  it('resets free the first time, and for 500 credits after', () => {
    expect(resetCost(0)).toBe(0);
    expect(resetCost(1)).toBe(500);
    expect(resetCost(7)).toBe(500);
  });
});
