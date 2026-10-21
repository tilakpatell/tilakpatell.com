// Infiltration's save, the one reader and writer of tp-hq-widow-level for
// both views (the 3D game and its 2D view): how many levels she has cleared,
// a bare number.
import { local } from '../../../lib/hooks';
import { LEVEL_COUNT } from './rules';

const SAVE = 'tp-hq-widow-level';

export const readCleared = () => Math.max(0, Math.min(LEVEL_COUNT, Number(local.get(SAVE, 0)) || 0));

// A level won: the count goes up only when it's the furthest yet; `fresh` is
// the level whose line of her file was declassified just now, or -1.
export function recordWin(index) {
  const n = index + 1;
  const fresh = n > readCleared() ? index : -1;
  if (fresh >= 0) local.set(SAVE, n);
  return { cleared: readCleared(), fresh };
}
