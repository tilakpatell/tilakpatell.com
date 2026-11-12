import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ORBIT_WORKER, createOrbitMaps } from './orbitMaps';

const map = (msg) => ({ key: msg.key, width: msg.width, height: msg.height, rgba: new Uint8ClampedArray(4), biome: new Uint8Array(1) });
let answers;
let pool;
beforeEach(() => {
  answers = [];
  pool = { define: vi.fn(), request: vi.fn(async (name, msg) => answers.shift()?.(msg) ?? null), close: vi.fn() };
});
const spec = { id: 'e:3,-2:1:0' };
const other = (id) => ({ id });

describe('createOrbitMaps', () => {
  it('bakes once for two asks at once, and serves the next from memory', async () => {
    answers.push(map);
    const maps = createOrbitMaps({ workers: pool, make: () => null });
    expect(pool.define).toHaveBeenCalledTimes(1);
    expect(pool.define.mock.calls[0][0]).toBe(ORBIT_WORKER);
    const [a, b] = await Promise.all([maps.get(spec, 'mid'), maps.get(spec, 'mid')]);
    expect(a).toBe(b);
    expect(pool.request).toHaveBeenCalledTimes(1);
    expect(pool.request.mock.calls[0][1]).toMatchObject({ key: `${spec.id}:256x128`, width: 256, height: 128, spec });
    expect(await maps.get(spec, 'low')).toBe(a);
    expect(maps.peek(spec, 'mid')).toBe(a);
  });

  it('asks the high tier for the big map', async () => {
    answers.push(map);
    await createOrbitMaps({ workers: pool }).get(spec, 'high');
    expect(pool.request.mock.calls[0][1].key).toMatch(/:512x256$/);
  });

  it('forgets the least recently used past its cap', async () => {
    answers.push(map, map, map, map);
    const maps = createOrbitMaps({ workers: pool, cap: 2 });
    for (const id of ['A', 'B', 'C', 'A']) await maps.get(other(id), 'mid');
    expect(pool.request).toHaveBeenCalledTimes(4);
    expect(maps.peek(other('C'), 'mid')).not.toBeNull();
    expect(maps.peek(other('B'), 'mid')).toBeNull();
  });

  it('answers null for a cancelled or failed bake, keeps nothing, asks again next time', async () => {
    answers.push(() => null, map);
    const maps = createOrbitMaps({ workers: pool });
    expect(await maps.get(spec, 'mid')).toBeNull();
    expect(maps.peek(spec, 'mid')).toBeNull();
    expect(await maps.get(spec, 'mid')).not.toBeNull();
    expect(pool.request).toHaveBeenCalledTimes(2);
    pool.request.mockImplementationOnce(async () => {
      throw new Error('worker died');
    });
    expect(await maps.get(other('Z'), 'mid')).toBeNull();
  });

  it('closes its workers on dispose', async () => {
    answers.push(map);
    const maps = createOrbitMaps({ workers: pool });
    await maps.get(spec, 'mid');
    maps.dispose();
    expect(pool.close).toHaveBeenCalledWith(ORBIT_WORKER);
    expect(maps.stats().cached).toBe(0);
  });

  it('stores nothing', () => {
    for (const f of ['./orbitMaps.js', './orbitMap.js']) expect(readFileSync(new URL(f, import.meta.url), 'utf8')).not.toMatch(/localStorage|indexedDB|rt\.store|rt\.saves/);
  });
});
