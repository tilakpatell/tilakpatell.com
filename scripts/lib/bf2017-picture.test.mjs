import { describe, expect, it } from 'vitest';
import { entryOf, hdrOf, pictureFields, picturedNames, recordOf, rowMean } from './bf2017-picture.mjs';
import { pictureOf, withPicture } from '../../src/lib/three/light/grade.js';
import { readEntry } from '../../src/lib/three/light/entry.js';
import { halveLut, lutStrip } from './bf2017-light.mjs';
import { cubeFromStrip } from '../../src/lib/three/gameLut.js';

// the game's 33³ identity grade as the export stores it: a slice a blue,
// its rows green from the top down, red along a row (bf2017-light.mjs)
const identity = (n) =>
  Array.from({ length: n }, (_, b) => {
    const s = new Uint16Array(n * n * 3);
    for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) s.set([r, g, b].map((v) => Math.round((v * 255) / (n - 1))), ((n - 1 - g) * n + r) * 3);
    return s;
  });
// the strip (RGB) as the browser reads it (RGBA), into the cube loadLut makes
const cube = (strip, n) => cubeFromStrip(Uint8Array.from({ length: n * n * n * 4 }, (_, i) => (i % 4 === 3 ? 255 : strip[(i >> 2) * 3 + (i % 4)])), n);
const at = (c, n, [r, g, b]) => Array.from(c.slice(((b * n + g) * n + r) * 4, ((b * n + g) * n + r) * 4 + 3));

describe('bf2017-picture', () => {
  it('reads a VE record by component, the later record winning field by field', () => {
    const day = { objects: [{ $type: 'SkyComponentData', PanoramicTexture: { $asset: 'Sky/Day' }, PanoramicRotation: 0.5 }, { $type: 'VisualEnvironmentBlueprint' }] };
    const dusk = { objects: [{ $type: 'SkyComponentData', PanoramicTexture: { $asset: 'Sky/Dusk' } }, { $type: 'OutdoorLightComponentData', CloudShadowTexture: { $asset: 'Clouds/C_RGBM' } }] };
    const r = recordOf(day, dusk);
    expect(Object.keys(r).sort()).toEqual(['OutdoorLightComponentData', 'SkyComponentData']);
    expect(r.SkyComponentData[0].PanoramicRotation).toBe(0.5);
    expect(picturedNames(r)).toEqual({ panorama: 'Sky/Dusk', gradient: null, cloudShadow: 'Clouds/C_RGBM' });
    expect(picturedNames(recordOf(null))).toEqual({ panorama: null, gradient: null, cloudShadow: null });
  });
  it('lays a later record over only the fields its PropertyOverrides name, as the game does', () => {
    const day = { objects: [{ $type: 'ColorCorrectionComponentData', HdrColorGradingLut: { $asset: 'Day/CC' }, Enable: true, ColorGradingEnable: true }] };
    // (an interior that sets nothing of the grade: its nulls are defaults, not overrides)
    const cave = { objects: [{ $type: 'ColorCorrectionComponentData', HdrColorGradingLut: null, Enable: false, ColorGradingEnable: false, PropertyOverrides: [] }] };
    expect(recordOf(day, cave).ColorCorrectionComponentData[0]).toMatchObject({ HdrColorGradingLut: { $asset: 'Day/CC' }, Enable: true });
    const room = { objects: [{ $type: 'ColorCorrectionComponentData', HdrColorGradingLut: { $asset: 'Room/CC' }, Enable: false, PropertyOverrides: ['HdrColorGradingLut'] }] };
    expect(recordOf(day, room).ColorCorrectionComponentData[0]).toMatchObject({ HdrColorGradingLut: { $asset: 'Room/CC' }, Enable: true });
  });
  it('keeps the game’s LUT at 33³, its middle read where the record puts it', () => {
    // (ColorGradingMaxHdrValue 1: the LUT's input 0…1 after the linear tonemap,
    // so 0.5 is the middle point, 16 of 33's and 8 of the 17³'s)
    const slices = identity(33);
    const full = cube(lutStrip(slices, 33), 33);
    expect(at(full, 33, [16, 16, 16])).toEqual([128, 128, 128]);
    expect(at(full, 33, [32, 0, 16])).toEqual([255, 0, 128]);
    expect(at(full, 33, [1, 2, 3])).toEqual([8, 16, 24]);
    const half = cube(halveLut(slices, 33), 17);
    expect(at(half, 17, [8, 8, 8])).toEqual([128, 128, 128]);
    // (the 17³ holds every other point: an odd one of the 33³ is between two of it)
    expect(at(half, 17, [0, 1, 1])).toEqual(at(full, 33, [0, 2, 2]));
  });
  it('makes a weather’s records the light stack’s entry, as the fixture’s Hoth has it', () => {
    const day = {
      objects: [
        { $type: 'TonemapComponentData', BloomScale: { x: 0.1, y: 0.1, z: 0.1 } },
        { $type: 'FogComponentData', Curve: { x: 2, y: -4, z: 3, w: -0.01 }, FogColor: { x: 0.5, y: 0.6, z: 0.7 } },
        { $type: 'ColorCorrectionComponentData', HdrColorGradingLut: { $asset: 'Day/CC', $assetType: 'GradingLutAsset' } },
      ],
    };
    const e = entryOf('VE_Day', day);
    expect(e.name).toBe('VE_Day');
    expect(e.record.TonemapComponentData[0].BloomScale).toEqual([0.1, 0.1, 0.1]);
    expect(e.record.FogComponentData[0].Curve).toEqual([2, -4, 3, -0.01]);
    expect(e.record.ColorCorrectionComponentData[0].HdrColorGradingLut).toBe('Day/CC');
    const p = readEntry(e);
    expect(p.fog.curve).toEqual([2, -4, 3, -0.01]);
    // (the record's BloomScale as a ratio to Hoth's day, 0.1)
    expect(p.bloom.scale).toBeCloseTo(1, 6);
    expect(p.grade.lutName).toBe('Day/CC');
  });
  it('keeps the record’s picture fields, by name, for an entry that lacks them', () => {
    const day = {
      objects: [
        { $type: 'TonemapComponentData', TonemapMethod: 'TonemapMethod_Linear', BloomScale: { x: 0.1, y: 0.1, z: 0.1 } },
        { $type: 'SkyComponentData', PanoramicTexture: { $asset: 'Sky/Day' }, SkyGradientTexture: { $asset: 'Sky/Day_Fog' }, PanoramicRotation: 0.5, LuminanceScale: 35000 },
        { $type: 'OutdoorLightComponentData', CloudShadowTexture: { $asset: 'Clouds/C_RGBM' }, CloudXZTranslation: { x: 10, y: 20 }, SunRotationX: 30 },
      ],
    };
    const f = pictureFields(recordOf(day));
    expect(f).toEqual({
      TonemapComponentData: { TonemapMethod: 'TonemapMethod_Linear' },
      SkyComponentData: { PanoramicTexture: 'Sky/Day', SkyGradientTexture: 'Sky/Day_Fog', PanoramicRotation: 0.5 },
      OutdoorLightComponentData: { CloudShadowTexture: 'Clouds/C_RGBM', CloudXZTranslation: { x: 10, y: 20 } },
    });
    // (over an entry with none of them, the panorama and the clouds are found)
    const { entry, picture } = withPicture({ name: 'VE', record: {} }, { panorama: { url: 'p.ktx2', horizon: [0.5, 0.5, 0.5] }, cloudShadow: { url: 'c.ktx2' }, record: f });
    const pic = pictureOf(entry, picture);
    expect(pic.panorama).toMatchObject({ name: 'Sky/Day', rotation: 0.5 });
    expect(pic.cloudShadow).toMatchObject({ name: 'Clouds/C_RGBM', offset: [10, 20] });
  });
  it('measures a row’s mean colour', () => {
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255, 51, 51, 51, 255, 51, 51, 51, 255]);
    expect(rowMean(rgba, 2, 0)).toEqual([0.5, 0, 0.5]);
    expect(rowMean(rgba, 2, 1)).toEqual([0.2, 0.2, 0.2]);
  });
  it('names lane W’s HDR copy of a sky only when the desktop has made it', () => {
    const made = new Set(['textures/galaxy/bf2017/hdr/t_hoth_sunny_02_c.4096.ktx2', 'textures/galaxy/bf2017/hdr/t_hoth_sunny_02_c.2048.ktx2']);
    expect(hdrOf('Levels/Lighting/Hoth/Sunny_01/T_Hoth_Sunny_02_C', (p) => made.has(p))).toEqual({ url: 'textures/galaxy/bf2017/hdr/t_hoth_sunny_02_c', widths: [4096, 2048], format: 'rgba16f' });
    expect(hdrOf('Levels/Lighting/Hoth/Sunset_01/T_Hoth_Sunset_01_Panoramic_C', (p) => made.has(p))).toBe(null);
  });
});
