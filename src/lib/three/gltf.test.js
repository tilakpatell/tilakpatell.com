import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { COMPRESSED, SHIP_PROFILE, detectSupport, ktx2Loader, loadGltf, loadGltfFile, meshoptWorkers, probeRenderer, tune, tuneTree, usesBasisu } from './gltf';

// (the Basis transcoder taken as up: the KTX2 loader's tests ask nothing of it)
vi.mock('./wasmDecoders.js', async (importOriginal) => ({ ...(await importOriginal()), basisUp: async (k) => k }));

// (one file the bucket holds, for the asset base's case)
vi.mock('../../data/assets-manifest.json', () => ({ default: { 'kit/crate.glb': { hash: 'aaaaaaaaaaaa', bytes: 70000 }, 'hq/models/lamp.glb': { hash: 'cccccccccccc', bytes: 70000 } } }));

// a GLB with the given JSON chunk
// (`size`: the whole file that long, its JSON padded with spaces, as a
// manifest's bytes promise)
function glb(json, size = 0) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const pad = Math.max((4 - (text.length % 4)) % 4, size - 20 - text.length);
  const len = text.length + pad;
  const out = new Uint8Array(20 + len);
  const dv = new DataView(out.buffer);
  out.set([0x67, 0x6c, 0x54, 0x46], 0); // glTF
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.length, true);
  dv.setUint32(12, len, true);
  dv.setUint32(16, 0x4e4f534a, true); // JSON
  out.set(text, 20);
  for (let i = 0; i < pad; i++) out[20 + text.length + i] = 0x20;
  return out.buffer;
}

describe('spotting GPU-compressed textures before parsing', () => {
  it('reads a GLB’s JSON chunk', () => {
    expect(usesBasisu(glb({ asset: { version: '2.0' }, extensionsUsed: ['EXT_meshopt_compression', 'KHR_texture_basisu'] }))).toBe(true);
    expect(usesBasisu(glb({ asset: { version: '2.0' }, extensionsUsed: ['EXT_meshopt_compression', 'EXT_texture_webp'] }))).toBe(false);
  });
  it('reads a .gltf’s text', () => {
    expect(usesBasisu('{"extensionsUsed":["KHR_texture_basisu"]}')).toBe(true);
    expect(usesBasisu('{"extensionsUsed":["EXT_texture_webp"]}')).toBe(false);
  });
  it('says no to nothing', () => {
    expect(usesBasisu(new Uint8Array(4))).toBe(false);
    expect(usesBasisu(new ArrayBuffer(0))).toBe(false);
  });
});

// a stand-in for a MeshStandardMaterial: the fields tune reads
const mat = (over = {}) => ({ name: '', roughness: 0, metalness: 1, roughnessMap: null, metalnessMap: null, envMapIntensity: 1, color: { hex: 0x3366cc }, emissive: { hex: 0, getHex: () => 0, copy(c) { this.hex = c.hex; } }, emissiveIntensity: 1, ...over });

describe('clamping a generator’s defaults', () => {
  it('brings roughness into range where no map decides it', () => {
    expect(tune(mat({ roughness: 0 }), { roughness: [0.35, 0.9] }).roughness).toBe(0.35);
    expect(tune(mat({ roughness: 1 }), { roughness: [0.35, 0.9] }).roughness).toBe(0.9);
    expect(tune(mat({ roughness: 0.6 }), { roughness: [0.35, 0.9] }).roughness).toBe(0.6);
    expect(tune(mat({ roughness: 0, roughnessMap: {} }), { roughness: [0.35, 0.9] }).roughness).toBe(0);
  });
  it('takes the metal off plastic and cloth, not off things named metal', () => {
    expect(tune(mat({ name: 'Shirt' }), { metalness: 0 }).metalness).toBe(0);
    expect(tune(mat({ name: 'Hull plating' }), { metalness: 0 }).metalness).toBe(1);
    expect(tune(mat({ name: 'Shirt', metalnessMap: {} }), { metalness: 0 }).metalness).toBe(1);
  });
  it('lights the lamps', () => {
    const m = tune(mat({ name: 'Engine_glow' }), { glow: { names: /glow|light|engine/i, intensity: 3 } });
    expect(m.emissive.hex).toBe(0x3366cc);
    expect(m.emissiveIntensity).toBe(3);
    const plain = tune(mat({ name: 'Seat' }), { glow: { names: /glow|light|engine/i, intensity: 3 } });
    expect(plain.emissive.hex).toBe(0);
  });
  it('leaves a material alone with no rules, and survives none at all', () => {
    const m = mat({ roughness: 0.1, metalness: 1 });
    expect(tune(m)).toBe(m);
    expect(m.roughness).toBe(0.1);
    expect(tune(null)).toBe(null);
  });
});

describe('the hero ships’ finish', () => {
  it('the ship profile clamps a clay export into paint and metal', () => {
    const hull = new THREE.MeshStandardMaterial({ name: 'hull', roughness: 1, metalness: 1 });
    const trim = new THREE.MeshStandardMaterial({ name: 'metal_trim', roughness: 0.1, metalness: 0 });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), hull), new THREE.Mesh(new THREE.BoxGeometry(), [trim, hull]));
    tuneTree(root, SHIP_PROFILE);
    expect(hull.roughness).toBe(0.6);
    expect(hull.metalness).toBe(0.1);
    expect(trim.roughness).toBe(0.42);
    expect(trim.metalness).toBe(0.65);
    expect(hull.envMapIntensity).toBe(1.3);
    expect(trim.envMapIntensity).toBe(1.3);
  });

  it('the ship profile’s light: key 1, fill 0.6 (so a ship’s shadow side still reads), rim a half', () => {
    expect(SHIP_PROFILE.light).toEqual({ key: 1, fill: 0.6, rim: 0.5 });
  });

  it('keeps a single metalness for things not named metal, as before', () => {
    const plastic = tune({ name: 'body', metalness: 1 }, { metalness: 0.2 });
    const chrome = tune({ name: 'chrome', metalness: 1 }, { metalness: 0.2 });
    expect(plastic.metalness).toBe(0.2);
    expect(chrome.metalness).toBe(1);
  });
});

describe('a model the bucket holds', () => {
  it('is asked of the asset base first, and of the site once the base fails', async () => {
    const { forgetDown, isDown } = await import('../assetBase');
    const { useAssetPool } = await import('../assetLoad');
    const { createAssetFetch } = await import('../net/assetFetch');
    vi.stubEnv('VITE_ASSET_BASE', 'https://bucket.test/assets');
    const asked = [];
    useAssetPool(
      createAssetFetch({
        fetch: async (url) => {
          asked.push(url);
          throw new TypeError('unreachable');
        },
        sleep: async () => {},
      }),
    );
    try {
      expect(await loadGltf('/kit/crate.glb')).toBeNull();
      // (each tried four times: once and three retries)
      expect([...new Set(asked)]).toEqual(['https://bucket.test/assets/aaaaaaaaaaaa/kit/crate.glb', '/kit/crate.glb']);
      expect(asked.length).toBe(8);
      expect(isDown()).toBe(true);
    } finally {
      useAssetPool(null);
      vi.unstubAllEnvs();
      forgetDown();
    }
  });
});

describe('a model a world parses itself', () => {
  it('is asked of the asset base too, through the shared loader’s own load', async () => {
    const { useAssetPool } = await import('../assetLoad');
    const { createAssetFetch } = await import('../net/assetFetch');
    vi.stubEnv('VITE_ASSET_BASE', 'https://bucket.test/assets');
    const asked = [];
    useAssetPool(
      createAssetFetch({
        fetch: async (url) => {
          asked.push(url);
          // (the bucket's file as long as the manifest says, the site's as it comes)
          return new Response(glb({ asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 }, url.includes('lamp') ? 70000 : 0));
        },
        sleep: async () => {},
      }),
    );
    try {
      expect((await loadGltfFile('/hq/models/lamp.glb')).scene).toBeTruthy();
      expect((await loadGltfFile('/models/sketchfab/door.glb')).scene).toBeTruthy();
      expect(asked).toEqual(['https://bucket.test/assets/cccccccccccc/hq/models/lamp.glb', '/models/sketchfab/door.glb']);
    } finally {
      useAssetPool(null);
      vi.unstubAllEnvs();
    }
  });

  it('stops with its world: an abort rejects the load and nothing is parsed', async () => {
    const { useAssetPool, worldScope } = await import('../assetLoad');
    const { createAssetFetch } = await import('../net/assetFetch');
    let late = null;
    useAssetPool(createAssetFetch({ fetch: () => new Promise((r) => (late = r)), sleep: async () => {} }));
    const parse = vi.spyOn(GLTFLoader.prototype, 'parse');
    try {
      const world = worldScope('test');
      const p = loadGltf('/models/galaxy/crew/left.glb', { prepare: false });
      await new Promise((r) => setTimeout(r, 0));
      world.end();
      expect(await p).toBeNull();
      late(new Response(glb({ asset: { version: '2.0' } })));
      await new Promise((r) => setTimeout(r, 0));
      expect(parse).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
      useAssetPool(null);
    }
  });
});

// (lane S1: a page answered in a model's place, the dev server's for a file a
// checkout lacks, threw inside the parse's promise callback, out of reach of
// load()'s try, and reached the page as an unhandled rejection)
describe('a file that is not a model', () => {
  it('fails the load through its error path, not as an unhandled rejection', async () => {
    const { gltfLoader } = await import('./gltf');
    const page = new TextEncoder().encode('<!doctype html><html></html>').buffer;
    const unhandled = vi.fn();
    globalThis.process.on('unhandledRejection', unhandled);
    try {
      const err = await new Promise((resolve) => gltfLoader().parse(page, '', () => resolve(null), resolve));
      expect(err).toBeInstanceOf(Error);
      expect(String(err)).toMatch(/JSON|Unexpected/);
      await new Promise((r) => setTimeout(r, 10));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      globalThis.process.off('unhandledRejection', unhandled);
    }
  });
});

describe('the chip’s KTX2 formats', () => {
  // a node renderer as three r186 has it: hasFeature throws till init() has resolved
  const nodeRenderer = ({ fails = false } = {}) => {
    let up = false;
    return {
      isWebGPURenderer: true,
      hasInitialized: () => up,
      init: vi.fn(async () => {
        if (fails) throw new Error('no adapter');
        up = true;
      }),
      hasFeature: (name) => {
        if (!up) throw new Error('THREE.Renderer: .hasFeature() called before the backend is initialized');
        return name === 'texture-compression-bc';
      },
    };
  };
  // (a KTX2 loader's reading, as three's: a node renderer's features, else its extensions)
  const reader = () => ({ detectSupport: vi.fn((r) => (r.isWebGPURenderer ? r.hasFeature('texture-compression-bc') : r.extensions.has('EXT_texture_compression_bptc'))) });

  it('waits for a node renderer not yet up, then reads its formats; one already up is not asked again', async () => {
    const r = nodeRenderer();
    const k = reader();
    expect(await detectSupport(k, r)).toBe(k);
    expect(r.init).toHaveBeenCalledTimes(1);
    expect(k.detectSupport).toHaveBeenCalledWith(r);
    await detectSupport(k, r);
    expect(r.init).toHaveBeenCalledTimes(1);
    // (the classic renderer has no init to wait for)
    const classic = { extensions: { has: () => false } };
    expect(await detectSupport(k, classic)).toBe(k);
  });

  it('names a renderer that cannot say, or never comes up, rather than throwing unhandled', async () => {
    await expect(detectSupport(reader(), nodeRenderer({ fails: true }))).rejects.toMatchObject({ name: 'KTX2SupportError', message: expect.stringContaining('no adapter') });
    const never = { ...nodeRenderer(), init: () => new Promise(() => {}) };
    await expect(detectSupport(reader(), never, { timeoutMs: 5 })).rejects.toMatchObject({ name: 'KTX2SupportError', message: expect.stringContaining('did not come up') });
  });

  // (the first ask of the KTX2 loader in this file: nothing before it needs one)
  it('lets a loader that could not read the chip go, and the next ask makes another', async () => {
    await expect(ktx2Loader({ renderer: nodeRenderer({ fails: true }) })).rejects.toMatchObject({ name: 'KTX2SupportError' });
    const k = await ktx2Loader({ renderer: nodeRenderer() });
    expect(k.workerConfig).toMatchObject({ bptcSupported: true, astcSupported: false });
  });
});

// (every GLB here is meshopt-compressed: its decode in the decoder's own
// workers, off the main thread, one fewer than the cores and two at most)
describe('the meshopt decoder’s workers', () => {
  it('takes one fewer than the cores, two at most, one at least, none without Worker', () => {
    expect(meshoptWorkers(8, true)).toBe(2);
    expect(meshoptWorkers(2, true)).toBe(1);
    expect(meshoptWorkers(1, true)).toBe(1);
    expect(meshoptWorkers(undefined, true)).toBe(1);
    expect(meshoptWorkers(8, false)).toBe(0);
  });
});

// (a probe holds none of the browser's few live contexts: the formats read at once, the context let go)
describe('the compressed-format probe', () => {
  it('asks the high-performance chip, reads its formats and lets the context go', () => {
    const lose = vi.fn();
    const asked = [];
    const gl = { getExtension: (n) => (n === 'WEBGL_lose_context' ? { loseContext: lose } : n === 'EXT_texture_compression_bptc' ? {} : null) };
    const doc = { createElement: () => ({ getContext: (kind, opts) => (asked.push([kind, opts]), gl) }) };
    const probe = probeRenderer(doc);
    expect(asked[0][1].powerPreference).toBe('high-performance');
    expect(lose).toHaveBeenCalledTimes(1);
    expect(probe.extensions.has('EXT_texture_compression_bptc')).toBe(true);
    expect(probe.extensions.has('WEBGL_compressed_texture_astc')).toBe(false);
    expect(COMPRESSED).toContain('WEBGL_compressed_texture_s3tc');
  });

  it('says none where no context can be had', () => {
    expect(probeRenderer({ createElement: () => ({ getContext: () => null }) }).extensions.has('EXT_texture_compression_bptc')).toBe(false);
    expect(probeRenderer(null).extensions.has('WEBGL_compressed_texture_astc')).toBe(false);
  });
});
