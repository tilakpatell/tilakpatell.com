import { describe, expect, it } from 'vitest';
import { buriedOf, clustersOf, lookedAt, steepAt, tableOf, wallsOf } from './bf2017-collision-probe.mjs';

// a 6 × 6 grid of points half a metre apart on flat ground at 10 m, every one open, nothing drawn but the ground
const scanOf = (over = {}) => {
  const n = 6;
  const fill = (v) => new Array(n * n).fill(v);
  return { n, step: 0.5, open: fill(1), feet: fill(10), truth: fill(10), ground: fill(10), top: fill(null), under: fill(null), topName: fill(-1), above: fill(0), names: ['pile', 'rock'], ...over };
};
const at = (c, r) => r * 6 + c;
const put = (list, k, v) => {
  const out = list.slice();
  out[k] = v;
  return out;
};

describe('where the body stands in what is drawn', () => {
  it('finds nothing on bare ground drawn where the feet are', () => {
    const b = buriedOf(scanOf());
    expect(b).toMatchObject({ open: 36, ground: { over: 0, under: 0 }, mesh: { points: 0 }, inside: 0, cells: [] });
  });

  it('counts the drawn ground over the feet from 0.3 m, and the deepest', () => {
    const s = scanOf();
    s.ground = put(put(put(s.ground, at(1, 1), 10.29), at(2, 2), 10.3), at(3, 3), 11.6);
    const b = buriedOf(s);
    expect(b.ground.over).toBe(2);
    expect(b.ground.deepest).toBeCloseTo(1.6, 5);
  });

  it('counts the feet over everything drawn, but not a soldier standing on a mesh', () => {
    const s = scanOf();
    s.feet = put(put(s.feet, at(1, 1), 10.8), at(2, 2), 10.8);
    s.under = put(s.under, at(2, 2), 10.75);
    expect(buriedOf(s).ground.under).toBe(1);
  });

  it('counts a drawn mesh over the feet by its depth and its mesh, and a blocked point never', () => {
    const s = scanOf();
    s.top = put(put(put(s.top, at(1, 1), 10.4), at(2, 1), 10.7), at(3, 1), 11.5);
    s.topName = put(put(put(s.topName, at(1, 1), 0), at(2, 1), 0), at(3, 1), 1);
    s.open = put(s.open, at(3, 1), 0);
    const b = buriedOf(s);
    expect(b.mesh.points).toBe(2);
    expect(b.mesh.depth).toEqual({ '0.3–0.55 m': 1, '0.55–1 m': 1, '1–1.9 m': 0 });
    expect(b.mesh.byMesh).toEqual({ pile: 2 });
    expect(b.cells).toEqual([at(1, 1), at(2, 1)]);
  });

  it('keeps a point under one surface apart: a solid’s inside or a one-sided roof', () => {
    const s = scanOf();
    s.above = put(put(s.above, at(1, 1), 1), at(2, 2), 2);
    const b = buriedOf(s);
    expect(b.inside).toBe(1);
    expect(b.mesh.points).toBe(0);
  });
});

describe('what a blocked point is blocked by', () => {
  it('names a drawn mesh in the body’s column there or beside it', () => {
    const s = scanOf();
    s.open = put(put(s.open, at(2, 2), 0), at(4, 4), 0);
    s.top = put(s.top, at(3, 2), 10.9);
    const w = wallsOf(s);
    expect(w).toMatchObject({ blocked: 2, drawn: 1, bank: 0 });
    expect(w.candidates).toEqual([at(4, 4)]);
  });

  it('does not take a drawn thing under the knee for a wall', () => {
    const s = scanOf();
    s.open = put(s.open, at(2, 2), 0);
    s.top = put(s.top, at(2, 2), 10.35);
    expect(wallsOf(s).candidates).toEqual([at(2, 2)]);
  });

  it('names a bank past 45° by the height map’s own heights', () => {
    const s = scanOf();
    // (the last two rows 2 m up: the points either side of the edge are on a bank)
    s.truth = s.truth.map((h, k) => (Math.floor(k / 6) >= 4 ? 12 : h));
    s.open = put(put(s.open, at(2, 3), 0), at(2, 1), 0);
    expect(steepAt(s, at(2, 3))).toBe(true);
    expect(steepAt(s, at(2, 1))).toBe(false);
    const w = wallsOf(s);
    expect(w).toMatchObject({ blocked: 2, bank: 1 });
    expect(w.candidates).toEqual([at(2, 1)]);
  });

  it('drops the candidates the sideways look found something near', () => {
    expect(lookedAt([3, 8, 9], [null, { d: 0.4, name: 'rock' }, null])).toEqual([3, 9]);
  });
});

describe('the clusters', () => {
  it('joins the cells that touch, corners too, biggest first', () => {
    const cs = clustersOf([at(0, 0), at(1, 1), at(2, 1), at(5, 5)], 6);
    expect(cs.map((c) => c.cells)).toEqual([3, 1]);
    expect(cs[0].min).toEqual([0, 0]);
    expect(cs[0].max).toEqual([2, 1]);
    expect(cs[0].at[0]).toBeCloseTo(1, 5);
    expect(cs[1].at).toEqual([5, 5]);
  });
});

describe('the table', () => {
  it('writes Markdown, the first row the head', () => {
    expect(tableOf([['a', 'b'], [1, 2]])).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |');
  });
});
