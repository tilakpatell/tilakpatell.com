// A WebAssembly module brought up from where its bytes are, the quickest way
// the place allows (lane X3 of the Frostbite gaps design: docs/stack/
// webassembly.md). In a browser the binary is a hashed asset (a `?url`
// import) and `WebAssembly.instantiateStreaming` compiles it as it downloads;
// a server that types it wrong (anything but application/wasm makes the
// streaming call throw a TypeError) gets the whole body and `instantiate`
// from bytes, so a misnamed type costs the overlap, never the module. In
// Node (the tests, scripts/x2-profile.mjs through Vite's SSR) the `?url`
// value is a path, read from disk. The imports object is the module's
// (Rapier's: its glue module under the name its wasm was linked against).
//
//   instantiate(url, imports, { fetch, WebAssembly, node }) →
//     Promise<{ instance, module, how: 'streaming' | 'bytes' | 'file' }>;
//     a bad module rejects with the engine's own CompileError, a missing
//     file or a failed fetch with an Error naming it
//   pathOf(url, root) → the file path behind what a ?url import gives in
//     Node ('/@fs/…', 'file://…', a bare absolute path, or '/node_modules/…'
//     under root)

export function pathOf(url, root = globalThis.process?.cwd?.() ?? '') {
  let p = String(url).replace(/[?#].*$/, '');
  if (p.startsWith('file://')) return decodeURIComponent(new URL(p).pathname);
  if (p.startsWith('/@fs/')) return p.slice('/@fs'.length);
  if (p.startsWith('/node_modules/')) return root.replace(/\/+$/, '') + p;
  return p;
}

export async function instantiate(
  url,
  imports = {},
  { fetch = globalThis.fetch, WebAssembly: WA = globalThis.WebAssembly, node = typeof window === 'undefined' && typeof globalThis.process !== 'undefined' } = {},
) {
  if (node) {
    const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises');
    const bytes = await readFile(pathOf(url));
    const { instance, module } = await WA.instantiate(bytes, imports);
    return { instance, module, how: 'file' };
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`wasm: ${url} answered ${response.status}`);
  if (typeof WA.instantiateStreaming === 'function') {
    try {
      const { instance, module } = await WA.instantiateStreaming(response.clone(), imports);
      return { instance, module, how: 'streaming' };
    } catch (err) {
      // (only the type complaint falls through; a bad module is a bad module)
      if (!(err instanceof TypeError)) throw err;
    }
  }
  const { instance, module } = await WA.instantiate(await response.arrayBuffer(), imports);
  return { instance, module, how: 'bytes' };
}
