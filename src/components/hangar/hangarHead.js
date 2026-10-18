// The Hangar's head (HangarPanel.jsx): the level and its title, how far to
// the next, the credits. Pure, tested.
//
//   headOf(record) → { level, title, xp, toNext (0–1), credits, legend }

import { LEVELS, TITLES } from '../universe/shared/wallet';

// (Legend's ranks past the last level are the skills' to say: pull request 4)
export function headOf(record) {
  const xp = Number.isFinite(record?.xp) ? record.xp : 0;
  const level = Number.isInteger(record?.level) && record.level >= 1 ? record.level : 1;
  const toNext = level >= LEVELS.length ? 1 : Math.max(0, Math.min(1, (xp - LEVELS[level - 1]) / (LEVELS[level] - LEVELS[level - 1])));
  return { level, title: record?.title ?? TITLES[level - 1], xp, toNext, credits: Number.isFinite(record?.credits) ? record.credits : 0, legend: null };
}
