// The two decoders every model and texture passes through, brought up so
// that neither can hang a world (lane X2: docs/stack/webassembly.md). Both
// are three's own files, handed in by gltf.js; nothing here imports three.
//
// The meshopt decoder (every GLB here is meshopt-compressed) is wasm
// inlined in its module, with a SIMD build and a plain one: it validates a
// SIMD probe itself and instantiates the build that passes, the same probe
// lib/wasm/features asks, so the build it took is read from there. Its
// `ready` comes up once; one that rejects (no WebAssembly at all) is a
// named WasmError rather than every model failing with the parser's own
// words.
//
// The Basis transcoder (every KTX2) has one build, no SIMD: its .js and
// .wasm are fetched the first time a texture needs them and handed to the
// KTX2 loader's workers, each of which instantiates it. A worker whose
// instantiation fails never answers, and every texture it was handed
// waits for good; so the binary is compiled once here, on the main thread,
// before any worker sees it: a fetch that fails, a binary that won't
// compile and a fetch that never comes are each a WasmError within
// `timeoutMs`, and the next ask tries again. A level's texture that
// can't be had is drawn without that map (levelGltf.js's catch).
//
//   meshoptUp(decoder, { simd, timeoutMs }) → Promise<decoder>, once
//   basisUp(ktx2, { timeoutMs, compile }) → Promise<ktx2>, once (ktx2: a
//     KTX2Loader, or anything with init() and, after it, transcoderBinary)

import { WasmError, load } from '../wasm/load.js';

export function meshoptUp(decoder, { simd = false, timeoutMs = 10000 } = {}) {
  return load(
    'meshopt',
    async () => {
      if (!decoder || decoder.supported === false) throw new WasmError('meshopt', 'unsupported');
      await decoder.ready;
      return decoder;
    },
    { timeoutMs, build: simd ? 'simd' : 'scalar' },
  );
}

export function basisUp(ktx2, { timeoutMs = 20000, compile = (b) => WebAssembly.compile(b) } = {}) {
  return load(
    'basis',
    async () => {
      await ktx2.init();
      const binary = ktx2.transcoderBinary;
      if (!binary || !binary.byteLength) throw new WasmError('basis', 'load');
      await compile(binary);
      return ktx2;
    },
    { timeoutMs, build: 'scalar' },
  );
}
