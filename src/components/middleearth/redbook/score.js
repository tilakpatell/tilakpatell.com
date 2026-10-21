// The Red Book’s music, as notes: one mood for each group of pages, each a
// loop of half a minute or more in two or three phrases, the site’s own
// tunes in the old folk modes (nothing from the films). Pure: the player
// (./music.js) asks for the notes in a window of time and plays them on
// its instruments (./instruments.js).
//
// A line is written as a pitch and a length, in the mood’s unit (a quaver
// in 6/8, a crotchet in 3/4): 'D5 2 E5 1', a rest 'r 3', a chord
// 'D3+A3+F#4 6', a grace note from above 'B5~ 3'. A track plays its line
// from `at` (in units) once, or round and round with `repeat`.
//
//   MOODS                          { id: { bpm, units, phrase, tracks } }
//   moodOf(pageId)                 the mood of a page, a back page or the shut book (null)
//   loopSeconds(mood)              how long one time round is
//   phraseSeconds(mood)            how long a phrase is (a change of mood waits for one)
//   nextPhrase(mood, t)            the first phrase boundary at or after t (s)
//   notesIn(mood, from, to)        the notes starting in [from, to) on the endless loop:
//                                  [{ t, inst, midi, dur, vel, grace }] in time order
//   parse(line) → { notes: [{ at, midis, dur, grace }], length }
//   RANGE                          each instrument’s lowest and highest MIDI note

export const RANGE = {
  whistle: [62, 93],
  harp: [36, 91],
  fiddle: [55, 93],
  cello: [36, 67],
  strings: [36, 84],
  choir: [40, 81],
  horn: [41, 77],
  drum: [24, 50],
  frame: [40, 60],
  bell: [60, 100],
};

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midiOf(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`not a note: ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export function parse(line) {
  const tokens = line.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
  const notes = [];
  let at = 0;
  for (let i = 0; i < tokens.length; i += 2) {
    const dur = Number(tokens[i + 1]);
    if (!(dur > 0)) throw new Error(`no length after ${tokens[i]} in “${line}”`);
    const word = tokens[i];
    if (word !== 'r') {
      const grace = word.endsWith('~');
      notes.push({ at, midis: word.replace('~', '').split('+').map(midiOf), dur, grace });
    }
    at += dur;
  }
  return { notes, length: at };
}

// a chord’s tones played in a pattern, one tone a step (null a rest): a
// harp’s arpeggio, a cello’s ostinato
const arp = (chords, pattern, step = 1) =>
  chords
    .map((c) => {
      const tones = c.split(' ');
      return pattern.map((k) => (k == null ? `r ${step}` : `${tones[k]} ${step}`)).join(' ');
    })
    .join(' | ');
// each chord held for `len`, all its tones at once
const held = (chords, len) => chords.map((c) => `${c.split(' ').join('+')} ${len}`).join(' | ');

// ── The moods ───────────────────────────────────────────────────────────

// Bag End’s study, the book shut or at its back pages: a warm harp, sparse,
// over low strings. G major, 3/4, a crotchet at 66.
const STUDY_CHORDS = ['G2 D3 B3 D4', 'E2 B2 G3 B3', 'C3 G3 E4 G4', 'D3 A3 F#4 A4', 'G2 D3 B3 D4', 'B2 F#3 D4 F#4', 'C3 G3 E4 G4', 'D3 A3 F#4 A4', 'E2 B2 G3 B3', 'C3 G3 E4 G4', 'G2 D3 B3 D4', 'D3 A3 F#4 A4', 'C3 G3 E4 G4', 'A2 E3 C4 E4', 'D3 A3 F#4 A4', 'G2 D3 B3 D4'];
const study = {
  bpm: 66,
  units: 48,
  phrase: 12,
  tracks: [
    { inst: 'harp', vel: 0.42, line: arp(STUDY_CHORDS, [0, 1, 2]) },
    { inst: 'cello', vel: 0.26, line: held(STUDY_CHORDS.map((c) => c.split(' ')[0]), 3) },
    { inst: 'harp', vel: 0.5, line: 'r 3 | r 2 B4 1 | C5 2 E5 1 | D5 3 | r 3 | r 2 F#5 1 | G5 2 E5 1 | A5 3 | r 3 | r 1 E5 1 G5 1 | B4 3 | A4 3 | r 3 | C5 1 B4 1 A4 1 | F#4 3 | G4 3' },
  ],
};

// The Shire: a tin whistle over a harp in a gentle 6/8, D major with the
// flattened seventh of the old tunes in its second half. A quaver at 150
// (a dotted crotchet at 50). The tune twice, then the harp has it alone.
const SHIRE_A = 'D5 2 E5 1 F#5 2 A5 1 | G5 2 F#5 1 E5 3 | D5 2 E5 1 F#5 1 G5 1 A5 1 | B5~ 3 A5 3 | F#5 2 A5 1 G5 2 E5 1 | F#5 2 D5 1 E5 3 | D5 1 E5 1 F#5 1 E5 2 C#5 1 | D5 5 r 1';
const SHIRE_B = 'A5 2 B5 1 C6~ 3 | B5 2 A5 1 G5 3 | A5 2 G5 1 F#5 2 E5 1 | D5 3 E5 3 | F#5 2 G5 1 A5 2 D6 1 | C6 2 A5 1 G5 3 | F#5 1 G5 1 A5 1 G5 2 E5 1 | D5 5 r 1';
const D = 'D3 A3 D4 F#4';
const A = 'A2 E3 A3 C#4';
const G = 'G2 D3 G3 B3';
const C = 'C3 G3 C4 E4';
const SHIRE_CHORDS_A = [D, A, D, G, D, A, A, D];
const SHIRE_CHORDS_B = [C, G, D, A, D, C, A, D];
const SHIRE_CHORDS = [...SHIRE_CHORDS_A, ...SHIRE_CHORDS_B, ...SHIRE_CHORDS_A];
const shire = {
  bpm: 150,
  units: 144,
  phrase: 24,
  tracks: [
    { inst: 'whistle', vel: 0.6, line: `${SHIRE_A} | ${SHIRE_B}` },
    { inst: 'harp', vel: 0.36, line: arp(SHIRE_CHORDS, [0, 1, 2, 3, 2, 1]) },
    { inst: 'strings', vel: 0.2, line: held(SHIRE_CHORDS.map((c) => c.split(' ').slice(1).join(' ')), 6) },
    // (the third time round the harp sings it, an octave down, and a frame drum keeps the lilt)
    { inst: 'harp', vel: 0.55, at: 96, transpose: -12, line: SHIRE_A },
    { inst: 'frame', vel: 0.22, at: 48, line: Array(16).fill('A2 3 A2 3').join(' | ') },
  ],
};

// Bree on a wet night: a fiddle low and wary in E dorian, a frame drum,
// a drone under it. Common time, a quaver at 200.
const bree = {
  bpm: 200,
  units: 128,
  phrase: 32,
  tracks: [
    {
      inst: 'fiddle',
      vel: 0.5,
      line:
        'E4 2 G4 1 A4 1 B4 2 A4 1 G4 1 | F#4 2 D4 1 E4 1 F#4 2 r 2 | E4 2 G4 1 A4 1 B4 1 C#5 1 D5 2 | B4 3 A4 1 B4 4 | E5 2 D5 1 B4 1 A4 2 B4 1 G4 1 | F#4 2 A4 1 F#4 1 D4 2 r 2 | E4 1 F#4 1 G4 1 A4 1 B4 2 A4 1 F#4 1 | E4 6 r 2 | ' +
        'B4 1 C#5 1 D5 2 E5 2 D5 1 B4 1 | A4 2 B4 1 A4 1 G4 2 F#4 2 | G4 1 A4 1 B4 2 D5 2 C#5 1 A4 1 | B4 6 r 2 | E5 2 F#5 1 E5 1 D5 2 B4 2 | C#5 2 A4 1 B4 1 G4 2 E4 2 | F#4 1 G4 1 A4 1 B4 1 A4 2 F#4 2 | E4 6 r 2',
    },
    { inst: 'frame', vel: 0.42, repeat: true, line: 'A2 3 A3 1 A2 2 A3 1 A3 1' },
    { inst: 'cello', vel: 0.24, line: 'E2+B2 8 | D2+A2 8 | E2+B2 8 | E2+B2 8 | E2+B2 8 | D2+A2 8 | E2+B2 8 | E2+B2 8 | G2+D3 8 | A2+E3 8 | G2+D3 8 | B2+F#3 8 | E2+B2 8 | A2+E3 8 | D2+A2 8 | E2+B2 8' },
  ],
};

// The wild: the low strings’ ostinato, a lonely horn in A minor, soft
// timpani. Common time, a quaver at 144.
const AM = 'A2 E3 A3 C4';
const F = 'F2 C3 F3 A3';
const CM = 'C3 G3 C4 E4';
const E = 'E2 B2 E3 G#3';
const DM = 'D2 A2 D3 F3';
const WILD_CHORDS = [AM, AM, F, F, CM, CM, E, E, DM, DM, AM, AM, F, F, E, AM];
const wild = {
  bpm: 144,
  units: 128,
  phrase: 32,
  tracks: [
    { inst: 'cello', vel: 0.34, line: arp(WILD_CHORDS, [0, 1, 2, 1, 0, 1, 3, 1]) },
    {
      inst: 'horn',
      vel: 0.5,
      line: 'r 8 | r 4 A3 2 C4 2 | F4 6 E4 2 | C4 8 | r 4 G4 2 E4 2 | D4 4 C4 4 | B3 6 G#3 2 | B3 8 | r 4 D4 2 F4 2 | A4 6 G4 2 | E4 4 C4 2 D4 2 | E4 8 | F4 4 A4 2 C5 2 | B4~ 4 A4 4 | G#4 6 B4 2 | A4 8',
    },
    { inst: 'drum', vel: 0.32, line: 'A1 16 | F1 16 | C2 16 | E1 8 E1 4 E1 4 | D2 16 | A1 16 | F1 16 | E1 8 A1 8' },
    { inst: 'strings', vel: 0.16, at: 64, line: 'D4+F4+A4 16 | C4+E4+A4 16 | C4+F4+A4 16 | B3+E4+G#4 8 A3+C4+E4 8' },
  ],
};

// The Elves: harp in F lydian (the raised fourth, B natural, is theirs), a
// high wordless choir, bells now and then. 3/4, a quaver at 120.
const ELF = {
  F: 'F3 C4 F4 A4 C5',
  G: 'G3 D4 G4 B4 D5',
  Am: 'A3 E4 A4 C5 E5',
  Dm: 'D3 A3 D4 F4 A4',
  C: 'C3 G3 C4 E4 G4',
  Em: 'E3 B3 E4 G4 B4',
};
const ELF_CHORDS = ['F', 'G', 'F', 'Am', 'Dm', 'G', 'C', 'F', 'Dm', 'Em', 'F', 'G', 'Am', 'G', 'C', 'F'].map((k) => ELF[k]);
const elves = {
  bpm: 120,
  units: 96,
  phrase: 24,
  tracks: [
    { inst: 'harp', vel: 0.38, line: arp(ELF_CHORDS, [0, 1, 2, 3, 4, 3]) },
    { inst: 'choir', vel: 0.3, line: 'A4+C5 6 | B4+D5 6 | A4+F5 6 | A4+E5 6 | F4+A4 6 | G4+B4 6 | E4+G4 6 | F4+A4+C5 6' },
    { inst: 'choir', vel: 0.42, at: 48, line: 'D5 6 | E5 4 D5 2 | C5 6 | B4 6 | A4 4 C5 2 | B4 4 G4 2 | E5 6 | F5 6' },
    { inst: 'choir', vel: 0.22, at: 48, line: 'F4+A4 6 | G4+B4 6 | F4+A4 6 | G4+D5 6 | E4+A4 6 | D4+G4 6 | C4+G4 6 | C4+F4 6' },
    { inst: 'bell', vel: 0.2, repeat: true, line: 'C6 12 | A5 12 | F6 12 | E6 12' },
  ],
};

// Moria: the drums in the deep, slow, and a low choir of men holding the
// fifth, the flattened second leaning on it (D phrygian). A crotchet at 50.
const deep = {
  bpm: 50,
  units: 64,
  phrase: 16,
  tracks: [
    { inst: 'drum', vel: 0.55, repeat: true, line: 'D1 1 D1 1 r 2 D1 1 r 1 D1 2' },
    { inst: 'choir', vel: 0.34, line: 'D3+A3 16 | Eb3+Bb3 8 | D3+A3 8 | D3+A3 16 | C3+G3 8 | D3+A3 8' },
    { inst: 'cello', vel: 0.28, line: 'D2 16 | Eb2 8 | D2 8 | D2 16 | C2 8 | D2 8' },
    { inst: 'horn', vel: 0.34, line: 'r 32 | A3 8 | Bb3 4 A3 4 | r 16' },
  ],
};

// The Great River: a flowing harp, strings, and a noble horn over them,
// B flat major. Common time, a quaver at 168.
const RIV = {
  Bb: 'Bb2 F3 Bb3 D4 F4',
  F: 'F2 C3 F3 A3 C4',
  Gm: 'G2 D3 G3 Bb3 D4',
  Eb: 'Eb3 Bb3 Eb4 G4 Bb4',
};
const RIVER_KEYS = ['Bb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'Eb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'F', 'Bb'];
const river = {
  bpm: 168,
  units: 128,
  phrase: 32,
  tracks: [
    { inst: 'harp', vel: 0.34, line: arp(RIVER_KEYS.map((k) => RIV[k]), [0, 1, 2, 3, 4, 3, 2, 1]) },
    { inst: 'strings', vel: 0.2, line: held(RIVER_KEYS.map((k) => RIV[k].split(' ').slice(2).join(' ')), 8) },
    {
      inst: 'horn',
      vel: 0.48,
      line: 'r 8 | r 8 | D4 4 F4 2 G4 2 | Bb4 6 A4 2 | F4 8 | C4 4 F4 4 | G4 4 Bb4 2 C5 2 | A4 8 | Bb4 4 D5 2 C5 2 | Bb4 4 G4 4 | F4 6 D4 2 | C4 8 | D4 4 G4 2 Bb4 2 | Eb5 4 D5 2 C5 2 | C5 4 A4 4 | Bb4 8',
    },
  ],
};

// The Shadow: dark drones that will not settle, dissonant swells, drums a
// long way off. C minor, a crotchet at 54.
const shadow = {
  bpm: 54,
  units: 64,
  phrase: 16,
  tracks: [
    { inst: 'strings', vel: 0.3, line: 'C3+G3 8 | C3+Ab3 8 | C3+G3 8 | Db3+Ab3 8 | C3+Gb3 8 | C3+G3 8 | B2+G3 8 | C3+G3 8' },
    { inst: 'choir', vel: 0.28, line: 'r 4 G3+Ab3 4 | r 8 | Eb4+D4 4 r 4 | r 8 | Db4+C4 4 r 4 | r 16 | B3+C4 4 r 4' },
    { inst: 'drum', vel: 0.34, repeat: true, line: 'C1 6 C1 2 r 8' },
    { inst: 'cello', vel: 0.24, line: 'C2 32 | C2 32' },
  ],
};

// Gondor calls for aid: brass chords and a rising call over them, the
// timpani under it all. D major, a quaver at 160.
const gondor = {
  bpm: 160,
  units: 128,
  phrase: 32,
  tracks: [
    {
      inst: 'horn',
      vel: 0.52,
      line: 'A3 3 A3 1 D4 4 | E4 3 D4 1 B3 4 | D4 3 E4 1 G4 4 | F#4 6 E4 2 | A4 3 G4 1 F#4 4 | E4 3 D4 1 C#4 4 | B3 2 D4 2 G4 4 | A4 8 | B4 4 A4 2 F#4 2 | G4 4 B4 2 D5 2 | A4 6 F#4 2 | E4 8 | D4 2 E4 2 G4 4 | F#4 2 G4 2 A4 4 | B4 4 C#5 2 D5~ 2 | D5 8',
    },
    { inst: 'horn', vel: 0.3, line: 'D3+A3 8 | B2+F#3 8 | G2+D3 8 | A2+E3 8 | D3+A3 8 | F#2+C#3 8 | G2+D3 8 | A2+E3 8 | B2+F#3 8 | G2+D3 8 | D3+A3 8 | A2+E3 8 | G2+D3 8 | A2+E3 8 | B2+F#3 8 | D3+A3 8' },
    { inst: 'drum', vel: 0.36, repeat: true, line: 'D2 1 D2 1 r 2 A1 4' },
    { inst: 'strings', vel: 0.16, line: 'F#4+A4 8 | F#4+B4 8 | G4+B4 8 | E4+A4 8 | F#4+A4 8 | F#4+C#5 8 | G4+B4 8 | E4+A4 8 | F#4+B4 8 | G4+B4 8 | F#4+A4 8 | E4+A4 8 | G4+B4 8 | E4+A4 8 | F#4+B4 8 | F#4+A4 8' },
  ],
};

// The Grey Havens: the whistle once more, slow and tender, a choir, the
// harp, a bell over the water. D major, 3/4, a crotchet at 58.
const HAV = { D: 'D3 A3 F#4', G: 'G2 D3 B3', A: 'A2 E3 C#4', Bm: 'B2 F#3 D4', Em: 'E3 B3 G4' };
const HAV_CHOIR = { D: 'F#4 A4', G: 'D4 B4', A: 'E4 C#5', Bm: 'F#4 D5', Em: 'G4 B4' };
const HAVEN_KEYS = ['D', 'D', 'G', 'A', 'D', 'D', 'A', 'A', 'G', 'D', 'Em', 'A', 'Bm', 'G', 'D', 'D'];
const havens = {
  bpm: 58,
  units: 48,
  phrase: 12,
  tracks: [
    { inst: 'whistle', vel: 0.55, line: 'F#5 2 E5 1 | D5 2 A4 1 | B4 2 D5 1 | A4 3 | F#5 2 G5 1 | A5 2 F#5 1 | E5 3 | E5 2 r 1 | B5 2 A5 1 | F#5 2 D5 1 | G5 2 F#5 1 | E5 3 | D5 2 F#5 1 | E5 1.5 D5 0.5 B4 1 | D5 3 | D5 2 r 1' },
    { inst: 'harp', vel: 0.32, line: arp(HAVEN_KEYS.map((k) => HAV[k]), [0, 1, 2]) },
    { inst: 'choir', vel: 0.24, line: held(HAVEN_KEYS.map((k) => HAV_CHOIR[k]), 3) },
    { inst: 'bell', vel: 0.18, repeat: true, line: 'A5 24 | D6 24' },
  ],
};

export const MOODS = { study, shire, bree, wild, elves, deep, river, shadow, gondor, havens };

const PAGE_MOOD = {
  'bag-end': 'shire',
  'shire-edge': 'shire',
  bree: 'bree',
  weathertop: 'wild',
  ford: 'wild',
  caradhras: 'wild',
  rivendell: 'elves',
  lorien: 'elves',
  moria: 'deep',
  anduin: 'river',
  marshes: 'shadow',
  'cirith-ungol': 'shadow',
  doom: 'shadow',
  beacons: 'gondor',
  havens: 'havens',
};
export const moodOf = (id) => PAGE_MOOD[id] ?? 'study';

const unitOf = (m) => 60 / MOODS[m].bpm;
export const loopSeconds = (m) => MOODS[m].units * unitOf(m);
export const phraseSeconds = (m) => MOODS[m].phrase * unitOf(m);
export function nextPhrase(m, t) {
  const p = phraseSeconds(m);
  // (+ 0: the ceiling of a hair under nothing is −0)
  return Math.ceil(t / p - 1e-9) * p + 0;
}

// a little human unevenness, the same every time: a hash of the note’s place
const wobble = (i, k) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
// (pads and drones keep strict time; a player’s hands don’t)
const LOOSE = new Set(['whistle', 'harp', 'fiddle', 'horn', 'frame', 'bell']);

// every note of a mood’s one time round, in seconds, sorted
const built = new Map();
export function eventsOf(m) {
  if (built.has(m)) return built.get(m);
  const mood = MOODS[m];
  const unit = unitOf(m);
  const out = [];
  mood.tracks.forEach((track, ti) => {
    const { notes, length } = parse(track.line);
    const from = track.at ?? 0;
    const times = track.repeat ? Math.floor((mood.units - from) / length) : 1;
    for (let r = 0; r < times; r++)
      notes.forEach((n, ni) => {
        n.midis.forEach((midi, ci) => {
          const i = ti * 1000 + r * 100 + ni + ci * 0.37;
          const late = LOOSE.has(track.inst) ? wobble(i, 1) * 0.012 : 0;
          out.push({
            t: (from + r * length + n.at) * unit + late,
            inst: track.inst,
            midi: midi + (track.transpose ?? 0),
            dur: n.dur * unit,
            vel: (track.vel ?? 0.5) * (0.88 + wobble(i, 2) * 0.12) * (ci ? 0.85 : 1),
            grace: n.grace,
          });
        });
      });
  });
  out.sort((a, b) => a.t - b.t);
  built.set(m, out);
  return out;
}

// the notes that start in [from, to) on the mood’s endless loop, t from its start
export function notesIn(m, from, to) {
  if (!(to > from)) return [];
  const L = loopSeconds(m);
  const events = eventsOf(m);
  const out = [];
  for (let k = Math.floor(from / L); k * L < to; k++) {
    const base = k * L;
    for (const e of events) {
      const t = base + e.t;
      if (t >= from && t < to) out.push({ ...e, t });
    }
  }
  return out;
}
