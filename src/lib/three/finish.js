// The numbers of the finish a post chain draws its own sharpness with (the
// universe map's and the galaxy's, universe/post.js's `upscale` and the
// galaxy's node twin's): how sharp the scene is drawn, how many samples it
// takes there, whether the canvas is sharper and it's brought up by FSR 1,
// and how hard RCAS sharpens it then. Pure, in no shader language, so a
// GLSL chain and its node twin read the same numbers.
//
//   drawnRatio(top, sharp, { softest }) → device pixels a CSS one the scene is drawn at
//   samplesAt(ratio, { small, cap }) → 0, 2 or 4
//   upscaling(drawn, canvas) → whether it's brought up
//   rcasStops(scale) → RCAS's strength in stops, for a scene drawn at `scale` of the canvas

// the softest the pace takes a scene, device pixels to a CSS one, however busy
export const SOFTEST = 0.6;

// How sharp the scene is drawn: the most it may be (`top`: the budget's
// least and the visitor's render resolution), a share of it by the pace,
// never under the softest (nor over the most, where that's under it itself)
export const drawnRatio = (top, sharp = 1, { softest = SOFTEST } = {}) => Math.min(top, Math.max(softest, top * sharp));

// Multisampling by the pixels the scene is drawn at, a CSS pixel's worth:
// at 1.75 and over a stair is too small to see (and four samples on a
// half-float target cost more than the rest of the frame there); over a
// screen's own 1.25, two; under, four (two at most on a small screen,
// whose chip has less to give), as a picture brought up shows its stairs
// bigger. Never more than `cap` (the visitor's video settings).
export function samplesAt(ratio, { small = false, cap = Infinity } = {}) {
  const want = ratio >= 1.75 ? 0 : ratio >= 1.25 || small ? 2 : 4;
  return Math.max(0, Math.min(want, cap));
}

// whether the canvas is sharper than the scene, so it's brought up (a
// hair's give, so a ratio worked out two ways isn't an upscale of 1.0001)
export const upscaling = (drawn, canvas) => drawn < canvas - 1e-3;

// RCAS's strength in stops of its lobe's weight (0 the most, 2 none):
// FidelityFX's own default at half the canvas or less (_source: GPUOpen's
// ffx_fsr1.h, FSR_RCAS_DEFAULT_SHARPNESS, and three's FSR1Node), easing
// to 0.8 as the scene nears the canvas: brought up a little, it has little
// to give back, and the full sharpen made a lit hull's greebles sparkle
// (the map's Falcon at 0.9 of a 1× canvas, 2026-10-22), as lib/three/light/
// post.js's sharpenFor eases TAAU's sharpen by its scale.
export const RCAS_STOPS = 0.2;
export const RCAS_NEAR = 0.8;
export function rcasStops(scale = 0.5) {
  const k = Math.min(1, Math.max(0, (scale - 0.5) / 0.5));
  return RCAS_STOPS + (RCAS_NEAR - RCAS_STOPS) * k;
}
