// A break, split as Chaos splits destruction (the GPU-first design's N5;
// the research note's "Virtual texturing, World Partition, Niagara,
// Chaos"): the few pieces big enough to matter to a player become Rapier
// hulls they can walk into, and everything else is a burst of particles on
// the GPU that never reads back. Pure: no three.js, no DOM, no engine.
//
// The numbers, `_source` the design's N5 and its plan's Global Constraints:
// a piece over 0.5 m is a hull, at most 8 a break and 64 live (a ragdoll's
// bodies counted among them), a hull asleep 2 s becomes a static instance
// and frees its slot; a burst is 200 to 2,000 particles. Between the floor
// and the ceiling, the burst grows with the face broken (200 a square metre
// of the break's size: a 1 m crate is the floor, a 3.2 m wall the ceiling;
// this lane's choice, to be tuned on the laptop) and by 25 a hull-sized
// piece the cap turned away (its rubble, as particles).
//
//   splitBreak({ size, mass, pieces }, { room = BREAK.hullsPerBreak }) →
//     { hulls, wanted (the hulls before the cap's room), sizes (the hulls'
//       pieces, biggest first), masses (by volume), burst }
//     size: the broken thing's largest extent (m); mass (kg); pieces: the
//     pieces' sizes (m), or how many equal pieces (each size ÷ ∛n); room:
//     the hulls the live cap has left
//   createHullCap({ max = BREAK.live }) → { take(n) → granted, give(n),
//     hold(n) → release() (counted even past the cap: a ragdoll always
//     falls; the breaks wait), room(), stats() → { live, held, max, refused } }

export const BREAK = Object.freeze({
  hullOver: 0.5, // m
  hullsPerBreak: 8,
  live: 64,
  sleepToStatic: 2, // s asleep
  burstMin: 200,
  burstMax: 2000,
  burstPerM2: 200,
  burstPerHull: 25,
  _source: 'docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md §4 N5 and docs/superpowers/plans/2026-10-11-gpu-first-laneN5-sim.md (0.5 m, 8, 64, 2 s, 200 to 2,000); burstPerM2 and burstPerHull this lane’s',
});

const NONE = Object.freeze({ hulls: 0, wanted: 0, sizes: [], masses: [], burst: 0 });

export function splitBreak({ size, mass = 0, pieces = 0 } = {}, { room = BREAK.hullsPerBreak } = {}) {
  if (!(size > 0) || !Number.isFinite(size)) return NONE;
  const list = Array.isArray(pieces) ? pieces.filter((p) => p > 0 && Number.isFinite(p)) : Array.from({ length: Math.max(0, Math.floor(pieces) || 0) }, () => size / Math.cbrt(pieces));
  const big = list.filter((p) => p > BREAK.hullOver).sort((a, b) => b - a);
  const wanted = Math.min(big.length, BREAK.hullsPerBreak);
  const hulls = Math.max(0, Math.min(wanted, Math.floor(room)));
  const sizes = big.slice(0, hulls);
  const volume = list.reduce((a, p) => a + p ** 3, 0) || 1;
  const m = Number.isFinite(mass) && mass > 0 ? mass : 0;
  const masses = sizes.map((p) => (m * p ** 3) / volume);
  const turnedAway = big.length - hulls;
  const burst = Math.round(Math.min(BREAK.burstMax, Math.max(BREAK.burstMin, BREAK.burstPerM2 * size * size + BREAK.burstPerHull * turnedAway)));
  return { hulls, wanted, sizes, masses, burst };
}

export function createHullCap({ max = BREAK.live } = {}) {
  let live = 0; // debris hulls
  let held = 0; // a ragdoll's bodies, and anything else that must fall
  let refused = 0;
  const room = () => Math.max(0, max - live - held);
  return {
    take(n) {
      const want = Math.max(0, Math.floor(n) || 0);
      const got = Math.min(want, room());
      live += got;
      refused += want - got;
      return got;
    },
    give(n) {
      live = Math.max(0, live - Math.max(0, Math.floor(n) || 0));
    },
    hold(n) {
      const k = Math.max(0, Math.floor(n) || 0);
      held += k;
      let gone = false;
      return () => {
        if (gone) return;
        gone = true;
        held -= k;
      };
    },
    room,
    stats: () => ({ live, held, max, refused }),
  };
}
