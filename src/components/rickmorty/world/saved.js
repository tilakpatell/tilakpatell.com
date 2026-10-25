// What C-137 keeps between visits, beside RmWorld.jsx (which is past its
// size): the things done (tp-c137-done), Roy's lives and best
// (tp-c137-roy), the missing-cat posters read (tp-c137-posters). Each read
// is fresh, and a thing done is kept over what's kept now, not over the copy
// the page read when it opened, so another tab's ticks aren't lost. Pure
// over a store as lib/hooks.js's `local` is: get(key, fallback), set(key, value).
//
//   saved(store) → {
//     readDone() → the things done, once each, the ones C-137 has
//     addDone(mine, ...ids) → what's kept, then `mine` and `ids` not in it: kept, and returned
//     startDone() → readDone with Roy's and the posters' caught up (a life lived, one
//       past Morty's 55, all five posters read: left before they ticked), kept
//     royDone() → Roy's tasks from what Roy keeps
//     readBest() → the best age as Roy so far, or null
//     postersRead() → the posters read, the ones there are
//   }

import { keptOver } from '../../../lib/kept';
import { TASKS } from './rules';
import { MORTY_BEST } from './roy/rules';
import { POSTERS } from './town/plan';

export const DONE = 'tp-c137-done';
export const ROY = 'tp-c137-roy';
export const POSTERS_READ = 'tp-c137-posters';
const TASK_IDS = new Set(TASKS.map((t) => t.id));
const POSTER_IDS = new Set(POSTERS.map((p) => p.id));

export function saved(store) {
  const readDone = () => {
    const d = store.get(DONE, []);
    return Array.isArray(d) ? d.filter((x, i) => TASK_IDS.has(x) && d.indexOf(x) === i) : [];
  };
  const addDone = (mine = [], ...ids) => {
    const next = keptOver(store.get(DONE, []), mine, ids, (id) => TASK_IDS.has(id));
    store.set(DONE, next);
    return next;
  };
  const royDone = () => {
    const r = store.get(ROY, null);
    const best = Number(r?.best) || 0;
    return [...((Number(r?.lives) || 0) > 0 || best > 0 ? ['roy'] : []), ...(best > MORTY_BEST ? ['roy55'] : [])];
  };
  const readBest = () => Math.max(0, Math.floor(Number(store.get(ROY, null)?.best) || 0)) || null;
  const postersRead = () => {
    const r = store.get(POSTERS_READ, []);
    return Array.isArray(r) ? r.filter((id) => POSTER_IDS.has(id)) : [];
  };
  const startDone = () => {
    const d = readDone();
    const more = [...royDone(), ...(postersRead().length === POSTER_IDS.size ? ['posters'] : [])].filter((id) => !d.includes(id));
    return more.length ? addDone(d, ...more) : d;
  };
  return { readDone, addDone, startDone, royDone, readBest, postersRead };
}
