// A round planet's unit sphere: where a direction is on its map, the
// ground's own frame there, and the chart the flight flies. The flight works
// in metres on an unbounded (x, z); a generated planet's ground is a field of
// the direction. The chart joins them by the exponential map from the
// landing spot: (x, z) walks hypot(x, z) metres along the great circle that
// way, so near the spot the plane is near enough flat, and far enough out it
// comes round the planet to where it began.
//
// The map's layout is the landings' (components/universe/landings/biomes.js
// uvOf and fromLatLon, and three's SphereGeometry): u runs from −x round
// toward +z, v is 0 at the north pole (the image's top row); latitude and
// longitude are degrees, longitude 0 at u 0.5 and growing with u.
//
// Every argument is a plain array and every direction a unit [x, y, z], so a
// chart's spot can cross to a worker in a spec.
//
// Pure: runs in Node and in a worker.
//
//   unit(v) → [x, y, z]: v itself when its length is within 1e−12 of 1
//   angleBetween(a, b) → radians
//   dirOfUv(u, v) → dir            uvOfDir(dir) → [u, v]
//   dirOfLatLon(lat, lon) → dir    latLonOfDir(dir) → [lat, lon]
//   frameAt(at) → { up, east, north }: north is +y along the ground (−x at a
//     pole), east = cross(north, up), the way longitude grows
//   chartOf(at, radius) → { at, radius, frame, toDir(x, z) → dir, toChart(dir) → [x, z] }
//     chart +x is east, −z north; toChart reads back inside the first turn
//     (hypot(x, z) < πR), and the far side as [πR, 0]

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function unit(v) {
  const l = Math.sqrt(dot(v, v));
  if (Math.abs(l - 1) <= 1e-12) return v;
  // nothing to point along: zeros back, not NaN
  if (!(l > 0)) return [0, 0, 0];
  return [v[0] / l, v[1] / l, v[2] / l];
}

// atan2 of the sine and cosine, not acos of the dot: as sharp a metre from
// the spot as at the far side, and the same whatever the lengths
export function angleBetween(a, b) {
  const w = cross(a, b);
  return Math.atan2(Math.sqrt(dot(w, w)), dot(a, b));
}

const dirOf = (phi, theta) => {
  const s = Math.sin(theta);
  return [-Math.cos(phi) * s, Math.cos(theta), Math.sin(phi) * s];
};

export const dirOfUv = (u, v) => dirOf(u * TAU, v * Math.PI);

export function uvOfDir(dir) {
  const [x, y, z] = unit(dir);
  let phi = Math.atan2(z, -x);
  if (phi < 0) phi += TAU;
  return [phi / TAU, Math.acos(clamp(y, -1, 1)) / Math.PI];
}

// the landings' fromLatLon, sum for sum, so ?spot=lat,lon is the same place
export const dirOfLatLon = (lat, lon) => dirOf((lon + 180) * DEG, (90 - lat) * DEG);

export function latLonOfDir(dir) {
  const [u, v] = uvOfDir(dir);
  return [90 - v * 180, u * 360 - 180];
}

export function frameAt(at) {
  const up = unit(at);
  const [x, y, z] = up;
  // +y less its part along up is [−xy, x² + z², −zy] (1 − y² written as
  // x² + z², which keeps its digits near a pole), of length hypot(x, z).
  // Within 1e−12 of a pole there's no +y to project, so −x is.
  const rho = Math.hypot(x, z);
  const north = rho > 1e-12 ? [(-x * y) / rho, rho, (-z * y) / rho] : unit([-1 + x * x, x * y, x * z]);
  return { up, east: cross(north, up), north };
}

export function chartOf(at, radius) {
  const frame = frameAt(at);
  const { up, east, north } = frame;
  const R = radius;
  const [a0, a1, a2] = up;
  const [e0, e1, e2] = east;
  const [n0, n1, n2] = north;
  return {
    at: up,
    radius,
    frame,
    // at·cos(d/R) + t·sin(d/R), with t = (x·east − z·north) / d
    toDir(x, z) {
      const d = Math.sqrt(x * x + z * z);
      if (d === 0) return [a0, a1, a2];
      const c = Math.cos(d / R);
      const s = Math.sin(d / R) / d;
      const kx = x * s;
      const kz = z * s;
      return [a0 * c + e0 * kx - n0 * kz, a1 * c + e1 * kx - n1 * kz, a2 * c + e2 * kx - n2 * kz];
    },
    toChart(dir) {
      const u = unit(dir);
      const c = dot(u, up);
      const ex = dot(u, east);
      const nz = dot(u, north);
      const s = Math.sqrt(ex * ex + nz * nz);
      // the far side: every way out from the spot meets there
      if (s < 1e-12 && c < 0) return [Math.PI * R, 0];
      if (s === 0) return [0, 0];
      const k = (Math.atan2(s, c) * R) / s;
      return [ex * k, -nz * k];
    },
  };
}
