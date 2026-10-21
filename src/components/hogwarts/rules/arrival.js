// The arrival’s clock (the design’s §4.2): the four parts (the station at
// night, the boats, the steps, the hall and the Sorting) as beats on one
// line of seconds, what is said at each, and the Sorting’s three questions
// holding the line until they are answered (or until the Hat, tired of
// waiting, reads the answer off you). Three to four minutes with no input.
// world/arrival.js draws it; this only counts. Pure.
//
//   BEATS: [{ id, part, at (s), lines: [{ at (s into the beat), who, key }] }]
//   ASK_AT, ASK_WAIT, END, SKIP_TO
//   rideAt(at) → the second a ride opened at `at` (a beat id, or a part) starts from
//   newRide({ at, seed }) → ride
//   stepRide(ride, dt) → { ride, events }
//   answerRide(ride, answer) → { ride, events }   (the visitor’s, to the question asked)
//   canSkip(ride, arrived) → Enter may skip to the steps (once the arrival has been seen)
//   skipRide(ride) → { ride, events }
//   noInput() → seconds the whole arrival takes when nobody touches anything
//
// Events: { type: 'beat', id, part } as a beat opens; { type: 'line', who,
// key } as someone speaks; { type: 'ask', q } as a question is put;
// { type: 'answer', q, a, by: 'you' | 'hat' }; { type: 'sort', answers } once
// the third is in (the module sorts, shows the house and starts the cheer);
// { type: 'end' }.

import { QUESTIONS, hatPicks } from './sorting';

export const BEATS = [
  { id: 'station', part: 'station', at: 0, lines: [] },
  { id: 'hagrid', part: 'station', at: 7, lines: [{ at: 1, who: 'hagrid', key: 'firsties' }] },
  { id: 'platform', part: 'station', at: 16, lines: [] },
  { id: 'path', part: 'station', at: 28, lines: [{ at: 5, who: 'hagrid', key: 'boats' }] },
  { id: 'pushoff', part: 'boats', at: 40, lines: [] },
  { id: 'glide', part: 'boats', at: 47, lines: [] },
  { id: 'castle', part: 'boats', at: 62, lines: [{ at: 8, who: 'hagrid', key: 'castle' }] },
  { id: 'squid', part: 'boats', at: 88, lines: [] },
  { id: 'cliff', part: 'boats', at: 98, lines: [{ at: 1, who: 'hagrid', key: 'ivy' }] },
  { id: 'boathouse', part: 'steps', at: 110, lines: [{ at: 1, who: 'hagrid', key: 'steps' }] },
  { id: 'stair', part: 'steps', at: 116, lines: [] },
  { id: 'doors', part: 'steps', at: 128, lines: [{ at: 1, who: 'mcgonagall', key: 'robes' }, { at: 6, who: 'mcgonagall', key: 'wait' }] },
  { id: 'hall', part: 'hall', at: 142, lines: [] },
  { id: 'stool', part: 'hall', at: 156, lines: [{ at: 1, who: 'mcgonagall', key: 'stool' }] },
  { id: 'hat', part: 'sorting', at: 160, lines: [{ at: 0.5, who: 'hat', key: 'greet' }] },
  { id: 'house', part: 'sorting', at: 166, lines: [] },
  { id: 'feast', part: 'sorting', at: 176, lines: [{ at: 1, who: 'dumbledore', key: 'welcome' }] },
];

export const ASK_AT = 165; // s: the Hat on, the first question put; the line holds here
export const ASK_WAIT = 16; // s of silence before the Hat answers for you
export const END = 186;
export const SKIP_TO = 'boathouse'; // Enter, after the first time: straight to the steps
export const PARTS = ['station', 'boats', 'steps', 'hall', 'sorting'];

const beat = (id) => BEATS.find((b) => b.id === id);

export function rideAt(at) {
  if (!at) return 0;
  const b = beat(at) ?? BEATS.find((x) => x.part === at);
  return b ? b.at : 0;
}

export function newRide({ at = null, seed = 1 } = {}) {
  return { t: rideAt(at), seed: seed >>> 0, answers: [], asking: null, silent: 0, hatSpoke: false, sorted: false, done: false, fresh: true };
}

// the beats and lines whose moment is in [from, to)
function crossed(from, to, opening) {
  const events = [];
  for (const b of BEATS) {
    if ((b.at >= from && b.at < to) || (opening && b.at === from)) events.push({ type: 'beat', id: b.id, part: b.part });
    for (const l of b.lines) {
      const at = b.at + l.at;
      if ((at >= from && at < to) || (opening && at === from)) events.push({ type: 'line', who: l.who, key: l.key });
    }
  }
  return events;
}

// the beat a ride opened mid-way is in, said once as it opens
function opened(ride) {
  const b = [...BEATS].reverse().find((x) => x.at <= ride.t);
  return b && b.at !== ride.t ? [{ type: 'beat', id: b.id, part: b.part }] : [];
}

function ask(ride, events) {
  if (ride.answers.length >= QUESTIONS.length) {
    events.push({ type: 'sort', answers: [...ride.answers] });
    return { ...ride, asking: null, silent: 0, sorted: true };
  }
  events.push({ type: 'ask', q: ride.answers.length });
  return { ...ride, asking: ride.answers.length, silent: 0 };
}

export function stepRide(ride, dt) {
  const events = [];
  if (ride.done) return { ride, events };
  let r = ride;
  if (r.fresh) {
    events.push(...opened(r));
    r = { ...r, fresh: false };
  }
  if (r.asking != null) {
    const silent = r.silent + dt;
    if (silent < ASK_WAIT) return { ride: { ...r, silent }, events };
    // (nothing said: the Hat reads it off you, and says so the first time)
    if (!r.hatSpoke) events.push({ type: 'line', who: 'hat', key: 'silent' });
    const a = hatPicks(r.seed, r.asking);
    events.push({ type: 'answer', q: r.asking, a, by: 'hat' });
    return { ride: ask({ ...r, hatSpoke: true, answers: [...r.answers, a] }, events), events };
  }
  const from = r.t;
  // (the line holds at the Hat until the three are answered)
  const holdAt = !r.sorted && from <= ASK_AT ? ASK_AT : Infinity;
  const to = Math.min(from + dt, holdAt, END);
  events.push(...crossed(from, to, ride.fresh && from === rideAt(null) && from === 0));
  r = { ...r, t: to };
  if (to === holdAt && !r.sorted && r.asking == null) r = ask(r, events);
  if (to >= END) {
    events.push({ type: 'end' });
    r = { ...r, done: true };
  }
  return { ride: r, events };
}

export function answerRide(ride, a) {
  const events = [];
  if (ride.asking == null || !Number.isInteger(a) || a < 0 || a >= QUESTIONS[ride.asking].answers.length) return { ride, events };
  events.push({ type: 'answer', q: ride.asking, a, by: 'you' });
  return { ride: ask({ ...ride, answers: [...ride.answers, a] }, events), events };
}

export const canSkip = (ride, arrived) => arrived >= 1 && !ride.done && ride.t < beat(SKIP_TO).at;

export function skipRide(ride) {
  const t = beat(SKIP_TO).at;
  const r = { ...ride, t, fresh: false };
  return { ride: r, events: crossed(t, t, true) };
}

export function noInput() {
  return ASK_AT + QUESTIONS.length * ASK_WAIT + (END - ASK_AT);
}
