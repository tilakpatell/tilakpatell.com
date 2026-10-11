// The perf probe’s pacing column (the GPU-first design’s G1): how even the
// frames came, as the standard deviation of the frame-to-frame deltas, since
// pacing is what the eye reads and a p95 hides an alternating 12 and 22 ms.
// Pure, tested beside.
//
// frameStdev(deltas, { drop = DROP_MS }) → ms | null (fewer than two frames)

// a gap longer than this is a pause (a tab in the background, the scene
// resting), not a frame: lib/three/pace.js drops it the same way
export const DROP_MS = 250; // _source: src/lib/three/pace.js (`dt > 250`: nothing to judge)

export function frameStdev(deltas, { drop = DROP_MS } = {}) {
  const kept = deltas.filter((d) => Number.isFinite(d) && d > 0 && d <= drop);
  if (kept.length < 2) return null;
  const mean = kept.reduce((s, d) => s + d, 0) / kept.length;
  return Math.sqrt(kept.reduce((s, d) => s + (d - mean) ** 2, 0) / kept.length);
}
