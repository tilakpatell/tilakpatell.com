// The scene's travel (moved out of scene.js whole): the autopilot's trips,
// the jump, reduced motion's arrival, the war front as a place and a trip to
// another pilot. Behaviour is the block's as it was; what scene.js declares
// below the call, or changes later, comes in as a thunk read each time
// (`props`, `front`, `powers`, `unique`, `heard`), never as a value kept at
// creation.
//
// createTrips({ state, props, emit, pilots, front, powers, unique, heard,
//   retarget, invalidate, reduced, onFoot, wall, settle })
//   resolve(id) → Destination | null: a generated place among the sectors
//     the scene has (places/resolve.js, never building one)
//   fetch(id) → Promise<Destination | null>, missing(id) → true when the
//     id's sector isn't at hand: the worker pool's, optional
//   → { travel(id, drive), dropAuto(), arriveAt(park), navTo(id),
//       frontSpace(), withPilot(name), pilotGone(id, name), chasePilot(),
//       followPlace(), outOfJump(j) → park, endTrip(id) }
//
// A generated place (an `E:` id in any spelling) is gone to as it is now: its
// park moves with it (park.js's followPark), a jump comes out where it is at
// the flash, and one whose sector isn't made yet waits for the pool's fetch
// (state.pending), which a later trip, a drop, the stick or a crash calls off.
// A trip's end is state.arrived, a new object each time.

import { HYPER, driveById, hyperState, legOf, parkFor } from './nav';
import { portalById } from './portals';
import { OPEN_SPACE, headingTo, isGoal } from './ship';
import { atTime, canonicalPlace } from './places/ids';
import { followPark, parkPlace, placeSpace } from './places/park';
import { REAIM_MS, parkBehind, pilotId, pilotSpace, reached } from './pilotGoal';
import { JAMMED, jumpState } from './words';

export function createTrips(deps) {
  const { state, emit, pilots, reduced, onFoot, wall } = deps;
  // the autopilot's trip dropped before it's done (the pilot, a rift, the
  // page): the page hears, so a tour or a trip on through the gate ends
  const dropAuto = () => {
    state.then = null; // (and a trip on through a portal with it)
    state.arrived = state.pending = null;
    if (!state.auto) return;
    const id = state.auto.id;
    state.auto = null;
    emit({ type: 'arrived', id, done: false });
  };
  const travel = (id, drive = deps.props().drive) => {
    state.arrived = state.pending = null;
    const placeId = canonicalPlace(id);
    if (placeId) return toPlace(placeId, drive);
    const s = state.ship;
    // (another pilot, `pilot:<id>`, is somewhere to go while they're flying
    // here in sight: pilots.js's pose, and pilotGoal.js)
    const pid = pilotId(id);
    const pose = pid ? pilots.pose(pid) : null;
    if (!s || state.crash || state.dive || state.jump || deps.props().frozen || onFoot() || !(isGoal(id) || (id === 'front' && deps.front()) || pose)) return false;
    // (somewhere in the other sector of the map: to the portal first, and on
    // from its far end once through: portalThrough. nav.js legOf)
    const leg = id === 'front' ? id : legOf(s, id, pose);
    if (leg !== id) {
      if (!travel(leg, drive)) return false;
      state.then = { id, drive, name: pose?.name ?? null };
      return true;
    }
    state.then = null;
    // (the Maw's own spot is past its point of no return: to the edge of its pull instead; the
    // front's is just inside the fight, on your side of it; a pilot's, behind them)
    const park = id === 'front' ? frontPark([s.x, s.z]) : pose ? parkBehind(pose) : parkFor(id, [s.x, s.z]);
    if (!park) return false;
    return setOff(id, park, drive, pose, pid, null);
  };
  // under way to a park (travel's, the same for a place on the map, a pilot
  // and a generated place): the jump if it's charged, else the autopilot, or
  // simply there with reduced motion. `place` is a generated place's { dest,
  // park }, which its trip follows as it moves
  const setOff = (id, park, drive, pose, pid, place) => {
    const s = state.ship;
    deps.heard();
    state.view = state.seat;
    state.lastInput = performance.now();
    if (!state.flown) {
      state.flown = true;
      emit({ type: 'launch' });
    }
    if (reduced) {
      state.auto = null;
      arriveAt(place ? followPark(place.dest, park, state.spaceT) : park);
      if (pose) withPilot(pose.name);
      deps.invalidate();
      if (!portalById(id)) setTimeout(() => emit({ type: 'arrived', id, done: true }), 0); // (there: the page's tour and a trip through the gate go on; after the page's own select. Through a portal, its trip ends at the far end: portalThrough)
      return true;
    }
    const hyper = drive === 'hyper' ? hyperState({ last: state.hyperAt, now: wall(), interdicted: state.interdicted, recharge: HYPER.recharge * (state.stats.jump ?? 1) }) : null;
    if (hyper?.ready) {
      // the jump, the galaxy's way: the ship comes round onto the place
      // first (fly(): `align`, aim.js), then spools up, the page plays the
      // site's own jump over the map, and at its flash the ship's out at
      // the place
      state.auto = null;
      const dx = park.x - s.x;
      const dy = park.y - s.y;
      const dz = park.z - s.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      deps.powers().cancel();
      deps.unique().clear();
      state.jump = { id, park, phase: 'align', age: 0, dir: [dx / l, dy / l, dz / l], at: Infinity, name: pose?.name ?? null, place };
    } else {
      if (hyper) {
        // (not yet: on super speed instead, and the HUD says why)
        emit({ type: 'hyper', why: hyper.why, wait: hyper.wait });
        state.note = { text: hyper.why === 'interdicted' ? JAMMED.long : `${jumpState(false, hyper.wait)}: super speed instead`, until: wall() + 3.5 };
      }
      state.auto = { id, park, od: driveById(hyper ? 'super' : drive).od };
      if (place) Object.assign(state.auto, { place, space: placeSpace(OPEN_SPACE, place.dest) });
      // (a pilot moves: where they'll be parked behind is worked out again every REAIM_MS, chasePilot)
      if (pose) Object.assign(state.auto, { pilot: pid, name: pose.name, drive, space: pilotSpace(OPEN_SPACE, pid, pose), reaimAt: performance.now() + REAIM_MS });
    }
    deps.retarget(700);
    deps.invalidate();
    return true;
  };
  // a generated place: gone to now when the scene has it, else waited for
  // while the pool makes its sector; never when its sector is at hand and
  // hasn't got it (E:1,0:0:99), which is nowhere
  const toPlace = (id, drive) => {
    const s = state.ship;
    if (!s || state.crash || state.dive || state.jump || deps.props().frozen || onFoot()) return false;
    const dest = deps.resolve?.(id);
    if (dest) return go(dest, drive);
    if (!deps.fetch || !deps.missing?.(id)) return false;
    const pending = { id, drive };
    state.pending = pending;
    const gone = (d) => {
      if (state.pending !== pending) return; // (called off, or something else came first)
      state.pending = null;
      if (!d || !go(d, pending.drive)) emit({ type: 'arrived', id, done: false });
    };
    let ask;
    try {
      ask = Promise.resolve(deps.fetch(id)); // (asked now, so the pool starts at once)
    } catch {
      ask = Promise.resolve(null);
    }
    ask.then(gone, () => gone(null));
    return true;
  };
  const go = (dest, drive) => {
    const s = state.ship;
    if (!s || state.crash || state.dive || state.jump || deps.props().frozen || onFoot()) return false;
    const { id } = dest;
    // (from the Curve, by the portal home first, and on from its far end)
    const leg = legOf(s, id);
    if (leg !== id) {
      if (!travel(leg, drive)) return false;
      state.then = { id, drive, name: null };
      return true;
    }
    state.then = null;
    const park = parkPlace(dest, [s.x, s.z], state.spaceT);
    if (!park) return false;
    return setOff(id, park, drive, null, null, { dest, park });
  };
  // the ship put straight down at a parking spot, still, level and facing
  // the place (reduced motion's trip, and a jump's way out of hyperspace)
  const arriveAt = (park) => {
    state.ship = { ...state.ship, ...park, speed: 0, vy: 0, lift: 0, pitch: 0, bank: 0, rate: 0, tipRate: 0, rollRate: 0, lean: 0, edge: false };
    state.yaw = -state.ship.heading;
    deps.settle();
  };
  const navTo = (id) => travel(id);
  // the war's front as somewhere the autopilot can go (front.js's goal):
  // parked just inside the fight on the side you come from, facing it
  const frontPark = ([x, z]) => {
    const g = deps.front()?.goal();
    if (!g) return null;
    const dx = x - g.at[0];
    const dz = z - g.at[2];
    const l = Math.hypot(dx, dz) || 1;
    return { x: g.at[0] + (dx / l) * g.reach, y: g.at[1], z: g.at[2] + (dz / l) * g.reach, heading: headingTo(-dx / l, -dz / l) };
  };
  const frontSpace = () => ({ ...OPEN_SPACE, goals: { ...OPEN_SPACE.goals, front: deps.front().goal() } });
  // Flying to another pilot (travel's `pilot:<id>`): there once within reach
  // of them, the HUD says who you're with; gone (offline, hidden, down on a
  // planet, blocked, off to another page) and the trip ends, the autopilot
  // off and their goal with it, and the HUD says so. Their name is only
  // ever the note's text (placePrompt sets it as textContent)
  const withPilot = (name) => {
    state.note = { text: `With ${name ?? 'them'}`, until: wall() + 3.5 };
  };
  const pilotGone = (id, name) => {
    state.note = { text: `${name ?? 'They'} ${name ? 'has' : 'have'} gone`, until: wall() + 3.5 };
    emit({ type: 'lost', id, name: name ?? null });
  };
  // each frame of a trip to a pilot, before the autopilot flies it (or on
  // the way to the portal, for one in the other sector): ended if they're
  // gone or reached, else re-aimed at where they are every REAIM_MS
  const chasePilot = () => {
    const a = state.auto;
    const then = !a?.pilot && state.then && pilotId(state.then.id) ? state.then : null;
    if (!a || !(a.pilot || then)) return;
    const id = a.pilot ? a.id : then.id;
    const name = a.pilot ? a.name : then.name;
    const pose = pilots.pose(pilotId(id));
    const park = parkBehind(pose);
    if (!park) {
      // (dropAuto: the page hears the trip's off; then why)
      dropAuto();
      pilotGone(id, name);
      return;
    }
    if (!a.pilot) return; // (on to the portal: the trip on to them is worked out at its far end)
    if (reached(state.ship, pose)) {
      state.auto = null;
      withPilot(name);
      emit({ type: 'arrived', id, done: true });
      return;
    }
    const now = performance.now();
    if (now < a.reaimAt) return;
    // (gone through a portal ahead of you: after them, by it)
    if (legOf(state.ship, id, pose) !== id) {
      state.auto = null;
      if (!travel(id, a.drive === 'hyper' ? 'super' : a.drive)) emit({ type: 'arrived', id, done: false });
      return;
    }
    a.reaimAt = now + REAIM_MS;
    a.park = park;
    a.space = pilotSpace(OPEN_SPACE, a.pilot, pose);
  };

  // each frame of a trip to a generated place: its park where the place is
  // now, and its goal in the autopilot's space with it
  const followPlace = () => {
    const a = state.auto;
    if (!a?.place) return;
    a.park = followPark(a.place.dest, a.place.park, state.spaceT);
    const g = a.space?.goals?.[a.id];
    if (g) atTime(a.place.dest, state.spaceT, g.at);
  };
  // out of hyperspace: where to come out (a pilot's, behind them as they are
  // now; a place's, where it is at the flash; else the jump's park)
  const outOfJump = (j) => {
    const pid = pilotId(j.id);
    const pose = pid ? pilots.pose(pid) : null;
    const park = j.place ? followPark(j.place.dest, j.place.park, state.spaceT) : (parkBehind(pose) ?? j.park);
    if (pid && pose) withPilot(pose.name);
    else if (pid) pilotGone(j.id, j.name);
    state.arrived = { id: j.id };
    return park;
  };
  // the autopilot's done: the page hears, and the trip's end is an arrival
  const endTrip = (id) => {
    state.auto = null;
    emit({ type: 'arrived', id, done: true }); // (the page's tour, and a trip on through the gate, go on from here)
    state.arrived = { id };
  };
  return { travel, dropAuto, arriveAt, navTo, frontSpace, withPilot, pilotGone, chasePilot, followPlace, outOfJump, endTrip };
}
