// The overlay hook of the game material (lane Q1; the contract lanes Q2 and
// Q4 write to: docs/superpowers/plans/2026-10-10-bf2017-surfaces-laneQ1-materials.md,
// "The hook contract"). Pure: it never looks inside a value, so the
// material passes TSL nodes and the tests pass strings.
//
//   overlays: [(ctx) => ({ color?, roughness?, metalness?, normal?, emissive? })]
//   ctx = { uv, uv1, worldNormal, worldPosition, viewDir, skyVisibility, params, maps }
//     plus the running value of every channel (ctx.color, ctx.roughness, …)
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
