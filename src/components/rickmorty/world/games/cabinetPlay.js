// What Plumbus Smash's overlay (./Cabinet.jsx) does with a key, and when it
// redraws. Pure, so it's tested in Node.
//
//   keyFor(phase, key, settling) → { smash: chute } | 'pause' | 'play' | 'leave' | 'hold' | null
//   drawn(game) → a string that changes only when what's drawn in React does
//
// Esc pauses a run and leaves from every card (the pause card too, as Roy's
// does); P pauses and plays on. An end card that has only just come up holds
// every key, so a swing that lands as the game ends neither leaves nor starts
// again.

export const CHUTES = [
  ['ArrowLeft', 'a', 'A'],
  ['ArrowDown', 's', 'S'],
  ['ArrowRight', 'd', 'D'],
];

export function keyFor(phase, key, settling = false) {
  if (settling && (phase === 'won' || phase === 'lost')) return 'hold';
  if (key === 'Escape') return phase === 'play' ? 'pause' : 'leave';
  if (key === 'p' || key === 'P') return phase === 'play' ? 'pause' : phase === 'paused' ? 'play' : null;
  const lane = CHUTES.findIndex((keys) => keys.includes(key));
  return lane >= 0 && phase === 'play' ? { smash: lane } : null;
}

// the score, the lives, the stick and which plumbuses there are; where each
// is down its chute goes straight to its element
export const drawn = (g) => `${g.score}|${g.lives}|${g.stuck > 0 ? 1 : 0}|${g.drops.map((d) => d.id).join(',')}`;
