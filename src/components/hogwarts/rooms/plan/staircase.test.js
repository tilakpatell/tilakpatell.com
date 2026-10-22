import { describe, expect, it } from 'vitest';
import { LANDINGS, STAIRS } from '../../rules/staircases';
import { FRAMES } from '../../rules/portraits';
import { SHAFT, areaOf, frameAt, landingAt, platforms, spawnAt, stairEnds } from './staircase';

const inRect = ([x0, x1, z0, z1], x, z, pad = 1e-6) => x >= x0 - pad && x <= x1 + pad && z >= z0 - pad && z <= z1 + pad;

describe('the Grand Staircase’s plan', () => {
  it('stands every landing on its wall, a floor apart, inside the shaft', () => {
    for (const l of LANDINGS) {
      const p = landingAt(l.id);
      expect(p.at[1]).toBe(l.floor * SHAFT.floor);
      expect(Math.abs(p.at[0])).toBeLessThan(SHAFT.half);
      expect(Math.abs(p.at[2])).toBeLessThan(SHAFT.half);
      // (the platform against its own wall)
      expect(Math.max(Math.abs(p.rect[0]), Math.abs(p.rect[1]))).toBeCloseTo(SHAFT.half, 6);
    }
    expect(landingAt('nowhere')).toBeNull();
  });

  it('lays every stair from its own landing to either of its two, climbing one floor at a walkable slope', () => {
    for (const s of STAIRS)
      for (const end of ['to', 'alt']) {
        const e = stairEnds(s, end);
        expect(inRect(landingAt(s.from).rect, e.from[0], e.from[2]), `${s.id} ${end} leaves its landing`).toBe(true);
        expect(inRect(landingAt(s[end]).rect, e.to[0], e.to[2]), `${s.id} ${end} reaches its landing`).toBe(true);
        expect(e.rise).toBe(SHAFT.floor);
        const slope = (Math.atan2(e.rise, e.run) * 180) / Math.PI;
        expect(slope, `${s.id} ${end}`).toBeGreaterThan(10);
        expect(slope, `${s.id} ${end}`).toBeLessThan(42);
      }
  });

  it('keeps a stair coming up apart from the one going on from the same end', () => {
    for (const l of LANDINGS) {
      const leaving = STAIRS.filter((s) => s.from === l.id).flatMap((s) => ['to', 'alt'].map((e) => stairEnds(s, e).from));
      const arriving = STAIRS.flatMap((s) => ['to', 'alt'].filter((e) => s[e] === l.id).map((e) => stairEnds(s, e).to));
      for (const a of leaving) for (const b of arriving) expect(Math.hypot(a[0] - b[0], a[2] - b[2]), l.id).toBeGreaterThan(1.5);
    }
  });

  it('gives the walk a floor at every landing, and the gallery’s span where its floor has one', () => {
    expect(platforms().length).toBe(LANDINGS.length + 3);
    expect(areaOf('3w').rects).toHaveLength(1);
    const g = areaOf('4w');
    expect(g.landings.sort()).toEqual(['4e', '4w']);
    expect(g.rects).toHaveLength(3);
    for (const l of LANDINGS) {
      const sp = spawnAt(l.id);
      expect(areaOf(l.id).rects.some((r) => inRect(r, sp.at[0], sp.at[1])), l.id).toBe(true);
    }
  });

  it('hangs every portrait’s frame on a wall by a landing', () => {
    for (const f of FRAMES) {
      const p = frameAt(f);
      expect(p, f).not.toBeNull();
      expect(Math.abs(p.at[0])).toBeCloseTo(SHAFT.half - 0.08, 6);
      expect(p.at[1]).toBeGreaterThan(0);
    }
  });
});
