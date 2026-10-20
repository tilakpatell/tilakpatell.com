// The stages’ scenes on the Road: each written stage’s build (stages/<id>/
// index.js, imported as the stage comes within one of the walker, so a
// visitor downloads a stage’s code only as they near it) put into its land’s
// group, so it moves as the world is re-rooted, and let go when the land is.
// The stage the walker is in has its beats run (beats.js’s stepBeats): a
// beat reached plays its clip and its lines, and the scene reads how long
// since each began.
//
//   createScenes({ rt, road, lands, weather, ambience, tier, sky }) → {
//     at(index, local, dt, { speed, jumped, waits }) → { since, fx, shot }  (fx: fxAt’s; shot: rigAt’s, or null;
//       waits: the beats whose deed is undone, held at its moment till it’s done, doing.js’s)
//     floor(index, x, z) → the height the stage’s scene stands the walkers on there, or null (the land’s)
//     pose(index, id, { x, y, z, base, state }) → what the scene changes of a walker this frame
//       ({ x, y, z, yaw, base, speed, hide }, each left out for the module’s own), or null
//     solids(index) → the stage’s solids.js grid (in its land’s frame) once filled, or null
//     dispose() }
//
// The grid is filled from what the build left standing (its merged statics,
// `userData.solid`, and its opaque instanced dressing; never what a scene
// moves, a gate or a raft, nor water, light or crop), a slice a frame as
// the stage comes, so the walk never waits on it.
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
import * as THREE from 'three';
import { fxAt, rigAt, stepBeats } from './beats';
import { createSolids } from './solids';

const SLICE = 40000; // triangles a frame into a stage's grid
const PAST = 40; // m of the grid either side of the stage's ends
const SOFT = /lantern|pool|corn|grass|flower|reed|water|falls|spray|vision|mist|cloud|light/i;

// what stands solid in a build: its merged statics and its opaque instanced dressing
const solid = (o) => o.isMesh && !o.isSkinnedMesh && !o.userData.ink && o.visible && (o.userData.solid || o.isInstancedMesh) && ![o.material].flat().some((m) => m?.transparent) && !SOFT.test(o.name);

// the build's solid triangles into the grid, in the land's frame, a slice at a time
function* fill(root, frame, grid) {
  const meshes = [];
  root.traverse((o) => solid(o) && meshes.push(o));
  const inv = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const one = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let done = 0;
  // (once: what's still never moves under its land, and a land re-rooted between slices moves it all together)
  frame.updateMatrixWorld(true);
  for (const o of meshes) {
    inv.copy(frame.matrixWorld).invert();
    const pos = o.geometry.attributes.position;
    const index = o.geometry.index;
    const tris = Math.floor((index ? index.count : pos.count) / 3);
    const at = new Float32Array(pos.count * 3);
    for (let k = 0; k < (o.isInstancedMesh ? o.count : 1); k++) {
      m.multiplyMatrices(inv, o.matrixWorld);
      if (o.isInstancedMesh) m.multiply(o.getMatrixAt(k, one));
      for (let i = 0; i < pos.count; i++) v.fromBufferAttribute(pos, i).applyMatrix4(m).toArray(at, i * 3);
      for (let t = 0; t < tris; t++) {
        const a = 3 * (index ? index.getX(3 * t) : 3 * t);
        const b = 3 * (index ? index.getX(3 * t + 1) : 3 * t + 1);
        const c = 3 * (index ? index.getX(3 * t + 2) : 3 * t + 2);
        grid.add(at[a], at[a + 1], at[a + 2], at[b], at[b + 1], at[b + 2], at[c], at[c + 1], at[c + 2]);
        if (++done % SLICE === 0) yield;
      }
    }
  }
}

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
  marshes: () => import('./stages/marshes/index.js'),
  ithilien: () => import('./stages/ithilien/index.js'),
  'cirith-ungol': () => import('./stages/cirith-ungol/index.js'),
  'minas-tirith': () => import('./stages/minas-tirith/index.js'),
  havens: () => import('./stages/havens/index.js'),
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
        // (what it left standing, into its grid over the next frames)
        entry.grid = createSolids({ from: -PAST, to: STAGES[i].length + PAST, ground: land.field });
        entry.filling = fill(entry.scene.group, group, entry.grid);
      })
      // (a stage that fails stays failed until it is dropped: built again every frame it would be the kit painted every frame)
      .catch((e) => {
        entry.failed = true;
        // (in development, say why: a stage that will not build otherwise draws nothing, silently)
        if (import.meta.env?.DEV) console.warn(`the Road: ${id} did not build`, e);
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
    at(index, local, dt, { speed = 0, jumped = false, waits = null } = {}) {
      for (const i of [...made.keys()]) if (Math.abs(i - index) > 1 || lands.groupOf(i) !== made.get(i).group) drop(i);
      for (const i of [index, index + 1, index - 1]) if (i >= 0 && i < STAGES.length) want(i);
      // (a slice of the nearest grid still filling)
      for (const i of [index, index + 1, index - 1]) {
        const e = made.get(i);
        if (!e?.filling) continue;
        if (e.filling.next().done) e.filling = null;
        break;
      }
      const beats = BEATS_OF[STAGES[index].id] ?? [];
      // (a jump, or a step back into the stage before: what is behind is done,
      // not played; walked on into the next, its beats from its start)
      let r;
      if (jumped || index < current) r = stepBeats({}, beats, { from: local, to: local, jumped: true });
      else if (index > current) r = stepBeats({}, beats, { from: 0, to: local, dt, waits });
      else r = stepBeats(since, beats, { from: last, to: local, dt, waits });
      for (const id of r.fired) play(beats.find((b) => b.id === id));
      since = r.since;
      // (a stage walked out of settles: it is only updated while current, and what runs on in it would run on behind)
      if (index !== current) made.get(current)?.scene?.leave?.();
      current = index;
      last = local;
      made.get(index)?.scene?.update(local, dt, { since, speed });
      return { since, fx: fxAt(beats, since), shot: rigAt(beats, local) };
    },
    solids(index) {
      const e = made.get(index);
      return e?.grid && !e.filling ? e.grid : null;
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
