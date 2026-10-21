// Coming back to the compound (spec 2026-10-18-avengers-hq-fix-and-hub-
// design, §5): a welcome naming the next building when a game won a stone,
// and the loading veil on the way back, up until the compound draws again.
import { placeById, progress } from './rules';

// the stones (or halves) earned between two reads of the heist
export const gained = (before, after) => after.filter((s) => !before.includes(s));

// What the toast says on the way back: only with a new stone, the next
// building's name, or the portal once every stone is back.
export function welcomeFor(before, after) {
  if (!gained(before, after).length) return null;
  const p = progress(after);
  if (!p.next) return 'Every stone is back: walk under the portal over the helipad';
  return `Next: ${placeById(p.next).name}`;
}

// The veil over the compound: shown while it loads and, on a way back, until
// its first draw. A compound never drawn (a cold link closed) is flying in,
// with its preparation's real progress.
export function returnVeil({ gl, back, prep }) {
  if (back && gl === 'on') return { shown: true, progress: 1, step: 'first draw', title: 'Back to the compound' };
  return { shown: gl === 'loading', progress: prep.value, step: prep.step, title: 'Flying in to the compound' };
}
