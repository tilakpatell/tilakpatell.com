import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXCLUDED_PREFIXES, classify, consumersOf, ledgerMarkdown, listingOf, normalise, rowsOf, summarise, usedTextures } from './bf2017-coverage.mjs';
import { LANES, OWNERS } from './bf2017-owners.mjs';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'coverage');
const read = (f) => readFileSync(join(DIR, f), 'utf8');
const jsonl = (f) => read(f).split('\n').filter(Boolean).map((l) => JSON.parse(l));
const manifests = {
  models: jsonl('models.jsonl'),
  anims: jsonl('anims.jsonl'),
  textures: jsonl('textures.jsonl'),
  physics: jsonl('physics.jsonl'),
  terrain: jsonl('terrain.jsonl'),
  maps: JSON.parse(read('maps-index.json')),
  misc: jsonl('misc.jsonl'),
  data: read('data.tsv'),
  listing: read('listing.txt').split('\n').filter(Boolean),
};
const consumers = consumersOf(JSON.parse(read('consumers.json')));
const listing = listingOf(manifests.listing);
const rows = rowsOf(manifests);
const ctx = { consumers, listing, owners: OWNERS };
const row = (id) => rows.find((r) => r.id === id) ?? expect.unreachable(`no row ${id}`);

describe('normalise', () => {
  it('reads a clip by its file, its renamed name and its pack name alike', () => {
    expect(normalise('web/anims/walrus_humanmale/A_Luke_Strike1~1a2b3c4d.glb')).toBe(normalise('a_luke_strike1-1a2b3c4d'));
  });
  it('drops the LOD, the cut and the extension', () => {
    const want = normalise('characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh');
    expect(normalise('models/characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh_lod2.glb')).toBe(want);
    expect(normalise('characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh|lod1')).toBe(want);
    expect(normalise('textures/characters/T_Luke_CS.ktx2')).toBe(normalise('Characters/T_Luke_CS'));
  });
  it('drops a record’s object suffix and a derived map’s suffix', () => {
    expect(normalise('AI/BattleAI/Templates/CloseRange_Template#AntEnumeration')).toBe('closerange_template');
    expect(normalise('t_luke_cs__normal')).toBe('t_luke_cs');
    expect(normalise('t_luke_cs__orm_1a2b')).toBe('t_luke_cs');
  });
});

describe('rowsOf', () => {
  it('gives every object one row', () => {
    // 20 models, 2 collision meshes, 20 clips, 20 textures and the probe face
    // only the listing has, 5 shape sets, 3 terrains, 4 maps with their five
    // extras kinds each, 1 scatter table, 10 misc, 4 data groups, the 4 index
    // files and the test file
    expect(rows.length).toBe(20 + 2 + 20 + 20 + 1 + 5 + 3 + 4 * 6 + 1 + 10 + 4 + 4 + 1);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
  it('makes a model one row with its LOD files', () => {
    expect(row('models:characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh').files).toHaveLength(3);
  });
  it('counts data by top folder and type, not by record', () => {
    const d = rows.filter((r) => r.part === 'data');
    expect(d.map((r) => r.name).sort()).toEqual(['AI/SoldierBlueprint', 'Characters/SoldierBlueprint', 'Levels/LayerData', 'Sound/SoundPatchAsset']);
    expect(d.reduce((n, r) => n + r.count, 0)).toBe(30);
  });
  it('hangs a derived map on its source texture', () => {
    expect(row('textures:characters/hero/luke/luke_rotj_01/t_luke_rotj_01_cs').files).toContain('textures/characters/hero/luke/luke_rotj_01/t_luke_rotj_01_cs__normal.ktx2');
  });
});

describe('classify', () => {
  const c = (id) => classify(row(id), ctx);
  it('marks what a consumer names used, by that consumer', () => {
    expect(c('models:gameplay/vehicles/air/awing/vehicle_air_awing_01_static_donotuse_mesh')).toEqual({ state: 'used', by: 'src/data/galaxyAssets.json' });
    expect(c('models:characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh').state).toBe('used');
    expect(c('anims:anims/walrus_humanmale/a_luke_strike1~1a2b3c4d.glb')).toEqual({ state: 'used', by: 'public/models/galaxy/bf2017/clips-luke.glb' });
    expect(c('data:AI/SoldierBlueprint')).toEqual({ state: 'used', by: 'src/data/bf2017/ai.json' });
    expect(c('maps:levels/mp/hoth_01/hoth_01').state).toBe('used');
  });
  it('keeps the sequel era’s films and act 3 out, and every font in (the owner holds their licence)', () => {
    const film = (name) => ({ id: `movies:${name.toLowerCase()}`, part: 'movies', name, files: [], bytes: 0, keys: [normalise(name)] });
    const font = (name) => ({ id: `fonts:${name.toLowerCase()}`, part: 'fonts', name, files: [], bytes: 0, keys: [normalise(name)] });
    const none = { consumers: consumersOf({}), owners: OWNERS };
    expect(classify(film('Cinematics/Story/A2/M1TAK/game/A2_M1TAK_DS01_S0100_FMV'), none)).toEqual({ state: 'excluded', by: 'era' });
    expect(classify(film('Cinematics/Story/A3/M1PIL/game/A3_M1PIL_DS01_S0100_FMV'), none)).toEqual({ state: 'excluded', by: 'era' });
    expect(classify(film('Cinematics/Story/A1/M1END/game/A1_M1END_DS01_S0100_FMV'), none).state).toBe('owned');
    expect(classify(font('UI/Resources/Fonts/LinotypeUnivers-420Cn'), none).state).toBe('owned');
    expect(classify(font('UI/Resources/Fonts/Aurebesh'), none).state).toBe('owned');
    expect(classify(font('UI/Resources/Fonts/Roboto-Regular'), none).state).toBe('owned');
  });
  it('keeps the sequel era out', () => {
    expect(c('models:characters/hero/kyloren/kyloren_01/kyloren_01_mesh')).toEqual({ state: 'excluded', by: 'era' });
    expect(c('maps.lights:levels/mp/takodana_01/takodana_01')).toEqual({ state: 'excluded', by: 'era' });
  });
  it('keeps the uploader’s scaffolding out', () => {
    expect(EXCLUDED_PREFIXES).toEqual(['test/', 'testranges', 'placeholders', 'tobedeleted_tempintransition', 'rootlevel', 'paintball']);
    expect(c('models:objects/testranges/cube/cube_01_mesh')).toEqual({ state: 'excluded', by: 'scaffolding' });
    expect(c('test:test/web/models/test_cube.glb')).toEqual({ state: 'excluded', by: 'scaffolding' });
    expect(c('maps:a3/levels/sp/rootlevel/rootlevel_a3/rootlevel_a3').by).toBe('scaffolding');
  });
  it('excludes nothing by licence: the owner holds it for every font (2026-10-10)', () => {
    expect(c('fonts:ui/resources/fonts/linotypeunivers')).toEqual({ state: 'owned', by: 'M' });
  });
  it('keeps the uploader’s notes out as scaffolding', () => {
    expect(c('index:readme.md')).toEqual({ state: 'excluded', by: 'scaffolding' });
  });
  it('calls a manifest row the bucket lacks not-uploaded, never unowned', () => {
    expect(c('textures:levels/mp/hoth_01/textures/t_missing_from_bucket_cs')).toEqual({ state: 'not-uploaded', by: 'D' });
    expect(c('terrain:levels/mp/endor_01/terrain/endor_01_terrain').state).toBe('not-uploaded');
  });
  it('gives an owned row its lane', () => {
    expect(classify(row('models:objects/architecture/kamino/archive/o_kam_archivecenter_01_mesh'), { ...ctx, owners: [{ match: 'objects/architecture/', lane: 'O', design: 839 }] })).toEqual({ state: 'owned', by: 'O' });
    expect(c('models:objects/props/_battlebeyond/asteroid_01_mesh').by).toBe('space');
    expect(c('models:objects/nature/arctic/rock_01_mesh').by).toBe('O');
    expect(c('models:characters/npc/creatures/dewback/dewback_01/dewback_01_mesh').by).toBe('B');
    expect(c('anims:anims/yoda_01_ske/yoda_idle.glb').by).toBe('Y');
    expect(c('anims:anims/atat_destruction_01/atat_destruction_fall.glb').by).toBe('W');
    expect(c('maps.effects:levels/mp/endor_01/endor_01').by).toBe('X');
    expect(c('scatter:maps/terrain_scatter/levels/mp/hoth_01/hoth_01_terrain/scatter.json').by).toBe('N');
    expect(c('textures:ui/art/hub/map_planet').by).toBe('M');
    expect(c('anims:anims/walrus_humanmale/p_stance_idle_00.glb').by).toBe('A');
    expect(c('data:Sound/SoundPatchAsset').by).toBe('D');
    expect(c('maps.lights:levels/mp/endor_01/endor_01').by).toBe('E');
    expect(c('maps.decals:levels/mp/endor_01/endor_01').by).toBe('surfaces-Q4');
  });
  it('leaves a row no table names unowned', () => {
    expect(classify(row('models:objects/nature/arctic/rock_01_mesh'), { ...ctx, owners: [] })).toEqual({ state: 'unowned', by: '' });
  });
  it('names every lane the table uses', () => {
    const lanes = new Set(LANES.map((l) => l.lane));
    for (const o of OWNERS) expect(lanes.has(o.lane), o.lane).toBe(true);
  });
});

describe('usedTextures', () => {
  it('marks a used model’s textures used, by that model’s consumer', () => {
    const done = rows.map((r) => ({ ...r, ...classify(r, ctx) }));
    const more = usedTextures(done, manifests.models);
    expect(more.get(normalise('Characters/Hero/Luke/Luke_ROTJ_01/T_Luke_ROTJ_01_CS'))).toBe('src/data/galaxyAssets.json');
  });
});

describe('summarise', () => {
  const done = rows.map((r) => ({ ...r, ...classify(r, ctx) }));
  const s = summarise(done);
  it('adds up to the rows', () => {
    const t = s.totals;
    expect(t.used + t.owned + t.excluded + t.notUploaded + t.unowned).toBe(rows.length);
    const parts = Object.values(s.byPart).reduce((n, p) => n + p.used + p.owned + p.excluded + p.notUploaded + p.unowned, 0);
    expect(parts).toBe(rows.length);
  });
  it('writes the table', () => {
    const md = ledgerMarkdown(s, { at: '2026-10-10', unowned: [] });
    expect(md).toContain('| models |');
    expect(md).toContain('2026-10-10');
  });
});
