import { afterEach, describe, expect, it, vi } from 'vitest';

// (its own file: the engine's import is cached for the module's life; both
// builds mocked, as engine.js takes the SIMD one where it can and the plain
// one after it)
const BUILDS = ['@dimforge/rapier3d-simd-compat', '@dimforge/rapier3d-compat'];

describe('createPhysics, when the engine will not load', () => {
  afterEach(() => {
    for (const b of BUILDS) vi.doUnmock(b);
    vi.resetModules();
  });

  it('fails, then loads it on the next try', async () => {
    vi.resetModules();
    for (const b of BUILDS)
      vi.doMock(b, () => {
        throw new Error('offline');
      });
    const { createPhysics } = await import('./world');
    await expect(createPhysics()).rejects.toThrow();
    for (const b of BUILDS) vi.doUnmock(b);
    const p = await createPhysics();
    expect(p.step(1 / 60)).toBe(1);
    p.dispose();
  });

  it('R18 a failed engine load is retried', async () => {
    vi.resetModules();
    let calls = 0;
    for (const b of BUILDS)
      vi.doMock(b, async (orig) => {
        const real = await orig();
        const R = real.default ?? real;
        return { default: { ...R, init: async () => { if (calls++ < 2) throw new Error('offline'); return R.init(); } } };
      });
    const { createPhysics: fresh } = await import('./world');
    const err = await fresh().catch((e) => e);
    expect(err.name).toBe('WasmError');
    expect(err.message).toMatch('offline');
    const p = await fresh();
    expect(p.world).toBeTruthy();
    p.dispose();
  });
});
