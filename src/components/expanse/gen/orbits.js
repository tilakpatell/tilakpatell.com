// Orbits on the shared clock: where a generated planet or moon is at a given
// time, worked out from the time alone so every pilot sees it in the same
// place. Each orbit goes round a whole number of times in ORBIT_CYCLE seconds,
// so the end of one cycle meets the start of the next with no jump. Pure (no
// three.js), so it runs in Node.
//
// ORBIT_CYCLE (seconds, a power of two so the phase is exact), REV_K (the turns
// a cycle at an orbit of 1000)
// revsFor(orbit) → whole turns a cycle (at least 1); nearer in, faster
// spaceTime(nowMs) → the shared clock, in seconds
// orbitAt(planet, t, out?) → [x, y, z]: the planet round its star, written
//   into `out` when it's given
// moonAt(moon, planet, t, out?, planetAt?) → [x, y, z]: the moon round its
//   planet; `planetAt` is where the planet is at t, when that's worked out
//   (orbitAt's), so a frame of moons works each planet out once
// bodiesAt(system, t) → [{ id, kind: 'star' | 'planet' | 'moon', at, r }]

export const ORBIT_CYCLE = 65536;
export const REV_K = 4;

const TAU = 2 * Math.PI;

// Kepler-ish: the period goes with the orbit to the 3/2, so the turns a cycle
// go with its inverse.
export function revsFor(orbit) {
  return Math.max(1, Math.round(REV_K * Math.pow(1000 / orbit, 1.5)));
}

export function spaceTime(nowMs) {
  return nowMs / 1000;
}

// Only the fraction of a cycle matters. Dividing by a power of two is exact,
// so the fraction keeps its precision however far t has run.
function turn(revs, t) {
  const f = t / ORBIT_CYCLE;
  return TAU * revs * (f - Math.floor(f));
}

export function orbitAt(planet, t, out = [0, 0, 0]) {
  const { at, centre } = planet;
  const x = at[0] - centre[0];
  const y = at[1] - centre[1];
  const z = at[2] - centre[2];
  // Y × r0, then r0 × that: the part of up that is square to r0, so a level
  // orbit turns about Y. Straight above or below, there is no plane to keep.
  const yx0 = z;
  const yx1 = 0;
  const yx2 = -x;
  const m0 = y * yx2 - z * yx1;
  const m1 = z * yx0 - x * yx2;
  const m2 = x * yx1 - y * yx0;
  const ml = Math.sqrt(m0 * m0 + m1 * m1 + m2 * m2); // (not Math.hypot, which boxes what it's given)
  const n0 = ml > 0 ? m0 / ml : 0;
  const n1 = ml > 0 ? m1 / ml : 1;
  const n2 = ml > 0 ? m2 / ml : 0;
  // Rodrigues' formula: r0 turned by its turn about the unit axis n (in
  // scalars, so a frame of planets makes no arrays).
  const theta = turn(planet.revs, t);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const d = (n0 * x + n1 * y + n2 * z) * (1 - c);
  const px = x * c + (n1 * z - n2 * y) * s + n0 * d;
  const py = y * c + (n2 * x - n0 * z) * s + n1 * d;
  const pz = z * c + (n0 * y - n1 * x) * s + n2 * d;
  out[0] = centre[0] + px;
  out[1] = centre[1] + py;
  out[2] = centre[2] + pz;
  return out;
}

export function moonAt(moon, planet, t, out = [0, 0, 0], planetAt = orbitAt(planet, t, out)) {
  const a = moon.phase + turn(moon.revs, t);
  const x = moon.orbit * Math.cos(a);
  const z = moon.orbit * Math.sin(a);
  const c = Math.cos(moon.tilt);
  const s = Math.sin(moon.tilt);
  const px = planetAt[0];
  const py = planetAt[1];
  const pz = planetAt[2];
  // The circle lies in the x-z plane, then tilts about x.
  out[0] = px + x;
  out[1] = py - z * s;
  out[2] = pz + z * c;
  return out;
}

export function bodiesAt(system, t) {
  const out = [{ id: system.id, kind: 'star', at: system.at, r: system.star.size }];
  for (const planet of system.planets) {
    out.push({ id: planet.id, kind: 'planet', at: orbitAt(planet, t), r: planet.radius });
    for (const moon of planet.moonList || []) {
      out.push({ id: moon.id, kind: 'moon', at: moonAt(moon, planet, t), r: moon.radius });
    }
  }
  return out;
}
