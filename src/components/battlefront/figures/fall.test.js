import { describe, expect, it } from 'vitest';
import impulses from '../../../data/bf2017/physics/impulses.json';
import { PART_BONES, admit, boneForHit, expired, impulseOf } from './fall.js';

// a standing trooper's bones, as the ragdoll's points ({ x, y, z })
const POINTS = {
  Head: { x: 0, y: 1.6, z: 0 },
  Spine: { x: 0, y: 1.1, z: 0 },
  Hips: { x: 0, y: 1, z: 0 },
  LeftArm: { x: 0.17, y: 1.4, z: 0 },
  RightArm: { x: -0.17, y: 1.4, z: 0 },
  LeftUpLeg: { x: 0.1, y: 0.95, z: 0 },
  LeftLeg: { x: 0.1, y: 0.52, z: 0 },
  LeftFoot: { x: 0.1, y: 0.09, z: 0 },
};
const pointOf = (n) => POINTS[n] ?? null;

describe('where the hit lands on the ragdoll', () => {
  it('names the sim’s seven parts in the game’s bodies', () => {
    expect(Object.keys(PART_BONES).sort()).toEqual(['armL', 'armR', 'chest', 'head', 'hips', 'legL', 'legR']);
    expect(PART_BONES.head).toEqual(['Head']);
  });

  it('gives the head for the head, and the part’s bone nearest where the bolt struck', () => {
    expect(boneForHit('head', [0, 1.6, 0], pointOf)).toBe('Head');
    expect(boneForHit('legL', [0.1, 0.15, 0.05], pointOf)).toBe('LeftFoot');
    expect(boneForHit('legL', [0.1, 0.9, 0], pointOf)).toBe('LeftUpLeg');
    expect(boneForHit('chest', [0.15, 1.38, 0], pointOf)).toBe('LeftArm');
  });

  it('falls back on the spine with no part, and on the part’s first bone with no point', () => {
    expect(boneForHit(null, null, pointOf)).toBe('Spine');
    expect(boneForHit('nowhere', [0, 0, 0], pointOf)).toBe('Spine');
    expect(boneForHit('armR', null, pointOf)).toBe('RightArm');
    expect(boneForHit('legR', [0, 0, 0], () => null)).toBe('RightUpLeg');
  });
});

describe('how hard', () => {
  it('reads the weapon’s impact impulse from the game, with its record', () => {
    expect(impulseOf('e11', impulses)).toEqual({ impulse: 50, source: impulses.rows.e11.impulse_source });
    expect(impulseOf('chewbacca', impulses).impulse).toBe(46);
  });

  it('takes the default rifle bolt’s for a weapon it does not know or none', () => {
    expect(impulseOf('bowv2', impulses)).toEqual({ impulse: 50, source: impulses.fallback.impulse_source });
    expect(impulseOf(null, impulses).impulse).toBe(50);
    expect(impulseOf('e11', null)).toEqual({ impulse: 0, source: null });
  });
});

describe('admit', () => {
  it('lets a fall in under the cap and within range', () => {
    expect(admit({ active: 0, dist: 10, max: 4, range: 60 })).toBe(true);
    expect(admit({ active: 3, dist: 60, max: 4, range: 60 })).toBe(true);
  });

  it('refuses one at the cap, or beyond the range', () => {
    expect(admit({ active: 4, dist: 10, max: 4, range: 60 })).toBe(false);
    expect(admit({ active: 0, dist: 100, max: 4, range: 60 })).toBe(false);
    expect(admit({ active: 0, dist: 1, max: 0, range: 60 })).toBe(false);
  });
});

describe('expired', () => {
  it('lies for the corpse time, sinks, then is gone', () => {
    expect(expired({ since: 0, lie: 10, sink: 2 })).toBe('lie');
    expect(expired({ since: 9.9, lie: 10, sink: 2 })).toBe('lie');
    expect(expired({ since: 10.5, lie: 10, sink: 2 })).toBe('sink');
    expect(expired({ since: 12, lie: 10, sink: 2 })).toBe('gone');
  });
});
