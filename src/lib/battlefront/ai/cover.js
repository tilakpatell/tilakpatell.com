// Cover as the game picks it (spec catalogue 7): the navgrid's slots scored
// by one of the game's cover queries (`AI/BattleAI/Cover/Queries/*`, in
// ai.json). A query is a list of terms; the ones this scorer reads are the
// game's query styles, each a curve over an angle or a distance between the
// target, the actor and the cover:
//
//   CoverQueryStyle_Angle            the angle at `from` between the cover and the other party (from the term's `ref`)
//   CoverQueryStyle_Distance         the distance `from` → `to`
//   CoverQueryStyle_ProjectedDistance  that distance along the term's `ref`
//   FilterCoversByRadius             only slots within `Radius` of the actor
//   FilterCoversByWeaponRange        only slots within the weapon's range of the target
//   FilterCoversByDefendArea         (no defend areas until the modes; passes)
//   DistanceToMultiTargetsScoreData  a penalty for a slot within `MaxDistanceToTarget` of an enemy
//
// Every other term (the older queries' numbered curves and validators) is
// skipped and counted once in `unknownTerms`. A slot whose solid does not
// stand between it and the threat (on the line from the slot at `PEEK`, given
// a navgrid) is not cover and is never offered.
//
//   scoreSlots(slots, { me, threat, enemies, objective, query, range, taken, who, nav }) → [{ slot, score }] (best first)
//     (and, where the brain has them: meY, threatY, preferred: the weapon's { Start, Ideal, End })
//   pickCover(nav, ctx) → slot | null       queryFor(ai, branch) → the query row a branch uses
//   unknownTerms: Set of term names met and skipped
//   covered(ctx, slot) → the slot's solid stands between it and ctx.threat (given ctx.nav)
//   lineOfFire(nav, slot, threat, threatY) → a bot at the slot has a line to the threat, standing
//     over the solid or stepping SIDE round it (what `coverQuery.js`'s LineOfFire reads)
//
// This scorer is the brain's fallback now: `coverQuery.js` runs the game's
// selection-form queries first, and this one only when they offer nothing.
//
// Where the game's own AI code answers how a term is scored, it is the law
// (BattleAI's `Reason/CoverRequestJob/CoverRequestJob.cpp`, `scoreCoverRequests`
// and `applyScore`; `Reason/TacticCoverEvaluator.cpp`; the sheet in
// docs/superpowers/evidence/bf-ai-source/README.md, rows C2 and C3): any score
// below nothing rejects the slot; an angle or a projection is measured from
// the term's own `ref` (the cover's facing, the bot's line to the target or
// the target's to the bot); a term applies only to the cover kinds and edges
// its `filter` names, a slot's unknown sides counted by the best they could
// be; a switched-off term is skipped; a preferred-range term takes its X from
// the weapon. A row without these fields (an older ai.json) reads as before.

import { coverSlots, lineClear, shields } from '../nav.js';

export const unknownTerms = new Set();

// A slot nearer the objective scores this much more per 100 m nearer (the
// game's objective terms are in the logic graphs, not the queries): the
// modes' knob, by hand.
export const OBJECTIVE_WEIGHT = 1;
// The height a slot is tested from for protection: under the game's
// `CrouchHeight` (0.94), so a crouch-high solid hides a crouching bot.
export const PEEK = 0.8;
// How far round the actor pickCover looks when a query has no radius filter.
export const SEARCH = 30;
// The height a bot fires from standing (the game's `StandHeight`), and how
// far it steps round the side of a solid too tall to fire over. By hand.
export const STAND = 1.7;
export const SIDE = 1;

// The queries the brain's branches use: the ones written in the game's query
// styles. The Empire's own (`Attack_Empire_Stormtrooper`, `Hide_Empire_…`)
// are in the older numbered-curve form this scorer does not read, so both
// sides use the Rebel soldier's.
const BRANCHES = { attack: 'Attack_Rebel_Soldier', hide: 'Hide', flee: 'Flee', protective: 'Protective' };
export const queryFor = (ai, branch) => ai.cover.queries[BRANCHES[branch] ?? branch] ?? null;

// piecewise linear through the term's points, as the game reads its curves
// (`Brain/Utils/PiecewiseLinear.h`, `PiecewiseLinear::evaluate`): the first
// value before the first point, the last past the last, and at a repeated x
// (a step) the value after the step
export function curveAt(xs, ys, x) {
  const n = Math.min(xs.length, ys.length);
  if (!n) return 0;
  let i = 0;
  while (i < n && xs[i] <= x) i++;
  if (i === 0) return ys[0];
  if (i === n) return ys[n - 1];
  return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
}

const DEG = 180 / Math.PI;
const signedAngle = (ax, az, bx, bz) => Math.atan2(ax * bz - az * bx, ax * bx + az * bz) * DEG;

// the three parties as [x, z]; a position the sim has none of (the human's, the squad's) is null
function where(name, ctx, slot) {
  if (name === 'CoverQueryPosition_TargetPosition') return ctx.threat;
  if (name === 'CoverQueryPosition_ActorPosition') return ctx.me;
  if (name == null || name === 'CoverQueryPosition_CoverPosition') return [slot.at[0], slot.at[2]];
  return null;
}

// a party's height where the context has it (for a projection on the world's up)
function heightOf(name, ctx, slot) {
  if (name === 'CoverQueryPosition_TargetPosition') return ctx.threatY;
  if (name === 'CoverQueryPosition_ActorPosition') return ctx.meY;
  return slot.at[1];
}

const UP = 'up';
const unit = (v) => {
  const L = Math.hypot(v[0], v[1]);
  return L > 1e-9 ? [v[0] / L, v[1] / L] : [0, 0];
};

// The direction a term measures from (`Reason/TacticCoverEvaluator.cpp`,
// `getDirection`; the cover's own facing in `CoverRequestJob.cpp`): the slot's
// normal, which points away from its solid as the game's cover direction does;
// the bot's line to the target or the target's to the bot; the world's up.
// None for the human's and the squad's directions, which the sim lacks.
function refOf(term, ctx, slot) {
  switch (term.ref) {
    case 'CoverQueryDirection_CoverDirection':
      return unit(slot.normal);
    case 'CoverQueryDirection_ActorToTargetDirection':
      return unit([ctx.threat[0] - ctx.me[0], ctx.threat[1] - ctx.me[1]]);
    case 'CoverQueryDirection_TargetToActorDirection':
      return unit([ctx.me[0] - ctx.threat[0], ctx.me[1] - ctx.threat[1]]);
    case 'CoverQueryDirection_WorldUpDirection':
      return UP;
    default:
      return null;
  }
}

// `CoverRequestJob.cpp`, `angleRelativeDirectionDeg`: the angle between the
// way from `from` to `to` and the reference, positive on the reference's right
// (the world's up crossed with it), none for two parties a centimetre apart
function angleFrom(from, to, ref) {
  const d = [to[0] - from[0], to[1] - from[1]];
  const L = Math.hypot(d[0], d[1]);
  if (L <= 0.01) return 0;
  const u = [d[0] / L, d[1] / L];
  const a = Math.acos(Math.max(-1, Math.min(1, u[0] * ref[0] + u[1] * ref[1]))) * DEG;
  return u[0] * ref[1] - u[1] * ref[0] >= 0 ? a : -a;
}

// a curve's X: the record's, or the weapon's preferred range where the term
// says so (`TacticCoverEvaluator.cpp`: start, start, the ideal between, end, end)
const xsOf = (term, ctx) => {
  const P = ctx.preferred;
  if (term.xSource !== 'WeaponPreferredRange' || !P) return term.x;
  return [P.Start, P.Start, P.Start + P.Ideal * (P.End - P.Start), P.End, P.End];
};

// An angle, distance or projection term by the source's rule; undefined
// where a party or the reference is one the sim has none of. A row with no
// `ref` (an older ai.json) is read the way it was by hand: an angle at the
// target from its line to the bot, at the bot from the line away from the
// target, and a projection along the bot's line to the target.
function curveTerm(term, ctx, slot) {
  const from = where(term.from, ctx, slot);
  const to = where(term.to, ctx, slot);
  if (!from || !to) return undefined;
  const xs = xsOf(term, ctx);
  if (term.term === 'CoverQueryStyle_Distance') return curveAt(xs, term.score, Math.hypot(to[0] - from[0], to[1] - from[1]));
  if (term.ref === undefined) return handTerm(term, ctx, from, to);
  const ref = refOf(term, ctx, slot);
  if (!ref) return undefined;
  if (term.term === 'CoverQueryStyle_Angle') return curveAt(xs, term.score, angleFrom(from, to, ref === UP ? [0, 0] : ref));
  if (ref === UP) {
    const y0 = heightOf(term.from, ctx, slot);
    const y1 = heightOf(term.to, ctx, slot);
    return y0 == null || y1 == null ? undefined : curveAt(xs, term.score, y1 - y0);
  }
  return curveAt(xs, term.score, (to[0] - from[0]) * ref[0] + (to[1] - from[1]) * ref[1]);
}

function handTerm(term, ctx, from, to) {
  if (term.term === 'CoverQueryStyle_Angle') {
    const ref = term.from === 'CoverQueryPosition_TargetPosition' ? [ctx.me[0] - from[0], ctx.me[1] - from[1]] : [ctx.me[0] - ctx.threat[0], ctx.me[1] - ctx.threat[1]];
    const v = [to[0] - from[0], to[1] - from[1]];
    if (Math.hypot(...v) < 1e-6 || Math.hypot(...ref) < 1e-6) return curveAt(term.x, term.score, 0);
    return curveAt(term.x, term.score, signedAngle(ref[0], ref[1], v[0], v[1]));
  }
  const ax = ctx.threat[0] - ctx.me[0];
  const az = ctx.threat[1] - ctx.me[1];
  const L = Math.hypot(ax, az) || 1;
  return curveAt(term.x, term.score, ((to[0] - from[0]) * ax + (to[1] - from[1]) * az) / L);
}

// A term applies to a slot of the cover kinds and edges its filter names
// (`CoverRequestJob.cpp`, `isApplicable`). The navgrid's slots: a full-height
// solid is a stand cover with its top blocked, a lower one a crouch cover with
// its top open (by hand: the navgrid has those two heights). Their sides are
// not known to it, so `sides` ([left blocked, right blocked]) is tried every way.
const KIND = { stand: 'StandCovers', crouch: 'CrouchCovers' };
const SIDE_FLAGS = new Set(['LeftBlocked', 'LeftNotBlocked', 'RightBlocked', 'RightNotBlocked']);
function applies(term, slot, sides) {
  const f = term.filter;
  if (!f) return true;
  if (!f.includes(KIND[slot.height] ?? 'StandCovers')) return false;
  const top = slot.height !== 'crouch';
  if ((f.includes('TopBlocked') && !top) || (f.includes('TopNotBlocked') && top)) return false;
  if ((f.includes('LeftBlocked') && !sides[0]) || (f.includes('LeftNotBlocked') && sides[0])) return false;
  if ((f.includes('RightBlocked') && !sides[1]) || (f.includes('RightNotBlocked') && sides[1])) return false;
  return true;
}

// a term's score for a slot; null rules the slot out; undefined adds nothing
function termScore(term, ctx, slot) {
  switch (term.term) {
    case 'CoverQueryStyle_Angle':
    case 'CoverQueryStyle_Distance':
    case 'CoverQueryStyle_ProjectedDistance':
      return curveTerm(term, ctx, slot);
    case 'FilterCoversByRadius':
      return Math.hypot(slot.at[0] - ctx.me[0], slot.at[2] - ctx.me[1]) <= term.Radius ? 0 : null;
    case 'FilterCoversByWeaponRange':
      return Math.hypot(slot.at[0] - ctx.threat[0], slot.at[2] - ctx.threat[1]) <= (ctx.range ?? Infinity) ? 0 : null;
    case 'FilterCoversByDefendArea':
      return 0;
    case 'DistanceToMultiTargetsScoreData': {
      let s = 0;
      for (const e of ctx.enemies ?? []) {
        const d = Math.hypot(slot.at[0] - e[0], slot.at[2] - e[1]);
        if (d < term.MaxDistanceToTarget) s = Math.min(s, -(1 - d / term.MaxDistanceToTarget));
      }
      return s;
    }
    default:
      unknownTerms.add(term.term);
      return 0;
  }
}

// with a navgrid, the solid must truly stand between the slot and the threat
export const covered = (ctx, slot) => !ctx.nav || !lineClear(ctx.nav, [slot.at[0], slot.at[1] + PEEK, slot.at[2]], [ctx.threat[0], slot.at[1] + 1.2, ctx.threat[1]]);

export function lineOfFire(nav, slot, threat, threatY = slot.at[1] + 1.2) {
  const t = [threat[0], threatY, threat[1]];
  if (lineClear(nav, [slot.at[0], slot.at[1] + STAND, slot.at[2]], t)) return true;
  const tx = -slot.normal[1];
  const tz = slot.normal[0];
  for (const k of [-1, 1]) if (lineClear(nav, [slot.at[0] + tx * k * SIDE, slot.at[1] + 1.2, slot.at[2] + tz * k * SIDE], t)) return true;
  return false;
}

// A slot's score with its sides one way: the terms that apply, summed; a
// switched-off term skipped; any score below nothing rejects the slot
// (`CoverRequestJob.cpp`, `applyScore`) → number | null
function slotScore(slot, ctx, terms, sides) {
  let score = 0;
  for (const term of terms) {
    if (term.enabled === false || !applies(term, slot, sides)) continue;
    const s = termScore(term, ctx, slot);
    if (s === null || s < 0) return null;
    if (s !== undefined) score += s;
  }
  return score;
}

const ONE_WAY = [[false, false]];
const EVERY_WAY = [
  [false, false],
  [true, false],
  [false, true],
  [true, true],
];

export function scoreSlots(slots, ctx) {
  const out = [];
  const terms = ctx.query?.terms ?? [];
  // (the sides tried every way only where a term asks for one; the best way counts)
  const ways = terms.some((t) => t.filter?.some((k) => SIDE_FLAGS.has(k))) ? EVERY_WAY : ONE_WAY;
  for (const slot of slots) {
    if (!shields(slot, ctx.threat) || !covered(ctx, slot)) continue;
    let score = null;
    for (const sides of ways) {
      const s = slotScore(slot, ctx, terms, sides);
      if (s !== null && (score === null || s > score)) score = s;
    }
    if (score === null) continue;
    if (ctx.objective) {
      const d0 = Math.hypot(ctx.me[0] - ctx.objective[0], ctx.me[1] - ctx.objective[1]);
      const d1 = Math.hypot(slot.at[0] - ctx.objective[0], slot.at[2] - ctx.objective[1]);
      score += (OBJECTIVE_WEIGHT * (d0 - d1)) / 100;
    }
    if (ctx.taken?.has(slot) && ctx.taken.get(slot) !== ctx.who) continue;
    out.push({ slot, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

const radiusOf = (query) => query?.terms?.find((t) => t.term === 'FilterCoversByRadius')?.Radius ?? SEARCH;

// the best slot the query scores above nothing, among those round the actor
export function pickCover(nav, ctx) {
  const slots = coverSlots(nav, ctx.me, Math.min(radiusOf(ctx.query), ctx.search ?? SEARCH));
  const best = scoreSlots(slots, { ...ctx, nav })[0];
  return best && best.score > 0 ? best.slot : null;
}
