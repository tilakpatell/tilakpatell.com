// The grounds’ hero props where the films put them (world/heroes.js): Hagrid’s
// hut at the forest’s edge below the castle, its door turned to the castle;
// the Whomping Willow alone on its slope; the three greenhouses in a row by
// the lawn, their doors to the castle; the stone circle on its knoll at the
// wooden bridge’s far end, a ring of standing stones each turned and sized
// its own way; Hogsmeade station on its platform up the lake’s arm. Each is
// loaded through the world’s loader at the cut the tier asks and stood on
// the ground; what the walk goes round is each one’s footprint.
//
//   PLACED: [{ model, at: [x, z], yaw, s?, box?: [w, d] (along the model’s own x and z) | r }] (pure: where each stands)
//   ringOf(at, n, r, seed) → [{ at, yaw, s, tilt }] a ring of stones (pure)
//   createPlaced({ load, tier, ground, onMesh }) → { group, colliders: [{ kind, at, … }], ready, dispose() }

import * as THREE from 'three';
import { fileOf, tierFor } from './heroes';
import { placeById } from '../rules/places';

const at = (id) => placeById(id).at;
const E = Math.PI / 2;

// a ring of `n` stones round `at`, `r` metres out, each its own turn, height
// and lean, from a seed (so the circle is the same at every visit)
export function ringOf([cx, cz], n, r, seed = 5) {
  let a = seed >>> 0 || 1;
  const rnd = () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.25;
    const rr = r * (0.94 + rnd() * 0.12);
    return { at: [cx + Math.cos(t) * rr, cz + Math.sin(t) * rr], yaw: rnd() * Math.PI * 2, s: 0.75 + rnd() * 0.45, tilt: (rnd() - 0.5) * 0.12 };
  });
}

// The greenhouses’ row (their middle at the place’s, a gap of 22 m), each
// turned so its length runs north–south and its door end faces the castle
const [GX, GZ] = at('greenhouses');
export const PLACED = [
  { model: 'hagrid-hut', at: at('hut'), yaw: E, box: [12, 15] },
  { model: 'willow', at: at('willow'), yaw: 0.7, r: 2.6 },
  ...[-22, 0, 22].map((dx) => ({ model: 'greenhouse', at: [GX + dx, GZ - 1], yaw: E, box: [24, 12] })),
  ...ringOf(at('stone-circle'), 11, 10).map((p) => ({ model: 'standing-stone', ...p, r: 0.9 })),
  // (its length along the platform’s, the flat the terrain levels for it)
  { model: 'station', at: at('station'), yaw: -1.15, box: [26, 12] },
];

// metres from a prop its light cut takes over (three’s LOD switches it as it draws)
export const NEAR = 70;

export function createPlaced({ load, tier = 'high', ground, onMesh = () => {} }) {
  const group = new THREE.Group();
  group.name = 'hogwarts:placed';
  const shadows = tier !== 'low';
  let gone = false;
  // (the fine cuts on ultra only: on high a prop is drawn by the view, the shadows’ cascades and the
  // lake’s mirror, and its middle cut near and its light one far keep the frame inside its 1.4
  // million triangles; on low the light one always)
  const nearCut = (name) => tierFor(name, tier === 'ultra' ? 'ultra' : tier === 'low' ? 'low' : 'mid');
  const farCut = (name) => tierFor(name, 'low');
  const models = [...new Set(PLACED.map((p) => p.model))];
  const frame = (p) => {
    const [x, z] = p.at;
    const o = new THREE.Object3D();
    o.position.set(x, ground(x, z) - 0.05, z);
    o.rotation.set(p.tilt ?? 0, p.yaw ?? 0, 0, 'YXZ');
    o.scale.setScalar(p.s ?? 1);
    o.updateMatrix();
    return o.matrix;
  };
  const dress = (m) => {
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    onMesh(m);
  };
  const ready = Promise.all(
    models.map((name) => {
      const mine = PLACED.filter((q) => q.model === name);
      const many = mine.length > 2;
      const cuts = many ? [farCut(name)] : [...new Set([nearCut(name), farCut(name)])];
      return Promise.all(cuts.map((c) => Promise.resolve(load(fileOf(name, c))).catch(() => null)))
        .then((got) => {
          if (gone || !got[0]?.scene) return;
          // (a model stood many times, the stones: its light cut, each mesh instanced, a draw however many)
          if (many) {
            got[0].scene.updateMatrixWorld(true);
            got[0].scene.traverse((m) => {
              if (!m.isMesh) return;
              const inst = new THREE.InstancedMesh(m.geometry, m.material, mine.length);
              mine.forEach((p, i) => inst.setMatrixAt(i, frame(p).clone().multiply(m.matrixWorld)));
              inst.instanceMatrix.needsUpdate = true;
              inst.computeBoundingSphere();
              dress(inst);
              group.add(inst);
            });
            return;
          }
          for (const p of mine) {
            const lod = new THREE.LOD();
            lod.applyMatrix4(frame(p));
            got.forEach((g, i) => {
              if (!g?.scene) return;
              const o = g.scene.clone(true);
              o.traverse((m) => m.isMesh && dress(m));
              lod.addLevel(o, i === 0 ? 0 : NEAR);
            });
            group.add(lod);
          }
        })
        .catch(() => null);
    }),
  );
  // what the walk goes round: a box turned with each, or a circle
  const colliders = PLACED.map((p, i) => (p.box ? { id: `placed-${i}`, kind: 'box', at: p.at, w: p.box[0] * (p.s ?? 1), d: p.box[1] * (p.s ?? 1), turn: p.yaw ?? 0 } : { id: `placed-${i}`, kind: 'circle', at: p.at, r: (p.r ?? 1) * (p.s ?? 1) }));
  return {
    group,
    colliders,
    ready,
    dispose() {
      gone = true;
      // (the models’ geometry and materials are the loader’s, shared)
      group.removeFromParent();
    },
  };
}
