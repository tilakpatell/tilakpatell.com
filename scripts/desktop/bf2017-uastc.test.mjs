import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tierTexture } from '../../src/components/galaxy/surface/level/levelPack.js';
import { REPO } from './lib.mjs';
import { main } from './bf2017-desk.mjs';
import { colourMaps, isColour, packs, sizeFor, spec, toktxArgs, withUltra } from './bf2017-uastc.mjs';

describe('the uastc job', () => {
  it('takes the colour maps, not the normals or the ORMs', () => {
    expect(isColour('t_snow_cs')).toBe(true);
    expect(isColour('t_arcticbase_rock_large_01_c')).toBe(true);
    expect(isColour('t_arcticbase_rock_large_01_n__normal')).toBe(false);
    expect(isColour('t_crate_cs__orm_1a2b')).toBe(false);
    expect(isColour('t_crate_nam')).toBe(false);
  });

  it("finds each one's master by its base name, at most 2,048", () => {
    const list = [{ pack: 'hoth', tex: { t_snow_cs: { low: 512, mid: 1024, high: 1024 }, t_snow_nam__normal: {} } }];
    const index = [
      { name: 'Objects/T_Snow_CS', file: 'textures/objects/t_snow_cs.png', width: 4096, height: 4096 },
      { name: 'Other/T_Snow_CS', file: 'textures/other/t_snow_cs.png', width: 512, height: 512 },
    ];
    expect(colourMaps(list, index)).toEqual([{ name: 'hoth/t_snow_cs', pack: 'hoth', slug: 't_snow_cs', file: 'textures/objects/t_snow_cs.png', size: 2048, master: '4096×4096', also: 1 }]);
    expect(colourMaps(list, null)[0].file).toBe(null);
  });

  it('sizes to 2,048 on the longer side, never up', () => {
    expect(sizeFor(4096, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(sizeFor(1024, 1024)).toEqual({ width: 1024, height: 1024 });
  });

  it('asks toktx for UASTC q4, Zstandard, mips, sRGB, the size', () => {
    expect(toktxArgs('m.png', 'o.ktx2', { width: 2048, height: 2048 })).toEqual(['--t2', '--encode', 'uastc', '--uastc_quality', '4', '--zcmp', '18', '--genmipmap', '--assign_oetf', 'srgb', '--resize', '2048x2048', 'o.ktx2', 'm.png']);
  });

  it("names the ultra file the pack's loader then asks for", () => {
    const row = withUltra({ low: 512, mid: 1024, high: 1024 }, 2048);
    expect(row).toEqual({ low: 512, mid: 1024, high: 1024, ultra: '2048.uastc' });
    expect(tierTexture('../tex/t_snow_cs.ktx2', 'ultra', { t_snow_cs: row })).toBe('../tex/t_snow_cs.2048.uastc.ktx2');
    expect(tierTexture('../tex/t_snow_cs.ktx2', 'high', { t_snow_cs: row })).toBe('../tex/t_snow_cs.1024.ktx2');
  });

  it("reads the repository's packs", () => {
    const list = packs(REPO);
    expect(list.map((p) => p.pack)).toContain('hoth');
    expect(colourMaps(list, null).length).toBeGreaterThan(10);
  });

  it('dry-runs anywhere', async () => {
    const out = mkdtempSync(join(tmpdir(), 'w-uastc-'));
    const r = await main(spec, ['--dry', '--only', 'hoth/', '--out', out], { BF2_EXPORT: join(out, 'none') });
    expect(r.items.every((i) => i.pack === 'hoth')).toBe(true);
    expect(r.items.length).toBeGreaterThan(10);
  });
});
