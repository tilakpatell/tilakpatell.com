// What a pilot can do with a thing in space, as rules: what each kind lets you
// do (its verb, the key E in the prompt and the card's button), what it pays
// through the universe's existing earning (economy.js's EARN.found, times a
// share), and what it does to the ship. Pure (no React, DOM or three.js).
// Nothing is stored: the ledger of what's paid once is for the visit.
//
// ACTIONS: { [kind]: { verb, times, once, near } }: verb is a THINGS key (words.js), times is
//   how many `found`s it pays, once whether only once a thing a visit, near how close (in its
//   sizes, past its reach) the ship must be
// actionOf(kind) → ACTIONS' row, or null for a kind you only look at or park by
// createLedger() → { paid(id) → boolean, pay(id, times = 1, cap = 1) → number of founds paid now }
// act(ledger, { kind, id, row, traits }) → { pay: n, verb, lore?, leads?, trap?, hostile? }: what
//   pressing E there does, once the ship is near enough (actionOf's `near`)
// stormDrain(shields, dt) → the shields after dt seconds in an ion storm: 4 a second, never
//   below 10, and no hit (no laser event, no shake: the scene's drain, not its hurt)
// inBeam(dirs, at, ship, size) → true when the ship is in one of a pulsar's beams (its
//   cone of 25 sizes, a tenth of a radian wide): the HUD scrambles for SCRAMBLE seconds
// wormholeThrows(row, ship, { travelling }) → true when the ship flown by hand is in the throat
//   (0.45 of its size), never mid-trip
// TAIL = { secs, times }: how long inside a comet's tail pays, and how much

export const STORM = Object.freeze({ drain: 4, floor: 10 });
export const SCRAMBLE = 1.2;
export const TAIL = Object.freeze({ secs: 2, times: 1 });
export const ORE_CAP = 5; // rocks of one field a visit
const THROAT = 0.45;
const BEAM_WIDTH = 0.1;

export const ACTIONS = Object.freeze({
  field: { verb: 'mine', times: 1, once: false, near: 2 },
  icefield: { verb: 'mine', times: 1, once: false, near: 2 },
  derelict: { verb: 'salvage', times: 2, once: true, near: 3 },
  outpost: { verb: 'salvage', times: 2, once: true, near: 3 },
  debris: { verb: 'salvage', times: 2, once: true, near: 1.5 },
  relay: { verb: 'scan', times: 1, once: true, near: 6 },
  monolith: { verb: 'scan', times: 3, once: true, near: 6 },
  beacon: { verb: 'follow', times: 0, once: true, near: 8 },
  fleet: { verb: 'hail', times: 0, once: true, near: 3 },
  // (a brown dwarf's and a quasar's readings: a quasar's worth three, scanned from its disc's edge)
  dwarf: { verb: 'scan', times: 1, once: true, near: 6 },
  quasar: { verb: 'scan', times: 3, once: true, near: 2 },
});

// a quasar's two jets, out of both its poles
export const jetDirs = (traits) => [traits.axis, traits.axis.map((c) => -c)];

export const actionOf = (kind) => (Object.hasOwn(ACTIONS, kind) ? ACTIONS[kind] : null);

export function createLedger() {
  const counts = new Map();
  return {
    paid: (id) => (counts.get(id) ?? 0) > 0,
    pay(id, times = 1, cap = 1) {
      const n = counts.get(id) ?? 0;
      if (n >= cap) return 0;
      counts.set(id, n + 1);
      return times;
    },
  };
}

export function act(ledger, { kind, id, traits = {}, hostile = false }) {
  const a = actionOf(kind);
  if (!a) return null;
  const cap = a.once ? 1 : ORE_CAP;
  const pay = a.times ? ledger.pay(id, a.times, cap) : ledger.pay(id, 0, 1) || 0;
  const out = { verb: a.verb, pay };
  if (kind === 'monolith' && pay) out.lore = traits.lore;
  if (kind === 'derelict' && pay) out.trap = Boolean(traits.trap);
  if (kind === 'beacon') out.leads = traits.leads;
  if (kind === 'fleet') out.hostile = Boolean(hostile);
  return out;
}

export const stormDrain = (shields, dt) => (shields <= STORM.floor ? shields : Math.max(STORM.floor, shields - STORM.drain * dt));

export function inBeam(dirs, at, ship, size, reach = 25) {
  const v = [ship[0] - at[0], ship[1] - at[1], ship[2] - at[2]];
  const d = Math.hypot(v[0], v[1], v[2]);
  if (d === 0 || d > reach * size) return false;
  return dirs.some((u) => (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / d > Math.cos(BEAM_WIDTH));
}

export function wormholeThrows(row, ship, { travelling = false } = {}) {
  if (travelling) return false;
  return Math.hypot(ship[0] - row.at[0], ship[1] - row.at[1], ship[2] - row.at[2]) < THROAT * row.size;
}
