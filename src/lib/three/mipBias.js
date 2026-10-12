// The texture mip bias the picture is drawn at (GPU-first lane N2): one
// value for every sampled map of the game material, following the post
// chain's internal scale, so a picture drawn under the screen and brought
// up by the upscaler samples its maps as sharp as the screen's pixels
// want, not a whole mip blurrier. three r186's Texture has no mip bias of
// its own: the material reads this through a uniform at its samples
// (TSL's texture().bias()). Pure, and free of three, so the runtime's
// quality can set it without loading three.
//
// biasFor(scale, { temporal, classic, upscaled }) → log2(scale) − 1 under an
//   upscaler (scale < 1, and `upscaled`: a chain that draws under the screen
//   and brings the picture up); −0.5 at native under TRAA; 0 otherwise, and
//   always 0 on the classic renderer
// setMipState({ scale, temporal, classic, upscaled }): what the bias follows,
//   each part from the one place that knows it (src/runtime/quality.js the
//   scale and the renderer, src/runtime/webgpu.js whether the chain it built
//   is temporal and whether it has an upscale pass); the bias is biasFor of
//   the parts so far. Until a chain with an upscale pass is built, a scale
//   under 1 is the canvas's own (the pace's step, or the 4K start with no
//   upscaler to take it), where the maps already sample at the pixels drawn:
//   the bias stays native. (Found on the desktop, 2026-10-11: a 1,440p
//   monitor at ultra draws a 3,840 × 2,160 buffer, which is the 4K start,
//   and every game material sampled 1.4 mips too sharp with nothing upscaling.)
// setMipBias(b): the bias given outright (the fixture); mipBias() → b;
// onMipBias(fn) → undo

// FSR2's manual (GPUOpen, “mip bias = log2(render ÷ display) − 1”) and
// Godot's −0.75…0 at native under TAA, as the research note reads them
export const MIP_BIAS = { native: -0.5, _source: 'GPUOpen FSR2 manual; Godot’s TAA guidance (docs/research/2026-10-11-ue5-on-webgpu-gpu-first-renderer.md)' };

export function biasFor(scale = 1, { temporal = false, classic = false, upscaled = true } = {}) {
  if (classic) return 0;
  if (upscaled && scale > 0 && scale < 1) return Math.log2(scale) - 1;
  return temporal ? MIP_BIAS.native : 0;
}

let bias = 0;
const listeners = new Set();
// (`upscaled` starts false: no chain with an upscale pass has been built)
const state = { scale: 1, temporal: false, classic: false, upscaled: false };

export function setMipState(parts = {}) {
  for (const k of Object.keys(state)) if (parts[k] !== undefined) state[k] = parts[k];
  setMipBias(biasFor(state.scale, state));
}

export function setMipBias(b) {
  const next = Number.isFinite(b) ? b : 0;
  if (next === bias) return;
  bias = next;
  for (const fn of listeners) fn(bias);
}

export const mipBias = () => bias;

export function onMipBias(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
