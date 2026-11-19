// A model of a pilot's play, for the pacing test: how many credits a minute
// each kind of play makes at a tier, from the game's own numbers (the tier
// prices, the finds' worth, the kills' pay, the market's haul and spread) and
// a few rates a player is assumed to manage, named here. The spec's targets:
// the first Mk II in about 10 minutes, every system at Mk III in about 2
// hours, the first Mk V in about 5. A change to a price or a pay that moves
// one of them by more than a fifth fails the test (pacing.test.js). Pure.
//
// PLAY: the assumed rates; perMinute(tier, ship) → { combat, explore, trade,
//   mean }; minutesTo(credits, fromTier, toTier, ship) → minutes;
//   targets(ship) → { mk2, allMk3, firstMk5 } in minutes

import { EARN } from '../economy';
import { PRICE } from '../market/prices';
import { worthOf } from '../explore/values';
import { coreStats, SYSTEMS } from './profiles';
import { TIER_PRICE } from './tiers';

// (assumed: what a steady player manages in a minute of each kind of play at
// each tier, Mk I to Mk V, and how far out they work)
export const PLAY = Object.freeze({
  kills: [0.8, 1.1, 1.3, 1.5, 1.7], // hunters a minute, a fight in three: a better ship kills quicker
  killPay: (EARN.killHunter.credits + EARN.killPirate.credits) / 2,
  danger: [1.15, 1.3, 1.5, 1.8, 2.1], // the region's pay (×(1 + 1.5 × danger)) where a tier's pilot works
  systemsAt: [1.2, 2.4, 3, 3, 3], // systems scanned a minute: the scanner's reach, and the flying between
  planets: 3, // planets a system
  workAt: [2, 4, 8, 14, 24], // sectors from the Core a tier's pilot works
  specialty: 70, // a mid specialty's base
  runMinutes: [6, 6, 8, 10, 12], // a buy, a haul and a sale: longer hauls further out
});

// a tier's play, or between two (a pilot part way through buying the next)
const at = (row, tier) => {
  const t = Math.min(5, Math.max(1, tier)) - 1;
  const lo = Math.floor(t);
  const hi = Math.min(4, lo + 1);
  return row[lo] + (row[hi] - row[lo]) * (t - lo);
};
const coreAt = (ship, tier) => {
  const lo = coreStats(ship, Object.fromEntries(SYSTEMS.map((s) => [s, Math.floor(tier)])));
  const hi = coreStats(ship, Object.fromEntries(SYSTEMS.map((s) => [s, Math.min(5, Math.floor(tier) + 1)])));
  return { hold: lo.hold + (hi.hold - lo.hold) * (tier - Math.floor(tier)) };
};

export function perMinute(tier, ship = 'neutral') {
  const d = at(PLAY.workAt, tier);
  const combat = at(PLAY.kills, tier) * PLAY.killPay * at(PLAY.danger, tier);
  const explore = at(PLAY.systemsAt, tier) * (worthOf('system', d) + PLAY.planets * worthOf('planet', d));
  const hold = coreAt(ship, tier).hold;
  const haul = Math.min(PRICE.haulMost, 1 + PRICE.haulPer * Math.min(d, 10));
  // (a hold sold at one station: each unit takes a step off the next, PRICE.step)
  const sold = Math.max(PRICE.floor, 1 - (PRICE.step * hold) / 2);
  const margin = PLAY.specialty * (haul * sold - PRICE.home * PRICE.spread);
  const trade = (hold * margin) / at(PLAY.runMinutes, tier);
  return { combat, explore, trade, mean: (combat + explore + trade) / 3 };
}

// minutes to earn a sum, playing at a tier (a fraction: part way to the next)
export const minutesTo = (credits, tier, ship = 'neutral') => credits / perMinute(tier, ship).mean;

// (each stage played half way between the tier it starts at and the one it buys)
export function targets(ship = 'neutral') {
  const n = SYSTEMS.length;
  const mk2 = minutesTo(TIER_PRICE[2], 1, ship);
  const allMk3 = minutesTo(n * TIER_PRICE[2], 1.5, ship) + minutesTo(n * TIER_PRICE[3], 2.5, ship);
  const firstMk5 = allMk3 + minutesTo(TIER_PRICE[4], 3.5, ship) + minutesTo(TIER_PRICE[5], 4.5, ship);
  return { mk2, allMk3, firstMk5 };
}
