// The galaxy's war's ground rules, under the campaign (gcw.js) and the sides'
// strategy (gcwAI.js): its numbers (GCW), the systems it's fought over and
// which are next to which (NEIGHBOURS), the dice every pilot rolls alike
// (seeded), the tally's keys, the opening maps, and what a side's pressure on
// a system comes to (supply, areas, the Hutts). Pure, tested through gcw.js,
// which gives all of it out again: the rest of the galaxy imports gcw.js.

import { AREAS, SIDES, WARS } from './sides';
import { LANES, SYSTEMS } from './systems';

export const GCW = {
  start: Date.UTC(2026, 9, 1), // the first campaign's start (campaigns are counted from it)
  campaign: 3 * 24 * 3600e3, // a campaign: three days
  step: 12 * 60e3, // a step: a battle at each front, and its lull
  fight: 10 * 60e3, // of each step, the fighting
  fronts: 4, // fronts at once, at most
  attackEvery: 4 * 3600e3,
  attackFor: 8 * 12 * 60e3, // (eight steps: an hour and 36 minutes)
  raidEvery: 12 * 3600e3, // the Hutts', less often
  raidFor: 8 * 12 * 60e3,
  points: { objective: 3, kill: 0.1, turret: 0.5, win: 10, intercept: 1, ace: 2 }, // in hundredths of a system's control
  rate: [2, 11], // %/hour the liberator's other fleets take off a front's hold (drawn again every GCW.window)
  majorRate: [1, 8], // and a worthier system's, harder
  attackRate: [25, 62], // %/hour an attack takes off a system's hold (a whole one holds out below 62.5: an attack takes what's weakened, or with help)
  raidRate: [12, 30], // and a Hutt raid
  hutts: 0.5, // what of a rate against Hutt space gets through (they buy whoever's going)
  supply: 0.5, // %/hour for each of the attacker's neighbours beyond the first, less each of the holder's
  areaBonus: 1, // %/hour for an area of the attacker's, whole, next to the system
  // ── the sides' strategy (gcwAI.js) and the campaign's shape ──
  window: 30, // steps (six hours): fronts' rates are drawn again, and orders given, this often
  strike: 5, // the step of the raider's opening strike (its next is at attackEvery, then its phase's pace)
  defence: 1, // %/hour a front's holder puts back (cut off from its capital, cutDefence of that)
  cutDefence: 0.3,
  stronghold: 2, // a system worth this much supplies its own piece of territory, as a capital does (gcwAI.js's supplied)
  fortified: 0.75, // and holds out longer: an attack on it goes at this share of its pace (gcwAI.js's attackPace)
  regen: 4, // %/hour a system nobody's fighting over gets back, if it's in supply
  captured: 0.7, // a system's hold when it's just been taken
  repelled: 0.25, // what an attack held to the end gives back
  stall: 30, // steps: a front (not the first) that's moved less than stallDrop in this long is let be as long again
  stallDrop: 0.1,
  lastStand: 1, // a side's last this many systems can't fall before the Climax
  lastHold: 0.02, // (nor its hold of them go below this)
  // a side's rates, by its share of the systems (the leader eased off past 0.6, but that was the New
  // Republic's opening, 10 of 16, and it lost a third of its share from the start: now past 0.65)
  underdog: { below: 0.3, boost: 1.35, above: 0.65, damp: 0.8 },
  // and by how far it's come since the opening: `by` systems gained, it's stretched thin; lost, it
  // fights harder for its own (so a war drifts back towards where it began)
  stretch: { by: 2, damp: 0.8, boost: 1.25 },
  counterFor: 10, // steps a side goes back for what it's just lost
  counterBonus: 6, // %/hour more, for the liberator retaking it
  climaxMult: 2, // the first front's rate in the Climax: the decisive battle
  shock: 0.85, // a side's rates when it's lost its capital,
  shockFor: 30, // for this many steps
  knee: 0.3, // players: a side's points at a system in a step count in full to this much of its hold,
  beyond: 0.35, // this share past it,
  playerCap: 0.45, // and never more than this
  retry: 5, // steps till a side with nothing to attack looks again
  stuck: 0.5, // %/hour: a push slower than this has stalled (an order on it is given up)
  // from (a step), the name, every AI rate times mult, and every the raider's pace (steps between attacks)
  phases: [
    { from: 0, name: 'Opening', mult: 0.9, every: 15 },
    { from: 60, name: 'Escalation', mult: 1, every: 20 },
    { from: 240, name: 'Decisive', mult: 1.1, every: 18 },
    { from: 330, name: 'Climax', mult: 1.3, every: 12 },
  ],
  // a target's weights, past the doctrine's (gcwAI.js's targetOf and orderTarget)
  weigh: { weak: 2, area: 2, weight: 0.5, reach: 0.8, can: 2, cannot: -4, recent: 3, recentFor: 60, pace: 0.25, again: 4 },
  huttReach: 1, // the raider attacks a Hutt world only where the attack would take it whole (gcw.js)
  routeReach: 2.2, // grid squares: how near a route's point a system must be to be on it
  neighbours: 2, // the nearest few, besides the routes
  // and these, by hand: the Abrion sector's two (Kamino past the rim, Scarif at the edge of it) and the Core's road to Naboo
  links: [
    ['kamino', 'scarif'],
    ['coruscant', 'naboo'],
  ],
};
export const HOURS_PER_STEP = GCW.step / 3600e3;

// (the systems the war is fought over: those with a `war` row. Alderaan is
// rubble, Dagobah is left to its swamp, and the 2017 game's six (lane E5:
// Felucia, Kessel, Sullust, Pillio, Vardos, Fondor) are places to land on
// the game's own maps, not fronts; nor are the charted worlds, charted/)
export const WAR_SYSTEMS = SYSTEMS.filter((s) => s.body && s.war).map((s) => s.id);
const BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

// what a system is to the war (systems.js's `war`, or what any is without one)
export const WAR_DEFAULT = Object.freeze({ worth: 1, weight: 1, kind: 'assault', area: null });
export const warInfo = (id) => ({ ...WAR_DEFAULT, ...(BY_ID[id]?.war ?? {}) });
// (worth and area, read thousands of times a campaign, from a table made once)
const INFO = Object.fromEntries(SYSTEMS.map((s) => [s.id, warInfo(s.id)]));
export const worthOf = (id) => (INFO[id] ?? WAR_DEFAULT).worth;
export const areaOf = (id) => (INFO[id] ?? WAR_DEFAULT).area;

export const NEIGHBOURS = (() => {
  const out = Object.fromEntries(WAR_SYSTEMS.map((id) => [id, new Set()]));
  const join = (a, b) => a !== b && (out[a].add(b), out[b].add(a));
  const dist = (id, [x, z]) => Math.hypot(BY_ID[id].pos[0] - x, BY_ID[id].pos[1] - z);
  // the routes: each point's nearest war system (if one's near enough), joined in turn
  for (const lane of LANES) {
    let prev = null;
    for (const p of lane.pts) {
      const best = WAR_SYSTEMS.reduce((b, id) => (dist(id, p) < dist(b, p) ? id : b));
      if (dist(best, p) > GCW.routeReach) continue;
      if (prev) join(prev, best);
      prev = best;
    }
  }
  // and the nearest few, so nowhere's cut off
  for (const id of WAR_SYSTEMS)
    WAR_SYSTEMS.filter((o) => o !== id)
      .sort((a, b) => dist(a, BY_ID[id].pos) - dist(b, BY_ID[id].pos))
      .slice(0, GCW.neighbours)
      .forEach((o) => join(id, o));
  for (const [a, b] of GCW.links) join(a, b);
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
})();

// the same numbers for the same thing, for every pilot
export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function seeded(text) {
  let a = hash(text);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
export const within = ([a, b], r) => a + r * (b - a);

// ── The tally's keys: a side's points at a system in a step, and a battle it won there ──

export const pointsKey = (side, sys, step) => `${SIDES[side].code}:${sys}:${step}`;
export const winKey = (side, sys, step) => `win:${SIDES[side].code}:${sys}:${step}`;
// (the previous build's, `hoth:12` and `win:hoth:12`, were all the Rebellion's)
export const oldKey = (sys, step) => `${sys}:${step}`;
export const oldWinKey = (sys, step) => `win:${sys}:${step}`;

export function opening(war = 'gcw') {
  const w = WARS[war];
  const owner = {};
  const control = {};
  for (const id of WAR_SYSTEMS) {
    owner[id] = Object.entries(w.opening).find(([, ids]) => ids.includes(id))?.[0] ?? w.raider;
    control[id] = 1;
  }
  return { owner, control };
}

// the supply term for `attacker` at a system: its neighbours beyond the
// first help, the holder's beyond the first hold it back (%/hour)
export function supplyOf(id, owner, attacker) {
  const holder = owner[id];
  const count = (side) => NEIGHBOURS[id].filter((o) => owner[o] === side).length;
  return GCW.supply * (Math.max(0, count(attacker) - 1) - Math.max(0, count(holder) - 1));
}

// who holds each area, whole, if anyone does
export function areaHolders(owner) {
  const out = {};
  for (const a of AREAS) {
    const sides = new Set(WAR_SYSTEMS.filter((id) => areaOf(id) === a.id).map((id) => owner[id]));
    out[a.id] = sides.size === 1 ? [...sides][0] : null;
  }
  return out;
}
// an area of the attacker's, whole, next to a system it's after (%/hour)
export function areaBonusOf(id, owner, attacker, holders = areaHolders(owner)) {
  return NEIGHBOURS[id].some((o) => areaOf(o) !== areaOf(id) && holders[areaOf(o)] === attacker) ? GCW.areaBonus : 0;
}

// a rate against a system, as its holder feels it (the Hutts buy whoever's going)
export const pressureOn = (holder, rate) => rate * (holder === 'hutt' ? GCW.hutts : 1);
