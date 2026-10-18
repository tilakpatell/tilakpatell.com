import { describe, expect, it } from 'vitest';
import { CHART, FRAMES, createView, flatten, levelOf, orbitBy, panBy, project, reachOn, recentre, ringsFor, toFrame, track, unproject, warp, zoomBy } from './projection';

const pts = [[1200, 0, -300], [-5000, 800, 2500], [40000, -3000, 1000], [3, 0, 4], [0, 0, -90000]];
const rad = (p) => Math.hypot(p.u, p.v);

describe('the chart’s projection', () => {
  it('centres on the focus, and follows the ship', () => {
    expect(project(createView({ focus: [5000, 120, -800] }), [5000, 120, -800])).toMatchObject({ u: 0, v: 0 });
    const ship = { x: -2000, y: 40, z: 9000 };
    const followed = track(createView({ follow: true }), ship);
    expect(followed.focus).toEqual([-2000, 40, 9000]);
    expect(track(followed, ship)).toBe(followed);
    expect(track(createView({ focus: [10, 0, 10] }), ship).focus).toEqual([10, 40, 10]);
  });
  it('puts the range at the rim on the 0.375-power scale', () => {
    const view = createView({ range: 54000 });
    expect(rad(project(view, [54000, 0, 0]))).toBeCloseTo(1, 12);
    expect(rad(project(view, [0, 0, 5400]))).toBeCloseTo(0.1 ** 0.375, 12);
    expect(warp([0, 0, 0], 1000)).toEqual([0, 0, 0]);
  });
  it('zooms monotonically and back again, clamped', () => {
    const view = createView({ focus: [100, 0, 100] });
    const zin = zoomBy(view, 1.5);
    for (const p of pts) expect(rad(project(zin, p))).toBeGreaterThan(rad(project(view, p)));
    expect(zoomBy(zin, 1 / 1.5).range).toBeCloseTo(view.range, 6);
    expect(zoomBy(view, 1e9).range).toBe(CHART.range.min);
    expect(zoomBy(view, 1e-9).range).toBe(CHART.range.max);
  });
  it('unprojects what it projects on the focus plane, at any zoom, turn and tilt', () => {
    for (const view of [createView({ focus: [700, 50, -300], range: 9000 }), orbitBy(createView({ focus: [700, 50, -300], range: 300000 }), [0.8, 0.6])]) {
      for (const [x, , z] of pts) {
        const p = project(view, [x, 50, z]);
        unproject(view, [p.u, p.v]).forEach((c, i) => expect(c).toBeCloseTo([x, 50, z][i], 4));
      }
    }
  });
  it('stands every mark on a stem: up for above the ship, down for below, none for level', () => {
    const flat = createView({ focus: [0, 100, 0], range: 50000 });
    for (const view of [flat, orbitBy(flat, [0.4, 0.9])]) {
      const above = project(view, [3000, 1100, 2000]);
      const below = project(view, [3000, -900, 2000]);
      const level = project(view, [3000, 100, 2000]);
      expect(above.v).toBeLessThan(above.foot[1]);
      expect(below.v).toBeGreaterThan(below.foot[1]);
      expect(level.v).toBe(level.foot[1]);
      expect(above.foot).toEqual(below.foot);
    }
  });
  it('tilts and turns, and comes back the same way or with one flatten', () => {
    const view = createView({ focus: [200, 0, -100], range: 70000 });
    for (const back of [orbitBy(orbitBy(view, [0.7, 0.5]), [-0.7, -0.5]), flatten(orbitBy(view, [2.1, 1.0]))]) {
      for (const p of pts) {
        expect(project(back, p).u).toBeCloseTo(project(view, p).u, 12);
        expect(project(back, p).v).toBeCloseTo(project(view, p).v, 12);
      }
    }
    expect(orbitBy(view, [0, 9]).pitch).toBe(CHART.pitchMax);
    expect(orbitBy(view, [0, -9]).pitch).toBe(0);
    const tilted = orbitBy(view, [0, 0.8]);
    expect(project(tilted, [0, 0, 20000]).depth).toBeGreaterThan(project(tilted, [0, 0, -20000]).depth);
  });
  it('pans with the hand: the old middle goes where the drag went, a drag back undoes it, and it re-centres on the ship', () => {
    const view = createView({ focus: [1000, 0, 2000], range: 10000, follow: true });
    const moved = panBy(view, [0.1, 0]);
    expect(moved.follow).toBe(false);
    expect(moved.focus[0]).toBeLessThan(1000);
    expect(moved.focus[2]).toBeCloseTo(2000, 9);
    expect(project(moved, view.focus).u).toBeCloseTo(0.1, 12);
    expect(project(moved, view.focus).v).toBeCloseTo(0, 12);
    const turned = orbitBy(view, [1.1, 0.7]);
    panBy(panBy(turned, [0.23, -0.17]), [-0.23, 0.17]).focus.forEach((f, i) => expect(f).toBeCloseTo(turned.focus[i], 9));
    expect(recentre(moved, { x: 9, y: 8, z: 7 })).toMatchObject({ focus: [9, 8, 7], follow: true });
  });
  it('keeps a far ship on the chart, pinned to its rim', () => {
    const view = createView({ range: CHART.range.min });
    for (const far of [[1e9, 4e8, -1e9], [-1e12, 0, 3], [0, -1e9, 0]]) {
      const p = project(view, far);
      const nav = toFrame(FRAMES.nav, [p.u, p.v], { pin: true });
      expect(nav.edge).toBe(true);
      expect(Math.hypot(nav.x - 500, nav.y - 500)).toBeLessThanOrEqual(470);
      const mini = toFrame(FRAMES.mini, [p.u, p.v], { pin: true });
      expect(mini.x).toBeGreaterThanOrEqual(8);
      expect(mini.x).toBeLessThanOrEqual(592);
      expect(mini.y).toBeGreaterThanOrEqual(8);
      expect(mini.y).toBeLessThanOrEqual(292);
    }
  });
  it('never goes NaN at the focus or on a bad zoom', () => {
    const view = createView({ focus: [1, 2, 3] });
    expect(Object.values(project(view, [1, 2, 3])).flat().every((n) => typeof n !== 'number' || Number.isFinite(n))).toBe(true);
    expect(unproject(view, [0, 0])).toEqual([1, 2, 3]);
    for (const f of [NaN, 0, -2, Infinity]) expect(zoomBy(view, f)).toBe(view);
  });
  it('names the level by the zoom', () => {
    expect([CHART.range.min, 7999, 8000, CHART.range.open, 249999, 250000, CHART.range.max].map(levelOf)).toEqual(['system', 'system', 'neighbourhood', 'neighbourhood', 'neighbourhood', 'universe', 'universe']);
  });
  it('sizes a body by its reach, and rings the ship in powers of ten', () => {
    expect(reachOn(createView({ range: 100000 }), [0, 0, 50000], 1000)).toBeCloseTo((0.51 ** 0.375 - 0.49 ** 0.375) / 2, 12);
    expect(ringsFor(120000)).toEqual([10000, 100000]);
    expect(ringsFor(5000)).toEqual([100, 1000]);
  });
});
