// What the castle’s people say, in the site’s own words (the design’s §5:
// the Hat, Snape and Peeves each have a voice, written here before the rest
// so it holds). Said in the kit’s Bubble over the speaker’s head, or as the
// arrival’s subtitles. Pure.
//
//   NAMES: { who: the name shown over a line }
//   LINES: { who: { key: text } }
//   say(who, key) → { who, name, text }  (throws on a line not written: a
//     typo in a beat is found by its test, not by a silent bubble)
//   linesOf(who) → [text]
//
// The voices, so the next line written keeps them:
//   the Hat: old, vain of its judgement, thinks aloud; a little theatrical.
//   McGonagall: brisk, exact, kind underneath and never out loud.
//   Hagrid: warm and broad, the dropped letters as he says them.
//   Snape: cold, few words, every one a small cut; never shouts.
//   Peeves: sing-song and spiteful, a poltergeist enjoying himself.

export const NAMES = {
  hat: 'The Sorting Hat',
  mcgonagall: 'Professor McGonagall',
  hagrid: 'Hagrid',
  snape: 'Professor Snape',
  peeves: 'Peeves',
  dumbledore: 'Professor Dumbledore',
  flitwick: 'Professor Flitwick',
  pince: 'Madam Pince',
  filch: 'Mr Filch',
  nick: 'Nearly Headless Nick',
  friar: 'The Fat Friar',
  greylady: 'The Grey Lady',
  baron: 'The Bloody Baron',
  elf: 'A house-elf',
  prefect: 'A prefect',
};

export const LINES = {
  hat: {
    greet: 'Hmm. I have sat on a thousand heads and never once found an empty one. Let us see what is in yours.',
    fidget: 'Do stop fidgeting. I cannot think with you fidgeting, and I have been thinking for a very long time.',
    silent: 'Nothing to say? Then I shall read it off you. I usually do.',
    again: 'Back again? I remember every head. Yours was warm.',
  },
  mcgonagall: {
    robes: 'Straighten your robes. The whole school is about to look at you, and the whole school remembers.',
    wait: 'Wait here. When you go through, you will be sorted. Your house is your family here, and your family can lose points as well as win them.',
    stool: 'When I call your name, come forward and sit on the stool. The Hat does the rest.',
    welcome: 'Well. Go on, then. Your table is waiting, and so is the pudding.',
  },
  hagrid: {
    firsties: 'Firs’ years! This way, an’ stick together. Lose sight o’ the lantern an’ yeh’ve lost me.',
    boats: 'Four to a boat, an’ sit in the middle. Mind the step. She rocks, but she’s never lost one yet.',
    castle: 'There she is. Never gets old, that. Not once in all the years.',
    ivy: 'Duck yer heads under the ivy. It’s low under the cliff, an’ it’s cold.',
    steps: 'Up yeh go. Professor McGonagall’ll be at the top, an’ she don’t like waitin’.',
  },
  snape: {
    soup: 'Your cauldron is not a soup pot. Stop stirring it as though it were.',
    see: 'I did not ask what the book says. I asked what you see.',
    points: 'Five points. You know why. If you do not, that is another five.',
  },
  peeves: {
    new: 'Oooh, a new one. Up the stairs and down the stairs, and which step bites? Guess.',
    sing: 'I saw you. I saw you, and I am going to sing about it all the way to Filch.',
    stairs: 'Wrong way, wrong way, the stair went away. Ha.',
  },
  dumbledore: {
    welcome: 'Welcome. A new year, a full hall and, I am told, a great deal of pudding. Let us not keep it waiting.',
    ceiling: 'The ceiling is only the sky, borrowed. It gives it back every morning, more or less as it found it.',
  },
  flitwick: {
    feather: 'Gently, gently. A feather is not a brick, and it will not thank you for being treated like one.',
  },
  pince: {
    breathe: 'Books are for reading. Not for breathing on, not for bending, and not for talking over.',
    rope: 'The Restricted Section is restricted. The word is not there for decoration.',
  },
  filch: {
    caught: 'Out of bed. Out of bed, at this hour. Oh, the trouble you are in.',
  },
  nick: {
    hello: 'Good evening. Do mind the draught; I seem to be causing it.',
    neck: 'Nearly headless, yes. The nearly is doing a great deal of work, and I thank it daily.',
  },
  friar: {
    hello: 'Welcome, welcome. Any house would be lucky to have you, though one of them is warmer.',
  },
  greylady: {
    hello: 'Ask your question and go. The tower is quieter without one.',
  },
  baron: {
    hello: 'The Baron says nothing. His chains say it for him.',
  },
  elf: {
    pie: 'Pie? There is always pie. The pie is never finished, and nobody is ever too full for pie.',
    shy: 'The kitchens are glad of visitors. The kitchens are not supposed to say so.',
  },
  prefect: {
    follow: 'First years, with me. Stay on the step that isn’t moving.',
  },
};

export function say(who, key) {
  const text = LINES[who]?.[key];
  if (!text) throw new Error(`no line ${who}.${key}`);
  return { who, name: NAMES[who] ?? who, text };
}

export const linesOf = (who) => Object.values(LINES[who] ?? {});
