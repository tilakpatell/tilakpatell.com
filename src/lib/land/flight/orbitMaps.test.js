import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ORBIT_WORKER, createOrbitMaps } from './orbitMaps';
import { roundSpec } from './fixtures/generated';

// a fake pool: each request takes the next answer, made from the request's
// message, or null (a cancelled or failed bake) when there are none left
let answers;
let pool;
const bake = (msg) => ({ key: msg.key, width: msg.width, height: msg.height, rgba: new Uint8ClampedArray(4), biome: new Uint8Array(1) });
beforeEach(() => {
  answers = [bake, bake, bake, bake, bake];
  pool = { define: vi.fn(), request: vi.fn(async (name, msg) => answers.shift()?.(msg) ?? null), close: vi.fn() };
});

const spec = roundSpec();
const other = (seed) => roundSpec({ seed });

describe('createOrbitMaps', () => {
  it('defines its one worker once', () => {
    createOrbitMaps({ workers: pool, make: () => null });
    expect(pool.define.mock.calls).toEqual([[ORBIT_WORKER, expect.any(Function), { size: 1 }]]);
  });

  it('bakes once for two asks at once, and serves the next from memory', async () => {
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    const [a, b] = await Promise.all([maps.get(spec, 'mid'), maps.get(spec, 'mid')]);
    expect(a).toBe(b);
    expect(pool.request).toHaveBeenCalledTimes(1);
    expect(pool.request.mock.calls[0][1]).toMatchObject({ key: `${spec.id}:256x128`, width: 256, height: 128, spec });
    expect(await maps.get(spec, 'low')).toBe(a);
    expect(maps.peek(spec, 'mid')).toBe(a);
  });

  it('asks the high tier for the big map', async () => {
    await createOrbitMaps({ workers: pool, make: () => null }).get(spec, 'high');
    expect(pool.request.mock.calls[0][1].key).toMatch(/:512x256$/);
  });

  it('forgets the least recently used past its cap', async () => {
    const maps = createOrbitMaps({ workers: pool, make: () => null, cap: 2 });
    const [A, B, C] = [other(1), other(2), other(3)];
    for (const s of [A, B, C, A]) await maps.get(s, 'mid');
    expect([pool.request.mock.calls.length, maps.peek(C, 'mid') !== null, maps.peek(B, 'mid')]).toEqual([4, true, null]);
  });

  it('counts an ask it serves from memory as a use', async () => {
    const maps = createOrbitMaps({ workers: pool, make: () => null, cap: 2 });
    const [A, B, C] = [other(1), other(2), other(3)];
    for (const s of [A, B, A, C]) await maps.get(s, 'mid');
    expect([maps.peek(A, 'mid') !== null, maps.peek(B, 'mid')]).toEqual([true, null]);
  });

  it('answers null for a cancelled or failed bake, keeps nothing, asks again next time', async () => {
    answers = [() => null, (msg) => ({ key: msg.key }), bake];
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    expect([await maps.get(spec, 'mid'), maps.peek(spec, 'mid'), await maps.get(spec, 'mid'), maps.stats().cached]).toEqual([null, null, null, 0]);
    expect([(await maps.get(spec, 'mid'))?.width, pool.request.mock.calls.length]).toEqual([256, 3]);
  });

  it('never throws: no spec, a pool that throws or rejects, or after dispose', async () => {
    const bad = { define: vi.fn(), request: vi.fn(() => { throw new Error('no worker'); }), close: vi.fn() };
    const sour = { define: vi.fn(), request: vi.fn(async () => { throw new Error('gone'); }), close: vi.fn() };
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    maps.dispose();
    const asks = [createOrbitMaps({ workers: pool }).get(null, 'mid'), createOrbitMaps({ workers: bad }).get(spec, 'mid'), createOrbitMaps({ workers: sour }).get(spec, 'mid'), maps.get(spec, 'mid')];
    expect([...(await Promise.all(asks)), pool.request.mock.calls.length]).toEqual([null, null, null, null, 0]);
  });

  it('counts what it holds and what it’s waiting on', async () => {
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    const flying = maps.get(spec, 'mid');
    expect(maps.stats()).toEqual({ cached: 0, flying: 1 });
    await flying;
    expect(maps.stats()).toEqual({ cached: 1, flying: 0 });
  });

  it('closes its workers on dispose', async () => {
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    await maps.get(spec, 'mid');
    maps.dispose();
    expect([pool.close.mock.calls, maps.stats().cached]).toEqual([[[ORBIT_WORKER]], 0]);
  });

  it('keeps nothing that lands after dispose', async () => {
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    const late = maps.get(spec, 'mid');
    maps.dispose();
    expect([await late, maps.peek(spec, 'mid'), maps.stats()]).toEqual([null, null, { cached: 0, flying: 0 }]);
  });

  it('stores nothing', () => {
    for (const f of ['./orbitMaps.js', './orbitMap.js', './orbitMap.worker.js'])
      expect(readFileSync(new URL(f, import.meta.url), 'utf8'), f).not.toMatch(/localStorage|indexedDB|rt\.store|rt\.saves/);
  });
});
