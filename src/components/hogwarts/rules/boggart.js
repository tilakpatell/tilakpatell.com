// The boggart in the wardrobe (quest 9, docs/superpowers/specs/2026-10-21-
// hogwarts-world-design.md §4.7). Out it comes as three things in turn, the
// class’s fears: a dementor, a spider the size of a cart, Professor Snape.
// Riddikulus is a joke, and the right joke is the one that makes that
// thing ridiculous by what it is: a dementor is a cloak and a breath, a
// spider is eight legs and a web, Snape is the robes and the cauldron. Each
// time three jokes are offered: its own, and one each meant for the other
// two, which don’t land on it. A wrong one and it comes a step closer;
// three steps and you’ve backed out of the room (no points lost: try
// again). All three laughed off is the lesson done. The jokes are the
// site’s own.
//
//   THINGS, JOKES, newBoggart({ seed }), current(b) → the thing out now
//   choices(b) → the three jokes on offer, in a seeded order
//   choose(b, jokeId) → { boggart, right, says }
//   result(b) → { type: 'lesson', id: 'boggart', done, points } once over

import { seeded } from '../../../lib/seeded';

export const BOGGART = { steps: 3, points: 10 };

export const THINGS = [
  { id: 'dementor', name: 'A dementor', says: 'The room goes cold. The wardrobe door opens on its own.' },
  { id: 'spider', name: 'A spider the size of a cart', says: 'Something with far too many knees unfolds out of the wardrobe.' },
  { id: 'snape', name: 'Professor Snape', says: 'Out steps Snape, arms folded, already disappointed in you.' },
];

export const JOKES = [
  { id: 'deckchair', for: 'dementor', text: 'Its cloak turns into a striped deckchair cover, and it has to sit down in it.', after: 'It sinks into the deckchair and puts a little hat on.' },
  { id: 'hiccups', for: 'dementor', text: 'It draws its big rattling breath and gets the hiccups.', after: 'Hic. Hic. It drifts off, mortified.' },
  { id: 'kazoo', for: 'dementor', text: 'Its breath comes out through a kazoo.', after: 'It tries to be menacing in B flat. It can’t.' },
  { id: 'tapshoes', for: 'spider', text: 'Eight tap shoes, and it can’t stop dancing.', after: 'It clatters off across the floor in a terrible soft-shoe shuffle.' },
  { id: 'wool', for: 'spider', text: 'Its web comes out as pink knitting wool, and it’s tangled.', after: 'It sits in a nest of wool, knitting itself a very long scarf.' },
  { id: 'socks', for: 'spider', text: 'Eight odd socks, none of them its size.', after: 'It hops about trying to get the stripy one off its fourth leg.' },
  { id: 'dressinggown', for: 'snape', text: 'His robes turn into a fluffy dressing gown with a duck on the pocket.', after: 'He looks down at the duck. The duck looks back. Someone at the back snorts.' },
  { id: 'bubbles', for: 'snape', text: 'His cauldron bubbles over with bubble bath, all the way to his chin.', after: 'He stands in a foam of lavender, sneering through it.' },
  { id: 'curlers', for: 'snape', text: 'His hair goes up in pink curlers, ready for a night out.', after: 'He pats one curler, deeply uncertain, and backs into the wardrobe.' },
];

export const SAYS = {
  wrong: 'It doesn’t land. The boggart takes a step towards you.',
  fled: 'You’ve backed out of the room. Breathe, and go in again.',
  done: 'Riddikulus. The wardrobe rattles, and goes quiet.',
};

const shuffle = (list, r) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function newBoggart({ seed = 1 } = {}) {
  const r = seeded(seed * 31337 + 3);
  // the order the three come out in, and the offer each time
  const order = shuffle(THINGS.map((t) => t.id), r);
  const offers = order.map((id) => {
    const own = shuffle(JOKES.filter((j) => j.for === id), r)[0];
    const others = THINGS.filter((t) => t.id !== id).map((t) => shuffle(JOKES.filter((j) => j.for === t.id), r)[0]);
    return shuffle([own, ...others], r).map((j) => j.id);
  });
  return { order, offers, at: 0, steps: 0, fled: false, done: false, wrong: 0 };
}

export const current = (b) => (b.done || b.fled ? null : THINGS.find((t) => t.id === b.order[b.at]));
export const choices = (b) => (current(b) ? b.offers[b.at].map((id) => JOKES.find((j) => j.id === id)) : []);

export function choose(b, jokeId) {
  const thing = current(b);
  if (!thing || !b.offers[b.at].includes(jokeId)) return { boggart: b, right: false, says: null };
  const joke = JOKES.find((j) => j.id === jokeId);
  if (joke.for === thing.id) {
    const at = b.at + 1;
    const done = at >= b.order.length;
    return { boggart: { ...b, at, steps: 0, done }, right: true, says: done ? `${joke.after} ${SAYS.done}` : joke.after };
  }
  const steps = b.steps + 1;
  const fled = steps >= BOGGART.steps;
  return { boggart: { ...b, steps, fled, wrong: b.wrong + 1 }, right: false, says: fled ? SAYS.fled : SAYS.wrong };
}

// (backed out: in again, the same three in the same order, from the one that got you)
export const again = (b) => ({ ...b, steps: 0, fled: false });

export function result(b) {
  if (!b.done) return null;
  return { type: 'lesson', id: 'boggart', done: true, points: BOGGART.points };
}

// the bot: it knows what each thing is
export const boggartBot = (b) => choices(b).find((j) => j.for === current(b)?.id)?.id ?? null;
