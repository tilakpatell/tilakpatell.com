// The snap's gate on the Avengers page (spec 2026-10-18-avengers-hq-fix-and-
// hub-design, §7): it opens only with all six stones won in play. Locked, it
// says how many are left and which building is next. Pure.
import { PLACES, placeById, progress } from '../world/rules';
import { linkOf } from '../world/links';

export function snapGate(earned = []) {
  const p = progress(earned);
  const left = 6 - p.stones;
  const ready = left === 0;
  // (ready means no Next, whatever progress says: a whole Soul Stone without its halves leaves it at the range)
  const at = !ready && p.next ? placeById(p.next) : null;
  return {
    ready,
    left,
    label: ready ? null : `${left} ${left === 1 ? 'stone' : 'stones'} left`,
    next: at ? { id: at.id, name: at.name, to: linkOf(at.id) } : null,
  };
}

// the seven buildings with a stone, in the tour's order: the summary's rows
export const HEIST_ROWS = PLACES.filter((p) => p.stone).map((p) => ({ id: p.id, name: p.name }));
