// Figures drawn as rows: one Mesh a part (a body part of a kind at a cut, a
// gun), every instance of it one draw. A figure far from the eye costs the
// frame a row of floats here, not an object in three's lists: no skinned
// mesh to project into each pass, no bindings of its own, no joint list sent
// for it and again for the frame before.
//
// A part's instances stand in one RGBA32F texture, two rows an instance (the
// pose now, and the pose of the frame before for the velocity pass), each
// row the root's matrix and then the joints' (pose.js); the vertex stage
// reads its rows by the instance's index (skinNode.js). A frame is
//
//   begin()                               every count to nought; last frame's poses become the "before"
//   place(part, i, skeleton, root, was)   instance i's pose; `was`: the instance it was last frame (-1: new this frame)
//   send()                                the counts to the meshes, the rows in use to the chip, once
//
// with the instances packed from 0 by the caller, so a part draws exactly
// what was placed this frame and nothing is drawn twice or left over. An
// instance new this frame has no "before": it is given its own pose, the
// camera's movement alone for one frame.
//
// The root of a skin is the part's own node, and only its place: three
// skins in the node's frame (bindMatrixInverse) and comes back out through
// the node's world matrix, which cancels its turn and its scale and leaves
// its origin as the point a vertex is pulled about when its weights do not
// sum to one (a file's weights are bytes: off by up to 1/255). Kept as the
// root, the row's vertex lands where three's does. The root of a part with
// no skin is its node's whole world matrix.
//
// A row casts no shadow (the caller's rule: figures past the game's shadow
// distance) and is never culled by three: its instances stand all over the
// level, and the caller places only what the camera sees.
//
// three sends a DataTexture whole on every change (its WebGPU backend reads
// no update range in r186). The rows in use go up through the device's own
// queue where the backend has made the texture, the whole texture through
// three otherwise (its first frame, any other backend): sendRows, the one
// place this folder reaches inside three.
//
//   canDrawRows(renderer) → boolean: the node renderer on WebGPU
//   createFigureRows({ scene, tsl, renderer = null, capacity = 64 }) → {
//     group,
//     part(key, geometry, material, { joints = 0, bindMatrix = null }) → part (one a key),
//     begin(), place(part, i, skeleton | null, root: Matrix4, was = -1), count(part, n), send(),
//     drop(key), stats() → { parts, rows, draws, capacity, sent: { bytes, whole } }, dispose() }
//   sendRows(renderer, texture, data, rows) → 'rows' | 'whole'

import * as THREE from 'three';
import { backendOf } from '../light/three.js';
import { copyRow, growRows, rowLayout, writeRow } from './pose.js';
import { ROWS_AN_INSTANCE, rowNodes } from './skinNode.js';

export const canDrawRows = (renderer) => backendOf(renderer) === 'webgpu' && typeof renderer?.library?.fromMaterial === 'function';

const BYTES_A_TEXEL = 16; // RGBA32F

export function sendRows(renderer, texture, data, rows) {
  const backend = renderer?.backend;
  const made = backend?.has?.(texture) ? backend.get(texture).texture : null;
  const queue = backend?.device?.queue;
  if (!made || !queue?.writeTexture || rows > texture.image.height) {
    texture.image.data = data;
    texture.needsUpdate = true;
    return 'whole';
  }
  const width = texture.image.width;
  queue.writeTexture({ texture: made }, data, { bytesPerRow: width * BYTES_A_TEXEL, rowsPerImage: rows }, { width, height: rows });
  // (three's own copy stays the newest, for when it next sends the whole)
  texture.image.data = data;
  return 'rows';
}

const _inverse = new THREE.Matrix4();
const _place = new THREE.Matrix4();

export function createFigureRows({ scene, tsl, renderer = null, capacity = 64 } = {}) {
  const group = new THREE.Group();
  group.name = 'figureRows';
  scene.add(group);
  const parts = new Map(); // key → part
  let sent = { bytes: 0, whole: 0 }; // last frame's upload
  let gone = false;

  const textureFor = (p) => {
    const t = new THREE.DataTexture(p.data, p.layout.texelsARow, p.capacity * ROWS_AN_INSTANCE, THREE.RGBAFormat, THREE.FloatType);
    t.name = `figureRows:${p.key}`;
    t.needsUpdate = true;
    return t;
  };

  // the node material three would make of the part's own, with the row's vertex stage
  const materialFor = (base, nodes) => {
    const m = base.isNodeMaterial ? base.clone() : (renderer?.library?.fromMaterial?.(base.clone()) ?? base.clone());
    m.positionNode = nodes.position();
    m.userData = { ...base.userData, figureRows: true };
    return m;
  };

  function grow(p, need) {
    let next = p.capacity;
    while (next < need) next *= 2;
    const rows = next * ROWS_AN_INSTANCE;
    p.data = growRows(p.data, p.layout, rows);
    p.last = growRows(p.last, p.layout, rows);
    p.capacity = next;
    const old = p.texture;
    p.texture = textureFor(p);
    p.nodes.rows.value = p.texture;
    old.dispose();
  }

  function drop(key) {
    const p = parts.get(key);
    if (!p) return false;
    parts.delete(key);
    group.remove(p.mesh);
    p.mesh.material.dispose();
    p.texture.dispose();
    return true;
  }

  return {
    group,
    part(key, geometry, material, { joints = 0, bindMatrix = null } = {}) {
      const had = parts.get(key);
      if (had) return had;
      const skinned = Boolean(joints > 0 && geometry.attributes.skinIndex && geometry.attributes.skinWeight);
      const layout = rowLayout(skinned ? joints : 0);
      const size = Math.max(1, capacity) * ROWS_AN_INSTANCE * layout.floatsARow;
      const p = { key, skinned, layout, capacity: Math.max(1, capacity), data: new Float32Array(size), last: new Float32Array(size), n: 0, lastN: 0, texture: null, nodes: null, mesh: null };
      p.texture = textureFor(p);
      p.nodes = rowNodes(tsl, { map: p.texture, skinned, bindMatrix: bindMatrix && !bindMatrix.equals(_place.identity()) ? bindMatrix.clone() : null });
      const mesh = new THREE.Mesh(geometry, materialFor(material, p.nodes));
      mesh.name = `figureRows:${key}`;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.count = 0;
      p.mesh = mesh;
      group.add(mesh);
      parts.set(key, p);
      return p;
    },
    begin() {
      for (const p of parts.values()) {
        [p.data, p.last] = [p.last, p.data];
        p.lastN = p.n;
        p.n = 0;
      }
    },
    place(p, i, skeleton, root, was = -1) {
      if (gone || parts.get(p.key) !== p) return;
      if (i >= p.capacity) grow(p, i + 1);
      const now = i * ROWS_AN_INSTANCE;
      if (p.skinned && skeleton) {
        // (the node's place alone: the note above; and that place as the float32 the row will hold, so
        // what is taken off each joint is exactly what the shader puts back)
        const e = root.elements;
        const x = Math.fround(e[12]);
        const y = Math.fround(e[13]);
        const z = Math.fround(e[14]);
        _place.makeTranslation(x, y, z);
        _inverse.makeTranslation(-x, -y, -z);
        writeRow(p.data, now, p.layout, skeleton, _inverse.elements, _place.elements);
      } else writeRow(p.data, now, p.layout, null, null, root.elements);
      // the frame before: its own row of last frame, or this pose where it had none
      if (was >= 0 && was < p.lastN) p.data.set(p.last.subarray(was * ROWS_AN_INSTANCE * p.layout.floatsARow, (was * ROWS_AN_INSTANCE + 1) * p.layout.floatsARow), (now + 1) * p.layout.floatsARow);
      else copyRow(p.data, p.layout, now, now + 1);
      if (i >= p.n) p.n = i + 1;
    },
    count(p, n) {
      p.n = Math.max(0, Math.min(n, p.capacity));
    },
    send() {
      sent = { bytes: 0, whole: 0 };
      for (const p of parts.values()) {
        p.mesh.count = p.n;
        if (p.n === 0) continue;
        const rows = p.n * ROWS_AN_INSTANCE;
        const how = sendRows(renderer, p.texture, p.data, rows);
        if (how === 'whole') sent.whole++;
        sent.bytes += (how === 'whole' ? p.capacity * ROWS_AN_INSTANCE : rows) * p.layout.floatsARow * 4;
      }
    },
    drop,
    stats() {
      let rows = 0;
      let draws = 0;
      let most = 0;
      for (const p of parts.values()) {
        rows += p.n;
        if (p.n > 0) draws++;
        most = Math.max(most, p.capacity);
      }
      return { parts: parts.size, rows, draws, capacity: most, sent: { ...sent } };
    },
    dispose() {
      gone = true;
      for (const key of [...parts.keys()]) drop(key);
      scene.remove(group);
    },
  };
}
