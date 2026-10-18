// The Hangar's head (HangarPanel.jsx): the level and its title, how far to
// the next, the credits, and the skill tree's points free (with the Legend
// rank past the last level). Pure, tested.
//
//   headOf(record, points?) → { level, title, xp, toNext (0–1), credits, legend (a rank, or null), points ({ free, earned, max }, or null) }
//   (`points`: useSkills()'s)

import { LEVELS, TITLES } from '../universe/shared/wallet';

export function headOf(record, points = null) {
  const xp = Number.isFinite(record?.xp) ? record.xp : 0;
  const level = Number.isInteger(record?.level) && record.level >= 1 ? record.level : 1;
  const toNext = level >= LEVELS.length ? 1 : Math.max(0, Math.min(1, (xp - LEVELS[level - 1]) / (LEVELS[level] - LEVELS[level - 1])));
  return { level, title: record?.title ?? TITLES[level - 1], xp, toNext, credits: Number.isFinite(record?.credits) ? record.credits : 0, legend: points?.legend > 0 ? points.legend : null, points: points ? { free: points.free, earned: points.earned, max: points.max } : null };
}
