// Face Off at Casa Tranquila: the rules, with no drawing in them.
//
// The nurse holds up the letter board and runs her finger along it, a row at
// a time; Hector rings his bell to pick the row, then again as the right
// letter comes round. Spell three words, the finger faster for each, and
// every wrong ring costs five seconds. The last word spelled, Gus walks in;
// three rings of the bell, and the room goes up.
//
// Phases: 'rows' | 'letters' (playing), 'gus' (he walks in), 'bell' (ring
// three times), 'boom', 'after'.

export const ROWS = ['ABCDEF', 'GHIJKL', 'MNOPQR', 'STUVWX', 'YZ'];
export const WORDS = ['TIO', 'DING', 'GUS', 'SAUL', 'WALT', 'MIKE', 'LALO', 'HANK'];
export const GUS_SECONDS = 2.5; // his walk in
export const BOOM_SECONDS = 2.6; // until the smoke clears
const MISS_SECONDS = 5;
const PASSES = 2; // times along a row with no ring before the nurse goes back to the rows

// how long the finger stays on each row or letter, in seconds, for word w
export const speed = (w) => Math.max(0.38, 0.56 - 0.07 * w);

export function newGame(rand = Math.random) {
  const pool = [...WORDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { phase: 'rows', words: pool.slice(0, 3), w: 0, typed: '', row: 0, col: 0, misses: 0, seconds: 0, tick: 0, finale: 0, rings: 0 };
}

const back = { phase: 'rows', row: 0, col: 0, tick: 0 }; // to the top of the board

export function stepGame(s, dt) {
  if (s.phase === 'rows' || s.phase === 'letters') {
    let { phase, row, col, tick } = s;
    tick += dt;
    const each = speed(s.w);
    while (tick >= each - 1e-9) {
      tick -= each;
      if (phase === 'rows') row = (row + 1) % ROWS.length;
      else if (++col >= ROWS[row].length * PASSES) {
        ({ phase, row, col } = back);
        tick = 0;
        break;
      }
    }
    return { ...s, phase, row, col, tick, seconds: s.seconds + dt };
  }
  if (s.phase === 'gus') {
    const finale = s.finale + dt;
    return finale >= GUS_SECONDS ? { ...s, phase: 'bell', finale: 0, rings: 0 } : { ...s, finale };
  }
  if (s.phase === 'boom') {
    const finale = s.finale + dt;
    return finale >= BOOM_SECONDS ? { ...s, phase: 'after', finale: 0 } : { ...s, finale };
  }
  return s;
}

// The lit letter, while the finger's in a row.
const litLetter = (s) => (s.phase === 'letters' ? ROWS[s.row][s.col % ROWS[s.row].length] : null);

// A ring of the bell. Returns { state, event }: 'row' (a row picked),
// 'letter' (the right one), 'miss', 'word' (one spelled, on to the next),
// 'gus' (the last one spelled), 'bell' (a ring in the finale), 'boom', or
// 'ignored'.
export function ring(s) {
  if (s.phase === 'rows') return { state: { ...s, phase: 'letters', col: 0, tick: 0 }, event: 'row' };
  if (s.phase === 'letters') {
    const word = s.words[s.w];
    if (litLetter(s) !== word[s.typed.length]) return { state: { ...s, ...back, misses: s.misses + 1 }, event: 'miss' };
    const typed = s.typed + litLetter(s);
    if (typed.length < word.length) return { state: { ...s, ...back, typed }, event: 'letter' };
    if (s.w + 1 < s.words.length) return { state: { ...s, ...back, w: s.w + 1, typed: '' }, event: 'word' };
    return { state: { ...s, phase: 'gus', typed, finale: 0 }, event: 'gus' };
  }
  if (s.phase === 'bell') {
    const rings = s.rings + 1;
    return rings >= 3 ? { state: { ...s, phase: 'boom', rings, finale: 0 }, event: 'boom' } : { state: { ...s, rings }, event: 'bell' };
  }
  return { state: s, event: 'ignored' };
}

// Lower is better: the seconds taken, and five more a miss.
export const score = (s) => Math.round(s.seconds + MISS_SECONDS * s.misses);
