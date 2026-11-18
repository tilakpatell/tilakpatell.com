// Which star lights a point on the universe map, as plain numbers (the scene
// turns them into its lights; tested in Node).
//
// Every star is a light: the home sun, the suns out in deep space, both of
// the Twins (going round each other: their solids' positions, which
// deep.js's moveBinaries keeps up to date), the pulsar and the white dwarf,
// each with a colour, a strength and a reach. A star's weight at a point is
// its strength over the square of the distance (no more than at its own
// surface), cut off softly between its reach and half again. The heaviest
// is the key light, coming from that star; the second, if it counts for a
// tenth of the first, the fill; else a cool fill from the far side of the
// key and below, as the map always had one. Deep space between the stars is never black: the key
// is floored. Inside a nebula the ambient takes a quarter of its colour.
//
// STARS → [{ id, at, r, colour, strength, reach }]
// weightOf(star, point) → its weight there
// lightAt(point, { stars, nova }) → { key, fill: { id, dir (from the star
//   toward the point, unit), colour (linear [r, g, b]), strength }, ambient }
//   (`nova`, { at, colour, strength } while one burns, is one more star)
// sunFor(id, { positions, stars }) → the unit direction from a planet toward
//   the star that lights it
// daySideApproach(at, sunDir, radius, from, { dist }) → a point `dist`
//   radii from `at` on the side facing `sunDir`, as near the way `from` is
//   as it can be: arrivals see a lit world, not a black disc
// dayYaw(sunDir) → the turn of the map (about its up axis, as the scene's
//   map.rotation.y) that brings `sunDir` round to point at the camera, which
//   looks from +z: a world picked on the map is seen from its day side

import { POSITIONS, SUN } from './layout';
import { DEEP_SOLIDS, WONDERS } from './deep';
import { SPREAD } from './scale';

const solidAt = (id) => DEEP_SOLIDS.find((o) => o.id === id)?.at;

// (the reaches are the map's since it was scaled up, scale.js, and spread
// (SPREAD): the worlds lie 8,000 to 23,000 out from the home sun, the deep
// stars among them; every reach grows with the gaps, so each star lights
// what it lit before)
export const STARS = [
  { id: 'sun', at: SUN.at, r: SUN.r, colour: '#ffd6a8', strength: 1, reach: 9000 * SPREAD },
  // (a star can light further, as the home sun does, `light` says: the Rick and Morty sector's sun lights all of its sector, deep.js)
  ...WONDERS.filter((w) => w.kind === 'star').map((w) => ({ id: w.id, at: w.at, r: w.r, colour: w.color, strength: w.light?.strength ?? 0.8, reach: w.light?.reach ?? 7000 * SPREAD })),
  ...WONDERS.filter((w) => w.kind === 'binary').flatMap((w) => [
    { id: w.id, at: solidAt(w.id) ?? w.at, r: w.r, colour: w.color, strength: 0.5, reach: 7000 * SPREAD },
    { id: `${w.id}-2`, at: solidAt(`${w.id}-2`) ?? w.at, r: w.pair.r, colour: w.pair.color, strength: 0.5, reach: 7000 * SPREAD },
  ]),
  ...WONDERS.filter((w) => w.kind === 'pulsar').map((w) => ({ id: w.id, at: w.at, r: w.r, colour: '#cfe6ff', strength: 0.3, reach: 3000 * SPREAD })),
  ...WONDERS.filter((w) => w.kind === 'graveyard').map((w) => ({ id: w.id, at: w.at, r: w.r, colour: w.color, strength: 0.25, reach: 2500 * SPREAD })),
];
const HOME = STARS[0];
const NEBULAE = WONDERS.filter((w) => w.kind === 'nebula');

export const KEY = 2.35; // the key light's strength in the home system, as the map was always lit
const FLOOR = 0.9; // and its least, out between the stars
const FILL = { colour: '#8ea2ff', strength: 0.45 };
const AMBIENT = { colour: '#b8c4ff', strength: 0.4 };

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// '#rrggbb' → linear [r, g, b]
const linear = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
};

export function weightOf(star, point) {
  const d = len(sub(point, star.at));
  const r = star.r ?? 1;
  return (star.strength / Math.max(d * d, r * r)) * smooth(star.reach * 1.5, star.reach, d);
}
// (the home sun's weight 24,000 out, past the farthest world: where the key is
// still at its full strength, so every world is lit as brightly as the map
// always lit them, in its own star's colour and from its way; only out past
// the stars does the light fall toward the floor)
export const FULL_AT = 6000 * SPREAD;
const FULL = weightOf(HOME, [FULL_AT, 0, 0]);

// the stars by weight at a point, heaviest first; past every star's reach, by
// the square of the distance alone, so there's always a nearest
function ranked(point, stars) {
  let list = stars.map((s) => ({ s, w: weightOf(s, point) })).filter((x) => x.w > 0);
  if (!list.length) list = stars.map((s) => ({ s, w: s.strength / Math.max(1, len(sub(point, s.at)) ** 2), uncut: true }));
  return list.sort((a, b) => b.w - a.w);
}

export function lightAt(point, { stars = STARS, nova = null } = {}) {
  const all = nova ? [...stars, { id: 'nova', at: nova.at, r: 1, colour: nova.colour, strength: nova.strength, reach: 4000 * SPREAD }] : stars;
  const [first, second] = ranked(point, all);
  const key = {
    id: first.s.id,
    dir: unit(sub(point, first.s.at)),
    colour: linear(first.s.colour),
    strength: first.uncut ? FLOOR : Math.max(FLOOR, KEY * Math.min(1, first.w / FULL)),
  };
  const fill =
    second && !second.uncut && second.w > first.w * 0.1
      ? { id: second.s.id, dir: unit(sub(point, second.s.at)), colour: linear(second.s.colour), strength: Math.min(1.2, Math.max(FILL.strength, KEY * Math.min(1, second.w / FULL) * 0.5)) }
      : // (else the map's cool fill: from the far side of the key, and from below)
        { id: null, dir: unit([-key.dir[0], 0.6 - key.dir[1] * 0.5, -key.dir[2]]), colour: linear(FILL.colour), strength: FILL.strength };
  // the ambient, a quarter of the way toward the colour of a nebula you're in
  let ambient = linear(AMBIENT.colour).map((c) => c * AMBIENT.strength);
  const neb = NEBULAE.find((w) => len(sub(point, w.at)) < (w.cloud ?? w.r)); // (in its gas: deep.js's cloud)
  if (neb) {
    const tint = linear(neb.colors[0]);
    ambient = ambient.map((c, i) => c * 0.75 + tint[i] * AMBIENT.strength * 0.25);
  }
  return { key, fill, ambient };
}

export function sunFor(id, { positions = POSITIONS, stars = STARS } = {}) {
  const p = positions[id];
  const [first] = ranked(p, stars);
  return unit(sub(first.s.at, p));
}

export const dayYaw = (sun) => Math.atan2(-sun[0], sun[2]);

export function daySideApproach(at, sunDir, radius, from, { dist = 2.2 } = {}) {
  const s = unit(sunDir);
  const v = sub(from, at);
  let d = unit(v);
  const day = d[0] * s[0] + d[1] * s[1] + d[2] * s[2];
  if (day < 0) {
    // round to the rim of the day side, the nearest point of it to the way you came
    const k = v[0] * s[0] + v[1] * s[1] + v[2] * s[2];
    const rim = [v[0] - s[0] * k, v[1] - s[1] * k, v[2] - s[2] * k];
    // (straight from behind: any way round will do; level, if it can be)
    d = len(rim) > 1e-6 * (len(v) || 1) ? unit(rim) : unit(Math.abs(s[1]) < 0.9 ? [-s[2], 0, s[0]] : [1, 0, 0]);
  }
  return [at[0] + d[0] * dist * radius, at[1] + d[1] * dist * radius, at[2] + d[2] * dist * radius];
}
