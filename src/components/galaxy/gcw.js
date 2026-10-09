// The galaxy's wars, as plain rules: Helldivers' war, in the galaxy far, far
// away. Pure (no three.js, no network), tested; the holotable shows them
// (HoloMap.jsx), the scene fights their battles (warfront.js), and what the
// players do is a tally every pilot online keeps alike (universe/tally.js).
// The design: docs/superpowers/specs/2026-10-06-fleet-war-design.md
// revision 2, and 2026-10-07-gcw-allegiance-design.md revision 3a. The
// ground rules (the numbers, the map, the dice, the tally's keys) are
// gcwRules.js's, and how each side decides is gcwAI.js's; this works a
// campaign through with them.
//
// Three wars, one an era (sides.js's WARS: the Clone Wars, the Galactic Civil
// War, the Remnant War), fought at once over the same map: the galaxy's
// systems with a planet (but Dagobah: nobody's there), joined by the films'
// trade routes (systems.js's LANES) and the nearest two, and grouped in areas
// (sides.js's AREAS). In each a system has an `owner` (the war's liberator,
// its raider, or the Hutts) and `control`, the owner's hold of it: 1 whole,
// at 0 it's lost. Each side has a capital, and its systems joined through its
// own to it or to a stronghold (a system worth GCW.stronghold) are in supply;
// one cut off, encircled with nothing of worth, holds less well and doesn't
// mend. The Hutts are never cut off.
//
// A campaign runs GCW.campaign of the wall clock, from a start the same for
// everyone, then every war starts over from its opening map. It's worked
// through in steps of GCW.step from its start (history), so every pilot who
// knows the same tally has the same wars. It has a shape: GCW.phases, the
// Opening, Escalation, the Decisive phase and the Climax, each faster than
// the last, and a result at its end by victory points (each system's worth,
// to whoever holds it).
// - Fronts: a system of anyone but the liberator's, next to one of the
//   liberator's, is a front: GCW.fronts of them, its order (below) first, the
//   major order, then a system it's just lost (pushed harder), then the
//   campaign's own order, worthiest first. Its hold falls at the
//   liberator's fleets' rate (seeded, drawn again every GCW.window), faster
//   with more of the liberator's systems round it (supply) and an area of the
//   liberator's whole next to it, slower for its holder's defence; at 0 it's
//   the liberator's, held at GCW.captured. A front that's barely moved in
//   GCW.stall steps is let be a while, so another gets its turn.
// - Attacks: the raider strikes at GCW.strike, again at GCW.attackEvery, then
//   at its phase's pace; the Hutts raid every GCW.raidEvery. Each picks the
//   border system its doctrine weighs highest (sides.js's DOCTRINE; the
//   raider a Hutt world only where the attack would take it), and comes from
//   the neighbour of it it holds best. An attacked system's hold falls at the
//   attack's rate (less at a stronghold); at 0 it's the attacker's, held to
//   the end it gets GCW.repelled back. None runs on past the campaign's end.
// - Reactions: a side that's lost a system goes back for it (the raider
//   attacks it at once, the liberator makes it the front after its order's);
//   one that's lost its capital is shaken a while; a side with few systems
//   fights harder (and the raider more often), one with most eases off, and
//   one that's come GCW.stretch.by systems from its opening is stretched thin
//   (or, losing, fights harder for its own); and before the Climax nobody
//   loses their last system (a last stand), so a war's only ever won in it,
//   and nobody attacks one.
// - Orders: each window each main side gives its pilots an order with a
//   deadline (the liberator's a front to liberate, the raider's what it's
//   attacking to take, or a system of its under threat to hold), kept till
//   it's done or can't be. The liberator's is the major order, so the ★ on
//   the map is what its pilots are told, and moves only when that does.
// - What players did: points (a hundredth of a system's control each) for
//   each side, system and step (pointsKey), and the battles won there
//   (winKey), counted once however many pilots tell of them. A side's points
//   count where there's a battle, or at its own systems, softly capped
//   (gcwAI.js's soft): they take a system's hold down unless it's the
//   owner's, which put it back.
// - A war's over when its liberator or its raider holds everything.
// Each front and attack has a battle on in each step (battleAt): GCW.fight of
// fighting, then a lull; its id and seed are the campaign's, the war's, the
// system's and the step's, so every pilot's is laid out alike.
//
// campaignAt(ms) → { n, epoch, start, end, step, stepStart };
// history(war, n, ms, value) → { war, owner, control, fronts, attacks
//   ([{ sys, by, from, until, rate, origin, counter }]), rates, major, step,
//   areas, over, events ([{ k, at, type, sys, by, … }], the newest EVENTS),
//   counts ([{ k, side: n, worth: { side: n } }] each window, and now),
//   strength ({ side: { systems, worth, share, trend6h } }), majors (every
//   step's major), phase ({ index, name, from, until, next }), nextOp ({ by,
//   at } | null), orders ({ side: { sys, verb, from, until } | null }), eff
//   ({ sys: %/hour } for this step's battles), cut ([systems out of supply]),
//   shaken ({ side: until }), decisive, vp, result ({ winner, vp, decisive,
//   over, final }: who leads in the last step, final once the war's won
//   outright) } (value(key) → the tally's value for a key);
// campaignResult(war, n, value) → a campaign's result once it's over, with n;
// campaignRun(war, n, value), runAt(run, ms) → history's, worked on from
// where the run got to (warState.js keeps one, so a second's table is a
// step's work, not a campaign's);
// battleAt(state, id, ms) → { id, war, sys, seed, attacker, defender, sides
//   (by team: teamsOf), attackerTeam, start, fightEnd, end, fighting } or null;
// warTable(war, ms, value) → what the holotable shows (tableOf(war, ms,
// state), from a history); warTables(ms, value); scoresAt(row, side) →
// whether a side's points count at a table row's system.

import { AREAS, DOCTRINE, SIDES, WARS, WAR_IDS, sideOfCode } from './sides';
import { systemById } from './systems';
import { battleKindIn } from './roster';
import { GCW, HOURS_PER_STEP, NEIGHBOURS, WAR_SYSTEMS, areaHolders, areaOf, hash, oldKey, oldWinKey, opening, pointsKey, seeded, warInfo, winKey, within, worthOf } from './gcwRules';
import { attackPace, frontPace, frontsFor, lean, orderOver, orderTarget, originOf, phaseAt, pointsCount, raiderOrder, reaches, soft, supplied, targetOf } from './gcwAI';

// (the ground rules are gcwRules.js's; the rest of the galaxy has them from here)
export { GCW, NEIGHBOURS, WAR_DEFAULT, WAR_SYSTEMS, areaBonusOf, areaOf, hash, opening, pointsKey, pressureOn, seeded, supplyOf, warInfo, winKey, worthOf } from './gcwRules';

const STEPS = GCW.campaign / GCW.step;
const ATTACK_STEPS = GCW.attackEvery / GCW.step;
const RAID_STEPS = GCW.raidEvery / GCW.step;
const CLIMAX = GCW.phases.length - 1;
const EVENTS = 64; // the newest a history tells of
const TOTAL_WORTH = WAR_SYSTEMS.reduce((t, id) => t + worthOf(id), 0);
const IN_WAR = new Set(WAR_SYSTEMS);

const sideWar = (side) => WAR_IDS.find((w) => WARS[w].liberator === side || WARS[w].raider === side) ?? null;

export function readKey(key) {
  const parts = typeof key === 'string' ? key.split(':') : [];
  const win = parts[0] === 'win';
  const rest = win ? parts.slice(1) : parts;
  let side;
  let sys;
  let step;
  if (rest.length === 3) [side, sys, step] = [sideOfCode(rest[0]), rest[1], rest[2]];
  else if (rest.length === 2) [side, sys, step] = ['rebel', rest[0], rest[1]];
  else return null;
  const war = sideWar(side);
  if (!war || !IN_WAR.has(sys) || !/^\d+$/.test(step)) return null;
  return { side, war, win, sys, step: Number(step) };
}

export function campaignAt(ms) {
  const n = Math.max(0, Math.floor((ms - GCW.start) / GCW.campaign));
  const start = GCW.start + n * GCW.campaign;
  const step = Math.max(0, Math.floor((ms - start) / GCW.step));
  return { n, epoch: `c${n}`, start, end: start + GCW.campaign, step, stepStart: start + step * GCW.step };
}

// a campaign's own order of the systems (the worthiest first), and its
// fronts' rates for each window of it, drawn once
function campaignPlan(war, n) {
  const rand = seeded(`gcw-${war}-${n}`);
  const order = WAR_SYSTEMS.map((id) => [id, rand()])
    .sort((a, b) => worthOf(b[0]) - worthOf(a[0]) || a[1] - b[1])
    .map(([id]) => id);
  const rates = [];
  for (let w = 0; w < STEPS / GCW.window; w++) {
    const r = {};
    for (const id of WAR_SYSTEMS) r[id] = +within(worthOf(id) >= 2 ? GCW.majorRate : GCW.rate, seeded(`gcw-${war}-${n}-${id}-${w}`)()).toFixed(1);
    rates.push(r);
  }
  return { order, rates };
}
const plans = new Map();
const planOf = (war, n) => {
  const key = `${war}:${n}`;
  if (!plans.has(key)) {
    if (plans.size > 24) plans.clear();
    plans.set(key, campaignPlan(war, n));
  }
  return plans.get(key);
};

const sidesOf = (w) => [w.liberator, w.raider, 'hutt'];

// each side's systems, and their worth
function tallyOf(owner, sides) {
  const out = { worth: {} };
  for (const side of sides) (out[side] = 0), (out.worth[side] = 0);
  for (const id of WAR_SYSTEMS) {
    out[owner[id]] += 1;
    out.worth[owner[id]] += worthOf(id);
  }
  return out;
}

// ── A campaign worked through a step at a time ──
//
// A run keeps the war as it stood after its last whole step (s.k of them):
// every map, list and mark the sides decide by is in it, and all of it comes
// from the opening, the dice and the tally, so every pilot's agrees.

function freshState(war) {
  const w = WARS[war];
  const { owner, control } = opening(war);
  const count = tallyOf(owner, sidesOf(w));
  const s = {
    k: 0, // whole steps worked
    owner,
    control,
    count,
    // (the opening's tallyOf, its own: `count` changes with every capture, and the
    // first six hours' trend is measured against this)
    opened: tallyOf(owner, sidesOf(w)),
    attacks: [],
    fronts: [],
    counter: {}, // side → { sys, until }: what it's going back for
    mark: {}, // front → { k, control }: where it stood when last looked at
    rest: {}, // front → the step it's let be till
    lastHit: {}, // system → the step it was last attacked
    nextAt: { [w.raider]: GCW.strike, hutt: RAID_STEPS }, // a side's next operation's step
    shock: {}, // side → the step it's shaken till
    orders: {}, // side → { sys, verb, k, until } (in steps)
    events: [],
    trail: [], // each step's tallyOf, at its end
    majors: [],
    eff: {},
    over: null,
    overStep: null,
    phase: 0,
    decisive: null,
    supply: null,
    holders: null,
  };
  resupply(s, w);
  return s;
}

// supply lines and whole areas, worked out again when an owner's changed
function resupply(s, w) {
  s.supply = Object.fromEntries(sidesOf(w).map((side) => [side, supplied(s.owner, side, w.capitals[side])]));
  s.holders = areaHolders(s.owner);
}

const clone = (s) => ({
  ...s,
  owner: { ...s.owner },
  control: { ...s.control },
  count: { ...s.count },
  attacks: s.attacks.slice(),
  fronts: s.fronts.slice(),
  counter: { ...s.counter },
  mark: { ...s.mark },
  rest: { ...s.rest },
  lastHit: { ...s.lastHit },
  nextAt: { ...s.nextAt },
  shock: { ...s.shock },
  orders: { ...s.orders },
  events: s.events.slice(),
  trail: s.trail.slice(),
  majors: s.majors.slice(),
  eff: { ...s.eff },
});

// a side's points at a system in a step, a battle won there counted once
function pointsOf(value, side, id, k) {
  let p = value(pointsKey(side, id, k));
  let won = value(winKey(side, id, k)) >= 1;
  if (side === 'rebel') {
    p += value(oldKey(id, k));
    won = won || value(oldWinKey(id, k)) >= 1;
  }
  return p / 100 + (won ? GCW.points.win / 100 : 0);
}

// step k of the campaign, f of it (1 whole; less only for the step that's on now)
function play(run, s, k, f) {
  if (s.over) return;
  const { war, n, value } = run;
  const w = WARS[war];
  const { liberator, raider } = w;
  const players = [liberator, raider];
  const { owner, control } = s;
  const plan = planOf(war, n);
  const start = GCW.start + n * GCW.campaign;
  const at = (j) => start + j * GCW.step;
  const event = (e) => s.events.push({ k, at: at(k), ...e });
  const hours = HOURS_PER_STEP * f;
  const ph = phaseAt(k);
  const phase = GCW.phases[ph];
  const climax = ph === CLIMAX;
  const rates = plan.rates[Math.floor(k / GCW.window)];
  const windowEnd = (Math.floor(k / GCW.window) + 1) * GCW.window;
  const might = Object.fromEntries(sidesOf(w).map((side) => [side, phase.mult * lean(s.count, side, s.opened) * (s.shock[side] > k ? GCW.shock : 1)]));
  // (a side's last stand can't fall before the Climax: nobody wastes an attack or an order on it)
  const holdsOut = new Set(climax ? [] : WAR_SYSTEMS.filter((id) => s.count[owner[id]] <= GCW.lastStand));

  // the raider's and the Hutts' operations: when due, or at once for what they've just lost
  for (const by of [raider, 'hutt']) {
    if (s.attacks.some((a) => a.by === by)) continue;
    const counter = s.counter[by]?.until >= k ? s.counter[by].sys : null;
    const due = k >= s.nextAt[by];
    if (!due && !counter) continue;
    const raid = by === 'hutt';
    const targets = raid ? players : [liberator, 'hutt'];
    const rand = seeded(`gcw-${war}-${n}-${by}-${k}`);
    const rate = +(within(raid ? GCW.raidRate : GCW.attackRate, rand()) * might[by]).toFixed(1);
    // (one launched near the campaign's end is over with it: nothing's left to hold out for)
    const until = Math.min(at(k) + (raid ? GCW.raidFor : GCW.attackFor), at(STEPS));
    const hours = (until - at(k)) / 3600e3;
    // Not a last stand: it can't fall before the Climax, and an attack thrown at it, even the only one
    // there is, held the liberator's own front off it for an hour and a half at a time. Nor a Hutt world
    // the attack wouldn't take: the Hutts halve any attack, and 14 to 18% of the raider's went at Hutt
    // worlds and failed, most of them going straight back for what the Hutts had just taken.
    const border = WAR_SYSTEMS.filter((id) => targets.includes(owner[id]) && !holdsOut.has(id) && !s.attacks.some((a) => a.sys === id) && NEIGHBOURS[id].some((o) => owner[o] === by) && (owner[id] !== 'hutt' || reaches({ id, by, owner, control, rate, hours, holders: s.holders }, GCW.huttReach)));
    const forced = counter && border.includes(counter) ? counter : null;
    if (!forced && !due) continue;
    if (!border.length) {
      s.nextAt[by] = k + GCW.retry;
      continue;
    }
    const sys = forced ?? targetOf({ by, border, owner, control, rate, hours, capitals: w.capitals, lastHit: s.lastHit, k, rand, holders: s.holders, holdsOut });
    const origin = originOf(owner, control, sys, by);
    s.attacks.push({ sys, by, from: at(k), until, rate, origin, counter: Boolean(forced) });
    event({ type: raid ? 'raid' : 'attack', sys, by, holder: owner[sys], origin, counter: Boolean(forced) });
    s.lastHit[sys] = k;
    if (forced) delete s.counter[by];
    // (the raider's pace is its phase's and its doctrine's, quicker when it's the underdog, slower when it holds most)
    const every = DOCTRINE[by].every ?? 1;
    if (raid) s.nextAt[by] = k + Math.round(RAID_STEPS * every);
    else s.nextAt[by] = k < ATTACK_STEPS ? ATTACK_STEPS : k + Math.round((phase.every * every) / lean(s.count, by, s.opened));
  }

  // the liberator's order (a new one when the last's done, out of time, under someone else's attack, or
  // its push stalled last step), then its fronts (the order first, so the major order is the order its
  // pilots are given, then a system to retake), then every battle's %/hour, then the raider's order
  const busy = new Set(s.attacks.map((a) => a.sys));
  const state = () => ({ owner, attacks: s.attacks, fronts: s.fronts, liberator, raider, eff: s.eff });
  const lo = s.orders[liberator];
  if (!lo || k >= lo.until || orderOver(lo, state())) {
    const border = plan.order.filter((id) => owner[id] !== liberator && !busy.has(id) && NEIGHBOURS[id].some((o) => owner[o] === liberator));
    const sys = orderTarget({ liberator, border, owner, control, rates, might: might[liberator], capitals: w.capitals, supply: s.supply, previous: lo?.sys ?? null, rand: seeded(`gcw-${war}-${n}-${liberator}-order-${k}`), holders: s.holders, holdsOut });
    s.orders[liberator] = sys ? { sys, verb: 'liberate', k, until: windowEnd } : null;
  }
  const retake = s.counter[liberator]?.until >= k ? s.counter[liberator].sys : null;
  s.fronts = frontsFor({ owner, order: plan.order, liberator, busy, rest: s.rest, k, lead: [s.orders[liberator]?.sys, retake], later: holdsOut });
  const attackOf = Object.fromEntries(s.attacks.map((a) => [a.sys, a]));
  s.eff = {};
  for (const a of s.attacks) s.eff[a.sys] = attackPace({ id: a.sys, by: a.by, owner, rate: a.rate, holders: s.holders });
  for (const id of s.fronts) {
    if (attackOf[id]) continue;
    let r = rates[id] * might[liberator] + (id === retake ? GCW.counterBonus : 0);
    if (climax && id === s.fronts[0]) r *= GCW.climaxMult;
    s.eff[id] = frontPace({ id, owner, liberator, rate: r, supply: s.supply, holders: s.holders });
  }
  const ro = s.orders[raider];
  if (!ro || k >= ro.until || orderOver(ro, state())) {
    const o = raiderOrder({ raider, owner, control, attacks: s.attacks, fronts: s.fronts, eff: s.eff });
    s.orders[raider] = o ? { ...o, k, until: windowEnd } : null;
  }
  if (ph !== s.phase) {
    s.phase = ph;
    event({ type: 'phase', phase: phase.name, sys: climax ? (s.fronts[0] ?? null) : null });
  }
  s.decisive = climax ? (s.fronts[0] ?? s.decisive) : null;
  s.majors[k] = s.fronts[0] ?? null;

  // a front that's barely moved in GCW.stall steps is let be as long again (not the major, nor the order)
  const marks = {};
  for (const id of s.fronts) {
    let m = s.mark[id] ?? { k, control: control[id] };
    if (k - m.k >= GCW.stall) {
      if (m.control - control[id] < GCW.stallDrop && id !== s.fronts[0] && id !== s.orders[liberator]?.sys) {
        s.rest[id] = k + GCW.stall;
        continue;
      }
      m = { k, control: control[id] };
    }
    marks[id] = m;
  }
  s.mark = marks;

  // every system's hold: the battle there and the players' points, or mending
  const lost = [];
  for (const id of WAR_SYSTEMS) {
    const holder = owner[id];
    const attack = attackOf[id];
    const by = attack ? attack.by : s.fronts.includes(id) ? liberator : null;
    // (whole, with nobody after it: its own pilots can't make it more than whole)
    if (!by && control[id] >= 1) continue;
    // (a side's pilots count at a battle, or holding their own: gcwAI.js's pointsCount)
    let fall = 0;
    for (const side of players) if (pointsCount(side, holder, Boolean(by))) fall += (side === holder ? -1 : 1) * soft(pointsOf(value, side, id, k));
    if (by) fall += (s.eff[id] / 100) * hours;
    else if (s.supply[holder].has(id)) fall -= (GCW.regen / 100) * hours;
    let c = Math.min(1, control[id] - fall);
    if (!climax && s.count[holder] <= GCW.lastStand) c = Math.max(c, GCW.lastHold);
    if (c > 0) control[id] = c;
    else lost.push(id);
  }

  // what fell, to whoever was after it (but not a side's last system before the Climax)
  let moved = false;
  for (const id of lost) {
    const holder = owner[id];
    const by = attackOf[id]?.by ?? liberator;
    if (!climax && s.count[holder] <= GCW.lastStand) {
      control[id] = GCW.lastHold;
      continue;
    }
    owner[id] = by;
    control[id] = GCW.captured;
    s.count[holder] -= 1;
    s.count[by] += 1;
    s.attacks = s.attacks.filter((a) => a.sys !== id);
    delete s.mark[id];
    moved = true;
    event({ type: 'captured', sys: id, by, from: holder });
    if (w.capitals[holder] === id) {
      event({ type: 'capital', sys: id, by, from: holder });
      s.shock[holder] = k + GCW.shockFor;
    }
    if (holder !== 'hutt') s.counter[holder] = { sys: id, until: k + GCW.counterFor };
    if (!climax && s.count[holder] === GCW.lastStand) event({ type: 'lastStand', sys: WAR_SYSTEMS.find((x) => owner[x] === holder), by: holder });
  }
  if (moved) {
    const was = s.holders;
    resupply(s, w);
    for (const a of AREAS) if (s.holders[a.id] && s.holders[a.id] !== was[a.id]) event({ type: 'area', area: a.id, by: s.holders[a.id], from: was[a.id] });
  }

  // an attack's over: held to the end, the system gets some of its hold back
  if (f === 1)
    s.attacks = s.attacks.filter((a) => {
      if (at(k + 1) < a.until) return true;
      control[a.sys] = Math.min(1, control[a.sys] + GCW.repelled);
      event({ type: 'repelled', sys: a.sys, by: a.by, holder: owner[a.sys] });
      return false;
    });
  s.trail[k] = moved || !k ? tallyOf(owner, sidesOf(w)) : s.trail[k - 1];
  const all = players.find((side) => s.count[side] === WAR_SYSTEMS.length);
  if (all) {
    s.over = all;
    s.overStep = k;
    s.fronts = [];
    s.attacks = [];
  }
}

// what a run's state comes to at step `last`: the history
function finish(run, s, last) {
  const { war, n } = run;
  const w = WARS[war];
  const sides = sidesOf(w);
  const start = GCW.start + n * GCW.campaign;
  const at = (j) => start + j * GCW.step;
  const step = s.over ? s.overStep : last;
  const owner = s.owner;
  const control = {};
  for (const id of WAR_SYSTEMS) control[id] = +s.control[id].toFixed(6);
  const areas = {};
  for (const a of AREAS) {
    const r = { total: 0, holder: s.holders[a.id] };
    for (const id of WAR_SYSTEMS)
      if (areaOf(id) === a.id) {
        r.total += 1;
        r[owner[id]] = (r[owner[id]] ?? 0) + 1;
      }
    areas[a.id] = r;
  }
  // each side's systems and worth each window, and now; and as the step six hours back began
  const counts = [];
  for (let j = 0; j <= step; j += GCW.window) counts.push({ k: j, ...s.trail[j] });
  if (step % GCW.window) counts.push({ k: step, ...s.trail[step] });
  const now = s.trail[step];
  const ago = step > GCW.window ? s.trail[step - GCW.window - 1] : s.opened;
  const strength = Object.fromEntries(sides.map((side) => [side, { systems: now[side], worth: now.worth[side], share: +(now.worth[side] / TOTAL_WORTH).toFixed(3), trend6h: now[side] - ago[side] }]));
  const ph = phaseAt(step);
  const next = GCW.phases[ph + 1] ?? null;
  const phase = { index: ph, name: GCW.phases[ph].name, from: at(GCW.phases[ph].from), until: at(next ? next.from : STEPS), next: next?.name ?? null };
  // a side's next operation: when it's due, or when the one it has on is over
  const due = (by) => {
    const on = s.attacks.find((a) => a.by === by);
    const j = Math.max(s.nextAt[by], on ? Math.ceil((on.until - start) / GCW.step) : 0);
    return j < STEPS ? { by, at: at(j) } : null;
  };
  const nextOp = s.over ? null : ([due(w.raider), due('hutt')].filter(Boolean).sort((a, b) => a.at - b.at)[0] ?? null);
  const orders = {};
  for (const side of [w.liberator, w.raider]) {
    const o = s.over ? null : s.orders[side];
    orders[side] = o ? { sys: o.sys, verb: o.verb, from: at(o.k), until: at(o.until) } : null;
  }
  const shaken = {};
  for (const [side, j] of Object.entries(s.shock)) if (j > step) shaken[side] = at(j);
  // victory points: the worth of what each side holds (the more systems, on a tie)
  const vp = { ...now.worth };
  const winner = sides.reduce((b, side) => (vp[side] > vp[b] || (vp[side] === vp[b] && now[side] > now[b]) ? side : b));
  return {
    war,
    owner,
    control,
    fronts: s.fronts,
    attacks: s.attacks,
    rates: planOf(war, n).rates[Math.floor(last / GCW.window)],
    major: s.fronts[0] ?? null,
    step,
    areas,
    over: s.over,
    events: s.events.slice(-EVENTS),
    counts,
    strength,
    majors: s.majors,
    phase,
    nextOp,
    orders,
    eff: s.eff,
    cut: WAR_SYSTEMS.filter((id) => !s.supply[owner[id]].has(id)),
    shaken,
    decisive: s.over ? null : s.decisive,
    vp,
    // (in the last step it's who leads: that step's battles and points still count till the end; a war
    // won outright is over at once)
    result: s.over || step === STEPS - 1 ? { winner: s.over ?? winner, vp, decisive: s.decisive, over: s.over, final: Boolean(s.over) } : null,
  };
}

// a campaign to work through: history's, kept, so it can be worked on from
// where it got to (a later moment costs the steps since, not the campaign)
export const campaignRun = (war, n, value = () => 0) => ({ war, n, value, s: freshState(war) });

export function runAt(run, ms, keep = true) {
  const start = GCW.start + run.n * GCW.campaign;
  const upto = Math.max(0, Math.min(GCW.campaign - 1, ms - start));
  const last = Math.floor(upto / GCW.step);
  const frac = (upto - last * GCW.step) / GCW.step;
  // (a moment before where it got to: from the start again)
  if (run.s.k > last) run.s = freshState(run.war);
  for (; run.s.k < last; run.s.k += 1) play(run, run.s, run.s.k, 1);
  // the step that's on now, part played (on a copy, unless the run's done with)
  const s = keep ? clone(run.s) : run.s;
  play(run, s, last, frac);
  return finish(run, s, last);
}

export const history = (war, n, ms, value = () => 0) => runAt(campaignRun(war, n, value), ms, false);

// a campaign's result once it's over: the war at its last moment, with the tally as it stood
export const campaignResult = (war, n, value = () => 0) => ({ ...history(war, n, GCW.start + (n + 1) * GCW.campaign - 1, value).result, n, final: true });

// a battle's two sides by team, as the battle engine and the set pieces have
// them: the light side 0, the dark 1, the Hutts in the place of whichever
// isn't there
export function teamsOf(a, b) {
  const light = [a, b].find((x) => SIDES[x].stance === 'light') ?? null;
  const dark = [a, b].find((x) => SIDES[x].stance === 'dark') ?? null;
  return light && dark ? [light, dark] : light ? [light, 'hutt'] : ['hutt', dark];
}

export function battleAt(state, sys, ms) {
  const attack = state.attacks.find((a) => a.sys === sys);
  if (!attack && !state.fronts.includes(sys)) return null;
  const c = campaignAt(ms);
  const id = `${c.epoch}.${state.war}.${sys}.${c.step}`;
  const attacker = attack ? attack.by : WARS[state.war].liberator;
  const defender = state.owner[sys];
  const sides = teamsOf(attacker, defender);
  return {
    id,
    war: state.war,
    sys,
    step: c.step,
    seed: hash(id),
    attacker,
    defender,
    sides,
    attackerTeam: sides.indexOf(attacker),
    start: c.stepStart,
    fightEnd: c.stepStart + GCW.fight,
    end: c.stepStart + GCW.step,
    fighting: ms < c.stepStart + GCW.fight,
  };
}

// what the holotable shows of a war's history at a moment
export function tableOf(war, ms, s) {
  const c = campaignAt(ms);
  const cut = new Set(s.cut);
  return {
    war,
    campaign: c.n,
    epoch: c.epoch,
    ends: c.end,
    step: c.step,
    major: s.major,
    areas: s.areas,
    over: s.over,
    phase: s.phase,
    nextOp: s.nextOp,
    orders: s.orders,
    events: s.events,
    counts: s.counts,
    strength: s.strength,
    decisive: s.decisive,
    result: s.result,
    // (the campaign before's result, at the start of the next: only a browser that was there knows it,
    // so warState.js's warNow fills it in)
    previous: null,
    systems: WAR_SYSTEMS.map((id) => {
      const attack = s.attacks.find((a) => a.sys === id) ?? null;
      const front = s.fronts.includes(id);
      const info = warInfo(id);
      return {
        id,
        name: systemById(id).name,
        owner: s.owner[id],
        control: s.control[id],
        front,
        major: s.major === id,
        attack,
        rate: front ? s.rates[id] : attack ? attack.rate : null,
        effRate: front || attack ? (s.eff[id] ?? null) : null,
        cut: cut.has(id),
        decisive: s.decisive === id,
        worth: info.worth,
        kind: battleKindIn(info.kind, war), // (as it's laid: an interdiction without an Interdictor is a siege)
        area: info.area,
        battle: battleAt(s, id, ms),
      };
    }),
  };
}

export const warTable = (war, ms, value = () => 0) => tableOf(war, ms, history(war, campaignAt(ms).n, ms, value));

// whether a side's points count at a system, as its warTable row has it (at a
// battle, or at its own system: what history counts), so nothing posts points
// that would only fill the tally
export const scoresAt = (row, side) => pointsCount(side, row.owner, Boolean(row.battle));

export const warTables = (ms, value = () => 0) => Object.fromEntries(WAR_IDS.map((war) => [war, warTable(war, ms, value)]));
