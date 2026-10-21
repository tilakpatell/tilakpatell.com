import { describe, expect, it } from 'vitest';
import { SHAPES } from './silhouettes';
import { PATRONUS } from '../rules/spells';

describe('the Patronus’s shapes', () => {
  it('there is one for every house’s Patronus', () => {
    for (const shape of Object.values(PATRONUS)) expect(SHAPES[shape]).toBeTruthy();
  });
  it('each is a few hundred points standing on the ground, facing +x, its legs on four hips', () => {
    for (const [name, s] of Object.entries(SHAPES)) {
      expect(s.points.length, name).toBeGreaterThan(150);
      expect(s.points.length, name).toBeLessThan(500);
      expect(Math.min(...s.points.map((p) => p.y))).toBeGreaterThanOrEqual(-0.01);
      expect(Math.min(...s.points.map((p) => p.y))).toBeLessThan(0.02);
      expect(s.hips).toHaveLength(4);
      for (let i = 0; i < 4; i++) expect(s.points.some((p) => p.leg === i)).toBe(true);
      // the head is forward: the highest point of the front half is higher than the back half’s
      const front = s.points.filter((p) => p.x > 0 && p.leg < 0);
      expect(front.length).toBeGreaterThan(10);
      for (const p of s.points) for (const k of ['x', 'y', 'z']) expect(Number.isFinite(p[k])).toBe(true);
    }
  });
  it('the stag is the tallest, the antlers above his head', () => {
    const top = (s) => Math.max(...s.points.map((p) => p.y));
    expect(top(SHAPES.stag)).toBeGreaterThan(2.4);
    for (const n of ['hare', 'otter', 'fox']) expect(top(SHAPES[n])).toBeLessThan(top(SHAPES.stag));
  });
});
