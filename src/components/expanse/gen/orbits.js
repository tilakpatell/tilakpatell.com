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
// orbitAt(planet, t) → [x, y, z]: the planet round its star
// moonAt(moon, planet, t) → [x, y, z]: the moon round its planet
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

// Rodrigues' formula: v turned by theta about the unit axis n.
function rotate(v, n, theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const d = (n[0] * v[0] + n[1] * v[1] + n[2] * v[2]) * (1 - c);
  return [
    v[0] * c + (n[1] * v[2] - n[2] * v[1]) * s + n[0] * d,
    v[1] * c + (n[2] * v[0] - n[0] * v[2]) * s + n[1] * d,
    v[2] * c + (n[0] * v[1] - n[1] * v[0]) * s + n[2] * d,
  ];
}

export function orbitAt(planet, t) {
  const { at, centre } = planet;
  const r0 = [at[0] - centre[0], at[1] - centre[1], at[2] - centre[2]];
  // Y × r0, then r0 × that: the part of up that is square to r0, so a level
  // orbit turns about Y. Straight above or below, there is no plane to keep.
  const yx = [r0[2], 0, -r0[0]];
  const m = [r0[1] * yx[2] - r0[2] * yx[1], r0[2] * yx[0] - r0[0] * yx[2], r0[0] * yx[1] - r0[1] * yx[0]];
  const ml = Math.hypot(m[0], m[1], m[2]);
  const n = ml > 0 ? [m[0] / ml, m[1] / ml, m[2] / ml] : [0, 1, 0];
  const p = rotate(r0, n, turn(planet.revs, t));
  return [centre[0] + p[0], centre[1] + p[1], centre[2] + p[2]];
}

export function moonAt(moon, planet, t) {
  const a = moon.phase + turn(moon.revs, t);
  const x = moon.orbit * Math.cos(a);
  const z = moon.orbit * Math.sin(a);
  const c = Math.cos(moon.tilt);
  const s = Math.sin(moon.tilt);
  const [px, py, pz] = orbitAt(planet, t);
  // The circle lies in the x-z plane, then tilts about x.
  return [px + x, py - z * s, pz + z * c];
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
