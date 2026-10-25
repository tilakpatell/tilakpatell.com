import { afterAll, describe, expect, it } from 'vitest';
import { MAP_N, rasterKey } from '../../../lib/land/flight/mapRaster';
import { leafOf } from '../../../lib/land/flight/quadtree';
import { planetSpecOf } from './planets';
import { roundSpec } from '../../../lib/land/flight/fixtures/generated';

// the terrain worker as the page sees it: a message in, one answer out
const posted = [];
globalThis.self = { postMessage: (data, transfer) => posted.push({ data, transfer }) };
await import('./terrain.worker.js');
afterAll(() => delete globalThis.self);
const ask = (msg) => {
  posted.length = 0;
  globalThis.self.onmessage({ data: msg });
  return posted[0];
};

describe('the terrain worker’s raster job', () => {
  const spec = planetSpecOf('hoth');

  it('answers a raster job with the raster, its buffers handed over', () => {
    const key = rasterKey(0, -1);
    const out = ask({ type: 'raster', key, spec, leaf: leafOf(3, 0, -1) });
    expect(out.data.key).toBe(key);
    expect(out.data.biome.length).toBe(MAP_N * MAP_N);
    expect(out.data.height.length).toBe(MAP_N * MAP_N);
    expect(out.transfer).toEqual([out.data.biome.buffer, out.data.height.buffer]);
    expect(out.data.positions).toBeUndefined();
  });

  it('answers a leaf as before, with no raster on it', () => {
    const leaf = leafOf(6, 3, 3);
    const out = ask({ key: leaf.key, spec, leaf, n: 9, tier: 'mid' });
    expect(out.data.key).toBe(leaf.key);
    expect(out.data.heights.length).toBe(81);
    expect(out.data.biome).toBeUndefined();
  });

  it('keeps a round planet’s fields apart by spot', () => {
    const leaf = leafOf(6, 0, 0);
    const one = roundSpec();
    const two = { ...one, round: { ...one.round, at: [0, 0, 1] } };
    const a = ask({ key: leaf.key, spec: one, leaf, n: 9, tier: 'mid' }).data.heights;
    const b = ask({ key: leaf.key, spec: two, leaf, n: 9, tier: 'mid' }).data.heights;
    expect(a.length).toBe(81);
    expect(b).not.toEqual(a);
  });
});
