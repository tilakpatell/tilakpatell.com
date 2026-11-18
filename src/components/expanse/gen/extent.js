// How far from its middle a generated planet reaches: its body, its ring and
// its moons. It imports nothing, so a module that only needs a planet's
// extent (the universe's parking, which every page that loads its nav takes)
// doesn't bring the generator with it. Pure.
//
// extentOf(planet) → max(radius, the ring band's outer edge, the greatest
//   orbit + radius of any moon)
//
// (Not the last moon's, as systemReach measures: by moonsOf's slots an earlier,
// bigger moon can reach further. systemReach stays as it is, for the
// fingerprint.)

export function extentOf(planet) {
  let out = Math.max(planet.radius, planet.ringBand?.outer ?? 0);
  for (const m of planet.moonList ?? []) out = Math.max(out, m.orbit + m.radius);
  return out;
}
