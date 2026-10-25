import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from './lib.mjs';
import { encodeClass, ktxOf, main } from './bf2017-desk.mjs';
import { bucketTextures, countBy, ledgerRows, recordPaths, spec, stemOf, unsentBy, wanted, withFiles } from './bf2017-textures.mjs';

const ledger = [
  { part: 'textures', name: 'A3/FX/Decals/VolumeDecals/Textures/DecalCracksVardos_02_CS', state: 'not-uploaded', by: 'D' },
  { part: 'textures', name: 'Levels/MP/Hoth_01/Lighting/EN_Hoth_01_Static_Sunset_staticIrradianceTexture', state: 'not-uploaded', by: 'D' },
  { part: 'textures', name: 'S1/Levels/Jakku/T_Sand_CS', state: 'not-uploaded', by: 'D' },
  { part: 'textures', name: 'Objects/Props/T_Crate_C', state: 'used', by: 'x' },
  { part: 'models', name: 'Objects/Props/crate', state: 'not-uploaded', by: 'listing' },
];

describe('the textures job', () => {
  it("takes the not-uploaded textures, not the atlases (the atlases job's) nor the sequel era's", () => {
    expect(wanted(ledger).map((r) => r.name)).toEqual(['A3/FX/Decals/VolumeDecals/Textures/DecalCracksVardos_02_CS']);
  });

  it('takes a used map the bucket has no file of, its derived maps counting as it, and none without a listing', () => {
    const index = [
      { name: 'Objects/Props/T_Crate_C', file: 'textures/objects/props/t_crate_c.png' },
      { name: 'Objects/Props/T_Barrel_C', file: 'textures/objects/props/t_barrel_c.png' },
      { name: 'Objects/Props/T_Barrel_NAM', file: 'textures/objects/props/t_barrel_nam.png' },
    ];
    const rows = [...ledger, ...['T_Barrel_C', 'T_Barrel_NAM'].map((n) => ({ part: 'textures', name: `Objects/Props/${n}`, state: 'used', by: 'x' }))];
    // (the barrel's KTX2 in the bucket, its packed normal as its derived maps alone; the crate's nothing)
    const unsent = unsentBy(['web/textures/objects/props/t_barrel_c.ktx2', 'web/textures/objects/props/t_barrel_nam__normal.ktx2', 'web/textures/objects/props/t_barrel_nam__orm_12ab34cd.ktx2'], index);
    expect(unsent('Objects/Props/T_Crate_C')).toBe(true);
    expect(unsent('Objects/Props/t_barrel_c')).toBe(false);
    expect(unsent('Objects/Props/T_Barrel_NAM')).toBe(false);
    expect(unsent('Objects/Props/T_Nowhere_C')).toBe(false);
    expect(wanted(rows, { unsent }).map((r) => r.name)).toEqual(['A3/FX/Decals/VolumeDecals/Textures/DecalCracksVardos_02_CS', 'Objects/Props/T_Crate_C']);
    expect(unsentBy(null, index)).toBeNull();
    expect(wanted(rows).map((r) => r.name)).toEqual(['A3/FX/Decals/VolumeDecals/Textures/DecalCracksVardos_02_CS']);
    // (a path as a Windows record writes it, or a listing gives it, is the same map)
    expect(stemOf('web\\textures\\Objects\\T_X_NAM__orm_ab12.KTX2')).toBe(stemOf('textures/objects/t_x_nam.png'));
    expect(recordPaths('web/textures/a.ktx2\t12\r\n\nweb/textures/b.ktx2\t3\n')).toEqual(['web/textures/a.ktx2', 'web/textures/b.ktx2']);
  });

  it('asks R2 what the bucket has with the keys, the record without them, and says whose word it took', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'w-had-'));
    const d = { webOpt: join(dir, 'web_opt') };
    const keys = { R2_ACCESS_KEY_ID: 'id', R2_SECRET_ACCESS_KEY: 'secret' };
    const asked = [];
    const listBucket = async (fetch, bucket, prefix) => (asked.push([bucket, prefix]), { files: [{ key: 'web/textures/a.ktx2', size: 1 }] });
    const r2 = await bucketTextures(d, keys, { listBucket });
    expect(asked).toEqual([['bf2017-assets', 'web/textures/']]);
    expect(r2.paths).toEqual(['web/textures/a.ktx2']);
    expect(r2.from).toMatch(/R2's listing/);
    expect(await bucketTextures(d, {}, { listBucket })).toEqual({ paths: null, from: null });
    mkdirSync(d.webOpt, { recursive: true });
    writeFileSync(join(d.webOpt, 'upload_state.tsv'), 'web/textures/b.ktx2\t9\n');
    const record = await bucketTextures(d, {}, { listBucket });
    expect(record.paths).toEqual(['web/textures/b.ktx2']);
    expect(record.from).toMatch(/record/);
    // (R2 can't be listed: the record, and why)
    const failed = await bucketTextures(d, keys, { listBucket: async () => { throw new Error('HTTP 403'); } });
    expect(failed.paths).toEqual(['web/textures/b.ktx2']);
    expect(failed.from).toMatch(/HTTP 403/);
  });

  it("finds each one's file and class, and the lane waiting for it", () => {
    const index = [{ name: 'A3/FX/Decals/VolumeDecals/Textures/DecalCracksVardos_02_CS', file: 'textures/a3/fx/decals/volumedecals/textures/decalcracksvardos_02_cs.png', width: 2048, height: 2048, format: 'BC7_SRGB', srgb: false }];
    const [w] = withFiles(wanted(ledger), index, [{ match: 'a3/fx/', lane: 'X' }]);
    expect(w).toMatchObject({ file: 'textures/a3/fx/decals/volumedecals/textures/decalcracksvardos_02_cs.png', class: 'color', owner: 'X', size: '2048×2048' });
    expect(withFiles(wanted(ledger), [], [])[0]).toMatchObject({ file: null, owner: null });
  });

  it("classes a map as the export's encoder does, and names its KTX2", () => {
    expect(encodeClass({ file: 'textures/a__normal.png' })).toBe('normal');
    expect(encodeClass({ file: 'textures/a__orm_12ab.png' })).toBe('attrib');
    expect(encodeClass({ file: 'textures/a_cs.png', format: 'BC7_SRGB' })).toBe('color');
    expect(encodeClass({ file: 'textures/a_c.png', srgb: true })).toBe('color');
    expect(encodeClass({ file: 'textures/a_nam.png', format: 'BC7_UNORM' })).toBe('attrib');
    expect(encodeClass({ file: 'textures/a_x.png', name: 'A_X' }, new Set(['a_x']))).toBe('color');
    expect(ktxOf('textures/a/b_c.png')).toBe('textures/a/b_c.ktx2');
  });

  it("reads the committed ledger: thousands not uploaded, every one a texture", () => {
    const w = wanted(ledgerRows(REPO));
    expect(w.length).toBeGreaterThan(1000);
    expect(w.every((r) => r.part === 'textures')).toBe(true);
    expect(countBy([{ a: 'x' }, { a: 'y' }, { a: 'x' }], 'a')).toEqual([['x', 2], ['y', 1]]);
  });

  it('dry-runs anywhere', async () => {
    const out = mkdtempSync(join(tmpdir(), 'w-tex-'));
    const r = await main(spec, ['--dry', '--limit', '5', '--out', out], { BF2_EXPORT: join(out, 'none') });
    expect(r.items.length).toBe(5);
    expect(r.checks.find((c) => c.name === "the uploader's record").ok).toBe(false);
  });
});
