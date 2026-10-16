// The music room's tuning: one Sa for every instrument, the raga, the
// tanpura's first string and how the sitar is set up, kept between visits.
// Pitches are just intonation against Sa. Nothing here makes a sound.

import { RAGAS, customRaga } from './ragas';

// ── Sa ─────────────────────────────────────────────────────────────────────
// Sa can be any note from C3 to B3. The tanpura's middle strings sound it.
export const SA_NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const saHz = (i) => 440 * 2 ** ((48 + i - 69) / 12);

// The tanpura's first string: Pa for most ragas, Ma where Pa is left out
// (Malkauns), Ni for ragas built around it (Marwa, Puriya). All in the lower octave.
export const FIRST_STRING = {
  Pa: { ratio: 3 / 4, label: 'Pa', note: 'mandra Pa' },
  Ma: { ratio: 2 / 3, label: 'Ma', note: 'mandra Ma' },
  Ni: { ratio: 15 / 16, label: 'Ni', note: 'mandra Ni' },
};

// ── Swaras ─────────────────────────────────────────────────────────────────
// Swaras in just intonation. Lowercase r g d n are komal (flat); M is tivra (sharp) Ma.
export const SWARA = { S: 1, r: 16 / 15, R: 9 / 8, g: 6 / 5, G: 5 / 4, m: 4 / 3, M: 45 / 32, P: 3 / 2, d: 8 / 5, D: 5 / 3, n: 9 / 5, N: 15 / 8 };
export const SWARA_NAME = { S: 'Sa', r: 'Re', R: 'Re', g: 'Ga', G: 'Ga', m: 'Ma', M: 'Ma', P: 'Pa', d: 'Dha', D: 'Dha', n: 'Ni', N: 'Ni' };
// all twelve, in order up the octave
export const CHROMATIC = ['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'];
// komal notes are written underlined, tivra Ma with a tick
export const swaraMark = (s) => (s === 'r' || s === 'g' || s === 'd' || s === 'n' ? 'komal' : s === 'M' ? 'tivra' : null);

// ── Ragas ──────────────────────────────────────────────────────────────────
// The database is in ./ragas.js. A raga's notes sit at their just ratios
// (SWARA) unless it tunes one differently (Darbari's ati komal Ga and Dha,
// Todi's low komal notes). The player can also make a raga of their own,
// kept in the tuning as `customRaga` and picked as 'custom'.
export { RAGAS, THAATS, TIMES, customRaga } from './ragas';

// A raga by id, the player's own included.
export function ragaOf(id, t = tuning) {
  if (id === 'custom') return customRaga(t.customRaga?.notes || 'SRGmPDN', t.customRaga?.name);
  return RAGAS[id] || RAGAS.yaman;
}
export const isRaga = (id) => id === 'custom' || Object.hasOwn(RAGAS, id);

// The swara nearest a ratio over Sa, and its octave (0 is the middle one), for naming a note heard.
export function swaraOf(ratio) {
  const oct = Math.floor(Math.log2(ratio) + 1 / 48); // a hair under Sa still counts as Sa
  const r = ratio / 2 ** oct;
  let best = 'S';
  let dist = Infinity;
  for (const s of CHROMATIC) {
    const d = Math.min(Math.abs(Math.log2(r / SWARA[s])), Math.abs(Math.log2(r / (SWARA[s] * 2))));
    if (d < dist) {
      dist = d;
      best = s;
    }
  }
  // close enough to the next Sa up is that Sa
  return Math.abs(Math.log2(r / 2)) < Math.abs(Math.log2(r / SWARA[best])) ? { s: 'S', oct: oct + 1 } : { s: best, oct };
}

// Where a raga plays a swara, over Sa.
export const swaraIn = (raga, s) => raga?.tune?.[s] ?? SWARA[s];

// ── The sitar's frets ──────────────────────────────────────────────────────
// A sitar's frets are tied on with thread and can be slid along the neck: a
// player sets them before playing, for the raga or the kind of raga. The
// neck runs from mandra Pa to taar Ga, as a sitar's twenty-odd frets do above
// its open Ma string, except where a setting says otherwise.
//   all       every one of the twelve swaras (moveable frets set chromatically)
//   regular   a sitar as it usually comes: the shuddha notes and komal Ni, Sa to taar Sa
//   darbari   set for Darbari: Ga and Dha moved low, ati komal, for its heavy, slow andolan
//   bhairavi  set for Bhairavi: komal Re, Ga, Dha and Ni
//   raga      only the raga's own notes
//   custom    the frets the player chose
// Each fret says whether its note is in the raga, and whether it sits lower
// than komal (ati komal).
export const NECK_LOW = 0.74; // mandra Pa (3/4), with room for just intonation
export const NECK_HIGH = 2.51; // taar Ga (5/2)

// The lower Ga and Dha of the Kanada ragas, Darbari above all: a Pythagorean
// minor third and sixth, a little under the just komal notes (294 and 792
// cents against 316 and 814).
export const ATI_KOMAL = { g: 32 / 27, d: 128 / 81 };

export const FRET_SETS = {
  all: { name: 'All twelve notes', notes: CHROMATIC.join('') },
  regular: { name: 'Regular', notes: 'SRGmPDnN', lo: 0.99, hi: 2.01 },
  darbari: { name: 'Darbari', notes: 'SRgmPdn', tune: ATI_KOMAL },
  bhairavi: { name: 'Bhairavi', notes: 'SrgmPdn' },
  raga: { name: 'The raga’s own' },
  custom: { name: 'Custom' },
};
export const isFretSet = (id) => Object.hasOwn(FRET_SETS, id);

// The notes a custom setting keeps, in order up the octave; at least Sa.
export function customNotes(text = '') {
  const kept = CHROMATIC.filter((s) => String(text).includes(s));
  return kept.length ? kept.join('') : 'S';
}

// The frets for a raga under a setting, from the nut up: { s, oct, ratio, inRaga, ati }.
// The old { all } form still works: all twelve, or the raga's own.
export function frets(ragaId, { set, all, custom } = {}) {
  const id = isFretSet(set) ? set : all ? 'all' : 'raga';
  const kind = FRET_SETS[id];
  const own = ragaOf(ragaId);
  const notes = new Set(id === 'raga' ? own.notes : id === 'custom' ? customNotes(custom) : kind.notes);
  const raga = new Set(own.notes);
  // set for the raga, the frets sit where the raga tunes its notes
  const tune = id === 'raga' ? own.tune : kind.tune;
  const lo = kind.lo ?? NECK_LOW;
  const hi = kind.hi ?? NECK_HIGH;
  const out = [];
  for (const oct of [-1, 0, 1, 2]) {
    for (const s of CHROMATIC) {
      if (!notes.has(s)) continue;
      const at = tune?.[s] ?? SWARA[s];
      const ratio = at * 2 ** oct;
      if (ratio < lo || ratio > hi) continue;
      out.push({ s, oct, ratio, inRaga: raga.has(s), ati: at < SWARA[s] * 2 ** (-10 / 1200) });
    }
  }
  return out;
}

// ── The shared tuning ──────────────────────────────────────────────────────
const KEY = 'tp-music';
// the chikari: filling the rests by itself, following the music or at a set speed (strokes a minute), and how hard
// the sitar's frets: a setting (FRET_SETS), and the notes of a custom one; a raga of the player's own
const DEFAULT_TUNING = { sa: 2, first: 'Pa', raga: 'yaman', customRaga: { notes: '', name: '' }, frets: 'all', customFrets: '', autoChikari: true, chikariFollow: true, chikariSpeed: 240, chikariLevel: 1 }; // Sa = D
let tuning = (() => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (saved && saved.sa >= 0 && saved.sa < 12 && FIRST_STRING[saved.first] && isRaga(saved.raga)) {
      // a visit from before the fret settings kept only whether all twelve were set
      const fretSet = isFretSet(saved.frets) ? saved.frets : saved.allFrets === false ? 'raga' : 'all';
      const customRaga = { notes: String(saved.customRaga?.notes || ''), name: String(saved.customRaga?.name || '').slice(0, 32) };
      return { ...DEFAULT_TUNING, ...saved, customRaga, frets: fretSet, autoChikari: saved.autoChikari !== false, chikariFollow: saved.chikariFollow !== false };
    }
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_TUNING;
})();
const tuningListeners = new Set();
export const getTuning = () => tuning;
export const onTuning = (fn) => {
  tuningListeners.add(fn);
  return () => tuningListeners.delete(fn);
};
export function setTuning(next) {
  tuning = { ...tuning, ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tuning));
  } catch {
    /* storage unavailable */
  }
  tuningListeners.forEach((fn) => fn(tuning));
}
export const sa = () => saHz(tuning.sa);
