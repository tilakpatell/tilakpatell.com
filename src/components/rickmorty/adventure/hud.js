// What the HUD shows of the story, worked out apart from the drawing so
// RmWorld only calls it: the objective line, what an event's out says, and
// the task the map's marker points at. Pure.

import { EPISODES } from './episodes';
import { current } from './story';

// The objective line: the story's step while there is one, else the
// checklist's next. In C-137, once nothing's next, the checklist's closing
// line is the way on: the universe map (a planet's own line has its portal).
export function objectiveLine(story, prog, { planet = false } = {}) {
  if (story) return story;
  return { text: prog.objective, to: !planet && !prog.next ? '/universe' : null };
}

// What an out says: an episode done is its closing line, as a toast (the
// first of them), and a built episode begun is its card.
export function newsOf(out, { episodes = EPISODES } = {}) {
  const say = [];
  let card = null;
  for (const o of out) {
    if (o.type === 'done') {
      const [who, text] = episodes[o.episode].outro[0];
      say.push({ kind: 'say', who, text });
    }
    if (o.type === 'episode') card = o.episode;
  }
  return { say, card };
}

// The task the map's marker points at: the story's, while its step waits on
// one (an `all`'s first part still to do); nothing when its step is
// something else; the checklist's next once the built episodes are done.
export function markedTask(state, next, opts) {
  const at = current(state, opts);
  if (!at) return next;
  const { step } = at;
  const part = step.type === 'all' ? step.steps.find((_, i) => !state.got.includes(i)) : step;
  return part?.type === 'task' ? { id: part.id } : null;
}
