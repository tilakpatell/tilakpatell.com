// The frame’s GPU time, read from the renderer’s own timestamps: the
// instrument the GPU-first lanes measure by (the design’s G1,
// docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md §4). The
// CPU’s frame time says when the page asked for a frame; only the chip’s
// timestamps say how long the chip took to draw it, which is what a
// dynamic-resolution controller and a tier probe need.
//
// three r186 reads `trackTimestamp` on the backend (Backend.js takes it from
// the renderer’s parameters, WebGPUBackend.init ands it with the feature),
// not on the renderer, and makes its query pool on the first render after
// it is set: so it is turned on here, after init, only where the adapter
// has `timestamp-query`, and a page without the clock pays nothing.
// Chrome quantises the timestamps to 100 µs (the research note’s WebGPU
// section), which a 16.7 ms budget tolerates; nothing here claims finer.
//
// createGpuTime(renderer, { frames = 32 }) → { available, frame(), reset(),
//   median, p95, last, count }
// `available`: the adapter has `timestamp-query` (Safari’s is unconfirmed);
// without it every number is null, frame() resolves at once and the caller
// keeps the CPU pace. frame() is called after renderer.render (or the post
// chain’s render): it resolves the render queries since the last call (three
// sums every render pass in them: the frame) and keeps the duration in ms.

const FRAMES = 32; // _source: the design’s G1 (“a ring of the last 32 frames”)
const DONE = Promise.resolve();

export function createGpuTime(renderer, { frames = FRAMES } = {}) {
  let available = false;
  try {
    available = renderer?.hasFeature?.('timestamp-query') === true;
  } catch {
    // (hasFeature throws before init: no clock until the renderer is made)
    available = false;
  }
  if (available && renderer.backend) renderer.backend.trackTimestamp = true;
  const ring = new Float64Array(frames);
  let count = 0;
  let next = 0;
  let last = null;
  let pending = null;

  const sorted = () => Array.from(ring.subarray(0, count)).sort((a, b) => a - b);
  const median = () => {
    if (!count) return null;
    const s = sorted();
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  // (nearest rank, as the perf probe’s p95)
  const p95 = () => {
    if (!count) return null;
    const s = sorted();
    return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
  };
  const push = (ms) => {
    ring[next] = ms;
    next = (next + 1) % frames;
    count = Math.min(frames, count + 1);
    last = ms;
  };

  // (the two ends of a resolve, made once: an async closure and its promise
  // a frame were garbage on the runtime’s path, the every-world hand-off’s
  // performance item 2)
  const got = (value) => {
    pending = null;
    const ms = typeof value === 'number' ? value : renderer.info?.render?.timestamp;
    // (0 or nothing: no render pass since the last resolve)
    if (Number.isFinite(ms) && ms > 0) push(ms);
  };
  // (a lost device: the ring stays as it was, and the loss is the runtime’s to handle)
  const missed = () => {
    pending = null;
  };

  return {
    available,
    frame() {
      if (!available) return DONE;
      // (one resolve at a time: three hands a second caller the first’s
      // promise, and its duration would be counted twice)
      if (pending) return pending;
      try {
        pending = renderer.resolveTimestampsAsync('render').then(got, missed);
      } catch {
        pending = null;
        return DONE;
      }
      return pending;
    },
    reset() {
      count = 0;
      next = 0;
      last = null;
    },
    get median() {
      return median();
    },
    get p95() {
      return p95();
    },
    get last() {
      return last;
    },
    get count() {
      return count;
    },
  };
}
