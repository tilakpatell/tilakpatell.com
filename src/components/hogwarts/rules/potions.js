// Potions, a Cure for Boils (quest 4, docs/superpowers/specs/2026-10-21-
// hogwarts-world-design.md §4.7). The recipe is on the board, as data: a
// heat, five ingredients in their order, a count of stirs, and the fire
// off before the last one (the porcupine quills, which every first-year
// is warned about and one in every class forgets). The cauldron reads your
// moves; a move that isn’t the board’s next one melts it, and Snape takes
// five points. The board followed to the end earns ten.
//
// A move: { do: 'heat', to: 'off' | 'low' | 'medium' | 'high' },
// { do: 'add', what }, { do: 'stir', dir: 'cw' | 'ccw' }.
//
//   CURE_FOR_BOILS, INGREDIENTS, newBrew(recipe), next(brew) → the board’s
//   next step, move(brew, m) → { brew, ok, melted, done, points, says },
//   colourOf(brew), result(brew), potionsBot(brew) → the next move

export const HEATS = ['off', 'low', 'medium', 'high'];

export const INGREDIENTS = {
  nettles: { name: 'Dried nettles', colour: '#6f8a3a' },
  fangs: { name: 'Snake fangs, crushed', colour: '#e8e2cf' },
  slugs: { name: 'Horned slugs, stewed', colour: '#7a5a3a' },
  mucus: { name: 'Flobberworm mucus', colour: '#b8c27a' },
  quills: { name: 'Porcupine quills', colour: '#3a2f28' },
  // (on the shelves, not on the board: the wrong jar is always nearer)
  eyes: { name: 'Beetle eyes', colour: '#22252a' },
  bezoar: { name: 'A bezoar', colour: '#8a7a5a' },
};

// the board, step by step; `colour` is the brew’s after the step
export const CURE_FOR_BOILS = {
  id: 'boils',
  name: 'Cure for Boils',
  board: [
    { do: 'heat', to: 'medium', says: 'Bring the fire to a steady medium.', colour: '#3b4a52' },
    { do: 'add', what: 'nettles', says: 'Dried nettles, one handful.', colour: '#4f6a3a' },
    { do: 'add', what: 'fangs', says: 'Snake fangs, crushed fine.', colour: '#6f7f5a' },
    { do: 'stir', times: 4, says: 'Stir four times, clockwise.', colour: '#7f8f6a' },
    { do: 'add', what: 'slugs', says: 'Horned slugs, stewed.', colour: '#8a6f4a' },
    { do: 'add', what: 'mucus', says: 'Flobberworm mucus, a ladle.', colour: '#9a8f5a' },
    { do: 'heat', to: 'off', says: 'Fire off. Then, and only then:', colour: '#a89a6a' },
    { do: 'add', what: 'quills', says: 'Porcupine quills.', colour: '#d6c6ef' },
  ],
  points: 10,
  melt: 5,
};

export const SNAPE = {
  melted: 'Five points from {house}. Read the board. Then read it again, slowly.',
  done: 'Adequate. Ten points to {house}, and don’t let it go to your head.',
};

export function newBrew(recipe = CURE_FOR_BOILS) {
  return { recipe, step: 0, stirs: 0, heat: 'off', melted: false, done: false, moves: 0 };
}

export const next = (b) => (b.done || b.melted ? null : b.recipe.board[b.step]);

export function move(b, m) {
  const want = next(b);
  if (!want) return { brew: b, ok: false, melted: b.melted, done: b.done, points: 0, says: null };
  const moves = b.moves + 1;
  let ok = false;
  if (m.do === 'heat') ok = want.do === 'heat' && m.to === want.to;
  else if (m.do === 'add') ok = want.do === 'add' && m.what === want.what;
  else if (m.do === 'stir') ok = want.do === 'stir' && (m.dir ?? 'cw') === 'cw' && b.stirs < want.times;
  if (!ok) {
    return { brew: { ...b, moves, melted: true, heat: m.do === 'heat' ? m.to : b.heat }, ok: false, melted: true, done: false, points: -b.recipe.melt, says: SNAPE.melted };
  }
  let brew = { ...b, moves, heat: m.do === 'heat' ? m.to : b.heat };
  if (m.do === 'stir') {
    const stirs = b.stirs + 1;
    brew = stirs >= want.times ? { ...brew, stirs: 0, step: b.step + 1 } : { ...brew, stirs };
  } else brew = { ...brew, step: b.step + 1 };
  const done = brew.step >= b.recipe.board.length;
  brew.done = done;
  return { brew, ok: true, melted: false, done, points: done ? b.recipe.points : 0, says: done ? SNAPE.done : (next(brew)?.says ?? null) };
}

// what the brew looks like now: the last step’s colour, green-black and
// smoking once melted
export function colourOf(b) {
  if (b.melted) return '#1a2a12';
  if (b.step === 0) return '#2f3a40';
  return b.recipe.board[b.step - 1].colour;
}

export const result = (b) => (b.done ? { type: 'lesson', id: 'potions', done: true, points: b.recipe.points } : null);

// the bot reads the board
export function potionsBot(b) {
  const want = next(b);
  if (!want) return null;
  if (want.do === 'stir') return { do: 'stir', dir: 'cw' };
  if (want.do === 'heat') return { do: 'heat', to: want.to };
  return { do: 'add', what: want.what };
}
