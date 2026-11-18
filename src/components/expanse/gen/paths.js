// Things that move on the shared clock: a comet on Kepler's ellipse round its
// star, and a storm, a herd or a swarm on a loop. Where one is is a pure
// function of its path and the time, so every pilot sees it in the same place,
// as orbits.js's planets are. Pure (no three.js), so it runs in Node.
//
// The time is turned into a fraction of a period (frac(t / period)) before it
// becomes an angle: a clock days or years from its epoch (spaceTime is epoch
// seconds, about 1.76e9) keeps its precision that way, where 2π·t / period
// would lose it in the multiply.
//
// COMET_PERIOD: a comet goes round once in 8 orbit cycles (524,288 s)
// pathAt(path, t) → [x, y, z], for
//   { type: 'kepler', focus, q, e, peri, normal, period, phase }: the ellipse with its
//     focus at `focus`, perihelion distance q along the unit `peri`, in the plane with
//     unit normal `normal`; at mean anomaly 2π · (frac(t / period) + phase)
//   { type: 'loop', centre, radius, revs, phase, normal, ref }: the circle at
//     2π · (revs · frac(t / ORBIT_CYCLE) + phase), a whole number of turns a cycle, so it
//     wraps smoothly as the orbits do
// keplerE(M, e) → E: Kepler's equation E − e·sin E = M by Newton's steps
// rowAt(row, t) → [x, y, z]: pathAt(row.path, t), or row.at itself for a row without a path
// pathSpeed(path) → the most units a second it ever moves (a comet's at perihelion)

import { ORBIT_CYCLE } from './orbits';

export const COMET_PERIOD = 8 * ORBIT_CYCLE;

const TAU = 2 * Math.PI;
const frac = (x) => x - Math.floor(x);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function keplerE(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 30; i++) {
    const step = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  return E;
}

export function pathAt(path, t) {
  if (path.type === 'kepler') {
    const { focus, q, e, peri, normal, period, phase } = path;
    const a = q / (1 - e);
    const E = keplerE(TAU * (frac(t / period) + phase), e);
    const x = a * (Math.cos(E) - e);
    const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const side = cross(normal, peri);
    return [0, 1, 2].map((k) => focus[k] + x * peri[k] + y * side[k]);
  }
  const { centre, radius, revs, phase, normal, ref } = path;
  const th = TAU * frac(revs * frac(t / ORBIT_CYCLE) + phase);
  const c = Math.cos(th) * radius;
  const s = Math.sin(th) * radius;
  const side = cross(normal, ref);
  return [0, 1, 2].map((k) => centre[k] + c * ref[k] + s * side[k]);
}

export const rowAt = (row, t) => (row.path ? pathAt(row.path, t) : row.at);

export function pathSpeed(path) {
  if (path.type === 'kepler') {
    const a = path.q / (1 - path.e);
    return ((TAU * a) / path.period) * Math.sqrt((1 + path.e) / (1 - path.e));
  }
  return (TAU * path.radius * path.revs) / ORBIT_CYCLE;
}
