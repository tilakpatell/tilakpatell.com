// What Get Schwifty's show (./Schwifty.jsx) does with a key, and when it
// redraws. Pure, so it's tested in Node.
//
//   keyFor(phase, key, settling, repeat) → { hit: lane } | 'pause' | 'play' | 'leave' | 'hold' | null
//   padEdges(pad, was) → the controller's buttons pressed since the last frame
//   padFor(phase, pressed, settling) → 'start' | 'pause' | 'play' | 'again' | 'leave' | 'hold' | null
//   padLanes(pressed) → the lanes the d-pad hit
//   drawn(game) → a string that changes only when what's drawn in React does
//
// Esc pauses the song and leaves from every card (the pause card too, as the
// cabinet's does); P pauses and plays on. A key held down does nothing again
// (a held Esc would pause and then leave). An end card that has only just
// come up holds every key, so a press that lands as the song ends neither
// leaves nor starts it again. On a controller A starts, plays on and goes
// again, B leaves from every card, Start pauses and plays on, and the d-pad's
// four hit the lanes; a button already down as the show opens (the A that
// opened it) is no press.

import { inView } from './rhythm';

// the lanes, left to right: the arrows, or D F J K under the fingers
export const LANE_KEYS = [
  ['ArrowLeft', 'd', 'D'],
  ['ArrowDown', 'f', 'F'],
  ['ArrowUp', 'j', 'J'],
  ['ArrowRight', 'k', 'K'],
];

export function keyFor(phase, key, settling = false, repeat = false) {
  const act = actOf(phase, key, settling);
  return act != null && repeat ? 'hold' : act;
}
function actOf(phase, key, settling) {
  if (settling && (phase === 'won' || phase === 'lost')) return 'hold';
  if (key === 'Escape') return phase === 'play' ? 'pause' : 'leave';
  if (key === 'p' || key === 'P') return phase === 'play' ? 'pause' : phase === 'paused' ? 'play' : null;
  const lane = LANE_KEYS.findIndex((keys) => keys.includes(key));
  return lane >= 0 && phase === 'play' ? { hit: lane } : null;
}

// the d-pad's four, left to right, as the lanes
export const PAD_LANES = ['left', 'down', 'up', 'right'];

// (`was` null: the first frame the show is up, when nothing's a press)
export function padEdges(pad, was) {
  if (!pad || was == null) return {};
  return Object.fromEntries(Object.entries(pad).filter(([k, v]) => v === true && !was[k]));
}

export function padFor(phase, pressed, settling = false) {
  if (phase === 'won' || phase === 'lost') {
    if (settling) return 'hold';
    return pressed.a ? 'again' : pressed.b ? 'leave' : null;
  }
  if (phase === 'intro') return pressed.a ? 'start' : pressed.b ? 'leave' : null;
  if (phase === 'paused') return pressed.start || pressed.a ? 'play' : pressed.b ? 'leave' : null;
  return pressed.start ? 'pause' : null;
}

export const padLanes = (pressed) => PAD_LANES.flatMap((k, lane) => (pressed[k] ? [lane] : []));

// which notes are coming down, and the hits and misses; where each is down
// its lane, and the heads' meter, go straight to their elements
export const drawn = (g) => `${g.phase}|${g.hits}|${g.misses}|${inView(g).map((n) => n.id).join(',')}`;
