import { forward } from '../../flight/orient';

// The flight cluster's radar (FlightHud.jsx's, filled by both maps' scene.js):
// top-down in the ship's frame, nose up. A contact's x is to the ship's
// right and y ahead of it, both −1…1 of the range; past the range it's
// pinned to the rim, and one well above or below the ship says so (up).
// The range closes to a dogfight's when a hostile is near, and stays closed
// till the nearest is well clear (so it doesn't flick between the two at the
// edge). The scene gathers its contacts and points ~20 times a second, so
// `createRadar` keeps its records and reuses them: nothing is made per tick.

export const RANGE = { fight: 40, cruise: 160 };
const KEEP = 55; // a dogfight's range holds till the nearest hostile is past this
const LEVEL = 3; // (units above or below that still count as level)

const at = (a, i) => (Array.isArray(a) ? a[i] : i === 0 ? a.x : i === 1 ? a.y : a.z);

// the range for a nearest hostile `nearest` units off on the ground plane (Infinity for none), given the range it had
export const rangeFrom = (nearest, was = RANGE.cruise) => (nearest <= RANGE.fight || (was === RANGE.fight && nearest <= KEEP) ? RANGE.fight : RANGE.cruise);

export function rangeFor(ship, hostiles, was = RANGE.cruise) {
  let nearest = Infinity;
  for (const c of hostiles) nearest = Math.min(nearest, Math.hypot(at(c.at, 0) - ship.x, at(c.at, 2) - ship.z));
  return rangeFrom(nearest, was);
}

// The points for `contacts` (the first `n` of them: { id, kind, at: { x, y, z } | [x, y, z], lock }) in `ship`'s frame. With `out`, its
// records are reused (and `out.n` says how many are in use); without, a new list.
export function radarPoints(ship, contacts, range, out = [], n = contacts.length) {
  // the ship's nose on the ground plane, and its right: a quarter turn round
  // from the nose about the up axis, so that a contact to the right plots at x > 0
  const [fx, fz] = forward(ship.heading);
  const rx = -fz;
  const rz = fx;
  for (let i = 0; i < n; i++) {
    const c = contacts[i];
    const dx = at(c.at, 0) - ship.x;
    const dz = at(c.at, 2) - ship.z;
    let px = (dx * rx + dz * rz) / range;
    let py = (dx * fx + dz * fz) / range;
    const d = Math.hypot(px, py);
    const rim = d > 1;
    if (rim) {
      px /= d;
      py /= d;
    }
    const dy = at(c.at, 1) - ship.y;
    const p = (out[i] ??= { id: null, kind: null, x: 0, y: 0, up: 0, rim: false, lock: false });
    p.id = c.id;
    p.kind = c.kind;
    p.x = px;
    p.y = py;
    p.up = dy > LEVEL ? 1 : dy < -LEVEL ? -1 : 0;
    p.rim = rim;
    p.lock = Boolean(c.lock);
  }
  out.n = n;
  return out;
}

// The scene's radar for one flight: `start(ship)`, then `add` each contact (a hostile or threat counts toward the range), then
// `points(range)`. The records, the list and the points are kept between ticks.
export function createRadar() {
  const rows = [];
  const pts = [];
  let n = 0;
  let ship = null;
  let nearest = Infinity;
  let range = RANGE.cruise;
  let drawn = 0;
  return {
    start(s) {
      ship = s;
      n = 0;
      nearest = Infinity;
    },
    add(id, kind, pos, lock = false) {
      const r = (rows[n++] ??= { id: null, kind: null, at: null, lock: false });
      r.id = id;
      r.kind = kind;
      r.at = pos;
      r.lock = lock;
      if (kind === 'hostile' || kind === 'threat') {
        const d = Math.hypot(at(pos, 0) - ship.x, at(pos, 2) - ship.z);
        if (d < nearest) nearest = d;
      }
    },
    // the range for what's been added, with the last one's hysteresis
    get range() {
      range = rangeFrom(nearest, range);
      return range;
    },
    points(r) {
      return radarPoints(ship, rows, r, pts, n);
    },
    // whether it's time to draw it again, `hz` times a second at most (it is read every frame)
    due(clock, hz = 20) {
      if (clock - drawn < 1 / hz) return false;
      drawn = clock;
      return true;
    },
  };
}
