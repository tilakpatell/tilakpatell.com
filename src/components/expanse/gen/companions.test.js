import { describe, expect, it } from 'vitest';
import { extentOf } from './extent';
import { orbitAt } from './orbits';
import { UNIVERSE, universeOf } from './seed';
import { fullSector } from './space';
import { COMPANIONS, companionAt, companionsOf } from './companions';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sectors = [[1, 0, 0], [2, 0, 0], [-3, 0, 1], [1, 1, 0], [5, 0, 5]].map(([x, y, z]) => fullSector(UNIVERSE, x, y, z, { things: false }));
const systems = sectors.flatMap((s) => s.systems);

describe('binary and trinary systems', () => {
  it('gives about one system in five a companion, and one in twenty-odd two', () => {
    const n = (k) => systems.filter((s) => companionsOf(s).length === k).length / systems.length;
    expect(n(1)).toBeGreaterThanOrEqual(0.15);
    expect(n(1)).toBeLessThanOrEqual(0.28);
    expect(n(2)).toBeGreaterThanOrEqual(0.02);
    expect(n(2)).toBeLessThanOrEqual(0.08);
  });
  it('never makes one a blue giant, or more than 0.3 of its star', () => {
    for (const s of systems)
      for (const c of companionsOf(s)) {
        expect(['O', 'B']).not.toContain(c.class);
        expect(c.size).toBeLessThanOrEqual(0.3 * s.star.size + 1e-9);
      }
  });
  it('keeps each clear of its star, every planet’s whole extent and its sibling, at every time', () => {
    const g = COMPANIONS.gap - 1e-6;
    for (const s of systems) {
      const cs = companionsOf(s);
      if (!cs.length) continue;
      for (const t of [0, 1e3, 1.7e9]) {
        const at = cs.map((c) => companionAt(c, s, t));
        cs.forEach((c, i) => {
          expect(len(at[i], s.at) - c.size - s.star.size).toBeGreaterThanOrEqual(g);
          for (const p of s.planets) expect(len(at[i], orbitAt(p, t)) - c.size - extentOf(p)).toBeGreaterThanOrEqual(g);
        });
        if (cs.length === 2) expect(len(at[0], at[1]) - cs[0].size - cs[1].size).toBeGreaterThan(0);
      }
    }
  });
  it('keys each system by its seed, never its id: a pocket universe’s systems are their own', () => {
    const marble = fullSector(universeOf('marble'), 1, 0, 0, { things: false });
    const shared = sectors[0];
    for (let i = 0; i < 64; i++) companionsOf(shared.systems[i]);
    for (let i = 0; i < 64; i++) {
      const m = marble.systems[i];
      expect(companionsOf(m)).toEqual(companionsOf({ ...m, id: `fresh:${i}`, seed: m.seed }));
    }
  });
});
