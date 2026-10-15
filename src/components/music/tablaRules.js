// The tabla's rules, apart from the sound: which recorded stroke plays each
// bol, how the two drums are tuned to Sa, how a taal's theka falls in time at
// each laya, and how a tihai lands on sam. Nothing here touches Web Audio, so
// it is all tested (tablaRules.test.js).

// ── The strokes ────────────────────────────────────────────────────────────
// Each stroke is one or more takes in the sprite (./tablaSprite.js), played in
// turn so a repeated bol never sounds machine-made. `ring` strokes sound until
// something stops them; `closed` ones stop what is ringing on their drum, the
// way a hand on the skin does.
export const STROKES = {
  // dayan (right, tuned to Sa)
  na: { drum: 'dayan', takes: ['na'], gain: 0.92, ring: true }, // the kinar, the rim
  ta: { drum: 'dayan', takes: ['tas2', 'tas3', 'tas1'], gain: 0.9, ring: true },
  tin: { drum: 'dayan', takes: ['na_o'], gain: 0.95, ring: true }, // the sur, between rim and black
  tun: { drum: 'dayan', takes: ['tun1', 'tun2', 'tun3'], gain: 1.0, ring: true }, // the syahi, open
  ti: { drum: 'dayan', takes: ['te1', 'te2'], gain: 0.9, closed: true }, // the syahi, closed
  te: { drum: 'dayan', takes: ['te_m'], gain: 1.12, closed: true },
  ra: { drum: 'dayan', takes: ['re'], gain: 1.15, closed: true },
  tak: { drum: 'dayan', takes: ['na_s', 'te_ne'], gain: 0.92, closed: true }, // a short, damped Ta
  // bayan (left, the bass)
  ge: { drum: 'bayan', takes: ['ghe5', 'ghe3', 'ghe6', 'ghe2', 'ghe7'], gain: 1.0, ring: true },
  ga: { drum: 'bayan', takes: ['ghe1'], gain: 0.9, ring: true }, // a short Ge, for quick bols
  gumki: { drum: 'bayan', takes: ['ghe4', 'ghe8'], gain: 0.95, ring: true }, // the heel of the hand lifts the pitch
  ke: { drum: 'bayan', takes: ['ke1', 'ke2', 'ke3'], gain: 1.05, closed: true }, // flat palm
};

// The bols, as strokes on the two drums (dayan first).
export const BOLS = {
  Na: ['na'],
  Ta: ['ta'],
  Tin: ['tin'],
  Tun: ['tun'],
  Tu: ['tun'],
  Ti: ['ti'],
  Te: ['te'],
  Tit: ['ti'],
  Ra: ['ra'],
  Re: ['ra'],
  Ka: ['ke'],
  Ke: ['ke'],
  Ki: ['ke'],
  Kat: ['ke'],
  Ge: ['ge'],
  Ghe: ['ge'],
  Ga: ['ga'],
  Di: ['ga'],
  Dha: ['na', 'ge'],
  Dhin: ['tin', 'ge'],
  Dhi: ['tin', 'ge'],
  Dhet: ['te', 'ge'],
  Dhe: ['te', 'ge'],
  Tak: ['tak'],
};

// How a bol is written: Tak is the Ta that closes TiRaKiTa, short and damped.
export const bolLabel = (bol) => (bol === 'Tak' ? 'Ta' : bol);
export const isBol = (bol) => bol === '-' || Boolean(BOLS[bol]);

// Which take to play next for a stroke, given how many times it has played.
export const takeFor = (stroke, count) => {
  const s = STROKES[stroke];
  return s ? s.takes[count % s.takes.length] : null;
};

// ── Tuning ─────────────────────────────────────────────────────────────────
// The recordings' own pitches: the dayan rings at 315 Hz (its tun is a clean
// 315; na and ta sound the drum's 2nd and 3rd harmonics over it), and the
// bayan settles at 92 Hz after the stroke.
export const DAYAN_REF = 315;
export const BAYAN_REF = 92;

const semis = (a, b) => 12 * Math.log2(a / b);

// The dayan sounds Sa, in whichever octave sits closest to the drum as recorded
// (so the retuning stays gentle): between about 220 and 470 Hz.
export function dayanTarget(saHz) {
  let best = saHz;
  for (let k = -3; k <= 3; k++) {
    const f = saHz * 2 ** k;
    if (f < 220 || f > 470) continue;
    if (Math.abs(semis(f, DAYAN_REF)) < Math.abs(semis(best, DAYAN_REF)) || best < 220 || best > 470) best = f;
  }
  return best;
}

// The bayan isn't tuned as exactly, but a player sets it near Sa or Pa, low:
// whichever of those lies closest to the drum as recorded.
export function bayanTarget(saHz) {
  let best = BAYAN_REF;
  let bestDist = Infinity;
  for (const r of [1, 3 / 2]) {
    for (let k = -4; k <= 1; k++) {
      const f = saHz * r * 2 ** k;
      const d = Math.abs(semis(f, BAYAN_REF));
      if (d < bestDist) {
        best = f;
        bestDist = d;
      }
    }
  }
  return best;
}

// The playback rate that retunes a stroke from its recorded pitch.
export const rateFor = (drum, saHz) => (drum === 'dayan' ? dayanTarget(saHz) / DAYAN_REF : bayanTarget(saHz) / BAYAN_REF);

// ── Taals ──────────────────────────────────────────────────────────────────
// The beats (matras), how they group into sections (vibhag), the clap marks
// (X is sam, the first beat; 0 is khali, the empty wave), and the theka, the
// basic pattern of bols. A beat can hold two or four quick bols.
export const TAALS = {
  teentaal: { name: 'Teentaal', vibhag: [4, 4, 4, 4], marks: ['X', '2', '0', '3'], bpm: 150, theka: ['Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Dhin', 'Dhin', 'Dha', 'Dha', 'Tin', 'Tin', 'Ta', 'Ta', 'Dhin', 'Dhin', 'Dha'] },
  jhaptaal: { name: 'Jhaptaal', vibhag: [2, 3, 2, 3], marks: ['X', '2', '0', '3'], bpm: 130, theka: ['Dhi', 'Na', 'Dhi', 'Dhi', 'Na', 'Ti', 'Na', 'Dhi', 'Dhi', 'Na'] },
  rupak: { name: 'Rupak', vibhag: [3, 2, 2], marks: ['0', '1', '2'], bpm: 120, theka: ['Tin', 'Tin', 'Na', 'Dhi', 'Na', 'Dhi', 'Na'] },
  ektaal: { name: 'Ektaal', vibhag: [2, 2, 2, 2, 2, 2], marks: ['X', '0', '2', '0', '3', '4'], bpm: 80, theka: ['Dhin', 'Dhin', ['Dha', 'Ge'], ['Ti', 'Ra', 'Ki', 'Tak'], 'Tu', 'Na', 'Kat', 'Ta', ['Dha', 'Ge'], ['Ti', 'Ra', 'Ki', 'Tak'], 'Dhin', 'Na'] },
  keherwa: { name: 'Keherwa', vibhag: [4, 4], marks: ['X', '0'], bpm: 130, theka: ['Dha', 'Ge', 'Na', 'Ti', 'Na', 'Ke', 'Dhi', 'Na'] },
  dadra: { name: 'Dadra', vibhag: [3, 3], marks: ['X', '0'], bpm: 140, theka: ['Dha', 'Dhi', 'Na', 'Dha', 'Ti', 'Na'] },
};

// Laya: the theka at its own speed (thah), twice as many bols to a beat
// (dugun) or four times (chaugun). The beat stays where it is.
export const LAYA = { thah: 1, dugun: 2, chaugun: 4 };

// The bols of one beat at a laya, as [offset in beats, bol] pairs. At dugun,
// beat i holds theka cells 2i and 2i+1 (wrapping), each in half a beat.
export function beatBols(taal, beat, laya = 1) {
  const n = taal.theka.length;
  const out = [];
  for (let j = 0; j < laya; j++) {
    const cell = taal.theka[(beat * laya + j) % n];
    const bols = Array.isArray(cell) ? cell : [cell];
    bols.forEach((b, k) => out.push([(j + k / bols.length) / laya, b]));
  }
  return out;
}

// How hard each beat is played: sam strongest, the first beat of each vibhag
// a little stronger, the rest even.
export function accent(taal, beat) {
  if (beat === 0) return 1;
  let at = 0;
  for (const len of taal.vibhag) {
    if (beat === at) return 0.92;
    at += len;
  }
  return 0.82;
}

// ── Tihai ──────────────────────────────────────────────────────────────────
// A phrase played three times with a rest between, timed so its very last
// stroke falls on sam. Returned as [beat, bol] pairs counted from the start of
// the cycle it begins in; the last one is at `beats`, the next cycle's sam.
const TIHAI_PHRASE = ['Dha', '-', 'Ti', 'Ra', 'Ki', 'Tak', 'Dha'];

export function planTihai(beats, phrase = TIHAI_PHRASE, gap = 1) {
  const per = phrase.length * 3 + gap * 2; // in pulses
  // the fewest pulses to a beat that lets the whole tihai fit in one cycle
  let sub = 1;
  while (per - 1 > beats * sub) sub++;
  const step = 1 / sub;
  const start = beats - (per - 1) * step;
  const out = [];
  let p = 0;
  for (let r = 0; r < 3; r++) {
    for (const b of phrase) {
      if (b !== '-') out.push([start + p * step, b]);
      p++;
    }
    if (r < 2) p += gap;
  }
  return { start, sub, events: out };
}

// ── Humanising ─────────────────────────────────────────────────────────────
// A seeded random source, so a theka can be replayed exactly in the tests.
export function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A real hand: a few milliseconds early or late, a little louder or softer,
// a few cents sharp or flat as the skin's tension shifts.
export function humanize(rand, { time = 0.004, vel = 0.06, cents = 6 } = {}) {
  return { dt: (rand() * 2 - 1) * time, vel: 1 + (rand() * 2 - 1) * vel, cents: (rand() * 2 - 1) * cents };
}

// ── The sprite ─────────────────────────────────────────────────────────────
// Where a stroke really starts in the decoded sprite: the first sample within
// 40 ms of where the manifest says, loud enough to be the attack. Decoders
// differ by a few milliseconds in how they trim an MP3's start; this finds it.
export function alignStart(data, sampleRate, at, dur) {
  const a = Math.max(0, Math.floor((at - 0.04) * sampleRate));
  const b = Math.min(data.length, Math.ceil((at + Math.min(dur, 0.06)) * sampleRate));
  let peak = 0;
  for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < 1e-4) return at;
  const thr = peak * 0.02;
  for (let i = a; i < b; i++) if (Math.abs(data[i]) > thr) return Math.max(0, i / sampleRate - 0.0015);
  return at;
}
