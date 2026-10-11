import { describe, expect, it, vi } from 'vitest';
import { canonicalId, createManifestDriver, extOf, kindForPath, resolveUrl } from './manifest';

const fakeAssets = () => ({
  prefetch: vi.fn(),
  gltf: vi.fn((u) => Promise.resolve({ u })),
  texture: vi.fn((u) => Promise.resolve({ u })),
  audio: vi.fn((u) => Promise.resolve({ u })),
});

describe('canonicalId', () => {
  it('turns Windows backslashes into forward slashes (the 404 bug)', () => {
    expect(canonicalId('maps\\endor\\tree.glb')).toBe('maps/endor/tree.glb');
  });
  it('strips a leading ./ and /, doubled and trailing slashes', () => {
    expect(canonicalId('./a//b/')).toBe('a/b');
    expect(canonicalId('/a/b')).toBe('a/b');
    expect(canonicalId('a\\\\b')).toBe('a/b');
  });
});

describe('extOf / kindForPath', () => {
  it('reads the extension case-insensitively', () => {
    expect(extOf('a/b.KTX2')).toBe('ktx2');
    expect(extOf('noext')).toBe('');
  });
  it('maps extensions to loader kinds', () => {
    expect(kindForPath('x.glb')).toBe('gltf');
    expect(kindForPath('x.ktx2')).toBe('texture');
    expect(kindForPath('x.mp3')).toBe('audio');
    expect(kindForPath('x.txt')).toBe(null);
  });
});

describe('resolveUrl', () => {
  it('joins a base and a path with exactly one slash', () => {
    expect(resolveUrl('https://cdn.test/bucket', 'a/b.glb')).toBe('https://cdn.test/bucket/a/b.glb');
    expect(resolveUrl('https://cdn.test/bucket/', '/a/b.glb')).toBe('https://cdn.test/bucket/a/b.glb');
  });
  it('passes an already-absolute URL through and tolerates no base', () => {
    expect(resolveUrl('https://cdn.test', 'https://other/x.glb')).toBe('https://other/x.glb');
    expect(resolveUrl('', 'a/b.glb')).toBe('a/b.glb');
  });
});

describe('createManifestDriver', () => {
  const manifest = {
    assets: [
      { id: 'hud.ktx2', tier: 'boot' },
      { id: 'player.glb', tier: 'boot' },
      { id: 'endor/tree.glb', map: 'endor', pos: [0, 0] },
      { id: 'endor/rock.ktx2', map: 'endor', pos: [100, 0] },
      { id: 'endor/ambience.mp3', map: 'endor', tier: 'map', pos: [0, 0] },
      { id: 'hoth/snow.ktx2', map: 'hoth', pos: [0, 0] },
    ],
  };

  it('throws without assets', () => {
    expect(() => createManifestDriver({ manifest })).toThrow(/assets/);
  });

  it('resolves urls against the base and infers kind', () => {
    const d = createManifestDriver({ assets: fakeAssets(), manifest, base: 'https://cdn.test/b' });
    expect(d.count()).toBe(6);
    expect(d.urlFor('endor/tree.glb')).toBe('https://cdn.test/b/endor/tree.glb');
    expect(d.row('endor/tree.glb').kind).toBe('gltf');
    // unknown id still resolves to a joined url
    expect(d.urlFor('missing.glb')).toBe('https://cdn.test/b/missing.glb');
  });

  it('boot() loads and awaits only the boot tier, by kind', async () => {
    const assets = fakeAssets();
    const d = createManifestDriver({ assets, manifest, base: 'b' });
    const loaded = await d.boot();
    expect(loaded).toHaveLength(2);
    expect(assets.texture).toHaveBeenCalledWith('b/hud.ktx2');
    expect(assets.gltf).toHaveBeenCalledWith('b/player.glb');
    expect(assets.gltf).toHaveBeenCalledTimes(1); // player only, not the map trees
  });

  it('load() resolves one asset and rejects an unknown id', async () => {
    const assets = fakeAssets();
    const d = createManifestDriver({ assets, manifest, base: 'b' });
    await expect(d.load('player.glb')).resolves.toEqual({ u: 'b/player.glb' });
    await expect(d.load('nope.glb')).rejects.toThrow(/nope\.glb/);
  });

  it('prefetchMap() queues a map by kind and priority, skipping boot and other maps', () => {
    const assets = fakeAssets();
    const d = createManifestDriver({ assets, manifest, base: 'b' });
    d.prefetchMap('endor');
    const calls = assets.prefetch.mock.calls;
    const urls = calls.flatMap((c) => c[0]);
    expect(urls).toContain('b/endor/tree.glb');
    expect(urls).toContain('b/endor/ambience.mp3');
    expect(urls).not.toContain('b/hoth/snow.ktx2');
    expect(urls).not.toContain('b/player.glb');
    // the audio row is tier 'map' (priority 2), the textures/gltf default 'lazy' (4)
    const audioCall = calls.find((c) => c[1].kind === 'audio');
    expect(audioCall[1].priority).toBe(2);
    expect(calls.find((c) => c[1].kind === 'gltf')[1].priority).toBe(4);
  });

  it('near() queues only rows within the radius', () => {
    const assets = fakeAssets();
    const d = createManifestDriver({ assets, manifest, base: 'b' });
    d.near([0, 0], 50, { map: 'endor' });
    const urls = assets.prefetch.mock.calls.flatMap((c) => c[0]);
    expect(urls).toContain('b/endor/tree.glb'); // at [0,0], in range
    expect(urls).not.toContain('b/endor/rock.ktx2'); // at [100,0], out of range
  });
});
