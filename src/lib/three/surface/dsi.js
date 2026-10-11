// The Death Star interior's master shader (SS_DSI_Master_*) on the node
// renderer, for gameMaterial.js's `dsi` family. The game draws these walls,
// decks and ceilings with no colour map: the colour is the recipe's numbers
// (the paint, the anodised aluminium and the rubberised plastic, the dirt and
// the soot, families.js's DSI_*), laid by masks:
//   - the packed map (`nea`, T_DSI_01_RGBA): the normal in red and green,
//     the light strips in blue, the AO in alpha
//   - the wear map (`wear`, T_DSI_01_M): the inset plates, the dirt, the
//     soot and the scratched edges (families.js's DSI_WEAR)
//   - the two-UV kind's id map (`idMap`, T_DSI_RGBA_ID): a 32 × 32 strip of
//     four stripes, red the aluminium, green the plastic, blue and black the
//     paint, picked by the second UV
//
//   dsiColor(params) → [r, g, b]   the paint, for the low tier's flat colour
//   dsiMetal(params) → 0 | 1       the paint's metalness (MetalOnly: 1)
//   dsiRoughness(smoothness) → the site's roughness for a game smoothness
//   dsiNodes(tsl, maps, params, { uv0, uv1, tier }) → { color, roughness,
//     metalness, normal (tangent space, or null), ao (or null), emissive, features }
//
// Tiers: low the paint alone (gameMaterial.js); mid the packed map's normal,
// AO and strips; high and ultra the wear map's plates, dirt, soot and
// scratches, and the id map's layers.

import { DSI_COLOR, DSI_LAYER_FULL, DSI_ROUGHNESS_MIN, DSI_SCRATCH_COLOR, DSI_SCRATCH_ROUGHNESS, DSI_SMOOTH_WEIGHT, DSI_WEAR, EMISSIVE_EXPOSURE, EMISSIVE_MAX } from './families.js';

export const dsiColor = (p) => p?.dsi?.color ?? DSI_COLOR;
export const dsiMetal = (p) => (p?.dsi?.metal === 'only' ? 1 : 0);
export const dsiRoughness = (smoothness = 1) => Math.max(DSI_ROUGHNESS_MIN, Math.min(1, 1 - DSI_SMOOTH_WEIGHT * smoothness));

export function dsiNodes(tsl, maps, p, { uv0, uv1, tier = 'high' }) {
  const { texture, vec3, float, mix, saturate, pow, sqrt, max, dot } = tsl;
  const d = p.dsi ?? {};
  const features = [];
  const full = tier === 'high' || tier === 'ultra';
  let color = vec3(...dsiColor(p));
  let roughness = float(dsiRoughness(d.smoothness));
  let metalness = float(dsiMetal(p));

  // the layers: the id map's stripes (two-UV), else the wear map's plates
  if (full && maps.idMap) {
    features.push('dsiLayers');
    const id = texture(maps.idMap, uv1);
    const al = saturate(id.r);
    const pl = saturate(id.g);
    color = mix(mix(color, vec3(...d.aluminium), al), vec3(...d.plastic), pl);
    roughness = mix(mix(roughness, float(dsiRoughness(d.aluminiumSmoothness)), al), float(dsiRoughness(d.plasticSmoothness)), pl);
    if (d.metal !== 'none') metalness = mix(metalness, float(1), al);
    metalness = mix(metalness, float(0), pl);
  }
  const wear = full && maps.wear ? texture(maps.wear, uv0) : null;
  if (wear) {
    features.push('dsiWear');
    if (!maps.idMap) {
      const al = saturate(wear[DSI_WEAR.layer].div(DSI_LAYER_FULL));
      color = mix(color, vec3(...d.aluminium), al);
      roughness = mix(roughness, float(dsiRoughness(d.aluminiumSmoothness)), al);
      if (d.metal !== 'none') metalness = mix(metalness, float(1), al);
    }
    const dirt = saturate(wear[DSI_WEAR.dirt]);
    color = mix(color, vec3(...d.dirt), dirt);
    roughness = mix(roughness, float(1), dirt);
    const soot = saturate(wear[DSI_WEAR.soot]);
    color = mix(color, vec3(...d.soot), soot);
    roughness = mix(roughness, float(1), soot.mul(0.5));
    // (EdgeScratchTightness: the higher, the thinner the scratched band)
    const scratch = pow(saturate(wear[DSI_WEAR.scratch].mul(2)), float(Math.max(0.05, d.scratch ?? 2)));
    if (d.metal !== 'none') {
      color = mix(color, vec3(...DSI_SCRATCH_COLOR), scratch);
      metalness = mix(metalness, float(1), scratch);
      roughness = mix(roughness, float(DSI_SCRATCH_ROUGHNESS), scratch);
    }
  }

  // the packed map: the normal (z rebuilt), the AO, the strips
  let normal = null;
  let ao = null;
  let emissive = vec3(0);
  if (maps.nea) {
    features.push('dsiNormal');
    const n = texture(maps.nea, uv0);
    const xy = n.xy.mul(2).sub(1);
    normal = vec3(xy, sqrt(max(float(0), float(1).sub(dot(xy, xy)))));
    ao = n.a;
    const e = p.emissive;
    if (e?.mode === 'nea') {
      features.push('emissive');
      const k = Math.min((e.intensity ?? 1) * EMISSIVE_EXPOSURE, EMISSIVE_MAX);
      emissive = vec3(...(e.color ?? [1, 1, 1])).mul(n.b.mul(k));
    }
  }
  return { color, roughness, metalness, normal, ao, emissive, features };
}
