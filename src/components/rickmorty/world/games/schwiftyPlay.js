// What Get Schwifty's show (./Schwifty.jsx) does with a key, and when it
// redraws. Pure, so it's tested in Node.
//
//   keyFor(phase, key, settling) → { hit: lane } | 'pause' | 'play' | 'leave' | 'hold' | null
//   drawn(game) → a string that changes only when what's drawn in React does
//
// Esc pauses the song and leaves from every card (the pause card too, as the
// cabinet's does); P pauses and plays on. An end card that has only just come
// up holds every key, so a press that lands as the song ends neither leaves
// nor starts it again.

import { inView } from './rhythm';

// the lanes, left to right: the arrows, or D F J K under the fingers
export const LANE_KEYS = [
  ['ArrowLeft', 'd', 'D'],
  ['ArrowDown', 'f', 'F'],
  ['ArrowUp', 'j', 'J'],
  ['ArrowRight', 'k', 'K'],
];

export function keyFor(phase, key, settling = false) {
  if (settling && (phase === 'won' || phase === 'lost')) return 'hold';
  if (key === 'Escape') return phase === 'play' ? 'pause' : 'leave';
  if (key === 'p' || key === 'P') return phase === 'play' ? 'pause' : phase === 'paused' ? 'play' : null;
  const lane = LANE_KEYS.findIndex((keys) => keys.includes(key));
  return lane >= 0 && phase === 'play' ? { hit: lane } : null;
}

// which notes are coming down, and the hits and misses; where each is down
// its lane, and the heads' meter, go straight to their elements
export const drawn = (g) => `${g.phase}|${g.hits}|${g.misses}|${inView(g).map((n) => n.id).join(',')}`;
