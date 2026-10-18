// A generated planet's round ground: the unit sphere's maths, and the chart
// that lays the flight's flat (x, z) plane on it. The flight keeps flying a
// plane; the chart is the exponential map round the landing spot, so a point
// hypot(x, z) metres from the middle sits that far along the great circle,
// and the plane wraps the sphere (the far side at πR, home again at 2πR).
//
// The map layout is landings/biomes.js's uvOf, latLonOf and fromLatLon
// (u runs from −x round toward +z, v is 0 at the north pole, the image's top
// row), reimplemented here because lib may not import components. Every
// direction is a unit [x, y, z] array.
//
// unit() hands back the very array it was given when that is already of
// length 1 (to 1e−12), so normalising twice changes no bit: the orbit map's
// exact texel test rests on it.
//
// Pure: runs in Node and in a worker.
//
//   unit(v) → [x, y, z]                       (v itself when already unit)
//   angleBetween(a, b) → radians
//   dirOfUv(u, v) → dir        uvOfDir(dir) → [u, v]
//   dirOfLatLon(lat, lon) → dir        latLonOfDir(dir) → [lat, lon]   (degrees)
//   frameAt(at) → { up, east, north }
//   chartOf(at, radius) → { at, radius, frame, toDir(x, z) → dir, toChart(dir) → [x, z] }
//     chart +x is east, −z is north

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function unit(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (Math.abs(len - 1) <= 1e-12) return v;
  // no direction in a zero vector; north keeps every caller finite
  if (!(len > 0) || !Number.isFinite(len)) return [0, 1, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function angleBetween(a, b) {
  // atan2 of the cross's length and the dot stays exact where acos(dot) loses
  // its digits, near 0 and near π
  const c = cross(a, b);
  return Math.atan2(Math.hypot(c[0], c[1], c[2]), dot(a, b));
}

export function dirOfUv(u, v) {
  const phi = u * TAU;
  const theta = v * Math.PI;
  const s = Math.sin(theta);
  return unit([-Math.cos(phi) * s, Math.cos(theta), Math.sin(phi) * s]);
}

export function uvOfDir(dir) {
  let phi = Math.atan2(dir[2], -dir[0]);
  if (phi < 0) phi += TAU;
  return [phi / TAU, Math.acos(clamp(dir[1], -1, 1)) / Math.PI];
}

export function dirOfLatLon(lat, lon) {
  const theta = (90 - lat) * DEG;
  const phi = (lon + 180) * DEG;
  return unit([-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)]);
}

export function latLonOfDir(dir) {
  const [u, v] = uvOfDir(unit(dir));
  return [90 - v * 180, u * 360 - 180];
}

// up, and the tangent directions east (the way longitude grows) and north
// (+y laid flat). At a pole +y has no tangent part, so −x stands in for it.
export function frameAt(at) {
  const up = unit(at);
  let north = [-up[1] * up[0], 1 - up[1] * up[1], -up[1] * up[2]];
  let len = Math.hypot(north[0], north[1], north[2]);
  if (len < 1e-9) {
    north = [-1 + up[0] * up[0], up[0] * up[1], up[0] * up[2]];
    len = Math.hypot(north[0], north[1], north[2]);
  }
  north = [north[0] / len, north[1] / len, north[2] / len];
  return { up, east: cross(north, up), north };
}

export function chartOf(at, radius) {
  const up = unit(at);
  const frame = frameAt(up);
  const { east, north } = frame;

  // d metres out along the heading (x, z): up·cos(d/R) + tangent·sin(d/R)
  function toDir(x, z) {
    const d = Math.hypot(x, z);
    if (d === 0) return up;
    const s = d / radius;
    const co = Math.cos(s);
    const si = Math.sin(s) / d;
    // (x·east − z·north) / d, folded into the sine
    return [
      up[0] * co + (x * east[0] - z * north[0]) * si,
      up[1] * co + (x * east[1] - z * north[1]) * si,
      up[2] * co + (x * east[2] - z * north[2]) * si,
    ];
  }

  // the inverse inside the first turn; at the antipode every heading is as
  // good as another, so it is [πR, 0]
  function toChart(dir) {
    const c = clamp(dot(up, dir), -1, 1);
    const px = dir[0] - up[0] * c;
    const py = dir[1] - up[1] * c;
    const pz = dir[2] - up[2] * c;
    const p = Math.hypot(px, py, pz);
    if (p < 1e-12) return c > 0 ? [0, 0] : [Math.PI * radius, 0];
    const d = radius * Math.atan2(p, c);
    const k = d / p;
    return [k * (px * east[0] + py * east[1] + pz * east[2]), -k * (px * north[0] + py * north[1] + pz * north[2])];
  }

  return { at: up, radius, frame, toDir, toChart };
}
