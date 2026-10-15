// rocksPlaced.js on the node renderer: the rocks a game’s space level
// placed (the second Death Star’s debris over Endor), each where its map
// put it and turning on the game’s own asteroid track for its size, one
// InstancedMesh a part of a model, as the original draws them. The layout,
// the solids and trackTurn are rocksPlaced.js’s, copied: it holds its GLSL
// beside them (FL4 deletes the original, and this copy is the one left).
//
// What differs on the node renderer: each part’s material is its node twin
// (a copy, the model’s own left be), and the turn is a hook on its vertex
// before three instances it (hookNodes’ onPosition, where the GLSL’s
// begin_vertex was), the normal turned with it; uTurn is a uniform array
// node over the same three quaternions update(t) writes, on each material’s
// userData.placedRock.
//
// createPlacedRocks({ pieces, models, tracks, keep = 1 }) → { group, solids, count, update(t), dispose() }
// trackTurn(list, t) → THREE.Quaternion: the turn a track gives at t (pure)

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, cross, int, normalLocal, uniformArray } from 'three/tsl';
import { evalTrack } from '../../../lib/three/animTracks';
import { asNode, onPosition } from '../../../lib/three/hookNodes';

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

// v turned by the unit quaternion q (the GLSL’s rockTurn)
const rockTurn = (v, q) => v.add(cross(q.xyz, cross(q.xyz, v).add(q.w.mul(v))).mul(2.0));

// a copy of the part’s material as a node material, turned about the
// model’s origin by its size’s quaternion, vertex and normal alike
function turning(material, uTurn) {
  const copy = material.clone();
  let m = asNode(copy);
  // (a material three has no node twin for: a standard one in its colour)
  if (!m.isNodeMaterial) m = new MeshStandardNodeMaterial({ color: copy.color ?? 0xffffff, map: copy.map ?? null });
  m.userData = { ...m.userData, placedRock: { uTurn } };
  return onPosition(
    m,
    (position) => {
      const q = uTurn.element(int(attribute('aTrack', 'float').add(0.5))).toVar('rockQ');
      normalLocal.assign(rockTurn(normalLocal, q));
      return rockTurn(position, q);
    },
    'placed-rock-turn',
    { uTurn },
  );
}

export function createPlacedRocks({ pieces = [], models = {}, tracks = {}, keep = 1 } = {}) {
  const group = new THREE.Group();
  const made = [];
  const meshes = [];
  const turns = SIZES.map(() => new THREE.Vector4(0, 0, 0, 1));
  // (one array node for every part: update writes the quaternions in place, the node reads them each render)
  const uTurn = uniformArray(turns, 'vec4');
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
      // (the part’s place in its model baked in, so the turn is about the model’s own origin)
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      geo.setAttribute('aTrack', new THREE.InstancedBufferAttribute(Float32Array.from(list, (p) => Math.max(0, SIZES.indexOf(p.track))), 1));
      geo.computeBoundingSphere();
      const mat = turning(o.material, uTurn);
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
        turns[k].set(tq.x, tq.y, tq.z, tq.w);
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
