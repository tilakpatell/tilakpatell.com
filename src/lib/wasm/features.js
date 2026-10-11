// What this browser's WebAssembly can do, asked once by hand rather than
// through a package (lane X2: docs/stack/webassembly.md). Each check is a
// module a few bytes long that uses one feature, handed to
// WebAssembly.validate: a browser that knows the feature says it's valid,
// one that doesn't says it isn't, and nothing is compiled or run. The bytes
// are wasm-feature-detect's (MIT), the same three the meshopt decoder and
// Rapier's own builds are chosen by.
//
//   simd: i32.const 0; i8x16.splat; i8x16.popcnt (fixed-width SIMD, every
//     browser since 2021; Safari 16.4)
//   threads: a shared memory and an atomic load (the instruction set); a
//     module may only share its memory where SharedArrayBuffer exists and
//     the page is cross-origin isolated (COOP and COEP headers), which a
//     GitHub Pages site can't send, so `threads` is false on the live site
//     and a module here never asks for it
//
//   detect(env = globalThis) → { wasm, simd, threads }: pure, from what env holds
//   features() → the same for this page, worked out once
//   override(partial | null): a test's or a check's say (null: the page's own again)

const SIMD = [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11];
const THREADS = [0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5, 4, 1, 3, 1, 1, 10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11];

function valid(W, bytes) {
  try {
    return W.validate(new Uint8Array(bytes)) === true;
  } catch {
    return false;
  }
}

export function detect(env = globalThis) {
  const W = env?.WebAssembly;
  if (!W || typeof W.validate !== 'function' || typeof W.instantiate !== 'function') return { wasm: false, simd: false, threads: false };
  const shared = typeof env.SharedArrayBuffer === 'function' && env.crossOriginIsolated === true;
  return { wasm: true, simd: valid(W, SIMD), threads: shared && valid(W, THREADS) };
}

let found = null;
let said = null;

export function features() {
  found ??= detect();
  return said ? { ...found, ...said } : found;
}

export function override(partial) {
  said = partial ? { ...partial } : null;
}
