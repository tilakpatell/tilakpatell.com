import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from './rulebook.js';
import { field } from './fixtures/field.js';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { buildNav } from './nav.js';
import { search, searchIn, searchJs } from './navSearch.js';
import { dropNavSearch, loadNavSearch, wasmSearch } from './navWasm.js';
import { seeded } from '../seeded.js';

// The port against the JavaScript it stands in for: the same cells for
// every search, on the test field, on Hoth's arena grid and on random grids.
const bytes = readFileSync(new URL('../wasm/navsearch/navsearch_bg.wasm', import.meta.url));
let port = null;

beforeAll(async () => {
  const mod = await import('../wasm/navsearch/navsearch.js');
  mod.initSync({ module: bytes });
  port = wasmSearch(mod);
});

const rb = loadRulebook();
const cover = aiOf(rb).cover.constants;

function randomGrid(rand, cols, rows, wall) {
  const n = cols * rows;
  const walk = new Uint8Array(n);
  const solid = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    walk[i] = rand() < wall ? 0 : 1;
    solid[i] = rand() < wall / 3 ? 1 : 0;
  }
  return { cols, rows, cell: 2, walk, solid, scratch: null };
}

function same(nav, rand, runs, { blockedShare = 0, max = 20000 } = {}) {
  const n = nav.cols * nav.rows;
  let found = 0;
  for (let k = 0; k < runs; k++) {
    const s = Math.floor(rand() * n);
    const goal = Math.floor(rand() * n);
    const blocked = blockedShare ? new Set(Array.from({ length: Math.floor(n * blockedShare) }, () => Math.floor(rand() * n))) : null;
    const js = searchJs(nav, s, goal, blocked, max);
    const wasm = port(nav, s, goal, blocked, max);
    expect(wasm, `search ${k}: ${s} → ${goal}`).toEqual(js);
    if (js) found++;
  }
  return found;
}

describe('the A* port against the JavaScript', () => {
  it('finds the same cells on the test field', () => {
    const nav = buildNav({ ...field(), cover });
    expect(same(nav, seeded(1), 300)).toBeGreaterThan(200);
  });

  it('finds the same cells on Hoth’s arena grid, with blocked cells', () => {
    const nav = hothFlatNav(rb);
    expect(same(nav, seeded(2), 200)).toBeGreaterThan(100);
    same(nav, seeded(3), 100, { blockedShare: 0.002 });
  });

  it('finds the same cells, or none, on random grids, under a budget too', () => {
    const rand = seeded(4);
    for (let g = 0; g < 20; g++) {
      const nav = randomGrid(rand, 20 + Math.floor(rand() * 60), 20 + Math.floor(rand() * 60), 0.15 + rand() * 0.3);
      same(nav, rand, 40, { blockedShare: g % 2 ? 0.01 : 0, max: g % 3 ? 20000 : 50 });
    }
  });

  it('answers a start or goal off the grid with none, as the JavaScript does with an empty search', () => {
    const nav = randomGrid(seeded(5), 10, 10, 0);
    expect(port(nav, 0, 0, null, 100)).toEqual(searchJs(nav, 0, 0, null, 100));
  });
});

describe('loadNavSearch', () => {
  afterAll(() => dropNavSearch());

  it('puts the port behind findPath once it has come up, and drops it again', async () => {
    expect(searchIn()).toBe('js');
    expect(await loadNavSearch({ bytes })).toBe(true);
    expect(searchIn()).toBe('wasm');
    const nav = randomGrid(seeded(6), 30, 30, 0.2);
    expect(search(nav, 0, 899, null, 20000)).toEqual(searchJs(nav, 0, 899, null, 20000));
    dropNavSearch();
    expect(searchIn()).toBe('js');
  });

  it('keeps the JavaScript where the port can’t come up', async () => {
    // (a fresh copy of the glue: the first keeps the instance it made)
    const fresh = () => import(/* @vite-ignore */ `../wasm/navsearch/navsearch.js?fresh=${Date.now()}`);
    expect(await loadNavSearch({ bytes: new Uint8Array([0, 97, 115, 109, 9]), importer: fresh })).toBe(false);
    expect(searchIn()).toBe('js');
    dropNavSearch();
    expect(await loadNavSearch({ importer: () => Promise.reject(new Error('offline')) })).toBe(false);
    expect(searchIn()).toBe('js');
  });
});
