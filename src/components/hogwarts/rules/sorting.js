// The Sorting (the design’s §4.2, beat four): three questions in the Hat’s
// voice, four answers each, every answer weighing toward the four houses.
// The site’s own words throughout. Pure: no three, no React.
//
//   HOUSES: { id: { name, colours: [main, second], founder, animal, ghost, head, room } }
//   HOUSE_IDS: the four, in the order the weights are written
//   QUESTIONS: [{ id, ask, answers: [{ text, weights: [g, s, r, h] }] }]
//   seedOf(answers) → a 32-bit seed: the same answers, the same seed
//   sort(answers, { seed }) → { house, second, scores, close, seed, said, password }
//     answers: three answer indices (0…3). The house with the most weight
//     wins; a tie goes to the house the first answer weighed most (the
//     first thing said to the Hat is the one it listens to); a tie that
//     survives that goes to the seed. `close`: the runner-up was within a
//     point (the Hat takes longer, and says so). `said`: what the Hat says
//     as it decides, then the house. `password`: the term’s first word for
//     the portrait or the wall (the Fat Lady, the Slytherin door).
//   hatPicks(seed, question) → an answer index: what the Hat reads off a
//     visitor who says nothing for long enough (the arrival never stalls)

export const HOUSE_IDS = ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff'];

export const HOUSES = {
  gryffindor: { name: 'Gryffindor', colours: ['#a6151b', '#e8b63c'], founder: 'Godric Gryffindor', animal: 'lion', ghost: 'Nearly Headless Nick', head: 'Professor McGonagall', room: 'gryffindor' },
  slytherin: { name: 'Slytherin', colours: ['#1f6b3e', '#c3c7c9'], founder: 'Salazar Slytherin', animal: 'serpent', ghost: 'the Bloody Baron', head: 'Professor Snape', room: 'slytherin' },
  ravenclaw: { name: 'Ravenclaw', colours: ['#1f3f8f', '#b08d57'], founder: 'Rowena Ravenclaw', animal: 'eagle', ghost: 'the Grey Lady', head: 'Professor Flitwick', room: 'ravenclaw' },
  hufflepuff: { name: 'Hufflepuff', colours: ['#e3b52a', '#2b2622'], founder: 'Helga Hufflepuff', animal: 'badger', ghost: 'the Fat Friar', head: 'Professor Sprout', room: 'hufflepuff' },
};

// weights: [Gryffindor, Slytherin, Ravenclaw, Hufflepuff]
export const QUESTIONS = [
  {
    id: 'door',
    ask: 'Somewhere in this castle is a door you will be told not to open. You find it. What then?',
    answers: [
      { text: 'Open it. You only learn what’s behind a door by going through.', weights: [3, 1, 0, 0] },
      { text: 'Find out who locked it, and why, before I touch the handle.', weights: [0, 1, 3, 0] },
      { text: 'Leave it for now, and remember exactly where it is.', weights: [0, 3, 1, 0] },
      { text: 'Leave it. Whoever locked it probably had a good reason.', weights: [0, 0, 1, 3] },
    ],
  },
  {
    id: 'friend',
    ask: 'A friend of yours has done something foolish, and a teacher wants to know who. Well?',
    answers: [
      { text: 'Say it was me. I can stand to lose a few points.', weights: [3, 0, 0, 2] },
      { text: 'Say nothing. It isn’t mine to tell.', weights: [1, 1, 0, 2] },
      { text: 'Tell the truth, gently, and stand next to them while I do.', weights: [1, 0, 3, 1] },
      { text: 'Make sure it never comes back to either of us.', weights: [0, 3, 1, 0] },
    ],
  },
  {
    id: 'called',
    ask: 'Last one, and take your time over it. Which would you hate most to be called?',
    answers: [
      { text: 'A coward.', weights: [3, 0, 0, 1] },
      { text: 'Ordinary.', weights: [1, 3, 1, 0] },
      { text: 'A fool.', weights: [0, 1, 3, 0] },
      { text: 'Unkind.', weights: [0, 0, 1, 3] },
    ],
  },
];

// What the Hat says, deciding: a thought on the winner, a word on the
// runner-up when it was close, and the house, called out to the hall
const THOUGHT = {
  gryffindor: 'Nerve enough to fill a tower, and not a lot of patience for the stairs.',
  slytherin: 'You know what you want, and you know the long way round to it.',
  ravenclaw: 'A mind that won’t sit still, even under me. I can feel it rummaging.',
  hufflepuff: 'Steady, and fair, and the sort who notices who’s been left out.',
};
const NEARLY = {
  gryffindor: 'There’s a lion in there too, mind. Don’t let it out at the wrong moment.',
  slytherin: 'I could have made something sharper of you. Remember that I didn’t.',
  ravenclaw: 'I nearly sent you up the tower with the clever ones. Nearly.',
  hufflepuff: 'Half of you wanted the kitchens, I think. It’s the warm half.',
};
const CALL = {
  gryffindor: 'Better be… Gryffindor.',
  slytherin: 'Better be… Slytherin.',
  ravenclaw: 'Better be… Ravenclaw.',
  hufflepuff: 'Better be… Hufflepuff.',
};

// the term’s first password: given at the Sorting, said to the portrait
export const PASSWORDS = ['Toffee comet', 'Lantern moth', 'Crumpet thunder', 'Marmalade dragon', 'Silver thimble', 'Bramble jelly', 'Owl biscuits', 'Pickled starlight'];

// FNV-1a over the answers: a seed that is the answers, nothing else
export function seedOf(answers) {
  let h = 0x811c9dc5;
  for (const c of `sorting:${answers.join('-')}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const valid = (answers) => Array.isArray(answers) && answers.length === QUESTIONS.length && answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < QUESTIONS[i].answers.length);

export function sort(answers, { seed = null } = {}) {
  if (!valid(answers)) throw new Error('the Hat wants three answers, each 0 to 3');
  const s = (seed ?? seedOf(answers)) >>> 0;
  const scores = [0, 0, 0, 0];
  answers.forEach((a, q) => QUESTIONS[q].answers[a].weights.forEach((w, h) => (scores[h] += w)));
  const top = Math.max(...scores);
  let tied = HOUSE_IDS.map((_, i) => i).filter((i) => scores[i] === top);
  // (the first answer breaks a tie: what was said first is what the Hat heard loudest)
  if (tied.length > 1) {
    const first = QUESTIONS[0].answers[answers[0]].weights;
    const best = Math.max(...tied.map((i) => first[i]));
    tied = tied.filter((i) => first[i] === best);
  }
  const win = tied.length > 1 ? tied[s % tied.length] : tied[0];
  const rest = HOUSE_IDS.map((_, i) => i).filter((i) => i !== win);
  const runner = rest.reduce((a, b) => (scores[b] > scores[a] ? b : a), rest[0]);
  const close = scores[win] - scores[runner] <= 1;
  const house = HOUSE_IDS[win];
  const second = HOUSE_IDS[runner];
  const said = [THOUGHT[house], ...(close ? [NEARLY[second]] : []), CALL[house]];
  return { house, second, scores: Object.fromEntries(HOUSE_IDS.map((id, i) => [id, scores[i]])), close, seed: s, said, password: PASSWORDS[(s >>> 3) % PASSWORDS.length] };
}

export function hatPicks(seed, question) {
  const n = QUESTIONS[question]?.answers.length ?? 4;
  return (((seed >>> (question * 5)) ^ Math.imul(question + 1, 0x9e3779b1)) >>> 0) % n;
}

export function houseColours(house) {
  const h = HOUSES[house];
  return h ? { '--hp-house': h.colours[0], '--hp-house-2': h.colours[1] } : {};
}

// how each common room is got into, as the card after the Sorting says it
// (`{password}`: the Sorting’s word)
export const ENTRY = {
  gryffindor: 'The Fat Lady, seventh floor. The password is “{password}”.',
  slytherin: 'A bare wall in the dungeons. Say “{password}” to it.',
  ravenclaw: 'The west tower, fifth floor. No password: the knocker asks a riddle.',
  hufflepuff: 'The barrels by the kitchens. Tap the second from the bottom, in the rhythm of the house’s name.',
};
export const entryFor = (house, password) => (ENTRY[house] ?? '').replace('{password}', password ?? '');
