// Sub-pixel jitter for the reference shots (the GPU-first design’s G1,
// scripts/reference-frames.mjs): a world drawn eight times, each with its
// camera moved by a fraction of a pixel, and the shots averaged, is the
// supersampled picture a candidate is scored against. Development only:
// the runtime’s webgpu backend hands it out as gfx.jitter(i).
//
// The hook wraps renderer.render, since a post chain’s scene pass calls it
// too (three’s PassNode), and offsets only a perspective camera drawn at
// the screen’s size: a shadow map’s camera (its own size) and the chain’s
// full-screen quad (orthographic) are left alone, or the shot would shift
// its own output. The temporal pass is off for these shots (?traa=off):
// TRAA’s own jitter and history would fight the average.
//
// halton(i, base) → (0, 1); jitterAt(i) → [x, y] pixels, within ±½
// createJitter(renderer) → { set(i | null), dispose() }

import { Vector2 } from 'three';

export function halton(i, base) {
  let f = 1;
  let r = 0;
  for (let n = i; n > 0; n = Math.floor(n / base)) {
    f /= base;
    r += f * (n % base);
  }
  return r;
}

// (from the sequence’s first point: its 0th is the corner, (0, 0))
export const jitterAt = (i) => [halton(i + 1, 2) - 0.5, halton(i + 1, 3) - 0.5];

export function createJitter(renderer) {
  const own = renderer.render;
  // (three's getDrawingBufferSize sets and floors a Vector2)
  const size = new Vector2();
  let offset = null;
  renderer.render = function render(scene, camera, ...rest) {
    if (!offset || !camera?.isPerspectiveCamera) return own.call(this, scene, camera, ...rest);
    renderer.getDrawingBufferSize(size);
    const target = renderer.getRenderTarget?.();
    if (target && (target.width !== size.x || target.height !== size.y)) return own.call(this, scene, camera, ...rest);
    const was = camera.view ? { ...camera.view } : null;
    const v = was ?? { fullWidth: size.x, fullHeight: size.y, offsetX: 0, offsetY: 0, width: size.x, height: size.y };
    camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX + offset[0], v.offsetY + offset[1], v.width, v.height);
    try {
      return own.call(this, scene, camera, ...rest);
    } finally {
      if (was) camera.setViewOffset(was.fullWidth, was.fullHeight, was.offsetX, was.offsetY, was.width, was.height);
      else camera.clearViewOffset();
    }
  };
  return {
    set(i) {
      offset = Number.isInteger(i) && i >= 0 ? jitterAt(i) : null;
    },
    dispose() {
      renderer.render = own;
    },
  };
}
