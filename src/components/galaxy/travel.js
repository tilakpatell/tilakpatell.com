// Between the galaxy and a world's surface, flown and not cut: the ship
// dives on the planet in space (planDive, diveAt: scene.js flies it), the
// page hands the runtime over to the surface module while the air glows
// round it (pages/Galaxy.jsx), and the surface goes on with the landing.
// Taking off is the same the other way (pages/GalaxySurface.jsx). What's
// kept on each world (what you've found, the quests done) is read here, so
// the galaxy page can make the surface's world before its page is up.

import { local } from '../../lib/hooks';

export const FOUND_KEY = 'tp-galaxy-found'; // { [system]: [place ids] }: what you've found on each world
export const QUESTS_KEY = 'tp-galaxy-quests'; // { [system]: [quest ids] }: what you've done on each world
export const LAUNCH_KEY = 'tp-galaxy-launch'; // (session) the world you've just taken off from

const readAll = (key) => {
  const all = local.get(key);
  return all && typeof all === 'object' ? all : {};
};
export const readFound = () => readAll(FOUND_KEY);
export const readDone = () => readAll(QUESTS_KEY);

// what the surface module is made with when the galaxy hands over to it
// (its page's own props replace these once it's up: the compass is its)
export function surfaceProps(system, { ship, loadout, build = null, net = null, reduced = false }) {
  const found = readFound()[system];
  const done = readDone()[system];
  return {
    system,
    mission: null,
    ship,
    loadout,
    build,
    found: Array.isArray(found) ? found : [],
    done: Array.isArray(done) ? done : [],
    compass: { current: null },
    net,
    reduced,
  };
}

// the surface's code, fetched while you're still flying at the planet
let fetched = null;
export const prefetchSurface = () => (fetched ??= Promise.all([import('./surface/scene'), import('./surface/module')]).catch(() => (fetched = null)));

// The dive: from where the ship is, straight down on the planet (at the
// origin, radius r) to just over its air, slow then faster and faster.
export const DIVE = 1.4; // seconds
export function planDive(ship, r) {
  const d0 = Math.hypot(ship.x, ship.y, ship.z) || 1;
  const dir = d0 > 1e-6 ? [ship.x / d0, ship.y / d0, ship.z / d0] : [0, 0, 1];
  return { age: 0, d0, d1: Math.min(d0, r * 1.08), dir };
}
// where the dive has the ship at `age` seconds in: its place, its heading
// (nose on the planet), and how far through it is (k, 0…1)
export function diveAt(dive, age) {
  const k = Math.min(1, Math.max(0, age / DIVE));
  const e = k * k * k;
  const d = dive.d0 + (dive.d1 - dive.d0) * e;
  const [x, y, z] = dive.dir;
  return { x: x * d, y: y * d, z: z * d, heading: Math.atan2(x, z), k };
}
