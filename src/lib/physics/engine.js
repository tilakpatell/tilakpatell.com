// Rapier itself: which of its two builds this browser gets, loaded so that
// neither can hang a world (lane X2: docs/stack/webassembly.md). The SIMD
// build steps the same world about 30% quicker (600 bodies on a
// heightfield: 2.7 → 1.9 ms a step in Node, docs/superpowers/evidence/
// bf2017-picture/x2/README.md); every browser since 2021 runs it. Where the
// SIMD check (lib/wasm/features) says no, or the SIMD build fails to come
// up, the plain build does, the same API and the same numbers to the tests'
// tolerances (engine.test.js runs a scene through both). Both are the
// -compat builds (their wasm inlined: no bundler plugin, and they load in
// Node for the tests); each is its own chunk, so a page downloads one.
//
//   loadEngine({ simd = features().simd, importers, timeoutMs }) → Promise<RAPIER>,
//     once (lib/wasm/load: a failure is a WasmError and isn't kept)
//   engineBuild() → 'simd' | 'scalar' | null (none yet)
//   IMPORTERS: { simd, scalar } → Promise<module>, a test's to replace

import { features } from '../wasm/features.js';
import { load, settle, status } from '../wasm/load.js';

export const IMPORTERS = Object.freeze({
  simd: () => import('@dimforge/rapier3d-simd-compat'),
  scalar: () => import('@dimforge/rapier3d-compat'),
});

async function up(importer) {
  const m = await importer();
  const RAPIER = m.default ?? m;
  await RAPIER.init();
  return RAPIER;
}

export function loadEngine({ simd = features().simd, importers = IMPORTERS, timeoutMs = 20000 } = {}) {
  return load(
    'rapier',
    async () => {
      if (!simd) return up(importers.scalar);
      try {
        return await up(importers.simd);
      } catch {
        // (a SIMD build that won't come up where the check said it would: the plain one)
        settle('rapier', 'scalar');
        return up(importers.scalar);
      }
    },
    { timeoutMs, build: simd ? 'simd' : 'scalar' },
  );
}

export const engineBuild = () => (status().rapier?.state === 'ready' ? status().rapier.build : null);
