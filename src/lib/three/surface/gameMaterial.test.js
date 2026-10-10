import { beforeAll, describe, expect, it } from 'vitest';
import { loadThree } from '../light/three.js';
import { createGameMaterial } from './gameMaterial.js';

// recipes as scripts/lib/bf2017-recipes.mjs writes them for the five
// fixture rows (scripts/fixtures/bf2017/materials/), trimmed to what the
// material reads
const PROPS = {
  family: 'propsNonMetallic',
  maps: { detail: 'T_MetalDetail_02_NS' },
  params: { detail: { tiling: [2, 2], normal: 1, smoothness: 0, strength: 1 }, uvSet: 0, alphaTest: false, doubleSided: false },
};
const VEHICLE = {
  family: 'vehicleLarge',
  maps: { detail: 'T_StarDestroyer_MetalBare_01_NW', grunge: 'T_MetalGrunge_01_N', mask: 'T_SmallCanon_01_M01', tintSwatch: 'T_ColorChart' },
  params: {
    detail: { tiling: [20, 20], normal: 1, smoothness: 0, strength: 1 },
    uvSet: 0,
    paint: [1, 1, 1],
    metal: [0.6, 0.6, 0.6],
    grunge: { color: [1, 1, 1], intensity: 1, tiling: [1, 1], normal: true },
    scorch: { ember: 1000 },
    breakup: { tiling: [40, 40] },
    wreck: true,
    alphaTest: false,
    doubleSided: false,
  },
};
const CHARACTER = {
  family: 'character',
  maps: { detailArray: 'TA_CharacterDetail_17_NS', detailSlice: 'median', aoSlice: 'T_AOSL', weathering: 'T_W' },
  params: { detail: { tiling: [13, 13], normal: 1, smoothness: 0.5, strength: 1, perSlice: { tiling: [13, 24, 12] } }, uvSet: 0, alphaTest: false, doubleSided: false },
};
const VEGETATION = {
  family: 'vegetation',
  maps: { mask: 'T_FlowersMask' },
  params: { backface: { subsurface: 2, smoothness: 0.8 }, reflectance: { up: 0.3, down: 0.3 }, alphaTest: true, alphaCutoff: 0.5, doubleSided: true },
};
const EMISSIVE = {
  family: 'emissive',
  maps: {},
  params: { emissive: { intensity: 333209.96875, color: [0.38, 0.75, 1], mode: 'baseColor' }, alphaTest: true, alphaCutoff: 0.5, doubleSided: false },
};
const GLB = { family: 'glb', maps: {}, params: {} };

let three;
let tex;
let glb;
beforeAll(async () => {
  three = await loadThree();
  const { THREE } = three;
  tex = () => new THREE.Texture();
  glb = () => new THREE.MeshStandardMaterial({ map: tex(), normalMap: tex(), roughnessMap: tex(), metalnessMap: tex(), color: 0xff8800, roughness: 0.6 });
});

const make = (recipe, extra = {}, opts = {}) => {
  const maps = { glb: glb() };
  for (const k of Object.keys(recipe.maps)) if (k !== 'detailSlice') maps[k === 'detailArray' ? 'detail' : k] = tex();
  return createGameMaterial(recipe, { ...maps, ...extra }, { tier: 'ultra', three, ...opts });
};
const features = (m) => [...m.userData.game.features].sort();

describe('createGameMaterial', () => {
  it('low tier draws the GLB as it is: no features, its maps and factors', () => {
    for (const r of [PROPS, VEHICLE, CHARACTER, VEGETATION, EMISSIVE]) {
      const g = glb();
      const m = createGameMaterial(r, { glb: g, detail: tex() }, { tier: 'low', three });
      expect(m.userData.game.features).toEqual([]);
      expect(m.isNodeMaterial).toBe(true);
      expect(m.map).toBe(g.map);
      expect(m.normalMap).toBe(g.normalMap);
      expect(m.color.getHex()).toBe(0xff8800);
      expect(m.roughness).toBe(0.6);
      expect(m.colorNode).toBeNull();
    }
  });

  it('ultra: each fixture recipe turns on its features', () => {
    expect(features(make(PROPS))).toEqual(['detail']);
    // (its grunge slot holds a normal map, and it has no ScorchMask: no scorch, no embers)
    expect(features(make(VEHICLE))).toEqual(['detail', 'grunge', 'metal', 'paint']);
    expect(features(make({ ...VEHICLE, maps: { ...VEHICLE.maps, scorch: 'T_Scorch' } }))).toEqual(['detail', 'emissive', 'grunge', 'metal', 'paint', 'scorch']);
    expect(features(make(CHARACTER))).toEqual(['detailArray', 'weathering']);
    expect(features(make(VEGETATION))).toEqual(['alphaTest', 'doubleSided', 'reflectance', 'translucency']);
    expect(features(make(EMISSIVE))).toEqual(['alphaTest', 'emissive']);
    expect(features(make(GLB))).toEqual([]);
  });

  it('mid draws the detail and the emissive only', () => {
    // (a wreck's embers are its scorch's, which mid leaves out)
    expect(features(make(VEHICLE, {}, { tier: 'mid' }))).toEqual(['detail']);
    expect(features(make(EMISSIVE, {}, { tier: 'mid' }))).toEqual(['emissive']);
    expect(features(make(VEGETATION, {}, { tier: 'mid' }))).toEqual([]);
  });

  it('keeps a blended GLB material blended: depth, blending and offsets, at every tier', () => {
    const { THREE } = three;
    for (const tier of ['low', 'ultra']) {
      const g = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -2, blending: THREE.AdditiveBlending });
      const m = createGameMaterial(PROPS, { glb: g, detail: tex() }, { tier, three });
      expect([m.transparent, m.depthWrite, m.opacity, m.polygonOffset, m.polygonOffsetFactor, m.blending]).toEqual([true, false, 0.5, true, -2, THREE.AdditiveBlending]);
    }
  });

  it('applies opacity once (the material multiplies its own)', () => {
    const m = make(PROPS);
    expect(m.opacityNode).toBeNull();
    expect(m.userData.game.alphaFromMap).toBe(true);
  });

  it('a tiled map repeats', () => {
    const { THREE } = three;
    const detail = tex();
    const grunge = tex();
    make(VEHICLE, { detail, grunge });
    for (const t of [detail, grunge]) expect([t.wrapS, t.wrapT]).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping]);
  });

  it('a map the pack has not got is left out, not drawn', () => {
    expect(features(make(PROPS, { detail: null }))).toEqual([]);
  });

  it('sets the cut-out and the sides the recipe says', () => {
    const { THREE } = three;
    const leaf = make(VEGETATION);
    expect(leaf.side).toBe(THREE.DoubleSide);
    expect(leaf.alphaTest).toBe(0.5);
    expect(leaf.specularIntensityNode).toBeTruthy();
  });

  it('wires the detail into the normal and the emissive into its node', () => {
    const m = make(VEHICLE);
    expect(m.normalNode).toBeTruthy();
    expect(m.colorNode).toBeTruthy();
    expect(m.emissiveNode).toBeTruthy();
    expect(make(EMISSIVE).emissiveNode).toBeTruthy();
  });

  it('parallax by tier: 16 steps on ultra, 8 on high, none below', () => {
    const r = { family: 'props', maps: { height: 'T_H' }, params: { parallax: { on: true, scale: 0.02 }, alphaTest: false, doubleSided: false } };
    expect(make(r).userData.game.parallaxSteps).toBe(16);
    expect(make(r, {}, { tier: 'high' }).userData.game.parallaxSteps).toBe(8);
    expect(features(make(r, {}, { tier: 'mid' }))).toEqual([]);
    expect(features(make({ ...r, params: { ...r.params, parallax: { on: false, scale: 0.02 } } }))).toEqual([]);
  });

  it('runs the overlays in order with the hook context, and lists them', () => {
    const seen = [];
    function snowOverlay(ctx) {
      seen.push(ctx);
      return { roughness: ctx.roughness };
    }
    const terrain = Object.assign((ctx) => (seen.push(ctx), { color: ctx.color }), { overlayName: 'terrainBlend' });
    const m = make(PROPS, {}, { overlays: [snowOverlay, terrain] });
    expect(features(m)).toEqual(['detail', 'overlay:snowOverlay', 'overlay:terrainBlend']);
    expect(seen).toHaveLength(2);
    for (const k of ['uv', 'uv1', 'worldNormal', 'worldPosition', 'viewDir', 'skyVisibility', 'params', 'maps', 'color', 'roughness', 'metalness', 'normal', 'emissive']) expect(seen[0][k], k).toBeTruthy();
    expect(seen[0].params).toBe(PROPS.params);
    // (low draws the GLB: no overlay runs)
    seen.length = 0;
    make(PROPS, {}, { tier: 'low', overlays: [snowOverlay] });
    expect(seen).toHaveLength(0);
  });
});
