// The new-era soldier's surface shader, Shaders/Presets/
// SS_CharactersPreset_WalrusMetallic, as the game compiles it: the front end
// of its third-person GBuffer pass (the frontend+mp characters' RVM database,
// the 28 permutations that carry its AOSlice tests; the plainest, 359
// instructions at byte 56519971, is bf2-re findings/57's listing). Every
// trooper of Hoth's Galactic Assault wears it (each MeshVariationDb entry's
// SurfaceShaderId 553285247, the RVM SurfaceShader's name hash). What it does
// with its maps (CS = BaseColor, NM = Normal, AOSL = AOSlice, the detail
// array NormalDetailTextureArray):
//
//   albedo  = CS.rgb · lerp(1, AOSL.r, ColorAO.x)
//   slot    = AOSL.g < 0.3 ? x : AOSL.g < 0.6 ? y : z      (the per-slot vectors:
//             Detail_Tiling, NormalDetail_Intensity, SmoothnessDetail_Intensity)
//   slice   = round(AOSL.g · 2.5)                           (the array's slice)
//   valid   = AOSL.g < 0.65 || AOSL.g > 0.8                 (no detail between)
//   d       = array[slice] at uv · Detail_Tiling[slot]
//   n.xy   += (2·d.rg − 1) · NormalDetail_Intensity[slot] · 0.5 · valid
//   k       = SmoothnessDetail_Intensity[slot] · valid
//   albedo  = lerp(albedo, overlay(albedo, d.b), k)         (overlay: 2ab below a half, 1 − 2(1−a)(1−b) above)
//   smooth  = lerp(CS.a, 2·CS.a·d.b, k)
//   metal   = NM.b · (1 − wear)                             (the GLB's ORM blue already)
//   AO      = AOSL.r on the indirect light                  (the GLB's ORM red, three's aoMap)
//
// Pure apart from the TSL it is handed (`tsl`), so its tests run in Node.
//
//   slotOf(g), sliceOf(g, slices = 3), detailValid(g), overlay(a, b), detailSmooth(s, b, k): the shader's numbers, in JS
//   walrusDetail(tsl, { sample, level, uv, slices, per, strength }) → { xy, blue, k }
//     sample(texture, uv) → a TSL vec4; level: AOSL.g (TSL float); uv: the
//     detail's TSL vec2 before tiling; slices: the array's textures in
//     order; per: the recipe's perSlice { tiling, normal, smoothness }
//   walrusAlbedo(tsl, color, ao, colorAO) → TSL vec3
//   walrusOverlay(tsl, color, blue, k) → TSL vec3; walrusSmooth(tsl, smooth, blue, k) → TSL float

// the slot thresholds on AOSlice's green (`lt r7.xyz, r6.yyyy, l(0.3, 0.6, 0.65)`)
export const SLOT_EDGES = [0.3, 0.6];
// no detail between these (`lt r7.z` = g < 0.65, `lt r3.w, l(0.8), r6.y`)
export const GAP = [0.65, 0.8];
// the slice index (`mul r8.zw, r6.yyyx, l(0, 0, 2.5, 0.5)`)
export const SLICE_SCALE = 2.5;
// the detail normal's weight on its intensity (`mul r2.w, r2.w, l(0.5)`)
export const DETAIL_NORMAL_SCALE = 0.5;

export const slotOf = (g) => (g < SLOT_EDGES[0] ? 0 : g < SLOT_EDGES[1] ? 1 : 2);
export const sliceOf = (g, slices = 3) => Math.min(slices - 1, Math.max(0, Math.round(g * SLICE_SCALE)));
export const detailValid = (g) => g < GAP[0] || g > GAP[1];
export const overlay = (a, b) => (a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b));
export const detailSmooth = (s, b, k) => s + (2 * s * b - s) * k;

// the slice index's edges: round(2.5·g) steps at 0.2 and 0.6
const SLICE_EDGES = [0.5 / SLICE_SCALE, 1.5 / SLICE_SCALE];

export function walrusDetail(tsl, { sample, level, uv, slices, per = {}, strength = 1 }) {
  const { float, vec2, step, saturate } = tsl;
  const g = level;
  const lt = (edge) => float(1).sub(step(float(edge), g));
  const s0 = lt(SLOT_EDGES[0]);
  const s1 = float(1).sub(s0).mul(lt(SLOT_EDGES[1]));
  const s2 = float(1).sub(s0).sub(s1);
  const bySlot = (v = [], fallback = 0) => s0.mul(float(v[0] ?? fallback)).add(s1.mul(float(v[1] ?? fallback))).add(s2.mul(float(v[2] ?? fallback)));
  const valid = saturate(lt(GAP[0]).add(step(float(GAP[1]), g)));
  const tile = bySlot(per.tiling, 1);
  const at = vec2(uv).mul(vec2(tile, tile));
  // (each slice's weight: its index is round(2.5·g), the last slice the array's top)
  const n = slices.length;
  const weights = slices.map((_, i) => {
    const lo = i === 0 ? float(1) : step(float(SLICE_EDGES[i - 1] ?? 1), g);
    const hi = i === n - 1 ? float(0) : step(float(SLICE_EDGES[i] ?? 1), g);
    return lo.sub(hi).mul(valid);
  });
  let xy = vec2(0, 0);
  let blue = float(0);
  slices.forEach((t, i) => {
    const d = sample(t, at);
    xy = xy.add(d.xy.mul(2).sub(1).mul(weights[i]));
    blue = blue.add(d.z.mul(weights[i]));
  });
  xy = xy.mul(bySlot(per.normal).mul(DETAIL_NORMAL_SCALE * strength));
  const k = bySlot(per.smoothness).mul(valid).mul(float(strength));
  return { xy, blue, k, valid };
}

export function walrusAlbedo(tsl, color, ao, colorAO) {
  const { float, mix } = tsl;
  return colorAO > 0 ? color.mul(mix(float(1), ao, float(colorAO))) : color;
}

export function walrusOverlay(tsl, color, blue, k) {
  const { vec3, mix, step } = tsl;
  const one = vec3(1, 1, 1);
  const low = color.mul(blue).mul(2);
  const high = one.sub(one.sub(color).mul(one.sub(vec3(blue, blue, blue))).mul(2));
  return mix(color, mix(low, high, step(vec3(0.5, 0.5, 0.5), color)), k);
}

export function walrusSmooth(tsl, smooth, blue, k) {
  const { mix } = tsl;
  return mix(smooth, smooth.mul(blue).mul(2), k);
}
