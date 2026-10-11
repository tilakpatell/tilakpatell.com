// nav.test.js again, every findPath searched by the WebAssembly port
// (navWasm.js): the same tests against both (lane X2's rule).
import { readFileSync } from 'node:fs';
import { afterAll } from 'vitest';
import { dropNavSearch, loadNavSearch } from './navWasm.js';
import { searchIn } from './navSearch.js';

await loadNavSearch({ bytes: readFileSync(new URL('../wasm/navsearch/navsearch_bg.wasm', import.meta.url)) });
if (searchIn() !== 'wasm') throw new Error('the port did not come up');
afterAll(() => dropNavSearch());
await import('./nav.test.js');
