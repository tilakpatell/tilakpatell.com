// What the Rick and Morty planets keep between visits, each a book by planet
// id, and nothing else written anywhere (C-137's tp-c137-done and the galaxy's
// tp-galaxy-* are left alone): the places found, the quests done, and the
// best run at each planet's mission. Every read is an empty book on a first
// visit, a private window or a key that isn't one.

import { local } from '../../../lib/hooks';

export const FOUND_KEY = 'tp-rm-found'; // { [planet]: [place ids] }
export const QUESTS_KEY = 'tp-rm-quests'; // { [planet]: [quest ids] }
export const MISSIONS_KEY = 'tp-rm-missions'; // { [planet]: { t, stars } }

const book = (key) => {
  const all = local.get(key);
  return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
};

export const readFound = () => book(FOUND_KEY);
export const readDone = () => book(QUESTS_KEY);
export const readBests = () => book(MISSIONS_KEY);

export const writeFound = (id, list) => local.set(FOUND_KEY, { ...readFound(), [id]: [...list] });
export const writeDone = (id, list) => local.set(QUESTS_KEY, { ...readDone(), [id]: [...list] });

// A run beats the best when it has more stars, or as many and is faster
// (stars first: a survival's stars aren't its time). True when it's kept.
export const better = (run, was) => !was || run.stars > was.stars || (run.stars === was.stars && run.t < was.t);
export function writeBest(id, run) {
  const all = readBests();
  if (!better(run, all[id])) return false;
  local.set(MISSIONS_KEY, { ...all, [id]: { t: run.t, stars: run.stars } });
  return true;
}
