// The deeds: what the visitor does on the Road, not only watches. A beat
// may carry one (stages/<id>/beats.js's `deed`): the ride comes to its mark
// and waits there, the beat not yet begun, until the visitor does it (a
// press, a hold, a rhythm of two keys, a word chosen); then the beat plays
// as it was written. Letting the road walk itself, the company does it for
// you after `wait` seconds. Under reduced motion every deed is one press.
// Pure.
//
//   DEED: { verb: 'press' | 'hold' | 'rhythm' | 'choose', label, seconds? (hold),
//           beats? (rhythm), choices? [{ label, right?, line? }], wait? }
//   newDeed() → { progress (0…1), done, by ('you' | 'company' | null), waited, wrong (a choice's index) | null, last ('left' | 'right' | null), idle (s since a stroke) }
//   stepDeed(state, deed, input, { dt, auto, reduced }) → state
//     input: { act (pressed this frame), acting (held), left, right (pressed
//     this frame), pick (a choice's index, or null) }
//   verbOf(deed, reduced) → the verb it is played with
//   keysOf(deed, reduced) → what the prompt says to press ('E', 'Hold E', 'A D', '1 2 3')
//   gate(beats, deeds) → the marks (metres into the stage) of the beats
//     whose deed is undone (deeds: { beatId: state }): where the walk stops

export const VERBS = ['press', 'hold', 'rhythm', 'choose'];
export const WAIT = 10; // s the company waits for you, letting the road walk (fifty-one deeds: at 20 s, a quarter of an hour of waiting)
export const HOLD = 3; // s a hold takes, unless it says
export const BEATS = 10; // strokes a rhythm takes, unless it says
export const FADE = 0.35; // of a hold's progress lost a second, let go (a rhythm's, half that, once it stops)
export const LULL = 0.6; // s without a stroke before a rhythm starts to slip

export const newDeed = () => ({ progress: 0, done: false, by: null, waited: 0, wrong: null, last: null, idle: 0 });

export const verbOf = (deed, reduced = false) => (reduced && (deed.verb === 'hold' || deed.verb === 'rhythm') ? 'press' : deed.verb);

export function keysOf(deed, reduced = false) {
  const verb = verbOf(deed, reduced);
  if (verb === 'hold') return 'Hold E';
  if (verb === 'rhythm') return 'A D';
  if (verb === 'choose') return deed.choices.map((_, i) => String(i + 1)).join(' ');
  return 'E';
}

const finish = (state, by) => ({ ...state, progress: 1, done: true, by });

export function stepDeed(state, deed, input, { dt = 0, auto = false, reduced = false } = {}) {
  if (state.done) return state;
  const waited = state.waited + dt;
  const next = { ...state, waited };
  const verb = verbOf(deed, reduced);
  if (verb === 'press' && input.act) return finish(next, 'you');
  if (verb === 'hold') {
    const progress = input.acting ? state.progress + dt / (deed.seconds ?? HOLD) : Math.max(0, state.progress - FADE * dt);
    if (progress >= 1) return finish(next, 'you');
    next.progress = progress;
  }
  if (verb === 'rhythm') {
    // (the two keys in turn: the same one twice is no stroke; E counts as whichever is due)
    const due = state.last === 'left' ? 'right' : 'left';
    const stroke = input[due] || (input.act && !input.left && !input.right);
    let progress = state.progress;
    next.idle = stroke ? 0 : state.idle + dt;
    if (stroke) {
      progress += 1 / (deed.beats ?? BEATS);
      next.last = due;
    } else if (next.idle > LULL) progress = Math.max(0, progress - FADE * 0.5 * dt);
    if (progress >= 1 - 1e-9) return finish(next, 'you');
    next.progress = progress;
  }
  if (verb === 'choose' && input.pick != null && deed.choices[input.pick]) {
    if (deed.choices[input.pick].right) return finish({ ...next, wrong: null }, 'you');
    next.wrong = input.pick;
  }
  // (letting the road walk: the company does it, once you've had your time)
  if (auto && waited >= (deed.wait ?? WAIT)) return finish(next, 'company');
  return next;
}

export function gate(beats, deeds) {
  return beats.filter((b) => b.deed && !deeds[b.id]?.done).map((b) => b.at);
}
