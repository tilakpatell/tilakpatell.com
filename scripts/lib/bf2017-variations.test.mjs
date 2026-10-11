import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { entriesOf, indexVariations, levelRule, swapsFor, variationsOf } from './bf2017-variations.mjs';

// Hoth_01's own MVDB trimmed to the snow crate (its default and its
// Box_M_01_A_Snow entries) and one default-only mesh, the crate's
// ObjectVariation record and the two meshes' materials.jsonl rows
const FIX = JSON.parse(readFileSync(new URL('../fixtures/bf2017/variations/hoth-crate.json', import.meta.url), 'utf8'));
const CRATE = 'objects/props/objectsets/_rebelalliance/box_m_01/box_m_01_a_mesh';
const ICICLE = 'objects/nature/arctic/arcticice/arcticice_iceicles_01/arcticice_iceicles_04_mesh';
const SNOW = 'Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/Box_M_01_A_Snow';
// the pack's texture slugs (level.json's `tex`): the crate's and the glass's
// as its GLB names them; the crate's mask (T_Box_M_01_A_M) is not in it
const SLUGS = ['t_box_m_01_a_cs', 't_box_m_01_a_nam__normal', 't_box_m_01_a_nam__orm_67a0539c', 't_glass_01_cs', 't_glass_01_cs__orm_08c3d535', 't_box_m_01_b_cs', 't_box_m_01_b_nam__normal'];
const materials = new Map(FIX.materials.map((r) => [r.mesh, r]));
const hoth = { path: 'data/Levels/MP/Hoth_01/Hoth_01/MeshVariationDb_Win32.json', record: FIX.mvdb };

// a second MVDB naming the crate's default alone: plain crates stand in that sub-level
const plainDb = () => {
  const r = structuredClone(FIX.mvdb);
  r.objects[0].Entries = r.objects[0].Entries.filter((e) => e.VariationAssetNameHash === 0 && /box_m_01/.test(e.Mesh.$asset));
  return { path: 'data/Levels/MP/Hoth_01/Content/MeshVariationDb_Win32.json', record: r };
};

describe('the mesh variation databases', () => {
  it('read as entries: a mesh, its variation, each material’s textures by parameter name', () => {
    const list = entriesOf([hoth]);
    const snow = list.find((e) => e.mesh === CRATE && e.variation === SNOW);
    expect(snow.db).toBe('Hoth_01');
    expect(snow.materials[0].textures._CS).toBe('Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/T_Box_M_01_A_CS');
    expect(snow.materials[0].textures._RGB).toBe('Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/T_Box_M_01_A_M');
    expect(snow.materials[0].guid).toBe('ec9f2c3f-cd2b-4fad-bbd9-0d74363eaadf');
    expect(list.find((e) => e.mesh === CRATE && e.variation === 'default').materials).toHaveLength(3);
  });

  it('index the object variations by their material variations’ guids', () => {
    const idx = indexVariations([FIX.snow]);
    expect(idx.get('ec9f2c3f-cd2b-4fad-bbd9-0d74363eaadf')).toMatchObject({ name: SNOW, shader: 'Shaders/Presets/SS_PropsMetallicPreset_2UV_TextureArray_SnowMask_01' });
    expect(idx.get('470b9b0a-084b-470b-b60b-fc2471a66004').shader).toBeNull();
  });
});

describe('swaps: the GLB’s maps to the variation’s', () => {
  it('maps every slug the old map made to the new map’s, the derived ones by their suffix', () => {
    const s = swapsFor('Objects/X/T_Box_M_01_A_NAM', 'Objects/X/T_Box_M_01_B_NAM', new Set(SLUGS));
    expect(s.swaps).toEqual({ 'tex/t_box_m_01_a_nam__normal.ktx2': 'tex/t_box_m_01_b_nam__normal.ktx2' });
    // (the packed ORM is hashed from its sources: the B map has none in the pack)
    expect(s.missing).toEqual(['Objects/X/T_Box_M_01_B_NAM']);
    expect(s.wanted).toEqual([]);
  });

  it('wants a swapped-to map the pack has not got, by the bucket’s own name, sized like the map it replaces', () => {
    const s = swapsFor('Objects/X/T_Box_M_01_A_CS', 'Objects/X/T_Box_M_01_C_CS', new Set(SLUGS));
    expect(s.swaps).toEqual({});
    expect(s.wanted).toEqual([{ slug: 't_box_m_01_c_cs', like: 't_box_m_01_a_cs', file: 'web/textures/objects/x/t_box_m_01_c_cs.ktx2' }]);
  });

  it('swaps nothing for the same map', () => {
    expect(swapsFor('Objects/X/T_Box_M_01_A_CS', 'Objects/X/T_Box_M_01_A_CS', new Set(SLUGS))).toEqual({ swaps: {}, missing: [], wanted: [] });
  });
});

describe('a pack’s variations', () => {
  const build = (mvdbs, records = [FIX.snow]) => variationsOf({ mvdbs, records, materials, slugs: SLUGS, meshes: [CRATE, ICICLE] });

  it('carries the crate’s snow: the shader the variation names, its maps, the weather it lets on', () => {
    const out = build([hoth]);
    expect(out.format).toBe(1);
    expect(out.instances).toBeNull();
    const v = out.meshes[CRATE].variations[SNOW];
    expect(v._source).toEqual({ mvdb: hoth.path, variation: SNOW });
    const m = v.materials[0];
    expect(m.recipe.shader).toBe('Shaders/Presets/SS_PropsMetallicPreset_2UV_TextureArray_SnowMask_01');
    expect(m.recipe.family).toBe('propsMetallic');
    expect(m.recipe.params.weather.snow).toBe(true);
    // the same colour and normal as the GLB's: nothing to swap
    expect(m.swaps).toEqual({});
    // the mask the pack has not got is kept by name, the rest still applied
    expect(m.missing).toEqual(['Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/T_Box_M_01_A_M']);
    // (the glass keeps its own shader: the variation's material names none)
    expect(v.materials[1].recipe).toBeNull();
  });

  it('a default-only mesh carries nothing', () => {
    expect(build([hoth]).meshes[ICICLE]).toBeUndefined();
  });

  it('takes a variation’s vectors in linear light, by the names the recipe reads', () => {
    const red = structuredClone(FIX.snow);
    red.objects[0].Name = 'Objects/X/Box_Red';
    const crate = red.objects.find((o) => o.$guid === 'ec9f2c3f-cd2b-4fad-bbd9-0d74363eaadf').Shader;
    crate.Shader = null;
    crate.VectorParameters = [{ ParameterName: 'PaintColour', Value: { x: 0.5, y: 0.1, z: 0.1, w: 1 } }];
    const db = structuredClone(FIX.mvdb);
    const e = db.objects[0].Entries.find((x) => x.VariationAssetNameHash !== 0);
    for (const m of e.Materials) m.MaterialVariation &&= { ...m.MaterialVariation, $asset: 'Objects/X/Box_Red' };
    e.Materials[0].TextureParameters.find((t) => t.ParameterName === '_CS').Value.$asset = 'Objects/X/T_Box_M_01_B_CS';
    const out = build([{ path: 'x', record: db }], [red]);
    const m = out.meshes[CRATE].variations['Objects/X/Box_Red'].materials[0];
    expect(m.vectors.PaintColour).toEqual([0.5, 0.1, 0.1, 1]);
    expect(m.swaps).toEqual({ 'tex/t_box_m_01_a_cs.ktx2': 'tex/t_box_m_01_b_cs.ktx2' });
    // (the variation has no shader of its own: the mesh's, with the paint on top)
    expect(m.recipe.shader).toBe('Shaders/Presets/SS_PropsMetallicPreset_2UV_TextureArray_01');
    expect(m.recipe.params.paint).toEqual([0.5, 0.1, 0.1]);
  });

  it('lists the maps a chosen variation swaps to that the pack lacks, for the writer to fetch', () => {
    const db = structuredClone(FIX.mvdb);
    const e = db.objects[0].Entries.find((x) => x.VariationAssetNameHash !== 0);
    e.Materials[0].TextureParameters.find((t) => t.ParameterName === '_CS').Value.$asset = 'Objects/X/T_Box_M_01_C_CS';
    const out = build([{ path: 'data/Levels/MP/Hoth_01/Hoth_01/x.json', record: db }]);
    expect(out.fetch).toEqual([{ slug: 't_box_m_01_c_cs', like: 't_box_m_01_a_cs', file: 'web/textures/objects/x/t_box_m_01_c_cs.ktx2' }]);
    expect(build([hoth]).fetch).toEqual([]);
  });

  it('counts what it wrote', () => {
    expect(build([hoth]).counts).toEqual({ meshes: 2, inMvdb: 2, withVariations: 1, variations: 1, ruled: 1, missing: 2 });
    // (the crate's mask and the glass's damage map: neither in the pack)
  });
});

describe('the level’s own rule', () => {
  it('gives the crate its snow when no sub-level names its default alone', () => {
    expect(variationsOf({ mvdbs: [hoth], records: [FIX.snow], materials, slugs: SLUGS, meshes: [CRATE] }).rule).toEqual({ [CRATE]: SNOW });
  });

  it('gives it nothing when another of the level’s databases names the default alone', () => {
    expect(variationsOf({ mvdbs: [hoth, plainDb()], records: [FIX.snow], materials, slugs: SLUGS, meshes: [CRATE] }).rule).toEqual({});
  });

  it('picks neither of two variations on one level', () => {
    const meshes = { [CRATE]: { dbs: { Hoth_01: ['default', 'A', 'B'] }, variations: { A: {}, B: {} } } };
    expect(levelRule(meshes)).toEqual({});
  });
});
