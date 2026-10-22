// The castle: the hero model (world/heroes.js’s `castle`: Jzax’s voxel
// Hogwarts, the one model whose plan is the films’, cut by what each face
// is: scripts/hogwarts-castle.mjs) stood where castle/hero.js puts it, its
// classes worn in the castle’s scans (heroMaterials.js). Near, its fine cut;
// past FAR metres (on low, always) its light one in its place, one cut drawn
// at a time but for the moment of the swap. Each cut is a draw a class (nine
// at most), its windows lit from dusk on their own thresholds. The doors that
// open (doors.js) stand at its doors in the kit’s stone and oak, which this
// hands it as `materials`.
//
// By distance, a level a cut (LEVELS): on high, the middle cut to 300 m
// (its stone the scan’s work close to, across the lake from a boat), the
// light one past that; on ultra the fine cuts nearer. Only the nearest level
// casts a shadow (the cascades reach 60 m), and the lake’s mirror draws
// whichever is shown: a cut is drawn by the view, each cascade and the
// mirror, so on high the fine one took a frame by the walls to 1.58 million
// triangles, past the 1.4 million the design allows.
//
//   createCastle({ house, tier, ground, load, onMesh }) → {
//     group (the near levels), far (the farthest), bridge: { group, frame, from, to },
//     materials (the kit’s, for the doors), colliders (plan.js’s footprints), floors (its decks and stairs),
//     doors (plan.js’s DOORS), update(dt, camera, { hour, night, snow, wet }), near (whether the near
//     castle is the one drawn), stats: { near: triangles, far: triangles, draws }, ready, dispose() }
//     load(url) → Promise<gltf>: the world’s loader (rt.assets.gltf); onMesh(mesh): each mesh as it is
//     added (the lake’s mirror takes them onto its layer)
//   handAngles(hour) → { hour, minute } radians clockwise from twelve (pure)
//   swing(t) → a pendulum’s angle at t seconds (pure)

import * as THREE from 'three';
import { createCastleMaterials } from './materials';
import { createHeroMaterials } from './heroMaterials';
import { BRIDGES, DOORS, floors, footprints } from './plan';
import { HERO } from './hero';
import { fileOf } from '../heroes';
import { placeById } from '../../rules/places';

// each tier’s levels: the cut and the metres from the castle’s middle it is drawn within
export const LEVELS = {
  ultra: [['ultra', 160], ['hq', 420], ['lo', Infinity]],
  high: [['mid', 300], ['lo', Infinity]],
  mid: [['mid', 150], ['lo', Infinity]],
  low: [['lo', Infinity]],
};
// the level a distance draws, kept where it is within HYSTERESIS of the line (pure)
export function levelAt(levels, d, now = null) {
  let want = levels.findIndex(([, r]) => d < r);
  if (now != null && want !== now && Math.abs(d - (levels[Math.min(want, now)]?.[1] ?? Infinity)) < HYSTERESIS) want = now;
  return want;
}
const PERIOD = 4.2; // s a swing there and back: a pendulum about four metres long
const SWING = 0.16; // radians each way
const HYSTERESIS = 25; // m: the swap back to near waits this much closer, so it never flickers on the line
// m from the castle’s middle within which it casts a shadow: the cascades reach 60 m from the eye,
// and from further off it was drawn into each of them for nothing
const SHADOW_NEAR = 140;
// (what neither casts a shadow nor stops the light)
const LIGHT = new Set(['glass', 'window', 'lamp']);

export function handAngles(hour) {
  const h = ((hour % 12) + 12) % 12;
  return { hour: (h / 12) * Math.PI * 2, minute: (h % 1) * Math.PI * 2 };
}
export const swing = (t) => SWING * Math.sin((t / PERIOD) * Math.PI * 2);

export function createCastle({ house = null, tier = 'high', load = null, onMesh = () => {} } = {}) {
  const materials = createHeroMaterials({ house, tier });
  // (the kit’s materials, vertex-coloured, for the doors drawn at the castle’s doors)
  const kit = createCastleMaterials({ house, tier });
  const group = new THREE.Group();
  group.name = 'hogwarts:castle';
  const far = new THREE.Group();
  far.name = 'hogwarts:castle:far';
  const shadows = tier !== 'low';
  const counts = { near: 0, far: 0, draws: 0 };
  let gone = false;
  const levels = LEVELS[tier] ?? LEVELS.high;
  const casters = [];
  let casting = true;
  // a group a level, the farthest the `far` the world mirrors and shows first
  const groups = levels.map(([cut], i) => {
    const g = i === levels.length - 1 ? far : new THREE.Group();
    g.name = g.name || `hogwarts:castle:${cut}`;
    if (g !== far) group.add(g);
    return g;
  });

  // a cut in its place, each primitive in its class’s material
  const dress = (gltf, i) => {
    const root = gltf.scene.clone(true);
    root.position.set(...HERO.at);
    root.rotation.y = HERO.turn;
    root.scale.setScalar(HERO.scale);
    const cast = shadows && i === 0 && levels.length > 1;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const cls = o.material?.name;
      o.material = materials[cls] ?? materials.stone;
      o.name = `castle:${cls}`;
      if (cast && !LIGHT.has(cls)) casters.push(o);
      o.castShadow = cast && !LIGHT.has(cls) && casting;
      o.receiveShadow = shadows;
      if (cls === 'glass') o.renderOrder = 2;
      const tris = (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      if (i === 0) {
        counts.near += tris;
        counts.draws++;
      }
      if (i === levels.length - 1) counts.far += tris;
      onMesh(o);
    });
    groups[i].add(root);
  };
  const loaded = load
    ? Promise.all(
        levels.map(([cut], i) =>
          Promise.resolve(load(fileOf('castle', cut)))
            .then((gltf) => !gone && gltf?.scene && dress(gltf, i))
            .catch(() => null),
        ),
      )
    : Promise.resolve();

  const centre = placeById('castle').at;
  let level = levels.length - 1;
  const show = () => groups.forEach((g, i) => (g.visible = i === level));
  show();

  // (the wooden bridge is the model’s own; its line for those who walk it and sway it)
  const { from, to } = BRIDGES.covered;
  const run = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const bridge = { group: new THREE.Group(), frame: { yaw: Math.atan2(to[0] - from[0], to[2] - from[2]), pitch: Math.atan2(to[1] - from[1], run), length: run }, from, to };

  return {
    group,
    far,
    bridge,
    materials: kit,
    colliders: footprints(),
    floors: floors(),
    doors: DOORS,
    // (whether the nearest level is the one drawn)
    get near() {
      return level === 0 && levels.length > 1;
    },
    stats: {
      get near() {
        return Math.round(counts.near);
      },
      get far() {
        return Math.round(counts.far);
      },
      get draws() {
        return counts.draws;
      },
    },
    ready: Promise.all([materials.ready, kit.ready, loaded]),
    update(dt, camera, { night = null, snow = null, wet = null } = {}) {
      materials.update(dt);
      materials.set({ night, snow, wet });
      kit.update(dt);
      kit.set({ night, snow, wet });
      if (camera && levels.length > 1) {
        const d = Math.hypot(camera.position.x - centre[0], camera.position.z - centre[1]);
        const want = levelAt(levels, d, level);
        if (want !== level) {
          level = want;
          show();
        }
        const cast = casting ? d < SHADOW_NEAR + HYSTERESIS : d < SHADOW_NEAR;
        if (cast !== casting) {
          casting = cast;
          for (const o of casters) o.castShadow = cast;
        }
      }
    },
    dispose() {
      gone = true;
      // (the cuts’ geometry is the loader’s, shared: only the materials are this castle’s)
      materials.dispose();
      kit.dispose();
      group.removeFromParent();
      far.removeFromParent();
    },
  };
}
