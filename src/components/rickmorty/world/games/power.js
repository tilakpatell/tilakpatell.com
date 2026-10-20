// The power kind (the spec's "a collect under a draining meter"): the
// Microverse's game. Carry cells from Zeep's console to the gooble boxes,
// one at a time, before the world's charge runs down; the charge drains from
// the first cell taken, so reading the room costs nothing. Pure, stepped by
// the place's stage (../dimensions/stage.js) inside its own update; tested
// in Node.
//
//   newPower({ need, charge, perks }) → game
//   stepPower(game, input, dt) → game   input: { take, give } since the last step
//   powerNews(game, { done, fading }) → 'done' | 'caught' | null   what the place says
//   powerReadout(snapshot) → { on, vitals, line }   for the HUD's meter
//
// `perks` (the shop's, P13) are taken and, until the shop decides what they
// do here, none is read.

export const TUNING = Object.freeze({
  need: 4, // cells to the gooble boxes
  charge: 25, // seconds of the world's charge, from the first cell taken
  low: 0.25, // the meter's warning, as a share of the charge
});

// (the options may carry `perks`; none is read yet)
export function newPower({ need = TUNING.need, charge = TUNING.charge } = {}) {
  return { phase: 'idle', need, delivered: 0, carrying: false, charge, max: charge, told: false, events: [] };
}

export function stepPower(prev, input = {}, dt = 1 / 60) {
  if (prev.phase === 'won' || prev.phase === 'lost') return { ...prev, events: [] };
  const g = { ...prev, events: [] };
  // waiting: nothing drains till the first cell's taken
  if (g.phase === 'idle') {
    if (input.take) {
      g.phase = 'run';
      g.carrying = true;
      g.events.push({ type: 'take' });
    }
    return g;
  }
  if (input.take && !g.carrying) {
    g.carrying = true;
    g.events.push({ type: 'take' });
  } else if (input.give && g.carrying) {
    g.carrying = false;
    g.delivered += 1;
    g.events.push({ type: 'give' });
    if (g.delivered >= g.need) {
      g.phase = 'won';
      g.events.push({ type: 'won' });
      return g;
    }
  }
  g.charge = Math.max(0, g.charge - Math.min(dt, 0.1));
  if (g.charge <= 0) {
    g.phase = 'lost';
    g.events.push({ type: 'lost' });
  }
  return g;
}

// won: say so every frame till the task's kept (a frame in a fade is lost);
// lost: once, and not while Morty's fading
export function powerNews(g, { done, fading }) {
  if (g.phase === 'won') return done ? null : 'done';
  if (g.phase === 'lost' && !fading && !g.told) return 'caught';
  return null;
}

export function powerReadout(g) {
  if (!g || g.phase !== 'run') return { on: false, vitals: null, line: '' };
  const share = g.charge / g.max;
  return { on: true, vitals: { value: Math.round(share * 100), max: 100, low: share < TUNING.low }, line: `Cells ${g.delivered} of ${g.need}${g.carrying ? ', one in hand' : ''}` };
}
