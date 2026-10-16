// The flight's ground in three.js: the sink ./groundCore.js drives. A leaf's
// transferred buffers go into a slot of one batch (./leafBatch.js: the
// ground one object to the renderer; no normals worked out here: the
// worker's are already right at the edges), under one root group the
// floating origin moves.
// One material for the whole planet: the walkable surfaces' own
// (lib/three/groundLook.js), the planet's palette by height and slope, its
// photo-scanned surface (sand, snow, needles, ash…) close up and seen from
// the air out to a couple of kilometres, layered on the strong tiers
// (splat), so the ground round a landing site looks as it does on foot. The clutter is three pools, one draw a
// kind (lib/three/pool.js), its slots taken as a leaf shows and freed as it
// hides.
//
//   createGround(scene, { rt, spec, tier, palette, warn }) → { update(ship),
//     heightUnder(x, z), stats() (groundCore's, and `geometries`: the leaves
//     in the batch, not yet freed), setTier(tier), materials, dispose() }

import * as THREE from 'three';
import { pool } from '../../../lib/three/pool';
import { groundMaterial as shadeGround } from '../../../lib/three/groundLookNodes';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { cityMaterial } from './nodes';
import { CLUTTER_KINDS, SOLID } from '../../../lib/land/flight/leafMesh';
import { MAX_DEPTH } from '../../../lib/land/flight/quadtree';
import { WORKER, createGroundCore } from './groundCore';
import { createKitClutter } from './kitClutter';
import { createLeafBatch } from './leafBatch';

// slots a kind, at most (halved on low)
export const CAP = { rock: 4000, spire: 600, debris: 2000, trunk: 3000, hive: 300, crystal: 800, block: 2000, tower: 6000, slab: 4000, needle: 4000, hero: 300 };
// the city kinds the film-made tower stands in for, close up
const CITY = new Set(['tower', 'needle']);

// the scans close to the ground: the walking view fades them out by 90 m;
// the ship keeps them to 120 m, so they come in as it comes down to land,
// and past that the palette's own colour and noise carry the ground (a 6 m
// tile seen from a cruising ship repeats as a grid across the land)
export const SCAN_FADE = { near: 20, far: 120 };

// the planet as the ground material reads a site: its ground look, its water
export function siteOf(spec) {
  const g = spec.ground ?? { palette: { ...spec.palette, hLow: 0, hHigh: 120 } };
  return { ground: { ...g, detailLook: { ...(g.detailLook ?? {}), ...SCAN_FADE } }, water: spec.water ?? null };
}

function groundMaterial(spec, tier) {
  const { material } = shadeGround(siteOf(spec), { small: tier === 'low', splat: tier === 'high' || tier === 'ultra' });
  material.name = 'flight-ground';
  return material;
}

// the clutter's shapes, code-built (a row's scale is 0.7…1.3 of each, times
// its planet's `size` for the kind)
function clutterGeometry(kind) {
  // a tree: a bare trunk and a crown, 80 m (Endor's redwoods; scaled down, an orchard's)
  if (kind === 'trunk') {
    const trunk = new THREE.CylinderGeometry(1.6, 2.6, 60, 6);
    trunk.translate(0, 30, 0);
    const crown = new THREE.ConeGeometry(9, 30, 6);
    crown.translate(0, 64, 0);
    return merge([trunk, crown]);
  }
  // a hive: a lumpy tapering tower, 60 m (Geonosis's)
  if (kind === 'hive') {
    const g = new THREE.CylinderGeometry(3, 9, 60, 7, 4);
    g.translate(0, 30, 0);
    return g;
  }
  // a crystal: a long octahedron, 20 m, leaning (Cybertron's Manganese forests)
  if (kind === 'crystal') {
    const g = new THREE.OctahedronGeometry(4, 0);
    g.scale(0.8, 2.6, 0.8);
    g.rotateZ(0.2);
    g.translate(0, 9, 0);
    return g;
  }
  // a city's towers, 100 m tall at scale 1 within SOLID's footprints: a
  // stepped tower with a spire, a broad slab, a round needle (Galactic City's
  // three silhouettes; the film-made tower stands in close up)
  if (kind === 'tower') {
    const r = SOLID.tower.r;
    const tiers = [
      [r * 2, 40, 0],
      [r * 1.6, 30, 40],
      [r * 1.1, 22, 70],
    ].map(([w, h, y]) => new THREE.BoxGeometry(w, h, w).translate(0, y + h / 2, 0));
    const spire = new THREE.CylinderGeometry(0.4, 1.4, 8, 6).translate(0, 96, 0);
    return merge([...tiers, spire]);
  }
  if (kind === 'slab') {
    const r = SOLID.slab.r;
    return merge([new THREE.BoxGeometry(r * 2, 70, r * 1.1).translate(0, 35, 0), new THREE.BoxGeometry(r * 1.6, 30, r * 0.8).translate(0, 85, 0)]);
  }
  if (kind === 'needle') {
    const r = SOLID.needle.r;
    return merge([new THREE.CylinderGeometry(r * 0.65, r, 88, 12).translate(0, 44, 0), new THREE.ConeGeometry(r * 0.65, 12, 12).translate(0, 94, 0)]);
  }
  // a block: a 6 m cube on the ground (the pixel world's)
  if (kind === 'block') {
    const g = new THREE.BoxGeometry(6, 6, 6);
    g.translate(0, 3, 0);
    return g;
  }
  if (kind === 'rock') {
    const g = new THREE.IcosahedronGeometry(3, 0);
    g.scale(1.2, 0.6, 1);
    g.translate(0, 0.6, 0);
    return g;
  }
  if (kind === 'spire') {
    const g = new THREE.ConeGeometry(3, 26, 5);
    g.translate(0, 12, 0);
    return g;
  }
  const g = new THREE.BoxGeometry(4, 1.4, 2.6);
  g.rotateZ(0.25);
  g.translate(0, 0.4, 0);
  return g;
}

// several geometries as one (each non-indexed, so their attributes line up)
function merge(parts) {
  const flat = parts.map((g) => g.toNonIndexed());
  const n = flat.reduce((a, g) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  for (const g of parts) g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}


// the film-made tower (galaxy/surface/catalog's corutower) as one geometry
// standing on y = 0, 100 m tall, its material as made; null if it has none
export function heroOf(root) {
  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => o.isMesh && meshes.push(o));
  if (!meshes.length) return null;
  // (read through the accessors: the made models' positions are quantised,
  // KHR_mesh_quantization's integers, which a matrix applied in place would
  // overflow; and copied a value at a time: a spread of a few hundred
  // thousand overflows the stack)
  const count = meshes.reduce((a, o) => a + (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count), 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let hasUv = true;
  const v = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  let o3 = 0;
  for (const o of meshes) {
    const g = o.geometry;
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    if (!U) hasUv = false;
    nm.getNormalMatrix(o.matrixWorld);
    const n = g.index ? g.index.count : P.count;
    for (let k = 0; k < n; k++, o3++) {
      const i = g.index ? g.index.getX(k) : k;
      v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld);
      pos[o3 * 3] = v.x;
      pos[o3 * 3 + 1] = v.y;
      pos[o3 * 3 + 2] = v.z;
      if (N) {
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        nor[o3 * 3] = v.x;
        nor[o3 * 3 + 1] = v.y;
        nor[o3 * 3 + 2] = v.z;
      }
      if (U) {
        uv[o3 * 2] = U.getX(i);
        uv[o3 * 2 + 1] = U.getY(i);
      }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (meshes.every((o) => o.geometry.attributes.normal)) out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  else out.computeVertexNormals();
  if (hasUv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingBox();
  const b = out.boundingBox;
  const k = 100 / Math.max(1e-3, b.max.y - b.min.y);
  out.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  out.scale(k, k, k);
  return { geometry: out, material: meshes[0].material };
}

// A pool that draws only as far as its highest slot in use: an instanced
// mesh sends every instance it counts to the graphics chip, slots scaled to
// nothing among them, and 300 empty film-made towers are 5.7 million
// triangles a frame. (lib/three/pool's take hands out the lowest free slot
// first, so the slots in use stay packed low.)
function counted(p) {
  p.mesh.count = 0;
  const take = p.take;
  const free = p.free;
  const used = new Set();
  p.take = () => {
    const i = take();
    if (i >= 0) {
      used.add(i);
      if (i + 1 > p.mesh.count) p.mesh.count = i + 1;
    }
    return i;
  };
  p.free = (i) => {
    free(i);
    used.delete(i);
    while (p.mesh.count > 0 && !used.has(p.mesh.count - 1)) p.mesh.count--;
  };
  return p;
}

function three(scene, spec, tier, palette, kitsOf, house) {
  const root = new THREE.Group();
  root.name = 'flight-ground';
  scene.add(root);
  const material = groundMaterial(spec, tier);
  const colours = { rock: spec.palette.rock, spire: spec.palette.accent, debris: palette[4], trunk: spec.palette.high, hive: spec.palette.rock, crystal: spec.palette.accent, block: spec.palette.rock };
  // a pool only for the kinds this planet names: one draw each
  const named = new Set((spec.clutter ?? []).flatMap((c) => c.kinds ?? [c.kind]));
  // (the facades lighter than the floor: Galactic City's pale stone and metal at dusk)
  const city = [...named].some((k) => SOLID[k]) ? cityMaterial(new THREE.Color(spec.palette.high).lerp(new THREE.Color('#c8bcb0'), 0.6)) : null;
  const cap = (kind) => (tier === 'low' ? CAP[kind] / 2 : CAP[kind]);
  const pools = CLUTTER_KINDS.map((kind) => {
    if (!named.has(kind)) return null;
    const material = SOLID[kind] ? city : new MeshLambertNodeMaterial({ color: colours[kind], flatShading: true });
    const p = counted(pool(clutterGeometry(kind), material, cap(kind), `flight-${kind}`));
    p.mesh.castShadow = p.mesh.receiveShadow = false;
    root.add(p.mesh);
    return p;
  });
  // the kits' models for the kinds the planet names one for (./kitClutter.js): the rest stay code-built
  const kits = kitsOf?.(root, { spec, tier, house }) ?? null;
  // the film-made tower, once it's in (heroTower): the city's nearest leaves wear it
  let hero = null;
  // (the pool reads plain arrays)
  const pos = [0, 0, 0];
  const q = [0, 0, 0, 1];

  // (the leaves one object, ./leafBatch.js: the node renderer pays its
  // per-object cost once for the whole ground; 192 slots hold the 149 to
  // 160 leaves Hoth's start keeps at High, so the batch is not made again
  // mid-flight, a frame's whole-ground copy, on the tiers that stream most)
  const leaves = createLeafBatch(material, { slots: 192, parent: root });
  return {
    root,
    live: () => leaves.live(),
    materials: [material, ...new Set(pools.filter(Boolean).map((p) => p.mesh.material))],
    // the film-made tower's geometry and material (heroOf's): from now on the
    // city's nearest leaves stand it in for their towers and needles
    heroTower(made) {
      if (hero || !made || !city) return null;
      hero = counted(pool(made.geometry, made.material, cap('hero'), 'flight-hero'));
      hero.mesh.castShadow = hero.mesh.receiveShadow = false;
      root.add(hero.mesh);
      return hero.mesh;
    },
    add(leaf, a) {
      return leaves.add(leaf, a);
    },
    show(slot, on) {
      leaves.show(slot, on);
    },
    remove(slot) {
      leaves.remove(slot);
    },
    clutterAdd(all, leaf) {
      const slots = [];
      const kitted = kits?.add(all);
      const rows = kitted?.key ? kitted.rest : all;
      for (let i = 0; i < (kitted?.kitted ?? 0); i++) slots.push(['kit', kitted.key]);
      const near = hero && leaf?.d === MAX_DEPTH;
      for (let r = 0; r < rows.length; r += 6) {
        const kind = near && CITY.has(CLUTTER_KINDS[rows[r + 5]]) ? 'hero' : rows[r + 5];
        const p = kind === 'hero' ? hero : pools[kind];
        const i = p?.take() ?? -1;
        // (a pool full: that one isn't drawn, nothing else gives)
        if (i < 0) continue;
        pos[0] = rows[r];
        pos[1] = rows[r + 1];
        pos[2] = rows[r + 2];
        // a turn about the vertical, as a quaternion
        q[1] = Math.sin(rows[r + 3] / 2);
        q[3] = Math.cos(rows[r + 3] / 2);
        p.place(i, pos, q, rows[r + 4]);
        // (one slot an entry: the core counts the clutter by them)
        slots.push([kind, i]);
      }
      return slots;
    },
    clutterFree(slots) {
      for (const [kind, i] of slots) (kind === 'kit' ? kits : kind === 'hero' ? hero : pools[kind]).free(i);
    },
    moveTo(at) {
      root.position.set(-at[0], -at[1], -at[2]);
    },
    tick: (ship) => kits?.update(ship),
    kitStats: () => kits?.stats() ?? null,
    dispose() {
      scene.remove(root);
      kits?.dispose();
      for (const p of new Set(pools)) p?.dispose();
      // (the hero's geometry is ours, its material the loaded model's: the asset cache's to free)
      if (hero) hero.mesh.geometry.dispose();
      leaves.dispose();
      material.dispose();
    },
  };
}

// (the kits' maps are read on a canvas: with no page, in Node, the clutter stays code-built)
const pageKits = (root, opts) => (typeof document === 'undefined' ? null : createKitClutter(root, opts));

export function createGround(scene, { rt, spec, tier = 'mid', palette, warn, kits = pageKits, house = null }) {
  rt.workers.define(WORKER, () => new Worker(new URL('./terrain.worker.js', import.meta.url), { type: 'module' }));
  const sink = three(scene, spec, tier, palette, kits, house);
  const core = createGroundCore({ workers: rt.workers, sink, spec, tier, warn });
  core.origin(rt.origin?.at ?? [0, 0, 0]);
  return {
    root: sink.root,
    materials: sink.materials,
    update: (ship) => {
      core.update(ship);
      sink.tick(ship);
    },
    heightUnder: (x, z) => core.heightUnder(x, z),
    origin: (at) => core.origin(at),
    setTier: (t) => core.setTier(t),
    heroTower: (made) => sink.heroTower(made),
    stats: () => ({ ...core.stats(), geometries: sink.live(), kit: sink.kitStats() }),
    dispose() {
      core.dispose();
      sink.dispose();
    },
  };
}
