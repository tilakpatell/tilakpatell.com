import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { budget } from '../../../lib/budgets';
import { loadKit } from '../../../lib/three/kitNodes';
import { MANIFEST, fakeLoad } from '../../../lib/three/kit.fixture';
import { SIZE, createLiving, keepOf, reachOf, shadeOf, shareOf } from './living';
import { createSolids } from './walker';

const flat = () => 0;
// (the fixture kit's models, rows as livingRows writes them)
const ROWS = {
  cover: [{ band: 'cover', kind: 'fern', model: 'kit:naturemega/Fern_1', per100: 4, clump: 4, spread: 3, scale: [1, 1] }],
  mid: [{ band: 'mid', kind: 'rock', model: 'kit:naturemega/Rock_1', per100: 0.4, clump: 2, spread: 4, scale: [1, 1] }],
  trees: [{ band: 'trees', kind: 'tree', model: 'kit:naturemega/Birch_1', per100: 0.3, clump: 3, spread: 8, scale: [1, 1.2], solid: 0.45, canopy: 3, clear: 25 }],
};
const kitFor = () => loadKit('naturemega', { load: fakeLoad(), manifest: MANIFEST });
const livingOf = (more = {}) => {
  const kit = kitFor();
  const solids = createSolids();
  const living = createLiving({ rows: ROWS, kitFor: () => kit, level: 'high', seed: 3, height: flat, keep: () => true, solids, ...more });
  return { living, solids };
};
const cam = (x = 0, z = 0) => {
  const c = new THREE.PerspectiveCamera();
  c.position.set(x, 2, z);
  return c;
};

describe('reachOf and shareOf', () => {
  it('lays each band out from the level’s kit bands, more on a higher level', () => {
    const high = reachOf('high');
    expect(high).toEqual({ near: Math.round(budget('high').near * 0.6), cover: budget('high').near + 40, mid: 2 * budget('high').mid, trees: budget('high').far });
    // (the thick cover round you fades into the rest well inside it)
    expect(high.near).toBeLessThan(high.cover / 2);
    expect(reachOf('low').cover).toBeLessThan(high.cover);
    expect(reachOf('low').trees).toBeLessThan(high.trees);
    // (ultra's bushes kept to 600 m: its full meshes stand to 400)
    expect(reachOf('ultra').mid).toBe(600);
    // (the trees as far as across the core of a world, and further on ultra)
    expect(high.trees).toBeGreaterThan(640);
  });

  it('lays the level’s props share of each row, and no grass clumps on low', () => {
    const grass = { kind: 'grassclump' };
    expect(shareOf('high')(grass)).toBe(1);
    expect(shareOf('mid')(grass)).toBe(budget('mid').props);
    expect(shareOf('low')(grass)).toBe(0);
    expect(shareOf('low')({ kind: 'fern' })).toBe(budget('low').props);
  });
});

describe('keepOf', () => {
  const site = { reach: 590 };
  const solids = createSolids();
  solids.box(50, 50, 4, 4);
  const clearings = [];
  const keep = keepOf({ site, heightAt: (x) => (x < -100 ? -5 : 0), solids, avoid: [{ at: [200, 0], r: 40 }, { at: [0, 0], r: 30 }], clearings, wade: -2 });
  const tuft = { band: 'cover' };
  const tree = { band: 'trees', clear: 25 };

  it('keeps off a flat and the landing, a row’s own clear further', () => {
    expect(keep(0, 20, tuft)).toBe(false);
    expect(keep(0, 40, tuft)).toBe(true);
    expect(keep(200, 50, tuft)).toBe(true);
    expect(keep(200, 50, tree)).toBe(false);
    expect(keep(200, 70, tree)).toBe(true);
  });

  it('keeps out of the water, out of a wall and inside the ground', () => {
    expect(keep(-150, 0, tuft)).toBe(false);
    expect(keep(50, 50, tuft)).toBe(false);
    expect(keep(50, 54.4, tuft)).toBe(false);
    expect(keep(50, 56, tuft)).toBe(true);
    expect(keep(600, 600, tuft)).toBe(false);
    expect(keep(0, 635, tuft)).toBe(false);
    // (a tree takes no notice of a wall: its shade is laid before the walls are in)
    expect(keep(50, 50, tree)).toBe(true);
  });

  it('keeps the cover off where your ship came down, once it’s known, and the trees as they were', () => {
    expect(keep(300, 300, tuft)).toBe(true);
    clearings.push({ at: [300, 300], r: 30 });
    expect(keep(300, 320, tuft)).toBe(false);
    expect(keep(300, 320, tree)).toBe(true);
    clearings.length = 0;
  });
});

describe('createLiving', () => {
  it('lays every band’s tiles round you, its trunks solid', async () => {
    const { living, solids } = livingOf();
    living.fill(10, 10);
    const reach = reachOf('high');
    // (every band's tiles within its reach: about the disc's area in tiles)
    const want = ['cover', 'mid', 'trees'].reduce((s, b) => s + (Math.PI * reach[b] ** 2) / SIZE[b] ** 2, 0);
    expect(living.stats.tiles).toBeGreaterThan(want);
    expect(living.stats.tiles).toBeLessThan(want * 1.8);
    expect(living.stats.queued).toBe(0);
    expect(solids.all.length).toBeGreaterThan(0);
    expect(solids.all.every((s) => s.type === 'circle' && s.r >= 0.45 && s.r <= 0.45 * 1.2 + 1e-9)).toBe(true);
    living.update(10, 10, cam(10, 10), 0.016);
    await new Promise((r) => setTimeout(r, 20));
    expect(living.stats.total).toBeGreaterThan(0);
    living.dispose();
    expect(solids.all).toEqual([]);
  });

  it('lets the tiles you leave go, their trunks with them, and lays the new ones a few a frame', () => {
    const { living, solids } = livingOf();
    living.fill(0, 0);
    const before = living.stats.tiles;
    const trunks = solids.all.length;
    living.update(2000, 0, cam(2000, 0), 0.016);
    // (all of the old ring gone at once; the new one laid over the frames to
    // come, but for the tiles under you, laid at once)
    expect(living.stats.tiles).toBeLessThan(before);
    expect(living.stats.tiles).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < 400 && living.stats.queued; i++) living.update(2000, 0, cam(2000, 0), 0.016);
    expect(living.stats.queued).toBe(0);
    expect(living.stats.tiles).toBeGreaterThan(before * 0.9);
    expect(solids.all.every((s) => Math.abs(s.x - 2000) < reachOf('high').trees + 2 * SIZE.trees)).toBe(true);
    expect(Math.abs(solids.all.length - trunks)).toBeLessThan(trunks);
    living.dispose();
  });

  it('is the same ground on a return, and keeps what keep allows', () => {
    const solids = createSolids();
    const kit = kitFor();
    const a = createLiving({ rows: ROWS, kitFor: () => kit, seed: 3, height: flat, keep: () => true, solids });
    a.fill(0, 0);
    const first = solids.all.map((s) => [s.x, s.z]);
    a.update(3000, 0, cam(), 0.016);
    a.fill(0, 0);
    expect(solids.all.map((s) => [s.x, s.z]).sort()).toEqual(first.sort());
    a.dispose();
    const b = createLiving({ rows: ROWS, kitFor: () => kit, seed: 3, height: flat, keep: (x) => x > 0, solids });
    b.fill(0, 0);
    expect(solids.all.length).toBeGreaterThan(0);
    expect(solids.all.every((s) => s.x > 0)).toBe(true);
    b.dispose();
  });

  it('lays every tile in again on refresh, once the walls are in, its trunks not doubled', () => {
    let wall = false;
    const { living, solids } = livingOf({ keep: (x, z, row) => !(wall && row.band === 'trees' && x < 0) });
    living.fill(0, 0);
    const n = solids.all.length;
    living.refresh();
    expect(solids.all.length).toBe(n);
    wall = true;
    living.refresh();
    expect(solids.all.length).toBeLessThan(n);
    expect(solids.all.every((s) => s.x >= 0)).toBe(true);
    living.dispose();
  });

  it('draws each band’s pools to its reach: the trees far past where a kit model’s puff would stop', async () => {
    const { living } = livingOf();
    living.fill(0, 0);
    await living.ready;
    living.update(0, 0, cam(0, 0), 0.016);
    let farthest = 0;
    living.group.traverse((o) => {
      if (!o.isInstancedMesh || !o.name.startsWith('Birch_1') || !o.count) return;
      for (let i = 0; i < o.count; i++) {
        const e = o.instanceMatrix.array.subarray(i * 16, i * 16 + 16);
        if (e[5] > 0) farthest = Math.max(farthest, Math.hypot(e[12], e[14]));
      }
    });
    expect(farthest).toBeGreaterThan(2 * budget('high').mid);
    expect(farthest).toBeLessThan(reachOf('high').trees * 1.06);
    living.dispose();
  });

  it('lays every tile in again over the frames after the ground moves, and none of them twice', () => {
    let lift = 0;
    const solids = createSolids();
    const kit = kitFor();
    const living = createLiving({ rows: ROWS, kitFor: () => kit, seed: 3, height: () => lift, keep: () => true, solids });
    living.fill(0, 0);
    const tiles = living.stats.tiles;
    const trunks = solids.all.length;
    lift = 5;
    living.relay();
    expect(living.stats.queued).toBe(tiles);
    for (let i = 0; i < 500 && living.stats.queued; i++) living.update(0, 0, cam(), 0.016);
    expect(living.stats.queued).toBe(0);
    expect(living.stats.tiles).toBe(tiles);
    expect(solids.all.length).toBe(trunks);
    living.dispose();
  });

  it('still lays the tiles in again when you walk on before they are', async () => {
    let lift = 0;
    const kit = kitFor();
    const living = createLiving({ rows: ROWS, kitFor: () => kit, seed: 3, height: () => lift, keep: () => true, solids: createSolids() });
    living.fill(0, 0);
    await living.ready;
    lift = 5;
    living.relay();
    // (ten metres on at once: the ring is looked at again before any is in)
    for (let i = 0; i < 2000 && living.stats.queued; i++) living.update(10, 0, cam(10, 0), 0.016);
    expect(living.stats.queued).toBe(0);
    // (the pools take their items a moment later, then draw them)
    await new Promise((r) => setTimeout(r, 0));
    living.update(10, 0, cam(10, 0), 1);
    const ys = [];
    living.group.traverse((o) => {
      if (!o.isInstancedMesh || !o.count) return;
      for (let i = 0; i < o.count; i++) ys.push(o.instanceMatrix.array[i * 16 + 13]);
    });
    // (each at the new ground's height, a rock's own half-metre over it)
    expect(ys.length).toBeGreaterThan(100);
    expect(ys.filter((y) => y < 5 - 1e-4)).toEqual([]);
    living.dispose();
  });

  it('keeps no bound or edge in the free roam', () => {
    const k = keepOf({ site: { reach: 590 }, heightAt: () => 0, avoid: [], bound: Infinity, edge: Infinity });
    expect(k(5000, -7000, { band: 'cover' })).toBe(true);
    expect(keepOf({ site: { reach: 590 }, heightAt: () => 0, avoid: [] })(5000, -7000, { band: 'cover' })).toBe(false);
  });

  it('lays only the bands a world has', () => {
    const { living, solids } = livingOf({ rows: { cover: ROWS.cover, mid: [], trees: [] } });
    living.fill(0, 0);
    expect(living.stats.tiles).toBeLessThan((Math.PI * (reachOf('high').cover + SIZE.cover) ** 2) / SIZE.cover ** 2);
    expect(solids.all).toEqual([]);
    living.dispose();
  });
});

describe('shadeOf', () => {
  it('shades under the same trees the stream lays, each its crown', () => {
    const solids = createSolids();
    const kit = kitFor();
    const keep = (x, z) => Math.hypot(x, z) < 200;
    const living = createLiving({ rows: ROWS, kitFor: () => kit, level: 'high', seed: 3, height: flat, keep, solids });
    living.fill(0, 0);
    const shade = shadeOf(ROWS.trees, { level: 'high', seed: 3, height: flat, keep, half: 256 });
    expect(shade.length).toBe(solids.all.length);
    const at = new Set(shade.map((s) => `${s.at[0].toFixed(3)},${s.at[1].toFixed(3)}`));
    expect(solids.all.every((s) => at.has(`${s.x.toFixed(3)},${s.z.toFixed(3)}`))).toBe(true);
    expect(shade.every((s) => s.r >= 3 && s.r <= 3.6 + 1e-9)).toBe(true);
    living.dispose();
  });
});
