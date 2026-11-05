import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

// Every map loaded as the site loads it (lib/three/textures' sharpen on a
// fresh texture, with the colour flag asked for): a KTX2 as a compressed one
vi.mock('../../lib/three/textures', async (own) => {
  const real = await own();
  return {
    ...real,
    loadTexture: vi.fn(async (url, opts = {}) => real.sharpen(url.endsWith('.ktx2') ? new THREE.CompressedTexture() : new THREE.Texture(), opts)),
  };
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('a planet’s near maps, loaded as its own are', () => {
  it('match its own maps’ wrap, colour space and sharpness, so none is sent to the chip twice in the swap', async () => {
    const { loadTexture } = await import('../../lib/three/textures');
    const { loadTextures, mapSwapper, mapsOf, nearSet } = await import('./planetMaps');
    const { createNearMaps } = await import('./nearMaps');
    const { UNIVERSES } = await import('./universes');
    for (const level of ['high', 'ultra']) {
      const T = await loadTextures({ level });
      let checked = 0;
      for (const u of UNIVERSES) {
        const names = mapsOf(u.id).filter((n) => T[n]);
        if (!names.length) continue;
        // the planet wearing its own maps, as buildPlanet puts them on
        const group = new THREE.Group();
        for (const n of names) group.add(new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshStandardMaterial({ map: T[n] })));
        const swap = mapSwapper(group, T, names);
        let worn = null;
        const near = createNearMaps({ level, load: loadTexture, wait: () => Promise.resolve() });
        const planet = { id: u.id, at: [0, 0, 0], r: 1, nearSet: () => nearSet(u.id, level), swapMaps: (T2) => (worn = T2) };
        near.update([0, 0, 0], [planet]);
        await flush();
        await flush();
        if (!worn) continue;
        const versions = Object.fromEntries(Object.entries(worn).map(([n, t]) => [n, t.version]));
        swap(worn);
        for (const [n, t] of Object.entries(worn)) {
          expect(t.version, `${level} ${n}: sent again in the swap`).toBe(versions[n]);
          expect([t.wrapS, t.wrapT, t.colorSpace, t.anisotropy], `${level} ${n}`).toEqual([T[n].wrapS, T[n].wrapT, T[n].colorSpace, T[n].anisotropy]);
          checked += 1;
        }
        near.dispose();
      }
      expect(checked, level).toBeGreaterThan(5);
    }
  });
});
