// A level pack from the game's map (lane L: docs/superpowers/specs/2026-10-10-
// bf2017-levels-lighting-sabers-design.md, "How a level draws"). The map
// (`web/maps/<level>/<level>.json` + `.bin`) says where every model of the
// level sits; this picks the arena's sub-levels, rebases them on the site's
// landing spot, cuts them into cells, holds each tier to its budget row and
// writes the pack's `level.json` and bins. Pure: the CLI
// (scripts/bf2017-level.mjs) fetches, reads files and writes them.
//
//   readMap(json, bin) → { instances, meshOf, groups, meshes, subworlds, terrain, sky, vehicleSpawns }
//   mainSubs(map), arenaOf(map, { subs, drop }) → instance indices
//   subset(instances, indices), rebase(instances, origin, yaw) → instances in the site's frame
//   packCell(cell, instances) → { bin, draws }
//   terrainFrame(record), heightsLayer(record, png) → the record's frame; an image layer
//   cropHeights(src, frame, { minX, minZ, size, metresPerPixel }) → Uint16Array
//   buildPack({ world, mapName, map, spot, groundY, meshes, groundAt, … }) → { json, files, table, counts }
//     (groundAt(x, z): the pack's ground in the site's frame; what is under it is left out,
//     but for what stands in the game's holes, holeAt(x, z))
//   meshCuts(entry, { ultra }) → { far, lod1, plain, ultra } LOD entries
//   rewriteImageUris(glb, fn) → the GLB with its images' URIs mapped
//   glbTriangles(glb), lodFile(file, n), mergeHeights(fine, coarse, hole, inside), fillHoles(data, w, h)

import { BUDGET_ROWS } from '../../src/lib/budgets.js';
import { imageLayerFrom } from '../../src/lib/land/layers.js';
import { fitCull } from '../../src/lib/level/fit.js';
import { MIN_RADIUS } from '../../src/lib/level/lod.js';
import { CELL, INSTANCE_BYTES, cellKey, cellOf } from '../../src/lib/level/instances.js';
import { decodePng16 } from '../../src/lib/level/png16.js';
import { cutsFor } from './bf2017-manifest.mjs';
import { glbJson } from './bf2017-paths.mjs';
import { cellsOf, weightOf } from './level-cells.mjs';

export const TIERS = ['low', 'mid', 'high', 'ultra'];
export const KMIN = { low: 20, mid: 30, high: 40, ultra: 60 };
const Q = 32767;
const last = (path) => String(path).split('/').pop().toLowerCase();

// The map as the bucket packs it (web/maps/README.md): its manifest says
// where in the bin each array starts (positions Float32 × 3n, quaternions
// Int16 × 4n over 32767, scales Float32 × 3n); groups are runs of instances
// `[offset, offset + count)` of one mesh in one sub-level, each a `kind`
// (static scenery, a placed object, a skinned actor). The quaternions stay
// Int16 so a rebased cell is written without a second rounding.
export function readMap(json, bin) {
  const b = json.bin;
  const count = b.count;
  if (bin.byteLength < b.scale + count * 12) throw new Error(`map bin: ${bin.byteLength} bytes for ${count} instances`);
  const v = new DataView(bin.buffer ?? bin, bin.byteOffset ?? 0, bin.byteLength);
  const position = new Float32Array(count * 3);
  const quaternion = new Int16Array(count * 4);
  const scale = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) position[i] = v.getFloat32(b.position + i * 4, true);
  for (let i = 0; i < count * 4; i++) quaternion[i] = v.getInt16(b.quaternion + i * 2, true);
  for (let i = 0; i < count * 3; i++) scale[i] = v.getFloat32(b.scale + i * 4, true);
  const groups = json.groups.map((g) => ({ mesh: g.mesh, sub: g.sub, kind: g.kind, first: g.offset, count: g.count }));
  const meshOf = new Int32Array(count).fill(-1);
  for (const g of groups) meshOf.fill(g.mesh, g.first, g.first + g.count);
  return { name: json.level, instances: { count, position, quaternion, scale }, meshOf, groups, meshes: json.meshes, subworlds: json.subworlds.map((x) => x.name ?? x), terrain: json.terrain?.[0] ?? null, sky: json.sky ?? [], vehicleSpawns: json.vehicleSpawns ?? [] };
}

// The playable map: the level's own sub-level (its name's last part),
// `Content`, and where a map keeps its scenery apart, `Shared_Art` and the
// day's `Sunny` (Endor_01: 16,341 of its 18,530 pieces). Lobby, EOR,
// Cinematics, Outro_*, HeroArena, the modes and the other times of day are
// other sets in the same file, drawn somewhere else in the game.
export const mainSubs = (map) => [last(map.name), 'content', 'shared_art', 'sunny'];

// What the game places and never draws as itself: Enlighten's lighting
// proxies, the fake light cones, destruction stages waiting their turn
// (despawn and leftover pieces), the planes that fake shadow, mist and
// light; and the skinned actors, which stand in
// their bind pose (the site's own people do the living)
export const NEVER = /enlighten|fx\/meshes\/lighting|despawn|leftover|_destruction_|shadowplane|invalidatelightplane|mistplane|lightcone/i;

// `drop`: meshes left out, each `<mesh name>` or `<sub>:<mesh name>` (its
// file's last part without `_mesh.glb`, any case; `*` for any run of
// letters): a space level's corvettes the battle draws itself, its end of
// round's room
const dropTest = (drop) => {
  const rules = drop.map((d) => {
    const [sub, mesh] = d.includes(':') ? d.split(':') : [null, d];
    return { sub: sub?.toLowerCase() ?? null, re: new RegExp(`^${mesh.toLowerCase().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`) };
  });
  return (sub, file) => {
    const name = last(file).replace(/_mesh\.glb$/, '');
    return rules.some((r) => (!r.sub || r.sub === sub) && r.re.test(name));
  };
};

export function arenaOf(map, { subs = null, drop = [] } = {}) {
  const want = new Set((subs ?? mainSubs(map)).map(last));
  const dropped = dropTest(drop);
  const out = [];
  for (const g of map.groups) {
    const sub = last(map.subworlds[g.sub]);
    const file = map.meshes[g.mesh]?.file ?? '';
    if (!want.has(sub) || g.kind === 'actor' || NEVER.test(file) || dropped(sub, file)) continue;
    for (let i = 0; i < g.count; i++) out.push(g.first + i);
  }
  return out.sort((a, b) => a - b);
}

export function subset(inst, indices) {
  const n = indices.length;
  const out = { count: n, position: new Float32Array(n * 3), quaternion: new inst.quaternion.constructor(n * 4), scale: new Float32Array(n * 3) };
  indices.forEach((i, j) => {
    out.position.set(inst.position.subarray(i * 3, i * 3 + 3), j * 3);
    out.quaternion.set(inst.quaternion.subarray(i * 4, i * 4 + 4), j * 4);
    out.scale.set(inst.scale.subarray(i * 3, i * 3 + 3), j * 3);
  });
  return out;
}

// The site's frame: the spot (origin) at 0, 0, 0 and the whole level turned
// `yaw` about y (positions and orientations alike: the turn's quaternion
// before each instance's own).
export function rebase(inst, origin, yaw = 0) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const hy = Math.sin(yaw / 2);
  const hw = Math.cos(yaw / 2);
  const out = { count: inst.count, position: new Float32Array(inst.count * 3), quaternion: new Int16Array(inst.count * 4), scale: Float32Array.from(inst.scale) };
  const scaleQ = inst.quaternion instanceof Int16Array ? 1 / Q : 1;
  for (let i = 0; i < inst.count; i++) {
    const x = inst.position[i * 3] - origin[0];
    const z = inst.position[i * 3 + 2] - origin[2];
    out.position[i * 3] = x * c + z * s;
    out.position[i * 3 + 1] = inst.position[i * 3 + 1] - origin[1];
    out.position[i * 3 + 2] = -x * s + z * c;
    const [qx, qy, qz, qw] = [0, 1, 2, 3].map((k) => inst.quaternion[i * 4 + k] * scaleQ);
    // (0, hy, 0, hw) × (qx, qy, qz, qw)
    const r = [hw * qx + hy * qz, hw * qy + hy * qw, hw * qz - hy * qx, hw * qw - hy * qy];
    for (let k = 0; k < 4; k++) out.quaternion[i * 4 + k] = Math.max(-Q, Math.min(Q, Math.round(r[k] * Q)));
  }
  return out;
}

// A cell's bin: its draws one after another, each a contiguous range
export function packCell(cell, inst) {
  const n = cell.draws.reduce((a, d) => a + d.indices.length, 0);
  const bin = new ArrayBuffer(n * INSTANCE_BYTES);
  const v = new DataView(bin);
  const draws = [];
  let at = 0;
  for (const d of cell.draws) {
    draws.push({ mesh: d.mesh, offset: at, count: d.indices.length, mirrored: d.mirrored });
    for (const i of d.indices) writeOne(v, at++, inst, i);
  }
  return { bin, draws };
}

function writeOne(v, j, inst, i) {
  const o = j * INSTANCE_BYTES;
  const q = inst.quaternion instanceof Int16Array ? (k) => inst.quaternion[i * 4 + k] : (k) => Math.round(inst.quaternion[i * 4 + k] * Q);
  for (let k = 0; k < 3; k++) v.setFloat32(o + k * 4, inst.position[i * 3 + k], true);
  for (let k = 0; k < 4; k++) v.setInt16(o + 12 + k * 2, q(k), true);
  for (let k = 0; k < 3; k++) v.setFloat32(o + 20 + k * 4, inst.scale[i * 3 + k], true);
}

// ── The ground ──

// A terrain record's map (`world`, 2 m a pixel over 8 km; `detail`, 0.5 m
// over the arena): where its first pixel is, its size and step, and how a
// 16-bit value becomes metres (v × heightScale / 65536; row 0 at minZ). A
// record with holes (holePixels) holds them at 0.
export function terrainFrame(record, which = 'world') {
  const m = record[which];
  return {
    minX: m.minX,
    minZ: m.minZ,
    w: m.width,
    h: m.height,
    metresPerPixel: m.metresPerPixel,
    scale: record.heightScale,
    offset: record.heightOffset ?? 0,
    hole: m.holePixels > 0 ? 0 : null,
  };
}

export async function heightsLayer(record, png, which = 'world') {
  const f = terrainFrame(record, which);
  const { data, w, h } = await decodePng16(png);
  return imageLayerFrom({ heightScale: f.scale, heightOffset: f.offset, holePixels: f.hole === null ? 0 : 1 }, { data, w, h, minX: f.minX, minZ: f.minZ, metresPerPixel: f.metresPerPixel }, null);
}

// A square of a heightmap, resampled bilinearly to its own step, in the
// source's 16-bit units; a hole stays a hole (any hole under a sample makes
// the sample one), and so does anywhere outside the source
// (`clamp`: off the map, its nearest edge, for a level whose map is smaller
// than its world, Endor's 2 km of 8: the forest floor runs on level)
export function cropHeights(src, frame, { minX, minZ, size, metresPerPixel, clamp = false }) {
  const n = Math.round(size / metresPerPixel) + 1;
  const out = new Uint16Array(n * n);
  const hole = frame.hole ?? 0;
  const at = (i, j) => src[j * frame.w + i];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let gx = (minX + i * metresPerPixel - frame.minX) / frame.metresPerPixel;
      let gz = (minZ + j * metresPerPixel - frame.minZ) / frame.metresPerPixel;
      if (clamp) {
        gx = Math.min(Math.max(gx, 0), frame.w - 1);
        gz = Math.min(Math.max(gz, 0), frame.h - 1);
      }
      if (gx < 0 || gz < 0 || gx > frame.w - 1 || gz > frame.h - 1) {
        out[j * n + i] = hole;
        continue;
      }
      const x0 = Math.min(Math.floor(gx), frame.w - 2);
      const z0 = Math.min(Math.floor(gz), frame.h - 2);
      const fx = gx - x0;
      const fz = gz - z0;
      const v = [at(x0, z0), at(x0 + 1, z0), at(x0, z0 + 1), at(x0 + 1, z0 + 1)];
      const w = [(1 - fx) * (1 - fz), fx * (1 - fz), (1 - fx) * fz, fx * fz];
      if (frame.hole !== null && v.some((x, k) => x === frame.hole && w[k] > 0)) {
        out[j * n + i] = hole;
        continue;
      }
      out[j * n + i] = Math.max(frame.hole === 0 ? 1 : 0, Math.round(v[0] * w[0] + v[1] * w[1] + v[2] * w[2] + v[3] * w[3]));
    }
  }
  return { data: out, w: n, h: n };
}

// ── The pack ──

const slug = (name) => last(name).replace(/[^a-z0-9_]+/g, '_');
const radius = (m) => Math.hypot(m.bounds[3] - m.bounds[0], m.bounds[4] - m.bounds[1], m.bounds[5] - m.bounds[2]) / 2;

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

// One far draw per mesh and side for a set of instances, sorted by cell
// within it, so the scene can hide the cells it draws closer up
function farList(inst, meshOf, cell) {
  const order = Array.from({ length: inst.count }, (_, i) => i);
  const keyOf = (i) => cellOf(inst.position[i * 3], inst.position[i * 3 + 2], cell);
  const mir = (i) => (inst.scale[i * 3] * inst.scale[i * 3 + 1] * inst.scale[i * 3 + 2] < 0 ? 1 : 0);
  order.sort((a, b) => meshOf[a] - meshOf[b] || mir(a) - mir(b) || keyOf(a)[0] - keyOf(b)[0] || keyOf(a)[1] - keyOf(b)[1] || a - b);
  const bin = new ArrayBuffer(inst.count * INSTANCE_BYTES);
  const v = new DataView(bin);
  const draws = [];
  let d = null;
  order.forEach((i, j) => {
    writeOne(v, j, inst, i);
    if (!d || d.mesh !== meshOf[i] || d.mirrored !== Boolean(mir(i))) draws.push((d = { mesh: meshOf[i], mirrored: Boolean(mir(i)), offset: j, count: 0, cells: {} }));
    const k = cellKey(...keyOf(i));
    d.cells[k] ??= [d.count, 0];
    d.cells[k][1]++;
    d.count++;
  });
  return { bin, draws };
}

export function buildPack({ world, mapName, map, spot, groundY, yaw = 0, meshes, arena = 1024, cell = CELL, rows = BUDGET_ROWS, subs = null, drop = [], terrain = null, physics = {}, walk = 640, tex = {}, groundAt = null, holeAt = null, inside = false }) {
  // (a mesh the bucket has not got, or sequel-era, draws nothing: its instances go)
  const idx = arenaOf(map, { subs, drop }).filter((i) => !meshes[map.meshOf[i]].missing);
  const all = rebase(subset(map.instances, idx), [spot[0], groundY, spot[1]], yaw);
  const meshOfAll = Int32Array.from(idx.map((i) => map.meshOf[i]));
  // (under the ground: the base inside the glacier, which no one outside can
  // see; the site's own interior zone stands for it. Top under the pack's
  // ground by more than half a metre, its mouth's floor included)
  const under = (i) => {
    if (!groundAt) return false;
    const m = meshes[meshOfAll[i]];
    const top = all.position[i * 3 + 1] + Math.max(m.bounds[1] * all.scale[i * 3 + 1], m.bounds[4] * all.scale[i * 3 + 1]);
    const [x, z] = [all.position[i * 3], all.position[i * 3 + 2]];
    // (in the game's own holes, its mouths, is what you see through them)
    if (holeAt?.(x, z)) return false;
    return top < groundAt(x, z) - 0.5;
  };
  const inArena = [];
  const outside = [];
  let buried = 0;
  // (an interior keeps what a world leaves out: the base inside the glacier,
  // or, with no ground given, everything its sub-levels hold)
  for (let i = 0; i < all.count; i++) {
    if (under(i) !== Boolean(inside && groundAt)) {
      buried++;
      continue;
    }
    // (an interior has no horizon: what is beyond its arena is not seen from it)
    if (Math.abs(all.position[i * 3]) < arena && Math.abs(all.position[i * 3 + 2]) < arena) inArena.push(i);
    else if (!inside) outside.push(i);
  }
  const arenaInst = subset(all, inArena);
  const arenaMesh = Int32Array.from(inArena.map((i) => meshOfAll[i]));
  const horizonInst = subset(all, outside);
  const horizonMesh = Int32Array.from(outside.map((i) => meshOfAll[i]));
  const cells = cellsOf(arenaInst, arenaMesh, { cell, reach: (m, i) => radius(meshes[m]) * Math.max(...arenaInst.scale.subarray(i * 3, i * 3 + 3).map(Math.abs)) });
  const far = farList(arenaInst, arenaMesh, cell);
  const horizon = farList(horizonInst, horizonMesh, cell);

  // per tier: how far out things are drawn (K radii) and what goes, held to
  // the row everywhere you can stand (a 64 m grid over the walkable square)
  const tiers = Object.keys(rows);
  const vol = (m) => weightOf({ indices: [0] }, meshes[m]);
  const weight = new Float64Array(meshes.length);
  for (let i = 0; i < arenaInst.count; i++) weight[arenaMesh[i]] += vol(arenaMesh[i]);
  const fitMeshes = meshes.map((m, i) => ({ lods: m.lods, mats: m.mats ?? 1, weight: weight[i], skip: m.missing }));
  const flat = {
    x: Float32Array.from({ length: arenaInst.count }, (_, i) => arenaInst.position[i * 3]),
    z: Float32Array.from({ length: arenaInst.count }, (_, i) => arenaInst.position[i * 3 + 2]),
    r: Float32Array.from({ length: arenaInst.count }, (_, i) => Math.max(MIN_RADIUS, radius(meshes[arenaMesh[i]]) * Math.max(...arenaInst.scale.subarray(i * 3, i * 3 + 3).map(Math.abs)))),
    mesh: arenaMesh,
    mirrored: Uint8Array.from({ length: arenaInst.count }, (_, i) => (arenaInst.scale[i * 3] * arenaInst.scale[i * 3 + 1] * arenaInst.scale[i * 3 + 2] < 0 ? 1 : 0)),
  };
  const positions = [];
  const reachOut = Math.min(walk, arena);
  for (let x = -reachOut; x <= reachOut; x += 64) for (let z = -reachOut; z <= reachOut; z += 64) positions.push([x, z]);
  const cull = {};
  const table = {};
  // (the nearest reach a tier takes before meshes go instead: a 1 m thing
  // stays in view this many metres, so the base never thins to a ring)
  for (const tier of tiers) {
    const f = fitCull(flat, fitMeshes, rows[tier], tier, { positions, kMin: KMIN[tier] ?? 40 });
    cull[tier] = { K: f.K, dropped: f.dropped };
    table[tier] = { K: f.K, dropped: f.dropped.map((m) => ({ name: meshes[m].name, count: arenaMesh.filter((x) => x === m).length })), worst: f.worst };
  }

  const files = new Map();
  const jsonCells = {};
  for (const [key, c] of cells) {
    const { bin, draws } = packCell(c, arenaInst);
    const path = `cells/${key.replace(',', '_')}.bin`;
    files.set(path, bin);
    jsonCells[key] = { bin: path, bytes: bin.byteLength, bounds: c.bounds.map((v) => Math.round(v * 100) / 100), count: bin.byteLength / INSTANCE_BYTES, draws };
  }
  files.set('far.bin', far.bin);
  files.set('horizon.bin', horizon.bin);
  const json = sortKeys({
    world,
    map: mapName,
    origin: [spot[0], groundY, spot[1]],
    yaw,
    cell,
    arena,
    cells: jsonCells,
    far: { bin: 'far.bin', bytes: far.bin.byteLength, draws: far.draws },
    horizon: { bin: 'horizon.bin', bytes: horizon.bin.byteLength, draws: horizon.draws.map(({ mesh, mirrored, offset, count }) => ({ mesh, mirrored, offset, count })) },
    meshes: meshes.map((m) => ({ name: m.name, radius: Math.round(radius(m) * 100) / 100, glb: m.glb ?? m.lods.map((_, n) => `meshes/${slug(m.name)}.lod${n}.glb`), lods: m.lods, bounds: m.bounds, mats: m.mats ?? 1 })),
    cull,
    tex,
    terrain: inside ? null : terrain,
    inside: Boolean(inside),
    bounds: inside ? extentOf(arenaInst, arenaMesh, meshes) : null,
    shadowCache: null,
    physics,
  });
  return { json, files, table, counts: { arena: arenaInst.count, horizon: horizonInst.count, buried, cells: cells.size } };
}

// An interior's box in the pack's frame: every piece's bounds, scaled
function extentOf(inst, meshOf, meshes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < inst.count; i++) {
    const r = radius(meshes[meshOf[i]]) * Math.max(...inst.scale.subarray(i * 3, i * 3 + 3).map(Math.abs));
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], inst.position[i * 3 + k] - r);
      max[k] = Math.max(max[k], inst.position[i * 3 + k] + r);
    }
  }
  const round = (v) => Math.round(v * 10) / 10;
  return inst.count ? { min: min.map(round), max: max.map(round) } : { min: [0, 0, 0], max: [0, 0, 0] };
}

// ── The meshes ──

// A mesh's four cuts from its chain (phase 0's cutsFor for lod1 and plain):
// far the chain's last (its lightest: the game's own distant LOD), and where
// a chain is short, the nearest cut there is stands in
export function meshCuts(entry, { ultra = false } = {}) {
  const lods = [...entry.lods].sort((a, b) => a.lod - b.lod);
  const c = cutsFor(entry, { ultra });
  const far = lods[lods.length - 1];
  return { far, lod1: c.lod1 ?? (far.lod > c.plain.lod ? far : c.plain), plain: c.plain, ultra: c.ultra ?? c.plain };
}

// A GLB with its JSON chunk's image URIs mapped (the pack's meshes name its
// shared textures, not the bucket's paths); the binary chunk is untouched
export function rewriteImageUris(glb, fn) {
  const json = glbJson(glb);
  for (const img of json.images ?? []) if (img.uri && !img.uri.startsWith('data:')) img.uri = fn(img.uri);
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  const pad = (4 - (text.length % 4)) % 4;
  if (pad) text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const rest = glb.subarray(20 + glb.readUInt32LE(12));
  const head = Buffer.alloc(20);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + text.length + rest.length, 8);
  head.writeUInt32LE(text.length, 12);
  head.write('JSON', 16, 'ascii');
  return Buffer.concat([head, text, rest]);
}

// A GLB's triangles and primitives, from its JSON alone (the meshes the
// maps added after the model manifest was written have no row there)
export function glbTriangles(glb) {
  const j = glbJson(glb);
  let tris = 0;
  let prims = 0;
  for (const m of j.meshes ?? []) {
    for (const p of m.primitives) {
      if ((p.mode ?? 4) !== 4) continue;
      prims++;
      tris += (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3;
    }
  }
  return { tris, prims };
}

// A map mesh's LOD files: LOD 0 is its `file`, LOD n `<file>_lod<n>.glb`
export const lodFile = (file, n) => (n ? file.replace(/\.glb$/, `_lod${n}.glb`) : file);

// Two heightmaps over the same square merged: the fine one where it has
// ground, the coarse one beyond it; inside the fine one's bounds (`inside(i)`)
// its holes stay holes (the coarse map would close them: the game cuts the
// hangar's mouth out of the glacier that way)
export function mergeHeights(fine, coarse, hole = 0, inside = () => false) {
  const out = new Uint16Array(coarse.length);
  for (let i = 0; i < out.length; i++) out[i] = fine[i] !== hole ? fine[i] : inside(i) ? hole : coarse[i];
  return out;
}

// Each hole (a run of hole pixels, four-way connected) filled with the lowest
// ground on its rim: a mouth cut into a glacier becomes a way in at the
// floor's level, not a pit and not a wall
export function fillHoles(data, w, h, hole = 0) {
  const out = Uint16Array.from(data);
  const seen = new Uint8Array(data.length);
  for (let start = 0; start < data.length; start++) {
    if (data[start] !== hole || seen[start]) continue;
    const run = [start];
    seen[start] = 1;
    let low = Infinity;
    for (let k = 0; k < run.length; k++) {
      const i = run[k];
      const x = i % w;
      const y = (i - x) / w;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (data[j] !== hole) low = Math.min(low, data[j]);
        else if (!seen[j]) {
          seen[j] = 1;
          run.push(j);
        }
      }
    }
    if (low === Infinity) continue;
    for (const i of run) out[i] = low;
  }
  return out;
}

// The value a map uses for ground it never painted (Endor_01's: 58% of its
// pixels, the tiles outside the play area left at its floor): the map's
// lowest non-zero value when that much of it is that value, else null.
export function emptyValue(data, share = 0.25) {
  let min = Infinity;
  for (const v of data) if (v && v < min) min = v;
  let n = 0;
  for (const v of data) if (v === min) n++;
  return n / data.length >= share ? min : null;
}

// Each empty pixel the mean of its nearest painted neighbours, spreading out
// from the painted ground ring by ring: the floor runs on from the play
// area's edge instead of dropping to the map's floor. Holes (0) stay.
// (`margin`: pixels within that many of an empty one are empty too: the
// painted ground's rim is blended down toward the floor value)
export function fillEmpty(data, w, h, empty, { margin = 0 } = {}) {
  const out = Uint16Array.from(data);
  const done = new Uint8Array(data.length);
  let ring = [];
  for (let i = 0; i < data.length; i++) if (data[i] !== empty) done[i] = 1;
  for (let step = 0; step < margin; step++) {
    const grow = [];
    for (let i = 0; i < data.length; i++) {
      if (!done[i] || !out[i]) continue;
      const x = i % w;
      const y = (i - x) / w;
      if ((x > 0 && !done[i - 1]) || (x < w - 1 && !done[i + 1]) || (y > 0 && !done[i - w]) || (y < h - 1 && !done[i + w])) grow.push(i);
    }
    for (const i of grow) done[i] = 0;
  }
  for (let i = 0; i < data.length; i++) {
    if (done[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    if ((x > 0 && done[i - 1]) || (x < w - 1 && done[i + 1]) || (y > 0 && done[i - w]) || (y < h - 1 && done[i + w])) ring.push(i);
  }
  while (ring.length) {
    const vals = ring.map((i) => {
      const x = i % w;
      const y = (i - x) / w;
      let sum = 0;
      let n = 0;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (done[j] && out[j]) {
          sum += out[j];
          n++;
        }
      }
      return n ? Math.round(sum / n) : empty;
    });
    const next = [];
    ring.forEach((i, k) => {
      out[i] = vals[k];
      done[i] = 1;
    });
    for (const i of ring) {
      const x = i % w;
      const y = (i - x) / w;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!done[j]) {
          done[j] = 2;
          next.push(j);
        }
      }
    }
    for (const j of next) done[j] = 0;
    ring = next;
  }
  return out;
}

