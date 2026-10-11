import { afterEach, describe, expect, it, vi } from 'vitest';
import { WasmError, forget, load, settle, status } from './load.js';

afterEach(() => {
  vi.useRealTimers();
  for (const k of Object.keys(status())) forget(k);
});

describe('load', () => {
  it('makes a module once, the same promise to every caller', async () => {
    const make = vi.fn(async () => 42);
    const a = load('m', make);
    expect(load('m', make)).toBe(a);
    expect(await a).toBe(42);
    expect(make).toHaveBeenCalledTimes(1);
    expect(status().m.state).toBe('ready');
  });

  it('names a failure, and does not keep it: the next ask tries again', async () => {
    let n = 0;
    const make = async () => {
      if (n++ === 0) throw new Error('offline');
      return 'up';
    };
    const err = await load('rapier', make).catch((e) => e);
    expect(err).toBeInstanceOf(WasmError);
    expect(err.name).toBe('WasmError');
    expect(err.module).toBe('rapier');
    expect(err.reason).toBe('load');
    expect(err.cause.message).toBe('offline');
    expect(status().rapier.state).toBe('failed');
    expect(await load('rapier', make)).toBe('up');
  });

  it('a make that throws at once is a named failure too', async () => {
    const err = await load('x', () => {
      throw new TypeError('bad');
    }).catch((e) => e);
    expect(err.name).toBe('WasmError');
  });

  it('a load that never comes rejects as a timeout instead of hanging', async () => {
    vi.useFakeTimers();
    const p = load('basis', () => new Promise(() => {}), { timeoutMs: 1000 });
    const seen = p.catch((e) => e);
    await vi.advanceTimersByTimeAsync(1001);
    const err = await seen;
    expect(err).toBeInstanceOf(WasmError);
    expect(err.reason).toBe('timeout');
    expect(err.message).toMatch(/basis/);
    expect(status().basis.state).toBe('failed');
  });

  it('keeps a WasmError a make throws as it is', async () => {
    const own = new WasmError('meshopt', 'unsupported');
    expect(await load('meshopt', async () => Promise.reject(own)).catch((e) => e)).toBe(own);
  });

  it('records the build a loader settled on', async () => {
    await load('rapier', async () => 1, { build: 'simd' });
    settle('rapier', 'scalar');
    expect(status().rapier.build).toBe('scalar');
    expect(status().rapier.ms).toBeGreaterThanOrEqual(0);
  });
});
