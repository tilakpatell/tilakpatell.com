import { describe, expect, it } from 'vitest';
import { imageLayerFrom } from '../../../lib/land/layers.js';
import { FAR_DROP, PATCH_M, PATCH_MOVE, PATCH_UNDER, buildGround, needsPatch, patchOrigin } from './ground.js';

// a flat 9 × 9 field at 10 m, 1 m a pixel, and a far map of the same at 4 m
const flat = (w, mpp) => ({ data: new Uint16Array(w * w).fill(10 * 64), w, h: w, minX: -((w - 1) * mpp) / 2, minZ: -((w - 1) * mpp) / 2, metresPerPixel: mpp });
const layer = imageLayerFrom({ heightScale: 1024, heightOffset: 0, holePixels: 0 }, flat(9, 1), flat(9, 4));
const terrain = { near: { min: [-4, -4], size: [9, 9], metresPerPixel: 1 }, far: { min: [-16, -16], size: [9, 9], metresPerPixel: 4 } };

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
    const renderer = { isWebGPURenderer: true, getMaxAnisotropy: () => 16 };
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
    // (no bucket here: the snow does not land, nothing thrown, the flat colour stays)
    await expect(g.ready).resolves.toBeNull();
    g.dispose();
  });
});
