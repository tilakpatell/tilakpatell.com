import { describe, expect, it } from 'vitest';
import { TILE, coverTile, tileSeed, tilesAround } from './cover';

const flat = () => 0;
const tufts = { model: 'Grass_Common_Short', per100: 10, clump: 5, spread: 3, scale: [0.4, 0.6] };

describe('tilesAround', () => {
  it('lists every tile within reach, nearest first, your own at 0', () => {
    const ring = tilesAround(40, 40, 64);
    expect(ring[0]).toEqual([1, 1, 0]);
    expect(ring.every(([, , d], i) => i === 0 || d >= ring[i - 1][2])).toBe(true);
    expect(ring.every(([, , d]) => d <= 64)).toBe(true);
    // (about the disc's area in tiles, and more: a tile counts if any of it is within reach)
    expect(ring.length).toBeGreaterThan((Math.PI * 64 * 64) / (TILE * TILE));
    expect(ring.length).toBeLessThan((Math.PI * 96 * 96) / (TILE * TILE));
  });

  it('takes its own tile size', () => {
    expect(tilesAround(20, 20, 0, 16)[0]).toEqual([1, 1, 0]);
  });
});

describe('coverTile', () => {
  it('is the same tile every time, and another tile is another', () => {
    const a = coverTile([tufts], 3, -2, { seed: 9, height: flat });
    expect(coverTile([tufts], 3, -2, { seed: 9, height: flat })).toEqual(a);
    expect(coverTile([tufts], 4, -2, { seed: 9, height: flat })).not.toEqual(a);
    expect(coverTile([tufts], 3, -2, { seed: 10, height: flat })).not.toEqual(a);
    expect(tileSeed(1, 2, 3)).toBe(tileSeed(1, 2, 3));
  });

  it('lays about its density over many tiles, in clumps about the tile', () => {
    let n = 0;
    for (let tx = 0; tx < 20; tx++) for (let tz = 0; tz < 20; tz++) n += coverTile([tufts], tx, tz, { height: flat }).length;
    const want = (10 * 400 * TILE * TILE) / 100;
    expect(n / want).toBeGreaterThan(0.92);
    expect(n / want).toBeLessThan(1.08);
    const one = coverTile([tufts], 5, 5, { height: flat });
    expect(one.every((it) => it.x > 5 * TILE - 3 && it.x < 6 * TILE + 3 && it.z > 5 * TILE - 3 && it.z < 6 * TILE + 3)).toBe(true);
    expect(one.every((it) => it.scale >= 0.4 && it.scale <= 0.6 && it.model === 'Grass_Common_Short' && it.row === 0 && it.y === 0)).toBe(true);
  });

  it('keeps what keep allows, and the rest where they were', () => {
    const all = coverTile([tufts], 0, 0, { height: flat });
    const east = coverTile([tufts], 0, 0, { height: flat, keep: (x) => x > 16 });
    expect(east.length).toBeGreaterThan(0);
    expect(east.length).toBeLessThan(all.length);
    expect(east).toEqual(all.filter((it) => it.x > 16));
  });

  it('stands nothing on ground steeper than its row’s slope', () => {
    const ramp = (x) => x * 0.8;
    expect(coverTile([tufts], 0, 0, { height: ramp })).toEqual([]);
    expect(coverTile([{ ...tufts, slope: 1 }], 0, 0, { height: ramp }).length).toBeGreaterThan(0);
    const ys = coverTile([{ ...tufts, slope: 1 }], 0, 0, { height: ramp });
    expect(ys.every((it) => it.y === it.x * 0.8)).toBe(true);
  });

  it('lays a grass row as often as the ground grows grass', () => {
    const on = { ...tufts, on: 'grass' };
    const full = coverTile([on], 0, 0, { height: flat, cover: () => 1 }).length;
    expect(coverTile([on], 0, 0, { height: flat, cover: () => 0 })).toEqual([]);
    let half = 0;
    let all = 0;
    for (let t = 0; t < 40; t++) {
      half += coverTile([on], t, 0, { height: flat, cover: () => 0.5 }).length;
      all += coverTile([on], t, 0, { height: flat, cover: () => 1 }).length;
    }
    expect(full).toBeGreaterThan(0);
    expect(half / all).toBeGreaterThan(0.4);
    expect(half / all).toBeLessThan(0.6);
    // (a row on any ground takes no notice of it)
    expect(coverTile([tufts], 0, 0, { height: flat, cover: () => 0 }).length).toBe(full);
  });

  it('gathers a woods row into woods, with glades between, and a glade row the other way', () => {
    const tree = { model: 'CommonTree_1', per100: 0.4, clump: 2, spread: 8, woods: 1 };
    const meadow = { ...tree, woods: -1 };
    const count = (row, tx, tz) => coverTile([row], tx, tz, { height: flat }).length;
    // (over a 2 km square: the woods' share against the glades')
    const cells = [];
    for (let tx = -30; tx < 30; tx += 2) for (let tz = -30; tz < 30; tz += 2) cells.push([count(tree, tx, tz), count(meadow, tx, tz)]);
    const trees = cells.reduce((s, [t]) => s + t, 0);
    const glade = cells.reduce((s, [, m]) => s + m, 0);
    const even = (0.4 * TILE * TILE * cells.length) / 100;
    expect(trees).toBeLessThan(even * 0.8);
    expect(trees).toBeGreaterThan(even * 0.2);
    expect(glade).toBeGreaterThan(even * 0.2);
    // (where one is thick the other is thin)
    const both = cells.filter(([t, m]) => t > 2 && m > 2).length;
    expect(both).toBeLessThan(cells.length / 6);
  });

  it('lays a share of its count for a device that asks for less', () => {
    let n = 0;
    let half = 0;
    for (let t = 0; t < 30; t++) {
      n += coverTile([tufts], t, 1, { height: flat }).length;
      half += coverTile([tufts], t, 1, { height: flat, share: () => 0.5 }).length;
    }
    expect(half / n).toBeGreaterThan(0.4);
    expect(half / n).toBeLessThan(0.6);
    expect(coverTile([tufts], 0, 0, { height: flat, share: () => 0 })).toEqual([]);
  });

  it('lays each row from its own numbers: a row added leaves the others as they were', () => {
    const rock = { model: 'Rock_Medium_1', per100: 0.5 };
    const one = coverTile([tufts], 2, 2, { height: flat });
    const two = coverTile([tufts, rock], 2, 2, { height: flat });
    expect(two.filter((it) => it.row === 0)).toEqual(one);
  });
});
