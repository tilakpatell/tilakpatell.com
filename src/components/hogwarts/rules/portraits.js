// The portraits on the Grand Staircase’s walls (the design’s §4.4): a dozen
// named subjects with a line each in the site’s own words, said as you
// pass; one of them (Sir Cadogan, who never could keep still) leaves his
// frame for another when nobody is looking; the Fat Lady at the top, who
// wants the password from the Sorting and sulks after three wrong tries;
// and the trick step, which takes your leg to the knee once a visit. Pure.
//
//   SUBJECTS: [{ id, name, line, kind, palette: [ground, figure, accent, light] }]
//   FRAMES: frame ids, in the order the walls hang them (the room places them)
//   hangs() → { frameId: subjectId | null }: who is where at the start
//   passing(state, near, now) → { state, said: { id, name, line } | null }
//     near: [{ frame, d }] frames within reach, nearest first; a subject
//     speaks once, then keeps quiet for QUIET seconds
//   wander(state, { seen, dt }) → { state, moved: { from, to } | null }:
//     the wanderer goes once his frame has been out of sight for UNSEEN
//     seconds, to the next empty frame along the walls that is also out of sight
//   fatLady(state, word, password, now) → { state, open, line }
//   trick(state, visit) → { state, sink }: the first step on it a visit sinks

export const QUIET = 90; // s a portrait keeps quiet after speaking to you
export const REACH = 3.2; // m: close enough for a portrait to notice you
export const UNSEEN = 1.2; // s out of sight before the wanderer goes
export const SULK = 30; // s the Fat Lady will not speak to you
export const WANDERER = 'cadogan';

export const SUBJECTS = [
  { id: 'cadogan', name: 'Sir Cadogan', kind: 'rider', palette: ['#3a4a3a', '#8a8f96', '#b02a2a', '#e8d8a8'], line: 'Halt, knave. Draw, and let us see what you are made of. No? Then pass, and be ashamed.' },
  { id: 'violet', name: 'Violet', kind: 'bust', palette: ['#4a2a3a', '#d8b0a0', '#7a3a8a', '#f0d8c0'], line: 'Have you seen the Fat Lady? She was in the monks’ picture all night, and she will deny it.' },
  { id: 'monks', name: 'The Seven Monks at Supper', kind: 'group', palette: ['#2a1e14', '#6a4a2a', '#a0302a', '#f0b060'], line: 'We drink to whoever is passing. Your health. And yours. And yours, again.' },
  { id: 'quill', name: 'Hesper Quill, librarian', kind: 'bust', palette: ['#2a2a3a', '#c8b898', '#2a4a6a', '#e0d8b0'], line: 'The library is on the fourth floor. Mind the third shelf from the window. It bites.' },
  { id: 'thwaite', name: 'Ogmund Thwaite, duellist', kind: 'standing', palette: ['#1e2a2a', '#b8a888', '#5a6a8a', '#d8e0e8'], line: 'Feet apart, wand up, and never bow lower than the other fellow.' },
  { id: 'teague', name: 'Old Ma Teague and her teapot', kind: 'bust', palette: ['#3a2a1a', '#d0a888', '#6a8a5a', '#f8e0b0'], line: 'Sit down, dear, you look frozen. Oh. You can’t, can you. You’re out there.' },
  { id: 'ash', name: 'Merlinda Ash, seer', kind: 'bust', palette: ['#1a1a2e', '#a898c8', '#c8a040', '#d0c8f0'], line: 'I have seen your future. It has a great many stairs in it.' },
  { id: 'gorse', name: 'Wilhelmina Gorse, who painted herself', kind: 'bust', palette: ['#4a3a2a', '#e0b898', '#3a6a4a', '#f8e8c8'], line: 'I painted this myself. The nose took eleven years, and I am still not sure about it.' },
  { id: 'tufts', name: 'The brothers Tuft', kind: 'group', palette: ['#2a3a2a', '#c0a080', '#8a5a2a', '#e8d0a0'], line: 'We are not arguing. We are discussing. Loudly. We have been discussing since 1612.' },
  { id: 'spaniel', name: 'Lord Bertram’s spaniel', kind: 'beast', palette: ['#3a2a2a', '#a07040', '#d8c0a0', '#f0e0c0'], line: 'Wuff. He says it once a term, to a first year, with great dignity.' },
  { id: 'sleeper', name: 'The boy who slept through Astronomy', kind: 'sleeper', palette: ['#141a2e', '#b8a890', '#3a4a8a', '#c8d0f0'], line: 'Wake me at midnight. Not before. And not after, either.' },
  { id: 'fenwick', name: 'Archibald Fenwick, headmaster for a fortnight', kind: 'standing', palette: ['#2e1a1a', '#c8b090', '#6a2a6a', '#f0d8a8'], line: 'I was headmaster for a fortnight. The moving stairs were my idea. I do apologise.' },
];

// the walls’ frames: two a landing below the top, the top’s own (the Fat
// Lady hangs apart, on her door), and a few spare for the wanderer to visit
export const FRAMES = ['0w-a', '0e-a', '1w-a', '1e-a', '2w-a', '2e-a', '3w-a', '3e-a', '4w-a', '4e-a', '5w-a', '5e-a', '6w-a', '6e-a', '1w-b', '3e-b', '5w-b'];

export function hangs() {
  const at = Object.fromEntries(FRAMES.map((f) => [f, null]));
  SUBJECTS.forEach((s, i) => (at[FRAMES[i]] = s.id));
  return { at, said: {}, unseen: {}, fat: { tries: 0, sulkUntil: -Infinity }, sunk: null };
}

const subject = (id) => SUBJECTS.find((s) => s.id === id);

export function passing(state, near, now) {
  for (const { frame, d } of near) {
    if (d > REACH) break;
    const id = state.at[frame];
    if (!id) continue;
    const last = state.said[id];
    if (last != null && now - last < QUIET) continue;
    const s = subject(id);
    return { state: { ...state, said: { ...state.said, [id]: now } }, said: { id, name: s.name, line: s.line } };
  }
  return { state, said: null };
}

export function wander(state, { seen, dt }) {
  const from = Object.keys(state.at).find((f) => state.at[f] === WANDERER);
  if (!from) return { state, moved: null };
  const unseen = { ...state.unseen };
  for (const f of FRAMES) unseen[f] = seen.has(f) ? 0 : (unseen[f] ?? 0) + dt;
  if (unseen[from] < UNSEEN) return { state: { ...state, unseen }, moved: null };
  // (along the walls from where he is: the next empty frame nobody is looking at)
  const i = FRAMES.indexOf(from);
  for (let k = 1; k < FRAMES.length; k++) {
    const to = FRAMES[(i + k) % FRAMES.length];
    if (state.at[to] || seen.has(to)) continue;
    return { state: { ...state, unseen: { ...unseen, [to]: 0 }, at: { ...state.at, [from]: null, [to]: WANDERER } }, moved: { from, to } };
  }
  return { state: { ...state, unseen }, moved: null };
}

// what she says; the password as given at the Sorting, however it is typed
export const FAT_LADY = {
  name: 'The Fat Lady',
  ask: 'Password?',
  right: 'Quite right. In you go, and wipe your feet.',
  wrong: ['No. Try again, and think harder this time.', 'That is not it either, dear.'],
  sulk: 'Three times. I am not speaking to you. Go and sit on a stair and think about it.',
  sulking: 'She has turned her back to you and is humming, loudly, to make the point.',
  back: 'Oh, it’s you. Well? Password?',
};

const plain = (w) =>
  String(w ?? '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function fatLady(state, word, password, now) {
  const fat = state.fat;
  if (now < fat.sulkUntil) return { state, open: false, line: FAT_LADY.sulking };
  const was = fat.sulkUntil > -Infinity && fat.tries >= 3;
  if (plain(word) && plain(word) === plain(password)) return { state: { ...state, fat: { tries: 0, sulkUntil: -Infinity } }, open: true, line: FAT_LADY.right };
  const tries = (was ? 0 : fat.tries) + 1;
  if (tries >= 3) return { state: { ...state, fat: { tries, sulkUntil: now + SULK } }, open: false, line: FAT_LADY.sulk };
  return { state: { ...state, fat: { tries, sulkUntil: -Infinity } }, open: false, line: FAT_LADY.wrong[tries - 1] };
}

export function trick(state, visit) {
  if (state.sunk === visit) return { state, sink: false };
  return { state: { ...state, sunk: visit }, sink: true };
}
