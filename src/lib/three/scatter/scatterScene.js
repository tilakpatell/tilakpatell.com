// The game's terrain scatter drawn round the visitor (fidelity lane N: docs/
// superpowers/specs/2026-10-10-battlefront-fidelity-design.md, "Lane N").
// From a pack's scatter.json (scripts/bf2017-scatter.mjs) and its derived
// mask: one InstancedMesh per mesh and cut (its LOD0 near, its LOD1 past
// LOD1_AT of its reach), refilled from grid.js's tiles as the visitor moves
// REPACK_M, each instance shrunk by the game's dissolve near the end of its
// reach and set on the ground (groundAt). Only the LOD0 band casts shadows:
// it lies within the sun's first cascade. A type whose maps are not in the
// pack yet (`look: 'waits'`) is not drawn; a solid one without them takes
// its named colour (`look: 'colour'`).
//
//   createScatterScene({ scene, json, mask, load, tier, groundAt, wind, nodes })
//     → { update([x, z]), ready() → Promise, stats() → { instances, calls, tris, types }, dispose() }
//
//   json: scatter.json; mask: { data, w, h, minX, minZ, metresPerPixel }
//   load(glbPath) → Promise<{ scene } | null> (the level's loader, which binds the pack's maps)
//   groundAt(x, z) → metres; wind: { time: { value }, dir: Vector2 } (the world's one wind)

import * as THREE from 'three';
import { TILE, dissolveOf, keepShare, reachOf, tileInstances, tilesAround } from './grid.js';
import { applySway, swayOf } from './wind.js';

// metres the visitor walks before the ring is refilled (a dissolve band is
// several metres deep, so a refill every few metres is not seen)
export const REPACK_M = 3;
// the share of its reach past which a type draws its LOD1 (the game's
// Lod0DissolveOutDistanceFactor where a type has one, else this)
export const LOD1_AT = 0.5;
// the tiles kept generated beyond the ring (walking back is free)
const KEEP_TILES = 400;
// a type sinks this share of its height into the ground, so a stone on a
// slope does not stand on one corner
const SINK = 0.08;

export function createScatterScene({ scene, json, mask, load, tier = 'high', groundAt = () => 0, wind = null, nodes = false }) {
  const group = new THREE.Group();
  group.name = 'scatter';
  scene.add(group);
  // the placed layers, and their types in order (grid.js's type index)
  const layers = (json.layers ?? []).filter((l) => l.placed);
  const flat = layers.flatMap((l) => (l.types ?? []).map((t) => ({ ...t, layer: l.index })));
  // per type: its draw (mesh key) and reach, once its mesh has loaded
  const draws = new Map(); // glb mesh name → { lod0, lod1, reach, sway }
  const tiles = new Map(); // 'tx,tz' → instances
  let at = null;
  let gone = false;
  let stats = { instances: 0, calls: 0, tris: 0, types: 0 };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);

  const firstMesh = (root) => {
    let found = null;
    root?.traverse?.((o) => {
      if (!found && o.isMesh) found = o;
    });
    return found;
  };

  async function cut(path, look, sway) {
    const got = path ? await load(path) : null;
    const src = firstMesh(got?.scene);
    if (!src || gone) return null;
    src.updateWorldMatrix(true, false);
    const geometry = src.geometry.clone().applyMatrix4(src.matrixWorld);
    let material = src.material.clone();
    if (look.look === 'colour' && look.rgb) {
      material.color?.setRGB(look.rgb[0], look.rgb[1], look.rgb[2]);
      material.map = null;
    }
    if (wind && sway) material = await applySway(material, sway, { time: wind.time, dir: wind.dir, nodes });
    const tris = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    return { geometry, material, tris, mesh: null, capacity: 0, count: 0 };
  }

  const ready = Promise.all(
    [...new Set(flat.filter((t) => t.glb && t.glb.look !== 'waits' && t.glb.lods?.length).map((t) => t.mesh))].map(async (name) => {
      const t = flat.find((x) => x.mesh === name);
      const height = Math.max(...t.scale.max) * (t.glb.radius || 1);
      const sway = swayOf(t.wind, height);
      const [lod0, lod1] = await Promise.all([cut(t.glb.lods[0]?.glb, t.glb, sway), cut(t.glb.lods[1]?.glb, t.glb, sway)]);
      if (lod0 && !gone) draws.set(name, { lod0, lod1, radius: t.glb.radius || 1 });
    }),
  ).then(() => {
    at = null; // (refill on the next update with every mesh in)
  });

  function instancesOf(tx, tz) {
    const key = `${tx},${tz}`;
    let list = tiles.get(key);
    if (!list) {
      list = tileInstances({ tx, tz, mask, layers, tier });
      // (the ground under each, once a visit: a refill only turns and sizes them)
      for (const it of list) it.y = groundAt(it.x, it.z);
      tiles.set(key, list);
      if (tiles.size > KEEP_TILES) tiles.delete(tiles.keys().next().value);
    }
    return list;
  }

  function put(slot, castShadow) {
    if (!slot) return;
    if (slot.count > slot.capacity || !slot.mesh) {
      if (slot.mesh) {
        group.remove(slot.mesh);
        slot.mesh.dispose();
      }
      slot.capacity = Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(1, slot.count))));
      slot.mesh = new THREE.InstancedMesh(slot.geometry, slot.material, slot.capacity);
      slot.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // (the ring moves with the visitor: one sphere round it would be all the culling buys)
      slot.mesh.frustumCulled = false;
      slot.mesh.castShadow = castShadow;
      slot.mesh.receiveShadow = true;
      group.add(slot.mesh);
      slot.writes = 0;
    }
  }

  function refill([x, z]) {
    // (each type's reach, and the ring's widest)
    const reachOfType = flat.map((t) => (draws.has(t.mesh) ? reachOf(t, draws.get(t.mesh).radius, tier) : 0));
    const widest = Math.max(0, ...reachOfType);
    if (!widest) return;
    const near = tilesAround(x, z, widest);
    const chosen = [];
    for (const [tx, tz] of near) {
      for (const it of instancesOf(tx, tz)) {
        const r = reachOfType[it.type];
        if (!r) continue;
        const d = Math.hypot(it.x - x, it.z - z);
        if (d > r) continue;
        chosen.push(it, d);
      }
    }
    const keep = keepShare(chosen.length / 2, tier);
    for (const slot of draws.values()) {
      slot.lod0.count = 0;
      if (slot.lod1) slot.lod1.count = 0;
    }
    // (two passes: the counts, so each mesh is made big enough, then the matrices)
    const picks = [];
    for (let i = 0; i < chosen.length; i += 2) {
      const it = chosen[i];
      if (it.r >= keep) continue;
      const t = flat[it.type];
      const d = chosen[i + 1];
      const r = reachOfType[it.type];
      const f = dissolveOf(d, r, t.dissolve?.range);
      if (f <= 0.02) continue;
      const draw = draws.get(t.mesh);
      const lodAt = t.dissolve?.lod0Out > 0 ? t.dissolve.lod0Out * 2 : LOD1_AT;
      const slot = draw.lod1 && d > r * Math.min(0.9, lodAt) ? draw.lod1 : draw.lod0;
      slot.count++;
      picks.push(slot, it, f);
    }
    for (const draw of draws.values()) {
      put(draw.lod0, tier !== 'low');
      put(draw.lod1, false);
      draw.lod0.written = 0;
      if (draw.lod1) draw.lod1.written = 0;
    }
    for (let i = 0; i < picks.length; i += 3) {
      const slot = picks[i];
      const it = picks[i + 1];
      const f = picks[i + 2];
      const y = it.y - it.h * SINK * f;
      q.setFromAxisAngle(Y, it.yaw);
      p.set(it.x, y, it.z);
      s.set(it.w * f, it.h * f, it.d * f);
      m4.compose(p, q, s);
      slot.mesh.setMatrixAt(slot.written++, m4);
    }
    let instances = 0;
    let calls = 0;
    let tris = 0;
    for (const draw of draws.values()) {
      for (const slot of [draw.lod0, draw.lod1]) {
        if (!slot?.mesh) continue;
        slot.mesh.count = slot.written;
        slot.mesh.visible = slot.written > 0;
        slot.mesh.instanceMatrix.needsUpdate = true;
        instances += slot.written;
        if (slot.written) {
          calls++;
          tris += slot.written * slot.tris;
        }
      }
    }
    stats = { instances, calls, tris, types: draws.size, keep: +keep.toFixed(3) };
  }

  return {
    update(position) {
      if (gone || !position || !draws.size) return;
      if (at && Math.hypot(position[0] - at[0], position[1] - at[1]) < REPACK_M) return;
      at = [position[0], position[1]];
      refill(at);
    },
    ready: () => ready,
    stats: () => stats,
    tileSize: TILE,
    dispose() {
      gone = true;
      for (const draw of draws.values()) {
        for (const slot of [draw.lod0, draw.lod1]) {
          if (!slot) continue;
          slot.mesh?.dispose();
          slot.geometry.dispose();
          slot.material.dispose();
        }
      }
      draws.clear();
      tiles.clear();
      scene.remove(group);
    },
  };
}
