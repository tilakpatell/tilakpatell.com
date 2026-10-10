// Hair and heads for the game material (lane Q1:
// docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md, "Hair and
// heads"). Hair: the base colour from the record's melanin (MelaninXY:
// eumelanin, pheomelanin) times the GLB's colour, the tip tinted along v
// (TintTipColor past TintTipColorMin), and two Kajiya-Kay lobes along the
// strand (HairStrandTexture's flow in rg, else the UVs' v) lit by the sun,
// added to the emissive. Heads: the RSSSAO map's scattering mask as a
// wrapped diffuse (until lane V's SSS pass, which takes the mask instead)
// and its red as the reflectance.
//
//   melaninColor(eumelanin, pheomelanin) → [r, g, b]   (pure)
//   tipWeight(v, min, max) → 0…1                         (pure)
//   hairMaterial(recipe, maps, { tier, three, sun }) → material
//   headMaterial(recipe, maps, { tier, three, sun }) → material
// (maps: { glb, hairStrand } or { glb, sss }; three: loadThree()'s; sun as
// gameMaterial.js takes it. Low draws the GLB as it is.)

import { loadThree } from '../light/three.js';
import { createGameMaterial, fromGlb, REFLECTANCE_TO_SPECULAR } from './gameMaterial.js';

// Melanin's absorption per unit concentration (Chiang, Bitterli, Tappan and
// Burley 2016, "A Practical and Controllable Hair and Fur Model for
// Production Path Tracing", eq. 9's coefficients)
export const EUMELANIN = [0.419, 0.697, 1.37];
export const PHEOMELANIN = [0.187, 0.4, 1.05];
// MelaninXY 1 as a concentration (the top of Chiang's 0–8 range)
export const MELANIN_MAX = 8;
// the path through a strand the colour is read at (one radius of a unit fibre)
export const MELANIN_PATH = 0.5;
// Kajiya-Kay: the lobes' shifts along the normal and the secondary's share
// of the primary's exponent (Scheuermann 2004, "Hair Rendering and Shading")
export const PRIMARY_SHIFT = 0.1;
export const SECONDARY_SHIFT = -0.1;
export const SECONDARY_SHARPNESS = 0.25;
// the strands' gloss when the record says no Smoothness (the presets' 0.6)
export const HAIR_SMOOTHNESS = 0.6;
// the lobes' weight against the sun (a site number: the record has none)
export const HAIR_SPECULAR = 0.35;
// skin's scattering tint (red travels furthest: the record's skin profile
// radii are not in the dump) and the wrap of the diffuse
export const SCATTER_TINT = [1, 0.4, 0.25];
export const SCATTER_WRAP = 0.5;

export function melaninColor(eu, pheo) {
  return [0, 1, 2].map((c) => Math.exp(-(eu * MELANIN_MAX * EUMELANIN[c] + pheo * MELANIN_MAX * PHEOMELANIN[c]) * MELANIN_PATH));
}

export function tipWeight(v, min, max) {
  if (max <= min) return v >= min ? 1 : 0;
  return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

// Blinn-Phong's exponent for a smoothness (2 / α⁴ − 2, α = 1 − smoothness)
const exponentOf = (smoothness) => Math.max(2, 2 / Math.max(1e-3, (1 - smoothness) ** 4) - 2);

export function hairMaterial(recipe, maps = {}, { tier = 'high', three, sun = null } = {}) {
  const { THREE, tsl } = three;
  const game = { family: 'hair', features: [], parallaxSteps: 0 };
  if (tier === 'low') {
    const m = fromGlb(THREE, maps.glb, false);
    m.userData.game = game;
    return m;
  }
  const { texture, uv, vec3, vec4, float, mix, max, dot, normalize, pow, sqrt, saturate, normalView, positionView, positionViewDirection, cameraViewMatrix, dFdx, dFdy, uniform } = tsl;
  const p = recipe.params ?? {};
  const h = p.hair ?? {};
  const glb = maps.glb;
  const m = fromGlb(THREE, glb, true);
  m.userData.game = game;
  const f = game.features;
  const uv0 = uv(0);
  const map = glb?.map ? texture(glb.map, uv0) : null;
  let color = (map ? map.rgb : vec3(1)).mul(vec3(m.color.r, m.color.g, m.color.b));
  const alpha = map ? map.a : float(1);
  if (h.melanin && h.melaninOn !== false) {
    color = color.mul(vec3(...melaninColor(h.melanin[0], h.melanin[1])));
    f.push('melanin');
  }
  if (h.tip) {
    const lo = h.tipMin ?? 0;
    const hi = h.tipMax ?? 1;
    // (tipWeight's ramp, on the GPU)
    const w = hi > lo ? saturate(uv0.y.sub(lo).div(hi - lo)) : uv0.y.greaterThanEqual(lo).select(float(1), float(0));
    color = mix(color, vec3(...h.tip), w);
    f.push('tipTint');
  }
  // the strand's direction in view space: the flow map's, else the UVs' v
  // (from the screen's derivatives, so no tangents are needed)
  const q0 = dFdx(positionView);
  const q1 = dFdy(positionView);
  const st0 = dFdx(uv0);
  const st1 = dFdy(uv0);
  const alongU = normalize(q0.mul(st1.y).sub(q1.mul(st0.y)));
  const alongV = normalize(q1.mul(st0.x).sub(q0.mul(st1.x)));
  let strand = alongV;
  if (maps.hairStrand) {
    const flow = texture(maps.hairStrand, uv0).xy.mul(2).sub(1);
    strand = normalize(alongU.mul(flow.x).add(alongV.mul(flow.y)));
  }
  const sunDir = uniform(new THREE.Vector3(...(sun?.direction ?? [0, 1, 0])).normalize());
  const sunColor = uniform(new THREE.Color(...(sun?.color ?? [1, 1, 1])));
  game.sun = { direction: sunDir, color: sunColor };
  const L = normalize(cameraViewMatrix.mul(vec4(sunDir, 0)).xyz);
  const H = normalize(L.add(positionViewDirection));
  const lobe = (shift, exponent) => {
    const t = normalize(strand.add(normalView.mul(shift)));
    const th = dot(t, H);
    return pow(sqrt(max(float(0), float(1).sub(th.mul(th)))), float(exponent));
  };
  const e = exponentOf(h.smoothness ?? HAIR_SMOOTHNESS);
  const spec = lobe(PRIMARY_SHIFT, e).add(lobe(SECONDARY_SHIFT, e * SECONDARY_SHARPNESS).mul(color));
  const emissive = spec.mul(saturate(dot(normalView, L))).mul(sunColor).mul(HAIR_SPECULAR);
  f.push('kajiyaKay');
  if (p.alphaTest) {
    m.alphaTest = p.alphaCutoff ?? 0.5;
    f.push('alphaTest');
  }
  if (p.doubleSided) {
    m.side = THREE.DoubleSide;
    f.push('doubleSided');
  }
  m.colorNode = vec4(color, alpha);
  m.emissiveNode = emissive;
  return m;
}

export function headMaterial(recipe, maps = {}, { tier = 'high', three, sun = null } = {}) {
  const { tsl } = three;
  const m = createGameMaterial(recipe, maps, { tier, three, sun });
  if (tier === 'low' || tier === 'mid' || !maps.sss) return m;
  const { texture, uv, vec3, float, max, dot, saturate, normalWorld, mix } = tsl;
  const glb = maps.glb;
  const rsssao = texture(maps.sss, uv(0));
  const { direction: sunDir, color: sunColor } = m.userData.game.sun;
  const map = glb?.map ? texture(glb.map, uv(0)).rgb : vec3(1);
  const base = map.mul(vec3(m.color.r, m.color.g, m.color.b));
  // the wrapped diffuse past the plain one, where the mask says skin
  const nl = dot(normalWorld, sunDir);
  const wrap = saturate(nl.add(SCATTER_WRAP).div(1 + SCATTER_WRAP)).sub(saturate(nl));
  const scatter = base.mul(vec3(...SCATTER_TINT)).mul(sunColor).mul(max(float(0), wrap)).mul(rsssao.g);
  m.emissiveNode = m.emissiveNode ? m.emissiveNode.add(scatter) : scatter;
  // reflectance from red, as ReflectanceUp/Down (4 × r²; at r = 0.5, three's own F0)
  m.specularIntensityNode = rsssao.r.mul(rsssao.r).mul(REFLECTANCE_TO_SPECULAR);
  m.aoNode = mix(float(1), rsssao.b, float(1));
  m.userData.game.features.push('scatter', 'reflectance');
  return m;
}

// The material for any recipe: hair and heads here, the rest the game
// material (the one call a level or a crew pack makes)
//   surfaceMaterial(recipe, maps, opts) → material
//   loadSurfaceMaterial() → Promise<(recipe, maps, opts) => material> with three loaded
export function surfaceMaterial(recipe, maps, opts) {
  if (recipe?.family === 'hair') return hairMaterial(recipe, maps, opts);
  if (recipe?.family === 'head') return headMaterial(recipe, maps, opts);
  return createGameMaterial(recipe, maps, opts);
}

export async function loadSurfaceMaterial() {
  const three = await loadThree();
  return (recipe, maps, opts = {}) => surfaceMaterial(recipe, maps, { ...opts, three });
}
