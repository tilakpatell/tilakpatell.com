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
// map (a planet's own line has its portal). While the story's end card is up
// (`ended`), the story's own last word, before the checklist takes over.
export const STORY_DONE = 'That’s the whole story: the Checklist tab has the rest.';
export function objectiveLine(story, prog, { planet = null, here = null, state = null, ended = false, ...opts } = {}) {
  if (ended) return { text: STORY_DONE, to: null };
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
// last episode's, when one out ends two: `caught`, the ones it ended before
// that, done already from before), and a built episode begun is its card,
// unless it's over by the end of the same out. The story's end is the card
// after the last episode's (`episodes.length`).
export function newsOf(out, { episodes = EPISODES } = {}) {
  let say = [];
  let card = null;
  const ended = [];
  for (const o of out) {
    if (o.type === 'done') {
      const [who, text] = episodes[o.episode].outro[0];
      say = [{ kind: 'say', who, text }];
      ended.push(o.episode);
      if (o.episode === card) card = null;
    }
    if (o.type === 'episode') card = o.episode;
    if (o.type === 'end') card = episodes.length;
  }
  return { say, card, caught: ended.slice(0, -1) };
}

// what's said of the episodes an out caught up on (newsOf's `caught`): not a
// person's line, a note ahead of the one closing line said
export function caughtNote(caught) {
  if (!caught.length) return null;
  const n = caught.map((e) => e + 1);
  const list = n.length === 1 ? `Episode ${n[0]}` : `Episodes ${n.slice(0, -1).join(', ')} and ${n.at(-1)}`;
  return `${list} done already, from what you’d played before.`;
}

// What an out says, said: its closing line through `say(t, { after,
// onShow })` (C-137's toast slot: after the line that's up has been read),
// and its card through `open(n)` as that line goes up, not before it (a card
// with no line, at once). What it caught up on goes first, and the line once
// that's been read. Given the `out`, each toast carries it (`t.out`): a page
// that leaves while one still waits keeps that for the next to say.
export function showNews(news, say, open, out = null) {
  const card = news.card != null ? () => open(news.card) : undefined;
  if (!news.say.length) return card?.();
  const put = (t, o) => say(out ? { ...t, out } : t, o);
  const lines = () => news.say.forEach((t, i) => put(t, { after: true, onShow: i === news.say.length - 1 ? card : undefined }));
  const note = caughtNote(news.caught ?? []);
  if (note) put({ kind: 'say', who: null, text: note }, { after: true, onShow: lines });
  else lines();
}

// How long a page that's leaving holds for what an out says: an episode's
// closing line, long enough to be read before the fade covers it (the
// escape that ends an episode on a planet's own page); nothing else holds.
export const SAID_MS = 4000;
export const leaveHold = (out) => (newsOf(out).say.length ? SAID_MS : 0);

// What the map's marker points at: the story's task, the game it's to win,
// or the hotspot it's to use (Rick's bench), while its step waits on one (an
// `all`'s part on the planet Morty's on, `here`, else its first still to do);
// nothing when its step is something else (walking in somewhere); the
// checklist's next once the built episodes are done. (RmWorld's GOAL says where each is.)
export function markedTask(state, next, { here = null, ...opts } = {}) {
  const at = current(state, opts);
  if (!at) return next;
  const { step } = at;
  // (an `all`: the part on the planet he's on, else its first still to do)
  const left = partsOf(state, opts);
  const part = step.type === 'all' ? (left.find((s) => here && s.place === here) ?? left[0]) : step;
  if (part?.type === 'task' || part?.type === 'use') return { id: part.id };
  return part?.type === 'win' ? { id: part.game } : null;
}

// The Checklist's lit row (C-137's Things to do): the story's task while its
// step waits on one of the rows, else the checklist's own next (a game won,
// or the gun put back, isn't a row)
export function listNext(state, next, rows, opts) {
  const m = markedTask(state, next, opts);
  return m && rows.some((r) => r.id === m.id) ? m : next;
}

// The tab Things to do opens on: the Story's while there's a story to follow,
// the Checklist's once it's over
export const listTab = (state, { episodes = EPISODES } = {}) => (state.episode >= episodes.length ? 'checklist' : 'story');

// The dial's places, each with its lock: null when it's open, else the
// episode that opens it.
export const dialItems = (items, state) => items.map((d) => ({ ...d, locked: dialOpen(state, d.id) ? null : lockNote(d.id) }));

// The dial's lead: how many of its coordinates the story has put on the gun
// (Customs from the start; Free roam opens the dial, but puts none on it).
export const dialLead = (state, total) => `Coordinates on the gun: ${coordinates(state).size} of ${total}`;

// Whether a key or a tap passes an episode's card (./EpisodeCard.jsx): a key
// pressed, not one held down from before it showed (its auto-repeat), or a
// walking player never reads the next episode's first line
export const passesCard = (e) => !e?.repeat;
