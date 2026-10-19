// The stages’ scenes on the Road: each written stage’s build (stages/<id>/
// index.js, imported as the stage comes within one of the walker, so a
// visitor downloads a stage’s code only as they near it) put into its land’s
// group, so it moves as the world is re-rooted, and let go when the land is.
// The stage the walker is in has its beats run (beats.js’s stepBeats): a
// beat reached plays its clip and its lines, and the scene reads how long
// since each began.
//
//   createScenes({ rt, road, lands, weather, ambience, tier }) → {
//     at(index, local, dt, { speed, jumped }) → { since, fx, shot }  (fx: fxAt’s; shot: rigAt’s, or null)
//     dispose() }

import { STAGES } from './stages/index';
import { BEATS_OF } from './stages/registry';
import { LINES } from './voicelines';
import { fxAt, rigAt, stepBeats } from './beats';

// the written stages’ scenes, imported when first wanted
const SCENES = {
  hobbiton: () => import('./stages/hobbiton/index.js'),
};

export function createScenes({ rt, road, lands, weather, ambience, tier }) {
  const made = new Map(); // index → { scene | null, group (the land’s it is in), gone }
  let current = -1;
  let last = 0;
  let since = {};

  const want = (i) => {
    const id = STAGES[i]?.id;
    const group = lands.groupOf(i);
    if (!id || !SCENES[id] || !group || made.has(i)) return;
    const entry = { scene: null, group, gone: false };
    made.set(i, entry);
    const land = lands.landOf(i);
    SCENES[id]()
      .then(({ build }) => {
        if (entry.gone) return;
        entry.scene = build({ road, heightAt: land.field, rt, weather, tier });
        group.add(entry.scene.group);
      })
      .catch(() => made.delete(i));
  };
  const drop = (i) => {
    const e = made.get(i);
    if (!e) return;
    e.gone = true;
    e.scene?.dispose();
    made.delete(i);
  };
  const play = (beat) => {
    if (beat.clip) ambience?.clip(beat.clip);
    for (const id of beat.lines ?? []) if (LINES[id]) ambience?.say(LINES[id].who, LINES[id].text, beat.at);
  };

  return {
    at(index, local, dt, { speed = 0, jumped = false } = {}) {
      for (const i of [...made.keys()]) if (Math.abs(i - index) > 1 || lands.groupOf(i) !== made.get(i).group) drop(i);
      for (const i of [index, index + 1, index - 1]) if (i >= 0 && i < STAGES.length) want(i);
      const beats = BEATS_OF[STAGES[index].id] ?? [];
      // (a jump, or a step back into the stage before: what is behind is done,
      // not played; walked on into the next, its beats from its start)
      let r;
      if (jumped || index < current) r = stepBeats({}, beats, { from: local, to: local, jumped: true });
      else if (index > current) r = stepBeats({}, beats, { from: 0, to: local, dt });
      else r = stepBeats(since, beats, { from: last, to: local, dt });
      for (const id of r.fired) play(beats.find((b) => b.id === id));
      since = r.since;
      current = index;
      last = local;
      made.get(index)?.scene?.update(local, dt, { since, speed });
      return { since, fx: fxAt(beats, since), shot: rigAt(beats, local) };
    },
    dispose() {
      for (const i of [...made.keys()]) drop(i);
    },
  };
}
