import { afterEach, describe, expect, it } from 'vitest';
import { detect, features, override } from './features.js';

afterEach(() => override(null));

describe('detect', () => {
  it('finds SIMD in this Node, and no threads without cross-origin isolation', () => {
    const f = detect();
    expect(f.wasm).toBe(true);
    expect(f.simd).toBe(true);
    expect(f.threads).toBe(false);
  });

  it('says threads only where shared memory is allowed and the instruction set is known', () => {
    expect(detect({ ...globalThis, WebAssembly, SharedArrayBuffer, crossOriginIsolated: true }).threads).toBe(true);
    expect(detect({ WebAssembly, crossOriginIsolated: true }).threads).toBe(false);
  });

  it('says nothing works where there is no WebAssembly, or a validate that throws', () => {
    expect(detect({})).toEqual({ wasm: false, simd: false, threads: false });
    expect(detect(null)).toEqual({ wasm: false, simd: false, threads: false });
    const throws = { validate: () => { throw new Error('no'); }, instantiate: () => null };
    expect(detect({ WebAssembly: throws })).toEqual({ wasm: true, simd: false, threads: false });
  });

  it('says no SIMD where the engine rejects the SIMD probe', () => {
    const old = { validate: (b) => !b.includes(253), instantiate: WebAssembly.instantiate };
    expect(detect({ WebAssembly: old }).simd).toBe(false);
  });
});

describe('features', () => {
  it('is worked out once, and a check can override it', () => {
    expect(features()).toBe(features());
    override({ simd: false });
    expect(features().simd).toBe(false);
    expect(features().wasm).toBe(true);
    override(null);
    expect(features().simd).toBe(true);
  });
});
