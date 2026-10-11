import { describe, expect, it } from 'vitest';
import { hdrOf, picturedNames, recordOf, rowMean } from './bf2017-picture.mjs';

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
