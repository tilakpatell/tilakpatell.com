// Cover as the game picks it (spec catalogue 7): the navgrid's slots scored
// by one of the game's cover queries (`AI/BattleAI/Cover/Queries/*`, in
// ai.json). A query is a list of terms; the ones this scorer reads are the
// game's query styles, each a curve over an angle or a distance between the
// target, the actor and the cover:
//
//   CoverQueryStyle_Angle            the angle at `from` between the cover and the other party
//   CoverQueryStyle_Distance         the distance `from` → `to`
//   CoverQueryStyle_ProjectedDistance  that distance along the actor's line to the target
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
//   pickCover(nav, ctx) → slot | null       queryFor(ai, branch) → the query row a branch uses
//   unknownTerms: Set of term names met and skipped

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

// The queries the brain's branches use: the ones written in the game's query
// styles. The Empire's own (`Attack_Empire_Stormtrooper`, `Hide_Empire_…`)
// are in the older numbered-curve form this scorer does not read, so both
// sides use the Rebel soldier's.
export const BRANCHES = { attack: 'Attack_Rebel_Soldier', hide: 'Hide', flee: 'Flee', protective: 'Protective' };
export const queryFor = (ai, branch) => ai.cover.queries[BRANCHES[branch] ?? branch] ?? null;

// piecewise linear through the term's points (repeated x make a step); flat past the ends
export function curveAt(xs, ys, x) {
  if (!xs.length) return 0;
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const span = xs[i] - xs[i - 1];
      if (span <= 0) return ys[i];
      return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / span;
    }
  }
  return ys[ys.length - 1];
}

const DEG = 180 / Math.PI;
const signedAngle = (ax, az, bx, bz) => Math.atan2(ax * bz - az * bx, ax * bx + az * bz) * DEG;

// the three parties as [x, z]
function where(name, ctx, slot) {
  if (name === 'CoverQueryPosition_TargetPosition') return ctx.threat;
  if (name === 'CoverQueryPosition_ActorPosition') return ctx.me;
  return [slot.at[0], slot.at[2]];
}

function angleTerm(term, ctx, slot) {
  const from = where(term.from, ctx, slot);
  const to = where(term.to, ctx, slot);
  // at the target, measured from its line to the actor; at the actor, from
  // the line away from the target (where it would fall back to)
  const ref = term.from === 'CoverQueryPosition_TargetPosition' ? [ctx.me[0] - from[0], ctx.me[1] - from[1]] : [ctx.me[0] - ctx.threat[0], ctx.me[1] - ctx.threat[1]];
  const v = [to[0] - from[0], to[1] - from[1]];
  if (Math.hypot(...v) < 1e-6 || Math.hypot(...ref) < 1e-6) return curveAt(term.x, term.score, 0);
  return curveAt(term.x, term.score, signedAngle(ref[0], ref[1], v[0], v[1]));
}

function distanceTerm(term, ctx, slot, projected) {
  const from = where(term.from, ctx, slot);
  const to = where(term.to, ctx, slot);
  let d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (projected) {
    const ax = ctx.threat[0] - ctx.me[0];
    const az = ctx.threat[1] - ctx.me[1];
    const L = Math.hypot(ax, az) || 1;
    d = ((to[0] - from[0]) * ax + (to[1] - from[1]) * az) / L;
  }
  return curveAt(term.x, term.score, d);
}

// a term's score for a slot; null rules the slot out
function termScore(term, ctx, slot) {
  switch (term.term) {
    case 'CoverQueryStyle_Angle':
      return angleTerm(term, ctx, slot);
    case 'CoverQueryStyle_Distance':
      return distanceTerm(term, ctx, slot, false);
    case 'CoverQueryStyle_ProjectedDistance':
      return distanceTerm(term, ctx, slot, true);
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
const covered = (ctx, slot) => !ctx.nav || !lineClear(ctx.nav, [slot.at[0], slot.at[1] + PEEK, slot.at[2]], [ctx.threat[0], slot.at[1] + 1.2, ctx.threat[1]]);

export function scoreSlots(slots, ctx) {
  const out = [];
  for (const slot of slots) {
    if (!shields(slot, ctx.threat) || !covered(ctx, slot)) continue;
    let score = 0;
    let out_ = false;
    for (const term of ctx.query?.terms ?? []) {
      const s = termScore(term, ctx, slot);
      if (s === null) {
        out_ = true;
        break;
      }
      score += s;
    }
    if (out_) continue;
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
