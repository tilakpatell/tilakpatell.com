// A planet's sphere, as plain arrays: where a direction sits on its colour
// map, its latitude and longitude, the ground's frame there, and the chart
// the flight flies a round planet through. The chart is the exponential map
// round a landing spot: a point (x, z) of the flight's plane, in metres, is
// the place reached by walking hypot(x, z) metres along the great circle
// that way. Close to the spot it is near enough flat; far enough out it
// comes round the planet to where it started.
//
// The map's layout is the landings' (universe/landings/biomes.js uvOf and
// fromLatLon, three's SphereGeometry): u runs from −x round toward +z, v is
// 0 at the north pole (the image's top row); longitude 0 is u 0.5.
//
// Pure: runs in Node and in a worker.
//
//   unit(v) → [x, y, z] (v itself when it is already unit, so twice changes no bit)
//   angleBetween(a, b) → radians
//   dirOfUv(u, v) → dir; uvOfDir(dir) → [u, v]
//   dirOfLatLon(lat, lon) → dir; latLonOfDir(dir) → [lat, lon] (degrees)
//   frameAt(at) → { up, east, north } (north is +y on the tangent plane, −x at a pole; east = north × up)
//   chartOf(at, radius) → { at, radius, frame, toDir(x, z) → dir, toChart(dir) → [x, z] }
//     (chart +x is east, −z north; toChart inverts toDir inside the first turn, the antipode [πR, 0])

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function unit(v) {
  const l = len(v);
  if (Math.abs(l - 1) <= 1e-12) return v;
  return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 1, 0];
}

export const angleBetween = (a, b) => Math.atan2(len(cross(a, b)), dot(a, b));

export function dirOfUv(u, v) {
  const theta = v * Math.PI;
  const phi = u * Math.PI * 2;
  const s = Math.sin(theta);
  return [-Math.cos(phi) * s, Math.cos(theta), Math.sin(phi) * s];
}

export function uvOfDir([x, y, z]) {
  let phi = Math.atan2(z, -x);
  if (phi < 0) phi += Math.PI * 2;
  return [phi / (Math.PI * 2), Math.acos(clamp(y, -1, 1)) / Math.PI];
}

export const dirOfLatLon = (lat, lon) => dirOfUv((lon + 180) / 360, (90 - lat) / 180);

export function latLonOfDir(dir) {
  const [u, v] = uvOfDir(unit(dir));
  return [90 - v * 180, u * 360 - 180];
}

// +y (or, at a pole, −x) laid on the tangent plane at `up`
function tangentOf(up, w) {
  const k = dot(w, up);
  const t = [w[0] - k * up[0], w[1] - k * up[1], w[2] - k * up[2]];
  return len(t) > 1e-9 ? unit(t) : null;
}

export function frameAt(at) {
  const up = unit(at);
  const north = tangentOf(up, [0, 1, 0]) ?? tangentOf(up, [-1, 0, 0]);
  return { up, east: cross(north, up), north };
}

export function chartOf(at, radius) {
  const frame = frameAt(at);
  const { up, east, north } = frame;
  const toDir = (x, z) => {
    const d = Math.hypot(x, z);
    if (d === 0) return up;
    const a = x / d;
    const b = -z / d;
    const c = Math.cos(d / radius);
    const s = Math.sin(d / radius);
    return unit([
      up[0] * c + (east[0] * a + north[0] * b) * s,
      up[1] * c + (east[1] * a + north[1] * b) * s,
      up[2] * c + (east[2] * a + north[2] * b) * s,
    ]);
  };
  const toChart = (dir) => {
    const e = dot(dir, east);
    const n = dot(dir, north);
    const side = Math.hypot(e, n);
    const angle = Math.atan2(side, dot(dir, up));
    if (side < 1e-15) return angle > 1 ? [Math.PI * radius, 0] : [0, 0];
    const k = (angle * radius) / side;
    return [e * k + 0, -n * k + 0];
  };
  return { at: up, radius, frame, toDir, toChart };
}
