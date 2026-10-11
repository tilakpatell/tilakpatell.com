// The overlay hook of the game material (lane Q1; the contract lanes Q2 and
// Q4 write to: docs/superpowers/plans/2026-10-10-bf2017-surfaces-laneQ1-materials.md,
// "The hook contract"). Pure: it never looks inside a value, so the
// material passes TSL nodes and the tests pass strings.
//
//   overlays: [(ctx) => ({ color?, roughness?, metalness?, normal?, emissive? })]
//   ctx = { uv, uv1, worldNormal, worldPosition, viewDir, skyVisibility, params, maps }
//     plus the running value of every channel (ctx.color, ctx.roughness, …)
//
// What each is (gameMaterial.js builds it):
//   uv, uv1        TSL vec2: the base uv (after parallax, when it ran) and the second set
//   worldNormal    TSL vec3, world space: the geometry's normal (normalWorld), not
//                  the shaded one; up-facing tests read its y
//   worldPosition  TSL vec3, world space
//   viewDir        TSL vec3, view space, from the surface toward the camera
//   skyVisibility  TSL float, 1 until lane Q3's sky visibility lands
//   params         the recipe's params (plain numbers and arrays, not nodes)
//   maps           maps.glb: the GLB's Material; maps.weathering: the
//                  WeatheringMask already sampled at uv (a TSL vec4) or null;
//                  every other key a Texture or null (sample it yourself)
//   color          TSL vec3, linear; roughness, metalness TSL floats
//   normal         TSL vec3, VIEW space, as normalMap() returns it (what the
//                  material's normalNode takes); return a view-space normal
//   emissive       TSL vec3, linear, in the site's exposure
//
// Each returned value replaces the running one for its channel; a
// contributor that wants to blend does mix(ctx.color, mine, k) itself and
// returns the mix. The order is the array's.
//
//   composeOverlays(base, overlays, ctx) → { color, roughness, metalness, normal, emissive }
//   overlayName(fn) → its name, for the material's feature list
//
// The picture's two nodes (GPU-first lane N2), built on the `tsl` they are
// given so nothing here imports three:
//   specularAA(tsl, normal, roughness) → roughness: geometric specular
//     anti-aliasing (Kaplanyan and Hoffman 2016, as Filament writes it) on
//     the SHADED normal, the normal maps' detail that sparkles under TAA,
//     and a floor of 0.045. (three's own lighting already floors at 0.0525
//     and widens by the geometry's normal; the normal maps' variance is
//     what it leaves out.) specularAAValue(roughness, gradient²) is its
//     CPU twin, gradient² being |dn/dx|² + |dn/dy|².
//   biasedTexture(tsl) → (texture, uv) → a sample at the shared mip bias
//     (lib/three/mipBias: the post chain's scale), plus the texture's own
//     userData.mipBias (lib/three/textures' sharpen `bias`)
//   mipBiasUniform(tsl) → the one uniform every material reads it through

import { mipBias, onMipBias } from '../mipBias.js';

export const CHANNELS = ['color', 'roughness', 'metalness', 'normal', 'emissive'];

export function composeOverlays(base, overlays, ctx) {
  const out = { ...base };
  for (const overlay of overlays) {
    const part = overlay({ ...ctx, ...out });
    if (!part) continue;
    for (const k of CHANNELS) if (part[k] != null) out[k] = part[k];
  }
  return out;
}

export const overlayName = (fn) => fn.overlayName ?? (fn.name || 'overlay');

// Filament's defaults (google.github.io/filament, Materials: specularAntiAliasingVariance
// 0.15, specularAntiAliasingThreshold 0.2; its MIN_PERCEPTUAL_ROUGHNESS 0.045)
export const SPECULAR_AA = { variance: 0.15, threshold: 0.2, floor: 0.045, _source: 'Filament Materials (specularAntiAliasingVariance, specularAntiAliasingThreshold) and Filament PBR (MIN_PERCEPTUAL_ROUGHNESS)' };

// perceptual roughness r → α = r², α² + the kernel → back to perceptual: r′ = (r⁴ + k)^¼
export function specularAAValue(roughness, gradient2, { variance, threshold, floor } = SPECULAR_AA) {
  const r = Math.max(floor, roughness);
  const kernel = Math.min(2 * variance * Math.max(0, gradient2), threshold);
  return Math.min(1, Math.max(floor, Math.sqrt(Math.sqrt(Math.min(1, r ** 4 + kernel)))));
}

export function specularAA(tsl, normal, roughness, { variance, threshold, floor } = SPECULAR_AA) {
  const { Fn, float, dot, min, max, saturate, sqrt } = tsl;
  return Fn(() => {
    const n = normal.toVar();
    const du = n.dFdx();
    const dv = n.dFdy();
    const kernel = min(float(2 * variance).mul(dot(du, du).add(dot(dv, dv))), float(threshold));
    const r = max(roughness, float(floor));
    const a = r.mul(r);
    return max(sqrt(sqrt(saturate(a.mul(a).add(kernel)))), float(floor));
  })();
}

const uniforms = new WeakMap(); // tsl → the mip bias uniform
export function mipBiasUniform(tsl) {
  let u = uniforms.get(tsl);
  if (!u) {
    u = tsl.uniform(mipBias());
    onMipBias((b) => (u.value = b));
    uniforms.set(tsl, u);
  }
  return u;
}

export function biasedTexture(tsl) {
  const bias = mipBiasUniform(tsl);
  return (t, uv) => {
    const own = t?.userData?.mipBias ?? 0;
    return tsl.texture(t, uv).bias(own ? bias.add(own) : bias);
  };
}
