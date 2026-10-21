// The rhythm kind (the spec's "four lanes on the beat; the heads' meter must
// stay up to the end"): Get Schwifty's song, played at the mic. Notes come
// down four lanes on the song's eighths; a press in a lane hits the note
// there nearest the line, inside its window (great close, good a little
// off), and the heads like it; a press with nothing in reach is a wild
// swing, and a note let past is a miss, and the heads like those less. The
// heads' meter emptied is the loss; every note played with any of it left
// is the win. Pure and import-free, stepped at a fixed dt by ./Schwifty.jsx,
// one press a step; tested in Node.
//
//   newRhythm({ song, perks }) → game
//   stepRhythm(game, { hit }, dt) → game   hit: a lane pressed since the last step, or null
//     events: beat { n } | hit { id, lane, grade } | whiff { lane } | miss { id, lane } | won | lost
//   chartOf(song, { bpm, lead }) → [{ id, t, lane }]   the song's notes, in time
//   inView(game) → [{ id, lane, y }]   the notes coming down, y 0 at the top and 1 on the line
//
// `perks` (the shop's, P13) are taken and, until the shop decides what they
// do here, none is read.

export const TUNING = Object.freeze({
  bpm: 120, // the beat: half a second
  lead: 2, // seconds before the first note: four beats to count in
  fall: 1.6, // seconds a note takes down its lane to the line
  great: 0.06, // seconds either side of a note that's a great hit
  good: 0.13, // and that's a hit at all
  heads: 0.5, // the heads' meter at the start, of 1
  gain: { great: 0.05, good: 0.03 },
  cost: { miss: 0.08, whiff: 0.03 },
  low: 0.25, // the meter's warning
});
export const LANES = 4;

// the song: sixteen bars of eight eighths, a lane's digit or a rest; in, the
// beat with two lanes then four, the hook on the off-beats, and out
export const SONG = Object.freeze([
  '0...1...', '2...3...', '0...2...', '1...3...',
  '0.1.2.3.', '3.2.1.0.', '0.2.1.3.', '0.0.3.3.',
  '0.11.2..', '3.22.1..', '0.1.2.33', '3.2.1.00',
  '0.1.2.3.', '01..23..', '0.2.1.3.', '0...3...',
]);

export function chartOf(song = SONG, { bpm = TUNING.bpm, lead = TUNING.lead } = {}) {
  const eighth = 30 / bpm;
  const notes = [];
  song.forEach((bar, b) => [...bar].forEach((c, s) => c !== '.' && notes.push({ id: notes.length, t: lead + (b * 8 + s) * eighth, lane: Number(c) })));
  return notes;
}

// (the options may carry `perks`; none is read yet)
export function newRhythm({ song = SONG } = {}) {
  return { phase: 'play', t: 0, notes: chartOf(song).map((n) => ({ ...n, hit: null })), heads: TUNING.heads, streak: 0, hits: 0, misses: 0, beat: 0, last: null, events: [] };
}

export function stepRhythm(prev, { hit = null } = {}, dt = 1 / 60) {
  if (prev.phase !== 'play') return { ...prev, events: [] };
  const g = { ...prev, notes: [...prev.notes], events: [] };
  g.t += Math.min(dt, 0.1);
  // (kept to a millionth, so the sums of its gains and costs come to empty exactly: no crumb left to play on)
  const heads = (by) => (g.heads = Math.round(Math.min(1, Math.max(0, g.heads + by)) * 1e6) / 1e6);
  // the beats passed, to the song's last note
  const beat = 60 / TUNING.bpm;
  const end = g.notes.at(-1)?.t ?? 0;
  while ((g.beat + 1) * beat <= Math.min(g.t, end) + 1e-9) {
    g.beat += 1;
    g.events.push({ type: 'beat', n: g.beat });
  }
  // the press: the note in its lane nearest the line, in reach, or a wild swing
  if (hit != null) {
    let at = -1;
    g.notes.forEach((n, i) => {
      const off = Math.abs(n.t - g.t);
      if (n.lane === hit && !n.hit && off <= TUNING.good && (at < 0 || off < Math.abs(g.notes[at].t - g.t))) at = i;
    });
    if (at >= 0) {
      const grade = Math.abs(g.notes[at].t - g.t) <= TUNING.great ? 'great' : 'good';
      g.notes[at] = { ...g.notes[at], hit: grade };
      heads(TUNING.gain[grade]);
      Object.assign(g, { hits: g.hits + 1, streak: g.streak + 1, last: grade });
      g.events.push({ type: 'hit', id: g.notes[at].id, lane: hit, grade });
    } else {
      heads(-TUNING.cost.whiff);
      Object.assign(g, { streak: 0, last: 'whiff' });
      g.events.push({ type: 'whiff', lane: hit });
    }
  }
  // the notes let past
  g.notes.forEach((n, i) => {
    if (n.hit || g.t - n.t <= TUNING.good) return;
    g.notes[i] = { ...n, hit: 'miss' };
    heads(-TUNING.cost.miss);
    Object.assign(g, { misses: g.misses + 1, streak: 0, last: 'miss' });
    g.events.push({ type: 'miss', id: n.id, lane: n.lane });
  });
  if (g.heads <= 0) {
    g.phase = 'lost';
    g.events.push({ type: 'lost' });
  } else if (g.notes.every((n) => n.hit)) {
    g.phase = 'won';
    g.events.push({ type: 'won' });
  }
  return g;
}

export const inView = (g) => g.notes.filter((n) => !n.hit && n.t - g.t <= TUNING.fall && g.t - n.t <= TUNING.good).map((n) => ({ id: n.id, lane: n.lane, y: 1 - (n.t - g.t) / TUNING.fall }));
