// The find kind (the spec's "find your Jerry among the Jerrys by what only
// he'd do; a wrong pick costs time"): the Jerryboree's game. One of the
// candidates is ours. A candidate's first use talks to him (and the HUD
// says what he does: ours does what only ours would); his second takes him.
// Ours taken and it's won; another costs `cost` seconds of the clock, which
// runs from the first talk; out of time and it's lost, as caught is. A
// wrong one used again costs nothing more. Pure and import-free, stepped by
// the place's stage (../dimensions/stage.js) inside its own update, its
// presses at no time and then the clock; tested in Node.
//
//   newFind({ items, ours, s, cost, perks }) → game
//   stepFind(game, { use }, dt) → game   use: a candidate's id, or null
//     events: start | talk { id } | wrong { id } | won { id } | lost { why: 'time' }
//   pickOurs(items, rand) → ours, drawn by rand
//   findNews(game, { done, fading }) → 'done' | 'caught' | null   what the place says
//   findReadout(snapshot, tells, words) → { on, vitals, line }   for the HUD's meter
//
// `perks` (the shop's, P13) are taken and, until the shop decides what they
// do here, none is read.

export const TUNING = Object.freeze({
  s: 45, // seconds on the clock, from the first talk
  cost: 15, // seconds a wrong one taken costs
  low: 0.25, // the meter's warning, as a share of the clock
});

// what the HUD's line says after a talk (`tell`: what he does), a wrong
// pick, and a wrong one used again (a place's own tells come with it)
export const WORDS = Object.freeze({
  heard: (tell) => `${tell}: once more to take him`,
  wrong: 'Not ours: that cost you time',
  again: 'Not ours: leave him be',
  ours: 'He does what only ours would',
  other: 'He does what any of them would',
});

// (the options may carry `perks`; none is read yet)
export function newFind({ items, ours, s = TUNING.s, cost = TUNING.cost } = {}) {
  return { phase: 'idle', items, ours, left: s, len: s, cost, heard: [], wrong: [], last: null, lastId: null, told: false, events: [] };
}

export function stepFind(prev, { use = null } = {}, dt = 1 / 60) {
  if (prev.phase === 'won' || prev.phase === 'lost') return { ...prev, events: [] };
  const g = { ...prev, events: [] };
  if (g.items.includes(use)) {
    if (g.phase === 'idle') {
      g.phase = 'run';
      g.events.push({ type: 'start' });
    }
    if (g.wrong.includes(use)) g.last = 'again';
    else if (!g.heard.includes(use)) {
      Object.assign(g, { heard: [...g.heard, use], last: 'heard', lastId: use });
      g.events.push({ type: 'talk', id: use });
    } else if (use === g.ours) {
      g.phase = 'won';
      g.events.push({ type: 'won', id: use });
      return g;
    } else {
      Object.assign(g, { wrong: [...g.wrong, use], left: Math.max(0, g.left - g.cost), last: 'wrong' });
      g.events.push({ type: 'wrong', id: use });
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

export const pickOurs = (items, rand) => items[Math.min(items.length - 1, Math.floor(rand() * items.length))];

// won: say so every frame till the task's kept (a frame in a fade is lost);
// lost: once, and not while Morty's fading
export function findNews(g, { done, fading }) {
  if (g.phase === 'won') return done ? null : 'done';
  if (g.phase === 'lost' && !fading && !g.told) return 'caught';
  return null;
}

export function findReadout(g, tells = {}, words = WORDS) {
  if (!g || g.phase !== 'run') return { on: false, vitals: null, line: '' };
  const share = g.left / g.len;
  const line = g.last === 'heard' ? words.heard(g.lastId === g.ours ? (tells.ours ?? words.ours) : (tells[g.lastId] ?? words.other)) : (words[g.last] ?? '');
  return { on: true, vitals: { value: Math.round(share * 100), max: 100, low: share < TUNING.low }, line };
}
