import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from './bf2017-desk.mjs';
import { atlasKind, atlases, fitSize, setOf, spec } from './bf2017-atlases.mjs';

const row = (name, w = 3128, h = 3680, format = 'BC7_UNORM') => ({ name, file: `textures/${name.toLowerCase()}.png`, width: w, height: h, format, srgb: false, bytes: 1 });

describe('the atlases job', () => {
  it('tells the five maps of a set apart, and the set they are of', () => {
    expect(atlasKind('Levels/MP/Hoth_01/Lighting/EN_Hoth_01_Static_Sunset_staticIrradianceTexture')).toBe('irradiance');
    expect(atlasKind('L/X_staticDirectionTextureG')).toBe('directionG');
    expect(atlasKind('L/X_staticSkyVisibilityData')).toBe('sky');
    expect(atlasKind('L/T_Hoth_Sunny_02_C')).toBe(null);
    expect(setOf('L/X_staticDirectionTextureG')).toBe('L/X');
  });

  it("lists every atlas in the index, the sequel era's left out", () => {
    const index = [row('L/Hoth/EN_Hoth_staticIrradianceTexture', 3128, 3680, 'BC6U_FLOAT'), row('L/Hoth/EN_Hoth_staticSkyVisibilityData'), row('S1/Jakku/Lighting/FL_Jakku_staticIrradianceTexture'), row('L/Hoth/T_Snow_CS')];
    const a = atlases(index);
    expect(a.map((i) => i.kind)).toEqual(['irradiance', 'sky']);
    expect(a[0]).toMatchObject({ set: 'L/Hoth/EN_Hoth', size: '3128×3680', format: 'BC6U_FLOAT' });
  });

  it('fits the largest to 4,096 on the longer side, the rest as they are', () => {
    expect(fitSize(5564, 6144)).toEqual({ width: 3708, height: 4096 });
    expect(fitSize(3128, 3680)).toEqual({ width: 3128, height: 3680 });
    expect(fitSize(16, 24)).toEqual({ width: 16, height: 24 });
  });

  it('dry-runs anywhere, with or without the index', async () => {
    const out = mkdtempSync(join(tmpdir(), 'w-atl-'));
    const r = await main(spec, ['--dry', '--out', out], { BF2_EXPORT: join(out, 'none') });
    expect(r.dry).toBe(true);
    expect(r.checks.find((c) => c.name === "the export's encoder").ok).toBe(false);
  });
});
