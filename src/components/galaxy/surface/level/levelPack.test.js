import { describe, expect, it } from 'vitest';
import { writeInstances } from '../../../../lib/level/instances';
import { assetUrl } from '../../../../lib/assetBase';
import { bandOf, cutFor, packUrl, readInstances, splitTextures, tierTexture, wanted } from './levelPack';

const S = Math.SQRT1_2;

describe('the pack, read', () => {
  it('reads three known transforms back: a sign slip would turn every tree', () => {
    const bin = writeInstances({ count: 3, position: new Float32Array([0, 0, 0, 5, 1, -5, 9, 0, 9]), quaternion: new Float32Array([0, 0, 0, 1, 0, S, 0, S, 0, 0, -S, S]), scale: new Float32Array([1, 1, 1, 1, 1, 1, -1, 1, 1]) });
    const i = readInstances(bin);
    expect(i.quaternion[5]).toBeCloseTo(S, 4);
    expect(i.quaternion[10]).toBeCloseTo(-S, 4);
    expect(i.scale[6]).toBe(-1);
  });

  it('wanted at the origin on high: 3 × 3 near, the ring to mid, the far list', () => {
    const cells = {};
    for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) cells[`${x},${z}`] = {};
    const w = wanted({ cell: 128, cells }, [1, 1], 'high');
    expect(w.near.length).toBe(9);
    expect(w.mid.length).toBe(16);
    expect(w.farList).toBe(true);
    expect(bandOf(w, '0,0')).toBe('near');
    expect(bandOf(w, '2,2')).toBe('mid');
    expect(bandOf(w, '3,3')).toBe(null);
  });

  it('on low the near set is lod1', () => {
    expect(cutFor('near', 'low')).toBe('lod1');
  });

  it('names its files under the world’s folder, and the tier’s texture', () => {
    expect(packUrl('hoth', 'cells/0_0.bin')).toBe('/models/galaxy/bf2017/levels/hoth/cells/0_0.bin');
    expect(tierTexture('../tex/t_snow_cs.ktx2', 'low')).toBe('../tex/t_snow_cs.512.ktx2');
    expect(tierTexture('../tex/t_snow_cs.ktx2', 'ultra')).toBe('../tex/t_snow_cs.2048.ktx2');
    // the pack's own size for the map, ultra as high where it has no ultra
    const sizes = { t_snow_cs: { low: 128, mid: 256, high: 256 } };
    expect(tierTexture('tex/t_snow_cs.ktx2', 'low', sizes)).toBe('tex/t_snow_cs.128.ktx2');
    expect(tierTexture('tex/t_snow_cs.ktx2', 'ultra', sizes)).toBe('tex/t_snow_cs.256.ktx2');
  });

  it('takes a GLB’s textures out and says which material wanted which map where', () => {
    const doc = {
      asset: { version: '2.0' },
      extensionsUsed: ['KHR_texture_basisu', 'KHR_materials_emissive_strength'],
      extensionsRequired: ['KHR_texture_basisu'],
      images: [{ uri: '../tex/a_cs.ktx2' }, { uri: '../tex/a__normal.ktx2' }],
      textures: [{ extensions: { KHR_texture_basisu: { source: 0 } } }, { source: 1 }],
      materials: [{ name: 'm', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, roughnessFactor: 0.5 }, normalTexture: { index: 1 } }],
    };
    const json = new TextEncoder().encode(JSON.stringify(doc) + ' ');
    const bin = new Uint8Array([1, 2, 3, 4]);
    const glb = new Uint8Array(20 + json.length + 8 + bin.length);
    const v = new DataView(glb.buffer);
    glb.set([0x67, 0x6c, 0x54, 0x46]);
    v.setUint32(4, 2, true);
    v.setUint32(8, glb.length, true);
    v.setUint32(12, json.length, true);
    v.setUint32(16, 0x4e4f534a, true);
    glb.set(json, 20);
    v.setUint32(20 + json.length, 4, true);
    v.setUint32(24 + json.length, 0x004e4942, true);
    glb.set(bin, 28 + json.length);
    const { buffer, slots } = splitTextures(glb.buffer);
    expect(slots).toEqual([
      { material: 0, slot: 'map', uri: '../tex/a_cs.ktx2' },
      { material: 0, slot: 'normalMap', uri: '../tex/a__normal.ktx2' },
    ]);
    const out = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    const len = dv.getUint32(12, true);
    const j = JSON.parse(new TextDecoder().decode(out.subarray(20, 20 + len)));
    expect(j.images).toBeUndefined();
    expect(j.materials[0]).toEqual({ name: 'm', pbrMetallicRoughness: { roughnessFactor: 0.5 } });
    expect(j.extensionsRequired).toEqual([]);
    expect(j.extensionsUsed).toEqual(['KHR_materials_emissive_strength']);
    expect(dv.getUint32(8, true)).toBe(out.length);
    expect(len % 4).toBe(0);
    expect(Array.from(out.subarray(out.length - 4))).toEqual([1, 2, 3, 4]);
  });
  it('finds a published pack file through the manifest, and the site’s path without a row', () => {
    const manifest = { 'models/galaxy/bf2017/levels/hoth/cells/0_0.bin': { hash: 'abcdef123456', bytes: 1 } };
    const base = 'https://x.supabase.co/storage/v1/object/public/site-assets';
    expect(assetUrl(packUrl('hoth', 'cells/0_0.bin'), { base, manifest })).toBe(`${base}/abcdef123456/models/galaxy/bf2017/levels/hoth/cells/0_0.bin`);
    expect(assetUrl(packUrl('hoth', 'cells/1_0.bin'), { base, manifest })).toBe('/models/galaxy/bf2017/levels/hoth/cells/1_0.bin');
    // (a district's pack sits in its world's folder)
    expect(packUrl('hoth/base', 'level.json')).toBe('/models/galaxy/bf2017/levels/hoth/base/level.json');
  });
});
