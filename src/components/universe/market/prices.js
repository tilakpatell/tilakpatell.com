// What a station pays for a good and what it asks, in whole credits:
//
//   sell = base × type × area × haul × drift × shock × yours
//   buy  = the same, hauled nowhere, × spread
//
// type: what the station makes is cheap, what it needs dear; area: its own
// specialties cheap at home, what it wants dear; haul: a specialty or a
// pocket's good sold away from where it came from is worth more a sector on;
// drift: two slow waves for each station and good, from the seed and the
// clock, so every pilot sees the same price at the same moment with no
// server; shock: an event's (store.js's shockOf); yours: what you've sold
// there lately takes a step off a unit, what you've bought puts it on, back
// to nothing with a half-life. A station always asks more than it pays, so a
// round trip at one station never pays. Pure.
//
// PRICE (the numbers), drift(stationId, good, t), yoursAt(entry, t),
// haulOf(good, from, at), priceOf({ stationId, type, area, good, from, at, t,
//   shock, yours }) → { sell, buy }

import { hash64 } from '../../expanse/gen/seed';
import { AREAS, distanceOf } from './areas';
import { GOODS } from './goods';
import { STATION_TYPES } from './stations';

// (the spec's haul, 3 at 10 sectors, starts at 2: the pacing test of lane 4
// settles it; see the spec's finding)
export const PRICE = Object.freeze({
  make: 0.6,
  need: 1.5,
  home: 0.5,
  want: 1.4,
  haulPer: 0.1,
  haulMost: 2,
  spread: 1.12,
  drift: 0.25,
  step: 0.015,
  halfLife: 15 * 60 * 1000,
  floor: 0.5,
  ceil: 1.5,
});
const HOUR = 3600 * 1000;

export function drift(stationId, good, t) {
  const h = hash64('drift', String(stationId), String(good));
  const a = Number(h & 0xffffn) / 0xffff;
  const b = Number((h >> 16n) & 0xffffn) / 0xffff;
  const c = Number((h >> 32n) & 0xffffn) / 0xffff;
  const p1 = (2 + 6 * a) * HOUR;
  const p2 = (2 + 6 * b) * HOUR;
  const w = Math.sin((2 * Math.PI * t) / p1 + c * 6.283) * 0.6 + Math.sin((2 * Math.PI * t) / p2 + a * 6.283) * 0.4;
  return 1 + PRICE.drift * w;
}

// your net units sold there (sold +, bought −), halved every halfLife since
export function yoursAt(entry, t) {
  if (!entry || !Number.isFinite(entry.n) || !Number.isFinite(entry.t)) return 0;
  return entry.n * 0.5 ** (Math.max(0, t - entry.t) / PRICE.halfLife);
}
const yoursK = (n) => Math.min(PRICE.ceil, Math.max(PRICE.floor, 1 - PRICE.step * n));

// a specialty's, or a pocket's good's, worth for how far it came: from
// another pocket the most there is
const POCKET_GOODS = new Set([...AREAS.starwars.specialties, ...AREAS.curve.specialties]);
export function haulOf(good, from, at) {
  const g = GOODS[good];
  if (!g || (g.family !== 'specialty' && !POCKET_GOODS.has(good))) return 1;
  if (from?.pocket !== at?.pocket) return PRICE.haulMost;
  const d = distanceOf((from?.sector ?? [0, 0, 0]).map((v, i) => v - (at?.sector?.[i] ?? 0)));
  return Math.min(PRICE.haulMost, 1 + PRICE.haulPer * d);
}

export function priceOf({ stationId, type, area, good, from = null, at = null, t = 0, shock = 1, yours = 0 }) {
  const g = GOODS[good];
  if (!g) return null;
  const st = STATION_TYPES[type] ?? STATION_TYPES.frontier;
  const a = AREAS[area?.id] ?? AREAS.core;
  const typeK = st.needs.includes(good) ? PRICE.need : st.makes.includes(good) ? PRICE.make : 1;
  const areaK = a.specialties.includes(good) ? PRICE.home : a.wants.includes(good) ? PRICE.want : 1;
  // (the Core's exchange: flat and fair, no drift)
  const driftK = area?.id === 'core' ? 1 : drift(stationId, good, t);
  const shockK = Number.isFinite(shock) && shock > 0 ? shock : 1;
  const here = g.base * typeK * areaK * driftK * shockK;
  const sell = Math.max(1, Math.floor(here * haulOf(good, from ?? at, at) * yoursK(yours)));
  const buy = Math.max(sell + 1, Math.ceil(here * yoursK(yours) * PRICE.spread));
  return { sell, buy };
}
