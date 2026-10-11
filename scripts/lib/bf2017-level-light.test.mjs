import { describe, expect, it } from 'vitest';
import { enlightenRows, farShadowRow } from './bf2017-level-light.mjs';
import { enlightenRows as fromLevel, farShadowRow as farFromLevel } from './bf2017-level.mjs';

// the export's texture index rows (web/textures.jsonl), as lane W's job reads them
const row = (name, w = 3128, h = 3680, format = 'BC7_UNORM') => ({ name, file: `textures/${name.toLowerCase()}.png`, width: w, height: h, format, srgb: false });
const SET = 'Levels/MP/Hoth_01/Lighting/EN_Hoth_01_Static_Sunset';
const index = [
  row(`${SET}_staticIrradianceTexture`, 3128, 3680, 'BC6U_FLOAT'),
  row(`${SET}_staticDirectionTextureR`),
  row(`${SET}_staticDirectionTextureG`),
  row(`${SET}_staticDirectionTextureB`),
  row(`${SET}_staticSkyVisibilityData`),
  row('Levels/MP/Hoth_01/Lighting/FL_Hoth_Cloudy_01_Static_staticIrradianceTexture', 5564, 6144, 'BC6U_FLOAT'),
  row('Levels/MP/Hoth_01/T_Snow_CS'),
  row('S1/Jakku/Lighting/FL_Jakku_staticIrradianceTexture'),
];

describe('enlightenRows', () => {
  const rows = enlightenRows(index);
  it('one row a StaticEnlightenData set, the sequel era’s left out, sorted by name', () => {
    expect(rows.map((r) => r.set)).toEqual(['EN_Hoth_01_Static_Sunset', 'FL_Hoth_Cloudy_01_Static']);
  });
  it('a set’s five maps at their pack paths, each from its bucket path (the HDR irradiance first, the clamped one after)', () => {
    const r = rows[0];
    expect(r).toMatchObject({
      variant: 'Sunset',
      size: [3128, 3680],
      uvSet: 1,
      charts: null,
      irradiance: 'enlighten/en_hoth_01_static_sunset.irradiance.ktx2',
      dirR: 'enlighten/en_hoth_01_static_sunset.dirR.ktx2',
      dirG: 'enlighten/en_hoth_01_static_sunset.dirG.ktx2',
      dirB: 'enlighten/en_hoth_01_static_sunset.dirB.ktx2',
      skyVisibility: 'enlighten/en_hoth_01_static_sunset.sky.ktx2',
    });
    const file = `textures/${SET.toLowerCase()}_staticirradiancetexture`;
    expect(r.from.irradiance).toEqual([`hdr/${file}.3128.ktx2`, `${file}.ktx2`]);
    expect(r.from.dirR).toEqual([`textures/${SET.toLowerCase()}_staticdirectiontexturer.ktx2`]);
    expect(typeof r._source).toBe('string');
  });
  it('a set over 4,096 is cut to fit as lane W’s job cuts it, and its HDR path names that width', () => {
    const r = rows[1];
    expect(r.size).toEqual([3708, 4096]);
    expect(r.from.irradiance[0]).toMatch(/\.3708\.ktx2$/);
    // (the maps the export has not got are not named)
    expect(r.dirR).toBe(undefined);
    expect(r.variant).toBe('Cloudy');
  });
  it('no index, no rows', () => {
    expect(enlightenRows(null)).toEqual([]);
    expect(enlightenRows([row('T_Snow_CS')])).toEqual([]);
  });
  it('bf2017-level.mjs writes the same rows (the pack writer’s door)', () => {
    expect(fromLevel).toBe(enlightenRows);
    expect(farFromLevel).toBe(farShadowRow);
  });
});

describe('farShadowRow', () => {
  // Hoth's level.json's shadowCache (lane E0, scripts/lib/bf2017-level-probes.mjs)
  const hoth = { centre: [-20.36, 22.72, 197.52], forward: [0, 0, 1111.48], png: 'shadow/far.png', resolution: 4096, right: [650.64, 0, 0], size: [2048, 2048], tiles: 8, up: [0, 202.43, 0], variant: 'Cloudy_VFX' };
  it('the pack’s shadowCache as the far cache reads it: the box, the map and its size', () => {
    const r = farShadowRow(hoth);
    expect(r).toMatchObject({ png: 'shadow/far.png', size: [2048, 2048], centre: hoth.centre, right: hoth.right, up: hoth.up, forward: hoth.forward, variant: 'Cloudy_VFX' });
    expect(typeof r._source).toBe('string');
  });
  it('none without a cache, or one with no map or a box without size', () => {
    expect(farShadowRow(null)).toBe(null);
    expect(farShadowRow({ ...hoth, png: null })).toBe(null);
    expect(farShadowRow({ ...hoth, right: [0, 0, 0] })).toBe(null);
  });
});
