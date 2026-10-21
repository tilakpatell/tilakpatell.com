// What every room is built from (the design’s §4.4 and §4.14): the castle’s
// surfaces as materials on the house look, the photo-scanned stone, flags,
// oak and iron worn over them in the world (lib/three/coreNodes’ triplanar
// scans, so a box needs no UVs to look like masonry), and a builder that
// takes a room’s static boxes, cylinders and shapes and bakes them, merged,
// one mesh a material: a room of a few hundred pieces is a few dozen draws.
// What moves or repeats in hundreds (candles, owls, jars, books) is
// instanced by the room itself; what the walk can’t pass is a collider.
//
//   MATS: { name: { colour, scan, metres, strength, rough, metal, glow } }
//   createRoomKit({ tier }) → kit (the house’s look goes on when the room’s group is adopted)
//     kit.mat(name) → the material (made once a kit; a scan worn when it loads)
//     kit.paint(hex, opts) → a plain material in the look, by colour (cloth, paint)
//     kit.glow(hex, k) → an unlit material for flames and lit glass
//     kit.box(mat, x, y, z, w, h, d, { ry, rx, rz }) (y: the box’s foot)
//     kit.cyl(mat, x, y, z, r0, r1, h, { seg, ry, rx, rz, open }) (y: the foot)
//     kit.add(mat, geometry, { at, ry, rx, rz, scale }) (the geometry is the kit’s from then on)
//     kit.solid(x, z, r) → a circle the walk can’t enter (A’s walk takes circles)
//     kit.wall(x0, z0, x1, z1, r) → a run of circles along a line
//     kit.build(group) → { meshes, draws, triangles }: the buckets merged and added
//     kit.colliders → [{ at: [x, z], r }]
//     kit.materials() → every material the kit made (for the room’s reflection, parts/env.js)
//     kit.dispose() → the merged geometry and the materials freed
//   instanced(geometry, material, transforms, { colours }) → THREE.InstancedMesh
//     transforms: [{ at: [x, y, z], ry, rx, rz, s }]
//   countOf(object) → { draws, triangles }: what a group draws, for the budgets

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { loadCore, wear } from '../../../lib/three/coreNodes';

// The castle’s surfaces. Colours are the albedo under the scan (sRGB); a
// scan’s detail is centred on its mean, so the colour is what the eye reads.
export const MATS = {
  stone: { colour: '#77787a', scan: 'stone', metres: 2.6, strength: 0.6 },
  stonedark: { colour: '#55565a', scan: 'stone', metres: 2.6, strength: 0.6 },
  stonewarm: { colour: '#857c70', scan: 'stone', metres: 2.2, strength: 0.6 },
  ashlar: { colour: '#8e8c88', scan: 'stone', metres: 1.6, strength: 0.5 },
  flags: { colour: '#5f5d5a', scan: 'tiles', metres: 2.2, strength: 0.7 },
  rock: { colour: '#55524c', scan: 'rock', metres: 3, strength: 0.75 },
  oak: { colour: '#5c3e27', scan: 'wood', metres: 1.4, strength: 0.6, rough: 0.7 },
  darkoak: { colour: '#3a2719', scan: 'wood', metres: 1.4, strength: 0.6, rough: 0.65 },
  board: { colour: '#7a5a3a', scan: 'wood', metres: 1.2, strength: 0.65, rough: 0.8 },
  iron: { colour: '#2c2b29', scan: 'metal', metres: 0.8, strength: 0.5, rough: 0.55, metal: 0.7 },
  brass: { colour: '#b08a3e', rough: 0.35, metal: 0.95 },
  gold: { colour: '#d4ac4f', rough: 0.28, metal: 1 },
  pewter: { colour: '#8d8f92', rough: 0.4, metal: 0.9 },
  slate: { colour: '#3b3f45', scan: 'rock', metres: 1.4, strength: 0.5 },
  plaster: { colour: '#c8bca6', scan: 'concrete', metres: 2, strength: 0.4 },
  wax: { colour: '#efe6d2', rough: 0.6 },
  parchment: { colour: '#d9c9a3', rough: 0.9 },
};

const TIER_SCANS = { low: false, mid: true, high: true, ultra: true };

export function createRoomKit({ tier = 'high' } = {}) {
  const mats = new Map();
  const buckets = new Map(); // material → [geometry]
  const owned = new Set(); // materials the kit made (freed with it)
  const colliders = [];
  const merged = [];
  let gone = false;

  // (the house’s look goes on when the room’s group is adopted: the scan first, the look last)
  const make = (spec) => {
    const m = new MeshStandardNodeMaterial({ color: new THREE.Color(spec.colour), roughness: spec.rough ?? 0.92, metalness: spec.metal ?? 0 });
    owned.add(m);
    if (spec.scan && TIER_SCANS[tier] !== false)
      loadCore(spec.scan)
        .then((scan) => {
          if (gone || !scan) return;
          wear(m, scan, { metres: spec.metres ?? 2, strength: spec.strength ?? 0.6, normal: 0.85 });
          m.needsUpdate = true;
        })
        .catch(() => {});
    return m;
  };

  const kit = {
    colliders,
    tier,
    mat(name) {
      if (!mats.has(name)) {
        const spec = MATS[name];
        if (!spec) throw new Error(`no material ${name}`);
        mats.set(name, make(spec));
      }
      return mats.get(name);
    },
    paint(hex, { rough = 0.9, metal = 0, side = THREE.FrontSide, scan = null, metres = 1, strength = 0.4 } = {}) {
      const key = `paint:${hex}:${rough}:${metal}:${side}:${scan}`;
      if (!mats.has(key)) {
        const m = scan ? make({ colour: hex, scan, metres, strength, rough, metal }) : new MeshStandardNodeMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: metal, side });
        m.side = side;
        owned.add(m);
        mats.set(key, m);
      }
      return mats.get(key);
    },
    glow(hex, k = 1, { transparent = false, opacity = 1, additive = false } = {}) {
      const key = `glow:${hex}:${k}:${transparent}:${opacity}:${additive}`;
      if (!mats.has(key)) {
        const m = new MeshBasicNodeMaterial({ color: new THREE.Color(hex).multiplyScalar(k), transparent: transparent || additive, opacity, depthWrite: !additive && !transparent, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
        m.userData.noHouse = true;
        owned.add(m);
        mats.set(key, m);
      }
      return mats.get(key);
    },
    // (a material by name, or one already made)
    resolve(m) {
      return typeof m === 'string' ? kit.mat(m) : m;
    },
    add(m, geometry, { at = [0, 0, 0], ry = 0, rx = 0, rz = 0, scale = 1 } = {}) {
      const mat = kit.resolve(m);
      const sc = Array.isArray(scale) ? scale : [scale, scale, scale];
      geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(...sc)));
      if (!buckets.has(mat)) buckets.set(mat, []);
      buckets.get(mat).push(clean(geometry));
      return kit;
    },
    box(m, x, y, z, w, h, d, { ry = 0, rx = 0, rz = 0 } = {}) {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(0, h / 2, 0);
      return kit.add(m, g, { at: [x, y, z], ry, rx, rz });
    },
    cyl(m, x, y, z, r0, r1, h, { seg = 12, ry = 0, rx = 0, rz = 0, open = false } = {}) {
      const g = new THREE.CylinderGeometry(r0, r1, h, seg, 1, open);
      g.translate(0, h / 2, 0);
      return kit.add(m, g, { at: [x, y, z], ry, rx, rz });
    },
    solid(x, z, r) {
      colliders.push({ at: [x, z], r });
      return kit;
    },
    wall(x0, z0, x1, z1, r = 0.35) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.ceil(len / r));
      for (let i = 0; i <= n; i++) colliders.push({ at: [x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n], r });
      return kit;
    },
    build(group, { shadows = tier !== 'low', receive = true } = {}) {
      let draws = 0;
      let triangles = 0;
      for (const [mat, geos] of buckets) {
        const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        for (const x of geos) if (x !== g) x.dispose();
        if (!g) continue;
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = shadows && !mat.userData.noHouse;
        mesh.receiveShadow = receive && !mat.userData.noHouse;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        group.add(mesh);
        merged.push(g);
        draws++;
        triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
      buckets.clear();
      return { draws, triangles };
    },
    materials: () => [...owned],
    dispose() {
      gone = true;
      for (const g of merged) g.dispose();
      for (const geos of buckets.values()) for (const g of geos) g.dispose();
      for (const m of owned) m.dispose();
      merged.length = 0;
      buckets.clear();
    },
  };
  return kit;
}

// one shape for the merge: an index, a position, a normal and a uv, nothing else
function clean(out) {
  if (!out.index) {
    const n = out.attributes.position.count;
    out.setIndex([...Array(n).keys()]);
  }
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(k)) out.deleteAttribute(k);
  if (!out.attributes.normal) out.computeVertexNormals();
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  out.morphAttributes = {};
  out.clearGroups();
  return out;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export function instanced(geometry, material, transforms, { colours = null, shadows = false } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, transforms.length));
  mesh.count = transforms.length;
  transforms.forEach((t, i) => {
    _e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(...t.at);
    const s = t.s ?? 1;
    _s.set(...(Array.isArray(s) ? s : [s, s, s]));
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    if (colours) mesh.setColorAt(i, new THREE.Color(colours[i % colours.length]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadows;
  mesh.computeBoundingSphere();
  return mesh;
}

// what a group draws (meshes visible, instanced counted once a draw, their
// triangles times their instances): the room’s budget, measured the way
// renderer.info counts it, near enough to say in a test
export function countOf(root) {
  let draws = 0;
  let triangles = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry;
    const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    const n = o.isInstancedMesh ? o.count : 1;
    draws += Array.isArray(o.material) ? o.material.length : 1;
    triangles += tris * n;
  });
  return { draws, triangles };
}
