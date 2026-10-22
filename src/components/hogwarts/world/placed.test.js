import { describe, expect, it } from 'vitest';
import { PLACED, ringOf } from './placed';
import { HEROES } from './heroes';
import { placeById } from '../rules/places';

describe('the grounds’ hero props', () => {
  it('stands each one the list has a model for, at its place', () => {
    for (const p of PLACED) {
      expect(HEROES[p.model], p.model).toBeDefined();
      expect(p.at.every(Number.isFinite)).toBe(true);
    }
    const hut = PLACED.find((p) => p.model === 'hagrid-hut');
    expect(hut.at).toEqual(placeById('hut').at);
    expect(PLACED.filter((p) => p.model === 'greenhouse')).toHaveLength(3);
  });

  it('rings the stone circle round its place, each stone its own way, the same every visit', () => {
    const [cx, cz] = placeById('stone-circle').at;
    const ring = ringOf([cx, cz], 11, 10);
    expect(ring).toHaveLength(11);
    for (const s of ring) {
      expect(Math.hypot(s.at[0] - cx, s.at[1] - cz)).toBeGreaterThan(9);
      expect(Math.hypot(s.at[0] - cx, s.at[1] - cz)).toBeLessThan(11);
    }
    expect(ringOf([cx, cz], 11, 10)).toEqual(ring);
    expect(new Set(ring.map((s) => s.yaw.toFixed(3))).size).toBe(11);
  });
});
