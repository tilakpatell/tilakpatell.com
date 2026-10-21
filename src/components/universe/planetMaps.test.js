import { describe, expect, it, vi } from 'vitest';

// (no network: each map "loads" at once, and one of them is missing)
vi.mock('../../lib/three/textures', async (own) => ({
  ...(await own()),
  loadTexture: vi.fn(async (url) => {
    if (url.includes('/earth-clouds')) throw new Error('404');
    return { url };
  }),
}));

const { MAP_NAMES, loadTextures } = await import('./planetMaps');

describe('loadTextures', () => {
  it('tells the share of the maps in as they come, ending whole even with one missing', async () => {
    const told = [];
    const T = await loadTextures({ level: 'high', onStep: (k) => told.push(k) });
    expect(told).toHaveLength(MAP_NAMES.length);
    expect(told.at(-1)).toBe(1);
    for (let i = 1; i < told.length; i++) expect(told[i]).toBeGreaterThan(told[i - 1]);
    expect(T.earth).toBeTruthy();
    expect(T['earth-clouds']).toBeUndefined();
  });
});
