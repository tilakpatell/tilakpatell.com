// The rocks a game's space level placed (lane Q: scripts/bf2017-space.mjs),
// the pieces of the second Death Star's debris over Endor, each where the map
// put it and turning on the game's own asteroid track for its size (the
// bucket's animtracks/a3/…/asteroid_{large,medium,small}_01: the large tilted
// 45° and turned once in 30 seconds, the medium once in 30, the small once in
// 20). One InstancedMesh a part of a model, so two thousand pieces of
// twenty-odd models are a few dozen draws. As rocks.js does, the turn is the
// graphics card's: an instance's matrix is where the map put it, written once;
// the track's turn for each size is one uniform a frame (evalTrack, src/lib/
// three/animTracks.js, E0's), applied to the model before its matrix.
//
// createPlacedRocks({ pieces, models, tracks, keep = 1 }) → { group, solids, update(t), dispose() }
//   pieces: the pack's rock pieces ({ model, at, quaternion, scale, track })
//   models: slug → { scene (the loaded model), size (metres) }
//   tracks: { large | medium | small: [{ channel, loop, keys }] } (src/data/galaxy/space/tracks.json)
//   keep: the share of the pieces drawn, the biggest first (the space layer's tier)
// trackTurn(list, t) → THREE.Quaternion: the turn a track gives at t (pure)

import * as THREE from 'three';
import { evalTrack } from '../../lib/three/animTracks';

const SIZES = ['large', 'medium', 'small'];
const DEG = Math.PI / 180;
const MAX_SOLIDS = 60;

export function trackTurn(list = [], t, out = new THREE.Quaternion()) {
  const e = [0, 0, 0];
  for (const c of list) {
    const [part, axis] = String(c.channel).split('.');
    if (part !== 'rotation') continue;
    e['xyz'.indexOf(axis)] = evalTrack(c.keys, t, { loop: c.loop }) * DEG;
  }
  return out.setFromEuler(new THREE.Euler(e[0], e[1], e[2], 'XYZ'));
}

const SPIN = /* glsl */ `
attribute float aTrack;
uniform vec4 uTurn[3];
vec3 rockTurn(vec3 v, vec4 q) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
`;
function turning(material, turns) {
  const m = material.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTurn = turns;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${SPIN}`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec4 rockQ = uTurn[int(aTrack + 0.5)];\nobjectNormal = rockTurn(objectNormal, rockQ);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = rockTurn(transformed, rockQ);');
  };
  m.customProgramCacheKey = () => 'placed-rock-turn';
  return m;
}

export function createPlacedRocks({ pieces = [], models = {}, tracks = {}, keep = 1 } = {}) {
  const group = new THREE.Group();
  const made = [];
  const meshes = [];
  const turns = { value: SIZES.map(() => new THREE.Vector4(0, 0, 0, 1)) };
  const span = (p) => (models[p.model]?.size ?? 0) * Math.max(...p.scale.map(Math.abs));
  const kept = [...pieces].filter((p) => models[p.model]?.scene).sort((a, b) => span(b) - span(a));
  kept.length = Math.ceil(kept.length * Math.min(1, Math.max(0, keep)));
  const byModel = new Map();
  for (const p of kept) (byModel.get(p.model) ?? byModel.set(p.model, []).get(p.model)).push(p);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (const [slug, list] of byModel) {
    const scene = models[slug].scene;
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh) return;
      // (the part's place in its model baked in, so the turn is about the model's own origin)
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      geo.setAttribute('aTrack', new THREE.InstancedBufferAttribute(Float32Array.from(list, (p) => Math.max(0, SIZES.indexOf(p.track))), 1));
      geo.computeBoundingSphere();
      const mat = turning(o.material, turns);
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, j) => mesh.setMatrixAt(j, m.compose(v.fromArray(p.at), q.fromArray(p.quaternion), s.fromArray(p.scale))));
      mesh.computeBoundingSphere();
      made.push(geo, mat);
      meshes.push(mesh);
      group.add(mesh);
    });
  }
  // the biggest, solid to the ship
  const solids = kept
    .filter((p) => span(p) >= 1.2)
    .slice(0, MAX_SOLIDS)
    .map((p, k) => ({ id: `rock-${k}`, at: [...p.at], r: span(p) * 0.4, reach: span(p) * 0.4 }));
  const tq = new THREE.Quaternion();
  return {
    group,
    solids,
    count: kept.length,
    update(t) {
      SIZES.forEach((size, k) => {
        trackTurn(tracks[size], t, tq);
        turns.value[k].set(tq.x, tq.y, tq.z, tq.w);
      });
    },
    dispose() {
      for (const mesh of meshes) mesh.dispose();
      for (const x of made) x.dispose();
      made.length = 0;
      group.removeFromParent();
    },
  };
}
