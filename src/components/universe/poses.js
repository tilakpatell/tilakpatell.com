// Fixed camera poses on the universe map, for measuring it: the same
// picture before and after a change (scripts/universe-check.mjs takes each
// through scene.js's DEV hook, `window.__universe().pose(name)`).
//
// poseFor(name) works each out in the map's own space:
// - `at`: where the ship is held, and `heading` (ship.js's: forward is
//   (−sin h, −cos h)), level;
// - `eye` and `look`: where the camera is and the point it looks at;
// - `planet` (the one the pose is about), `view: 'map'` (the whole-map
//   overview) or `foot` (landed on that planet).
// A planet pose puts the ship `dist` reaches out on the planet's sun side
// (turned `off` radians round from the line to the sun, so a limb shows
// its terminator), facing the planet, the camera just behind it: the day
// side toward the camera, which is how a visitor should arrive. A nebula
// pose is about one of deep space's clouds (deep.js's WONDERS, drawn by
// nebula/): `inside` it, that share of its radius in from its middle on the
// home side, facing its heart; or `out` from it, as the Maw pose looks at
// the Maw (scripts/nebula-check.mjs measures it from there).
import { WONDERS } from './deep';
import { BELT, HOME_RADIUS, ORDER, POSITIONS, REACH, SUN } from './layout';
import { MAW } from './maw';
import { SHIP, parkAt } from './ship';
import { byId } from './universes';

export const POSES = {
  overview: { view: 'map', at: [0, SHIP.height, HOME_RADIUS + 1.5], heading: 0 },
  // three-quarter on and from a little above, the home sun right behind it:
  // out far enough (in its radii) that the sun's edge is in frame, raised
  // `up` radians, over the belt, so the eye looks down across the ship's top
  'falcon-sun': { sunward: SUN.r * 3.8, up: 0.3, back: 1.2, side: 0.2, turn: Math.PI / 4 },
  'middleearth-limb': { planet: 'middleearth', dist: 1.75, off: 0.5 },
  rickmorty: { planet: 'rickmorty', dist: 2.4, off: 0 },
  gaming: { planet: 'gaming', dist: 2.4, off: 0 },
  caribbean: { planet: 'caribbean', dist: 2.4, off: 0 },
  // and the three whose maps were rebaked for parking distance (the near maps, nearMaps.js)
  middleearth: { planet: 'middleearth', dist: 2.4, off: 0 },
  breakingbad: { planet: 'breakingbad', dist: 2.4, off: 0 },
  office: { planet: 'office', dist: 2.4, off: 0 },
  // in the belt, along it, rocks round the ship
  belt: { ring: (BELT.inner + BELT.outer) / 2, angle: 2.2, back: 1.6, rise: 0.35 },
  // as the README's hero: the Maw off to the right, outside its pull
  maw: { out: MAW.reach * 1.35, aside: 0.36, back: 1.6, rise: 0.22 },
  'landing-middleearth': { planet: 'middleearth', dist: 1.6, off: 0, foot: 'middleearth' },
  // parked at the Home station as the autopilot parks, from the overview's
  // side: the home system up close, and how big it is against the ship
  station: { station: 'home', back: 1.6, rise: 0.3 },
  // since the spread (scale.js's SPREAD): at the home system's edge looking
  // out at the furthest world, every world past where it's real a star
  // (farStars.js)
  'far-rim': { rim: 60, back: 1.6, rise: 0.3 },
  // in the Cradle's gas, its fog round the ship, facing its bright heart
  'in-nebula': { nebula: 'cradle', inside: 0.45, back: 1.6, rise: 0.3 },
  // out on the home side of the Veil, looking a little to its left, so it
  // sits about 6° right of the middle and stays in view 5,000 to the right
  'veil-side': { nebula: 'veil', out: 20000, aside: 0.105, back: 1.6, rise: 0.3 },
};
export const POSE_NAMES = Object.keys(POSES);

const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const unit = (a) => {
  const l = Math.hypot(...a) || 1;
  return a.map((v) => v / l);
};
// level directions: a heading's forward, and the heading of a direction
const ahead = (h) => [-Math.sin(h), 0, -Math.cos(h)];
const headingOf = (d) => Math.atan2(-d[0], -d[2]);
const turnY = (d, a) => [d[0] * Math.cos(a) + d[2] * Math.sin(a), d[1], -d[0] * Math.sin(a) + d[2] * Math.cos(a)];
const UP = [0, 1, 0];

// the camera behind a level ship, a little above, looking past it
const chase = (at, heading, { back = 1.6, rise = 0.3, look = null } = {}) => {
  const f = ahead(heading);
  return { eye: add(add(at, f, -back), UP, rise), look: look ?? add(at, f, 40) };
};
// `out` from a thing on its `home` side, level, facing a point `aside` (of
// out) to its left, so the thing sits that far right of the middle
const aside = (c, home, { out, aside: k, back, rise }) => {
  const at = add(c, home, out);
  const look = add(c, turnY(home, -Math.PI / 2), out * k);
  const heading = headingOf(unit(sub(look, at)));
  return { at, heading, ...chase(at, heading, { back, rise, look }) };
};

export function poseFor(name, { positions = POSITIONS, sun = SUN.at, reach = REACH } = {}) {
  const p = POSES[name];
  if (!p) return null;
  if (p.planet) {
    const c = positions[p.planet];
    // along the level line to the sun (a planet's sun is seldom far above
    // or below it), turned `off` round
    const toSun = turnY(unit([sun[0] - c[0], 0, sun[2] - c[2]]), p.off);
    const at = add(c, toSun, p.dist * reach[p.planet]);
    const heading = headingOf([-toSun[0], 0, -toSun[2]]);
    return { name, planet: p.planet, dist: p.dist, foot: p.foot ?? null, at, heading, ...chase(at, heading, { back: 2.4, rise: 0.25, look: c }) };
  }
  if (p.view === 'map') return { name, view: 'map', at: p.at, heading: p.heading, eye: null, look: null };
  if (p.nebula) {
    const w = WONDERS.find((x) => x.id === p.nebula);
    const home = unit([sun[0] - w.at[0], 0, sun[2] - w.at[2]]);
    if (p.inside !== undefined) {
      const at = add(w.at, home, p.inside * w.r);
      const heading = headingOf([-home[0], 0, -home[2]]);
      return { name, nebula: p.nebula, at, heading, ...chase(at, heading, { back: p.back, rise: p.rise, look: w.at }) };
    }
    return { name, nebula: p.nebula, ...aside(w.at, home, p) };
  }
  if (name === 'falcon-sun') {
    // out from the sun a way, the eye further out on the same line (a
    // little aside), so the ship's against the sun
    const level = unit([0.6, 0, 0.8]);
    const away = add(level.map((v) => v * Math.cos(p.up)), UP, Math.sin(p.up));
    const at = add(sun, away, p.sunward);
    const eye = add(add(at, away, p.back), turnY(level, Math.PI / 2), p.side);
    return { name, at, heading: headingOf(turnY(level, Math.PI + p.turn)), eye, look: at };
  }
  if (p.station) {
    const k = parkAt(p.station, [0, HOME_RADIUS]);
    const at = [k.x, k.y, k.z];
    return { name, station: p.station, at, heading: k.heading, ...chase(at, k.heading, { back: p.back, rise: p.rise, look: positions[p.station] }) };
  }
  if (name === 'far-rim') {
    const far = ORDER.filter((id) => byId(id).kind !== 'core').reduce((a, b) => (Math.hypot(positions[a][0], positions[a][2]) > Math.hypot(positions[b][0], positions[b][2]) ? a : b));
    const out = unit([positions[far][0], 0, positions[far][2]]);
    const at = add([0, SHIP.height, 0], out, HOME_RADIUS + p.rim);
    const heading = headingOf(out);
    return { name, toward: far, at, heading, ...chase(at, heading, { back: p.back, rise: p.rise, look: positions[far] }) };
  }
  if (name === 'belt') {
    const at = [p.ring * Math.cos(p.angle), 0, p.ring * Math.sin(p.angle)];
    // along the ring, the way the rocks go round
    const heading = headingOf([-Math.sin(p.angle), 0, Math.cos(p.angle)]);
    return { name, at, heading, ...chase(at, heading, p) };
  }
  // the Maw: out on the home side of it, level, facing a point to its left
  return { name, ...aside(MAW.at, unit([sun[0] - MAW.at[0], 0, sun[2] - MAW.at[2]]), p) };
}
