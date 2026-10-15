// A story put on to one of its steps, for the tests and the dev hook: the
// game started on that step's beat, and each step before it in the beat
// given the event that finishes it (an arrival, a talk's end, a thing
// used, a kill, a scene done, the clock run out), as the story's own
// scripts would. Nothing here is how a player gets there: for that,
// autoplay.js plays the game itself.
//
//   finishStep(g, step) → void       the event that finishes `step`, fed to the story
//   toStep(station, side, id, seed = 5) → g   a new story game at step `id`, its scene done,
//     stepped once

import { drain, newGame, step } from '../game';
import { feedPlot, startPlot } from './plot';

function finishStep(g, cur) {
  const t = cur.target ?? {};
  const n = Number.isFinite(cur.need) ? cur.need : 1;
  if (cur.type === 'reach' || cur.type === 'escort') feedPlot(g, { type: 'at', room: t.spot ? g.layout.station.spots[t.spot]?.room : t.room, spot: t.spot ?? null, with: [cur.need].filter((x) => typeof x === 'string') });
  else if (cur.type === 'talk') feedPlot(g, { type: 'talked', talk: cur.need.talk, node: cur.need.node });
  else if (cur.type === 'choose') feedPlot(g, { type: 'chose', talk: cur.need.talk, choice: cur.need.choice });
  else if (cur.type === 'use') for (let i = 0; i < n; i++) feedPlot(g, cur.need?.code != null ? { type: 'dialled', code: cur.need.code } : { type: 'used', tag: t.tag });
  else if (cur.type === 'still') feedPlot(g, { type: 'still', seconds: cur.time });
  else if (cur.type === 'timer' || cur.type === 'hide') feedPlot(g, { type: 'tick', dt: cur.time + 1 });
  else if (cur.type === 'scene') feedPlot(g, { type: 'sceneDone', id: cur.need.scene });
  else for (const p of g.crew.people.filter((q) => q.tag === (t.tag ?? t.npc))) feedPlot(g, { type: 'killed', kind: p.kind, tag: p.tag });
}

export function toStep(station, side, id, seed = 5) {
  const g = newGame({ station, side, mode: 'story', seed });
  startPlot(g, id);
  for (let k = 0; k < 40 && g.plot.progress.step !== id; k++) finishStep(g, g.plot.story.steps.find((q) => q.id === g.plot.progress.step));
  g.scene = null;
  step(g, { dir: { x: 0, z: 0 }, yaw: g.you.yaw, pitch: 0 });
  drain(g);
  return g;
}
