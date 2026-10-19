// One star system, made from its seed alone, so the sector generator (and a
// later one that stacks sectors in 3D) builds every system the same way: the
// star, who holds it, its planets; then the moons, ring bands and reach that
// the flight and the map need. Moons and rings have streams of their own, so
// a planet's own stream is never touched. Pure (no three.js).
//
// cultureOf(rng, d) → 'core' | 'rim' | 'drift', by distance d from the middle
// localFactions(rng, id, d) → [{ id: '<sector id>:f<k>', name }]
// systemAt(sSeed, { id, i, at, d, band, local }) → a system (sector.js's
//   shape); id is the sector's, at is the system's place, height included
// planetsOf(sysId, sysSeed, at, star, culture) → the planets
// moonsOf(planet) → [{ id: '<planet id>:k', k, name, type: 'rocky' | 'icy',
//   seed, radius, orbit, phase, revs, tilt }]
// ringBandOf(planet) → { inner, outer } | null
// systemReach(system) → how far from its star anything in it reaches
// addBodies(sector) → a copy whose systems have reach and whose planets have
//   centre, revs, moonList and ringBand; nothing it had changes

import { designation, nameOf } from "./names";
import { revsFor } from "./orbits";
import {
  hash64,
  int,
  moonSeed,
  pick,
  planetSeed,
  range,
  rngOf,
  weighted,
} from "./seed";
import {
  FACTION_KINDS,
  PLANET_TYPES,
  STAR_CLASSES,
  hazardWeights,
} from "./tables";

const ORBIT_MAX = 2600;
const ICY = { ice: 0.8, gas: 0.5, ringed: 0.6 };
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function cultureOf(rng, d) {
  if (d <= 2) return "core";
  if (d <= 6) return rng() < 0.15 * (d - 2) - 0.1 ? "drift" : "rim";
  return rng() < 0.15 ? "rim" : "drift";
}

export function localFactions(rng, id, d) {
  return Array.from({ length: int(rng, 1, 2) }, (_, k) => {
    const name = `${nameOf(rng, cultureOf(rng, d))} ${pick(rng, FACTION_KINDS)}`;
    return { id: `${id}:f${k}`, name };
  });
}

export function planetsOf(sysId, sysSeed, at, star, culture) {
  const rng = rngOf(hash64(sysSeed, "planets"));
  const want = int(rng, 1, 7);
  const planets = [];
  let orbit = star.size * 3,
    lastR = 0;
  for (let j = 0; j < want; j++) {
    const seed = planetSeed(sysSeed, j);
    const pr = rngOf(seed);
    const kind = weighted(pr, PLANET_TYPES);
    const radius = Math.round(range(pr, ...kind.radius));
    if (j) orbit += 2 * Math.max(radius, lastR) + range(pr, 40, 400);
    if (orbit > ORBIT_MAX) break;
    const a = pr() * Math.PI * 2;
    planets.push({
      id: `${sysId}:${j}`,
      name: nameOf(pr, culture),
      type: kind.type,
      radius,
      color: pick(pr, kind.colors),
      at: [
        at[0] + Math.cos(a) * orbit,
        at[1] + range(pr, -40, 40),
        at[2] + Math.sin(a) * orbit,
      ],
      orbit,
      moons: int(pr, ...kind.moons),
      rings: pr() < kind.rings,
      seed,
    });
    lastR = radius;
  }
  return planets;
}

export function systemAt(sSeed, { id, i, at, d, band, local }) {
  const sr = rngOf(sSeed);
  const culture = cultureOf(sr, d);
  const cls = weighted(sr, STAR_CLASSES);
  const star = {
    class: cls.class,
    color: cls.color,
    size: Math.round(range(sr, ...cls.size)),
  };
  const f = weighted(sr, band);
  const faction =
    f.id === "generated" ? pick(sr, local) : { id: f.id, name: f.name };
  const sysId = `${id}:${i}`;
  return {
    id: sysId,
    i,
    name: nameOf(sr, culture),
    designation: designation(sr),
    at,
    seed: sSeed,
    culture,
    star,
    planets: planetsOf(sysId, sSeed, at, star, culture),
    faction,
    traffic: clamp(0.9 - 0.08 * d + range(sr, -0.15, 0.15), 0.05, 1),
    hazard: weighted(sr, hazardWeights(d), ([, w]) => w)[0],
  };
}

// its own stream, so the planet's is the same whether or not it has rings
export function ringBandOf(planet) {
  if (!planet.rings) return null;
  const rng = rngOf(hash64(planet.seed, "rings"));
  const r = planet.radius;
  const inner = range(rng, 1.3, 1.6) * r;
  const outer = inner + range(rng, 0.2 * r, 2.4 * r - inner);
  return { inner, outer };
}

// the moons share the span between the rings (or 1.8 r) and 4.4 r, one slot
// each, so their orbits can only rise
export function moonsOf(planet) {
  const r = planet.radius;
  const ring = ringBandOf(planet);
  const lo = Math.max(1.8 * r, ring ? ring.outer : 0);
  const slot = (4.4 * r - lo) / (planet.moons || 1);
  const moons = [];
  for (let k = 0; k < planet.moons; k++) {
    const seed = moonSeed(planet.seed, k);
    const rng = rngOf(seed);
    const orbit = lo + (k + range(rng, 0.2, 1)) * slot;
    moons.push({
      id: `${planet.id}:${k}`,
      k,
      name: `${planet.name} ${NUMERALS[k]}`,
      type: rng() < (ICY[planet.type] ?? 0.15) ? "icy" : "rocky",
      seed,
      radius: Math.max(3, range(rng, 0.08, 0.25) * r),
      orbit,
      phase: rng() * Math.PI * 2,
      revs: revsFor(orbit),
      tilt: range(rng, -0.35, 0.35),
    });
  }
  return moons;
}

export function systemReach(system) {
  let reach = system.star.size * 3;
  for (const p of system.planets) {
    const last = p.moonList?.at(-1);
    const out = Math.max(
      p.radius,
      p.ringBand ? p.ringBand.outer : 0,
      last ? last.orbit + last.radius : 0,
    );
    reach = Math.max(reach, p.orbit + out);
  }
  return reach;
}

export function addBodies(sector) {
  return {
    ...sector,
    systems: sector.systems.map((s) => {
      const planets = s.planets.map((p) => ({
        ...p,
        centre: s.at,
        revs: revsFor(p.orbit),
        moonList: moonsOf(p),
        ringBand: ringBandOf(p),
      }));
      const withBodies = { ...s, planets };
      return { ...withBodies, reach: systemReach(withBodies) };
    }),
  };
}
