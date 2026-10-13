// The way to a far place over the navgrid: one field a goal, walked down a
// leg at a time by every bot sent there.
import { describe, expect, it } from 'vitest';
import { buildNav, cellAt, findPath, walkable } from './nav.js';
import { buildMask } from './navMask.js';
import { FIELD_KEPT, FIELD_REACH, distAt, fieldTo, legAlong } from './navField.js';

// flat ground ±300 m with a wall 400 m long across it at z = 0 (its one way round at the east end, x > 200),
// a room walled on every side in the south-west, and in the north a wall 100 m long and thinner than a
// cell, lying between the cells' middles: the navgrid's cells are open through it, and no soldier fits
const bounds = { min: [-300, -300], max: [300, 300] };
const RECTS = [
  { x: [-300, 200], z: [-1, 1] },
  { x: [-260, -240], z: [-261, -259] },
  { x: [-260, -240], z: [-241, -239] },
  { x: [-261, -259], z: [-260, -240] },
  { x: [-241, -239], z: [-260, -240] },
  { x: [-50, 50], z: [199.9, 200.1] },
  // (a block whose east face is on the line of the cells' middles at x = 101: a soldier a hair west of that line does not fit)
  { x: [100.3, 100.7], z: [240.3, 241.7] },
];
const inRect = (q, x, z, r) => x > q.x[0] - r && x < q.x[1] + r && z > q.z[0] - r && z < q.z[1] + r;
const mask = buildMask({ bounds, cell: 2, fine: 0.5, heightAt: () => 0, blockedAt: (x, y, z, r) => RECTS.some((q) => inRect(q, x, z, r)), topAt: () => 3, capsule: { step: 0.4, height: 1.7, radius: 0.3 } });
const make = () => buildNav({ heightAt: () => 0, bounds, cell: 2, solids: [], cover: {}, mask });
const nav = make();
const lengthOf = (p) => p.slice(1).reduce((n, q, k) => n + Math.hypot(q[0] - p[k][0], q[1] - p[k][1]), 0);
const clear = (a, b) => {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5);
  for (let k = 0; k <= n; k++) if (!walkable(nav, a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n)) return false;
  return true;
};

describe('a field to a place', () => {
  const goal = [101, 61];
  const f = fieldTo(nav, goal);

  it('is nothing at the place and the straight way where nothing stands between', () => {
    expect(distAt(nav, f, goal)).toBeLessThan(2);
    expect(distAt(nav, f, [101, 161])).toBeGreaterThanOrEqual(98);
    expect(distAt(nav, f, [101, 161])).toBeLessThan(104);
  });

  it('is the way round a wall, not the line through it', () => {
    // (from just south of the wall, 82 m off in a line: 100 m east to its end and back)
    const d = distAt(nav, f, [101, -21]);
    expect(d).toBeGreaterThan(205);
    expect(d).toBeLessThan(250);
  });

  it('is the same way one search finds where one search reaches', () => {
    const p = findPath(nav, [150, -30], goal, { max: 200000 });
    expect(Math.abs(distAt(nav, f, [150, -30]) - lengthOf(p))).toBeLessThan(lengthOf(p) * 0.08);
  });

  it('has no way from a place walled off, nor from past its reach', () => {
    expect(distAt(nav, f, [-250, -250])).toBe(Infinity);
    expect(FIELD_REACH).toBeGreaterThanOrEqual(300);
    const far = buildNav({ heightAt: () => 0, bounds: { min: [-1000, -10], max: [1000, 10] }, cell: 2, solids: [], cover: {} });
    const g = fieldTo(far, [0, 0]);
    expect(distAt(far, g, [FIELD_REACH - 20, 0])).toBeLessThan(FIELD_REACH);
    expect(distAt(far, g, [FIELD_REACH + 60, 0])).toBe(Infinity);
    // (and a place near in a line whose way round is past the reach: a search finds it, the field holds none)
    const round = fieldTo(nav, [1, 61]);
    expect(findPath(nav, [1, -21], [1, 61], { max: 400000 })).not.toBeNull();
    expect(distAt(nav, round, [1, -21])).toBe(Infinity);
  });

  it('cuts no corner between two shut cells, as the search does not', () => {
    const flat = buildNav({ heightAt: () => 0, bounds: { min: [0, 0], max: [40, 40] }, cell: 2, solids: [], cover: {} });
    // (two cells shut that touch at a corner, at [20, 20]: the way between their other two neighbours is round one of them)
    const at = (x, z) => cellAt(flat, x, z)[1] * flat.cols + cellAt(flat, x, z)[0];
    flat.walk[at(19, 19)] = 0;
    flat.walk[at(21, 21)] = 0;
    const g = fieldTo(flat, [19, 21]);
    expect(distAt(flat, g, [21, 19])).toBeGreaterThan(6);
    expect(distAt(flat, g, [17, 23])).toBeLessThan(3);
  });

  it('is kept by its place: asked again it is the same one, and the oldest is let go past the number kept', () => {
    const own = make();
    const a = fieldTo(own, goal);
    expect(fieldTo(own, [goal[0] + 0.4, goal[1] - 0.4])).toBe(a);
    for (let k = 1; k <= FIELD_KEPT; k++) fieldTo(own, [k * 10, 100]);
    expect(own.fields.size).toBe(FIELD_KEPT);
    expect(fieldTo(own, goal)).not.toBe(a);
  });

  it('a place in a blocked cell is taken at the nearest open one', () => {
    const g = fieldTo(nav, [191, 0.2]);
    expect(g).not.toBeNull();
    expect(Number.isFinite(distAt(nav, g, [191, 7]) + distAt(nav, g, [191, -7]))).toBe(true);
  });
});

describe('a leg down the field', () => {
  const goal = [101, 61];
  const f = fieldTo(nav, goal);

  it('goes toward the wall’s end, not at the wall, each stretch of it open', () => {
    const from = [101, -21];
    const leg = legAlong(nav, f, from, 40);
    expect(leg[0]).toEqual(from);
    expect(leg.length).toBeGreaterThan(1);
    const end = leg[leg.length - 1];
    expect(end[0]).toBeGreaterThan(126);
    expect(end[1]).toBeLessThan(0);
    expect(distAt(nav, f, end)).toBeLessThan(distAt(nav, f, from) - 30);
    for (let k = 1; k < leg.length; k++) expect(clear(leg[k - 1], leg[k])).toBe(true);
    expect(lengthOf(leg)).toBeLessThan(46);
  });

  it('is pulled straight where the way is open: two points across open ground', () => {
    const leg = legAlong(nav, f, [101, 161], 40);
    expect(leg).toHaveLength(2);
    expect(lengthOf(leg)).toBeGreaterThan(36);
  });

  it('walked leg after leg it comes to the place', () => {
    let at = [1, -41];
    let walked = 0;
    for (let k = 0; k < 40 && Math.hypot(at[0] - goal[0], at[1] - goal[1]) > 3; k++) {
      const leg = legAlong(nav, f, at, 40);
      walked += lengthOf(leg);
      at = leg[leg.length - 1];
    }
    expect(Math.hypot(at[0] - goal[0], at[1] - goal[1])).toBeLessThanOrEqual(3);
    expect(walked).toBeLessThan(distAt(nav, f, [1, -41]) * 1.05 + 4);
  });

  it('ends at the place when it is nearer than the leg', () => {
    const leg = legAlong(nav, f, [111, 71], 40);
    const end = leg[leg.length - 1];
    expect(cellAt(nav, end[0], end[1])).toEqual(cellAt(nav, goal[0], goal[1]));
  });

  it('is none from where there is no way', () => {
    expect(legAlong(nav, f, [-250, -250], 40)).toBeNull();
  });
});

describe('a wall thinner than a cell', () => {
  const goal = [1, 211];
  const from = [1, 189];

  it('is walked through by one search, whose cells are open on both sides of it', () => {
    const p = findPath(nav, from, goal);
    expect(lengthOf(p)).toBeLessThan(24);
    expect(clear(p[0], p[p.length - 1])).toBe(false);
  });

  it('is gone round by the field: the way is by its end', () => {
    const f = fieldTo(nav, goal);
    const d = distAt(nav, f, from);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(140);
  });

  it('a leg down the field never crosses it', () => {
    const f = fieldTo(nav, goal);
    let at = from;
    for (let k = 0; k < 12 && Math.hypot(at[0] - goal[0], at[1] - goal[1]) > 3; k++) {
      const leg = legAlong(nav, f, at, 40);
      for (let j = 1; j < leg.length; j++) expect(clear(leg[j - 1], leg[j])).toBe(true);
      at = leg[leg.length - 1];
    }
    expect(Math.hypot(at[0] - goal[0], at[1] - goal[1])).toBeLessThanOrEqual(3);
  });
});

describe('a wall whose face is on the line of the cells’ middles', () => {
  // a soldier fits a hand to either side of a stretch, not on its line alone
  const roomy = (a, b) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const side = [(-(b[1] - a[1]) / d) * 0.2, ((b[0] - a[0]) / d) * 0.2];
    return [-1, 1].every((k) => clear([a[0] + side[0] * k, a[1] + side[1] * k], [b[0] + side[0] * k, b[1] + side[1] * k]));
  };

  it('is open on that line itself, and shut a hair to its west', () => {
    expect(clear([101, 236], [101, 246])).toBe(true);
    expect(clear([100.9, 236], [100.9, 246])).toBe(false);
  });

  it('is passed with room: no stretch of a leg runs along its face', () => {
    const goal = [101, 251];
    const f = fieldTo(nav, goal);
    let at = [101, 231];
    for (let k = 0; k < 6 && Math.hypot(at[0] - goal[0], at[1] - goal[1]) > 3; k++) {
      const leg = legAlong(nav, f, at, 40);
      for (let j = 1; j < leg.length; j++) expect(roomy(leg[j - 1], leg[j])).toBe(true);
      at = leg[leg.length - 1];
    }
    expect(Math.hypot(at[0] - goal[0], at[1] - goal[1])).toBeLessThanOrEqual(3);
  });
});
