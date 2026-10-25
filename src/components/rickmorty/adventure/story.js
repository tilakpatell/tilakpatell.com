// The adventure's rules: where the story is, what moves it on, and which dial
// places it has opened. Pure: the store (./adventure.js) keeps the state, the
// pages feed it what happens.
//
// State = { episode, step, got, wins, freeRoam }: the episode and step the
// story is at (episode === episodes.length once it's all done), the parts of
// an `all` step done (by index), the games won (a win before its step still
// counts) and whether every place on the dial is open anyway.
//
// Every function takes { episodes, ready, start } last, so the tests can pass
// a small book; feed takes `known` there too: the tasks and Citadel steps
// already done (tp-c137-done, tp-citadel-done), so a step whose task is done
// already passes the moment it comes up. Feeding an event twice changes
// nothing. Nothing here changes the state it's given.

import { EPISODES, READY, START } from './episodes';

const NONE = { tasks: [], citadel: [] };
const book = ({ episodes = EPISODES, ready = READY, start = START } = {}) => ({ episodes, ready: Math.min(ready, episodes.length), start });

export const fresh = ({ returner = false } = {}) => ({ episode: 0, step: 0, got: [], wins: [], freeRoam: returner });

const isIndex = (n, length) => Number.isInteger(n) && n >= 0 && n < length;

export function valid(x, opts) {
  const { episodes } = book(opts);
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const { episode, step, got, wins, freeRoam } = x;
  if (typeof freeRoam !== 'boolean' || !Array.isArray(wins) || !wins.every((w) => typeof w === 'string') || !Array.isArray(got)) return false;
  if (episode === episodes.length) return step === 0 && got.length === 0;
  if (!isIndex(episode, episodes.length) || !isIndex(step, episodes[episode].steps.length)) return false;
  const parts = episodes[episode].steps[step].steps?.length ?? 0;
  return got.every((i) => isIndex(i, parts));
}

// the step the story waits on, or null when it's all done or that episode isn't built
export function current(state, opts) {
  const { episodes, ready } = book(opts);
  if (state.episode >= ready) return null;
  const episode = episodes[state.episode];
  return { episode, index: state.episode, step: episode.steps[state.step] };
}

// does this event, or what's known done, finish this step (not an `all`)?
const heard = (step, e) =>
  e.type === step.type &&
  (step.type === 'task' || step.type === 'use' || step.type === 'citadel' ? e.id === step.id : step.type === 'win' ? e.game === step.game : step.type === 'enter' ? e.area === step.area : step.type === 'talk' ? e.who === step.who : false);
const knownDone = (step, s, known) =>
  step.type === 'task' ? known.tasks.includes(step.id) : step.type === 'citadel' ? known.citadel.includes(step.id) : step.type === 'win' ? s.wins.includes(step.game) : false;

// on to the next step, or the next episode (the out says which)
function advance(s, out, { episodes, ready }) {
  const episode = episodes[s.episode];
  s.got = [];
  if (s.step + 1 < episode.steps.length) {
    s.step += 1;
    out.push({ type: 'step', episode: s.episode, step: s.step });
    return;
  }
  out.push({ type: 'done', episode: s.episode });
  s.episode += 1;
  s.step = 0;
  if (s.episode === episodes.length) out.push({ type: 'end' });
  else if (s.episode < ready) out.push({ type: 'episode', episode: s.episode });
}

// the event (and anything already done) applied: { state, out }
export function feed(state, event, opts = {}) {
  const b = book(opts);
  const known = { ...NONE, ...opts.known };
  const s = { ...state, got: [...state.got], wins: [...state.wins] };
  const out = [];
  if (event.type === 'win' && !s.wins.includes(event.game)) s.wins.push(event.game);
  // the event first, then whatever's already done, step after step
  for (let e = event; current(s, b); e = NONE) {
    const step = current(s, b).step;
    if (step.type !== 'all') {
      if (!heard(step, e) && !knownDone(step, s, known)) break;
      advance(s, out, b);
      continue;
    }
    step.steps.forEach((part, i) => {
      if (!s.got.includes(i) && (heard(part, e) || knownDone(part, s, known))) s.got.push(i);
    });
    if (s.got.length < step.steps.length) break;
    advance(s, out, b);
  }
  return { state: s, out };
}

// where a step is played when that's a page of its own (the objective's link
// from C-137): an enter-a-page step's page, and the Citadel's steps, its page
export const CITADEL_PAGE = '/c-137/citadel';
export function stepPage(step) {
  if (step.type === 'enter' && step.area.startsWith('page:')) return step.area.slice('page:'.length);
  return step.type === 'citadel' ? CITADEL_PAGE : null;
}

// the objective line, and the page it's on when it's on another
export function objective(state, opts) {
  const at = current(state, opts);
  return at ? { text: at.step.text, to: stepPage(at.step) } : null;
}

// the dial places the story has opened: the start, each finished episode's,
// and every one once the last episode built is done
export function coordinates(state, opts) {
  const { episodes, ready, start } = book(opts);
  const done = state.episode >= ready ? episodes : episodes.slice(0, state.episode);
  return new Set([...start, ...done.flatMap((e) => e.unlocks)]);
}

export const dialOpen = (state, id, opts) => state.freeRoam || coordinates(state, opts).has(id);

// whether the dial places played (`places`) reach past what the story has
// opened: played when an older story, its last built episode done, had every
// place open
export const reachesPast = (state, places, opts) => {
  const open = coordinates(state, opts);
  return places.some((p) => !open.has(p));
};

// what a locked place says on the dial
export function lockNote(id, opts) {
  const { episodes } = book(opts);
  const i = episodes.findIndex((e) => e.unlocks.includes(id));
  return i < 0 ? null : `Opens after episode ${i + 1}, “${episodes[i].title}”.`;
}
