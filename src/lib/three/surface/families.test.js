import { describe, expect, it } from 'vitest';
import { FAMILIES, MAP_KINDS, MAPS, familyOf, isDefaultTexture, slotsOf } from './families.js';

describe('familyOf', () => {
  it('reads a preset family from the shader name', () => {
    expect(familyOf('Shaders/Presets/SS_PropsNonMetallicPreset_DetailMap', ['CS', 'NS', 'NW'])).toBe('propsNonMetallic');
    expect(familyOf('Shaders/Presets/SS_PropsMetallicPreset_2UV_TextureArray_01', ['_CS', '_NAM_texcoord0'])).toBe('propsMetallic');
    expect(familyOf('Shaders/Presets/Walrus/SS_VehicleLargePreset_01', ['GrungeMask'])).toBe('vehicleLarge');
    expect(familyOf('Shaders/Presets/SS_VehiclePreset', ['_BaseColor', '_Normal'])).toBe('vehicle');
    expect(familyOf('Shaders/Presets/SS_CharactersPreset_WalrusMetallic', ['BaseColor', 'Normal', 'AOSlice'])).toBe('character');
    expect(familyOf('Shaders/Presets/Walrus/SS_VegetationPreset', ['_BaseColor', '_Normal'])).toBe('vegetation');
    expect(familyOf('Shaders/Presets/SS_PropsNonMetallicPreset_01_EmissiveAlphaTest', ['_CA'])).toBe('emissive');
    expect(familyOf('A3/Characters/Heads/_Shared/SS_Hair_Cheap_Game_01', ['HairColorTexture'])).toBe('hair');
    expect(familyOf('Shaders/Presets/SS_WeaponsPreset', ['_BaseColor', '_Normal'])).toBe('weapon');
    expect(familyOf('Shaders/Presets/SS_Panels_Detail_2UV_TextureArray_01', ['_CS'])).toBe('panels');
  });

  it('gives a per-world instance the family its slots match', () => {
    expect(familyOf('Levels/MP/Naboo_01/SS_Naboo_Concrete_01', ['_BaseColor', '_Normal', '_DetailNormal'])).toBe('props');
    expect(familyOf('X/SS_MC80WallsPreset_01', ['_CS', '_NAM'])).toBe('props');
    expect(familyOf('X/SS_Ship_01', ['CS', 'NMR'])).toBe('panels');
    expect(familyOf('X/SS_Body_01', ['BaseColor', 'Normal', 'AOSlice'])).toBe('character');
    expect(familyOf('X/SS_Fern_01', ['_CA', '_NTS'])).toBe('vegetation');
    expect(familyOf('X/SS_Head_01', ['HairColorTexture'])).toBe('hair');
    expect(familyOf('X/SS_Wall_01', ['NormalAO', '_ColorSmoothness', '_DetailNormal'])).toBe('props');
    expect(familyOf('X/SS_Pipe_01', ['CS', 'N'])).toBe('props');
  });

  it('an instance no family settles, naming a map the recipe draws, is `instance`', () => {
    expect(familyOf('X/SS_Hull_01', ['__IdMap', '__NormalEmissiveAO', '__WearMap'])).toBe('instance');
    expect(familyOf('X/SS_Arch_01', ['ParallaxOcclusionHeightmap'])).toBe('instance');
  });

  it('is glb with no slots, no shader or no match', () => {
    expect(familyOf('Objects/Architecture/Hoth/CorridorSystem_01/New/SS_Arctic_CorridorSnowPile_01', [])).toBe('glb');
    expect(familyOf(null, ['_CS'])).toBe('glb');
    expect(familyOf('X/SS_Odd_01', ['Texture'])).toBe('glb');
    // (a preset whose only slots are the engine's defaults binds nothing)
    expect(familyOf('Shaders/Presets/SS_PropsPreset', [])).toBe('glb');
  });

  it('every family a rule names is distinct', () => {
    const names = FAMILIES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('slots', () => {
  it('drops the engine default textures', () => {
    expect(isDefaultTexture('shaders/T_DefaultBlack_RGBA')).toBe(true);
    expect(isDefaultTexture('Objects/Props/_CommonTextures/T_MetalDetail_02_NS')).toBe(false);
    expect(slotsOf({ A: 'shaders/T_DefaultBlack_C', B: 'X/T_Y_NS' })).toEqual(['B']);
  });

  it('every map key has a kind', () => {
    for (const key of Object.keys(MAPS)) expect(MAP_KINDS[key], key).toBeTruthy();
  });
});
