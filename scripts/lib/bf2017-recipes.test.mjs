import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { candidatesOf, colourIndex, countFamilies, crewRecipes, mapsWanted, recipeOf, recipesOf } from './bf2017-recipes.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/bf2017/materials');
const row = (name) => JSON.parse(readFileSync(join(DIR, `${name}.jsonl`), 'utf8').trim());
const src = (r, i, p) => `materials.jsonl:${r.mesh}#${i}.${p}`;

describe('recipeOf', () => {
  it('a prop with a detail normal: its tiling and where it came from', () => {
    const r = row('props');
    const x = recipeOf(r, 0);
    expect(x.family).toBe('propsNonMetallic');
    expect(x.shader).toBe('Shaders/Presets/SS_PropsNonMetallicPreset_DetailMap');
    expect(x.maps.detail).toBe('Objects/Props/_CommonTextures/T_MetalDetail_02_NS');
    expect(x.params.detail.tiling).toEqual([2, 2]);
    expect(x._source['params.detail.tiling']).toBe(src(r, 0, 'NormalDetailScalar'));
    expect(x._source['maps.detail']).toBe(src(r, 0, 'NS'));
    // (the strength the dump lacks is the named default)
    expect(x.params.detail.strength).toBe(1);
    expect(x._source['params.detail.strength']).toBe('families.js:DETAIL_STRENGTH');
  });

  it('a wrecked large vehicle: paint, metal, grunge, scorch', () => {
    const r = row('vehicle');
    const x = recipeOf(r, 0);
    expect(x.family).toBe('vehicleLarge');
    expect(x.params.wreck).toBe(true);
    expect(x._source['params.wreck']).toBe(src(r, 0, 'ESB_VehicleIsWreck'));
    expect(x.params.scorch.ember).toBe(1000);
    expect(x.params.paint).toEqual([1, 1, 1]);
    expect(x.params.metal[0]).toBeCloseTo(0.6024, 4);
    expect(x.params.grunge.color).toEqual([1, 1, 1]);
    // (the slot holds T_MetalGrunge_01_N: a normal, drawn as one)
    expect(x.params.grunge.normal).toBe(true);
    expect(x._source['params.grunge.normal']).toBe(src(r, 0, 'GrungeMask'));
    expect(x.params.detail.tiling).toEqual([20, 20]);
    expect(x.params.breakup.tiling).toEqual([40, 40]);
    expect(x.maps.detail).toBe('Objects/Architecture/Imperial/StarDestroyer_01/T_StarDestroyer_MetalBare_01_NW');
    expect(x.maps.grunge).toBe('Objects/Architecture/Rebel/MC80/_Shaders/T_MetalGrunge_01_N');
    expect(x.maps.mask).toBe('Objects/Architecture/Imperial/StarDestroyer_01/T_StarDestroyer_SmallCanon_01_M01');
  });

  it('a character: the detail array and its slice by the median', () => {
    const r = row('character');
    const x = recipeOf(r, 0);
    expect(x.family).toBe('character');
    expect(x.maps.detailArray).toBe('Characters/DetailMaps/TA_CharacterDetail_17_NS');
    // (every slice, each texel the one AOSlice's green names)
    expect(x.maps.detailSlice).toBe('aoSlice');
    expect(x.maps.aoSlice).toBe('Characters/Hero/Iden/Act3/Iden_Act3_01/Texture/T_Iden_Act3_01_AOSL');
    expect(x.maps.weathering).toBe('Characters/Hero/Iden/Act3/Iden_Act3_01/Texture/T_Iden_Act3_01_W');
    // (per slice: the slice's own component once the median is known; x until then)
    expect(x.params.detail.tiling).toEqual([13, 13]);
    // (one component per AOSlice level: three slices and the fourth, none)
    expect(x.params.detail.perSlice.tiling).toEqual([13, 24, 12, 0]);
    expect(x.params.detail.perSlice.normal).toEqual([1, 1, 1.5, 0]);
  });

  it('vegetation: translucency, alpha test from the colour + alpha map, both sides', () => {
    const r = row('vegetation');
    const x = recipeOf(r, 0);
    expect(x.family).toBe('vegetation');
    expect(x.params.backface.subsurface).toBe(2);
    expect(x.params.backface.smoothness).toBeCloseTo(0.8, 5);
    expect(x.params.alphaTest).toBe(true);
    expect(x._source['params.alphaTest']).toBe(src(r, 0, '_BaseColor'));
    expect(x.params.doubleSided).toBe(true);
    expect(x.params.reflectance).toEqual({
      up: 0.30000001192092896,
      down: 0.30000001192092896,
    });
  });

  it('an emissive alpha-tested light: colour times intensity from the rgb vector', () => {
    const r = row('emissive');
    const [lamp, body] = recipesOf(r);
    expect(lamp.family).toBe('emissive');
    expect(lamp.params.emissive.intensity).toBe(333209.96875);
    expect(lamp.params.emissive.color[2]).toBe(1);
    expect(lamp.params.emissive.color[0]).toBeCloseTo(127814.1953125 / 333209.96875, 6);
    expect(lamp.params.emissive.mode).toBe('baseColor');
    expect(lamp._source['params.emissive.intensity']).toBe(src(r, 0, 'EmissiveIntensety'));
    expect(lamp.params.alphaTest).toBe(true);
    expect(lamp._source['params.alphaTest']).toBe(src(r, 0, 'AlphaOnOff'));
    expect(body.family).toBe('propsMetallic');
    expect(body.params.detail.tiling).toEqual([1, 1]);
    expect(body.params.alphaTest).toBe(false);
  });

  it('a material with no slots keeps the GLB', () => {
    const x = recipeOf(row('glb'), 0);
    expect(x.family).toBe('glb');
    expect(x.maps).toEqual({});
    expect(x.params).toEqual({});
  });
});

describe('mapsWanted', () => {
  it('names each wanted map once with its kind', () => {
    const all = ['props', 'vehicle', 'character', 'vegetation', 'emissive', 'glb'].flatMap((n) => recipesOf(row(n)));
    const wanted = mapsWanted(all);
    const names = wanted.map((w) => w.name);
    expect(new Set(names).size).toBe(names.length);
    const kind = Object.fromEntries(wanted.map((w) => [w.name, w.kind]));
    expect(kind['Objects/Props/_CommonTextures/T_MetalDetail_02_NS']).toBe('detail');
    expect(kind['Objects/Architecture/Imperial/StarDestroyer_01/T_StarDestroyer_MetalBare_01_NW']).toBe('detail');
    expect(kind['Objects/Architecture/Rebel/MC80/_Shaders/T_MetalGrunge_01_N']).toBe('overlay');
    expect(kind['Objects/Architecture/Imperial/StarDestroyer_01/T_StarDestroyer_SmallCanon_01_M01']).toBe('mask');
    expect(kind['Characters/DetailMaps/TA_CharacterDetail_17_NS']).toBe('array');
    expect(kind['Characters/Hero/Iden/Act3/Iden_Act3_01/Texture/T_Iden_Act3_01_W']).toBe('mask');
    // (the engine's default black is never fetched)
    expect(names.some((n) => /T_Default/i.test(n))).toBe(false);
  });
});

describe('countFamilies', () => {
  it('counts the families over rows', () => {
    const c = countFamilies(['props', 'emissive', 'glb'].map(row));
    expect(c).toEqual({
      propsNonMetallic: 1,
      emissive: 1,
      propsMetallic: 1,
      glb: 1,
    });
  });
});

describe('candidatesOf', () => {
  it('names the objects of a map in the bucket, best first', () => {
    expect(candidatesOf('Objects/Props/_CommonTextures/T_MetalDetail_02_NS', 'detail')).toEqual(['textures/objects/props/_commontextures/t_metaldetail_02_ns__normal.ktx2', 'textures/objects/props/_commontextures/t_metaldetail_02_ns.ktx2']);
    expect(candidatesOf('Characters/DetailMaps/TA_CharacterDetail_17_NS', 'array')).toEqual(['textures/characters/detailmaps/ta_characterdetail_17_ns_000__normal.ktx2', 'textures/characters/detailmaps/ta_characterdetail_17_ns_000.ktx2']);
    // (a packed normal + emissive rebuilt as a normal has lost its emissive)
    expect(candidatesOf('X/T_Panel_NormalEmissive', 'emissive')).toEqual(['textures/x/t_panel_normalemissive.ktx2']);
  });
});

describe('hair and heads', () => {
  it('a melanin hair: its strand map and numbers', () => {
    const r = row('hair');
    const x = recipeOf(r, 0);
    expect(x.family).toBe('hair');
    expect(x.maps.hairStrand).toBe('Characters/Heads/Hair_Hask/Hair_Hask_Orig_01/Textures/T_haskHairCap_RGBA');
    expect(x.params.hair.melanin).toEqual([0.34191441535949707, 0.10461648553609848]);
    expect(x._source['params.hair.melanin']).toBe(src(r, 0, 'MelaninXY'));
    expect(x.params.hair.melaninOn).toBe(true);
    expect(x.params.hair.tip).toEqual([0.014443843625485897, 0.009134058840572834, 0.0065120905637741089]);
    expect(x.params.hair.smoothness).toBeCloseTo(0.6, 6);
    expect(x.params.doubleSided).toBe(true);
  });

  it('a head: its reflectance, scattering and AO map', () => {
    const r = row('head');
    const [eye, head] = recipesOf(r);
    expect(eye.family).toBe('glb');
    expect(head.family).toBe('head');
    expect(head.maps.sss).toBe('Characters/Heads/Heads_Luke/Heads_Luke_01/Texture/T_Heads_Luke_01_RSSSAO');
    expect(head._source['maps.sss']).toBe(src(r, 1, 'RSSSAO'));
    // (its NS is its own normal, not a detail map: no other normal slot names one)
    expect(head.maps.detail).toBeUndefined();
  });
});

describe('emissive maps by what the slot holds', () => {
  const one = (textures, vectors = { EmissiveIntensity: [1e7, 0, 0, 0] }) => recipeOf({ mesh: 'm', materials: [{ shader: 'X/SS_PropsPreset', textures: { _BaseColor: 'X/T_A_C', _Normal: 'X/T_A_N', ...textures }, vectors, conditionals: {} }] }, 0);
  it('an _E map is drawn as the emissive', () => {
    const x = one({ _E: 'X/T_Light_E' });
    expect([x.maps.emissive, x.params.emissive.mode]).toEqual(['X/T_Light_E', 'texture']);
  });
  it('a mask in the slot is one channel', () => {
    const x = one({ _Emissive: 'X/T_Post_M' });
    expect([x.maps.emissive, x.params.emissive.mode]).toEqual(['X/T_Post_M', 'mask']);
  });
  it('a colour map in the slot glows its base colour; a packed normal is not drawn', () => {
    const c = one({ _Emissive: 'X/T_Ceiling_CA' });
    expect([c.maps.emissive, c.params.emissive.mode]).toEqual([undefined, 'baseColor']);
    const n = one({ __NormalEmissiveAO: 'X/T_Metal_Linear_N' });
    expect([n.maps.emissive, n.params.emissive.mode]).toEqual([undefined, 'baseColor']);
  });
});

describe('blink', () => {
  it('reads BlinkLength01 as on and BlinkLength02 as off', () => {
    const x = recipeOf({ mesh: 'm', materials: [{ shader: 'X/SS_PropsPreset', textures: { _BaseColor: 'X/T_A_C', _Normal: 'X/T_A_N' }, vectors: { EmissiveIntensity: [20, 0, 0, 1], BlinkLength01: [2, 0, 0, 1], BlinkLength02: [1.6, 0, 0, 1] }, conditionals: {} }] }, 0);
    expect(x.params.emissive.blink).toBe(2);
    expect(x.params.emissive.blinkOff).toBeCloseTo(1.6, 6);
    expect(x._source['params.emissive.blinkOff']).toBe('materials.jsonl:m#0.BlinkLength02');
  });
});

describe('crew recipes', () => {
  // a crew GLB's materials as scripts/bf2017-import.mjs writes them: the
  // game's material names, each colour image named after its game texture
  const glb = {
    materials: [
      { name: 'M_Iden_Body', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
      { name: 'M_Iden_Strap', pbrMetallicRoughness: { baseColorTexture: { index: 1 } } },
      { name: 'M_Plain' },
    ],
    textures: [{ source: 0 }, { extensions: { KHR_texture_basisu: { source: 1 } } }],
    images: [{ name: 't_iden_act3_01_cs.ktx2' }, { name: 'ktx2:web/textures/x/t_unknown_cs.ktx2' }],
  };

  it('finds each material its row by the colour map it wears', () => {
    const index = colourIndex([row('character'), row('props')]);
    const out = crewRecipes(glb, index);
    expect(Object.keys(out)).toEqual(['M_Iden_Body']);
    expect(out.M_Iden_Body.family).toBe('character');
    expect(out.M_Iden_Body.maps.detailArray).toBe('Characters/DetailMaps/TA_CharacterDetail_17_NS');
    expect(out.M_Iden_Body._source['maps.aoSlice']).toBe('materials.jsonl:a3/characters/hero/iden/act3/iden_act3_01/iden_act3_01_mesh#0.AOSlice');
  });

  it('finds a head by its Color slot and hair by its HairColorTexture', () => {
    const index = colourIndex([row('head'), row('hair')]);
    const g = (name) => ({ materials: [{ name: 'M', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }], textures: [{ source: 0 }], images: [{ name }] });
    expect(crewRecipes(g('t_heads_luke_01_c.ktx2'), index).M.family).toBe('head');
    expect(crewRecipes(g('t_haskhaircap_c.ktx2'), index).M.family).toBe('hair');
  });

  it('reads a full path in the image name as well as a bare file name', () => {
    const index = colourIndex([row('props')]);
    const g = { materials: [{ name: 'M', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }], textures: [{ source: 0 }], images: [{ name: 'ktx2:web/textures/objects/props/objectsets/_generic/catwalksystem_01/t_catwalksystem_imperial_04_cs.ktx2' }] };
    expect(crewRecipes(g, index).M.family).toBe('propsNonMetallic');
  });
});
