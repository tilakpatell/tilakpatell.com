// How the galaxy's war's sides decide: where the raider and the Hutts
// attack, which fronts the liberator works and in what order, the orders
// each side gives its pilots, and the supply lines from each side's capital
// that all of it leans on. Pure, tested, and as seeded as the rest of the
// war (gcw.js hands in its dice), so every pilot's campaign decides alike;
// gcw.js works the campaign through a step at a time with these.
//
// Each side weighs a target by its doctrine (sides.js's DOCTRINE): what it's
// worth, how far its hold's gone, how much of its holder's it would cut off
// from their capital, whether it makes an area whole, and whether an attack
// could take it at all (an attack thrown at what it can't take is a wasted
// one: the old raider kept hurling itself at Hutt worlds it never took).
//
// phaseAt(k) → GCW.phases index; soft(p) → a side's points at a system in a
// step, as the war counts them; pointsCount(side, holder, battle) → whether
// they count there at all; lean(count, side, opened?) → the underdog's (or
// the leader's, or the stretched side's) multiplier; supplied(owner, side,
// capital) → Set; cutOff(owner, id, capital) → systems cut off by taking id;
// areaWhole(owner, id, side) → 1 | 0; attackPace(c) → an attack's %/hour;
// reaches(c, reach) → whether it would take a system; targetOf(c) → an
// attack's target; originOf(owner, control, sys, by) → where it comes from;
// frontsFor(c) → the liberator's fronts; frontPace(c) → a front's %/hour;
// orderTarget(c) → the liberator's order; raiderOrder(c) → the raider's;
// orderOver(order, s) → whether it's done or can't be.

import { DOCTRINE } from './sides';
import { GCW, NEIGHBOURS, WAR_SYSTEMS, areaBonusOf, areaOf, pressureOn, supplyOf, warInfo, worthOf } from './gcwRules';

const W = GCW.weigh;

export const phaseAt = (k) => GCW.phases.reduce((at, p, i) => (k >= p.from ? i : at), 0);

// what a side's pilots did at a system in a step (a hundredth of its hold a
// point), as the war counts it: in full to the knee, a share past it, never
// more than the cap (a room of pilots matters; one pilot can't end a war)
export const soft = (p) => Math.min(GCW.playerCap, Math.min(p, GCW.knee) + Math.max(0, p - GCW.knee) * GCW.beyond);

// a side's points count where there's a battle on, or at its own systems
// (its pilots holding them); anywhere else they move nothing
export const pointsCount = (side, holder, battle) => battle || side === holder;

// a side down to a few systems fights harder, one holding most of the galaxy
// eases off; and with `opened` (the opening's count), one that's gained
// GCW.stretch.by systems since is stretched thin, one that's lost as many
// fights harder for its own
export function lean(count, side, opened) {
  const share = (count[side] ?? 0) / WAR_SYSTEMS.length;
  const base = share < GCW.underdog.below ? GCW.underdog.boost : share > GCW.underdog.above ? GCW.underdog.damp : 1;
  const st = GCW.stretch;
  const gained = opened ? (count[side] ?? 0) - (opened[side] ?? 0) : 0;
  return base * (gained >= st.by ? st.damp : gained <= -st.by ? st.boost : 1);
}

// a side's systems in supply: those joined through its own to its capital or
// to one of its strongholds (a system worth GCW.stronghold: a fleet yard, a
// fortress, stocked for a siege), so only a piece of its territory that's
// encircled with nothing of worth in it is cut off. Holding neither, its
// worthiest system (the first of them in the map's order) is where its lines
// run from. The Hutts are never cut off: their smugglers run through
// anyone's space, and Nevarro is nowhere near Tatooine.
export function supplied(owner, side, capital) {
  const mine = WAR_SYSTEMS.filter((id) => owner[id] === side);
  if (side === 'hutt') return new Set(mine);
  const roots = mine.filter((id) => id === capital || worthOf(id) >= GCW.stronghold);
  if (!roots.length && mine.length) roots.push(mine.reduce((b, id) => (worthOf(id) > worthOf(b) ? id : b)));
  const seen = new Set(roots);
  const todo = roots.slice();
  while (todo.length) for (const o of NEIGHBOURS[todo.pop()]) if (owner[o] === side && !seen.has(o)) (seen.add(o), todo.push(o));
  return seen;
}

// how many of its holder's systems in supply taking `id` would cut off
export function cutOff(owner, id, capital) {
  const holder = owner[id];
  const before = supplied(owner, holder, capital);
  if (!before.has(id)) return 0;
  const after = supplied({ ...owner, [id]: null }, holder, capital);
  let n = 0;
  for (const x of before) if (x !== id && !after.has(x)) n += 1;
  return n;
}

// taking `id` would make its area `side`'s, whole
export const areaWhole = (owner, id, side) => (WAR_SYSTEMS.every((x) => x === id || areaOf(x) !== areaOf(id) || owner[x] === side) ? 1 : 0);

// whether an attack at `rate` %/hour would take a system's hold in `hours`,
// or come within `reach` of it (the rest left to its pilots); with nobody
// playing it's exact (c: { id, by, owner, control, rate, hours, holders? })
export function reaches({ id, by, owner, control, rate, hours, holders }, reach = W.reach) {
  return (attackPace({ id, by, owner, rate, holders }) * hours) / 100 >= reach * control[id];
}

// an attack's %/hour off a system's hold: its rate, with the attacker's
// supply and an area of its next to it, as the holder feels it, and less at
// a stronghold
export function attackPace({ id, by, owner, rate, holders }) {
  return pressureOn(owner[id], rate + supplyOf(id, owner, by) + areaBonusOf(id, owner, by, holders)) * (worthOf(id) >= GCW.stronghold ? GCW.fortified : 1);
}

// an attack's target: the border system `by` weighs highest by its doctrine
// (c: { by, border, owner, control, rate, hours, capitals, lastHit, k, rand,
// holders? (gcwRules.js's areaHolders, when it's to hand), holdsOut? (the
// systems that can't fall yet: a side's last stand before the Climax) });
// the rand jitters each in the border's order, so every pilot picks alike
export function targetOf({ by, border, owner, control, rate, hours, capitals, lastHit, k, rand, holders, holdsOut }) {
  const d = DOCTRINE[by];
  let best = null;
  let bestU = -Infinity;
  for (const id of border) {
    const holder = owner[id];
    const u =
      worthOf(id) * d.worth +
      (1 - control[id]) * W.weak * d.weak +
      cutOff(owner, id, capitals[holder]) * d.cut +
      areaWhole(owner, id, by) * W.area * d.area +
      warInfo(id).weight * W.weight +
      (reaches({ id, by, owner, control, rate, hours, holders }) && !holdsOut?.has(id) ? W.can : W.cannot) -
      (lastHit[id] > k - W.recentFor ? W.recent : 0) +
      rand() * d.jitter;
    if (u > bestU) (best = id), (bestU = u);
  }
  return best;
}

// where an attack comes from: the attacker's neighbour of its target with
// the firmest hold (NEIGHBOURS are by name, so a tie goes to the first)
export function originOf(owner, control, sys, by) {
  let from = null;
  for (const o of NEIGHBOURS[sys]) if (owner[o] === by && (from === null || control[o] > control[from])) from = o;
  return from;
}

// the liberator's fronts: what it's after first (`lead`: its order, the major
// order, then a system to retake), then the campaign's order of the rest, any
// let be a while (`rest`) or holding out (`later`: a last stand) last; none
// under someone else's attack (`busy`)
export function frontsFor({ owner, order, liberator, busy, rest, k, lead, later }) {
  const border = order.filter((id) => owner[id] !== liberator && !busy.has(id) && NEIGHBOURS[id].some((o) => owner[o] === liberator));
  const first = [];
  for (const id of lead) if (id && border.includes(id) && !first.includes(id)) first.push(id);
  const waits = (id) => rest[id] > k || Boolean(later?.has(id));
  const fresh = border.filter((id) => !first.includes(id) && !waits(id));
  const rested = border.filter((id) => !first.includes(id) && waits(id));
  return [...first, ...fresh, ...rested].slice(0, GCW.fronts);
}

// a front's %/hour off its hold: the liberator's fleets' rate, with its
// supply and an area of its next to it, less what the holder puts back (less
// still cut off from its capital), as the holder feels it
export function frontPace({ id, owner, liberator, rate, supply, holders }) {
  const holder = owner[id];
  const defence = GCW.defence * (supply[holder]?.has(id) ? 1 : GCW.cutDefence);
  return pressureOn(holder, rate + supplyOf(id, owner, liberator) + areaBonusOf(id, owner, liberator, holders) - defence);
}

// the liberator's order: the front it weighs highest by its doctrine, one
// it can move (not one stuck, nor a last stand), and not its last order
// over again; with only last stands left, one that moves over one that's
// stuck (c: { liberator, border, owner, control, rates, might, capitals,
// supply, previous, rand, holders?, holdsOut? })
export function orderTarget({ liberator, border, owner, control, rates, might, capitals, supply, previous, rand, holders, holdsOut }) {
  const d = DOCTRINE[liberator];
  let best = null;
  let bestU = -Infinity;
  for (const id of border) {
    const pace = frontPace({ id, owner, liberator, rate: rates[id] * might, supply, holders });
    const u =
      worthOf(id) * d.worth +
      (1 - control[id]) * W.weak * d.weak +
      cutOff(owner, id, capitals[owner[id]]) * d.cut +
      areaWhole(owner, id, liberator) * W.area * d.area +
      (pace > GCW.stuck ? pace * W.pace : W.cannot) +
      (holdsOut?.has(id) ? W.cannot : 0) -
      (id === previous ? W.again : 0) +
      rand() * d.jitter;
    if (u > bestU) (best = id), (bestU = u);
  }
  return best;
}

// the raider's order: take what it's attacking, or else hold its weakest
// system under threat (the worthiest of those, then the first), where the
// threat's real (eff, this step's battles' %/hour, when it's to hand)
export function raiderOrder({ raider, owner, control, attacks, fronts, eff }) {
  const mine = attacks.find((a) => a.by === raider);
  if (mine) return { sys: mine.sys, verb: 'take' };
  let sys = null;
  for (const id of WAR_SYSTEMS) {
    if (owner[id] !== raider || !(fronts.includes(id) || attacks.some((a) => a.sys === id))) continue;
    if (eff && !(eff[id] > GCW.stuck)) continue;
    if (sys === null || control[id] < control[sys] || (control[id] === control[sys] && worthOf(id) > worthOf(sys))) sys = id;
  }
  return sys ? { sys, verb: 'hold' } : null;
}

// an order's over: taken, held, out of reach, or (with eff, the last
// battles' %/hour) the push there has stalled: the liberator's going nowhere,
// the threat the raider's holding against is spent. And a system someone
// else is attacking is no front of the liberator's while that's on, so no
// order of its either (s: { owner, attacks, fronts, liberator, raider, eff? })
export function orderOver(order, { owner, attacks, fronts, liberator, raider, eff }) {
  const { sys, verb } = order;
  const stalled = eff?.[sys] !== undefined && eff[sys] <= GCW.stuck;
  if (verb === 'liberate') return owner[sys] === liberator || !NEIGHBOURS[sys].some((o) => owner[o] === liberator) || attacks.some((a) => a.sys === sys) || stalled;
  if (verb === 'take') return !attacks.some((a) => a.sys === sys && a.by === raider);
  return owner[sys] !== raider || !(fronts.includes(sys) || attacks.some((a) => a.sys === sys)) || stalled;
}
