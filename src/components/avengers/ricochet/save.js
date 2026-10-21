// Ricochet's save, the one reader and writer of tp-hq-ricochet for both views
// (the 3D game and its 2D view): { reached: the rooms open, 1–12, stars: the
// best stars a room }, clamped as the game has always read it.
import { local } from '../../../lib/hooks';
import { ROOMS } from './rules';

export const SAVE = 'tp-hq-ricochet';

export function readSave(raw) {
  const stars = Array.isArray(raw?.stars) ? raw.stars.map((n) => Math.max(0, Math.min(3, Number(n) || 0))) : [];
  return { reached: Math.max(1, Math.min(ROOMS.length, Number(raw?.reached) || 1)), stars };
}

export const loadSave = () => readSave(local.get(SAVE, null));

// a room cleared: its best stars kept, and the next room open
export function withClear(save, index, stars) {
  const next = [...save.stars];
  next[index] = Math.max(next[index] ?? 0, stars);
  return { reached: Math.max(save.reached, Math.min(ROOMS.length, index + 2)), stars: next };
}

export function saveClear(save, index, stars) {
  const next = withClear(save, index, stars);
  local.set(SAVE, next);
  return next;
}

// the last room gives up the Mind Stone, and Cap's achievement
export const clearReward = (index) => (index === ROOMS.length - 1 ? { stone: 'mind', achievement: 'captain' } : null);
