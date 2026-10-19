// The heist so far: which doors are done, what's next, and the objective.

import { PLACES } from './plan';

// ── the heist so far ──

const WHOLE = ['space', 'mind', 'reality', 'power', 'time', 'soul'];

// From the stones earned (as hq/stones keeps them, halves of Soul included):
// each place done or not, the next one to go to, which stones are back,
// whether the portal is open, and the line at the top of the screen.
export function progress(earned = []) {
  const has = new Set(earned);
  const places = PLACES.map((p) => ({ ...p, done: p.stone ? has.has(p.stone) : false }));
  // (the gate has no stone: it's never the next one for the heist)
  const next = places.find((p) => p.stone && !p.done) ?? null;
  const have = WHOLE.filter((s) => has.has(s));
  const stones = have.length;
  const portal = has.has('space');
  const finished = !next;
  const objective = finished
    ? 'Every stone is back. The portal is open over the helipad: walk under it, and Thanos is on the other side.'
    : portal
      ? `The portal is open over the helipad. ${stones} of 6 stones: ${next.hint}`
      : next.hint;
  return { places, next: next?.id ?? null, have, stones, portal, finished, objective, done: places.filter((p) => p.done).map((p) => p.id) };
}
