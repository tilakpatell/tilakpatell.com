// Free roam's job board as the scene keeps it (jobs.js makes the jobs): a
// board the first frame you're on your feet (`ready`, each frame: out of
// the ship, or down at once with the motion reduced), and a new one from wherever you are
// once a job's done (the board stays as it is till then, so the one you're
// on is always on it). The page hears each board as a 'jobs' event and
// lists it beside the world's quests; a job is taken through the scene's
// `track`, as a quest is.
//
// createJobs({ site, on, effects, home, ok, emit, rand }) → { of(id) → the
//   job or null, ready(from), fresh(from), done(q, from), list }

import { jobBoard } from './jobs';

const view = (j) => ({ id: j.id, job: j.job, name: j.name, about: j.about, pay: j.pay });

export function createJobs({ site, on, effects = null, home, ok, emit, rand = Math.random }) {
  let board = [];
  let made = 0;
  let looked = false; // (the first board made, or looked for and none: not looked for again each frame)
  const fresh = (from) => {
    if (!on || !from) return;
    looked = true;
    board = jobBoard(site, { from, home, ok, rand, effects, start: made });
    made += board.length;
    emit({ type: 'jobs', list: board.map(view) });
  };
  return {
    of: (id) => board.find((j) => j.id === id) ?? null,
    ready(from) {
      if (!looked) fresh(from);
    },
    fresh,
    // (one done: the page pays it, and a new board round you)
    done(q, from) {
      if (q?.job) fresh(from);
    },
    get list() {
      return board;
    },
  };
}
