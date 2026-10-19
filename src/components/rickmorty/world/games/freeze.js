// The freeze kind (the spec's "play dead: hold still while the buyers look,
// move when they turn"): the vat of acid's game. From Morty's first step the
// buyers turn by turns: their backs to him (move), a turn (stop), a look
// (keep still), and their backs again. Moving while they look is a catch;
// jumping into the vat while their backs are turned takes him in, and
// jumping in at any other time is a catch. In the vat he plays dead while
// they peer in: a moment to settle, then any move is a catch; the whole
// hold still and it's won. Pure and import-free, stepped by the place's
// stage (../dimensions/stage.js) inside its own update, with Morty's own
// motion from the render state; tested in Node.
//
//   newFreeze({ perks }) → game
//   stepFreeze(game, { moving, jumped }, dt) → game
//     events: start | in | won | lost { why: 'moved' | 'jumped' }
//   moving(morty) → whether he's moving (his speed, or off the ground)
//   takesJump(game) → whether a jump now would take him in (their backs turned)
//   freezeEyes(game) → null | 'away' | 'look' | 'seen'   for the buyers' figures
//   freezeNews(game, { done, fading }) → 'done' | 'caught' | null   what the place says
//   freezeReadout(snapshot) → { on, vitals, line }   for the HUD's meter
//
// `perks` (the shop's, P13) are taken and, until the shop decides what they
// do here, none is read.

export const TUNING = Object.freeze({
  still: 0.4, // m/s: slower than this is keeping still
  turn: 1.2, // seconds they take to turn round
  away: [1, 2, 1.4, 2.4], // seconds their backs are turned, by turns
  look: [2.4, 3, 2, 2.6], // seconds they look, by turns
  hold: 3, // seconds of playing dead in the vat
  settle: 0.6, // seconds to settle in the vat before a move counts
});

const LINES = {
  away: 'Their backs are turned: move',
  turn: 'They’re turning round: stop',
  look: 'They’re looking: keep still',
  in: 'In the vat: play dead',
};

export const moving = (m) => Boolean(m) && ((m.speed ?? 0) > TUNING.still || Boolean(m.air));

export const takesJump = (g) => g?.phase === 'run' && g.eyes === 'away';

// (the options may carry `perks`; none is read yet)
export function newFreeze() {
  return { phase: 'idle', eyes: null, beat: 0, left: 0, len: 0, told: false, events: [] };
}

const eyesFor = (g, eyes, len) => Object.assign(g, { eyes, left: len, len });

export function stepFreeze(prev, input = {}, dt = 1 / 60) {
  if (prev.phase === 'won' || prev.phase === 'lost') return { ...prev, events: [] };
  const g = { ...prev, events: [] };
  const step = Math.min(dt, 0.1);
  const lose = (why) => {
    g.phase = 'lost';
    g.events.push({ type: 'lost', why });
    return g;
  };
  // the vat: in behind their backs, else a catch (in already, nothing)
  if (input.jumped && g.phase !== 'in') {
    if (!takesJump(g)) return lose('jumped');
    g.phase = 'in';
    eyesFor(g, 'in', TUNING.hold);
    g.events.push({ type: 'in' });
    return g;
  }
  if (g.phase === 'idle') {
    if (!input.moving) return g;
    g.phase = 'run';
    eyesFor(g, 'away', TUNING.away[0]);
    g.events.push({ type: 'start' });
    return g;
  }
  if (g.phase === 'in') {
    if (input.moving && g.len - g.left >= TUNING.settle) return lose('moved');
    g.left -= step;
    if (g.left <= 0) {
      g.phase = 'won';
      g.events.push({ type: 'won' });
    }
    return g;
  }
  if (input.moving && g.eyes === 'look') return lose('moved');
  g.left -= step;
  if (g.left > 0) return g;
  if (g.eyes === 'away') eyesFor(g, 'turn', TUNING.turn);
  else if (g.eyes === 'turn') eyesFor(g, 'look', TUNING.look[g.beat % TUNING.look.length]);
  else {
    g.beat += 1;
    eyesFor(g, 'away', TUNING.away[g.beat % TUNING.away.length]);
  }
  return g;
}

export function freezeEyes(g) {
  if (!g || g.phase === 'idle' || g.phase === 'won') return null;
  if (g.phase === 'lost') return 'seen';
  return g.eyes === 'away' ? 'away' : 'look';
}

// won: say so every frame till the task's kept (a frame in a fade is lost);
// lost: once, and not while Morty's fading
export function freezeNews(g, { done, fading }) {
  if (g.phase === 'won') return done ? null : 'done';
  if (g.phase === 'lost' && !fading && !g.told) return 'caught';
  return null;
}

export function freezeReadout(g) {
  if (!g || (g.phase !== 'run' && g.phase !== 'in')) return { on: false, vitals: null, line: '' };
  return { on: true, vitals: { value: Math.round((g.left / g.len) * 100), max: 100, low: g.eyes !== 'away' }, line: LINES[g.eyes] };
}
