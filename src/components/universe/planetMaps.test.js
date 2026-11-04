import * as THREE from 'three';
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

  it('wraps the cloud maps round as they load (their shadows are read where the clouds have turned to)', async () => {
    const T = await loadTextures({ level: 'high' });
    expect(T['rickmorty-clouds'].wrapS).toBe(THREE.RepeatWrapping);
    expect(T['caribbean-clouds'].wrapS).toBe(THREE.RepeatWrapping);
    expect(T.rickmorty.wrapS).toBeUndefined();
  });
});

describe('mapSwapper: a planet’s near maps put on in place of its own', () => {
  const tex = (o = {}) => Object.assign(new THREE.Texture(), { colorSpace: THREE.SRGBColorSpace, anisotropy: 8 }, o);
  const planet = (map) => {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ map });
    group.add(new THREE.Mesh(new THREE.SphereGeometry(1), mat));
    return { group, mat };
  };

  it('wears the near map, and one already set up as its own is not sent to the chip again', async () => {
    const { mapSwapper } = await import('./planetMaps');
    const own = tex();
    const near = tex(); // (as nearMaps has it: the same loader, colour flag and wrap, then uploaded)
    const { group, mat } = planet(own);
    const v = near.version;
    mapSwapper(group, { earth: own }, ['earth'])({ earth: near });
    expect(mat.map).toBe(near);
    expect(near.version).toBe(v); // (no second upload of a set already on the chip)
  });

  it('sends a near map again when it takes a wrap, colour space or sharpness its own had and it lacked', async () => {
    const { mapSwapper } = await import('./planetMaps');
    for (const [key, ownValue, nearValue] of [
      ['wrapS', THREE.RepeatWrapping, THREE.ClampToEdgeWrapping],
      ['wrapT', THREE.MirroredRepeatWrapping, THREE.ClampToEdgeWrapping],
      ['colorSpace', THREE.NoColorSpace, THREE.SRGBColorSpace],
      ['anisotropy', 16, 1],
    ]) {
      const own = tex({ [key]: ownValue });
      const near = tex({ [key]: nearValue });
      const { group } = planet(own);
      const v = near.version;
      mapSwapper(group, { earth: own }, ['earth'])({ earth: near });
      expect(near[key]).toBe(ownValue);
      // (sampler settings and the colour space are read as a texture's uploaded:
      // changed after, they reach the chip only with a new version)
      expect(near.version, key).toBeGreaterThan(v);
    }
  });

  it('puts its own back with null', async () => {
    const { mapSwapper } = await import('./planetMaps');
    const own = tex();
    const { group, mat } = planet(own);
    const swap = mapSwapper(group, { earth: own }, ['earth']);
    swap({ earth: tex() });
    swap(null);
    expect(mat.map).toBe(own);
  });
});
