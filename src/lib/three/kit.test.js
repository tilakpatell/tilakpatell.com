import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { budget } from '../budgets';
import { detailLevel, modelTexCap } from '../detail';
import { WIND } from './foliage';
import { createHouse } from './house';
import { createPool, kitMaterial, loadKit } from './kit';
import { BROWN, MANIFEST, fakeLoad } from './kit.fixture';
import { coverageTexture, fitTexture } from './textures';
import { createWind } from './wind';

// (the real functions, watched: which maps they're handed, and in what order)
vi.mock('./textures', async (importOriginal) => {
  const t = await importOriginal();
  return { ...t, fitTexture: vi.fn(t.fitTexture), coverageTexture: vi.fn(t.coverageTexture) };
});

const UP = new THREE.Vector3(0, 1, 0);
const HIGH = [budget('high').near, budget('high').mid]; // 70, 220

async function kitOf(opts = {}) {
  const load = opts.load ?? fakeLoad();
  const kit = loadKit('naturemega', { load, manifest: MANIFEST, ...opts });
  await kit.manifest;
  return { kit, load };
}

const camAt = (x = 0, z = 0) => {
  const c = new THREE.PerspectiveCamera();
  c.position.set(x, 30, z);
  return c;
};

// `n` items `d` metres from (cx, cz) across the ground, round a circle
const ring = (n, d, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + d * Math.cos(a), y: 0, z: cz + d * Math.sin(a), yaw: a };
  });

const meshesAt = (pool, level) => pool.group.children.filter((m) => m.userData.level === level);
const where = (mesh, i) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, i * 16));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete globalThis.document;
});

describe('loadKit: models and materials', () => {
  it('shares one material a manifest name across models and family files', async () => {
    const { kit } = await kitOf();
    const [b1, b2, b3] = await Promise.all(['Birch_1', 'Birch_2', 'Birch_3'].map((n) => kit.model(n)));
    for (const m of [b1, b2, b3]) {
      expect(m.parts).toHaveLength(2);
      expect(m.parts[0].material).toBe(kit.material('Bark_Birch'));
      expect(m.parts[1].material).toBe(kit.material('Leaves_Birch'));
      expect(m.parts.map((p) => p.part)).toEqual(['bark', 'leaves']);
    }
    // (Birch_3 is in birch-2.glb: the material is the kit's, not the file's)
    expect(kit.material('Bark_Birch').name).toBe('Bark_Birch');
    expect(kit.material('Bark_Birch')).toBeInstanceOf(THREE.MeshLambertMaterial);
  });

  it('tints a material by its manifest name, once a kit, and leaves the rest as dressed', async () => {
    const { kit } = await kitOf({ tint: { Leaves_Birch: '#b8a860' } });
    const { parts } = await kit.model('Birch_1');
    const leaves = parts.find((p) => p.material.name === 'Leaves_Birch').material;
    const bark = parts.find((p) => p.material.name === 'Bark_Birch').material;
    expect(leaves.color.getHexString()).toBe('b8a860');
    // (the fixture's bark is a standard material's own white: untouched)
    expect(bark.color.getHexString()).toBe('ffffff');
    // (the map stays: the tint multiplies it)
    expect(leaves.map).toBeTruthy();
    // (a material asked for before any file is in is tinted too)
    const early = await kitOf({ tint: { Rocks: 0x2a2624 } });
    expect(early.kit.material('Rocks').color.getHex()).toBe(0x2a2624);
  });

  it('recolours a material asked to be, in the house’s look and the wind, its map kept', async () => {
    const house = createHouse();
    const { kit } = await kitOf({ house, tint: { Leaves_Birch: { recolour: '#4a6a32' } } });
    const { parts } = await kit.model('Birch_1');
    const leaves = parts.find((p) => p.material.name === 'Leaves_Birch').material;
    expect(leaves.userData.recolour.uRecolour.value.getHexString()).toBe('4a6a32');
    expect(leaves.map).toBeTruthy();
    // (its program: the house's and the recolour's both, the colour after the map is read)
    const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader };
    leaves.onBeforeCompile(sh, {});
    expect(sh.uniforms.uRecolour).toBeTruthy();
    expect(sh.uniforms.uLookShadow).toBeTruthy();
    expect(sh.fragmentShader).toContain('uRecolour * clamp(');
    // (a plain tint is a multiplier, as before; the bark is neither)
    const bark = parts.find((p) => p.material.name === 'Bark_Birch').material;
    expect(bark.userData.recolour).toBeUndefined();
  });

  it('loads each file once, from <base>/<pack>/<file>', async () => {
    const { kit, load } = await kitOf();
    await Promise.all([kit.model('Birch_1'), kit.model('Birch_2'), kit.lod1('Birch_1'), kit.model('Birch_1')]);
    expect(load.calls).toEqual(['/kit/naturemega/birch.glb']);
    const other = await kitOf({ base: '/elsewhere' });
    await other.kit.model('Fern_1');
    expect(other.load.calls).toEqual(['/elsewhere/naturemega/fern.glb']);
  });

  it('gives back the manifest’s numbers with the parts', async () => {
    const { kit } = await kitOf();
    const m = await kit.model('Birch_1');
    const row = MANIFEST.models.Birch_1;
    expect(m).toMatchObject({ radius: row.radius, height: row.height, kind: 'tree', tones: row.tones });
    expect((await kit.model('Fern_1')).tones).toBeNull();
  });

  it('bakes a bending part’s node transform into a geometry of its own, in metres, its local the identity', async () => {
    const { kit, load } = await kitOf();
    const { parts } = await kit.model('Birch_1');
    const file = load.scenes['/kit/naturemega/birch.glb'];
    const top = (g) => (g.computeBoundingBox(), g.boundingBox.max.y);
    const near = (got, want) => expect(Math.abs(got - want) / want).toBeLessThan(0.02);
    for (const [i, p] of parts.entries()) {
      expect(p.local.equals(new THREE.Matrix4())).toBe(true);
      expect(p.geometry.attributes.position.array).toBeInstanceOf(Float32Array);
      // (the tree's top where the manifest has it, not the quantised 1)
      near(top(p.geometry), MANIFEST.models.Birch_1.height);
      // the file's own geometry left as the loader gave it
      const src = file.getObjectByName(`Birch_1_${i + 1}`).geometry;
      expect(p.geometry).not.toBe(src);
      expect(top(src)).toBeCloseTo(1, 6);
      expect(p.geometry.attributes.uv.count).toBe(src.attributes.uv.count);
      expect(p.geometry.userData.part).toBe(src.userData.part);
    }
    // the LOD1 at its own node's; a model of one primitive (its node a Mesh) too
    const lod = await kit.lod1('Birch_1');
    expect(lod[1].local.equals(new THREE.Matrix4())).toBe(true);
    near(top(lod[1].geometry), 6.471 + 6.899);
    const fern = await kit.model('Fern_1');
    expect(fern.parts[0].local.equals(new THREE.Matrix4())).toBe(true);
    near(top(fern.parts[0].geometry), MANIFEST.models.Fern_1.height);
  });

  it('keeps a part that doesn’t bend as it was: the file’s geometry, its node’s transform in its local', async () => {
    const { kit, load } = await kitOf();
    const [rock] = (await kit.model('Rock_1')).parts;
    expect(rock.geometry).toBe(load.scenes['/kit/naturemega/rock.glb'].getObjectByName('Rock_1').geometry);
    const t = new THREE.Vector3();
    const s = new THREE.Vector3();
    rock.local.decompose(t, new THREE.Quaternion(), s);
    expect([t.y, s.x]).toEqual([expect.closeTo(0.45, 6), expect.closeTo(0.6, 6)]);
    expect(new THREE.Vector3(0, 1, 0).applyMatrix4(rock.local).y).toBeCloseTo(MANIFEST.models.Rock_1.height, 3);
  });

  it('bends a crown in metres: the shader’s sums at a crown vertex give the whole bend, where the file’s geometry gave next to none', async () => {
    const { kit, load } = await kitOf();
    const crown = (await kit.model('Birch_1')).parts[1].geometry;
    const src = load.scenes['/kit/naturemega/birch.glb'].getObjectByName('Birch_1_2').geometry;
    // (foliage.js windShader, before the instance matrix: wH = clamp(y / height), wBend = wH² × weight)
    const bend = (g, i) => {
      const h = Math.min(1, Math.max(0, g.attributes.position.getY(i) / WIND.tree.height));
      return h * h * g.attributes._wind.getX(i);
    };
    const y = Array.from({ length: crown.attributes.position.count }, (_, i) => crown.attributes.position.getY(i));
    const top = y.indexOf(Math.max(...y));
    expect(y[top]).toBeCloseTo(MANIFEST.models.Birch_1.height, 2);
    expect(bend(crown, top)).toBeCloseTo(1, 3);
    // (the file's geometry, as the pools drew it before: its node's ×6.9 came after the bend, (1/7)²)
    expect(bend(src, top)).toBeLessThan(0.03);
  });

  it('bakes positions and normals as the loader gives them from the files: normalised shorts and bytes, interleaved', async () => {
    const plain = fakeLoad();
    // (each a view of its own, padded to four bytes a vertex as meshopt's are)
    const packed = (a, Type, max, stride) => {
      const data = new THREE.InterleavedBuffer(new Type(a.count * stride), stride);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < 3; c++) data.array[i * stride + c] = Math.round(a.getComponent(i, c) * max);
      return new THREE.InterleavedBufferAttribute(data, 3, 0, true);
    };
    const quantised = async (url) => {
      const got = await plain(url);
      const g = got.scene.getObjectByName('Birch_1_2')?.geometry;
      if (g) {
        g.setAttribute('position', packed(g.attributes.position, Int16Array, 32767, 4));
        g.setAttribute('normal', packed(g.attributes.normal, Int8Array, 127, 4));
      }
      return got;
    };
    const { kit } = await kitOf({ load: quantised });
    const crown = (await kit.model('Birch_1')).parts[1].geometry;
    expect(crown.attributes.position.isInterleavedBufferAttribute).toBeFalsy();
    expect(crown.attributes.position.array).toBeInstanceOf(Float32Array);
    crown.computeBoundingBox();
    expect(crown.boundingBox.max.y).toBeCloseTo(MANIFEST.models.Birch_1.height, 3);
    expect(new THREE.Vector3().fromBufferAttribute(crown.attributes.normal, 0).toArray()).toEqual([0, 0, 1].map((v) => expect.closeTo(v, 5)));
  });

  it('turns a bending part’s normals with its node', async () => {
    const plain = fakeLoad();
    const turned = async (url) => {
      const got = await plain(url);
      got.scene.getObjectByName('Birch_1').rotation.y = Math.PI / 2;
      return got;
    };
    const { kit } = await kitOf({ load: turned });
    const { parts } = await kit.model('Birch_1');
    const n = new THREE.Vector3().fromBufferAttribute(parts[0].geometry.attributes.normal, 0);
    // ((0, 0, 1) a quarter turn about up)
    expect(n.toArray()).toEqual([1, 0, 0].map((v) => expect.closeTo(v, 5)));
  });

  it('reads a part’s place from the file’s root, wherever a shared scene was put', async () => {
    const plain = fakeLoad();
    const moved = async (url) => {
      const got = await plain(url);
      got.scene.position.set(50, 0, -20);
      got.scene.updateMatrixWorld(true);
      return got;
    };
    const { kit } = await kitOf({ load: moved });
    const { parts } = await kit.model('Birch_1');
    const box = parts[0].geometry.boundingBox ?? (parts[0].geometry.computeBoundingBox(), parts[0].geometry.boundingBox);
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0.211, 3);
    expect(new THREE.Vector3().setFromMatrixPosition((await kit.model('Rock_1')).parts[0].local).x).toBeCloseTo(0, 6);
  });

  it('bakes each geometry once a kit, so two pools of a model draw one copy', async () => {
    const { kit } = await kitOf();
    const a = createPool(kit, 'Birch_1', { bands: HIGH, lod1: true });
    const b = createPool(kit, 'Birch_1', { bands: HIGH, lod1: true });
    await Promise.all([a.ready, b.ready]);
    expect(meshesAt(a, 0).map((m) => m.geometry)).toEqual(meshesAt(b, 0).map((m) => m.geometry));
    expect(meshesAt(a, 0)[0].geometry).toBe((await kit.model('Birch_1')).parts[0].geometry);
  });

  it('gives LOD1 parts in the same materials, and no LOD1 for a rig', async () => {
    const { kit } = await kitOf();
    const full = await kit.model('Birch_1');
    const lod = await kit.lod1('Birch_1');
    expect(lod).toHaveLength(2);
    expect(lod[0].material).toBe(full.parts[0].material);
    expect(lod[0].geometry).not.toBe(full.parts[0].geometry);
    expect(lod[0].geometry.attributes.position.count).toBeLessThan(full.parts[0].geometry.attributes.position.count);
    await expect(kit.lod1('Critter')).rejects.toThrow(/LOD1/);
  });

  it('fills a missing wind weight with ones, and keeps one a file has', async () => {
    const { kit, load } = await kitOf();
    const b1 = await kit.model('Birch_1');
    const b2 = await kit.model('Birch_2');
    const filled = b2.parts[1].geometry.attributes._wind;
    expect(filled.count).toBe(b2.parts[1].geometry.attributes.position.count);
    for (let i = 0; i < filled.count; i++) expect(filled.getX(i)).toBe(1);
    expect(b1.parts[1].geometry.attributes._wind.getX(0)).toBeCloseTo(36 / 255, 6);
    // (on the kit's own copy: the file's geometry is never given one)
    expect(load.scenes['/kit/naturemega/birch.glb'].getObjectByName('Birch_2_2').geometry.attributes._wind).toBeUndefined();
    // every geometry a weighted material wears has the weight
    for (const name of ['Birch_1', 'Birch_2', 'Birch_3', 'Fern_1', 'Rock_1']) {
      for (const p of [...(await kit.model(name)).parts, ...(await kit.lod1(name))]) {
        if (p.material.userData.wind) expect(p.geometry.attributes._wind, name).toBeTruthy();
      }
    }
  });

  it('bends bark and leaves together by the weight, a shrub as a shrub, and stone not at all', async () => {
    const time = { value: 3 };
    const { kit } = await kitOf({ wind: { time } });
    await Promise.all(['Birch_1', 'Fern_1', 'Rock_1'].map((n) => kit.model(n)));
    for (const name of ['Bark_Birch', 'Leaves_Birch', 'Leaves']) {
      const m = kit.material(name);
      expect(m.userData.wind, name).toBeTruthy();
      expect(m.userData.wind.uWindTime).toBe(time);
      expect(m.customProgramCacheKey()).toContain('|wind|w:_wind');
    }
    expect(kit.material('Bark_Birch').userData.wind.uWindHeight.value).toBe(WIND.tree.height);
    expect(kit.material('Leaves').userData.wind.uWindHeight.value).toBe(WIND.shrub.height);
    expect(kit.material('Rocks').userData.wind).toBeUndefined();
  });

  it('cuts leaves out at 0.3, two-sided and lit as one crown; bark solid', async () => {
    const { kit } = await kitOf();
    await kit.model('Birch_1');
    const leaf = kit.material('Leaves_Birch');
    expect(leaf.alphaTest).toBe(0.3);
    expect(leaf.side).toBe(THREE.DoubleSide);
    expect(leaf.userData.faceless).toBe(true);
    const bark = kit.material('Bark_Birch');
    expect(bark.alphaTest).toBe(0);
    expect(bark.userData.faceless).toBeUndefined();
    expect(bark.side).toBe(THREE.DoubleSide); // (as the file has it)
  });

  it('takes the maps and the colour from the first file that wears the name', async () => {
    const { kit, load } = await kitOf();
    await kit.model('Birch_1');
    await kit.model('Birch_3');
    const file = load.scenes['/kit/naturemega/birch.glb'];
    const src = file.getObjectByName('Birch_1_1').material;
    const bark = kit.material('Bark_Birch');
    expect(bark.map).toBe(src.map);
    expect(bark.normalMap).toBe(src.normalMap);
    expect(bark.normalScale.toArray()).toEqual([1, -1]);
    // a rig's (a farm animal's) look is its colour: no map at all
    const critter = await kit.model('Critter');
    const coat = critter.parts[0].material;
    expect(coat).toBe(kit.material('Brown'));
    expect(coat.map).toBeNull();
    expect(coat.color.getHex()).toBe(BROWN);
    expect(coat.vertexColors).toBe(false);
  });

  it('builds on the house’s material when given a house', async () => {
    const house = { material: vi.fn((o) => new THREE.MeshLambertMaterial(o)) };
    const { kit } = await kitOf({ house });
    const leaf = kit.material('Leaves_Birch');
    expect(house.material).toHaveBeenCalledWith(expect.objectContaining({ alphaTest: 0.3, side: THREE.DoubleSide }));
    expect(house.material.mock.results.map((r) => r.value)).toContain(leaf);
  });

  it('kitMaterial: a fresh material each call, its wind on the weight', () => {
    const def = MANIFEST.materials.Leaves_Birch;
    const a = kitMaterial(def);
    const b = kitMaterial(def);
    expect(a).not.toBe(b);
    expect(a.customProgramCacheKey()).toContain('|wind|w:_wind');
    expect(kitMaterial(MANIFEST.materials.Rocks).userData.wind).toBeUndefined();
  });

  it('wants the manifest in, and a name it has', async () => {
    const pending = loadKit('naturemega', { load: fakeLoad(), manifest: new Promise(() => {}) });
    expect(() => pending.material('Bark_Birch')).toThrow(/manifest/);
    const { kit } = await kitOf();
    expect(() => kit.material('Marble')).toThrow(/Marble/);
    await expect(kit.model('Oak_9')).rejects.toThrow(/Oak_9/);
  });

  it('fetches the manifest by default, and says which one it couldn’t', async () => {
    const fetch = vi.fn(async (url) => (url.endsWith('/naturemega/index.json') ? { ok: true, json: async () => MANIFEST } : { ok: false, status: 404 }));
    vi.stubGlobal('fetch', fetch);
    const kit = loadKit('naturemega', { load: fakeLoad() });
    expect(await kit.manifest).toEqual(MANIFEST);
    expect(fetch).toHaveBeenCalledWith('/kit/naturemega/index.json');
    await expect(loadKit('nowhere', { load: fakeLoad() }).manifest).rejects.toThrow('/kit/nowhere/index.json');
  });

  it('rejects a model whose file won’t load, naming the file', async () => {
    const manifest = { ...MANIFEST, models: { ...MANIFEST.models, Lost_1: { ...MANIFEST.models.Birch_1, file: 'lost.glb' } } };
    const { kit } = await kitOf({ manifest });
    await expect(kit.model('Lost_1')).rejects.toThrow('/kit/naturemega/lost.glb');
  });

  it('gives a rig’s parts', async () => {
    const { kit } = await kitOf();
    const { parts, kind } = await kit.model('Critter');
    expect(kind).toBe('character');
    expect(parts).toHaveLength(1);
  });

  it('frees only what it built when disposed of: its materials and the geometry it baked', async () => {
    const { kit, load } = await kitOf();
    const b1 = await kit.model('Birch_1');
    const b2 = await kit.model('Birch_2');
    const rock = await kit.model('Rock_1');
    const mine = vi.fn();
    const baked = vi.fn();
    const files = vi.fn();
    for (const p of [...b1.parts, ...b2.parts, ...rock.parts]) p.material.addEventListener('dispose', mine);
    for (const p of [...b1.parts, ...b2.parts]) p.geometry.addEventListener('dispose', baked);
    for (const url of ['/kit/naturemega/birch.glb', '/kit/naturemega/rock.glb']) load.scenes[url].traverse((o) => o.geometry?.addEventListener('dispose', files));
    b1.parts[1].material.map.addEventListener('dispose', files);
    b1.parts[0].material.normalMap.addEventListener('dispose', files);
    kit.dispose();
    expect(mine).toHaveBeenCalledTimes(3); // (the kit's bark, leaves and stone)
    expect(baked).toHaveBeenCalledTimes(4); // (each birch's bark and crown, in metres)
    expect(files).not.toHaveBeenCalled(); // (the page's model cache owns those, the rock's geometry with them)
  });

  it('shares a cached file with another kit of the pack: its maps covered once, its geometry never changed', async () => {
    const plain = fakeLoad();
    const cache = new Map();
    const load = (url) => {
      if (!cache.has(url)) cache.set(url, plain(url));
      return cache.get(url);
    };
    coverageTexture.mockClear();
    const a = (await kitOf({ load })).kit;
    const b = (await kitOf({ load })).kit;
    const pa = (await a.model('Birch_2')).parts;
    const pb = (await b.model('Birch_2')).parts;
    const leaf = a.material('Leaves_Birch').map;
    expect(b.material('Leaves_Birch').map).toBe(leaf);
    expect(b.material('Leaves_Birch')).not.toBe(a.material('Leaves_Birch'));
    expect(coverageTexture.mock.calls.filter(([t]) => t === leaf)).toHaveLength(1);
    expect(leaf.userData.covered).toBe(true);
    // (each kit's crown its own, weight and all: one kit gone takes nothing of the other's)
    expect(pb[1].geometry).not.toBe(pa[1].geometry);
    const freed = vi.fn();
    pb[1].geometry.addEventListener('dispose', freed);
    a.dispose();
    expect(freed).not.toHaveBeenCalled();
    expect(pb[1].geometry.attributes._wind.getX(0)).toBe(1);
    const src = (await cache.get('/kit/naturemega/birch.glb')).scene.getObjectByName('Birch_2_2').geometry;
    expect(src.attributes._wind).toBeUndefined();
    b.dispose();
    expect(freed).toHaveBeenCalledTimes(1);
  });
});

describe('loadKit: the leaf maps’ coverage mips', () => {
  it('fits a leaf map under the device’s ceiling before its coverage mips; bark maps are the loader’s', async () => {
    fitTexture.mockClear();
    coverageTexture.mockClear();
    const { kit } = await kitOf();
    await kit.model('Birch_1');
    const leaf = kit.material('Leaves_Birch').map;
    const fit = fitTexture.mock.calls.findIndex(([t]) => t === leaf);
    const cover = coverageTexture.mock.calls.findIndex(([t]) => t === leaf);
    expect(fitTexture.mock.calls[fit]).toEqual([leaf, modelTexCap()]);
    expect(coverageTexture.mock.calls[cover]).toEqual([leaf, { cut: 0.3 }]);
    expect(fitTexture.mock.invocationCallOrder[fit]).toBeLessThan(coverageTexture.mock.invocationCallOrder[cover]);
    const bark = kit.material('Bark_Birch').map;
    expect(fitTexture.mock.calls.some(([t]) => t === bark)).toBe(false);
    expect(coverageTexture.mock.calls.some(([t]) => t === bark)).toBe(false);
  });

  it('in Node (no canvas) leaves the chip’s mips and says nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { kit } = await kitOf();
    await Promise.all([kit.model('Birch_1'), kit.model('Fern_1')]);
    expect(kit.material('Leaves_Birch').map.generateMipmaps).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('in a browser, paints the coverage mips', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = {
      drawImage() {},
      putImageData() {},
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      // (a leaf in the left half of every row)
      getImageData: (x, y, w, h) => {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i++) data[i * 4 + 3] = i % w < w / 2 ? 255 : 0;
        return { data };
      },
    };
    globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
    const image = { width: 8, height: 8, getContext: () => ctx };
    const { kit } = await kitOf({ load: fakeLoad({ image }) });
    await kit.model('Birch_1');
    const map = kit.material('Leaves_Birch').map;
    expect(map.generateMipmaps).toBe(false);
    expect(map.mipmaps).toHaveLength(4); // 8, 4, 2, 1
    expect(warn).not.toHaveBeenCalled();
  });

  it('in a browser, says once when a canvas won’t give a leaf map’s pixels up', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.document = {
      createElement: () => ({
        getContext() {
          throw new Error('tainted');
        },
      }),
    };
    const image = { width: 8, height: 8, getContext() {} };
    const { kit } = await kitOf({ load: fakeLoad({ image }) });
    await Promise.all([kit.model('Birch_1'), kit.model('Fern_1')]);
    expect(kit.material('Leaves_Birch').map.generateMipmaps).toBe(true);
    expect(kit.material('Leaves').map.generateMipmaps).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('createPool', () => {
  let kit;
  // (a kit that makes no puffs, so a pool's far band is its LOD1's, as
  // these tests have it; the puffs' own tests below make a kit that does)
  beforeEach(async () => {
    ({ kit } = await kitOf({ puffs: false }));
  });

  async function poolOf(name = 'Birch_1', opts = {}) {
    const pool = createPool(kit, name, { bands: HIGH, lod1: true, wait: 0.5, ...opts });
    await pool.ready;
    return pool;
  }

  function threeRings(pool) {
    pool.set('a', ring(10, 10));
    pool.set('b', ring(10, 100));
    pool.set('c', ring(10, 300));
    pool.update(camAt(0, 0), 0);
  }

  it('draws each item at the level its distance calls for', async () => {
    const pool = await poolOf();
    threeRings(pool);
    expect(pool.stats.total).toBe(30);
    expect(pool.stats.levels).toEqual([10, 10, 10]);
    for (const level of [0, 1, 2]) {
      const meshes = meshesAt(pool, level);
      expect(meshes).toHaveLength(2);
      for (const m of meshes) expect(m.count).toBe(10);
    }
  });

  it('draws the full parts near, the LOD1 parts mid, and the LOD1 again (its own meshes) as the puff till one is given', async () => {
    const pool = await poolOf();
    const full = (await kit.model('Birch_1')).parts;
    const lod = await kit.lod1('Birch_1');
    expect(meshesAt(pool, 0).map((m) => m.geometry)).toEqual(full.map((p) => p.geometry));
    expect(meshesAt(pool, 1).map((m) => m.geometry)).toEqual(lod.map((p) => p.geometry));
    expect(meshesAt(pool, 2).map((m) => m.geometry)).toEqual(lod.map((p) => p.geometry));
    for (const m of meshesAt(pool, 2)) expect(meshesAt(pool, 1)).not.toContain(m);
    expect(meshesAt(pool, 0)[1].material).toBe(kit.material('Leaves_Birch'));
  });

  it('draws the puff at level 2 when given one', async () => {
    const puff = { geometry: new THREE.BufferGeometry(), material: new THREE.MeshLambertMaterial() };
    const pool = await poolOf('Birch_1', { puff });
    threeRings(pool);
    const [m] = meshesAt(pool, 2);
    expect(meshesAt(pool, 2)).toHaveLength(1);
    expect(m.geometry).toBe(puff.geometry);
    expect(m.material).toBe(puff.material);
    expect(m.count).toBe(10);
    // (the puff is in the tree's own frame: no local of its own)
    const p = where(m, 0);
    expect(p.x).toBeCloseTo(300, 3);
    expect(p.y).toBeCloseTo(0, 4);
    expect(p.z).toBeCloseTo(0, 4);
  });

  // Each level's instances as [{ at, x, y, z }]: where each is, and its
  // matrix's columns (x, up and +Z: the turn and the size together).
  const columns = (pool, level) =>
    meshesAt(pool, level).map((m) =>
      Array.from({ length: m.count }, (_, i) => {
        const e = m.instanceMatrix.array.subarray(i * 16, i * 16 + 16);
        return { at: new THREE.Vector3(e[12], e[13], e[14]), x: new THREE.Vector3(e[0], e[1], e[2]), y: new THREE.Vector3(e[4], e[5], e[6]), z: new THREE.Vector3(e[8], e[9], e[10]) };
      }),
    );

  // every puff instance's +Z toward `cam` across the ground, turned about up only, its size kept
  const facing = (pool, cam) => {
    const [list] = columns(pool, 2);
    expect(list.length).toBeGreaterThan(0);
    for (const { at, x, y, z } of list) {
      const to = new THREE.Vector3(cam.x - at.x, 0, cam.z - at.z).normalize();
      expect(z.clone().normalize().dot(to)).toBeGreaterThan(0.99);
      expect(z.y).toBeCloseTo(0, 6);
      expect(x.y).toBeCloseTo(0, 6);
      expect(y.x).toBeCloseTo(0, 6);
      expect(y.z).toBeCloseTo(0, 6);
      expect(z.length()).toBeCloseTo(y.y, 5);
      expect(x.length()).toBeCloseTo(y.y, 5);
    }
  };

  it('turns the puff’s instances to face the camera at each sort, about up only, the nearer levels keeping their own turn', async () => {
    ({ kit } = await kitOf()); // (the kit's puffs on: a puff handed over still wins)
    const puff = { geometry: new THREE.BufferGeometry(), material: new THREE.MeshLambertMaterial() };
    // (none shrinking toward the reach's end: the turn alone)
    const pool = await poolOf('Birch_1', { puff, dissolve: 0 });
    expect(meshesAt(pool, 2).map((m) => m.geometry)).toEqual([puff.geometry]);
    const items = [...ring(6, 10, 100, 0), ...ring(6, 100, 100, 0), ...ring(6, 300, 100, 0)].map((it, i) => ({ ...it, yaw: it.yaw + 0.4, scale: 1 + (i % 3) * 0.25 }));
    pool.set('a', items);
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(100, 0, 0);
    pool.update(cam, 0);
    expect(pool.stats.levels).toEqual([6, 6, 6]);
    facing(pool, cam.position);
    // (the full and LOD1 levels: each item's own yaw and size, whatever the camera)
    for (const level of [0, 1])
      for (const list of columns(pool, level))
        list.forEach(({ z, y }, i) => {
          const { yaw, scale } = items[level * 6 + i];
          expect(z.x).toBeCloseTo(Math.sin(yaw) * scale, 5);
          expect(z.z).toBeCloseTo(Math.cos(yaw) * scale, 5);
          expect(y.y).toBeCloseTo(scale, 6);
        });
    // the camera goes round: the next sort turns them after it
    cam.position.set(-150, 0, 260);
    pool.update(cam, 0.5);
    facing(pool, cam.position);
    // a shift moves the items and the camera they face together
    pool.shift(-1000, 0);
    facing(pool, { x: cam.position.x - 1000, z: cam.position.z });
  });

  it('shrinks its items away over the last quarter of its reach, and draws the puff to a reach of its own', async () => {
    const pool = await poolOf('Birch_1');
    const size = (level) => columns(pool, level)[0].map(({ y }) => y.y);
    // (high's bands: 70, 220, the puff to 440; whole to 330, gone by 440)
    pool.set('a', [...ring(4, 10), ...ring(4, 300), ...ring(4, 385)]);
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([4, 0, 8]);
    expect(size(0).every((y) => Math.abs(y - 1) < 1e-6)).toBe(true);
    const far = size(2);
    expect(far.filter((y) => Math.abs(y - 1) < 1e-6)).toHaveLength(4);
    expect(far.filter((y) => y > 0.3 && y < 0.7)).toHaveLength(4);
    // (a wood's trees to the edge of what you can see: the puff out to 900 m)
    const wide = await poolOf('Birch_1', { reach: 900 });
    wide.set('a', [...ring(4, 10), ...ring(4, 600)]);
    wide.update(camAt(0, 0), 0);
    expect(wide.stats.levels).toEqual([4, 0, 4]);
    expect(columns(wide, 2)[0].every(({ y }) => Math.abs(y.y - 1) < 1e-6)).toBe(true);
    wide.setBands([30, 90]);
    wide.update(camAt(0, 0), 0);
    expect(wide.bands).toEqual([30, 90]);
    expect(wide.stats.levels).toEqual([4, 0, 4]);
    pool.dispose();
    wide.dispose();
  });

  it('keeps an item’s own turn at level 2 when the LOD1 stands in there', async () => {
    const pool = await poolOf();
    pool.set('a', ring(6, 300, 100, 0));
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(100, 0, 0);
    pool.update(cam, 0);
    const want = ring(6, 300, 100, 0);
    for (const list of columns(pool, 2)) list.forEach(({ z }, i) => expect(z.x).toBeCloseTo(Math.sin(want[i].yaw), 5));
  });

  it('makes its own puff for a model with tones (a kit’s puffs are on unless it says), one a model a kit; one without tones keeps its LOD1', async () => {
    const own = (await kitOf()).kit;
    const pool = createPool(own, 'Birch_1', { bands: HIGH, lod1: true, wait: 0.5 });
    await pool.ready;
    const [m, ...more] = meshesAt(pool, 2);
    expect(more).toHaveLength(0);
    expect(m.geometry.attributes.puffTrunk).toBeDefined();
    expect(m.material.customProgramCacheKey()).toContain('puff');
    expect(own.puff('Birch_1')).toEqual({ geometry: m.geometry, material: m.material });
    // (a second pool of the model draws the same one)
    const again = createPool(own, 'Birch_1', { bands: HIGH, lod1: true, wait: 0.5 });
    await again.ready;
    expect(meshesAt(again, 2)[0].geometry).toBe(m.geometry);
    expect(meshesAt(again, 2)[0].material).toBe(m.material);
    // (and it's drawn: the far ring at level 2)
    threeRings(pool);
    expect(m.count).toBe(10);
    // a model without tones: its LOD1 at level 2, as before
    const fern = createPool(own, 'Fern_1', { bands: HIGH, lod1: true, wait: 0.5 });
    await fern.ready;
    expect(meshesAt(fern, 2).map((f) => f.geometry)).toEqual((await own.lod1('Fern_1')).map((p) => p.geometry));
    expect(own.puff('Fern_1')).toBeNull();
    // the kit's to free: the pools gone leave it, the kit gone frees it
    const freed = vi.fn();
    m.geometry.addEventListener('dispose', freed);
    m.material.addEventListener('dispose', freed);
    pool.dispose();
    again.dispose();
    expect(freed).not.toHaveBeenCalled();
    own.dispose();
    expect(freed).toHaveBeenCalledTimes(2);
  });

  it('seeds each model’s puff by its name: two models of one size differ in silhouette, and a name’s puff is the same in every kit', async () => {
    const twin = { ...MANIFEST, models: { ...MANIFEST.models, Birch_1b: { ...MANIFEST.models.Birch_1 } } };
    const { kit: a } = await kitOf({ manifest: twin });
    const { kit: b } = await kitOf({ manifest: twin });
    const crown = (k, name) => Array.from(k.puff(name).geometry.attributes.position.array);
    expect(crown(a, 'Birch_1b')).toHaveLength(crown(a, 'Birch_1').length);
    expect(crown(a, 'Birch_1b')).not.toEqual(crown(a, 'Birch_1'));
    expect(crown(b, 'Birch_1')).toEqual(crown(a, 'Birch_1'));
    expect(crown(b, 'Birch_1b')).toEqual(crown(a, 'Birch_1b'));
    a.dispose();
    b.dispose();
  });

  it('makes no puff once disposed of: kit.puff answers null, as for a model without tones, and makes nothing to leak', async () => {
    const own = (await kitOf()).kit;
    const made = own.puff('Birch_1');
    expect(made).not.toBeNull();
    own.dispose();
    expect(own.puff('Birch_1')).toBeNull(); // (the one it freed isn't handed out again)
    expect(own.puff('Birch_2')).toBeNull(); // (nor a new one made, for no kit to free)
  });

  it('keeps the LOD1 at level 2 in a kit told `puffs: false`; a kit’s puff wears its house and its puffs’ wind, fitted to the manifest', async () => {
    const plain = await poolOf('Birch_1');
    expect(meshesAt(plain, 2)[0].geometry.attributes.puffTrunk).toBeUndefined();
    expect(kit.puff('Birch_1')).toBeNull();
    const house = createHouse();
    const wind = createWind();
    const dressed = (await kitOf({ house, puffWind: wind })).kit;
    const pool = createPool(dressed, 'Birch_1', { bands: HIGH, wait: 0.5 });
    await pool.ready;
    const [m] = meshesAt(pool, 2);
    expect(m.material.userData.house).toBe(house.uniforms);
    const sh = { uniforms: {}, vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag };
    m.material.onBeforeCompile(sh, null);
    expect(sh.uniforms.uWindNoise).toBe(wind.uniforms.uWindNoise);
    expect(sh.uniforms.uPuffA.value.toArray()).toEqual(MANIFEST.models.Birch_1.tones[0].map((v) => expect.closeTo(v, 6)));
    expect(sh.fragmentShader).toContain('if (vPuffTrunk < 0.5)');
    m.geometry.computeBoundingBox();
    expect(m.geometry.boundingBox.max.y).toBeCloseTo(MANIFEST.models.Birch_1.height, 2);
    expect(m.castShadow).toBe(false);
    wind.dispose();
  });

  it('keeps the full model in the LOD1 band where the level has no LOD1 (ultra)', async () => {
    const full = (await kit.model('Birch_1')).parts;
    const pool = await poolOf('Birch_1', { lod1: false });
    expect(meshesAt(pool, 1).map((m) => m.geometry)).toEqual(full.map((p) => p.geometry));
  });

  it('places an instance at the item’s place, turn and size, times the part’s own transform', async () => {
    const pool = await poolOf();
    pool.set('one', [{ x: 5, y: 1, z: -3, yaw: 0.7, scale: 2 }]);
    pool.update(camAt(0, 0), 0);
    const parts = (await kit.model('Birch_1')).parts;
    meshesAt(pool, 0).forEach((mesh, i) => {
      const want = new THREE.Matrix4().compose(new THREE.Vector3(5, 1, -3), new THREE.Quaternion().setFromAxisAngle(UP, 0.7), new THREE.Vector3(2, 2, 2)).multiply(parts[i].local);
      const got = new THREE.Matrix4();
      mesh.getMatrixAt(0, got);
      got.elements.forEach((v, k) => expect(v, `element ${k}`).toBeCloseTo(want.elements[k], 4));
    });
    // scale 1 when an item doesn't say (a birch's size is in its geometry; a
    // rock's, which doesn't bend, still in its part's local)
    pool.set('one', [{ x: 0, y: 0, z: 0, yaw: 0 }]);
    pool.update(camAt(0, 0), 0);
    const m = new THREE.Matrix4();
    meshesAt(pool, 0)[0].getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixScale(m).x).toBeCloseTo(1, 6);
    const rock = await poolOf('Rock_1');
    rock.set('one', [{ x: 0, y: 0, z: 0, yaw: 0 }]);
    rock.update(camAt(0, 0), 0);
    meshesAt(rock, 0)[0].getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixScale(m).x).toBeCloseTo(0.6, 6);
  });

  it('frees a key from every level in the same call', async () => {
    const pool = await poolOf();
    threeRings(pool);
    pool.free('b');
    expect(pool.stats.levels).toEqual([10, 0, 10]);
    expect(pool.stats.total).toBe(20);
    for (const m of meshesAt(pool, 1)) {
      expect(m.count).toBe(0);
      expect(m.visible).toBe(false); // (no empty draw)
    }
    // (what's left at the puff level is still the 300 m ring, packed from the front)
    for (const m of meshesAt(pool, 2)) {
      expect(m.count).toBe(10);
      for (let i = 0; i < 10; i++) expect(Math.abs(Math.hypot(where(m, i).x, where(m, i).z) - 300)).toBeLessThan(1);
    }
    // (and a key at the puff level: nothing left drawn there either)
    pool.free('c');
    expect(pool.stats.levels).toEqual([10, 0, 0]);
    for (const m of meshesAt(pool, 2)) expect(m.count).toBe(0);
    for (const m of meshesAt(pool, 0)) {
      expect(m.count).toBe(10);
      for (let i = 0; i < 10; i++) expect(Math.hypot(where(m, i).x, where(m, i).z)).toBeLessThan(11);
    }
  });

  it('frees a key at its own slots, every level at once: the level’s last instance moved into each, nothing else written and nothing sorted', async () => {
    const puff = { geometry: new THREE.BufferGeometry(), material: new THREE.MeshLambertMaterial() };
    const pool = await poolOf('Birch_1', { puff });
    const mix = [20, 120, 320].map((x) => ({ x, y: 0, z: 5, yaw: 0.3 }));
    pool.set('a', ring(10, 10));
    pool.set('b', ring(10, 100));
    pool.set('mix', mix); // (one at each level, behind the near rings and ahead of the far one)
    pool.set('c', ring(10, 300));
    const cam = camAt(0, 0);
    pool.update(cam, 0);
    expect(pool.stats.levels).toEqual([11, 11, 11]);
    const sorts = pool.stats.sorts;
    // (a mark in slots the free has no business with: a whole rewrite would clear it)
    const marked = [
      [meshesAt(pool, 0)[0], 0],
      [meshesAt(pool, 1)[1], 3],
      [meshesAt(pool, 2)[0], 5],
    ];
    for (const [m, i] of marked) m.instanceMatrix.array[i * 16 + 3] = 7;
    const [far] = meshesAt(pool, 2);
    const version = far.instanceMatrix.version;
    pool.free('mix');
    expect(far.instanceMatrix.version).toBeGreaterThan(version); // (its slot 0 written: sent again)
    expect(pool.stats).toMatchObject({ total: 30, levels: [10, 10, 10] });
    for (const [m, i] of marked) expect(m.instanceMatrix.array[i * 16 + 3]).toBe(7);
    for (const [m, i] of marked) m.instanceMatrix.array[i * 16 + 3] = 0;
    // every level packed from the front with exactly what's left, nothing of the key's
    const at = (l) => meshesAt(pool, l).map((m) => Array.from({ length: m.count }, (_, i) => where(m, i)));
    const rings = { 0: 10, 1: 100, 2: 300 };
    for (const l of [0, 1, 2])
      for (const list of at(l)) {
        expect(list).toHaveLength(10);
        for (const p of list) expect(Math.abs(Math.hypot(p.x, p.z) - rings[l])).toBeLessThan(1);
        expect(new Set(list.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`)).size).toBe(10);
      }
    // (the far one's stand-in, moved into the freed slot, still faces the camera)
    facing(pool, cam.position);
    // nothing to sort for it, at the next update or after
    pool.update(cam, 0);
    expect(pool.stats.sorts).toBe(sorts);
    pool.update(cam, 0.5);
    expect(pool.stats.levels).toEqual([10, 10, 10]);
  });

  it('leaves nothing of a key drawn that was set again and freed before the next sort', async () => {
    const pool = await poolOf();
    threeRings(pool);
    pool.set('b', ring(4, 300)); // (its old ten drawn at the LOD1 level till now)
    expect(pool.stats.levels).toEqual([10, 0, 10]);
    for (const m of meshesAt(pool, 1)) expect(m.count).toBe(0);
    pool.free('b');
    expect(pool.stats).toMatchObject({ total: 20, levels: [10, 0, 10] });
    for (const m of meshesAt(pool, 1)) expect(m.count).toBe(0);
    for (const m of meshesAt(pool, 2)) for (let i = 0; i < m.count; i++) expect(Math.abs(Math.hypot(where(m, i).x, where(m, i).z) - 300)).toBeLessThan(1);
    pool.update(camAt(0, 0), 0.5);
    expect(pool.stats.levels).toEqual([10, 0, 10]);
  });

  it('takes a key set to nothing out at once, as a free does', async () => {
    const pool = await poolOf();
    threeRings(pool);
    pool.set('b', []);
    expect(pool.stats).toMatchObject({ total: 20, levels: [10, 0, 10] });
    for (const m of meshesAt(pool, 1)) expect(m.count).toBe(0);
  });

  it('replaces a key’s items on set', async () => {
    const pool = await poolOf();
    pool.set('a', ring(10, 10));
    pool.set('a', ring(4, 100));
    pool.update(camAt(0, 0), 0);
    expect(pool.stats).toMatchObject({ total: 4, levels: [0, 4, 0] });
  });

  it('shifts every instance and the camera it sorted from by the same, so no item changes band', async () => {
    const pool = await poolOf();
    threeRings(pool);
    // (an item just inside the full band's edge, where a wrong distance would show)
    pool.set('edge', [{ x: 69, y: 0, z: 0, yaw: 0 }]);
    pool.update(camAt(0, 0), 0);
    const before = [0, 1, 2].map((l) => meshesAt(pool, l).map((m) => Array.from({ length: m.count }, (_, i) => where(m, i))));
    const levels = [...pool.stats.levels];
    pool.shift(-1000, 0);
    // moved at once, before any re-sort
    [0, 1, 2].forEach((l) =>
      meshesAt(pool, l).forEach((m, j) => {
        for (let i = 0; i < m.count; i++) {
          expect(where(m, i).x).toBeCloseTo(before[l][j][i].x - 1000, 2);
          expect(where(m, i).z).toBeCloseTo(before[l][j][i].z, 3);
        }
      }),
    );
    pool.update(camAt(-1000, 0), 0);
    expect(pool.stats.levels).toEqual(levels);
    [0, 1, 2].forEach((l) => meshesAt(pool, l).forEach((m, j) => expect(where(m, 0).x).toBeCloseTo(before[l][j][0].x - 1000, 2)));
    // a floating origin's whole cell
    pool.shift(50000, -50000);
    pool.update(camAt(49000, -50000), 0);
    expect(pool.stats.levels).toEqual(levels);
  });

  it('re-sorts every half second or 20 m of travel, not every frame', async () => {
    const pool = await poolOf();
    pool.set('a', [{ x: 75, y: 0, z: 0, yaw: 0 }]);
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([0, 1, 0]);
    pool.update(camAt(10, 0), 0.1); // 65 m now: full, once it looks
    expect(pool.stats.levels).toEqual([0, 1, 0]);
    pool.update(camAt(10, 0), 0.4); // half a second
    expect(pool.stats.levels).toEqual([1, 0, 0]);
    pool.update(camAt(-5, 0), 0); // 80 m: LOD1, but 15 m of travel isn't enough
    expect(pool.stats.levels).toEqual([1, 0, 0]);
    pool.update(camAt(-15, 0), 0); // 25 m from the last sort
    expect(pool.stats.levels).toEqual([0, 1, 0]);
  });

  it('re-bands nothing on a shift: the camera it sorted from moved with the items', async () => {
    const pool = await poolOf();
    pool.set('a', [{ x: 75, y: 0, z: 0, yaw: 0 }]);
    pool.update(camAt(0, 0), 0);
    pool.update(camAt(10, 0), 0.1); // (65 m now, but not looked at yet)
    expect(pool.stats.levels).toEqual([0, 1, 0]);
    const sorts = pool.stats.sorts;
    pool.shift(-1000, 0);
    pool.update(camAt(-990, 0), 0.1);
    expect(pool.stats.sorts).toBe(sorts);
    expect(pool.stats.levels).toEqual([0, 1, 0]);
    expect(where(meshesAt(pool, 1)[0], 0).x).toBeCloseTo(-925, 2);
    // (and the half second comes round as it would have)
    pool.update(camAt(-990, 0), 0.31);
    expect(pool.stats.sorts).toBe(sorts + 1);
    expect(pool.stats.levels).toEqual([1, 0, 0]);
  });

  it('starts each pool’s half second at a random point, so pools made together re-sort on different frames', async () => {
    // (three's ids draw on Math.random too: each pool made under its own value)
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const a = createPool(kit, 'Birch_1', { bands: HIGH });
    random.mockReturnValue(0.7);
    const b = createPool(kit, 'Birch_2', { bands: HIGH });
    const frames = { a: [], b: [] };
    for (let f = 0; f < 12; f++) {
      for (const [k, p] of Object.entries({ a, b })) {
        const before = p.stats.sorts;
        p.update(camAt(0, 0), 0.1);
        if (p.stats.sorts > before) frames[k].push(f);
      }
    }
    // (both at once on the first, as both are new; then a at 0.05 s in, b at 0.35 s, each every half second)
    expect(frames.a).toEqual([0, 5, 10]);
    expect(frames.b).toEqual([0, 3, 8]);
  });

  it('draws the full parts in the LOD1 and puff levels, and says so, when the LOD1 won’t load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plain = fakeLoad();
    const load = async (url) => {
      const got = await plain(url);
      got.scene.remove(got.scene.getObjectByName('Birch_1lod1'));
      return got;
    };
    ({ kit } = await kitOf({ load, puffs: false }));
    const pool = await poolOf();
    const full = (await kit.model('Birch_1')).parts;
    for (const l of [1, 2]) expect(meshesAt(pool, l).map((m) => m.geometry)).toEqual(full.map((p) => p.geometry));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/Birch_1's LOD1 won't load.*full parts stand in/);
    threeRings(pool);
    expect(pool.stats.levels).toEqual([10, 10, 10]);
    for (const m of pool.group.children) expect(m.count).toBe(10);
  });

  it('says once, naming the model, when its full model won’t load, and never that its full parts stand in', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manifest = { ...MANIFEST, models: { ...MANIFEST.models, Lost_1: { ...MANIFEST.models.Birch_1, file: 'lost.glb' } } };
    ({ kit } = await kitOf({ manifest }));
    const pool = createPool(kit, 'Lost_1', { bands: HIGH, lod1: true });
    await expect(pool.ready).rejects.toThrow(/lost\.glb/);
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/Lost_1/);
    expect(warn.mock.calls[0][0]).not.toMatch(/stand in/);
    // (and a pool disposed of before its parts came says nothing)
    const gone = createPool(kit, 'Lost_1', { bands: HIGH, lod1: true });
    gone.dispose();
    await expect(gone.ready).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('holds a band past its edge a little (hysteresis 0.1)', async () => {
    const pool = await poolOf();
    pool.set('a', [{ x: 69, y: 0, z: 0, yaw: 0 }]);
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([1, 0, 0]);
    pool.update(camAt(-3, 0), 1); // 72 m: inside 70 × 1.05
    expect(pool.stats.levels).toEqual([1, 0, 0]);
    pool.update(camAt(-5, 0), 1); // 74 m: out
    expect(pool.stats.levels).toEqual([0, 1, 0]);
  });

  it('takes new bands (a world stepping its quality down), its items sorted into them at the next update', async () => {
    const pool = await poolOf();
    expect(pool.bands).toEqual(HIGH);
    pool.set('a', [60, 200, 400].map((x) => ({ x, y: 0, z: 0, yaw: 0 })));
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([1, 1, 1]);
    const sorts = pool.stats.sorts;
    pool.setBands([52.5, 165]);
    expect(pool.bands).toEqual([52.5, 165]);
    expect(pool.stats.levels).toEqual([1, 1, 1]); // (till it next looks)
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.sorts).toBe(sorts + 1);
    // (60 m now its LOD1's, 200 the puff's, 400 past twice 165: nothing)
    expect(pool.stats.levels).toEqual([0, 1, 1]);
    expect(pool.stats.total).toBe(3);
  });

  it('draws nothing past twice the LOD1 band', async () => {
    const pool = await poolOf();
    pool.set('far', ring(5, 2 * HIGH[1] * 1.1));
    pool.update(camAt(0, 0), 0);
    expect(pool.stats).toMatchObject({ total: 5, levels: [0, 0, 0] });
    for (const m of pool.group.children) expect(m.count).toBe(0);
  });

  it('grows by half again when it overflows, keeping what it drew and sharing the geometry', async () => {
    const pool = await poolOf('Birch_1', { cap: 256 });
    pool.set('a', ring(10, 10));
    pool.update(camAt(0, 0), 0);
    const old = [...pool.group.children];
    const freed = vi.fn();
    for (const m of old) m.addEventListener('dispose', freed);
    const first = where(meshesAt(pool, 0)[0], 0);
    pool.set('b', ring(300, 100));
    expect(pool.group.children).toHaveLength(6);
    for (const m of pool.group.children) {
      expect(m.instanceMatrix.count).toBeGreaterThanOrEqual(384);
      expect(old).not.toContain(m);
    }
    expect(freed).toHaveBeenCalledTimes(6);
    expect(pool.group.children.map((m) => m.geometry)).toEqual(old.map((m) => m.geometry));
    // (still drawing what it drew till the next sort)
    expect(meshesAt(pool, 0)[0].count).toBe(10);
    expect(meshesAt(pool, 0)[0].visible).toBe(true);
    expect(where(meshesAt(pool, 0)[0], 0).distanceTo(first)).toBeLessThan(1e-4);
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([10, 300, 0]);
  });

  it('casts shadows from the full level only, and none when told; takes them at every level either way', async () => {
    const pool = await poolOf();
    for (const m of meshesAt(pool, 0)) expect(m.castShadow).toBe(true);
    for (const m of [...meshesAt(pool, 1), ...meshesAt(pool, 2)]) expect(m.castShadow).toBe(false);
    for (const m of pool.group.children) expect(m.receiveShadow).toBe(true);
    const quiet = await poolOf('Birch_1', { shadows: false });
    for (const m of quiet.group.children) expect(m.castShadow).toBe(false);
    // (ground cover casting none still lies in a tree's shade)
    for (const m of quiet.group.children) expect(m.receiveShadow).toBe(true);
  });

  it('writes matrices for the graphics chip to take each sort, and lets the bounds be found again', async () => {
    const pool = await poolOf();
    threeRings(pool);
    for (const m of pool.group.children) {
      expect(m.instanceMatrix.usage).toBe(THREE.DynamicDrawUsage);
      expect(m.boundingSphere).toBeNull();
    }
    const [m] = meshesAt(pool, 2);
    m.computeBoundingSphere();
    expect(m.boundingSphere.center.length()).toBeLessThan(300);
    expect(m.boundingSphere.radius).toBeGreaterThan(290);
  });

  it('takes items before its parts are in, and draws them when they come', async () => {
    const pool = createPool(kit, 'Birch_1', { bands: HIGH, lod1: true });
    pool.set('a', ring(10, 10));
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([10, 0, 0]);
    await pool.ready;
    for (const m of meshesAt(pool, 0)) expect(m.count).toBe(10);
  });

  it('defaults its bands and its LOD1 to the device level’s row', async () => {
    const row = budget(detailLevel());
    const pool = createPool(kit, 'Birch_1');
    await pool.ready;
    pool.set('a', [
      { x: row.near * 0.9, y: 0, z: 0, yaw: 0 },
      { x: row.near * 1.1, y: 0, z: 0, yaw: 0 },
      { x: row.mid * 1.1, y: 0, z: 0, yaw: 0 },
    ]);
    pool.update(camAt(0, 0), 0);
    expect(pool.stats.levels).toEqual([1, 1, 1]);
    const want = row.lod1 ? await kit.lod1('Birch_1') : (await kit.model('Birch_1')).parts;
    expect(meshesAt(pool, 1).map((m) => m.geometry)).toEqual(want.map((p) => p.geometry));
  });

  it('refuses a rig, a name the kit hasn’t, and a kit whose manifest isn’t in', () => {
    expect(() => createPool(kit, 'Critter')).toThrow(/rig/);
    expect(() => createPool(kit, 'Oak_9')).toThrow(/Oak_9/);
    const pending = loadKit('naturemega', { load: fakeLoad(), manifest: new Promise(() => {}) });
    expect(() => createPool(pending, 'Birch_1')).toThrow(/manifest/);
  });

  it('is taken out and frees only its instance buffers when disposed of', async () => {
    const pool = await poolOf();
    const parent = new THREE.Group();
    parent.add(pool.group);
    const meshes = [...pool.group.children];
    const freed = vi.fn();
    const shared = vi.fn();
    for (const m of meshes) {
      m.addEventListener('dispose', freed);
      m.geometry.addEventListener('dispose', shared);
      m.material.addEventListener('dispose', shared);
    }
    pool.dispose();
    expect(pool.group.parent).toBeNull();
    expect(freed).toHaveBeenCalledTimes(6);
    expect(shared).not.toHaveBeenCalled();
  });
});
