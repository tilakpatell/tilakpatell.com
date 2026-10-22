// The post (the design’s §4.4, the Owlery): a letter of one line, typed,
// tied to an owl’s leg and sent; and the next morning (after a night in your
// own bed) a reply pinned to your common room’s board, in the site’s own
// words, answering what you wrote as well as a letter from home can. Kept in
// the world’s one save under `post`. Pure.
//
//   REPLIES: [{ when: [words], from, text }] the last of them answers anything
//   replyFor(text) → { from, text }   (the same letter, the same reply)
//   send(save, text, now) → the save with the letter gone: post { text, sent, reply, read: false }
//   sleep(save) → the save the morning after: a letter sent is answered (post.read true)
//   noticeOf(save) → { title, text } for the board once answered, or null
//   waiting(save) → a letter is out and not yet answered

const LETTER = 200; // characters a line may be

export const REPLIES = [
  { when: ['sorted', 'house', 'gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff', 'hat'], from: 'home', text: 'A house! We knew you would be in a good one. Write and tell us what the common room is like, and whether the beds are warm.' },
  { when: ['miss', 'lonely', 'homesick', 'sad'], from: 'home', text: 'We miss you too, every day, at every meal. Christmas is not so very far. Find one friend and sit with them at breakfast.' },
  { when: ['food', 'feast', 'pudding', 'dinner', 'breakfast', 'pie', 'treacle'], from: 'home', text: 'It sounds as though they feed you better than we do. Eat a vegetable now and then, for us.' },
  { when: ['quidditch', 'broom', 'fly', 'flying', 'snitch'], from: 'your cousin', text: 'You got on a broom? Do not fall off it. Or if you do, fall off it somewhere soft, and write and tell me everything.' },
  { when: ['snape', 'potion', 'potions', 'cauldron'], from: 'home', text: 'Your Potions master sounds very strict. Strict teachers are the ones you remember. Wear old clothes to his lessons.' },
  { when: ['stairs', 'staircase', 'lost'], from: 'your gran', text: 'Moving stairs, in my day, were thought very modern. Leave early for everything, and always carry a biscuit.' },
  { when: ['ghost', 'ghosts', 'peeves', 'nick'], from: 'your cousin', text: 'Real ghosts! Ask one what it is like. Then write it down, because nobody here will believe me.' },
  { when: [], from: 'home', text: 'Your owl found us at supper and ate half a sausage. We read your letter twice. Write again soon, and longer.' },
];

const words = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z]+/)
    .filter(Boolean);

export function replyFor(text) {
  const said = new Set(words(text));
  const r = REPLIES.find((x) => x.when.some((w) => said.has(w))) ?? REPLIES.at(-1);
  return { from: r.from, text: r.text };
}

const isObject = (o) => Boolean(o) && typeof o === 'object' && !Array.isArray(o);

export function send(save, text, now) {
  const line = String(text ?? '').trim().slice(0, LETTER);
  if (!line) return save;
  return { ...(isObject(save) ? save : {}), post: { text: line, sent: now, reply: replyFor(line), read: false } };
}

export function sleep(save) {
  if (!isObject(save) || !save.post || save.post.read) return save;
  return { ...save, post: { ...save.post, read: true } };
}

export const waiting = (save) => Boolean(isObject(save) && save.post && !save.post.read);

export function noticeOf(save) {
  if (!isObject(save) || !save.post?.read) return null;
  const { from, text } = save.post.reply ?? replyFor(save.post.text);
  return { title: `By owl, from ${from}`, text };
}
