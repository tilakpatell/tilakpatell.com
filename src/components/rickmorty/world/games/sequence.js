// The sequence kind (the spec's "spots in order, against a clock"): the
// cable studio's game, and later Gear World's cogs. A running order of the
// place's sets is dealt; each set used in its turn is switched on, and the
// last one on is the win. A wrong set turns every set dark again, back to
// the first, while the clock runs on; one already on, used again, costs
// nothing. The clock runs from the place's start spot (the control booth's
// countdown), or from the first set used where there's none; out of time and
// it's lost, as caught is. Pure and import-free, stepped by the place's stage
// (../dimensions/stage.js) inside its own update, its presses at no time and
// then the clock; tested in Node.
//
//   newSequence({ items, order, s, start, perks }) → game
//   stepSequence(game, { use, start }, dt) → game   use: a set's id, or null; start: the start spot pressed
//     events: start | early { id } (a set used before the countdown) | on { id } | dark { id } | won | lost { why: 'time' }
//   runningOrder(items, n, rand) → n of the sets, in a running order drawn by rand
//   sequenceNews(game, { done, fading }) → 'done' | 'caught' | null   what the place says
//   sequenceReadout(snapshot, labels, words) → { on, vitals, line }   for the HUD's meter
//   litSets(game, done) → the sets whose lights are on
//
// `perks` (the shop's, P13) are taken and, until the shop decides what they
// do here, none is read.

export const TUNING = Object.freeze({
  s: 45, // seconds on the clock, from the countdown
  need: 5, // sets in a running order
  low: 0.25, // the meter's warning, as a share of the clock
});

// what the HUD's line says: the next set, with how many are on; after a
// wrong one, the first again; after one already on, the next (a set's label)
export const WORDS = Object.freeze({
  next: (label, on, n) => `${on} of ${n} on air: next, ${label}`,
  dark: (label) => `Wrong set, and they’ve all gone dark: start again with ${label}`,
  again: (label) => `That one’s on already: next, ${label}`,
});

// (the options may carry `perks`; none is read yet)
export function newSequence({ items, order, s = TUNING.s, start = false } = {}) {
  return { phase: 'idle', items, order, on: 0, start, left: s, len: s, last: null, told: false, events: [] };
}

export function stepSequence(prev, { use = null, start = false } = {}, dt = 1 / 60) {
  if (prev.phase === 'won' || prev.phase === 'lost') return { ...prev, events: [] };
  const g = { ...prev, events: [] };
  if (start && g.start && g.phase === 'idle') {
    g.phase = 'run';
    g.events.push({ type: 'start' });
  }
  // (a set before the countdown's started does nothing but say so; with no start spot, the first set starts it)
  if (g.items.includes(use) && g.phase === 'idle' && g.start) g.events.push({ type: 'early', id: use });
  else if (g.items.includes(use)) {
    if (g.phase === 'idle') {
      g.phase = 'run';
      g.events.push({ type: 'start' });
    }
    if (use === g.order[g.on]) {
      g.on += 1;
      g.last = 'on';
      g.events.push({ type: 'on', id: use });
      if (g.on === g.order.length) {
        g.phase = 'won';
        g.events.push({ type: 'won' });
        return g;
      }
    } else if (g.order.slice(0, g.on).includes(use)) g.last = 'again';
    else {
      Object.assign(g, { on: 0, last: 'dark' });
      g.events.push({ type: 'dark', id: use });
    }
  }
  if (g.phase !== 'run') return g;
  g.left = Math.max(0, g.left - Math.min(dt, 0.1));
  if (g.left <= 0) {
    g.phase = 'lost';
    g.events.push({ type: 'lost', why: 'time' });
  }
  return g;
}

// a shuffle of the sets by `rand` (Fisher and Yates'), its first n; the sets as they were
export function runningOrder(items, n, rand) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rand() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// won: say so every frame till the task's kept (a frame in a fade is lost);
// lost: once, and not while Morty's fading
export function sequenceNews(g, { done, fading }) {
  if (g.phase === 'won') return done ? null : 'done';
  if (g.phase === 'lost' && !fading && !g.told) return 'caught';
  return null;
}

// (on while it runs; and, with no start spot, from the first, naming the first to go)
export function sequenceReadout(g, labels = {}, words = WORDS) {
  if (!g || !(g.phase === 'run' || (g.phase === 'idle' && !g.start))) return { on: false, vitals: null, line: '' };
  const share = g.left / g.len;
  const name = (id) => labels[id] ?? id;
  const line = g.last === 'dark' ? words.dark(name(g.order[0])) : g.last === 'again' ? words.again(name(g.order[g.on])) : words.next(name(g.order[g.on]), g.on, g.order.length);
  return { on: true, vitals: { value: Math.round(share * 100), max: 100, low: share < TUNING.low }, line };
}

export const litSets = (g, done) => (done ? [...g.items] : g.order.slice(0, g.on));
