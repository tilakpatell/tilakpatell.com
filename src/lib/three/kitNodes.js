// kit.js for a 'nodes' world: the same kit, pools and puffs, its materials
// node materials (MeshLambertNodeMaterial, or houseNodes' when a house is
// given) wearing foliageNodes', recolourNodes' and puffsNodes' hooks. The
// rest is kit.js's, copied: it imports the GLSL hooks, which would bring
// their GLSL into a 'nodes' world's closure. Pass it houseNodes' house and
// windNodes' wind. kit.js re-exports this once its last GLSL caller moves.
//
// The kit at run time: the Quaternius packs' family files (public/kit/<pack>/,
// scripts/kit/README.md) loaded once, their materials one a name for the
// whole pack, and their models drawn through keyed instanced pools. A world
// never builds a mesh per tree: a streamed cell, a town or a site hands its
// placements to a pool under a key (`set`), takes them back when it goes
// (`free`), and the pool draws every item of a model in a few instanced
// draws, each item at the level its distance calls for: the full model
// near, its LOD1 further off, a far stand-in (the puff) to twice that,
// nothing beyond. (docs/superpowers/specs/2026-10-08-kit-worlds-design.md, 2)
//
//   loadKit(pack, { load, base, house, wind, manifest, puffs = true,
//     puffWind, tint }) → {
//     pack, manifest: Promise (<base>/<pack>/index.json, fetched unless
//       the option hands it over),
//     info(name) → the model's manifest row (null for one it hasn't; throws
//       before the manifest is in),
//     model(name) → Promise<{ parts, radius, height, kind, tones }>,
//     lod1(name) → Promise<parts>,
//     material(name) → the pack's one material of that name,
//     puff(name) → { geometry, material } | null: the model's far stand-in
//       (lib/three/puffs' puffFor, made once a kit from the manifest's
//       tones, radius, height and trunk, in the kit's house and `puffWind`,
//       createWind's, its cards scattered from a hash of the model's name, so
//       two models of a family differ in silhouette), null for a model
//       without tones, with `puffs` false, or once the kit is disposed of (a
//       pool then draws its LOD1 there, as for a model without tones),
//     dispose() }
//     parts: [{ geometry, material, local: Matrix4, part }] (the galaxy
//     placer's part contract; `local` is the part's place in the model, its
//     node's transform included: the import's meshopt keeps each model's
//     geometry in -1…1 under a move and a scale, so geometry alone draws a
//     tree a seventh of its size. A part that bends is the exception: its
//     geometry is the kit's own copy in metres, its node's transform baked
//     in and its local the identity, as the wind measures a vertex's height
//     before any matrix (foliage.js), and in -1…1 the lower half of a tree
//     would never bend and its top bend a fiftieth of what it should. A
//     rig's are as its file has them, a skinned mesh placed by its bones,
//     for its own mixer, never a pool)
//   kitMaterial(def, { house, wind, tint }) → a new material for a manifest entry
//     tint: a colour ('#rrggbb' or a number) for a material by its manifest
//     name, a world's palette by data (Mustafar's rock black, a jungle's
//     mossed): it stands in for the file's colour, so the map is multiplied
//     by it once, and a leaf's alpha is its map's as before. Or
//     { recolour: colour }: the map's light and shade in that colour in
//     place of its own hue (lib/three/recolour: Lothal's grass straw, a
//     jungle's twisted trees green where the kit painted them red)
//   createPool(kit, name, { bands, cap, shadows, puff, lod1, wait }) → {
//     set(key, items), free(key), shift(dx, dz), update(camera, dt),
//     setBands([near, mid]), bands ([near, mid] now),
//     stats: { total, levels: [full, lod1, puff], sorts }, group, ready, dispose() }
//     items: [{ x, y, z, yaw, scale = 1 }]
//
// A material is the house's Lambert (lib/three/house) when a house is
// given, a plain one when not, wearing the map, the normal map (where the
// manifest lists one) and the colour of the first file to carry its name.
// Whatever the manifest says bends in the wind does, bark and leaves alike,
// scaled by the model's own weight a vertex (three's loader names a GLB's
// _WIND `_wind`; a part that wears a bending material without one has its
// copy given one of ones, so it sways by its height alone and doesn't stand
// frozen; the file's own geometry, the page's model cache's, is never
// changed). Leaves are cut out at 0.3, two-sided, lit as one crown
// (foliage.js's `faceless`), their maps brought under the device's ceiling
// and then given mip levels that keep their coverage (textures.js), or a
// far crown goes bald.
//
// A pool's far band is the model's puff, its crown of cards and its trunk
// in one draw, where the kit makes one (a tree or a bush the import gave
// tones), its instances turned to face the camera about up at every
// re-sort (they are cards; the trunk stands); the LOD1 again where it
// doesn't, each item at its own turn.

import * as THREE from 'three';
import { budget } from '../budgets';
import { detailLevel, modelTexCap } from '../detail';
import { hashSeed } from '../land/spec';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { faceless, wind as windOn } from './foliageNodes';
import { loadGltf } from './gltf';
import { lodBand } from './lod';
import { puffFor } from './puffsNodes';
import { REF, measureMap, recolour } from './recolourNodes';
import { coverageTexture, fitTexture } from './textures';

const CUT = 0.3; // a leaf map's alpha cut
const WEIGHT = '_wind'; // the wind weight's attribute, as three's loader names it
const GROWTH = 1.5; // a pool's capacity, grown by half again when it overflows
const HYSTERESIS = 0.1; // a band edge's dead zone, a share of its distance
const EVERY = 0.5; // seconds between re-sorts
const MOVE = 20; // or metres of camera travel

// A new material for a manifest entry `def` ({ alpha, leaf, wind, maps }):
// the house's (or a plain Lambert), a leaf's cut out and two-sided and lit
// by its crown's normals, and in the wind if `def.wind` says how ('tree',
// 'shrub'), on `wind.time` (and `wind.dir`). Its maps come from a file
// (loadKit). `tint`, when given, is its colour.
export function kitMaterial(def = {}, { house = null, wind = null, tint = null } = {}) {
  const opts = def.leaf ? { alphaTest: CUT, side: THREE.DoubleSide } : {};
  // (a node material from the start, so each hook changes it in place)
  const m = house ? house.material(opts) : new MeshLambertNodeMaterial(opts);
  if (tint?.recolour != null) recolour(m, tint.recolour);
  else if (tint != null) m.color.set(tint);
  if (def.leaf) faceless(m);
  if (def.wind) windOn(m, { kind: def.wind, weight: WEIGHT, time: wind?.time, ...(wind?.dir ? { dir: wind.dir } : {}) });
  return m;
}

// A file's material's look onto the kit's: its colour (the farm animals
// have no maps: their colour is their look), its map, its normal map where
// the manifest lists one (with the file's scale: the loader flips its green
// when it derives tangents), and, a leaf's aside, its sides.
function dress(m, def, src) {
  if (src.color) m.color.copy(src.color);
  m.vertexColors = false;
  if (src.map) m.map = src.map;
  if (def.maps?.normal && src.normalMap) {
    m.normalMap = src.normalMap;
    if (src.normalScale) m.normalScale.copy(src.normalScale);
  }
  if (!def.leaf && src.side != null) m.side = src.side;
  m.needsUpdate = true;
}

// An attribute as plain floats (the files' are quantised shorts and bytes,
// interleaved).
function floats(a) {
  const out = new THREE.BufferAttribute(new Float32Array(a.count * a.itemSize), a.itemSize);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out.setComponent(i, c, a.getComponent(i, c));
  return out;
}

// A bending part's geometry in metres: a copy of the file's (which is the
// page's model cache's, lib/three/gltf, shared by every kit of a pack, and
// so never changed), its positions, normals and tangents as floats with
// `local` applied (the normals turned by its normal matrix), every other
// attribute copied, and a weight of ones where the file gave none.
function bake(geometry, local) {
  const g = geometry.clone();
  for (const name of ['position', 'normal', 'tangent']) if (g.attributes[name]) g.setAttribute(name, floats(geometry.attributes[name]));
  g.applyMatrix4(local);
  if (!g.attributes[WEIGHT]) g.setAttribute(WEIGHT, new THREE.BufferAttribute(new Uint8Array(g.attributes.position.count).fill(255), 1, true));
  return g;
}

function fetchManifest(url) {
  return fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`kit: couldn't load ${url} (${r.status})`))));
}

export function loadKit(pack, { load = loadGltf, base = '/kit', house = null, wind = null, manifest = null, puffs = true, puffWind = null, tint = null } = {}) {
  const root = `${base}/${pack}`;
  let index = null; // the manifest, once in
  let gone = false;
  let warned = false;
  const files = new Map(); // url → Promise<{ scene, roots }>
  const baked = new Map(); // a file's geometry → [{ local, geometry }]: the kit's copies of it in metres
  const mats = new Map(); // name → the kit's material
  const dressed = new Set();
  const models = new Map(); // name → Promise<model>
  const lods = new Map(); // name → Promise<parts>
  const puffed = new Map(); // name → its puff, or null

  const ready = Promise.resolve(manifest ?? fetchManifest(`${root}/index.json`)).then((m) => (index = m));
  ready.catch(() => {});

  function info(name) {
    if (!index) throw new Error(`kit ${pack}: ${name} asked for before the manifest is in (await kit.manifest)`);
    return index.models?.[name] ?? null;
  }

  function material(name) {
    if (!index) throw new Error(`kit ${pack}: material ${name} asked for before the manifest is in (await kit.manifest)`);
    let m = mats.get(name);
    if (!m) {
      const def = index.materials?.[name];
      if (!def) throw new Error(`kit ${pack}: no material ${name} in its manifest`);
      m = kitMaterial(def, { house, wind, tint: tint?.[name] ?? null });
      m.name = name;
      mats.set(name, m);
    }
    return m;
  }

  // A leaf map under the device's ceiling first (the coverage levels are
  // made from it: made from the full map, they'd bring its size back), then
  // its coverage levels; once a map, whichever kit gets to it first (two kits
  // of a pack share the cached file's maps). In a browser, a map a canvas
  // wouldn't read (a tainted one, a decoder's bitmap it couldn't draw) is
  // left to the graphics chip's levels: said once, as the crowns will thin
  // with distance.
  function cover(m) {
    if (!m.map.userData.covered) {
      fitTexture(m.map, modelTexCap());
      coverageTexture(m.map, { cut: CUT });
      m.map.userData.covered = true;
    }
    if (typeof document !== 'undefined' && m.map.generateMipmaps && !warned) {
      warned = true;
      console.warn(`kit ${pack}: ${m.name}'s map keeps the graphics chip's mips (its pixels couldn't be read), so far crowns will thin`);
    }
  }

  // A loaded file taken in: its materials dressed (each name once, from the
  // first file to carry it), its models found by the names the file gave them.
  function adopt(scene) {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material?.name;
      const m = material(name);
      const def = index.materials[name];
      if (!dressed.has(name)) {
        dressed.add(name);
        dress(m, def, o.material);
        // (after the file's colour, in its place: multiplied twice, a
        // tint would come out darker than the world asked; a recolour
        // reads the map's light over its mean, measured now it's in)
        const t = tint?.[name];
        if (t?.recolour != null) m.userData.recolour.uRecolourRef.value = measureMap(m.map) ?? REF;
        else if (t != null) m.color.set(t);
        if (def.leaf && m.map) cover(m);
      }
    });
    const roots = new Map();
    for (const o of scene.children) roots.set(o.userData?.name ?? o.name, o);
    return { scene, roots };
  }

  function fileOf(file) {
    const url = `${root}/${file}`;
    if (!files.has(url)) {
      const p = Promise.resolve(load(url)).then((got) => {
        if (!got?.scene) throw new Error(`kit ${pack}: couldn't load ${url}`);
        if (gone) throw new Error(`kit ${pack}: disposed of while ${url} loaded`);
        return adopt(got.scene);
      });
      p.catch(() => files.delete(url));
      files.set(url, p);
    }
    return files.get(url);
  }

  // A file's geometry at `local` in metres, baked once a kit (a model asked
  // for again, or a mesh two nodes share at one place, gets the same copy).
  function inMetres(geometry, local) {
    const list = baked.get(geometry) ?? baked.set(geometry, []).get(geometry);
    let hit = list.find((b) => b.local.equals(local));
    if (!hit) list.push((hit = { local, geometry: bake(geometry, local) }));
    return hit.geometry;
  }

  // Every mesh under a model's node, each at its place in the model: its
  // matrix relative to the file's root, or, for a part that bends (and isn't
  // skinned), that baked into the kit's copy of its geometry.
  function partsOf(node, scene) {
    scene.updateMatrixWorld(true);
    const inv = scene.matrixWorld.clone().invert();
    const parts = [];
    node.traverse((o) => {
      if (!o.isMesh) return;
      const part = o.geometry.userData?.part ?? 'main';
      const m = material(o.material.name);
      const local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      if (index.materials[o.material.name]?.wind && !o.isSkinnedMesh) parts.push({ geometry: inMetres(o.geometry, local), material: m, local: new THREE.Matrix4(), part });
      else parts.push({ geometry: o.geometry, material: m, local, part });
    });
    return parts;
  }

  // A model's node from its file, once, by name (`suffix` '.lod1' for its LOD1).
  function find(cache, name, suffix, make) {
    if (!cache.has(name)) {
      const p = ready.then(async () => {
        const row = info(name);
        if (!row) throw new Error(`kit ${pack}: no model ${name} in its manifest`);
        const { scene, roots } = await fileOf(row.file);
        if (gone) throw new Error(`kit ${pack}: disposed of while ${name} loaded`);
        const node = roots.get(name + suffix);
        if (!node) throw new Error(`kit ${pack}: ${row.file} has no ${suffix ? `LOD1 of ${name}` : name}`);
        return make(partsOf(node, scene), row);
      });
      p.catch(() => cache.delete(name));
      cache.set(name, p);
    }
    return cache.get(name);
  }

  return {
    pack,
    manifest: ready,
    info,
    material,
    model: (name) => find(models, name, '', (parts, row) => ({ parts, radius: row.radius, height: row.height, kind: row.kind, tones: row.tones ?? null })),
    lod1: (name) => find(lods, name, '.lod1', (parts) => parts),
    puff(name) {
      if (gone) return null; // (a puff made now would have no kit to free it)
      if (!puffed.has(name)) {
        const row = info(name);
        // (seeded by the model's name, so its far crowns differ from another's)
        puffed.set(name, puffs && row?.tones && !row.rig ? puffFor(row.tones, { radius: row.radius, height: row.height, trunk: row.trunk, wind: puffWind, seed: hashSeed(name), house }) : null);
      }
      return puffed.get(name);
    },
    // What the kit made, freed: its materials, its copies in metres and its
    // puffs. The files' geometry and maps are the loader's (the page's model
    // cache), left as they are.
    dispose() {
      gone = true;
      for (const m of mats.values()) m.dispose();
      for (const list of baked.values()) for (const b of list) b.geometry.dispose();
      for (const p of puffed.values()) {
        p?.geometry.dispose();
        p?.material.dispose();
      }
      for (const c of [files, baked, mats, dressed, models, lods, puffed]) c.clear();
    },
  };
}

// ── the pools ──

// An item's place written straight into an instance's 16 floats: its move,
// its turn about up and its size (column-major, as three's), times the
// part's own matrix `b`; `c`, `s` (the turn's cosine and sine times the
// size) another turn than the item's own, the puff's to the camera.
function place(out, o, it, b, c = it.c, s = it.s) {
  const { x, y, z, k } = it;
  for (let j = 0; j < 16; j += 4) {
    const b0 = b[j];
    const b1 = b[j + 1];
    const b2 = b[j + 2];
    const b3 = b[j + 3];
    out[o + j] = c * b0 + s * b2 + x * b3;
    out[o + j + 1] = k * b1 + y * b3;
    out[o + j + 2] = -s * b0 + c * b2 + z * b3;
    out[o + j + 3] = b3;
  }
}

const itemOf = ({ x = 0, y = 0, z = 0, yaw = 0, scale = 1 }) => ({ x, y, z, c: Math.cos(yaw) * scale, s: Math.sin(yaw) * scale, k: scale, band: -1, slot: -1 });

// A pool of one model: an InstancedMesh a part a level (0 the full parts,
// 1 the LOD1's, 2 the `puff` ({ geometry, material }, in the model's own
// frame, its cards facing +Z; the kit's own, kit.puff(name), unless one is
// handed over) or, where there is none, the LOD1's again), all in `group`.
// A puff's instances are turned about up to face the camera the last sort
// was from, each sort (and each shift, which writes them again; a free
// moves one already turned); every other level's keep their item's turn. `bands`
// [near, mid] in metres, across the ground: full within near, LOD1 to mid,
// the puff to twice mid, nothing beyond (lib/budgets' row for the device's
// level unless given, as is `lod1`: false keeps the full parts where the
// LOD1's would be, as ultra does, and so does a model whose LOD1 won't
// load, said once). `setBands` gives it new ones (a world stepping its
// quality down), its items sorted into them at the next update; `bands`
// reads them. Items are re-sorted into levels every half second (from
// a point in it picked at random, `wait` to pick it: pools made together
// don't all sort on one frame) or 20 m of the camera's travel, or at the
// next update after a set. A free (or a set to nothing) takes its items out
// of every level at once, and cheaply: each level's last instance moved into
// a freed slot, nothing else written and nothing sorted (a set over a key
// takes its old items out the same way, its new ones drawn from the next
// update, so no stale instance of a key outlives a free). A shift moves
// every instance there and then, and the camera position the last sort was
// from with them, so it re-bands nothing (`stats.sorts` counts the sorts).
// `cap` instances a level to start, grown by half again whenever the items
// outnumber it (geometry and materials shared; never shrunk). Only the full
// level casts shadows, and only with `shadows`; every level takes them,
// `shadows` or not (ground cover casting none still lies in a tree's
// shade). The parts load in the background (`ready`); items set before
// then are drawn once they're in, and a model that won't load draws
// nothing, said once (`ready` rejects). Wants the kit's manifest in, and
// refuses a rigged model: a pool draws still props.
export function createPool(kit, name, { bands = null, cap = 256, shadows = true, puff = null, lod1 = null, wait: start = Math.random() * EVERY } = {}) {
  const row = kit.info(name);
  if (!row) throw new Error(`createPool: kit ${kit.pack} has no model ${name}`);
  if (row.rig) throw new Error(`createPool: ${name} is rigged, and a pool draws still props`);
  const far = puff ?? kit.puff?.(name) ?? null;
  const level = budget(detailLevel());
  const [near, mid] = bands ?? [level.near, level.mid];
  const edges = [near, mid, 2 * mid];
  const withLod1 = lod1 ?? level.lod1;

  const group = new THREE.Group();
  group.name = `kit:${name}`;
  const keys = new Map(); // key → its items
  const stats = { total: 0, levels: [0, 0, 0], sorts: 0 };
  const parts = [null, null, null]; // each level's, once in
  const slots = [[], [], []]; // each level's items in the order they're drawn (an item's `slot` its place there)
  let meshes = [[], [], []];
  let capacity = Math.max(1, Math.ceil(cap));
  const last = { x: Infinity, z: Infinity }; // where the camera was at the last sort
  let wait = start; // till the half second comes round
  let dirty = true;
  let gone = false;

  function make(lvl, part, i) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.visible = false;
    mesh.castShadow = shadows && lvl === 0;
    mesh.receiveShadow = true;
    mesh.name = `${name}:${lvl}:${i}`;
    mesh.userData.level = lvl;
    group.add(mesh);
    return mesh;
  }

  // Each level's count from its slots; a level with nothing in it is hidden,
  // not drawn empty. The levels in `sent` (a bit a level) were written: sent
  // to the graphics chip again, their bounds found again when next drawn
  // (three works them out over the instances drawn), so culling holds. (A
  // level only made shorter keeps both: what's left is inside its bounds.)
  function counted(sent = 0b111) {
    for (let l = 0; l < 3; l++) {
      const n = slots[l].length;
      stats.levels[l] = n;
      for (const m of meshes[l]) {
        m.count = n;
        m.visible = n > 0;
        if (!(sent & (1 << l))) continue;
        if (n) m.instanceMatrix.needsUpdate = true;
        m.boundingSphere = null;
      }
    }
  }

  // Every item at its band written into its level's meshes, packed from the
  // front, its slot noted.
  function write() {
    for (const list of slots) list.length = 0;
    for (const list of keys.values()) {
      for (const it of list) {
        const l = it.band;
        it.slot = -1;
        if (l < 0 || l > 2) continue;
        it.slot = slots[l].length;
        slots[l].push(it);
        const at = it.slot * 16;
        const ps = parts[l];
        if (!ps) continue;
        // (a puff turned to the camera across the ground: its +Z, (s, 0, c), toward it)
        let { c, s } = it;
        if (l === 2 && far) {
          const dx = last.x - it.x;
          const dz = last.z - it.z;
          const d = Math.hypot(dx, dz);
          if (d > 1e-6 && d < Infinity) {
            c = (dz / d) * it.k;
            s = (dx / d) * it.k;
          }
        }
        for (let i = 0; i < ps.length; i++) place(meshes[l][i].instanceMatrix.array, at, it, ps[i].local.elements, c, s);
      }
    }
    counted();
  }

  // Items taken out of their slots at once, every level: the level's last
  // instance moved into each one's place (its matrix as written, a puff's
  // turn to the camera included), the count one less. Nothing else is
  // written and nothing sorted, so a free costs its own items, not the pool.
  function unslot(list) {
    let sent = 0;
    for (const it of list) {
      const l = it.band;
      const at = slots[l]?.[it.slot] === it ? it.slot : -1;
      it.slot = -1;
      if (at < 0) continue;
      const end = slots[l].length - 1;
      const moved = slots[l].pop();
      if (at === end) continue;
      slots[l][at] = moved;
      moved.slot = at;
      for (const m of meshes[l]) m.instanceMatrix.array.copyWithin(at * 16, end * 16, end * 16 + 16);
      sent |= 1 << l;
    }
    counted(sent);
  }

  function sort(cx, cz) {
    for (const list of keys.values()) for (const it of list) it.band = lodBand(Math.hypot(it.x - cx, it.z - cz), edges, it.band, HYSTERESIS);
    last.x = cx;
    last.z = cz;
    dirty = false;
    stats.sorts += 1;
    write();
  }

  // Room for every item at one level: each mesh swapped for a bigger one
  // holding what it drew (its old instance buffers freed).
  function grow() {
    if (stats.total <= capacity) return;
    while (capacity < stats.total) capacity = Math.ceil(capacity * GROWTH);
    meshes = meshes.map((list, l) =>
      list.map((old, i) => {
        const mesh = make(l, parts[l][i], i);
        mesh.instanceMatrix.array.set(old.instanceMatrix.array);
        mesh.count = old.count;
        mesh.visible = old.visible;
        group.remove(old);
        old.dispose();
        return mesh;
      }),
    );
  }

  const pool = {
    stats,
    group,
    ready: null,
    set(key, items = []) {
      const list = Array.from(items, itemOf);
      if (!list.length) return pool.free(key);
      const was = keys.get(key);
      stats.total += list.length - (was?.length ?? 0);
      keys.set(key, list);
      // (what the key drew till now out at once, as a free takes it: a free
      // before the next sort would find only the new items, never drawn)
      if (was) unslot(was);
      grow();
      dirty = true;
    },
    free(key) {
      const list = keys.get(key);
      if (!list) return;
      keys.delete(key);
      stats.total -= list.length;
      unslot(list);
    },
    shift(dx, dz) {
      for (const list of keys.values())
        for (const it of list) {
          it.x += dx;
          it.z += dz;
        }
      last.x += dx;
      last.z += dz;
      write();
    },
    get bands() {
      return [edges[0], edges[1]];
    },
    setBands([n, m]) {
      edges[0] = n;
      edges[1] = m;
      edges[2] = 2 * m;
      dirty = true;
    },
    update(camera, dt = 0) {
      if (gone) return;
      // (the half second keeps its own beat, whatever else sorts in between)
      wait -= dt;
      const due = wait <= 0;
      if (due) wait = EVERY + (wait % EVERY);
      const { x, z } = camera.position;
      if (dirty || due || !(Math.hypot(x - last.x, z - last.z) < MOVE)) sort(x, z);
    },
    dispose() {
      gone = true;
      group.removeFromParent();
      for (const list of meshes)
        for (const m of list) {
          group.remove(m);
          m.dispose();
        }
      meshes = [[], [], []];
      keys.clear();
      for (const list of slots) list.length = 0;
      stats.total = 0;
      stats.levels.fill(0);
    },
  };

  // (a LOD1 that won't load: the full parts stand in, rather than nothing
  // drawn, said once they're in; a full model that won't load: said once,
  // and the pool draws nothing)
  let lodError = null;
  const lodParts = withLod1
    ? kit.lod1(name).catch((e) => {
        lodError = e;
        return null;
      })
    : null;
  pool.ready = Promise.all([kit.model(name), lodParts]).then(([full, lod]) => {
    if (gone) return pool;
    if (lodError) console.warn(`createPool: ${name}'s LOD1 won't load (${lodError.message}); its full parts stand in`);
    const lod1Parts = lod ?? full.parts;
    parts[0] = full.parts;
    parts[1] = lod1Parts;
    parts[2] = far ? [{ geometry: far.geometry, material: far.material, local: new THREE.Matrix4() }] : lod1Parts;
    meshes = parts.map((list, l) => list.map((p, i) => make(l, p, i)));
    write();
    return pool;
  });
  pool.ready.catch((e) => {
    if (!gone) console.warn(`createPool: ${name} won't load (${e?.message ?? e}); its pool draws nothing`);
  });
  return pool;
}
