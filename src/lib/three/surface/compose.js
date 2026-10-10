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
