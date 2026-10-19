import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { KINDS, SHEETS, countFor, recordFor } from './weather';
import { lifeMax, perInstance } from '../../../lib/three/particles/emitter';
import { evalCurve } from '../../../lib/three/particles/curves';
import { PACK } from './pack';

const NAMES = ['rain', 'snow', 'ash', 'embers', 'motes', 'spray', 'smoke', 'fire'];

describe('the weather’s records', () => {
  it('are the eight kinds, each in the emitter’s shape', () => {
    expect(Object.keys(KINDS).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      const em = KINDS[name];
      expect(perInstance(em), name).toBeGreaterThan(0);
      expect(lifeMax(em), name).toBeGreaterThan(0);
      expect(em.kind, name).toBe('quad');
      expect(em.loop, name).not.toBe(false);
      expect(evalCurve(em.spawn.rate, 0.5, 0.5), name).toBeGreaterThan(0);
    }
  });

  it('each draws from one of the Road’s own sheets, a 4 × 1 strip on disk and in the pack', () => {
    for (const name of NAMES) {
      const em = KINDS[name];
      expect(SHEETS, name).toContain(em.sheet);
      expect(em.uv.grid).toEqual([4, 1]);
    }
    for (const sheet of SHEETS) expect(existsSync(`public/models/middleearth/fx/${sheet}.webp`), sheet).toBe(true);
    expect(PACK.globs).toContain('/models/middleearth/fx/*');
  });

  it('rain and snow fall, smoke and embers rise', () => {
    const fall = (em) => (em.gravity?.g ?? 0) > 0 || em.spawn.direction.box.max[1] < 0;
    expect(fall(KINDS.rain)).toBe(true);
    expect(fall(KINDS.snow)).toBe(true);
    expect(fall(KINDS.ash)).toBe(true);
    expect((KINDS.smoke.gravity?.g ?? 0) < 0 || KINDS.smoke.spawn.direction.box.min[1] > 0).toBe(true);
    expect((KINDS.embers.gravity?.g ?? 0) < 0).toBe(true);
  });
});

describe('the counts by tier', () => {
  it('low quarters a kind, mid halves it, high and ultra keep it', () => {
    expect(countFor(400, 'high')).toBe(400);
    expect(countFor(400, 'ultra')).toBe(400);
    expect(countFor(400, 'mid')).toBe(200);
    expect(countFor(400, 'low')).toBe(100);
    expect(countFor(2, 'low')).toBe(1);
  });

  it('a kind asked with a count and a box keeps the rate in step with the count', () => {
    const em = recordFor('rain', { count: 800, box: [40, 20, 40] });
    expect(em.maxCount).toBe(800);
    expect(em.spawn.position.box.size).toEqual([40, 0, 40]);
    // (the rate keeps the count alive over a life, so a box is full, not thinning)
    expect(evalCurve(em.spawn.rate, 0.5, 0.5) * lifeMax(em)).toBeGreaterThanOrEqual(800);
    expect(KINDS.rain.maxCount).not.toBe(800);
  });
});
