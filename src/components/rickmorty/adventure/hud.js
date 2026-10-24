// What the HUD shows of the story, worked out apart from the drawing so
// RmWorld and the Citadel only call it: the objective line, what an event's
// out says (and how long a page leaving holds for it), the task the map's
// marker points at, and the dial's locks. Pure.

import { EPISODES } from './episodes';
import { coordinates, current, dialOpen, lockNote } from './story';

// The objective line: the story's step while there is one, else the
// checklist's next. On a planet with an `all`'s part still to do there (the
// one landed on from the map, or the one Morty's on, `here`), that part's own
// line. On a planet landed on, the story's step only when it's there:
// anything else can't be done there, so the planet's own line. In C-137, once
// nothing's next, the checklist's closing line is the way on: the universe
// map (a planet's own line has its portal).
export function objectiveLine(story, prog, { planet = null, here = null, state = null, ...opts } = {}) {
  const part = story && partsOf(state, opts).find((s) => s.place === (planet?.id ?? here));
  if (part) return { text: part.text, to: null };
  if (story && (!planet || placesOf(state, opts).includes(planet.id))) return story;
  return { text: prog.objective, to: !planet && !prog.next ? '/universe' : null };
}

// an `all`'s parts still to do (none for any other step)
function partsOf(state, opts) {
  const at = state && current(state, opts);
  return at?.step.type === 'all' ? at.step.steps.filter((_, i) => !state.got.includes(i)) : [];
}

// the dial places the story's step is waiting on (an `all`'s parts still to do)
function placesOf(state, opts) {
  const at = state && current(state, opts);
  if (!at) return [];
  return (at.step.type === 'all' ? partsOf(state, opts) : [at.step]).map((s) => s.place).filter(Boolean);
}

// What an out says: an episode done is its closing line, as a toast (the
// last episode's, when one out ends two), and a built episode begun is its
// card, unless it's over by the end of the same out.
export function newsOf(out, { episodes = EPISODES } = {}) {
  let say = [];
  let card = null;
  for (const o of out) {
    if (o.type === 'done') {
      const [who, text] = episodes[o.episode].outro[0];
      say = [{ kind: 'say', who, text }];
      if (o.episode === card) card = null;
    }
    if (o.type === 'episode') card = o.episode;
  }
  return { say, card };
}

// How long a page that's leaving holds for what an out says: an episode's
// closing line, long enough to be read before the fade covers it (the
// escape that ends an episode on a planet's own page); nothing else holds.
export const SAID_MS = 4000;
export const leaveHold = (out) => (newsOf(out).say.length ? SAID_MS : 0);

// What the map's marker points at: the story's task, or the game it's to
// win, while its step waits on one (an `all`'s part on the planet Morty's on,
// `here`, else its first still to do);
// nothing when its step is something else; the checklist's next once the
// built episodes are done. (RmWorld's GOAL says where each is.)
export function markedTask(state, next, { here = null, ...opts } = {}) {
  const at = current(state, opts);
  if (!at) return next;
  const { step } = at;
  // (an `all`: the part on the planet he's on, else its first still to do)
  const left = partsOf(state, opts);
  const part = step.type === 'all' ? (left.find((s) => here && s.place === here) ?? left[0]) : step;
  if (part?.type === 'task') return { id: part.id };
  return part?.type === 'win' ? { id: part.game } : null;
}

// The dial's places, each with its lock: null when it's open, else the
// episode that opens it.
export const dialItems = (items, state) => items.map((d) => ({ ...d, locked: dialOpen(state, d.id) ? null : lockNote(d.id) }));

// The dial's lead: how many coordinates the story has brought home (Free
// roam opens the dial, but brings none home).
export const dialLead = (state, total) => `Coordinates home: ${coordinates(state).size} of ${total}`;
