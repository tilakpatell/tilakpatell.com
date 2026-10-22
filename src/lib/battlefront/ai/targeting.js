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
// truth, so a target the senses have not met is never picked.
//
// Which it takes is the game's AI code's rule (`Reason/TargetSelection.cpp`,
// `selectTargets`; NOTES.md, "The bots' minds against the AI source"): an enemy
// seen within `VisibleTargetLimit` seconds (1 in multiplayer, a third in PvE:
// `Shared/AISystem.ddf`'s `SquadTargettingData`) counts as seen, scaled so and
// tried first, the best of them by the scores; the target it has is kept while
// it is one of them and none scores higher (the current target's scale standing
// for the source's 2 m of slack), and kept while no enemy is seen at all; with
// no target, one seen longer ago, and failing that one only heard or told of.
// (It replaced a hold of `KeepFiringAtPlayerTime` 4 s or `…AtAITime` 2 s
// before any switch: those are how long a bot standing still fires on at a
// target out of sight, `tactics.js`'s `keepFiring`.) The squad's target
// coordinator (`EnableTargetCoordinator`, the records' later field) hands each
// member its own best: `VisibleTargetLimit` is seconds, not the share of a
// squad it was read as, and the records hold no share.
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

// whether a belief counts as seen: in sight now, or seen within the visible limit, on the senses' own clock
// (`perception.js`'s `me.now`; a brain with none counts what is in sight now alone)
export const seenWithin = (brain, b, limit) => !!b?.visible || (brain.me?.now != null && brain.me.now - (b?.seenAt ?? -Infinity) <= limit);

export function scoreTargets(brain, seen, { system, who = () => null, current = null }) {
  const T = system.targeting;
  const me = brain.s.at;
  const out = [];
  for (const b of seen) {
    if (!b || b.hostile === false || !(b.confidence > 0)) continue;
    const e = who(b.id);
    if (e && e.alive === false) continue;
    let d = Math.hypot(b.at.x - me[0], b.at.z - me[2]);
    if (seenWithin(brain, b, T.visibleTargetLimit ?? 0)) d *= T.targetVisibleDistScale;
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

export function pickTarget(brain, seen, { system, who = () => null, now = 0, assigned = null }) {
  const scores = scoreTargets(brain, seen, { system, who, current: brain.target ?? null });
  const by = new Map(seen.map((b) => [b.id, b]));
  const limit = system.targeting?.visibleTargetLimit ?? 0;
  const visible = scores.filter((s) => seenWithin(brain, by.get(s.id), limit));
  const current = scores.find((s) => s.id === brain.target) ?? null;
  // (the coordinator's word, where it names one of those seen)
  const given = visible.find((s) => s.id === assigned) ?? null;
  const once = scores.find((s) => Number.isFinite(by.get(s.id)?.seenAt)) ?? null;
  const id = (given ?? visible[0] ?? current ?? once ?? scores[0])?.id ?? null;
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
  // (the records hold no share of a squad for it: every member may take the same target)
  const cap = scores.size;
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
