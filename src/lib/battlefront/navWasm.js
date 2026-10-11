// The navgrid's A* in WebAssembly (lane X2: wasm/navsearch, built by
// wasm-pack into src/lib/wasm/navsearch), put behind navSearch.js's
// interface once it has come up, the JavaScript staying as the fallback:
// a page where it can't come up (no WebAssembly, a failed fetch, a
// timeout: lib/wasm/load's WasmError) searches in JavaScript as before.
// Each grid is handed to the port once, its walkable cells folded into one
// byte a cell (the grid never changes once built); a search's blocked cells
// are passed as a list.
//
//   loadNavSearch({ bytes, timeoutMs, importer }) → Promise<boolean> (true: the port is in use)
//   wasmSearch(mod) → search(nav, s, goal, blocked, max), for the tests
//   dropNavSearch(): the JavaScript again

import { load, forget } from '../wasm/load.js';
import { features } from '../wasm/features.js';
import { setSearch } from './navSearch.js';

const NONE = new Int32Array(0);
const U32 = 0xffffffff;

export function wasmSearch(mod) {
  const grids = new WeakMap(); // nav → mod.Grid (freed with it: the glue's FinalizationRegistry)
  const gridOf = (nav) => {
    let g = grids.get(nav);
    if (!g) {
      const n = nav.cols * nav.rows;
      const open = new Uint8Array(n);
      for (let i = 0; i < n; i++) open[i] = nav.walk[i] === 1 && !nav.solid[i] ? 1 : 0;
      g = new mod.Grid(nav.cols, nav.rows, nav.cell, open);
      grids.set(nav, g);
    }
    return g;
  };
  return (nav, s, goal, blocked, max) => {
    const cells = gridOf(nav).search(s, goal, blocked?.size ? Int32Array.from(blocked) : NONE, Number.isFinite(max) ? Math.max(0, Math.min(U32, max)) : U32);
    return cells.length ? Array.from(cells) : null;
  };
}

const glue = () => import('../wasm/navsearch/navsearch.js');

export function loadNavSearch({ bytes = null, timeoutMs = 10000, importer = glue } = {}) {
  if (!features().wasm) return Promise.resolve(false);
  return load(
    'navsearch',
    async () => {
      const mod = await importer();
      if (bytes) mod.initSync({ module: bytes });
      else await mod.default();
      setSearch(wasmSearch(mod));
      return true;
    },
    { timeoutMs, build: 'scalar' },
  ).catch(() => false);
}

export function dropNavSearch() {
  setSearch(null);
  forget('navsearch');
}
