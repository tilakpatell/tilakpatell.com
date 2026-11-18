// A tier is an item the one wallet owns (economy.js), kept per crew, so
// buying one and paying for it are one change. Mk I is every ship's; Mk II
// to Mk V are bought in order, each needing the one before it, and Mk IV
// and Mk V the system's rare too (the market's goods: the wallet asks its
// cargo for them). A tier is never sold back. Pure (no React, DOM or three.js).
//
// TIER_PRICE (by tier), RARE_OF (system → rare good id), MK (labels)
// tierKey(crew, system, n) → 'tier:<crew>:<system>:<n>'
// tierItem(crew, system, n) → the wallet's item for that tier, or null
// tierOf(owns, crew, system) → 1…5: the unbroken run from Mk II (owns is
//   economy.owns)
// tiersOf(owns, crew) → { [system]: tier }

import { MAX_TIER, SYSTEMS, SYSTEM_LABEL } from './profiles';

export const TIER_PRICE = Object.freeze([0, 0, 600, 2000, 6000, 15000]);
export const MK = Object.freeze(['', 'Mk I', 'Mk II', 'Mk III', 'Mk IV', 'Mk V']);
// (Mk IV takes two of the rare, found 10 or more sectors out; Mk V four of its pure grade, 25 or more)
export const RARE_OF = Object.freeze({
  engines: 'exotic',
  pulse: 'exotic',
  hyperdrive: 'voidcrystal',
  shields: 'relics',
  reactor: 'relics',
  scanner: 'silk',
  hold: 'silk',
});
const RARES = { 4: [2, ''], 5: [4, '-pure'] };

export const tierKey = (crew, system, n) => `tier:${crew}:${system}:${n}`;

export function tierItem(crew, system, n) {
  if (!SYSTEMS.includes(system) || !Number.isInteger(n) || n < 2 || n > MAX_TIER) return null;
  const key = tierKey(crew, system, n);
  const needs = {};
  if (n > 2) needs.owns = tierKey(crew, system, n - 1);
  if (RARES[n]) needs.goods = { [RARE_OF[system] + RARES[n][1]]: RARES[n][0] };
  return { key, id: key, kind: 'tier', slot: system, name: `${SYSTEM_LABEL[system]} ${MK[n]}`, price: TIER_PRICE[n], needs, from: null, stock: false };
}

export function tierOf(owns, crew, system) {
  if (typeof owns !== 'function') return 1;
  let n = 1;
  while (n < MAX_TIER && owns(tierKey(crew, system, n + 1))) n++;
  return n;
}

export const tiersOf = (owns, crew) => Object.fromEntries(SYSTEMS.map((s) => [s, tierOf(owns, crew, s)]));
