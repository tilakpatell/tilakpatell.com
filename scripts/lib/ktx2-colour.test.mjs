import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ktx2Info } from './ktx2-mips.mjs';
import { auditKtx2, gameWord, mapKind, slotTransfer, stemOf, summarise, transferOf, wantedTransfer, withTransfer } from './ktx2-colour.mjs';

const fixture = (f) => readFileSync(new URL(`../fixtures/bf2017/ktx2/${f}`, import.meta.url));
const colour = fixture('t_arcticbase_rock_small_03_c.128.ktx2'); // a game colour map the encode tagged linear
const normal = fixture('t_o_kam_rimplaza_s_01_nam__normal.16.ktx2');

describe('a KTX2’s colour space, read and stamped', () => {
  it('reads the transfer function the file carries', () => {
    expect(transferOf(colour)).toBe('linear');
    expect(transferOf(normal)).toBe('linear');
  });

  it('stamps sRGB on a colour map without touching anything else, and gives the same buffer back when it already says so', () => {
    const fixed = withTransfer(colour, 'srgb');
    expect(transferOf(fixed)).toBe('srgb');
    expect(fixed.length).toBe(colour.length);
    expect(ktx2Info(fixed)).toEqual(ktx2Info(colour));
    // (one byte differs)
    let diff = 0;
    for (let i = 0; i < colour.length; i++) if (fixed[i] !== colour[i]) diff++;
    expect(diff).toBe(1);
    expect(withTransfer(fixed, 'srgb')).toBe(fixed);
    expect(transferOf(withTransfer(fixed, 'linear'))).toBe('linear');
    expect(transferOf(colour)).toBe('linear'); // (the original untouched)
  });

  it('refuses what is not a KTX2 or not a transfer function', () => {
    expect(() => transferOf(Buffer.from('not a texture'))).toThrow(/KTX2/);
    expect(() => withTransfer(colour, 'gamma')).toThrow(/transfer/);
  });
});

describe('which of the game’s maps are colour', () => {
  it('reads the game name under the pack’s sizes, cuts and slug numbers', () => {
    expect(stemOf('tex/t_container_s_01_cs.128.ktx2')).toBe('t_container_s_01_cs');
    expect(stemOf('t_mc80_mechanicaldetails_02_cs_26.512.ktx2')).toBe('t_mc80_mechanicaldetails_02_cs');
    expect(stemOf('web/textures/objects/x/T_Hangar_01_NAM__orm_e5499c5e.ktx2')).toBe('t_hangar_01_nam__orm_e5499c5e');
    expect(stemOf('luke_rotj_01_body_cs.ultra.ktx2')).toBe('luke_rotj_01_body_cs');
  });

  it('calls colour, emissive and alpha-colour maps colour, and normals, packed masks and derived maps data', () => {
    for (const n of ['t_floorboards_01_cs.128.ktx2', 't_arcticbase_rock_small_03_c', 't_console_01_e', 't_sign_01_ca', 't_crate_01_cw', 'ta_characterdetail_01_em']) expect(mapKind(n), n).toBe('colour');
    for (const n of ['t_x_nam__normal.256.ktx2', 't_x_nam__orm_a2c9de6a', 't_x_n', 't_x_nm', 't_x_ns', 't_x_aosl', 't_x_rgb', 't_x_rgbm', 't_x_m', 't_x_h', 't_x_id', 't_x_ncs', 't_x_b']) expect(mapKind(n), n).toBe('data');
    expect(mapKind('t_swatch_grey_90_01.64.ktx2')).toBe('unknown');
  });

  it('wants sRGB on colour, linear on data, and leaves the rest alone', () => {
    expect(wantedTransfer('t_a_cs')).toBe('srgb');
    expect(wantedTransfer('t_a_nam__normal')).toBe('linear');
    expect(wantedTransfer('t_swatch_grey_90_01')).toBeNull();
  });

  it('knows a glTF slot’s space: base colour and emissive sRGB, the rest linear', () => {
    expect(slotTransfer('baseColorTexture')).toBe('srgb');
    expect(slotTransfer('emissiveTexture')).toBe('srgb');
    for (const s of ['normalTexture', 'occlusionTexture', 'metallicRoughnessTexture']) expect(slotTransfer(s), s).toBe('linear');
  });
});

describe('the audit', () => {
  it('flags a colour map tagged linear and passes a normal tagged linear', () => {
    const bad = auditKtx2('tex/t_arcticbase_rock_small_03_c.128.ktx2', colour);
    expect(bad).toMatchObject({ kind: 'colour', transfer: 'linear', wanted: 'srgb', ok: false });
    expect(auditKtx2('tex/t_o_kam_rimplaza_s_01_nam__normal.16.ktx2', normal).ok).toBe(true);
    expect(auditKtx2('tex/t_arcticbase_rock_small_03_c.128.ktx2', withTransfer(colour, 'srgb')).ok).toBe(true);
    const unknown = auditKtx2('t_swatch_grey_90_01.64.ktx2', colour);
    expect(unknown).toMatchObject({ kind: 'unknown', ok: true });
    const s = summarise([bad, auditKtx2('tex/t_o_kam_rimplaza_s_01_nam__normal.16.ktx2', normal), unknown]);
    expect(s).toEqual({ files: 3, colour: { srgb: 0, linear: 1, unknown: 0 }, data: { srgb: 0, linear: 1, unknown: 0 }, unknown: 1, wrong: ['tex/t_arcticbase_rock_small_03_c.128.ktx2'] });
  });
});

describe('the game’s own word', () => {
  const jsonl = [
    '{"name":"Objects/X/T_Kam_Wall_01_CS","file":"textures/objects/x/t_kam_wall_01_cs.png","format":"BC7_UNORM","srgb":false}',
    '{"name":"Objects/X/T_Crate_01_CS","file":"textures/objects/x/t_crate_01_cs.png","format":"BC7_SRGB","srgb":false}',
    '{"name":"Objects/X/T_Crate_01_W","file":"textures/objects/x/t_crate_01_w.png","format":"BC7_SRGB","srgb":false}',
    'not json',
    '{"name":"Objects/X/T_Old_01_C","file":"textures/objects/x/t_old_01_c.png","format":"BC1_UNORM"}',
  ].join('\n');
  const word = gameWord(jsonl);

  it('reads the format per map, by its file’s stem (the export’s srgb field is false on every row and is ignored where a format is given)', () => {
    expect(word.get('t_kam_wall_01_cs')).toBe(false);
    expect(word.get('t_crate_01_cs')).toBe(true);
    expect(word.get('t_old_01_c')).toBe(false);
    expect(word.size).toBe(4);
  });

  it('overrules the suffix rule, and leaves a derived map data whatever its source says', () => {
    expect(wantedTransfer('tex/t_kam_wall_01_cs.512.ktx2', { word })).toBe('linear');
    expect(wantedTransfer('tex/t_kam_wall_01_cs.512.ktx2')).toBe('srgb');
    expect(wantedTransfer('tex/t_crate_01_w.256.ktx2', { word })).toBe('srgb');
    expect(wantedTransfer('tex/t_crate_01_w.256.ktx2')).toBe('linear');
    expect(wantedTransfer('t_crate_01_cs__orm_a2c9de6a.256.ktx2', { word })).toBe('linear');
    expect(wantedTransfer('t_unlisted_01_cs', { word })).toBe('srgb');
  });

  it('audits with the game’s word and says so', () => {
    const row = auditKtx2('tex/t_kam_wall_01_cs.128.ktx2', withTransfer(colour, 'srgb'), { word });
    expect(row).toMatchObject({ kind: 'data', transfer: 'srgb', wanted: 'linear', ok: false, game: 'linear' });
  });
});
