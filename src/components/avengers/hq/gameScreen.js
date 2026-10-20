// The game screen's rules (spec 2026-10-18-avengers-hq-fix-and-hub-design,
// §5): each game's own 3D choice, what its switch says, its touch help, the
// way on and the score on the results card. No React, and no storage of its
// own: the caller passes a store, or the browser's is taken when there is one.

// the useStage ids, which the best keys tp-hq-<id>-best already use
export const GAMES = ['repulsor', 'lawn', 'ricochet', 'trickshot', 'widow', 'smash', 'thwip', 'tesseract'];

// the game behind each door, in the compound's order (rules.js PLACES)
export const GAME_AT = { stark: 'repulsor', thor: 'lawn', cap: 'ricochet', hawkeye: 'trickshot', widow: 'widow', banner: 'smash', spidey: 'thwip', vault: 'tesseract' };

// ── a game's own 3D: JSON "on" or "off" in its key, no key for auto ──

export const local3DKey = (game) => `tp-hq-3d-${game}`;

const browserStore = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function readLocal3D(game, store = browserStore()) {
  try {
    const v = JSON.parse(store?.getItem(local3DKey(game)) ?? 'null');
    return v === 'on' || v === 'off' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeLocal3D(game, mode, store = browserStore()) {
  try {
    if (mode === 'on' || mode === 'off') store?.setItem(local3DKey(game), JSON.stringify(mode));
    else store?.removeItem(local3DKey(game));
  } catch {
    // a private window or a full store: the choice lasts for this visit only
  }
}

// The game's own choice first; the site's 3D only on auto.
export const resolveLocal3D = (local, { on, can, held }) => (local === 'auto' ? Boolean(on) : local === 'on' && Boolean(can) && !held);

// ── the switch in the bar, or the note under it ──

// HQFrame.jsx's lines for a 3D that stopped, verbatim
const STOPPED = {
  failed: '3D couldn’t start here, so here is the simple version.',
  slow: 'This device was struggling with 3D, so here is the simple version.',
  lost: 'The graphics chip reset, so here is the simple version.',
};

export function switchFor({ can, on, status, flat = false, stone = true }) {
  const why = stone ? 'The stone here is won in the 3D game.' : 'This game is played in 3D.';
  if (!can) return { bar: null, note: flat ? null : { text: why, action: null } };
  if (!on) return flat ? { bar: { label: 'Play in 3D', next: 'on' }, note: null } : { bar: null, note: { text: why, action: { label: 'Try 3D', next: 'on' } } };
  if (STOPPED[status]) return { bar: null, note: { text: STOPPED[status], action: { label: 'Try 3D again', next: 'retry' } } };
  return { bar: flat ? { label: 'Play in 2D', next: 'off' } : { label: '3D game: on', pressed: true, next: 'off' }, note: null };
}

// ── touch help: a few rows a game, each an icon and a line ──

export const TOUCH_ICONS = ['tap', 'hold', 'drag', 'swipe', 'button'];

export const TOUCH_HELP = {
  repulsor: [
    { icon: 'hold', text: 'Touch and hold to aim and fire' },
    { icon: 'button', text: 'The arrows strafe; Beam fires the unibeam once it’s charged' },
  ],
  lawn: [
    { icon: 'drag', text: 'To lift the hammer, hold and slide to keep the needle in the green' },
    { icon: 'tap', text: 'Tap to throw the hammer, and again to call it back' },
    { icon: 'button', text: 'The arrows walk; the bolt brings down lightning' },
  ],
  ricochet: [
    { icon: 'drag', text: 'Drag to aim the shield' },
    { icon: 'button', text: 'Throw throws it; ↺ starts the room again' },
  ],
  trickshot: [
    { icon: 'hold', text: 'Press to draw, drag to aim, lift to loose' },
    { icon: 'button', text: 'Full or Half sets the draw; Trick nocks a trick arrow' },
  ],
  widow: [
    { icon: 'tap', text: 'Tap a tile to step towards it, or a guard to bite him' },
    { icon: 'button', text: 'Or use the pad: the middle button waits a turn' },
  ],
  smash: [
    { icon: 'swipe', text: 'Swipe sideways to change lanes, and up to leap' },
    { icon: 'tap', text: 'Tap to smash' },
  ],
  thwip: [
    { icon: 'hold', text: 'Hold anywhere to swing, and let go to fly' },
    { icon: 'drag', text: 'Hold on the left or right of the screen to steer' },
  ],
  tesseract: [
    { icon: 'button', text: 'Hold Thrust, and the lean buttons' },
    { icon: 'hold', text: 'Or hold a finger on the view: the jet leans towards it' },
  ],
};

// ── the way on, the score and the stone ──

// The next stone not yet won, never the building just played (so a loss there
// never points back at it) and never the gate, which has no stone.
export function nextFor(prog, here, linkOf) {
  const p = prog?.places?.find((q) => q.stone && !q.done && q.id !== here);
  const to = p ? linkOf(p.id) : null;
  return to ? { id: p.id, label: p.name, to } : null;
}

export const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function scoreLine({ score, best = 0, newBest = false, format = fmt }) {
  if (score == null) return null;
  return { big: format(score), small: newBest ? 'a new best' : best > 0 ? `best ${format(best)}` : 'points' };
}

export const stoneWords = (name, half = null) => (half ? `${half} half of the ${name} is yours.` : `The ${name} is yours.`);

// A game starts only on a stage that has drawn (the runtime reports 'on'
// only after its first frame), so a run never begins on a dark screen.
export const startable = (status) => status === 'on';

// Pause a game when its tab is hidden; the call returned stops listening.
export function watchHidden(doc, onHide) {
  if (!doc?.addEventListener) return () => {};
  const on = () => {
    if (doc.hidden) onHide();
  };
  doc.addEventListener('visibilitychange', on);
  return () => doc.removeEventListener('visibilitychange', on);
}
