// A curve from the AI rulebook (`{ points: [[x, y]…], min, max }`, the
// extractor's `curveOf`): piecewise linear through its points, a repeated x a
// step, flat past the ends, and x clamped to the record's MinX..MaxX first:
// the game clamps a curve's input, it never extrapolates. Pure.
//
//   curveAt(curve, x) → y        (0 for a curve with no points)

export function curveAt(curve, x) {
  const pts = curve?.points ?? [];
  if (!pts.length) return 0;
  const lo = curve.min ?? -Infinity;
  const hi = curve.max ?? Infinity;
  const v = Math.min(hi, Math.max(lo, x));
  if (v <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (v <= x1) {
      const [x0, y0] = pts[i - 1];
      const span = x1 - x0;
      return span <= 0 ? y1 : y0 + ((y1 - y0) * (v - x0)) / span;
    }
  }
  return pts[pts.length - 1][1];
}
