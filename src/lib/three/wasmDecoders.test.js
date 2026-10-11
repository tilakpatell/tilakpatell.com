import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forget } from '../wasm/load.js';
import { basisUp, meshoptUp } from './wasmDecoders.js';

afterEach(() => {
  forget('meshopt');
  forget('basis');
  vi.restoreAllMocks();
  vi.resetModules();
});

// every meshopt-compressed buffer view of a real GLB (Kenney's cliff, CC0),
// decoded by a decoder: the bytes, view by view
const glb = readFileSync(new URL('./fixtures/meshopt-cliff.glb', import.meta.url));
function views() {
  const len = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + len).toString('utf8'));
  const binAt = 20 + len + 8;
  return json.bufferViews.map((v) => v.extensions?.EXT_meshopt_compression).filter(Boolean).map((m) => ({ ...m, source: new Uint8Array(glb.buffer, glb.byteOffset + binAt + (m.byteOffset ?? 0), m.byteLength) }));
}
function decodeAll(d) {
  return views().map((m) => {
    const out = new Uint8Array(m.count * m.byteStride);
    d.decodeGltfBuffer(out, m.count, m.byteStride, m.source, m.mode, m.filter);
    return Array.from(out);
  });
}
// (a module of its own each time, by its query: the decoder picks its build
// as it is first evaluated)
let n = 0;
async function freshDecoder() {
  const url = new URL(`../../../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js?copy=${n++}`, import.meta.url);
  return (await import(/* @vite-ignore */ url.href)).MeshoptDecoder;
}

describe('meshoptUp', () => {
  it('brings the SIMD build up and decodes a real GLB', async () => {
    const d = await meshoptUp(await freshDecoder(), { simd: true });
    const out = decodeAll(d);
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((b) => b.length > 0)).toBe(true);
  });

  it('the plain build, taken where the SIMD probe fails, decodes the same bytes', async () => {
    const fast = await freshDecoder();
    await fast.ready;
    const simd = decodeAll(fast);
    let asked = 0;
    vi.spyOn(WebAssembly, 'validate').mockImplementation(() => (asked++, false));
    const plain = await freshDecoder();
    expect(asked).toBeGreaterThan(0);
    vi.restoreAllMocks();
    await meshoptUp(plain, { simd: false });
    expect(decodeAll(plain)).toEqual(simd);
  });

  it('names a decoder that is not supported', async () => {
    const err = await meshoptUp({ supported: false }).catch((e) => e);
    expect(err.name).toBe('WasmError');
    expect(err.reason).toBe('unsupported');
  });

  it('names one whose instantiation fails', async () => {
    const err = await meshoptUp({ supported: true, ready: Promise.reject(new Error('CompileError')) }).catch((e) => e);
    expect(err.name).toBe('WasmError');
    expect(err.module).toBe('meshopt');
  });
});

const transcoder = readFileSync(new URL('../../../node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm', import.meta.url));
const fakeKtx2 = (init) => ({ transcoderBinary: null, init() { return init(this); } });

describe('basisUp', () => {
  it('compiles three’s transcoder before any worker is handed it', async () => {
    const k = fakeKtx2(async (self) => (self.transcoderBinary = transcoder.buffer.slice(transcoder.byteOffset, transcoder.byteOffset + transcoder.byteLength)));
    expect(await basisUp(k)).toBe(k);
  });

  it('a binary that will not compile is a named failure, and the next ask tries again', async () => {
    const bad = fakeKtx2(async (self) => (self.transcoderBinary = new Uint8Array([0, 97, 115, 109, 9, 9]).buffer));
    const err = await basisUp(bad).catch((e) => e);
    expect(err.name).toBe('WasmError');
    expect(err.module).toBe('basis');
    const good = fakeKtx2(async (self) => (self.transcoderBinary = transcoder.buffer.slice(transcoder.byteOffset, transcoder.byteOffset + transcoder.byteLength)));
    expect(await basisUp(good)).toBe(good);
  });

  it('a fetch that fails, or an empty binary, is named', async () => {
    expect((await basisUp(fakeKtx2(async () => { throw new Error('404'); })).catch((e) => e)).name).toBe('WasmError');
    forget('basis');
    expect((await basisUp(fakeKtx2(async () => {})).catch((e) => e)).reason).toBe('load');
  });

  it('a transcoder that never comes is a timeout, not a texture waiting for good', async () => {
    const err = await basisUp(fakeKtx2(() => new Promise(() => {})), { timeoutMs: 30 }).catch((e) => e);
    expect(err.reason).toBe('timeout');
  });
});
