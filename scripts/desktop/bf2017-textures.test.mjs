import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from './lib.mjs';
import { encodeClass, ktxOf, main } from './bf2017-desk.mjs';
import { countBy, ledgerRows, spec, unsentBy, wanted, withFiles } from './bf2017-textures.mjs';

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

  it('takes a used map the uploader never sent, by its record, and none without one', () => {
    const index = [
      { name: 'Objects/Props/T_Crate_C', file: 'textures/objects/props/t_crate_c.png' },
      { name: 'Objects/Props/T_Barrel_C', file: 'textures/objects/props/t_barrel_c.png' },
    ];
    const rows = [...ledger, { part: 'textures', name: 'Objects/Props/T_Barrel_C', state: 'used', by: 'x' }];
    // (the barrel's KTX2 in the record, the crate's not)
    const unsent = unsentBy('web/textures/objects/props/t_barrel_c.ktx2\t1234\n', index);
    expect(unsent('Objects/Props/T_Crate_C')).toBe(true);
    expect(unsent('Objects/Props/t_barrel_c')).toBe(false);
    expect(unsent('Objects/Props/T_Nowhere_C')).toBe(false);
    expect(wanted(rows, { unsent }).map((r) => r.name)).toEqual(['A3/FX/Decals/VolumeDecals/Textures/DecalCracksVardos_02_CS', 'Objects/Props/T_Crate_C']);
    expect(unsentBy(null, index)).toBeNull();
    expect(wanted(rows).map((r) => r.name)).toEqual(['A3/FX/Decals/VolumeDecals/Textures/DecalCracksVardos_02_CS']);
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
