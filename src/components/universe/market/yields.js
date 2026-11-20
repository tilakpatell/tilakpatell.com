// What mining a field or salvaging a wreck puts in the hold, from its id and
// how many times it's been worked (the same every time for the same press),
// and where it is: a chance of the area's rare far out (areas.js's raresAt).
// Pure.
//
// MINED_OUT: presses a field gives before it's empty (things/rules.js's
//   ORE_CAP); WORKS: the kinds that give goods
// yieldOf({ kind, id, press, area, d }) → [{ good, n }] (empty for a kind
//   that gives none)
// PLANET_CAP: harvests a planet gives before it's worked out (for EMPTY_FOR,
//   store.js's); yieldOfPlanet(traits, { id, press, d }) → [{ good, n }]: a
//   generated planet's harvest from its traits (lib/space/traits.js's
//   traitsOfPlanet): its first resource always, the others by their amount, and
//   now and then its rare (the pure grade from PURE_FROM out)

import { hash64 } from '../../expanse/gen/seed';
import { ORE_CAP } from '../things/rules';
import { PURE_FROM, raresAt } from './areas';
import { GOODS } from './goods';

export const MINED_OUT = ORE_CAP;
export const WORKS = Object.freeze(['field', 'icefield', 'derelict', 'outpost', 'debris']);
const RARE_CHANCE = { field: 0.12, icefield: 0.08, derelict: 0.3, outpost: 0.25, debris: 0.1 };

// a number in [0, 1) for this press and this draw, from the id
const roll = (id, press, k) => Number(hash64('yield', String(id), press, k) % 100000n) / 100000;

export function yieldOf({ kind, id, press = 0, area = null, d = 0 }) {
  if (!WORKS.includes(kind)) return [];
  const r = (k) => roll(id, press, k);
  const out = [];
  if (kind === 'field') out.push({ good: r(0) < 0.7 ? 'iron' : 'titanium', n: 1 + Math.floor(r(1) * 2) });
  if (kind === 'icefield') out.push({ good: area?.id === 'ice' && r(0) < 0.4 ? 'cometwater' : 'ice', n: 1 + Math.floor(r(1) * 2) });
  if (kind === 'derelict' || kind === 'outpost') {
    out.push({ good: 'scrap', n: 2 + Math.floor(r(0) * 2) }, { good: 'components', n: 1 + Math.floor(r(1) * 2) });
    if (r(2) < 0.5) out.push({ good: 'datacores', n: 1 });
  }
  if (kind === 'debris') {
    out.push({ good: 'scrap', n: 2 });
    if (r(0) < 0.3) out.push({ good: 'components', n: 1 });
  }
  const rares = raresAt(area, d);
  if (rares.length && r(9) < RARE_CHANCE[kind]) out.push({ good: rares[Math.floor(r(10) * rares.length)], n: 1 });
  return out;
}

export const PLANET_CAP = 5;
const RARE_ONE = 0.15; // (a harvest's chance of a unit of the planet's rare, when it has one)
export function yieldOfPlanet(traits, { id, press = 0, d = 0 } = {}) {
  const r = (k) => roll(`planet:${id}`, press, k);
  const out = [];
  const resources = (Array.isArray(traits?.resources) ? traits.resources : []).filter((x) => Object.hasOwn(GOODS, x?.id));
  resources.forEach((res, i) => {
    const amount = Number.isFinite(res.amount) ? Math.min(1, Math.max(0, res.amount)) : 0;
    if (i === 0) out.push({ good: res.id, n: 1 + Math.round(amount * 2) });
    else if (r(i) < amount) out.push({ good: res.id, n: 1 });
  });
  const rare = traits?.rare?.id;
  if (rare && Object.hasOwn(GOODS, rare) && r(9) < RARE_ONE) {
    const pure = d >= PURE_FROM && Object.hasOwn(GOODS, `${rare}-pure`);
    out.push({ good: pure ? `${rare}-pure` : rare, n: 1 });
  }
  return out;
}
