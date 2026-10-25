// The sewer run on a controller (./Sewer.jsx reads the pad every frame, its
// cards' as well as the run's), on its presses' edges, and never from the
// first frame (the A that opened it is still down then). On the first card A
// rolls and B goes back up the hole; paused, A or Start plays on and B
// leaves; in the run Start pauses, and the d-pad, A (hop) and B or X (fire)
// are the run's own presses; won or lost, A or B goes back up. And the keys'
// Esc and P: Esc pauses the run, plays it on from the pause, and leaves from
// any other card; P pauses and plays on; a held key's repeat does nothing
// (it would flip play and pause, or leave from the card it opened), as the
// show's and the cabinet's.
//
//   sewerPad(now, before, phase) → { phase?, leave?, press? }
//   sewerKey(key, phase, repeat) → { phase?, leave? }, or null for another key

const RUN = (p) => ({ left: p.left, right: p.right, hop: p.a, fire: p.b || p.x });

export function sewerPad(now, before, phase) {
  if (!now || !before) return {};
  const e = (k) => Boolean(now[k] && !before[k]);
  if (phase === 'play') {
    if (e('start')) return { phase: 'paused' };
    const [n, b] = [RUN(now), RUN(before)];
    const press = Object.keys(n).filter((k) => n[k] && !b[k]);
    return press.length ? { press } : {};
  }
  if (phase === 'intro') return e('a') ? { phase: 'play' } : e('b') ? { leave: true } : {};
  if (phase === 'paused') return e('a') || e('start') ? { phase: 'play' } : e('b') ? { leave: true } : {};
  if (phase === 'won' || phase === 'lost') return e('a') || e('b') ? { leave: true } : {};
  return {};
}

export function sewerKey(key, phase, repeat = false) {
  if (key !== 'Escape' && key !== 'p' && key !== 'P') return null;
  if (repeat) return {};
  if (phase === 'play') return { phase: 'paused' };
  if (phase === 'paused') return { phase: 'play' };
  return key === 'Escape' ? { leave: true } : {};
}
