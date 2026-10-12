// The bots' damage buckets (bf2-re finding 34 §3:
// `BucketDamageAiVsHuman.EvasiveBucketTimeSettings` on the difficulty's
// targeting row, `TimeUntilDamageFromStartOfFirstBurst`): a bot that has
// just begun firing at a human waits in the bucket the target's movement
// puts it in before its bolts may hurt — 0.75 s for a sprinter, 0.5 s for
// one on the move, 0.25 s crouched, 0.1 s still — the grace that makes the
// first burst miss; `BucketDamageAiVsAi 0`: nothing between bots. The
// four buckets are read as sprint / moving / crouch / still, in that
// order. Pure.
//
//   BUCKETS                                   the four waits, seconds
//   createBuckets() → b                        (who has fired at whom since when)
//   bucketOf(target) → seconds                 (the target's wait by its movement)
//   mayHurt(b, { shooter, target, shotAt, now }) → bool   (the shooter a bot, the target a human; shotAt: when the bolt left)
//   forget(b, shooterId)                       (the shooter's bursts start again)

export const BUCKETS = { sprint: 0.75, moving: 0.5, crouch: 0.25, still: 0.1 };
// A burst that stops this long starts a new wait, by hand (the game's is the burst's own end).
export const BURST_GAP = 1;

export const createBuckets = () => ({ since: new Map() });

export function bucketOf(target) {
  if (target.sprint && target.moving) return BUCKETS.sprint;
  if (target.moving) return BUCKETS.moving;
  if (target.stance === 'crouch') return BUCKETS.crouch;
  return BUCKETS.still;
}

export function mayHurt(b, { shooter, target, now, shotAt = now }) {
  if (!shooter?.bot || target?.bot !== false) return true;
  const key = `${shooter.id}>${target.id}`;
  const was = b.since.get(key);
  if (!was || shotAt - was.last > BURST_GAP) {
    b.since.set(key, { at: shotAt, last: shotAt });
    return now - shotAt >= bucketOf(target) - 1e-9;
  }
  was.last = Math.max(was.last, shotAt);
  return now - was.at >= bucketOf(target) - 1e-9;
}

export function forget(b, shooterId) {
  for (const k of b.since.keys()) if (k.startsWith(`${shooterId}>`)) b.since.delete(k);
}
