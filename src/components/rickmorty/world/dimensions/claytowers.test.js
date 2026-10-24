import { describe, expect, it } from 'vitest';
import { CLAY_TOWERS, TOWERS, claytowers } from './claytowers';
import { CLIMB, MORTY } from '../rules';

const { solids, stairs, paths, spots } = CLAY_TOWERS;
const byId = (id) => solids.find((s) => s.id === id);
const ledges = solids.filter((s) => s.ledge);
// two circles' gap (below zero: they overlap)
const gap = (a, b) => Math.hypot(a.dx - b.dx, a.dz - b.dz) - a.r - b.r;
const bearing = (t, c) => (Math.atan2(c.dz - t.dz, c.dx - t.dx) * 180) / Math.PI;

// Bird World's other solids beside the towers (./rows1.js)
const CLEARING = [
  { id: 'house', dx: 0, dz: -16, r: 4 },
  { id: 'tree-a', dx: -16, dz: 10, r: 1.2 },
  { id: 'tree-b', dx: 18, dz: 6, r: 1.2 },
  { id: 'crystals', dx: -12, dz: 6, r: 1.2 },
];

describe('Bird World’s clay towers: a flight of drums round each, and its top', () => {
  it('lays each tower out as the plan has it', () => {
    expect(TOWERS.map((t) => t.id)).toEqual(['tower-a', 'tower-b']);
    expect(paths['tower-a']).toEqual([...Array.from({ length: 9 }, (_, i) => `tower-a-${i + 1}`), 'tower-a']);
    expect(paths['tower-b']).toEqual([...Array.from({ length: 11 }, (_, i) => `tower-b-${i + 1}`), 'tower-b']);
    expect(byId('tower-a')).toEqual({ id: 'tower-a', dx: -22, dz: -15, r: 2, top: 8, ledge: true });
    expect(byId('tower-b')).toEqual({ id: 'tower-b', dx: 20, dz: -17, r: 2.2, top: 9.6, ledge: true });
    // the trunks the towers are grown round, up through their tops: in the way at any height
    expect(byId('tower-a-trunk')).toEqual({ id: 'tower-a-trunk', dx: -22, dz: -15, r: 0.4 });
    expect(byId('tower-b-trunk')).toEqual({ id: 'tower-b-trunk', dx: 20, dz: -17, r: 0.4 });
    // each drum a column from the ground, on its tower's ring, a step round from the last
    for (const t of TOWERS)
      paths[t.id].slice(0, -1).forEach((id, k) => {
        const d = byId(id);
        expect(d, id).toMatchObject({ r: 0.9, top: +(0.8 * (k + 1)).toFixed(3), ledge: true });
        expect(Math.hypot(d.dx - t.dx, d.dz - t.dz), id).toBeCloseTo(t.ring, 2);
        const want = t.from + t.turn * k * t.step;
        expect(Math.abs(((bearing(t, d) - want + 540) % 360) - 180), id).toBeLessThan(0.1);
      });
    expect(stairs).toEqual([
      { id: 'crumble-a', steps: ['tower-a-3', 'tower-a-4', 'tower-a-5'] },
      { id: 'crumble-b', steps: ['tower-b-3', 'tower-b-4', 'tower-b-5'] },
    ]);
    // (the same layout every time it's made)
    expect(claytowers()).toEqual(CLAY_TOWERS);
  });

  it('rises a hop at a time, and only each tower’s first drum is in reach from the ground', () => {
    for (const path of Object.values(paths)) {
      const tops = path.map((id) => byId(id).top);
      for (let i = 1; i < tops.length; i++) expect(+(tops[i] - tops[i - 1]).toFixed(3)).toBe(0.8);
    }
    expect(ledges.filter((l) => l.top <= CLIMB + 1e-9).map((l) => l.id)).toEqual(['tower-a-1', 'tower-b-1']);
  });

  it('touches each next drum, and offers no hop past the next one', () => {
    for (const path of Object.values(paths)) for (let i = 1; i < path.length; i++) expect(gap(byId(path[i - 1]), byId(path[i])), path[i]).toBeLessThan(0);
    const next = new Map(Object.values(paths).flatMap((p) => p.slice(0, -1).map((id, i) => [id, p[i + 1]])));
    const skips = [];
    for (const a of ledges)
      for (const b of ledges) {
        const rise = b.top - a.top;
        if (rise <= 0 || rise > CLIMB + 1e-9 || next.get(a.id) === b.id) continue;
        if (gap(a, b) < 1.5) skips.push(`${a.id} to ${b.id}`);
      }
    expect(skips).toEqual([]);
  });

  it('can’t be climbed to either top without going up its crumbling stair', () => {
    const reaches = (top, without) => {
      const open = ledges.filter((l) => !without.includes(l.id));
      const seen = new Set(open.filter((l) => l.top <= CLIMB + 1e-9).map((l) => l.id));
      const todo = [...seen];
      while (todo.length) {
        const a = byId(todo.pop());
        for (const b of open) if (!seen.has(b.id) && b.top - a.top <= CLIMB + 1e-9 && gap(a, b) <= 1.5) todo.push(seen.add(b.id) && b.id);
      }
      return seen.has(top);
    };
    for (const [t, s] of [
      ['tower-a', 'crumble-a'],
      ['tower-b', 'crumble-b'],
    ]) {
      expect(reaches(t, []), t).toBe(true);
      expect(reaches(t, stairs.find((x) => x.id === s).steps), t).toBe(false);
    }
  });

  it('winds each flight less than once round its tower, inside the box and clear of the clearing’s solids', () => {
    for (const t of TOWERS) expect((t.drums - 1) * t.step).toBeLessThan(360);
    for (const s of solids) {
      expect(Math.abs(s.dx) + s.r, s.id).toBeLessThanOrEqual(35);
      expect(Math.abs(s.dz) + s.r, s.id).toBeLessThanOrEqual(25);
      for (const c of CLEARING) expect(gap(s, c), `${s.id} and ${c.id}`).toBeGreaterThan(2 * MORTY.radius);
    }
  });

  it('puts a crystal on each top, a metre off its trunk toward the last drum, out of reach from off it', () => {
    expect(Object.keys(spots)).toEqual(['bcrystal-west', 'bcrystal-east']);
    for (const [id, t, last] of [
      ['bcrystal-west', byId('tower-a'), byId('tower-a-9')],
      ['bcrystal-east', byId('tower-b'), byId('tower-b-11')],
    ]) {
      const c = spots[id];
      expect(c.y, id).toBe(t.top);
      expect(Math.hypot(c.dx - t.dx, c.dz - t.dz), id).toBeCloseTo(1, 2);
      expect(Math.abs(((bearing(t, c) - bearing(t, last) + 540) % 360) - 180), id).toBeLessThan(0.5);
      // (off the top, the tower's own column keeps him its radius and his own from its middle: a picking reach of 1 m falls short)
      expect(t.r + MORTY.radius - 1, id).toBeGreaterThan(1);
      // (and on it, clear of the trunk, it's in reach)
      expect(1 - (0.4 + MORTY.radius), id).toBeGreaterThanOrEqual(0);
    }
  });
});
