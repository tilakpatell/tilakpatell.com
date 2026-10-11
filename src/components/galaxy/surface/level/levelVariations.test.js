import { describe, expect, it } from 'vitest';
import { applyVariation, variationFor, variationsIndex } from './levelVariations.js';

const CRATE = 'objects/props/objectsets/_rebelalliance/box_m_01/box_m_01_a_mesh';
const LAMP = 'objects/props/objectsets/_rebelalliance/_lights/lightceiling_m_01/lightceiling_m_01_mesh';
const CS = 'textures/objects/props/objectsets/_rebelalliance/box_m_01/t_box_m_01_a_cs.ktx2';
const NAM = 'textures/objects/props/objectsets/_rebelalliance/box_m_01/t_box_m_01_a_nam__normal.ktx2';
const RED = 'textures/objects/props/objectsets/_rebelalliance/container_l_01/t_container_l_01_red_cs.ktx2';

// variations.json as scripts/bf2017-variations.mjs writes it, trimmed: the
// snowed crate, a lit lamp, a container whose variation is its own colour map
const rows = {
  format: 1,
  meshes: {
    [CRATE]: {
      default: [{ textures: { _CS: CS, _NAM_texcoord0: NAM } }, { textures: { CS: null } }],
      variations: {
        Box_M_01_A_Snow: {
          asset: 'Objects/Props/ObjectSets/_RebelAlliance/Box_M_01/Box_M_01_A_Snow',
          materials: [{ textures: { _RGB: null, _CS: CS, _NAM_texcoord0: NAM }, shader: 'Shaders/Presets/SS_PropsMetallicPreset_2UV_TextureArray_SnowMask_01', missing: ['T_Box_M_01_A_M'] }, { textures: { CS: null } }],
        },
      },
      use: 'Box_M_01_A_Snow',
      by: 'instances',
    },
    [LAMP]: {
      default: [{ textures: {} }, { textures: {} }],
      variations: { LightCeiling_M_01_Lit: { materials: [{ textures: {}, vectors: { EmissiveIntensety: [3813.773, 4442.85, 6144, 1] } }, { textures: {} }] } },
      use: 'LightCeiling_M_01_Lit',
      by: 'instances',
    },
    container: {
      default: [{ textures: { _CS: CS, _NAM_texcoord0: NAM } }],
      variations: { Container_L_01_Red: { materials: [{ textures: { _CS: RED, _NAM_texcoord0: NAM } }] } },
      use: 'Container_L_01_Red',
      by: 'rule',
    },
    mixed: { default: [{ textures: {} }], variations: { A: { materials: [{ textures: {} }] }, B: { materials: [{ textures: {} }] } }, use: null, by: 'mixed' },
  },
  maps: { [RED]: 'tex/t_container_l_01_red_cs.ktx2' },
  instances: [[7, 'B']],
};
const props = { family: 'propsMetallic', shader: 'Shaders/Presets/SS_PropsMetallicPreset_2UV_TextureArray_01', maps: { detail: 'T_MetalDetail_02_NS' }, params: { alphaTest: false } };

describe('variationFor', () => {
  it('gives the crate its snow set', () => {
    const v = variationFor(rows, `models/${CRATE}.glb`);
    expect(v.name).toBe('Box_M_01_A_Snow');
    expect(v.materials[0].shader).toMatch(/SnowMask/);
  });

  it('is null for a mesh with no variation applied, or none at all', () => {
    expect(variationFor(rows, 'models/mixed.glb')).toBe(null);
    expect(variationFor(rows, 'models/nothing.glb')).toBe(null);
    expect(variationFor(null, `models/${CRATE}.glb`)).toBe(null);
  });

  it("takes an instance group's own variation first", () => {
    expect(variationFor(rows, 'models/mixed.glb', { groupIndex: 7 }).name).toBe('B');
  });
});

describe('applyVariation', () => {
  it('overrides a colour map the variation binds apart from the default, and keeps the recipe’s other maps', () => {
    const v = variationFor(rows, 'models/container.glb');
    const r = applyVariation(props, v, 0);
    expect(r.maps.color).toBe(RED);
    expect(r.maps.detail).toBe('T_MetalDetail_02_NS');
    // (the normal is the default's: the GLB already wears it)
    expect(r.maps.normal).toBeUndefined();
    expect(r.variation).toMatchObject({ name: 'Container_L_01_Red' });
    // (the recipe itself is not changed)
    expect(props.maps.color).toBeUndefined();
    expect(props.variation).toBeUndefined();
  });

  it('snows a snow variation, its missing mask skipped', () => {
    const r = applyVariation(props, variationFor(rows, `models/${CRATE}.glb`), 0);
    expect(r.variation.snow).toBe(true);
    expect(r.maps.color).toBeUndefined();
    expect(r.maps.weathering).toBeUndefined();
  });

  it("carries the variation's vectors, and gives a GLB-only material a family to draw them with", () => {
    const glbOnly = { family: 'glb', shader: 'Shaders/Presets/SS_PropsMetallicPreset_2UV_TextureArray_01', maps: {}, params: {} };
    const r = applyVariation(glbOnly, variationFor(rows, `models/${LAMP}.glb`), 0);
    expect(r.variation.vectors.EmissiveIntensety[2]).toBe(6144);
    expect(r.family).not.toBe('glb');
  });

  it('is the recipe as it was without a variation, or for a material the variation does not list', () => {
    expect(applyVariation(props, null, 0)).toBe(props);
    expect(applyVariation(props, variationFor(rows, 'models/container.glb'), 3)).toBe(props);
  });

  it('leaves a GLB-only material alone when its variation changes nothing', () => {
    const glbOnly = { family: 'glb', maps: {}, params: {} };
    expect(applyVariation(glbOnly, variationFor(rows, `models/${LAMP}.glb`), 1)).toBe(glbOnly);
  });
});

describe('variationsIndex', () => {
  it("indexes a pack's GLBs to their mesh's variation, and the maps it names", () => {
    const pack = { meshes: [{ name: 'models/container.glb', glb: ['meshes/container.lod0.glb', 'meshes/container.lod1.glb'] }, { name: 'models/mixed.glb', glb: ['meshes/mixed.lod0.glb'] }] };
    const idx = variationsIndex(pack, rows);
    expect(idx.forGlb('meshes/container.lod1.glb').name).toBe('Container_L_01_Red');
    expect(idx.forGlb('meshes/mixed.lod0.glb')).toBe(null);
    expect(idx.maps[RED]).toBe('tex/t_container_l_01_red_cs.ktx2');
    expect(variationsIndex(pack, null)).toBe(null);
  });
});

describe('applyVariation: the default by texture, not by slot name', () => {
  it('does not re-bind a texture the default already binds under another slot name', () => {
    const v = { name: 'Container_L_01_DynamicColor', defaults: [{ textures: { _CS: CS, _NAM_texcoord0: NAM } }], materials: [{ textures: { _BaseColor: CS, _Normal: NAM }, vectors: { PaintColour: [1, 0, 0, 1] } }] };
    const r = applyVariation(props, v, 0);
    expect(r.maps.color).toBeUndefined();
    expect(r.maps.normal).toBeUndefined();
    expect(r.variation.vectors.PaintColour).toEqual([1, 0, 0, 1]);
  });
});
