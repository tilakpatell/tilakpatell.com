import { beforeAll, describe, expect, it } from 'vitest';
import { loadThree } from '../light/three.js';
import { createGameMaterial, createSunUniforms } from './gameMaterial.js';

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

  it('is a physical material only where a physical feature asks (reflectance)', () => {
    const plain = make(PROPS);
    expect(plain.isMeshStandardNodeMaterial).toBe(true);
    expect(plain.isMeshPhysicalNodeMaterial).toBeFalsy();
    expect(make(VEGETATION).isMeshPhysicalNodeMaterial).toBe(true);
  });

  it('scales the GLB normal by its normalScale before the detail, not the blend after', () => {
    const { THREE } = three;
    const g = glb();
    g.normalScale = new THREE.Vector2(2, 2);
    const m = createGameMaterial(PROPS, { glb: g, detail: tex() }, { tier: 'ultra', three });
    expect(m.normalNode.scaleNode).toBeNull();
    expect(m.userData.game.normalScaled).toEqual([2, 2]);
  });

  it('shares one sun between materials when given its uniforms', () => {
    const sun = createSunUniforms(three, { direction: [0, 0, 1], color: [1, 0.5, 0] });
    const a = make(VEGETATION, {}, { sun });
    const b = make(PROPS, {}, { sun });
    expect(a.userData.game.sun).toBe(sun);
    expect(b.userData.game.sun).toBe(sun);
    sun.set([1, 0, 0], [1, 1, 1]);
    expect(sun.direction.value.toArray()).toEqual([1, 0, 0]);
    // (a plain { direction, color } still makes its own)
    expect(make(VEGETATION, {}, { sun: { direction: [0, 1, 0] } }).userData.game.sun).not.toBe(sun);
  });

  it('blinks on for BlinkLength01 and off for BlinkLength02 seconds; a period past a minute is a steady light', () => {
    const lamp = (blink, blinkOff) => make({ ...EMISSIVE, params: { ...EMISSIVE.params, emissive: { ...EMISSIVE.params.emissive, blink, blinkOff } } });
    expect(lamp(2, 1.6).userData.game.blink).toEqual({ on: 2, off: 1.6 });
    expect(lamp(2).userData.game.blink).toEqual({ on: 2, off: 2 });
    expect(lamp(1000).userData.game.blink).toBeNull();
    expect(lamp(0).userData.game.blink).toBeNull();
  });

  it('a character samples every slice of its array, each texel the one AOSlice names', () => {
    const r = { ...CHARACTER, maps: { ...CHARACTER.maps, detailSlice: 'aoSlice' }, params: { ...CHARACTER.params, detail: { ...CHARACTER.params.detail, perSlice: { tiling: [13, 24, 12, 0], normal: [1, 1, 1.5, 0], smoothness: [0.5, 2, 0.5, 0] } } } };
    const slices = [tex(), tex(), tex()];
    const m = createGameMaterial(r, { glb: glb(), detailSlices: slices, aoSlice: tex(), weathering: tex() }, { tier: 'ultra', three });
    expect(features(m)).toEqual(['detailArray', 'weathering']);
    expect(m.userData.game.slices).toBe(3);
    expect(m.normalNode).toBeTruthy();
    // (every slice tiles)
    for (const t of slices) expect(t.wrapS).toBe(three.THREE.RepeatWrapping);
    // (without the AOSlice map: the first slice alone)
    const one = createGameMaterial(r, { glb: glb(), detailSlices: slices, aoSlice: null }, { tier: 'ultra', three });
    expect(one.userData.game.slices).toBe(1);
    expect(features(one)).toContain('detailArray');
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

  // ---- lane colour: a mesh's variation (variations.json) over its recipe
  it('a recipe without a variation draws exactly as before', () => {
    const plain = make(PROPS);
    const same = make({ ...PROPS, variation: undefined });
    // (each makes its own sun uniforms)
    const bare = (m) => ({ ...m.userData.game, sun: undefined });
    expect(bare(same)).toEqual(bare(plain));
    expect(features(same)).toEqual(features(plain));
  });

  it("tints by the variation's paint colour, through the recipe's parameter names", () => {
    expect(features(make(PROPS))).not.toContain('paint');
    const m = make({ ...PROPS, variation: { name: 'Box_White', vectors: { PaintColour: [1, 1, 1, 1] } } });
    expect(features(m)).toContain('paint');
    expect(m.userData.game.variation).toBe('Box_White');
  });

  it('lights a lit variation: its colour-typed intensity as the emissive', () => {
    const recipe = { family: 'emissive', maps: {}, params: { alphaTest: true, alphaCutoff: 0.5, doubleSided: false } };
    expect(features(make(recipe))).not.toContain('emissive');
    expect(features(make({ ...recipe, variation: { name: 'LightCeiling_M_01_Lit', vectors: { EmissiveIntensety: [3813.773, 4442.85, 6144, 1] } } }))).toContain('emissive');
  });

  it('draws a variation’s own colour and normal maps in place of the GLB’s', () => {
    const color = tex();
    const normal = tex();
    const m = make({ ...PROPS, variation: { name: 'Container_L_01_Red' } }, { color, normal });
    expect(m.map).toBe(color);
    expect(m.normalMap).toBe(normal);
    // (the GLB's own material is not changed)
    const plain = make(PROPS);
    expect(plain.map).not.toBe(color);
  });

  it('snows a snow variation from the start: the snow overlay at its whole amount', () => {
    const m = make({ ...PROPS, variation: { name: 'Box_M_01_A_Snow', snow: true } });
    expect(features(m)).toContain('overlay:snow');
    expect(m.userData.game.snow).toBe(true);
    expect(make(PROPS).userData.game.snow).toBeUndefined();
  });
});

