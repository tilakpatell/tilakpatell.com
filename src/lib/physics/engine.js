// Rapier itself: which of its two builds this browser gets, loaded so that
// neither can hang a world (lane X2: docs/stack/webassembly.md). The SIMD
// build steps the same world about 30% quicker (600 bodies on a
// heightfield: 2.7 → 1.9 ms a step in Node, docs/superpowers/evidence/
// bf2017-picture/x2/README.md); every browser since 2021 runs it. Where the
// SIMD check (lib/wasm/features) says no, or the SIMD build fails to come
// up, the plain build does, the same API and the same numbers to the tests'
// tolerances (engine.test.js runs a scene through both). Both are the bare
// builds (`@dimforge/rapier3d`, `-simd`), whose wasm import Vite does not
// bundle: scripts/rapier-wasm.mjs sends it to the shim under raw/ that
// fetches the binary as a hashed asset and compiles it as it downloads
// (lane X3; before, the -compat builds inlined it as base64 inside a 4 MB
// module). Each is its own chunk, so a page downloads one build and one
// binary; the shim's top-level await is the init, so there is no init() to
// call, and a binary that won't compile rejects the import.
//
//   loadEngine({ simd = features().simd, importers, timeoutMs }) → Promise<RAPIER>,
//     once (lib/wasm/load: a failure is a WasmError and isn't kept)
//   engineBuild() → 'simd' | 'scalar' | null (none yet)
//   IMPORTERS: { simd, scalar } → Promise<module>, a test's to replace

import { features } from '../wasm/features.js';
import { load, settle, status } from '../wasm/load.js';

export const IMPORTERS = Object.freeze({
  // (the package's own file, not its name: the packages carry only a
  // `module` entry, which Node's resolution does not read)
  simd: () => import('@dimforge/rapier3d-simd/rapier.js'),
  scalar: () => import('@dimforge/rapier3d/rapier.js'),
});

async function up(importer) {
  const m = await importer();
  return m.default ?? m;
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
