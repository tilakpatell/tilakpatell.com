// The rule behind scripts/rapier-wasm.mjs (lane X3 of the Frostbite gaps
// design): which import, from where, is Rapier's wasm import, and which shim
// stands in for it. The bare packages' `rapier_wasm3d.js` does
// `import * as wasm from "./rapier_wasm3d_bg.wasm"`, an ES module import of
// a binary that Vite does not bundle; every module of the package reaches it
// as `./rapier_wasm3d` (from `raw.js`) or `../rapier_wasm3d`. The shim under
// src/lib/physics/raw/ instantiates the same binary itself (streamed) and
// re-exports the same glue.
//
//   shimFor(source, importer, { root }) → absolute path of the shim, or null
//     when the import is any other

const SOURCE = /^\.{1,2}\/rapier_wasm3d(\.js)?$/;
const PACKAGE = /[\\/]node_modules[\\/]@dimforge[\\/]rapier3d(-simd)?[\\/]/;

export function shimFor(source, importer, { root }) {
  if (!importer || !SOURCE.test(source)) return null;
  const m = PACKAGE.exec(importer);
  if (!m) return null;
  return `${root.replace(/[\\/]+$/, '')}/src/lib/physics/raw/${m[1] ? 'simd' : 'scalar'}.js`;
}
