// The deal kind (the spec's "choose n of m, each with a hidden flag a look
// reveals"): Needful Things' game, and Pluto's to come (P10, with its own
// words). Each thing for sale carries a curse or none, unseen. A thing's
// first use looks it over, and a look says which (`looks` of them, then
// the rest are a gamble, 'blind'); its second use takes it. Take `need`
// with no curse and it's won; take a cursed one and it's lost, as caught is.
// A thing seen cursed, used again, is left be. Pure and import-free,
// stepped by the place's stage (../dimensions/stage.js) inside its own
// update; tested in Node.
//
//   newDeal({ items, bad, need, looks, perks }) → game
//   stepDeal(game, { use }) → game   use: a thing's id, or null
//     events: look { id, saw: 'good' | 'bad' | 'blind' } | take { id } | won | lost { id }
//   curse(items, n, rand) → n of the things, drawn by rand (never all of them)
//   dealNews(game, { done, fading }) → 'done' | 'caught' | null   what the place says
//   dealReadout(snapshot, words) → { on, vitals, line }   for the HUD's meter
//
// `perks` (the shop's, P13) are taken and, until the shop decides what they
// do here, none is read.

export const TUNING = Object.freeze({
  need: 1, // clean things to take
  looks: 3, // things looked over before the rest are a gamble
});

// what the HUD's line says after a look, or a take (a place may have its own)
export const WORDS = Object.freeze({
  good: 'No curse on that one: once more to take it',
  bad: 'That one’s cursed: leave it be',
  blind: 'No looks left: once more to chance it',
  taken: (n, need) => `Taken ${n} of ${need}`,
});

// (the options may carry `perks`; none is read yet)
export function newDeal({ items, bad = [], need = TUNING.need, looks = TUNING.looks } = {}) {
  return { phase: 'idle', items, bad, need, looks, left: looks, seen: {}, taken: [], last: null, told: false, events: [] };
}

export function stepDeal(prev, { use = null } = {}) {
  const g = { ...prev, events: [] };
  if (g.phase === 'won' || g.phase === 'lost' || !g.items.includes(use) || g.taken.includes(use)) return g;
  const saw = g.seen[use];
  // a first use: a look, while there are looks
  if (!saw) {
    const now = g.left > 0 ? (g.bad.includes(use) ? 'bad' : 'good') : 'blind';
    Object.assign(g, { phase: 'run', seen: { ...g.seen, [use]: now }, left: g.left - (now === 'blind' ? 0 : 1), last: now });
    g.events.push({ type: 'look', id: use, saw: now });
    return g;
  }
  // (seen cursed: left be, and the HUD says so again)
  if (saw === 'bad') {
    g.last = 'bad';
    return g;
  }
  // taken: a curse unseen is the end of it
  if (g.bad.includes(use)) {
    g.phase = 'lost';
    g.events.push({ type: 'lost', id: use });
    return g;
  }
  Object.assign(g, { taken: [...g.taken, use], last: 'taken' });
  g.events.push({ type: 'take', id: use });
  if (g.taken.length >= g.need) {
    g.phase = 'won';
    g.events.push({ type: 'won' });
  }
  return g;
}

// n of the things, drawn by `rand` (a Fisher–Yates draw), and always one left clean
export function curse(items, n, rand) {
  const pool = [...items];
  const k = Math.max(0, Math.min(n, items.length - 1));
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k);
}

// won: say so every frame till the task's kept (a frame in a fade is lost);
// lost: once, and not while Morty's fading
export function dealNews(g, { done, fading }) {
  if (g.phase === 'won') return done ? null : 'done';
  if (g.phase === 'lost' && !fading && !g.told) return 'caught';
  return null;
}

export function dealReadout(g, words = WORDS) {
  if (!g || g.phase !== 'run') return { on: false, vitals: null, line: '' };
  return { on: true, vitals: { value: g.left, max: g.looks, low: g.left === 0 }, line: g.last === 'taken' ? words.taken(g.taken.length, g.need) : words[g.last] };
}
