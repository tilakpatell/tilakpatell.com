// The stages’ scenes on the Road: each written stage’s build (stages/<id>/
// index.js, imported as the stage comes within one of the walker, so a
// visitor downloads a stage’s code only as they near it) put into its land’s
// group, so it moves as the world is re-rooted, and let go when the land is.
// The stage the walker is in has its beats run (beats.js’s stepBeats): a
// beat reached plays its clip and its lines, and the scene reads how long
// since each began.
//
//   createScenes({ rt, road, lands, weather, ambience, tier, sky }) → {
//     at(index, local, dt, { speed, jumped }) → { since, fx, shot }  (fx: fxAt’s; shot: rigAt’s, or null)
//     floor(index, x, z) → the height the stage’s scene stands the walkers on there, or null (the land’s)
//     pose(index, id, { x, y, z, base, state }) → what the scene changes of a walker this frame
//       ({ x, y, z, yaw, base, speed, hide }, each left out for the module’s own), or null
//     dispose() }
//
// A build is given { road, heightAt, land, waters, rt, weather, ambience, tier, sky }
// (`land`: terrain.js’s, its rivers among it; `waters`: the land’s rivers’
// water, water.js’s, in the same order; `sky`: sky.js’s, for a lake of
// its own), and may answer `floor(x, z)`: what carries the walkers over the
// land (the raft at the Brandywine), and
// `pose(id, at)`: a walker as a beat has them (sat by Sam’s fire, Aragorn
// with a torch, Frodo on Asfaloth’s back).

import { STAGES } from './stages/index';
import { BEATS_OF } from './stages/registry';
import { LINES } from './voicelines';
import { fxAt, rigAt, stepBeats } from './beats';

// the written stages’ scenes, imported when first wanted
const SCENES = {
  hobbiton: () => import('./stages/hobbiton/index.js'),
  'shire-edge': () => import('./stages/shire-edge/index.js'),
  bree: () => import('./stages/bree/index.js'),
  weathertop: () => import('./stages/weathertop/index.js'),
  ford: () => import('./stages/ford/index.js'),
  rivendell: () => import('./stages/rivendell/index.js'),
  caradhras: () => import('./stages/caradhras/index.js'),
  moria: () => import('./stages/moria/index.js'),
  lorien: () => import('./stages/lorien/index.js'),
  anduin: () => import('./stages/anduin/index.js'),
};

export function createScenes({ rt, road, lands, weather, ambience, tier, sky = null }) {
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
        entry.scene = build({ road, heightAt: land.field, land, waters: lands.watersOf?.(i) ?? [], rt, weather, ambience, tier, sky });
        group.add(entry.scene.group);
      })
      // (a stage that fails stays failed until it is dropped: built again every frame it would be the kit painted every frame)
      .catch(() => {
        entry.failed = true;
      });
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
      // (a stage walked out of settles: it is only updated while current, and what runs on in it would run on behind)
      if (index !== current) made.get(current)?.scene?.leave?.();
      current = index;
      last = local;
      made.get(index)?.scene?.update(local, dt, { since, speed });
      return { since, fx: fxAt(beats, since), shot: rigAt(beats, local) };
    },
    floor(index, x, z) {
      return made.get(index)?.scene?.floor?.(x, z) ?? null;
    },
    pose(index, id, at) {
      return made.get(index)?.scene?.pose?.(id, at) ?? null;
    },
    dispose() {
      for (const i of [...made.keys()]) drop(i);
    },
  };
}
