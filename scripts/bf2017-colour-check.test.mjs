import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withTransfer } from './lib/ktx2-colour.mjs';
import { auditPublished, formatsOf, stampPackRows } from './bf2017-colour-check.mjs';
import { gameWord } from './lib/ktx2-colour.mjs';

const colour = readFileSync(new URL('./fixtures/bf2017/ktx2/t_arcticbase_rock_small_03_c.128.ktx2', import.meta.url));
const normal = readFileSync(new URL('./fixtures/bf2017/ktx2/t_o_kam_rimplaza_s_01_nam__normal.16.ktx2', import.meta.url));

describe('the published files’ audit', () => {
  it('asks each KTX2 the manifest names at its hashed URL, reads its header, and counts what it cannot reach', async () => {
    const manifest = {
      'models/galaxy/bf2017/crew/tex/luke_body_cs.1024.ktx2': { hash: 'aaaaaaaaaaaa', bytes: 1 },
      'models/galaxy/bf2017/crew/tex/luke_body_e.512.ktx2': { hash: 'bbbbbbbbbbbb', bytes: 1 },
      'models/galaxy/bf2017/crew/tex/luke_body_nam__normal.512.ktx2': { hash: 'cccccccccccc', bytes: 1 },
      'models/galaxy/bf2017/crew/tex/gone.256.ktx2': { hash: 'dddddddddddd', bytes: 1 },
      'models/galaxy/bf2017/crew/luke.glb': { hash: 'eeeeeeeeeeee', bytes: 1 },
    };
    const asked = [];
    const get = async (url) => {
      asked.push(url);
      if (url.includes('aaaaaaaaaaaa')) return colour.subarray(0, 1024);
      if (url.includes('bbbbbbbbbbbb')) return withTransfer(colour, 'srgb').subarray(0, 1024);
      if (url.includes('cccccccccccc')) return normal.subarray(0, 1024);
      return null;
    };
    const r = await auditPublished(manifest, 'https://x.supabase.co/storage/v1/object/public/site-assets/', get);
    expect(asked).toHaveLength(4);
    expect(asked[0]).toBe('https://x.supabase.co/storage/v1/object/public/site-assets/aaaaaaaaaaaa/models/galaxy/bf2017/crew/tex/luke_body_cs.1024.ktx2');
    expect(r.summary).toMatchObject({ files: 3, colour: { srgb: 1, linear: 1, unknown: 0 }, data: { linear: 1, srgb: 0, unknown: 0 }, wrong: ['models/galaxy/bf2017/crew/tex/luke_body_cs.1024.ktx2'] });
    expect(r.missing).toEqual(['models/galaxy/bf2017/crew/tex/gone.256.ktx2']);
  });
});

describe('the game’s word on a map', () => {
  it('reads textures.jsonl’s format as sRGB or linear by name, skipping a bad line', () => {
    const f = formatsOf('{"name":"Objects/X/T_Crate_01_CS","format":"BC7_SRGB"}\nnot json\n{"name":"Objects/X/T_Crate_01_NAM","format":"BC7_UNORM"}\n');
    expect(f.get('t_crate_01_cs')).toBe('srgb');
    expect(f.get('t_crate_01_nam')).toBe('linear');
    expect(f.size).toBe(2);
  });
});

describe('the packs’ rows', () => {
  it('writes the game’s word into each tex row, a derived map linear, an unlisted slug by the suffix rule, an unknown left alone', () => {
    const word = gameWord('{"file":"textures/x/t_kam_wall_01_cs.png","format":"BC7_UNORM"}\n{"file":"textures/x/t_crate_01_cs.png","format":"BC7_SRGB"}\n');
    const tex = { t_kam_wall_01_cs: { high: 1024 }, t_crate_01_cs__orm_ab12cd34: { high: 512 }, t_crate_01_cs: { high: 512 }, t_new_01_c: { high: 256 }, t_swatch_grey: { high: 64 } };
    const n = stampPackRows(tex, word);
    expect(tex.t_kam_wall_01_cs.srgb).toBe(false);
    expect(tex.t_crate_01_cs__orm_ab12cd34.srgb).toBe(false);
    expect(tex.t_crate_01_cs.srgb).toBe(true);
    expect(tex.t_new_01_c.srgb).toBe(true);
    expect(tex.t_swatch_grey.srgb).toBeUndefined();
    expect(n).toEqual({ srgb: 2, linear: 2, unknown: 1, game: 3 });
  });
});
