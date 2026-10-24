// The adventure's store: the story (./story.js) kept under one key on the
// runtime's saves, `tp-rm-story`, version 1. It reads the worlds' own keys
// (what's done in C-137 and at the Citadel) and never writes them.
//
// Made once a page visit (./useAdventure.js): it loads the story, or starts a
// new one (a visitor with anything done already is a returner, on Free roam),
// catches up on what was done before, and saves. Every feed reads what's done
// at that moment. Another tab's write reaches it through saves.watch, and so
// does its own (saves tell this tab's watchers too), which it knows by the
// state being the one it holds. Pure: no React, no three.

import { coordinates, current, dialOpen, feed, fresh, lockNote, objective, valid } from './story';

export const STORY_KEY = 'tp-rm-story';

const listOf = (read) => {
  const v = read?.();
  return Array.isArray(v) ? v : [];
};

export function createAdventure({ saves, read, episodes, ready }) {
  const book = { ...(episodes && { episodes }), ...(ready != null && { ready }) };
  const known = () => ({ tasks: listOf(read.tasks), citadel: listOf(read.citadel) });
  // anything older or broken is turned away by valid() below, so it starts afresh
  saves.register({ key: STORY_KEY, version: 1, migrate: () => null });

  const stored = saves.get(STORY_KEY, null);
  const k = known();
  const returner = k.tasks.length > 0 || k.citadel.length > 0;
  const made = !valid(stored, book);
  const opened = made ? fresh({ returner }) : stored; // (as the visit found it, before the catch-up)
  let state = feed(opened, { type: 'none' }, { ...book, known: k }).state;
  saves.set(STORY_KEY, state);

  let asked = false;
  let unsaid = []; // (what a page left before it could say it: the next to show the story says it)
  const listeners = new Set();
  const tell = () => {
    for (const fn of listeners) fn();
  };
  const put = (next) => {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    saves.set(STORY_KEY, state);
    tell();
  };
  saves.watch(STORY_KEY, (v) => {
    if (v === state || !valid(v, book)) return;
    state = v;
    tell();
  });

  return {
    // a new save for someone who's never played
    started: made && !returner,
    // the episode whose card opens this visit, the first time it's asked: the
    // one the story's at, when it's built and wasn't begun as the visit opened
    // (the catch-up may have done a step of it since); on Free roam there's none
    intro() {
      if (asked) return null;
      asked = true;
      const begun = (s) => s.step > 0 || s.got.length > 0;
      return !state.freeRoam && current(state, book) && (!begun(state) || !begun(opened)) ? state.episode : null;
    },
    get: () => state,
    // what the story said back that a page left before it could say (the
    // Citadel left mid-toast), kept for the next page to say, and taken once
    keepUnsaid(out) {
      unsaid = [...unsaid, ...out];
    },
    takeUnsaid() {
      const out = unsaid;
      unsaid = [];
      return out;
    },
    feed(event) {
      const r = feed(state, event, { ...book, known: known() });
      put(r.state);
      return r.out;
    },
    objective: () => objective(state, book),
    dialOpen: (id) => dialOpen(state, id, book),
    coordinates: () => coordinates(state, book),
    lockNote: (id) => lockNote(id, book),
    setFreeRoam: (on) => put({ ...state, freeRoam: Boolean(on) }),
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // (the checks only) the story at episode n's first step, and back to the start
    jump(n) {
      const next = { ...state, episode: n, step: 0, got: [] };
      if (valid(next, book)) put(next);
    },
    reset: () => put(fresh()),
  };
}
