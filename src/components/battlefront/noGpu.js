// The Battlefront world on a device with no graphics chip: the low tier
// where the browser draws in software (lib/gpu's `software`: SwiftShader,
// llvmpipe, Microsoft's basic driver), on the node renderer over WebGL 2.
// A CPU rasteriser pays for every lit pixel and every vertex, so the tier
// draws less of each, by what was measured on SwiftShader at 1,280 × 720
// (docs/decisions/2026-10-12-one-hoth-from-a-laptop-to-the-5090.md, run
// sw-low-tier; a frame's mean over the time its frames took):
//
//   as the low tier drew it                          1,244 ms
//   without the level's lamps                          387 ms
//   and without the chain, the buffer the screen's     292 ms
//   and the buffer 640 × 360                           117 ms
//   (and without the ground's 950,000 triangles         28 ms: the ground's lane)
//
// - No lamps: where the clustering cannot run the placed lights are a pool
//   of 64 points and 16 spots on the base lighting (light/placed.js), and
//   every lit pixel walks all eighty.
// - No chain: the bloom's mips, the tone map, the LUT and FSR1's two passes
//   at the screen's size cost more than the scene they follow; the scene is
//   drawn straight to the canvas under the renderer's own tone mapping.
// - A buffer of NO_GPU.pixels whatever the window, stretched by the page
//   (the HUD is the DOM's and stays sharp).
//
//   NO_GPU, isNoGpu({ tier, why }) → boolean, noGpuRatio(w, h) → the canvas's ratio
//   noGpuNow(tier?) → isNoGpu of this device (lib/device)

import { device } from '../../lib/device.js';

export const NO_GPU = Object.freeze({ pixels: 640 * 360, minRatio: 0.25, lamps: false, chain: false });

// (a level picked by hand above low is the visitor's own: drawn as asked)
export function isNoGpu({ tier = null, why = [] } = {}) {
  return tier === 'low' && Array.isArray(why) && why.includes('software');
}

// the ratio that makes a w × h window's buffer NO_GPU.pixels: never sharper
// than the window's own pixels, never under a quarter of them a side
export function noGpuRatio(w, h, pixels = NO_GPU.pixels) {
  const area = Math.max(1, w) * Math.max(1, h);
  return Math.max(NO_GPU.minRatio, Math.min(1, Math.sqrt(pixels / area)));
}

export function noGpuNow(tier = null) {
  const d = device();
  return isNoGpu({ tier: tier ?? d.tier, why: d.why });
}
