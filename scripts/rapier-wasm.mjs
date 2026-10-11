// Rapier's wasm, streamed instead of inlined (lane X3 of the Frostbite gaps
// design: docs/stack/physics-rapier.md, "How the site uses it"). The bare
// packages (`@dimforge/rapier3d`, `@dimforge/rapier3d-simd`) import their
// binary as an ES module, which Vite does not bundle; the -compat packages
// the site used before inlined it as base64 inside a 4 MB module. This
// plugin resolves that one import, in each package, to the shim under
// src/lib/physics/raw/ that fetches the binary as a hashed asset and
// instantiates it as it downloads (src/lib/wasm/instantiate.js). It runs in
// the build, the dev server and Vitest alike (one `vite.config.js`), so the
// tests load the real engine the way a visitor does. The rule itself is
// scripts/lib/rapier-wasm.mjs, tested.

import { fileURLToPath } from 'node:url';
import { shimFor } from './lib/rapier-wasm.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/+$/, '');

export default function rapierWasm() {
  return {
    name: 'rapier-wasm',
    enforce: 'pre',
    resolveId(source, importer) {
      return shimFor(source, importer, { root: ROOT });
    },
  };
}
