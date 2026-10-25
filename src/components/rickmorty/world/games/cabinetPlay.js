// What Plumbus Smash's overlay (./Cabinet.jsx) does with a key or a
// controller's button, and when it redraws. Pure, so it's tested in Node.
//
//   keyFor(phase, key, settling, repeat) → { smash: chute } | 'pause' | 'play' | 'leave' | 'hold' | null
//   padEdges(pad, was), padFor(phase, pressed, settling) → the show's (./schwiftyPlay.js)
//   padChutes(pressed) → the chutes the d-pad hit
//   drawn(game) → a string that changes only when what's drawn in React does
//
// Esc pauses a run and leaves from every card (the pause card too, as Roy's
// does); P pauses and plays on. A key held down does nothing again (a held
// Esc would pause and then leave). An end card that has only just come up
// holds every key, so a swing that lands as the game ends neither leaves nor
// starts again. On a controller it's the show's: A starts, plays on and goes
// again, B leaves from every card, Start pauses and plays on, and a button
// already down as the cabinet opens (the A that opened it) is no press; the
// d-pad's left, down and right smash the three chutes.

export { padEdges, padFor } from './schwiftyPlay';

export const CHUTES = [
  ['ArrowLeft', 'a', 'A'],
  ['ArrowDown', 's', 'S'],
  ['ArrowRight', 'd', 'D'],
];

export function keyFor(phase, key, settling = false, repeat = false) {
  const act = actOf(phase, key, settling);
  return act != null && repeat ? 'hold' : act;
}
function actOf(phase, key, settling) {
  if (settling && (phase === 'won' || phase === 'lost')) return 'hold';
  if (key === 'Escape') return phase === 'play' ? 'pause' : 'leave';
  if (key === 'p' || key === 'P') return phase === 'play' ? 'pause' : phase === 'paused' ? 'play' : null;
  const lane = CHUTES.findIndex((keys) => keys.includes(key));
  return lane >= 0 && phase === 'play' ? { smash: lane } : null;
}

// the d-pad's three, left to right, as the chutes
export const PAD_CHUTES = ['left', 'down', 'right'];
export const padChutes = (pressed) => PAD_CHUTES.flatMap((k, chute) => (pressed[k] ? [chute] : []));

// the score, the lives, the stick and which plumbuses there are; where each
// is down its chute goes straight to its element
export const drawn = (g) => `${g.score}|${g.lives}|${g.stuck > 0 ? 1 : 0}|${g.drops.map((d) => d.id).join(',')}`;
