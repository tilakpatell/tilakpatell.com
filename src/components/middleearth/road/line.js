// The line: the whole Road as one number, the progress s in [0, 1], and a
// stage’s own road as a curve in its frame (metres, +z along the road at
// its start). Pure: three’s curve maths only, no drawing, so it runs in
// Node.
//
//   total(stages) → metres
//   at(stages, s) → { stage, index, local, metres }   (local: metres into the stage)
//   sOf(stages, id, local = 0) → s
//   roadOf(points, step = 1) → { length, pointAt(m) → { x, y, z, tangent } }
//   endOf(road) → { at: [x, y, z], heading }          (heading: yaw from +z)
//
// Stages are chained end to start with OVERLAP metres of the next built
// past the seam, so a seam is never in view.

import { CatmullRomCurve3, Vector3 } from 'three';

export const OVERLAP = 80;

export const total = (stages) => stages.reduce((a, s) => a + s.length, 0);

const EPS = 1e-6;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function at(stages, s) {
  const whole = total(stages);
  const metres = clamp01(s) * whole;
  let before = 0;
  for (let i = 0; i < stages.length; i++) {
    const len = stages[i].length;
    // (the last stage takes its own end; any other hands its end to the
    // next, a micrometre early, so a stage’s address read back through s’s
    // rounding lands on it and not on the end of the one before)
    if (metres < before + len - EPS || i === stages.length - 1) return { stage: stages[i].id, index: i, local: Math.min(len, Math.max(0, metres - before)), metres };
    before += len;
  }
  return null;
}

export function sOf(stages, id, local = 0) {
  let before = 0;
  for (const st of stages) {
    if (st.id === id) return (before + Math.min(st.length, Math.max(0, local))) / total(stages);
    before += st.length;
  }
  throw new Error(`no stage ${id}`);
}

export function roadOf(points, step = 1) {
  const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));
  const length = curve.getLength();
  const n = Math.max(1, Math.ceil(length / step));
  // the table: a point and its tangent every `length / n` metres along the curve
  const xyz = new Float32Array((n + 1) * 3);
  const tan = new Float32Array((n + 1) * 3);
  const p = new Vector3();
  const t = new Vector3();
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, p);
    curve.getTangentAt(i / n, t);
    xyz.set([p.x, p.y, p.z], i * 3);
    tan.set([t.x, t.y, t.z], i * 3);
  }
  // (the ends are the points given, exactly, not the table’s float32 of them)
  xyz.set(points[0], 0);
  xyz.set(points.at(-1), n * 3);
  const each = length / n;
  const pointAt = (m) => {
    const f = Math.min(n, Math.max(0, m / each));
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    const lerp = (a, o) => a[i * 3 + o] + (a[(i + 1) * 3 + o] - a[i * 3 + o]) * k;
    const tx = lerp(tan, 0);
    const ty = lerp(tan, 1);
    const tz = lerp(tan, 2);
    const l = Math.hypot(tx, ty, tz) || 1;
    return { x: lerp(xyz, 0), y: lerp(xyz, 1), z: lerp(xyz, 2), tangent: [tx / l, ty / l, tz / l] };
  };
  return { length, pointAt };
}

export function endOf(road) {
  const e = road.pointAt(road.length);
  return { at: [e.x, e.y, e.z], heading: Math.atan2(e.tangent[0], e.tangent[2]) };
}
