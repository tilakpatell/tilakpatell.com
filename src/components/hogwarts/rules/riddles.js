// The Ravenclaw door has no password: a bronze eagle knocker asks a riddle
// (the design’s §4.4), and it lets in whoever reasons at it. Twelve riddles
// in the site’s own words. The right answer, however it is put (“a clock”,
// “is it the clock?”), is “Well reasoned”; a wrong one is “Hm. Think
// again”, and on the third try the eagle lets you in anyway: it was the
// thinking it wanted. Pure.
//
//   RIDDLES: [{ id, ask, answers: [words that count] }]
//   riddleFor(seed) → a riddle (the same seed, the same riddle)
//   knock(riddle) → { riddle: id, tries: 0, open: false }
//   answer(state, text) → { state, ok, open, line }

export const RIDDLES = [
  { id: 'clock', ask: 'I have a face that is never washed and hands that never wave, and the castle runs late without me. What am I?', answers: ['clock', 'watch'] },
  { id: 'dark', ask: 'Every night I fill the castle from the dungeons to the towers, and the more of me there is, the less of it you see. What am I?', answers: ['darkness', 'dark', 'night', 'shadow', 'shadows'] },
  { id: 'banister', ask: 'I climb every staircase in this castle and come down them all again, and I have never taken a single step. What am I?', answers: ['banister', 'bannister', 'handrail', 'rail', 'railing', 'carpet', 'balustrade'] },
  { id: 'fire', ask: 'Feed me and I grow; give me a drink and I die. Every common room keeps one of me in a cage of iron. What am I?', answers: ['fire', 'flame', 'flames', 'fireplace', 'hearth'] },
  { id: 'light', ask: 'I can fill the Great Hall to its rafters and still weigh nothing at all. What am I?', answers: ['light', 'candlelight', 'air', 'sound', 'noise', 'smell', 'music', 'laughter'] },
  { id: 'tomorrow', ask: 'I am always on my way and I never once arrive, and the Astronomy Tower watches for me every night. What am I?', answers: ['tomorrow', 'morning', 'dawn', 'sunrise', 'the future', 'future', 'day'] },
  { id: 'letter', ask: 'An owl carries me sealed, and when you open me I might scold you, praise you or ask you to tea. What am I?', answers: ['letter', 'howler', 'envelope', 'post', 'mail', 'note'] },
  { id: 'jumper', ask: 'I have a neck and no head, two arms and no hands, and somebody knits a new letter onto me every Christmas. What am I?', answers: ['jumper', 'sweater', 'jersey', 'pullover', 'cardigan'] },
  { id: 'river', ask: 'I have a bed I never sleep in and a mouth I never speak with, and I run into the Black Lake all year round. What am I?', answers: ['river', 'stream', 'burn', 'brook', 'beck', 'creek'] },
  { id: 'sponge', ask: 'I am more hole than anything else, and still I hold water. What am I?', answers: ['sponge', 'net', 'sieve'] },
  { id: 'book', ask: 'I keep every word you trust me with, and say them all again to anyone at all who opens me. What am I?', answers: ['book', 'diary', 'journal', 'notebook', 'letter'] },
  { id: 'echo', ask: 'I only ever speak after you, I answer without being asked, and the dungeons are full of me. What am I?', answers: ['echo', 'echoes', 'parrot'] },
];

export const KNOCKER = {
  name: 'The eagle knocker',
  right: 'Well reasoned.',
  wrong: 'Hm. Think again.',
  third: 'Not quite. But you thought about it, and that is the door’s whole point. Enter.',
};

const ARTICLES = new Set(['a', 'an', 'the', 'is', 'it', 'its', 'you', 'are', 'i', 'think', 'maybe', 'perhaps', 'what', 'about', 'some', 'of', 'course', 'surely']);
const words = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !ARTICLES.has(w));

// right if the answer’s own words hold one that counts (a two-word answer as a pair)
export function rightAnswer(riddle, text) {
  const said = words(text);
  const joined = ` ${said.join(' ')} `;
  return riddle.answers.some((a) => joined.includes(` ${words(a).join(' ')} `));
}

export const riddleFor = (seed) => RIDDLES[(seed >>> 0) % RIDDLES.length];

export const knock = (riddle) => ({ riddle: riddle.id, tries: 0, open: false });

export function answer(state, text) {
  if (state.open) return { state, ok: true, open: true, line: KNOCKER.right };
  const riddle = RIDDLES.find((r) => r.id === state.riddle);
  const tries = state.tries + 1;
  if (riddle && rightAnswer(riddle, text)) return { state: { ...state, tries, open: true }, ok: true, open: true, line: KNOCKER.right };
  if (tries >= 3) return { state: { ...state, tries, open: true }, ok: false, open: true, line: KNOCKER.third };
  return { state: { ...state, tries }, ok: false, open: false, line: KNOCKER.wrong };
}
