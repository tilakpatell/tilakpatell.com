// The line of fire a bot asks the navgrid for (ai/soldierBrain.js: its muzzle
// to its target's chest), on small grids made by hand and on Hoth's own
// ground (fixtures/hothGround.js: the page's grid round the command posts,
// with the answer of a ray cast on the game's own shapes for each pair).
import { beforeAll, describe, expect, it } from 'vitest';
import { muzzleOf } from './core.js';
import { hothGround, pairsOf } from './fixtures/hothGround.js';
import { buildNav, cellAt, firstSolid, heightAt, lineClear, walkable } from './nav.js';
import { buildMask, fineBlocked, unmeasuredTop } from './navMask.js';
import { chestOf } from './soldier.js';

const BOUNDS = { min: [-40, -40], max: [40, 40] };
const CAPSULE = { step: 0.4, height: 1.7, radius: 0.3 };
const soldier = (x, z, ground, { stance = 'stand', yaw = 0 } = {}) => ({ at: [x, ground(x, z), z], stance, yaw });
// the line a bot asks for: its muzzle to the other's chest
const line = (nav, a, b) => lineClear(nav, muzzleOf(a), chestOf(b));

// a mask over flat ground from rectangles a capsule cannot stand in, its tops as
// the pack's builder writes them (scripts/lib/bf2017-nav.mjs's topAt): the
// shape's under a ray down the cell's middle, the capsule's height where that
// ray meets none
const inRect = (q, x, z, r) => x > q.x[0] - r && x < q.x[1] + r && z > q.z[0] - r && z < q.z[1] + r;
function maskOf(rects, capsule = CAPSULE) {
  const blockedAt = (x, y, z, r) => rects.some((q) => inRect(q, x, z, r));
  const topAt = (x, z) => rects.find((q) => inRect(q, x, z, 0))?.top ?? CAPSULE.height;
  return buildMask({ bounds: BOUNDS, cell: 2, fine: 0.5, heightAt: () => 0, blockedAt, topAt, capsule });
}
const flat = () => 0;

describe('a line of fire over the ground', () => {
  it('is clear between two soldiers standing on one slope', () => {
    const slope = (x, z) => 0.3 * z;
    const nav = buildNav({ heightAt: slope, bounds: BOUNDS });
    const low = soldier(0, -30, slope, { yaw: 0 });
    const high = soldier(0, 30, slope, { yaw: Math.PI });
    expect(line(nav, low, high)).toBe(true);
    expect(line(nav, high, low)).toBe(true);
    // (and across the slope, and along a slant of it)
    expect(line(nav, soldier(-30, 10, slope), soldier(30, 10, slope))).toBe(true);
    expect(line(nav, soldier(-30, -20, slope), soldier(30, 25, slope))).toBe(true);
  });

  it('is stopped by a crest between a soldier below it and one beyond it', () => {
    const ridge = (x, z) => Math.max(0, 3 - Math.abs(z) * 0.5);
    const nav = buildNav({ heightAt: ridge, bounds: BOUNDS });
    const south = soldier(0, -15, ridge);
    const north = soldier(0, 15, ridge, { yaw: Math.PI });
    expect(line(nav, south, north)).toBe(false);
    expect(firstSolid(nav, muzzleOf(south), chestOf(north)).solid).toBe(-1);
    // (from the crest itself both are in sight)
    const top = soldier(0, 0, ridge);
    expect(line(nav, top, north)).toBe(true);
    expect(line(nav, top, south)).toBe(true);
  });

  it('starts from a crouched soldier’s own muzzle, under the standing one', () => {
    // a wall 1.2 m tall, 2 m in front of the one who fires, the target 10 m off
    const nav = buildNav({ heightAt: flat, bounds: BOUNDS, mask: maskOf([{ x: [-6, 6], z: [0, 2], top: 1.2 }]) });
    const target = soldier(1, 9, flat, { yaw: Math.PI });
    expect(line(nav, soldier(1, -1, flat), target)).toBe(true);
    expect(line(nav, soldier(1, -1, flat, { stance: 'crouch' }), target)).toBe(false);
  });

  it('answers as it did for a line that leaves the grid, and for one that ends where the ground has no height', () => {
    const nav = buildNav({ heightAt: flat, bounds: BOUNDS });
    expect(lineClear(nav, [0, 1.2, 0], [0, 1.2, 80])).toBe(true);
    expect(lineClear(nav, [0, 1.2, 60], [0, 1.2, 80])).toBe(true);
    // (off the grid the ground is the edge's own: a line under it is still stopped)
    expect(lineClear(nav, [0, 1.2, 0], [0, -3, 80])).toBe(false);
    const holed = buildNav({ heightAt: (x, z) => (z > 20 ? NaN : 0), bounds: BOUNDS });
    expect(lineClear(holed, [0, 1.2, 0], [0, 1.2, 30])).toBe(true);
  });
});

describe('a line of fire across the mask', () => {
  // a rock under its cell's middle, 2.5 m tall and smaller than the cell (the cell is x 0…2, z 20…22)
  const ROCK = { x: [0.6, 1.4], z: [20.6, 21.4], top: 2.5 };
  // a wall half a metre thick beside its cells' middles (the cells are x 0…2, their middles x 1), 2.5 m tall
  const WALL = { x: [1.2, 1.7], z: [-6, 6], top: 2.5 };
  // a sheet 5 cm thick beside its cells' middles: the capsule cannot stand in one fine cell's width of it
  const SHEET = { x: [1.25, 1.3], z: [-36, -24], top: 2.5 };
  const mask = maskOf([ROCK, WALL, SHEET]);
  const nav = buildNav({ heightAt: flat, bounds: BOUNDS, mask });
  const top = (x, z) => mask.top[cellAt(nav, x, z)[1] * nav.cols + cellAt(nav, x, z)[0]];

  it('is stopped by a cell whose top was measured, at any height under that top', () => {
    expect(top(1, 21)).toBe(25);
    for (const y of [0.2, 1.2, 2.4]) expect(lineClear(nav, [1, y, 10], [1, y, 30])).toBe(false);
    expect(lineClear(nav, [1, 2.6, 10], [1, 2.6, 30])).toBe(true);
    expect(firstSolid(nav, [1, 1.2, 10], [1, 1.2, 30]).solid).toBe(-2);
  });

  it('is stopped over the whole of a measured cell, the corner its rock leaves open too', () => {
    // (the fine grid has room for a capsule in the cell's corner; the rock's top says nothing of its sides)
    expect(fineBlocked(mask, 0.25, 20.25)).toBe(false);
    expect(lineClear(nav, [0.25, 1.2, 10], [0.25, 1.2, 30])).toBe(false);
    expect(lineClear(nav, [-10, 1.2, 20.25], [10, 1.2, 20.25])).toBe(false);
  });

  it('knows the top its builder wrote where the ray down a cell’s middle met no shape', () => {
    expect(unmeasuredTop(mask)).toBe(17);
    expect(top(1, 0)).toBe(17);
    expect(unmeasuredTop(maskOf([WALL], {}))).toBe(0);
  });

  it('passes the open side of a cell whose top was never measured', () => {
    // the wall stands in the cell's east half: west of it a soldier can stand, and sees along the wall
    expect(walkable(nav, 0.5, 0)).toBe(true);
    expect(fineBlocked(mask, 0.5, 0)).toBe(false);
    expect(lineClear(nav, [0.5, 1.2, -18], [0.5, 1.2, 18])).toBe(true);
    const beside = soldier(0.5, 0, flat, { yaw: -Math.PI / 2 });
    expect(line(nav, beside, soldier(-20, 0, flat))).toBe(true);
    expect(line(nav, beside, soldier(-12, 16, flat))).toBe(true);
  });

  it('is still stopped by the wall in that cell, wherever the line’s samples fall', () => {
    expect(lineClear(nav, [1.5, 1.2, -18], [1.5, 1.2, 18])).toBe(false);
    const beside = soldier(0.5, 0, flat, { yaw: Math.PI / 2 });
    expect(line(nav, beside, soldier(20, 0, flat))).toBe(false);
    // across the wall from every start a tenth of a metre apart, square and on a slant
    for (let k = 0; k <= 20; k++) {
      const x = -10 - k / 10;
      expect(lineClear(nav, [x, 1.2, 0.3], [x + 22, 1.2, 0.3])).toBe(false);
      expect(lineClear(nav, [x, 1.2, -4], [x + 22, 1.2, 4])).toBe(false);
      expect(lineClear(nav, [x, 1.2, 5], [x + 22, 1.2, -5.5])).toBe(false);
    }
    const hit = firstSolid(nav, [-10, 1.2, 0.3], [12, 1.2, 0.3]);
    expect(hit.solid).toBe(-2);
    // (where the capsule no longer fits beside the wall: its west face, 1.2, less the capsule's 0.3, to the fine grid's half metre)
    expect(hit.at[0]).toBeGreaterThanOrEqual(0.5);
    expect(hit.at[0]).toBeLessThanOrEqual(1.2);
  });

  it('does not step over a shape narrower than the gap between two of its samples', () => {
    // (the sheet's blocked fine cells are half a metre wide; the line is sampled every metre)
    expect([0.75, 1.25, 1.75].map((x) => fineBlocked(mask, x, -30))).toEqual([false, true, false]);
    for (let k = 0; k <= 20; k++) {
      const x = -10 - k / 20;
      expect(lineClear(nav, [x, 1.2, -30], [x + 22, 1.2, -30])).toBe(false);
      expect(lineClear(nav, [x + 22, 1.2, -30], [x, 1.2, -30])).toBe(false);
    }
    expect(lineClear(nav, [0.75, 1.2, -38], [0.75, 1.2, -22])).toBe(true);
  });

  it('keeps the whole cell where the mask names no capsule or holds no fine grid', () => {
    const bare = buildNav({ heightAt: flat, bounds: BOUNDS, mask: maskOf([WALL], {}) });
    expect(lineClear(bare, [0.5, 1.2, -18], [0.5, 1.2, 18])).toBe(false);
    const coarse = buildNav({ heightAt: flat, bounds: BOUNDS, mask: { ...mask, fine: null } });
    expect(lineClear(coarse, [0.5, 1.2, -18], [0.5, 1.2, 18])).toBe(false);
  });
});

// Hoth's ground round its five command posts, where a round is fought: the
// page's grid, and what the level itself leaves clear (a ray cast on the
// game's shapes and its heightmap) for 1,000 pairs of standing places 10 to
// 60 m apart. Half of them are truly out of sight of each other. The counts
// are the measure's own (2026-10-13); they may only get better.
describe('on Hoth’s own ground', () => {
  let g;
  let count;
  beforeAll(async () => {
    g = await hothGround();
    count = { clear: 0, agree: 0, wronglyStopped: 0, wronglyClear: 0 };
    for (const p of g.pairs) {
      const clear = lineClear(g.nav, p.a, p.b);
      if (clear) count.clear++;
      if (clear === p.clear) count.agree++;
      else if (p.clear) count.wronglyStopped++;
      else count.wronglyClear++;
    }
  });

  it('is the page’s grid there, with the pack’s mask on it', () => {
    expect([g.nav.cols, g.nav.rows, g.nav.cell]).toEqual([153, 164, 2]);
    expect(g.nav.mask).toBe(g.mask);
    expect(g.nav.unmeasured).toBe(17);
    expect(Object.keys(g.sources)).toEqual(['level.json', 'nav.bin', 'terrain/near.png', 'terrain/far.png', 'physics']);
    // (the same pairs every time: the maker's answers are for these)
    expect(pairsOf(g.nav, { seed: 2017, count: 3 })).toEqual(g.pairs.slice(0, 3).map((p) => [p.a, p.b]));
  });

  it('leaves about half the pairs a line, as the level does', () => {
    expect(g.pairs.length).toBe(1000);
    expect(g.pairs.filter((p) => p.clear).length).toBe(506);
    expect(count.clear).toBeGreaterThanOrEqual(496);
    expect(count.clear).toBeLessThanOrEqual(516);
  });

  it('agrees with the game’s own shapes on 94 pairs in 100', () => {
    expect(count.agree).toBeGreaterThanOrEqual(940);
  });

  it('stops no more lines the level leaves clear than it did', () => {
    expect(count.wronglyStopped).toBeLessThanOrEqual(30);
  });

  it('lets no more lines through what the level stops than it did', () => {
    // (the thirty are over shapes the grid does not hold: low ones a soldier steps on, in cells with no top)
    expect(count.wronglyClear).toBeLessThanOrEqual(30);
  });

  it('never clears a line the ground alone stops, marched twice as finely, but for one pair', () => {
    // the plan's own reference: the segment against the grid's bilinear height every quarter cell
    const ground = (a, b) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / (g.nav.cell / 4)));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        if (a[1] + (b[1] - a[1]) * t < heightAt(g.nav, a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t) - 0.05) return false;
      }
      return true;
    };
    expect(g.pairs.filter((p) => !ground(p.a, p.b) && lineClear(g.nav, p.a, p.b)).length).toBeLessThanOrEqual(1);
  });
});