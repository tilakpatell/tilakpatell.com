import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { imageLayerFrom } from '../../../lib/land/layers.js';
import { mapsFor } from '../../../lib/three/ground/snow.js';
import { SNOW_FILES, SNOW_KIND } from '../../../lib/three/ground/snowMaps.js';
import { FAR_DROP, LAND_QUIET, LAND_UNDER, NEAR_STEP, PATCH_M, PATCH_MOVE, PATCH_UNDER, buildGround, canAsk, maskFrames, nearStep, needsPatch, patchOrigin } from './ground.js';

// (the transcoder is the browser's: here a map's bytes parse to a bare texture)
vi.mock('../../../lib/three/gltf.js', () => ({
  ktx2Loader: async () => ({ parse: (buf, res) => res(new THREE.Texture()) }),
}));

// a flat 9 × 9 field at 10 m, 1 m a pixel, and a far map of the same at 4 m
const flat = (w, mpp) => ({ data: new Uint16Array(w * w).fill(10 * 64), w, h: w, minX: -((w - 1) * mpp) / 2, minZ: -((w - 1) * mpp) / 2, metresPerPixel: mpp });
const layer = imageLayerFrom({ heightScale: 1024, heightOffset: 0, holePixels: 0 }, flat(9, 1), flat(9, 4));
const terrain = { near: { min: [-4, -4], size: [9, 9], metresPerPixel: 1 }, far: { min: [-16, -16], size: [9, 9], metresPerPixel: 4 } };
const renderer = { isWebGPURenderer: true, getMaxAnisotropy: () => 16 };
// the pack's rows as the import writes them
const rows = {
  ...Object.fromEntries(Object.entries(SNOW_FILES).map(([slug, m]) => [slug, { ...m.sizes, srgb: Boolean(m.srgb) }])),
  masks_near: { mid: 352, high: 704, ultra: 1408, srgb: false },
  masks_far: { mid: 160, high: 320, ultra: 640, srgb: false },
};
// level.json's terrain.masks as the masks script writes it (two of the three frames)
const masks = {
  layers: [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
  ],
  frames: {
    near: { tex: 'terrain/masks_near.ktx2', corner: [-397, -380], metresPerPixel: 0.5, size: [1408, 2304] },
    far: { tex: 'terrain/masks_far.ktx2', corner: [-1229, -1020], metresPerPixel: 4, size: [640, 640] },
  },
};
const origin = [205, 362.296875, -1540];
// a site that has the files whose path passes `has`, and a 404 for the rest
const site = (has) => {
  const asked = [];
  vi.stubGlobal('fetch', async (url) => {
    asked.push(String(url));
    return has(String(url)) ? { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) } : { ok: false, status: 404 };
  });
  return asked;
};

afterEach(() => vi.unstubAllGlobals());

describe('the patch maths', () => {
  it('snaps the patch’s corner to the move step, the patch centred on the player', () => {
    expect(patchOrigin([0, 0])).toEqual([-PATCH_M / 2, -PATCH_M / 2]);
    expect(patchOrigin([PATCH_MOVE * 2 + 1, -PATCH_MOVE])).toEqual([PATCH_MOVE * 2 - PATCH_M / 2, -PATCH_MOVE - PATCH_M / 2]);
  });
  it('builds the patch once, then again only past the move', () => {
    expect(needsPatch([0, 0], null)).toBe(true);
    expect(needsPatch([PATCH_MOVE - 1, 0], [0, 0])).toBe(false);
    expect(needsPatch([PATCH_MOVE, 0], [0, 0])).toBe(true);
  });
});

describe('what may be asked for', () => {
  const url = '/models/galaxy/bf2017/levels/hoth/tex/t_arcticbase_snow_02_n.2048.ktx2';
  const row = { ultra: 2048 };
  it('nothing the pack does not list', () => {
    expect(canAsk(url, undefined, { dev: true })).toBe(false);
  });
  it('on the published site only what the manifest names (the bucket’s copy is the only one)', () => {
    expect(canAsk(url, row, { dev: false, remote: (u) => u })).toBe(false);
    expect(canAsk(url, row, { dev: false, remote: (u) => `https://bucket/abc${u}` })).toBe(true);
  });
  it('a development checkout’s own copy', () => {
    expect(canAsk(url, row, { dev: true, remote: (u) => u })).toBe(true);
  });
});

describe('the mask frames', () => {
  it('lays each frame in the game’s frame, finest first; low reads none', () => {
    expect(maskFrames(masks, origin, 'ultra')).toEqual([
      { name: 'near', tex: 'terrain/masks_near.ktx2', corner: [-192, -1920], extent: [704, 1152] },
      { name: 'far', tex: 'terrain/masks_far.ktx2', corner: [-1024, -2560], extent: [2560, 2560] },
    ]);
    expect(maskFrames(masks, origin, 'low')).toEqual([]);
    expect(maskFrames(undefined, origin, 'ultra')).toEqual([]);
  });
});

describe('the grids', () => {
  it('draws the near and far grids on the classic renderer in the flat colour, the far one lower', () => {
    const g = buildGround(layer, terrain);
    const near = g.getObjectByName('ground:near');
    const far = g.getObjectByName('ground:far');
    expect(near.material.isMeshStandardMaterial).toBe(true);
    expect(near.geometry.attributes.position.getY(0)).toBeCloseTo(10, 4);
    expect(far.geometry.attributes.position.getY(0)).toBeCloseTo(10 - FAR_DROP, 4);
    expect(g.getObjectByName('ground:patch')).toBeFalsy();
    g.update([0, 0]);
    expect(g.getObjectByName('ground:patch')).toBeFalsy();
    g.dispose();
  });
  it('on ultra on the node renderer the 4 m grid drops under the 1 m patch, built round the player as they walk', async () => {
    const asked = site(() => false);
    const g = buildGround(layer, terrain, { world: 'hoth', pack: { tex: {} }, tier: 'ultra', renderer });
    const near = g.getObjectByName('ground:near');
    expect(near.geometry.attributes.position.getY(0)).toBeCloseTo(10 - PATCH_UNDER, 4);
    g.update([0, 0]);
    const patch = g.getObjectByName('ground:patch');
    expect(patch).toBeTruthy();
    expect(patch.geometry.attributes.position.count).toBe((PATCH_M + 1) ** 2);
    const first = patch.geometry;
    g.update([10, 0]);
    expect(patch.geometry).toBe(first);
    g.update([PATCH_MOVE, 0]);
    expect(patch.geometry).not.toBe(first);
    // (the pack lists no snow maps: none is asked for, the flat colour stays)
    await expect(g.ready).resolves.toBeNull();
    expect(asked).toEqual([]);
    g.dispose();
  });
});

describe('the snow’s landing', () => {
  it('a pack that lists the maps and a site without them: every miss quiet, the flat colour kept', async () => {
    const asked = site(() => false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const g = buildGround(layer, terrain, { world: 'hoth', pack: { tex: rows, terrain: { masks }, origin }, tier: 'ultra', renderer });
    g.update([0, 0]);
    await expect(g.ready).resolves.toBeNull();
    // (each file asked for, of the bucket first where the manifest names it, then of the site: the maps and the two mask frames)
    expect(new Set(asked.map((u) => u.split('/').pop())).size).toBe(mapsFor('ultra').length + 2);
    expect(warn).not.toHaveBeenCalled();
    for (const name of ['near', 'far', 'patch']) {
      expect(g.getObjectByName(`ground:${name}`).material.isNodeMaterial, name).toBeFalsy();
      expect(g.getObjectByName(`ground:${name}:flat`), name).toBeFalsy();
    }
    warn.mockRestore();
    g.dispose();
  });
  it('the flow map alone there (the bucket before the arrays): no snow without the normals', async () => {
    site((url) => url.includes(SNOW_KIND.flow));
    const g = buildGround(layer, terrain, { world: 'hoth', pack: { tex: rows }, tier: 'high', renderer });
    await expect(g.ready).resolves.toBeNull();
    expect(g.getObjectByName('ground:near').material.isNodeMaterial).toBeFalsy();
    g.dispose();
  });
  it('the maps there: the snow is laid over the flat ground, which goes once nothing has been building', async () => {
    const asked = site(() => true);
    const g = buildGround(layer, terrain, { world: 'hoth', pack: { tex: rows, terrain: { masks }, origin }, tier: 'ultra', renderer });
    g.update([0, 0]);
    const built = await g.ready;
    expect(built.near.flat).toBe(false);
    expect(built.near.samples.mask).toBe(4);
    expect(asked.some((u) => u.endsWith(`tex/${SNOW_KIND.normals}.2048.ktx2`))).toBe(true);
    expect(asked.some((u) => u.endsWith('terrain/masks_near.1408.ktx2'))).toBe(true);
    for (const name of ['near', 'far', 'patch']) {
      const snow = g.getObjectByName(`ground:${name}`);
      const was = g.getObjectByName(`ground:${name}:flat`);
      expect(snow.material.isNodeMaterial, name).toBe(true);
      expect(was.material.isNodeMaterial, name).toBeFalsy();
      expect(was.geometry, name).toBe(snow.geometry);
      expect(was.position.y, name).toBe(-LAND_UNDER);
      expect(snow.position.y, name).toBe(0);
    }
    expect(g.getObjectByName('ground:patch').material).toBe(built.patch.material);
    expect(g.getObjectByName('ground:far').material).toBe(built.far.material);
    for (let i = 0; i < LAND_QUIET - 1; i++) g.update([0, 0]);
    expect(g.getObjectByName('ground:near:flat')).toBeTruthy();
    g.update([0, 0]);
    for (const name of ['near', 'far', 'patch']) expect(g.getObjectByName(`ground:${name}:flat`), name).toBeFalsy();
    // (a walk past the move builds the patch again, in the snow)
    const first = g.getObjectByName('ground:patch').geometry;
    g.update([PATCH_MOVE, 0]);
    expect(g.getObjectByName('ground:patch').geometry).not.toBe(first);
    expect(g.getObjectByName('ground:patch').material).toBe(built.patch.material);
    g.dispose();
  });
  it('a patch first built after the snow is down comes in wearing it', async () => {
    site(() => true);
    const g = buildGround(layer, terrain, { world: 'hoth', pack: { tex: rows }, tier: 'ultra', renderer });
    const built = await g.ready;
    g.update([0, 0]);
    expect(g.getObjectByName('ground:patch').material).toBe(built.patch.material);
    expect(g.getObjectByName('ground:patch:flat')).toBeFalsy();
    g.dispose();
  });
  it('holds the flat ground while the pipeline guard still has something building', async () => {
    site(() => true);
    let pending = 1;
    const guarded = { ...renderer, _pipelines: { __guard: { pending: () => pending, held: () => 0 } } };
    const g = buildGround(layer, terrain, { world: 'hoth', pack: { tex: rows }, tier: 'high', renderer: guarded });
    await g.ready;
    for (let i = 0; i < LAND_QUIET * 2; i++) g.update([0, 0]);
    expect(g.getObjectByName('ground:near:flat')).toBeTruthy();
    pending = 0;
    for (let i = 0; i < LAND_QUIET; i++) g.update([0, 0]);
    expect(g.getObjectByName('ground:near:flat')).toBeFalsy();
    g.dispose();
  });
});

// (Low is the floor: the near grid at 8 m, a quarter of the 4 m grid's
// 0.82 M triangles over Hoth's near map, the most of Low's frame)
describe('the near grid’s spacing by tier', () => {
  it('is 8 m at Low and 4 m above it', () => {
    expect(NEAR_STEP).toBe(4);
    expect(nearStep('low')).toBe(8);
    for (const t of ['mid', 'high', 'ultra']) expect(nearStep(t)).toBe(4);
  });
});
