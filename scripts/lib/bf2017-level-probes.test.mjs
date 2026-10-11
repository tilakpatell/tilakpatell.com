import { describe, expect, it } from 'vitest';
import { probesJson } from './bf2017-level-probes.mjs';

// Endor_01's Foggy_Lighting and Sunny_Lighting2 layers, cut to their boxes and the far shadow
const box = (guid, layer, trans, right = [10, 0, 0]) => ({
  $type: 'PbrBoxReflectionVolumeEntityData',
  $guid: guid,
  BakedTexture: { $asset: `Levels/MP/Endor_01/ReflectionVolumeTexture/${layer}/${guid}-Tex` },
  LocalOffset: { x: 0, y: -28.6, z: 0 },
  Enabled: true,
  Transform: { right: { x: right[0], y: right[1], z: right[2] }, up: { x: 0, y: 4, z: 0 }, forward: { x: 0, y: 0, z: 20 }, trans: { x: trans[0], y: trans[1], z: trans[2] } },
});
const layers = [
  { name: 'Levels/MP/Endor_01/Foggy_Lighting', objects: [box('94b0bf9c-5d2d-4556-990f-28ae16f39ba2', 'Foggy_Lighting', [544.09, 231.6, 767])] },
  {
    name: 'Levels/MP/Endor_01/Sunny_Lighting2',
    objects: [
      box('3a000000-0000-0000-0000-000000000001', 'Sunny_Lighting2', [520, 230, 110]),
      { ...box('3a000000-0000-0000-0000-000000000002', 'Sunny_Lighting2', [0, 0, 0]), Enabled: false },
      {
        $type: 'DistantShadowCacheVolumeEntityData',
        BakedTexture: { $asset: 'Levels/MP/Endor_01/DistantShadowCacheTexture/Sunny_Lighting2/3cdba8ad-7de1-4da7-835d-ff69b264f1a6-Tex' },
        Resolution: 6400,
        TilesPerSide: 8,
        Transform: { right: { x: 426.2, y: 0, z: 54.5 }, up: { x: 0, y: 95.7, z: 0 }, forward: { x: -127.1, y: 0, z: 993.7 }, trans: { x: 505.25, y: 215.95, z: 505.69 } },
      },
    ],
  },
];
const textures = new Map([
  ['levels/mp/endor_01/reflectionvolumetexture/sunny_lighting2/3a000000-0000-0000-0000-000000000001-tex', { files: ['a_px.hdr', 'a_nx.hdr', 'a_py.hdr', 'a_ny.hdr', 'a_pz.hdr', 'a_nz.hdr'], width: 128 }],
  ['levels/mp/endor_01/distantshadowcachetexture/sunny_lighting2/3cdba8ad-7de1-4da7-835d-ff69b264f1a6-tex', { file: 'textures/x/far.png', width: 1600, height: 1600 }],
]);
const pack = { origin: [500, 230, 100], yaw: 0 };

describe('a level’s probes and its far shadow', () => {
  it('takes the day’s reflection boxes, in the pack’s frame, with their faces in the bucket', () => {
    const j = probesJson(layers, pack, { textures, weather: 'sunny' });
    expect(j.probes).toEqual([{ id: '3a000000', variant: 'Sunny_Lighting2', centre: [20, 0, 10], axes: [[10, 0, 0], [0, 4, 0], [0, 0, 20]], faces: 'probes/3a000000', from: ['a_px.hdr', 'a_nx.hdr', 'a_py.hdr', 'a_ny.hdr', 'a_pz.hdr', 'a_nz.hdr'] }]);
    // (another weather's, a switched-off one and one with no faces in the bucket are not)
    expect(j.skipped).toEqual({ 'another weather': 1, 'switched off': 1 });
  });

  it('names the far shadow cache and its frame for lane S', () => {
    const j = probesJson(layers, pack, { textures, weather: 'sunny' });
    expect(j.shadowCache).toEqual({ png: 'shadow/far.png', from: 'textures/x/far.png', size: [1600, 1600], resolution: 6400, tiles: 8, centre: [5.25, -14.05, 405.69], right: [426.2, 0, 54.5], up: [0, 95.7, 0], forward: [-127.1, 0, 993.7], variant: 'Sunny_Lighting2' });
  });

  it('falls back to every outdoor layer where none is named for the weather', () => {
    const j = probesJson(layers, pack, { textures, weather: 'dusk' });
    expect(j.probes.map((p) => p.id)).toEqual(['3a000000']);
    expect(j.skipped).toEqual({ 'another weather': 1, 'switched off': 1 });
  });

  it('takes the light record’s own variant where it names one', () => {
    const j = probesJson(layers, pack, { textures, weather: 'sunny', variant: 'Foggy_Lighting' });
    expect(j.skipped).toEqual({ 'another weather': 2, 'not in the bucket': 1 });
  });
});
