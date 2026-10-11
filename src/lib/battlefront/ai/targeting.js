// Which enemy a bot shoots, by the game's AI system (`AI/BattleAI/System/
// AISystem`'s `TargetingData`, ai.json's `system.targeting`; `AISystem_PvE`
// for the Skirmish bots). The game scores each target by a distance read
// through `TargetDistanceEvaluation` (10 at 0 m falling to 0 at 500 m), the
// distance first scaled by what is true of the target:
//
//   TargetVisibleDistScale      0.5  seen now (a belief from a sound or an alert is not)
//   CurrentTargetDistScale      0.8  the one it is already shooting
//   ElevationDistScaleY         2    more than ElevationAboveThreshold (2 m) above the bot
//   CurrentHumanTargetLowHealthDistScale  a human at or under LowHealthPercentage (1 in multiplayer: no change)
//
// and the score then scaled by HumanPreferenceScale (2.5) for a human player.
// Only beliefs are scored (the bot's senses, `lib/ai/perception`), never the
// truth, so a target the senses have not met is never picked. A bot keeps
// its target for `Shooting.KeepFiringAtPlayerTime` (4 s) or `…AtAITime` (2 s)
// before it switches. The squad's target coordinator (`EnableTargetCoordinator`)
// lets at most `VisibleTargetLimit` of a squad (1: all of it) share a target.
//
// Read by hand, `source: "hand"` in NOTES.md: the system's `SuppressionScore`
// (front 0.5, back 0.7) as a bonus on the score for a target facing the bot
// or with its back to it. Pure.
//
//   scoreTargets(brain, seen, { system, who, current }) → [{ id, score }] (best first)
//     seen: hostile beliefs; who(id) → the sim's entity (bot, hp, hpMax, yaw, at) or null
//   pickTarget(brain, seen, { system, who, now, assigned }) → id | null (and brain.target, brain.targetSince)
//   coordinate(scores, { system }) → Map(member → target id); scores: Map(member → its scoreTargets)

import { curveAt } from './curve.js';

export function scoreTargets(brain, seen, { system, who = () => null, current = null }) {
  const T = system.targeting;
  const me = brain.s.at;
  const out = [];
  for (const b of seen) {
    if (!b || b.hostile === false || !(b.confidence > 0)) continue;
    const e = who(b.id);
    if (e && e.alive === false) continue;
    let d = Math.hypot(b.at.x - me[0], b.at.z - me[2]);
    if (b.visible) d *= T.targetVisibleDistScale;
    if (b.id === current) d *= T.currentTargetDistScale;
    if (b.at.y - me[1] > T.elevationAboveThreshold) d *= T.elevationDistScaleY;
    const human = !!e && e.bot === false;
    if (human && e.hpMax > 0 && e.hp / e.hpMax <= T.lowHealthPercentage) d *= T.currentHumanTargetLowHealthDistScale;
    let score = curveAt(T.targetDistanceEvaluation, d);
    if (human) score *= T.humanPreferenceScale;
    if (e && Number.isFinite(e.yaw) && T.suppressionScore) {
      const facing = Math.sin(e.yaw) * (me[0] - e.at[0]) + Math.cos(e.yaw) * (me[2] - e.at[2]) > 0;
      score *= 1 + (facing ? T.suppressionScore.front : T.suppressionScore.back);
    }
    out.push({ id: b.id, score });
  }
  return out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}

// how long a bot holds the target it has before it may switch
const keepFor = (system, e) => (e && e.bot === false ? system.shooting.keepFiringAtPlayerTime : system.shooting.keepFiringAtAITime);

export function pickTarget(brain, seen, { system, who = () => null, now = 0, assigned = null }) {
  const scores = scoreTargets(brain, seen, { system, who, current: brain.target ?? null });
  const has = (id) => id != null && scores.some((s) => s.id === id);
  let id = null;
  if (has(brain.target) && now - (brain.targetSince ?? -Infinity) < keepFor(system, who(brain.target))) id = brain.target;
  else id = has(assigned) ? assigned : (scores[0]?.id ?? null);
  if (id !== brain.target) {
    brain.target = id;
    brain.targetSince = now;
  }
  return id;
}

export function coordinate(scores, { system }) {
  const T = system.targeting;
  const out = new Map();
  if (!T.enableTargetCoordinator) {
    for (const [m, list] of scores) if (list[0]) out.set(m, list[0].id);
    return out;
  }
  const cap = Math.max(1, Math.ceil(T.visibleTargetLimit * scores.size - 1e-9));
  const count = new Map();
  // the surest pick first, each taking its best target not yet full
  const order = [...scores].filter(([, l]) => l.length).sort((a, b) => b[1][0].score - a[1][0].score);
  for (const [m, list] of order) {
    const t = list.find((s) => (count.get(s.id) ?? 0) < cap) ?? list[0];
    out.set(m, t.id);
    count.set(t.id, (count.get(t.id) ?? 0) + 1);
  }
  return out;
}
