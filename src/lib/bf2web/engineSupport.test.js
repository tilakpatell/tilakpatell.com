import { describe, expect, it } from 'vitest';
import { MIN_MEMORY_GB, WHY, engineSupport, probeBrowser } from './engineSupport.js';

const desktop = { gpu: true, isolated: true, sharedMemory: true, wasm: true, deviceMemory: 8, mobile: false };

describe('whether a browser can run bf2-web’s engine', () => {
  it('lets a desktop with WebGPU, threads and memory through', () => {
    expect(engineSupport(desktop)).toEqual({ ok: true, missing: [] });
  });

  it('names each thing missing', () => {
    expect(engineSupport({ ...desktop, gpu: false }).missing).toEqual([WHY.gpu]);
    expect(engineSupport({ ...desktop, isolated: false, sharedMemory: false }).missing).toEqual([WHY.isolated, WHY.sharedMemory]);
    expect(engineSupport({ ...desktop, deviceMemory: MIN_MEMORY_GB - 2 }).missing).toEqual([WHY.memory]);
    expect(engineSupport({ ...desktop, mobile: true }).ok).toBe(false);
    expect(engineSupport().missing).toContain(WHY.wasm);
  });

  it('gives a browser that keeps its memory to itself the benefit of the doubt', () => {
    expect(engineSupport({ ...desktop, deviceMemory: null }).ok).toBe(true);
  });

  it('reads the facts off a window', () => {
    const win = { navigator: { gpu: {}, deviceMemory: 8, userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }, crossOriginIsolated: true, SharedArrayBuffer: function SharedArrayBuffer() {}, WebAssembly: {} };
    expect(probeBrowser(win)).toEqual(desktop);
    expect(probeBrowser({ navigator: { userAgent: 'iPhone' } })).toMatchObject({ gpu: false, isolated: false, mobile: true, deviceMemory: null });
  });
});
