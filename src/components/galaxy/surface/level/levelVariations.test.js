import { describe, expect, it } from 'vitest';
import { applyVariation, swapped, variationFor, variationsIndex } from './levelVariations.js';

const CRATE = 'objects/props/objectsets/_rebelalliance/box_m_01/box_m_01_a_mesh';
const SNOW = 'Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/Box_M_01_A_Snow';
const SNOW_RECIPE = { family: 'propsMetallic', shader: 'Shaders/Presets/SS_PropsMetallicPreset_2UV_TextureArray_SnowMask_01', maps: {}, params: { weather: { snow: true } }, _source: {} };
// a pack's variations.json, trimmed: the crate in its snow, a ship in two
// paints the level's rule cannot choose between
const json = {
  format: 1,
  meshes: {
    [CRATE]: {
      dbs: { Hoth_01: ['default', SNOW] },
      variations: {
        [SNOW]: {
          _source: { mvdb: 'data/Levels/MP/Hoth_01/Hoth_01/MeshVariationDb_Win32.json', variation: SNOW },
          materials: [
            { swaps: { 'tex/t_box_m_01_a_cs.ktx2': 'tex/t_box_m_01_b_cs.ktx2' }, recipe: SNOW_RECIPE, maps: { T_D: 'tex/t_d.ktx2' }, vectors: {}, bools: {}, missing: [] },
            { swaps: {}, recipe: null, maps: {}, vectors: {}, bools: {}, missing: [] },
          ],
        },
      },
    },
    'objects/ship_mesh': { dbs: { Hoth_01: ['default', 'A', 'B'] }, variations: { A: { materials: [] }, B: { materials: [] } } },
  },
  rule: { [CRATE]: SNOW },
  instances: null,
};
const pack = {
  meshes: [
    { name: `models/${CRATE}.glb`, glb: ['meshes/box_m_01_a_mesh.lod0.glb', 'meshes/box_m_01_a_mesh.lod1.glb'] },
    { name: 'models/objects/ship_mesh.glb', glb: ['meshes/ship_mesh.lod0.glb'] },
  ],
};

describe('a mesh’s variation', () => {
  it('is the level’s rule’s where no instance names one', () => {
    expect(variationFor(json, CRATE).name).toBe(SNOW);
    expect(variationFor(json, CRATE).materials).toHaveLength(2);
  });

  it('is none where the rule could not choose', () => {
    expect(variationFor(json, 'objects/ship_mesh')).toBeNull();
    expect(variationFor(json, 'objects/unknown_mesh')).toBeNull();
    expect(variationFor(null, CRATE)).toBeNull();
  });

  it('is found by any of the mesh’s LOD files', () => {
    const idx = variationsIndex(pack, json);
    expect(idx.forGlb('meshes/box_m_01_a_mesh.lod1.glb').name).toBe(SNOW);
    expect(idx.forGlb('meshes/ship_mesh.lod0.glb')).toBeNull();
    expect(idx.chosen).toBe(1);
    expect(idx.tex).toEqual({});
    expect(variationsIndex(pack, { ...json, tex: { t_box_m_01_b_cs: { low: 256, high: 512, srgb: true } } }).tex).toEqual({ t_box_m_01_b_cs: { low: 256, high: 512, srgb: true } });
    expect(variationsIndex(pack, null)).toBeNull();
  });
});

describe('applyVariation', () => {
  const base = { family: 'propsMetallic', shader: 'Shaders/Presets/SS_PropsMetallicPreset_2UV_TextureArray_01', maps: { detail: 'T_D' }, params: { alphaTest: false }, _source: {} };
  const vm = json.meshes[CRATE].variations[SNOW].materials;

  it('draws the material as its variation: the shader and the weather it lets on, the variation named', () => {
    const r = applyVariation(base, vm[0], SNOW);
    expect(r.shader).toBe(SNOW_RECIPE.shader);
    expect(r.params.weather.snow).toBe(true);
    expect(r.variation).toEqual({ name: SNOW, vectors: {}, bools: {} });
    // (the recipe given is not changed)
    expect(base.variation).toBeUndefined();
  });

  it('leaves a material whose variation changes nothing the recipe reads as it was', () => {
    expect(applyVariation(base, vm[1], SNOW)).toBe(base);
    expect(applyVariation(base, null, SNOW)).toBe(base);
  });

  it('gives a recipe where the pack had none', () => {
    expect(applyVariation(null, vm[0], SNOW).shader).toBe(SNOW_RECIPE.shader);
    expect(applyVariation(null, vm[1], SNOW)).toBeNull();
  });
});

describe('swapped', () => {
  it('moves a GLB’s map to the variation’s, and leaves the rest', () => {
    const vm = json.meshes[CRATE].variations[SNOW].materials[0];
    expect(swapped('tex/t_box_m_01_a_cs.ktx2', vm)).toBe('tex/t_box_m_01_b_cs.ktx2');
    expect(swapped('tex/t_box_m_01_a_nam__normal.ktx2', vm)).toBe('tex/t_box_m_01_a_nam__normal.ktx2');
    expect(swapped('tex/a.ktx2', null)).toBe('tex/a.ktx2');
  });
});
