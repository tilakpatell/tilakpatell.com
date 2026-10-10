// The game's surface shader on the node renderer (lane Q1:
// docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md, "Q1"): a
// MeshPhysicalNodeMaterial built as TSL from a recipe (scripts/lib/
// bf2017-recipes.mjs) over the GLB's own three maps. On top of them, as the
// tier allows: the tiling detail normal (UDN-blended in tangent space), the
// breakup, grunge, scorch, wear and AO-dirt overlays, the paint and metal
// colours, emissive colour × intensity (and its blink), parallax occlusion,
// the reflectance by orientation, vegetation's back-lit translucency, the
// cut-out and the sides; then the overlay hook (compose.js) lanes Q2 and Q4
// fill.
//
//   createGameMaterial(recipe, maps, { tier, overlays = [], three, sun }) → material
//     maps: { glb (the GLB's material: its colour, normal, ORM and factors),
//       detail (the detail normal, or the array's slice), grunge,
//       breakupColor, breakupNormal, scorch, height, wear, weathering,
//       emissive, mask } as textures or null
//     three: loadThree()'s { THREE, tsl } (../light/three.js), so nothing
//       here imports three at module scope
//     sun: createSunUniforms(three, …) to share one a level moves, or a plain
//       { direction: [x, y, z] toward the sun, color: [r, g, b] } (else
//       straight up and white); material.userData.game.sun holds it
//     physical: a MeshPhysicalNodeMaterial whatever the features (a head's)
//   loadGameMaterial() → Promise<(recipe, maps, opts) => material> with three loaded
//
// material.userData.game = { family, features: [...], parallaxSteps } says what
// was wired, for the evidence and the tests. Tiers: ultra everything
// (parallax 16 steps); high everything, parallax 8 steps (the detail a mip
// under comes from the pack's sizes); mid the detail and the emissive; low
// the GLB as it is.

import { loadThree } from '../light/three.js';
import { composeOverlays, overlayName } from './compose.js';
import { AOSLICE_LEVELS, EMISSIVE_EXPOSURE, EMISSIVE_MAX, METAL_CHANNEL, PAINT_CHANNEL, PARALLAX_STEPS } from './families.js';

// ---- the site's weights where the recipe has a switch and no number

// The export's rebuilt detail normal has no smoothness channel; the share of
// SmoothnessDetail_Intensity applied evenly until the desktop's raw maps land
export const DETAIL_SMOOTHNESS_WEIGHT = 0.25;
// a breakup map's neutral grey (an overlay colour multiplies by rgb / 0.5)
export const BREAKUP_NEUTRAL = 0.5;
// GrungeIntensity reaches 3 on the large vehicles: the mask's weight per unit
export const GRUNGE_WEIGHT = 0.25;
// grunge roughens what it covers by this much at full mask
export const GRUNGE_ROUGHNESS = 0.35;
// the embers sit in the scorch mask's deepest part: its value to this power
export const EMBER_POWER = 4;
// an ember's colour (a hot coal, the presets' ScorchEmberColor is not in the dump)
export const EMBER_COLOR = [1, 0.35, 0.08];
// worn edges go to bare metal this smooth
export const WEAR_ROUGHNESS = 0.3;
// Reflectance to F0 (Lagarde and de Rousiers 2014, "Moving Frostbite to
// PBR": f0 = 0.16 × reflectance²); three's specularIntensity multiplies its
// own F0 of 0.04, so the factor is 0.16 / 0.04 = 4 × reflectance²
export const REFLECTANCE_TO_SPECULAR = 4;
// the share of the sun a leaf passes through at SubsurfaceBackfaceScale 1
export const TRANSLUCENCY_WEIGHT = 0.25;

// the most slices a detail array is sampled at (the characters' have 3)
export const MAX_SLICES = 4;

const ON_MID = new Set(['detail', 'detailArray', 'emissive']);
// the recipe maps each tier draws, for the loader to fetch no more (low: none)
export const TIER_MAPS = {
  low: [],
  mid: ['detail', 'aoSlice', 'emissive'],
  high: null,
  ultra: null,
};

export async function loadGameMaterial() {
  const three = await loadThree();
  return (recipe, maps, opts = {}) => createGameMaterial(recipe, maps, { ...opts, three });
}

// the GLB's material as a node material of the same look (the low tier, and
// the base every feature starts from)
export function fromGlb(THREE, glb, physical) {
  const m = physical ? new THREE.MeshPhysicalNodeMaterial() : new THREE.MeshStandardNodeMaterial();
  if (!glb) return m;
  for (const k of [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'emissiveMap',
    'alphaMap',
    'roughness',
    'metalness',
    'aoMapIntensity',
    'emissiveIntensity',
    'opacity',
    'transparent',
    'alphaTest',
    'side',
    'vertexColors',
    'flatShading',
    'name',
    'depthWrite',
    'depthTest',
    'blending',
    'polygonOffset',
    'polygonOffsetFactor',
    'polygonOffsetUnits',
    'alphaToCoverage',
  ]) {
    if (glb[k] !== undefined) m[k] = glb[k];
  }
  m.color.copy(glb.color);
  m.emissive.copy(glb.emissive);
  if (glb.normalScale) m.normalScale.copy(glb.normalScale);
  m.userData = { ...glb.userData };
  return m;
}

// A blink period past this many seconds is a steady light: BlinkLength runs
// 0.1–16 s across the dump, and the few at 1,000 to 1,000,000 are the
// artists' "never" (Hoth's catwalk box has 1,000)
export const BLINK_MAX = 60;

// The sun a material's translucency and lobes are lit by, as uniforms one
// level can share and move: set(direction, color) with the direction toward
// the sun. A plain { direction, color } given to a material makes its own.
export function createSunUniforms(three, { direction = [0, 1, 0], color = [1, 1, 1] } = {}) {
  const { THREE, tsl } = three;
  const sun = {
    isSunUniforms: true,
    direction: tsl.uniform(new THREE.Vector3(...direction).normalize()),
    color: tsl.uniform(new THREE.Color(...color)),
    set(dir, col) {
      if (dir) sun.direction.value.set(...dir).normalize();
      if (col) sun.color.value.setRGB(...col);
    },
  };
  return sun;
}

export function createGameMaterial(recipe, maps = {}, { tier = 'high', overlays = [], three, sun = null, physical = false } = {}) {
  const { THREE, tsl } = three;
  const p = recipe?.params ?? {};
  const glb = maps.glb ?? null;
  const features = [];
  const game = { family: recipe?.family ?? 'glb', features, parallaxSteps: 0, blink: null };
  if (tier === 'low' || !recipe || recipe.family === 'glb') {
    const m = fromGlb(THREE, glb, false);
    m.userData.game = game;
    return m;
  }
  const allow = (f) => tier !== 'mid' || ON_MID.has(f);
  const want = (f, ok) => ok && allow(f) && (features.push(f), true);
  const { texture, uv, vec2, vec3, vec4, float, mix, max, dot, normalize, normalMap, normalWorld, positionWorld, positionViewDirection, saturate, step, fract, time, pow, Fn, Loop, If, parallaxDirection } = tsl;

  // (a tiling map repeats: the pack's KTX2 loads clamped, and the detail
  // tiles 20 times over a vehicle's panel)
  for (const t of [...['detail', 'grunge', 'breakupColor', 'breakupNormal', 'scorch'].map((k) => maps[k]), ...(maps.detailSlices ?? [])]) {
    if (t && (t.wrapS !== THREE.RepeatWrapping || t.wrapT !== THREE.RepeatWrapping)) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
    }
  }
  // (physical only where a physical feature asks: the reflectance's
  // specularIntensity, or a caller's own, as a head's)
  const m = fromGlb(THREE, glb, physical || (!!p.reflectance && allow('reflectance')));
  m.userData.game = game;
  const uvSet = p.uvSet === 1 ? 1 : 0;
  let uv0 = uv(glb?.map?.channel ?? 0);

  // parallax occlusion over the height map: the view ray stepped in tangent
  // space until it meets the surface (8 or 16 layers by tier)
  const steps = PARALLAX_STEPS[tier] ?? 0;
  if (steps && want('parallax', !!(maps.height && p.parallax?.on))) {
    game.parallaxSteps = steps;
    const scale = float(p.parallax.scale);
    const height = maps.height;
    const base = uv0;
    uv0 = Fn(() => {
      const layer = float(1 / steps);
      const dir = parallaxDirection;
      const delta = dir.xy
        .div(max(dir.z.abs(), float(0.05)))
        .mul(scale)
        .div(steps);
      const at = vec2(base).toVar();
      const depth = float(0).toVar();
      const h = texture(height, at).r.oneMinus().toVar();
      Loop(steps, () => {
        If(depth.lessThan(h), () => {
          at.subAssign(delta);
          depth.addAssign(layer);
          h.assign(texture(height, at).r.oneMinus());
        });
      });
      return at;
    })();
  }
  const uvD = uv(uvSet);

  // ---- the base: the GLB's three maps and factors, at the (parallax) uv
  const map = glb?.map ? texture(glb.map, uv0) : null;
  let color = (map ? map.rgb : vec3(1)).mul(vec3(m.color.r, m.color.g, m.color.b));
  // (the map's alpha only: the material multiplies its own opacity after)
  const alpha = map ? map.a : float(1);
  game.alphaFromMap = true;
  let roughness = glb?.roughnessMap ? texture(glb.roughnessMap, uv0).g.mul(float(m.roughness)) : float(m.roughness);
  let metalness = glb?.metalnessMap ? texture(glb.metalnessMap, uv0).b.mul(float(m.metalness)) : float(m.metalness);
  const ao = glb?.aoMap ? texture(glb.aoMap, uv(glb.aoMap.channel ?? 0)).r : float(1);
  let emissive = vec3(m.emissive.r, m.emissive.g, m.emissive.b).mul(float(m.emissiveIntensity ?? 1));
  if (glb?.emissiveMap) emissive = emissive.mul(texture(glb.emissiveMap, uv0).rgb);
  // the tangent-space normal, before normalMap's transform
  // (scaled by the GLB's normalScale here, as three scales only the base,
  // so the detail and the overlays keep their own weights)
  let tn = vec3(0, 0, 1);
  if (glb?.normalMap) {
    const n = texture(glb.normalMap, uv0).xyz.mul(2).sub(1);
    tn = vec3(n.xy.mul(vec2(m.normalScale.x, m.normalScale.y)), n.z);
    game.normalScaled = [m.normalScale.x, m.normalScale.y];
  }
  let tangentDirty = false;
  // UDN: the detail's xy added to the base's at its weight, z kept
  const udn = (n, d, s) => normalize(vec3(n.xy.add(d.xy.mul(s)), n.z));

  // ---- the detail normal: a detail array's every slice, each texel the one
  // AOSlice's green names (four levels: three slices and none), each at its
  // own tiling and weight; else one detail map
  const detailKind = recipe.maps?.detailArray ? 'detailArray' : 'detail';
  const slices = (maps.detailSlices ?? []).filter(Boolean).slice(0, MAX_SLICES);
  const perTexel = slices.length && maps.aoSlice && recipe.maps?.detailSlice === 'aoSlice';
  if (perTexel && want(detailKind, !!p.detail)) {
    const per = p.detail.perSlice ?? {};
    const level = texture(maps.aoSlice, uv0).g;
    // (the level's index: a step at each midpoint between AOSLICE_LEVELS)
    let k = float(0);
    for (let j = 1; j < AOSLICE_LEVELS.length; j++) k = k.add(step(float((AOSLICE_LEVELS[j - 1] + AOSLICE_LEVELS[j]) / 2), level));
    let xy = vec2(0, 0);
    let smooth = float(0);
    slices.forEach((t, i) => {
      const w = saturate(float(1).sub(k.sub(i).abs()));
      const tile = per.tiling?.[i] || p.detail.tiling?.[0] || 1;
      const s = (per.normal?.[i] ?? p.detail.normal ?? 1) * (p.detail.strength ?? 1);
      const d = texture(t, uvD.mul(vec2(tile, tile))).xy.mul(2).sub(1);
      xy = xy.add(d.mul(w.mul(s)));
      smooth = smooth.add(w.mul((per.smoothness?.[i] ?? p.detail.smoothness ?? 0) * (p.detail.strength ?? 1)));
    });
    tn = normalize(vec3(tn.xy.add(xy), tn.z));
    tangentDirty = true;
    roughness = roughness.mul(float(1).sub(saturate(smooth.mul(DETAIL_SMOOTHNESS_WEIGHT))));
    game.slices = slices.length;
  } else if (want(detailKind, !!(maps.detail ?? slices[0]) && !!p.detail)) {
    maps = { ...maps, detail: maps.detail ?? slices[0] };
    game.slices = 1;
    const [tu, tv] = p.detail.tiling ?? [1, 1];
    const d = texture(maps.detail, uvD.mul(vec2(tu, tv)))
      .xyz.mul(2)
      .sub(1);
    tn = udn(tn, d, float((p.detail.normal ?? 1) * (p.detail.strength ?? 1)));
    tangentDirty = true;
    const smooth = (p.detail.smoothness ?? 0) * (p.detail.strength ?? 1) * DETAIL_SMOOTHNESS_WEIGHT;
    if (smooth) roughness = roughness.mul(float(1 - Math.min(1, smooth)));
  }

  // ---- overlays, in the game's order: breakup, grunge, scorch, wear, AO dirt
  const tiled = (t, tiling = [1, 1]) => texture(t, uv0.mul(vec2(tiling[0], tiling[1] || tiling[0])));
  if (want('breakup', !!(maps.breakupColor || maps.breakupNormal))) {
    if (maps.breakupColor) color = color.mul(tiled(maps.breakupColor, p.breakup?.tiling).rgb.div(BREAKUP_NEUTRAL));
    if (maps.breakupNormal) {
      tn = udn(tn, tiled(maps.breakupNormal, p.breakup?.tiling).xyz.mul(2).sub(1), float(1));
      tangentDirty = true;
    }
  }
  // the grunge: a mask for its colour, or (a normal in the slot) its dents
  if (want('grunge', !!(maps.grunge && p.grunge))) {
    const g = tiled(maps.grunge, p.grunge.tiling);
    const weight = (p.grunge.intensity ?? 1) * GRUNGE_WEIGHT;
    if (p.grunge.normal) {
      tn = udn(tn, g.xyz.mul(2).sub(1), float(weight));
      tangentDirty = true;
    } else {
      const k = saturate(g.r.mul(weight));
      const [r, gg, b] = p.grunge.color ?? [1, 1, 1];
      color = mix(color, color.mul(vec3(r, gg, b)), k);
      roughness = mix(roughness, float(1), k.mul(GRUNGE_ROUGHNESS));
    }
  }
  // the scorch to black, and on a wreck its embers to emissive
  if (want('scorch', !!maps.scorch)) {
    const s = saturate(tiled(maps.scorch, p.scorch?.tiling).r);
    color = mix(color, vec3(0), s);
    roughness = mix(roughness, float(1), s);
    if (p.wreck && p.scorch?.ember) {
      const k = Math.min(p.scorch.ember * EMISSIVE_EXPOSURE, EMISSIVE_MAX);
      emissive = emissive.add(vec3(...EMBER_COLOR).mul(pow(s, float(EMBER_POWER)).mul(k)));
    }
  }
  if (want('wear', !!maps.wear)) {
    const w = texture(maps.wear, uv0).r;
    metalness = max(metalness, w);
    roughness = mix(roughness, float(WEAR_ROUGHNESS), w);
  }
  if (want('aoDirt', !!(p.aoDirt && glb?.aoMap))) {
    color = mix(color, color.mul(vec3(...p.aoDirt)), ao.oneMinus());
  }

  // ---- colours: paint and metal on their masks (else metal where metallic)
  const hasPaint = want('paint', !!p.paint);
  const hasMetal = want('metal', !!p.metal);
  if (hasPaint || hasMetal) {
    const paint = vec3(...(p.paint ?? [1, 1, 1]));
    const metal = vec3(...(p.metal ?? [1, 1, 1]));
    if (maps.mask) {
      const mk = texture(maps.mask, uv0);
      color = color.mul(mix(vec3(1), paint, mk[PAINT_CHANNEL])).mul(mix(vec3(1), metal, mk[METAL_CHANNEL]));
    } else color = color.mul(mix(paint, metal, saturate(metalness)));
  }
  if (want('tint', !!p.tint)) color = color.mul(vec3(...p.tint));

  // ---- emissive: texture, one channel or the base colour, × colour × intensity
  const e = p.emissive;
  const emissiveSrc = e?.mode === 'texture' || e?.mode === 'mask' ? maps.emissive : e ? 'base' : null;
  if (want('emissive', !!(emissiveSrc || (p.wreck && p.scorch?.ember && features.includes('scorch'))))) {
    if (emissiveSrc) {
      const k = Math.min((e.intensity ?? 1) * EMISSIVE_EXPOSURE, EMISSIVE_MAX);
      const src = emissiveSrc === 'base' ? color : e.mode === 'mask' ? vec3(texture(maps.emissive, uv0).r) : texture(maps.emissive, uv0).rgb;
      let glow = src.mul(vec3(...(e.color ?? [1, 1, 1]))).mul(k);
      // BlinkLength01 seconds on, BlinkLength02 off (01 again without it)
      const on = e.blink ?? 0;
      const off = e.blinkOff ?? on;
      if (on > 0 && on <= BLINK_MAX && off <= BLINK_MAX) {
        game.blink = { on, off };
        const period = on + off;
        glow = glow.mul(step(fract(time.div(period)).mul(period), float(on)));
      }
      emissive = emissive.add(glow);
    }
  }

  // ---- reflectance by the world normal's y
  if (want('reflectance', !!p.reflectance)) {
    const up = REFLECTANCE_TO_SPECULAR * (p.reflectance.up ?? p.reflectance.down) ** 2;
    const down = REFLECTANCE_TO_SPECULAR * (p.reflectance.down ?? p.reflectance.up) ** 2;
    m.specularIntensityNode = mix(float(down), float(up), normalWorld.y.mul(0.5).add(0.5));
  }

  // ---- vegetation: the sun through the leaf (a wrapped back-lit term)
  game.sun = sun?.isSunUniforms ? sun : createSunUniforms(three, sun ?? {});
  const { direction: sunDir, color: sunColor } = game.sun;
  if (want('translucency', !!p.backface?.subsurface)) {
    const back = saturate(dot(normalWorld.negate(), sunDir).mul(0.5).add(0.5));
    emissive = emissive.add(color.mul(sunColor).mul(back.mul(p.backface.subsurface * TRANSLUCENCY_WEIGHT)));
  }
  if (want('alphaTest', !!p.alphaTest)) m.alphaTest = p.alphaCutoff ?? 0.5;
  if (want('doubleSided', !!p.doubleSided)) m.side = THREE.DoubleSide;
  if (recipe.maps?.weathering) want('weathering', !!maps.weathering);

  // ---- the hook
  const scaleN = vec2(m.normalScale.x, m.normalScale.y);
  const baseNormal = tangentDirty ? normalMap(tn.mul(0.5).add(0.5)) : glb?.normalMap ? normalMap(texture(glb.normalMap, uv0), scaleN) : tsl.normalView;
  let normal = baseNormal;
  if (overlays.length) {
    const ctx = {
      uv: uv0,
      uv1: uv(1),
      worldNormal: normalWorld,
      worldPosition: positionWorld,
      viewDir: positionViewDirection,
      // (1 until lane Q3's sky visibility lands)
      skyVisibility: float(1),
      params: p,
      maps: { ...maps, weathering: maps.weathering ? texture(maps.weathering, uv0) : null },
    };
    const out = composeOverlays({ color, roughness, metalness, normal, emissive }, overlays, ctx);
    ({ color, roughness, metalness, normal, emissive } = out);
    for (const o of overlays) features.push(`overlay:${overlayName(o)}`);
  }

  if (!features.length) {
    // (nothing the tier draws: the GLB's look, as a node material)
    return m;
  }
  m.colorNode = vec4(color, alpha);
  m.roughnessNode = roughness;
  m.metalnessNode = metalness;
  // (an untouched normal at the plain uv is the material's own normalMap)
  if (normal !== baseNormal || tangentDirty || game.parallaxSteps) m.normalNode = normal;
  m.emissiveNode = emissive;
  if (glb?.aoMap) m.aoNode = mix(float(1), ao, float(m.aoMapIntensity ?? 1));
  return m;
}
