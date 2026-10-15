// Hoth's own ground round its command posts, for the line of fire's test
// (nav.lineOfFire.test.js): the page's navgrid there (battle.js's
// createBattle: the pack's heights at each cell's middle and its nav.bin, cut
// to the cells of a rectangle), and for seeded pairs of standing places what
// a ray cast says on the game's own shapes and its 1 m heightmap. Made by
// scripts/bf2017-nav-fixture.mjs from the pack; hothGround.json's `sources`
// names each file by its hash. Nothing in it is by hand.
//
//   hothGround({ cover }) → Promise<{ nav, mask, bounds, pairs: [{ a, b, clear }], sources }>
//     (a, b: the two chests on the navgrid's ground; clear: the ray cast's answer, each end seated on the heightmap)
//   pairsOf(nav, { seed, count, near, far }) → [[a, b]]   (the maker and the test draw the same pairs)
//   navOf({ mask, heights, cover }) → { nav, bounds }   (the navgrid of those cells, built as the page builds the map's)
//   pack({ mask, heights, clear }) → bytes, to be deflated      unpack(bytes) → { mask, heights, clear }

import { seeded } from '../../seeded.js';
import { buildNav, heightAt, walkable } from '../nav.js';
import { decodeMask, encodeMask } from '../navMask.js';
import { chestOf } from '../soldier.js';

// [u32 the mask's length][the mask, navMask.js's own bytes][the heights, a float a cell][the answers, a bit a pair]
// (the heights' four bytes each in a run of their own, every first byte, then every second: the deflate
// then finds the bytes neighbouring cells share; the floats themselves are whole)
export function pack({ mask, heights, clear }) {
  const m = encodeMask(mask);
  const h = new Uint8Array(heights.buffer, heights.byteOffset, heights.byteLength);
  const n = heights.length;
  const out = new Uint8Array(4 + m.length + h.length + clear.length);
  new DataView(out.buffer).setUint32(0, m.length, true);
  out.set(m, 4);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) out[4 + m.length + k * n + i] = h[i * 4 + k];
  out.set(clear, 4 + m.length + h.length);
  return out;
}

export function unpack(bytes) {
  const len = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
  const mask = decodeMask(bytes.subarray(4, 4 + len));
  const n = mask.cols * mask.rows;
  const h = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) h[i * 4 + k] = bytes[4 + len + k * n + i];
  return { mask, heights: new Float32Array(h.buffer), clear: bytes.subarray(4 + len + n * 4) };
}

// the navgrid of a rectangle of cells, as the page builds the map's: each cell's height is the one given for it
export function navOf({ mask, heights, cover = {} }) {
  const { cell, cols, rows, origin } = mask;
  const at = (x, z) => heights[Math.floor((z - origin[1]) / cell) * cols + Math.floor((x - origin[0]) / cell)];
  // (half a cell short of the far edge: the count of cells is the ceiling of the span over the cell)
  const bounds = { min: origin, max: [origin[0] + (cols - 0.5) * cell, origin[1] + (rows - 0.5) * cell] };
  return { nav: buildNav({ heightAt: at, bounds, cell, cover, mask }), bounds };
}

// pairs of standing places `near` to `far` metres apart, a cell inside the grid's edge, chest to chest
export function pairsOf(nav, { seed, count, near = 10, far = 60 }) {
  const rand = seeded(seed);
  const x0 = nav.origin[0] + nav.cell;
  const z0 = nav.origin[1] + nav.cell;
  const w = (nav.cols - 2) * nav.cell;
  const d = (nav.rows - 2) * nav.cell;
  const inside = (x, z) => x >= x0 && x < x0 + w && z >= z0 && z < z0 + d && walkable(nav, x, z);
  const chest = (x, z) => chestOf({ at: [x, heightAt(nav, x, z), z], stance: 'stand' });
  const out = [];
  while (out.length < count) {
    const ax = x0 + rand() * w;
    const az = z0 + rand() * d;
    const turn = rand() * Math.PI * 2;
    const r = near + rand() * (far - near);
    const bx = ax + Math.cos(turn) * r;
    const bz = az + Math.sin(turn) * r;
    if (inside(ax, az) && inside(bx, bz)) out.push([chest(ax, az), chest(bx, bz)]);
  }
  return out;
}

async function inflate(base64) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function hothGround({ cover = {} } = {}) {
  // (asked for here, so the maker can load this file before the data exists)
  const data = (await import('./hothGround.json')).default;
  const { mask, heights, clear } = unpack(await inflate(data.data));
  const { nav, bounds } = navOf({ mask, heights, cover });
  const pairs = pairsOf(nav, data.pairs).map(([a, b], i) => ({ a, b, clear: (clear[i >> 3] & (1 << (i & 7))) !== 0 }));
  return { nav, mask, bounds, pairs, sources: data.sources };
}
