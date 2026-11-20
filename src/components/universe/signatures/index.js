// The four crews' signatures, as rules: what each ship does that no other
// does, each growing with one of its systems' tiers (ships/profiles.js's
// `signature`). The design: docs/superpowers/specs/2026-11-18-ships-market-
// exploration-design.md, section 1, "The signatures". Pure.
//
// SIGNATURE_LINE: { [crew]: the Systems tab's sentence }
// rangeOf(core) → the jump range a hop uses: R2 plots each one a sector further
// r2Patch({ tier, since, clock }) → shield points a second R2 puts back: 4 at
//   Shields Mk I to 8 at Mk V, while under fire (a hit within the last
//   R2.under s), 3 s in every 12
// compartmentRoom(crew, room) → the Falcon's hidden units: a third of the hold
// hidden(crew, room, lots) → the lots (hold.js's) the compartments hold, the
//   dearest a unit first, up to their room; keepOnDeath is these
// inspect({ crew, room, lots, type }) → { seized: [{ good, n }], fine } at a
//   military station: contraband carried in the open is taken and fined twice
//   its worth; what the compartments hide is never seen
// portalEvery(tier) → seconds between the cruiser's portal-gun jumps (10 min
//   at Hyperdrive Mk I to 4 at Mk V); portalReady(at, clock, tier)
// LAB: { [raw good]: [units in, good out] }; labEvery(tier) → seconds a unit
//   takes the RV's lab (30 at Reactor Mk I to 10 at Mk V);
//   labStep(lots, room) → the hold's lots with one unit refined, or null for nothing to refine

import { GOODS } from '../market/goods';

export const SIGNATURE_LINE = Object.freeze({
  xwing: 'R2 astromech: patches the shields under fire, and plots each hop a sector further.',
  falcon: 'Smuggling compartments: a third of the hold hidden, kept when the ship goes down and never seen at a check. The Kessel Run: the longest jump there is.',
  cruiser: 'Portal gun: a jump to any sector you’ve charted, past the range, every few minutes.',
  rv: 'The lab: turns ore, gas and scrap in the hold into goods worth half as much again, as you fly.',
});

export const rangeOf = (core) => (core?.range ?? 1) + (core?.signature === 'xwing' ? 1 : 0);

export const R2 = Object.freeze({ under: 2, on: 3, cycle: 12 });
const tierIn = (t) => (Number.isFinite(t) ? Math.min(5, Math.max(1, Math.floor(t))) : 1);
export function r2Patch({ tier = 1, since = Infinity, clock = 0 }) {
  if (!(since <= R2.under)) return 0;
  if (clock % R2.cycle >= R2.on) return 0;
  return 4 + (tierIn(tier) - 1);
}

export const compartmentRoom = (crew, room) => (crew === 'falcon' ? Math.floor((Number(room) || 0) / 3) : 0);
export function hidden(crew, room, lots) {
  let left = compartmentRoom(crew, room);
  const out = [];
  const dear = [...(lots ?? [])].sort((a, b) => (GOODS[b.good]?.base ?? 0) - (GOODS[a.good]?.base ?? 0));
  for (const l of dear) {
    if (left <= 0) break;
    const n = Math.min(l.n, left);
    out.push({ ...l, n });
    left -= n;
  }
  return out;
}

export function inspect({ crew, room, lots, type }) {
  if (type !== 'military') return { seized: [], fine: 0 };
  const tucked = new Map();
  for (const l of hidden(crew, room, lots)) if (GOODS[l.good]?.contraband) tucked.set(l.good, (tucked.get(l.good) ?? 0) + l.n);
  const seized = new Map();
  for (const l of lots ?? []) if (GOODS[l.good]?.contraband) seized.set(l.good, (seized.get(l.good) ?? 0) + l.n);
  const out = [];
  let fine = 0;
  for (const [good, n] of seized) {
    const open = n - (tucked.get(good) ?? 0);
    if (open > 0) {
      out.push({ good, n: open });
      fine += 2 * open * GOODS[good].base;
    }
  }
  return { seized: out, fine };
}

const PORTAL = [600, 510, 420, 330, 240];
export const portalEvery = (tier) => PORTAL[tierIn(tier) - 1];
export const portalReady = (at, clock, tier) => !Number.isFinite(at) || clock - at >= portalEvery(tier);

export const LAB = Object.freeze({ iron: [2, 'alloys'], titanium: [1, 'alloys'], gas: [2, 'fuelcells'], stellargas: [1, 'fuelcells'], scrap: [2, 'components'] });
const LAB_EVERY = [30, 25, 20, 15, 10];
export const labEvery = (tier) => LAB_EVERY[tierIn(tier) - 1];
export function labStep(lots) {
  const count = (g) => lots.reduce((n, l) => n + (l.good === g ? l.n : 0), 0);
  const raw = Object.keys(LAB).find((g) => count(g) >= LAB[g][0]);
  if (!raw) return null;
  const [k, out] = LAB[raw];
  const next = lots.map((l) => ({ ...l, from: { ...l.from } }));
  let want = k;
  let from = null;
  for (const l of next) {
    if (l.good !== raw || want <= 0) continue;
    const take = Math.min(l.n, want);
    l.n -= take;
    want -= take;
    from ??= l.from;
  }
  const kept = next.filter((l) => l.n > 0);
  kept.push({ good: out, n: 1, from });
  return { lots: kept, raw, out };
}
