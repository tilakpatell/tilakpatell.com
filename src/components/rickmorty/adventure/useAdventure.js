// The one hook the Rick and Morty pages mount (C-137, its planets, the
// Citadel): the adventure's store (./adventure.js), made the first time any of
// them asks, on the visit's saves, reading what's done in C-137
// (tp-c137-done) and at the Citadel (tp-citadel-done) as each event comes.
// In a DEV build the checks drive it through window.__RMSTORY__, as they do
// C-137 through __C137__.

import { useSyncExternalStore } from 'react';
import { local } from '../../../lib/hooks';
import { localSaves } from '../../../runtime/local';
import { createAdventure } from './adventure';

let store = null;
function adventure() {
  if (store) return store;
  store = createAdventure({ saves: localSaves(), read: { tasks: () => local.get('tp-c137-done', []), citadel: () => local.get('tp-citadel-done', []) } });
  if (import.meta.env.DEV && typeof window !== 'undefined') window.__RMSTORY__ = { get: store.get, feed: store.feed, dialOpen: store.dialOpen, jump: store.jump, reset: store.reset };
  return store;
}

// { started, intro, state, objective, feed, dialOpen, coordinates, lockNote, setFreeRoam }
export function useAdventure() {
  const a = adventure();
  // (the server's snapshot is the same: the tests render with renderToStaticMarkup)
  const state = useSyncExternalStore(a.on, a.get, a.get);
  return { started: a.started, intro: a.intro, state, objective: a.objective(), feed: a.feed, dialOpen: a.dialOpen, coordinates: a.coordinates, lockNote: a.lockNote, setFreeRoam: a.setFreeRoam };
}
