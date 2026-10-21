// The Powers tab's choices (PowersTab.jsx shows them): for each slot, the
// powers this ship may carry there, its crew's own first and then the other
// crews' (each locked until the skill tree's node that lends that crew's
// pair is taken: the same rule as shipPowers.js's picksFor), and a power's
// lengths with the skills on them. Pure, tested.
//
//   choicesOf(ship, slot, carry) → [{ id, crew, own, locked, opens (the lending node's name, or null) }]
//   lengthsOf(id, fx) → { dur, cool (null for the big one) } in seconds

import { POWERS, powersOf } from '../universe/shared/hangar';
import { NODES } from './skills/tree';

const CREWS = ['xwing', 'falcon', 'cruiser', 'rv'];
const lender = (crew) => Object.values(NODES).find((n) => n.borrows === crew)?.name ?? null;

export function choicesOf(ship, slot, carry = []) {
  if (!powersOf(ship)) return [];
  const lent = Array.isArray(carry) ? carry : [];
  return [ship, ...CREWS.filter((c) => c !== ship)]
    .filter((crew) => powersOf(crew)?.[slot])
    .map((crew) => {
      const own = crew === ship;
      return { id: powersOf(crew)[slot], crew, own, locked: !own && !lent.includes(crew), opens: own ? null : lender(crew) };
    });
}

const times = (v) => (Number.isFinite(v) && v > 0 ? v : 1);
const tenth = (v) => Math.round(v * 10) / 10;
export function lengthsOf(id, fx) {
  const p = POWERS[id];
  return { dur: tenth(p.dur * times(fx?.powerDur)), cool: p.cool ? tenth(p.cool * times(fx?.powerCool)) : null };
}
