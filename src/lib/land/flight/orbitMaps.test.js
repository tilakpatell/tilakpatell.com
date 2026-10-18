import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ORBIT_WORKER, createOrbitMaps } from './orbitMaps';

const answer = (msg) => ({
  key: msg.key,
  width: msg.width,
  height: msg.height,
  rgba: new Uint8ClampedArray(4),
  biome: new Uint8Array(1),
});
const fakePool = (answers = []) => ({
  define: vi.fn(),
  request: vi.fn(async (name, msg) => answers.shift()?.(msg) ?? null),
  close: vi.fn(),
});
const spec = { id: 'e:1,0:0:1', kind: 'round' };
const specB = { id: 'e:2,0:0:1', kind: 'round' };
const specC = { id: 'e:3,0:0:1', kind: 'round' };

describe('the orbit maps', () => {
  it('bakes once for two asks at once, and serves the next from memory', async () => {
    const pool = fakePool([answer]);
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    const [a, b] = await Promise.all([maps.get(spec, 'mid'), maps.get(spec, 'mid')]);
    expect(a).toBe(b);
    expect(pool.request).toHaveBeenCalledTimes(1);
    expect(pool.request.mock.calls[0][1]).toMatchObject({ key: `${spec.id}:256x128`, width: 256, height: 128, spec });
    expect(await maps.get(spec, 'low')).toBe(a);
    expect(maps.peek(spec, 'mid')).toBe(a);
    expect(pool.define).toHaveBeenCalledTimes(1);
    expect(pool.define.mock.calls[0][0]).toBe(ORBIT_WORKER);
  });

  it('asks the high tier for the big map', async () => {
    const pool = fakePool([answer]);
    await createOrbitMaps({ workers: pool, make: () => null }).get(spec, 'high');
    expect(pool.request.mock.calls[0][1].key.endsWith(':512x256')).toBe(true);
  });

  it('forgets the least recently used past its cap', async () => {
    const pool = fakePool([answer, answer, answer, answer]);
    const maps = createOrbitMaps({ workers: pool, make: () => null, cap: 2 });
    await maps.get(spec, 'mid');
    await maps.get(specB, 'mid');
    await maps.get(specC, 'mid');
    await maps.get(spec, 'mid');
    expect(pool.request).toHaveBeenCalledTimes(4);
    expect(maps.peek(specC, 'mid')).not.toBeNull();
    expect(maps.peek(specB, 'mid')).toBeNull();
  });

  it('answers null for a cancelled or failed bake, keeps nothing, asks again next time', async () => {
    const pool = fakePool([() => null, answer]);
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    expect(await maps.get(spec, 'mid')).toBeNull();
    expect(maps.peek(spec, 'mid')).toBeNull();
    expect(await maps.get(spec, 'mid')).not.toBeNull();
    expect(pool.request).toHaveBeenCalledTimes(2);
  });

  it('never throws, and asks again after a pool that threw', async () => {
    const pool = fakePool([answer]);
    pool.request.mockRejectedValueOnce(new Error('no worker'));
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    expect(await maps.get(spec, 'mid')).toBeNull();
    expect(await maps.get(spec, 'mid')).not.toBeNull();
  });

  it('closes its workers on dispose', async () => {
    const pool = fakePool([answer]);
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    await maps.get(spec, 'mid');
    expect(maps.stats()).toEqual({ cached: 1, flying: 0 });
    maps.dispose();
    expect(pool.close).toHaveBeenCalledWith(ORBIT_WORKER);
    expect(maps.stats().cached).toBe(0);
  });

  it('stores nothing', () => {
    for (const f of ['orbitMaps.js', 'orbitMap.js']) {
      expect(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).not.toMatch(/localStorage|indexedDB|rt\.store|rt\.saves/);
    }
  });
});
