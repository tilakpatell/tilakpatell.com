// A capital ship's parts that can be shot off it: its subsystems (the shield
// generators, the bridge, the reactor: universe/wars.js's SUBSYSTEMS) and
// its batteries (TURRETS), each the very piece of the model a bolt has to
// hit, so when one's hp runs out the piece itself is torn off the hull and
// tumbles away, burning, and the hull's left scorched where it stood. And
// the ship itself in three (bow, middle and stern) for when it breaks up.
//
// A part is the model's own separate pieces (each run of triangles that
// share corners) whose middle is within the part's reach of its place and
// that are no bigger than that reach (`part: 'model'` in SUBSYSTEMS): the
// Star Destroyer's two domes, its bridge, the reactor's bulb under its hull.
// Where a model has nothing there to take (a single welded mesh, or a hull
// with no dome on it), the part is built (`part: 'built'`): a dome for a
// shield generator, a block with its windows lit for a bridge, a bulb with
// a glowing ring for a reactor, in the ship's own grey. A battery is the
// model's own pieces round it, where it has any.
// The places are shares of the ship's length on the hull it's drawn with
// (scripts/capital-parts.mjs measures them), the same the battle hits, so
// what's hit is what's seen and what goes is what was hit.
//
// cutParts(holder, kind) → { holder, ids } (cutting(…), the same a step at a
//   time, a generator whose return is that): a copy of a loaded model's holder
//   (galaxy/models.js's, centred, nose +z, 1 long) with its parts and its
//   three sections apart, each a mesh of its own sharing the model's
//   geometry's attributes and materials (`userData.part`, `userData.section`).
// partsOf(root) → { ids, has(id), knock(id) → meshes | null, gone, sections() }:
//   a slot's copy's parts; a knocked part's meshes are handed back to be
//   flung (and never shown again on that copy); `gone` the ids knocked.
// piecesOf(meshes, { at, reach }) and reachOf(part): the rule, for the
//   script; componentsOf(index, position, count) → the runs of triangles.
// partSpecs(kind) → [{ id, kind, at, r, reach, low, build }]

import * as THREE from 'three';
import { SUBSYSTEMS, TURRETS } from '../universe/wars';

// what's built where the model has nothing to take, by the subsystem's kind
const BUILD = { shieldgen: 'dome', bridge: 'block', reactor: 'bulb' };
// how far round its place a part reaches, as a share of its hit radius: the
// hit sphere sits inside the piece, the piece a little wider than it
const REACH = 1.35;
// a battery's own reach, a share of the length (a turret is a few tens of metres)
const BATTERY = 0.014;
// where the ship breaks: the middle third's ends, shares of its length from the middle
export const SECTIONS = [-0.17, 0.17];
// the built parts' grey, by kind (the hull's own, near enough), a dielectric's
// paint as the hulls' are (capitalLook.js's PAINT)
const GREY = { destroyer: '#8d9196', executor: '#6c7076', interdictor: '#8a8e93', venator: '#9a9a98', moncal: '#8f979c', providence: '#77808c', lucrehulk: '#8a7a62', gozanti: '#9c9fa2' };

export const reachOf = (p) => p.reach ?? p.r * REACH;

export function partSpecs(kind) {
  const subs = (SUBSYSTEMS[kind] ?? []).filter((s) => s.part).map((s) => ({ id: s.id, kind: s.kind, at: s.at, r: s.r, reach: s.reach, low: s.low, build: s.part === 'built' ? BUILD[s.kind] : null }));
  const batteries = (TURRETS[kind] ?? []).map((at, i) => ({ id: `battery-${i}`, kind: 'battery', at, r: BATTERY, build: null }));
  return [...subs, ...batteries];
}

// ── the model's separate pieces ──
// The runs of triangles that share corners (a corner shared by position as
// well as by number: a hard edge splits a vertex in two, and a dome's two
// halves are still one dome). index: the triangles' corners (count of them);
// position: an attribute with getX/getY/getZ. → [[triangle numbers]…]
export function componentsOf(index, position, count) {
  const n = position.count;
  const up = new Int32Array(n);
  for (let i = 0; i < n; i++) up[i] = i;
  const find = (a) => {
    while (up[a] !== a) a = up[a] = up[up[a]];
    return a;
  };
  const join = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) up[a] = b;
  };
  // (a corner's place as one whole number: its box in 2^17 steps a side, so
  // the three fit in a double exactly, no string made a corner)
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const p = [position.getX(i), position.getY(i), position.getZ(i)];
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p[a]);
      hi[a] = Math.max(hi[a], p[a]);
    }
  }
  const STEPS = 131072;
  const per = [0, 1, 2].map((a) => STEPS / Math.max(hi[a] - lo[a], 1e-9));
  const at = new Map();
  for (let i = 0; i < n; i++) {
    const qx = Math.round((position.getX(i) - lo[0]) * per[0]);
    const qy = Math.round((position.getY(i) - lo[1]) * per[1]);
    const qz = Math.round((position.getZ(i) - lo[2]) * per[2]);
    const key = (qx * (STEPS + 1) + qy) * (STEPS + 1) + qz;
    const j = at.get(key);
    if (j === undefined) at.set(key, i);
    else join(i, j);
  }
  const corner = (k) => (index ? index.getX(k) : k);
  for (let k = 0; k + 2 < count; k += 3) {
    join(corner(k), corner(k + 1));
    join(corner(k), corner(k + 2));
  }
  const runs = new Map();
  for (let k = 0; k + 2 < count; k += 3) {
    const r = find(corner(k));
    if (!runs.has(r)) runs.set(r, []);
    runs.get(r).push(k / 3);
  }
  return [...runs.values()];
}

const pieces = new WeakMap(); // a geometry → its runs, each with its box in the geometry's own space
function runsOf(geometry) {
  if (pieces.has(geometry)) return pieces.get(geometry);
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const count = index ? index.count : pos.count;
  const v = new THREE.Vector3();
  const runs = componentsOf(index, pos, count).map((tris) => {
    const box = new THREE.Box3();
    for (const t of tris) for (let c = 0; c < 3; c++) box.expandByPoint(v.fromBufferAttribute(pos, index ? index.getX(t * 3 + c) : t * 3 + c));
    return { tris, box };
  });
  pieces.set(geometry, runs);
  return runs;
}

// the pieces of these meshes (their matrixWorld: into the ship's unit
// frame) a part at `at` reaching `reach` takes (none whose middle is under
// `low`, where it has one: the tower a bridge stands on stays): [{ mesh, tris }]
export function piecesOf(meshes, { at, reach, low = -Infinity }) {
  const out = [];
  for (const mesh of meshes) {
    const tris = taking(placedRuns(mesh), at, reach, low);
    if (tris.length) out.push({ mesh, tris: Uint32Array.from(tris) });
  }
  return out;
}
// a mesh's pieces in the ship's frame: each one's middle and half its box's diagonal
function placedRuns(mesh) {
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  return runsOf(mesh.geometry).map((run) => {
    box.copy(run.box).applyMatrix4(mesh.matrixWorld);
    return { mid: box.getCenter(new THREE.Vector3()), half: box.getSize(size).length() / 2, tris: run.tris };
  });
}
// the triangles of the placed pieces a part at `at` reaching `reach` takes
function taking(runs, at, reach, low) {
  const tris = [];
  for (const run of runs) {
    const { mid } = run;
    if (run.half <= reach && mid.y >= low && Math.hypot(mid.x - at[0], mid.y - at[1], mid.z - at[2]) <= reach) for (const t of run.tris) tris.push(t);
  }
  return tris;
}

// ── cutting a model ──
// a geometry of the same attributes drawing only these triangles
function drawing(src, tris) {
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) g.setAttribute(name, attr);
  const index = src.index;
  const corners = new Uint32Array(tris.length * 3);
  tris.forEach((t, i) => {
    for (let c = 0; c < 3; c++) corners[i * 3 + c] = index ? index.getX(t * 3 + c) : t * 3 + c;
  });
  g.setIndex(new THREE.BufferAttribute(corners, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// a mesh beside `src` (the same parent and place) drawing `geometry`
function beside(src, geometry, data) {
  const o = new THREE.Mesh(geometry, src.material);
  o.position.copy(src.position);
  o.quaternion.copy(src.quaternion);
  o.scale.copy(src.scale);
  o.name = src.name;
  Object.assign(o.userData, data);
  src.parent.add(o);
  return o;
}

// the built parts' shapes, a unit across (scaled to the part), standing on +y
let SHAPES = null;
const shapes = () =>
  (SHAPES ??= {
    dome: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    collar: new THREE.CylinderGeometry(1.08, 1.16, 0.22, 20),
    block: new THREE.BoxGeometry(2.4, 0.8, 1.3),
    windows: new THREE.BoxGeometry(2.2, 0.12, 0.04),
    bulb: new THREE.SphereGeometry(1, 20, 12),
    ring: new THREE.TorusGeometry(0.99, 0.045, 6, 28),
  });
const looks = new Map(); // a kind → its built parts' materials (shared by every copy)
function looksOf(kind) {
  if (!looks.has(kind)) looks.set(kind, { hull: new THREE.MeshStandardMaterial({ color: GREY[kind] ?? '#8a8e94', roughness: 0.58, metalness: 0 }), lit: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.45, 2.1), toneMapped: false }) });
  return looks.get(kind);
}
export function disposeLooks() {
  for (const l of looks.values()) for (const m of Object.values(l)) m.dispose();
  looks.clear();
  if (SHAPES) for (const g of Object.values(SHAPES)) g.dispose();
  SHAPES = null;
}

// a built part at `spec.at`, its top away from the hull (down under the keel)
function build(spec, kind, k) {
  const { hull, lit } = looksOf(kind);
  const s = shapes();
  const g = new THREE.Group();
  const add = (geo, mat, [x, y, z], [sx, sy, sz]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.userData.part = spec.id;
    g.add(m);
  };
  if (spec.build === 'dome') {
    add(s.collar, hull, [0, 0.05, 0], [1, 1, 1]);
    add(s.dome, hull, [0, 0.15, 0], [1, 0.92, 1]);
  } else if (spec.build === 'block') {
    add(s.block, hull, [0, 0.4, 0], [1, 1, 1]);
    add(s.windows, lit, [0, 0.5, 0.66], [1, 1, 1]);
  } else {
    add(s.bulb, hull, [0, 0.2, 0], [1, 0.72, 1]);
    add(s.ring, lit, [0, 0.2, 0], [1, 1, 1]);
    g.children.at(-1).rotation.x = Math.PI / 2;
  }
  // (its middle at the hit's: its foot that far toward the hull)
  const r = spec.r;
  const down = spec.at[1] < 0 ? -1 : 1;
  g.scale.setScalar(r / k);
  if (down < 0) g.rotation.x = Math.PI;
  g.position.set(spec.at[0] / k, (spec.at[1] - down * 0.45 * r) / k, spec.at[2] / k);
  return g;
}

// (the cut all at once: a test's, the script's)
export function cutParts(template, kind, specs = partSpecs(kind)) {
  const run = cutting(template, kind, specs);
  for (;;) {
    const r = run.next();
    if (r.done) return r.value;
  }
}

// The cut a step at a time (a generator: each next() a mesh's worth of it,
// a few milliseconds), for spare time between frames: a Star Destroyer's
// whole cut is 60 to 100 ms on a desktop, a hitch if it were one.
export function* cutting(template, kind, specs = partSpecs(kind)) {
  const holder = template.clone(true);
  holder.position.set(0, 0, 0);
  holder.quaternion.identity();
  holder.updateMatrixWorld(true);
  const k = holder.scale.x;
  const meshes = [];
  // (not a nozzles' glow, and not one drawn in several materials by its groups)
  holder.traverse((o) => o.isMesh && !o.userData.glows && !(Array.isArray(o.material) && o.geometry.groups?.length) && meshes.push(o));
  // (each mesh's pieces found and placed first, one a step: the costly part)
  const placed = new Map();
  for (const mesh of meshes) {
    placed.set(mesh, placedRuns(mesh));
    yield;
  }
  // each piece to the nearest part that takes it
  const taken = new Map(); // a mesh → Map(triangle → part id)
  const counts = new Map(specs.map((s) => [s.id, 0]));
  for (const spec of specs) {
    if (spec.build) continue; // (a built part takes nothing of the model's)
    const pieces = [];
    for (const mesh of meshes) {
      const tris = taking(placed.get(mesh), spec.at, reachOf(spec), spec.low ?? -Infinity);
      if (tris.length) pieces.push({ mesh, tris });
    }
    yield;
    for (const { mesh, tris } of pieces) {
      if (!taken.has(mesh)) taken.set(mesh, new Map());
      const own = taken.get(mesh);
      for (const t of tris) {
        const had = own.get(t);
        if (had && dist(specs.find((s) => s.id === had).at, mesh, t) <= dist(spec.at, mesh, t)) continue;
        if (had) counts.set(had, counts.get(had) - 1);
        own.set(t, spec.id);
        counts.set(spec.id, counts.get(spec.id) + 1);
      }
    }
  }
  const ids = [];
  // the built ones: the subsystems the model has (next to) nothing for
  for (const spec of specs) {
    const built = Boolean(spec.build);
    if (built) holder.add(build(spec, kind, k));
    if (built || counts.get(spec.id) > 0) ids.push(spec.id);
  }
  // each mesh in its parts and its three sections
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    const own = taken.get(mesh) ?? new Map();
    const pos = mesh.geometry.attributes.position;
    const index = mesh.geometry.index;
    const count = (index ? index.count : pos.count) / 3;
    const byPart = new Map();
    const bySection = [[], [], []];
    for (let t = 0; t < count; t++) {
      const id = own.get(t);
      if (id) {
        if (!byPart.has(id)) byPart.set(id, []);
        byPart.get(id).push(t);
        continue;
      }
      // (its triangle's middle along the ship)
      let z = 0;
      for (let c = 0; c < 3; c++) z += v.fromBufferAttribute(pos, index ? index.getX(t * 3 + c) : t * 3 + c).applyMatrix4(mesh.matrixWorld).z / 3;
      bySection[z < SECTIONS[0] ? 0 : z > SECTIONS[1] ? 2 : 1].push(t);
    }
    for (const [id, tris] of byPart) beside(mesh, drawing(mesh.geometry, tris), { part: id });
    const used = bySection.filter((s) => s.length);
    if (used.length === 1 && !byPart.size) {
      mesh.userData.section = bySection.indexOf(used[0]);
      continue;
    }
    bySection.forEach((tris, i) => tris.length && beside(mesh, drawing(mesh.geometry, tris), { section: i }));
    mesh.removeFromParent();
    yield;
  }
  return { holder, ids };
}
// how far a triangle's first corner is from a part's place (in the unit frame)
const far = new THREE.Vector3();
function dist(at, mesh, t) {
  const index = mesh.geometry.index;
  far.fromBufferAttribute(mesh.geometry.attributes.position, index ? index.getX(t * 3) : t * 3).applyMatrix4(mesh.matrixWorld);
  return Math.hypot(far.x - at[0], far.y - at[1], far.z - at[2]);
}

// ── a copy's parts ──
export function partsOf(root) {
  const parts = new Map();
  const sections = [[], [], []];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.part) {
      if (!parts.has(o.userData.part)) parts.set(o.userData.part, []);
      parts.get(o.userData.part).push(o);
    } else if (o.userData.section !== undefined) sections[o.userData.section].push(o);
  });
  const gone = new Set();
  return {
    ids: [...parts.keys()],
    gone,
    has: (id) => parts.has(id) && !gone.has(id),
    // its meshes, to be flung off (the copy never draws them again)
    knock(id) {
      if (!parts.has(id) || gone.has(id)) return null;
      gone.add(id);
      return parts.get(id);
    },
    // the hull in its three sections, bow last (each a list of meshes; a built part goes with the middle)
    sections: () => sections,
  };
}
