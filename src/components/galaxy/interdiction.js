// Hyperspace interdiction: keep jumping about the galaxy and the Empire
// notices. The tenth to fifteenth jump of a cycle (the number's picked when
// the cycle starts) is the one an Imperial Interdictor cruiser is waiting
// on: its gravity-well projectors pull the ship out of hyperspace short of
// where it was going, its TIEs launch, and the hyperdrive won't take again
// until the pilot's clear of the well (the fighters gone, out past its edge,
// or a minute ridden out). Then the count starts over. A jump off the
// hyperspace lanes (routes.js) is one the Empire watches closer: it reckons
// that jump two further on, so the window comes two jumps sooner.
//
// The count and the trap are plain numbers here (tested in Node); scene.js
// cuts the jump and drops the ship, interdictor.js draws the cruiser and the
// well. The count's kept for the browser session in `store` (a string in and
// out: the scene gives it sessionStorage), so a reload or a trip down to a
// planet doesn't wipe it; anything in it that can't be believed is a fresh
// cycle.
//
// createInterdiction({ rand, store }) → { jumps, due, total, jumped(offLane) → { n, due, interdicted }, force(), reset() }
// nextWindow(n, offLane) → the jump count the Empire reckons: n, or n + 2 off the lanes
// cutAt(dur, rand) → seconds into the tunnel the well bites
// dropPoint(arrival, far, edge) → where you drop out: the arrival pushed out along its own bearing
// interdictorPlace(ship, side, rand) → { at, heading, drift, hangar }: ahead and off to one side, broadside on
// inWell(ship, at, r); holdLifts({ since, now, pack, inWell }) → why it's let go, or null
// interdictorSolids(state, at) → the cruiser as ship.js's solids once it's here, or none
// interdictionFor(war) → whose Interdictor waits in that war (hunted.js's faction), or null: the
//   Empire's in the Civil War, the Remnant's after it, and none in the Clone Wars, before there were any

import { forward } from '../universe/ship';
import { EDGE } from './space';

export const INTERDICTION = {
  jumps: [10, 15], // the jump that bites: from the tenth to the fifteenth of a cycle, inclusive
  offLane: 2, // how many jumps sooner the window comes when a jump's off the lanes
  cut: [0.4, 0.65], // where in the tunnel (of its length) the well bites
  far: 2.4, // how much further out than a normal arrival you drop
  well: 150, // the gravity well's reach, in map units
  hold: 60, // seconds, at most, the hold lasts
  launch: 1.8, // seconds after it's here before its TIEs come
  pack: 4, // how many
  ace: 0.6, // the chance a TIE Advanced leads them
  ahead: 26, // where it drops in: this far ahead of you
  aside: 9, // and off to one side
  size: 9, // map units long (600 m: a Star Destroyer's 1,600 m is 16)
};
const MIN_CUT = 1.2; // seconds: the next system's built behind the tunnel by then
const KEEP_IN = 0.8; // of the system's edge: no dropping out beyond this

const WHOSE = { gcw: 'empire', remnant: 'remnant' };
export const interdictionFor = (war) => WHOSE[war] ?? null;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const whole = (v) => Number.isInteger(v);

// the jump that bites, from the spec's range
export function pickDue(rand = Math.random) {
  const [lo, hi] = INTERDICTION.jumps;
  return lo + Math.min(hi - lo, Math.floor(clamp(rand(), 0, 0.999999) * (hi - lo + 1)));
}

// a stored count, believed only whole and in range; else a fresh cycle
export function readCount(s, rand = Math.random) {
  const fresh = () => ({ n: 0, due: pickDue(rand) });
  if (typeof s !== 'string' || !s) return fresh();
  let v;
  try {
    v = JSON.parse(s);
  } catch {
    return fresh();
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fresh();
  const [lo, hi] = INTERDICTION.jumps;
  const { n, due } = v;
  if (!whole(due) || due < lo || due > hi) return fresh();
  if (!whole(n) || n < 0 || n >= due) return fresh();
  return { n, due };
}

// the count the window's held against: a jump off the lanes counts further on
export const nextWindow = (n, offLane = false) => (offLane ? n + INTERDICTION.offLane : n);

export function createInterdiction({ rand = Math.random, store = null } = {}) {
  const read = () => {
    try {
      return store?.get() ?? null;
    } catch {
      return null;
    }
  };
  const write = (v) => {
    try {
      if (v === null) store?.set(null);
      else store?.set(JSON.stringify(v));
    } catch {
      /* no store (private mode, say): the count lives for the page */
    }
  };
  let count = readCount(read(), rand);
  let total = 0;
  return {
    get jumps() {
      return count.n;
    },
    get due() {
      return count.due;
    },
    get total() {
      return total;
    },
    // a jump that's spooling up: counted, and the verdict on it (sooner off the lanes)
    jumped(offLane = false) {
      total += 1;
      const n = count.n + 1;
      const due = count.due;
      const interdicted = nextWindow(n, offLane) >= due;
      count = interdicted ? { n: 0, due: pickDue(rand) } : { n, due };
      write(count);
      return { n, due, interdicted };
    },
    // the next jump bites (for checking it in a browser)
    force() {
      count = { n: count.n, due: count.n + 1 };
    },
    reset() {
      count = { n: 0, due: pickDue(rand) };
      write(null);
    },
  };
}

export function cutAt(dur, rand = Math.random) {
  const [lo, hi] = INTERDICTION.cut;
  const k = lo + (hi - lo) * clamp(rand(), 0, 1);
  return Math.min(Math.max(dur * k, MIN_CUT), dur - 0.2);
}

export function dropPoint(a, far = INTERDICTION.far, edge = EDGE) {
  const d = Math.hypot(a.x, a.z);
  const k = d > 1e-6 ? Math.min(far, (edge * KEEP_IN) / d) : far;
  return { x: a.x * k, y: a.y, z: a.z * k, heading: a.heading };
}

export function interdictorPlace(ship, side = 1, rand = Math.random) {
  const [fx, fz] = forward(ship.heading);
  const { ahead, aside } = INTERDICTION;
  const at = [ship.x + fx * ahead - fz * side * aside, ship.y - 0.5 + (rand() - 0.5) * 2, ship.z + fz * ahead + fx * side * aside];
  // crossing your way, slowly
  const heading = ship.heading + side * (Math.PI / 2 + 0.25);
  const [dx, dz] = forward(heading);
  const drift = [dx * 1.2, 0, dz * 1.2];
  return { at, heading, drift, hangar: [at[0], at[1] - INTERDICTION.size * 0.14, at[2]] };
}

// one sphere at its middle, SOLID of its length (INTERDICTION.size) across:
// too big to move, so flying into it is a planet's bump or crash
// (lib/combat/contact.js); nothing while it jumps in or out (a smear)
const SOLID = 0.3;
export const interdictorSolids = (state, at) => (state === 'here' && at ? [{ id: 'interdictor', at, r: INTERDICTION.size * SOLID, reach: INTERDICTION.size * SOLID, ship: true }] : []);

export const inWell = (ship, at, r = INTERDICTION.well) => Math.hypot(ship.x - at[0], ship.y - at[1], ship.z - at[2]) <= r;

// why the hold lets go: its fighters gone ('cleared', once they'd come),
// you out past the well ('clear'), or it's had its go ('time'); or not yet
export function holdLifts({ since, now, pack, inWell: within }) {
  if (now - since > INTERDICTION.hold) return 'time';
  if (pack === 'gone') return 'cleared';
  if (!within) return 'clear';
  return null;
}
