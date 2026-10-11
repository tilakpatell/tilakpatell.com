// The texture mip bias the picture is drawn at (GPU-first lane N2): one
// value for every sampled map of the game material, following the post
// chain's internal scale, so a picture drawn under the screen and brought
// up by the upscaler samples its maps as sharp as the screen's pixels
// want, not a whole mip blurrier. three r186's Texture has no mip bias of
// its own: the material reads this through a uniform at its samples
// (TSL's texture().bias()). Pure, and free of three, so the runtime's
// quality can set it without loading three.
//
// biasFor(scale, { temporal, classic }) → log2(scale) − 1 under an
//   upscaler (scale < 1); −0.5 at native under TRAA; 0 otherwise, and
//   always 0 on the classic renderer
// setMipState({ scale, temporal, classic }): what the bias follows, each
//   part from the one place that knows it (src/runtime/quality.js the scale
//   and the renderer, src/runtime/webgpu.js whether the chain it built is
//   temporal); the bias is biasFor of the parts so far
// setMipBias(b): the bias given outright (the fixture); mipBias() → b;
// onMipBias(fn) → undo

// FSR2's manual (GPUOpen, “mip bias = log2(render ÷ display) − 1”) and
// Godot's −0.75…0 at native under TAA, as the research note reads them
export const MIP_BIAS = { native: -0.5, _source: 'GPUOpen FSR2 manual; Godot’s TAA guidance (docs/research/2026-10-11-ue5-on-webgpu-gpu-first-renderer.md)' };

export function biasFor(scale = 1, { temporal = false, classic = false } = {}) {
  if (classic) return 0;
  if (scale > 0 && scale < 1) return Math.log2(scale) - 1;
  return temporal ? MIP_BIAS.native : 0;
}

let bias = 0;
const listeners = new Set();
const state = { scale: 1, temporal: false, classic: false };

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
