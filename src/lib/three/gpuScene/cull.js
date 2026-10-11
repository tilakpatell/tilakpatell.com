// The GPU scene's cull (GPU-first lane N1): over every row of the instance
// buffer, a TSL compute pass (cullPass.js) decides what is drawn and at
// which LOD, and lays the drawn rows out for the indirect draws. Per row:
//
// 1. dead (freed with its cell): skipped;
// 2. past K radii (lane L's seenAt), or outside the camera's six planes: culled;
// 3. the LOD cut, lodRule.js's (the same as lodAt), to a LOD file: the
//    wanted one if loaded, else the one the row was drawn at last frame, else
//    the nearest coarser loaded, else the nearest finer (Review Focus 2: as
//    levelScene.js holds a row at its old LOD while a file comes);
// 4. occlusion: the sphere's screen rect and nearest depth against the
//    depth pyramid (hzb.js); no pyramid, no test (Review Focus 4);
// 5. listed: the row's index appended to its (mesh, file, mirrored) key's
//    list by an atomic counter; for 0.3 s after its file changes, to the old
//    key's list too, so lodFade.js can dither one out as the other comes in;
// 6. within the shadow reach (lane T2's SHADOW_REACH, 260 m), listed again
//    for the shadow pass whether in view or not, occluded or not: a caster
//    the camera cannot see still throws a shadow it can.
//
// One key a (mesh, file, mirrored): every part of that file draws the key's
// list, each part one drawIndexedIndirect whose firstInstance is the key's
// base in the list buffer (three asks for indirect-first-instance where the
// adapter has it: hasIndirect in three.js says when it has not). A key's
// room is the pack's count of the mesh's rows, so the lists never move.
//
// The pure parts here are the GPU pass's twin, tested in Node:
//   cameraOf(camera, width, height) → { position, view, proj, viewProj, near, width, height, reversed }
//   planesOf(viewProj) → six [a, b, c, d] (WebGPU's 0…1 depth, either way round)
//   sphereRect(centre, radius, cam) → { rect: { x0, y0, x1, y1 } in pixels, near: depth } | null (it crosses the near plane)
//   chooseFile(want, prev, loaded(k)) → k | NONE
//   meshTable(pack, tier, { mirrored?, counts? }) → the per-mesh and per-key tables (below)
//   cullCpu({ scene, table, camera, tier, hzb?: mips, K?, state?, now?, fade?, shadowReach? }) →
//     { lists: Map<key, rows>, shadow: Map<key, rows>, lods: Uint8Array, state, stats: { tested, culled, occluded, drawn } }

import { LOD, MIN_RADIUS } from '../../level/lod.js';
import { occludedAt } from './hzb.js';
import { MAX_LODS, lodFrom, stepsTable } from './lodRule.js';
import { FLAG, unpackInstance } from './pack.js';

export const NONE = 15;
// s: the crossfade after a LOD change (the spec's N1: 0.3 s under TRAA)
export const FADE = 0.3;
// m: lane T2's SHADOW_REACH (levelScene.js on claude/bf2017-t2-flip): the
// sun's farthest cascade (ULTRA_SHADOW_FAR, 140 m) plus its sunward margin (120 m)
export const SHADOW_REACH = 260;
// u32 a mesh in the GPU table: its LOD → file (MAX_LODS), then its keys (file × mirrored)
export const MESH_U32 = MAX_LODS * 3;

export function cameraOf(camera, width, height) {
  camera.updateMatrixWorld?.();
  const view = Float32Array.from(camera.matrixWorldInverse.elements);
  const proj = Float32Array.from(camera.projectionMatrix.elements);
  return { position: [camera.matrixWorld.elements[12], camera.matrixWorld.elements[13], camera.matrixWorld.elements[14]], view, proj, viewProj: mul(proj, view), near: camera.near, width, height, reversed: Boolean(camera.reversedDepth) };
}

function mul(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    out[c * 4 + r] = s;
  }
  return out;
}

// Gribb and Hartmann's planes; with a 0…1 depth the near plane is the third
// row alone, and that holds reversed too (the two depth planes swap names)
export function planesOf(m) {
  const row = (i) => [m[i], m[4 + i], m[8 + i], m[12 + i]];
  const [r0, r1, r2, r3] = [0, 1, 2, 3].map(row);
  const add = (a, b, s) => a.map((v, i) => v + s * b[i]);
  return [add(r3, r0, 1), add(r3, r0, -1), add(r3, r1, 1), add(r3, r1, -1), r2, add(r3, r2, -1)].map((p) => {
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    return p.map((v) => v / l);
  });
}

const xform = (m, [x, y, z], w = 1) => [0, 1, 2, 3].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r] * w);

export function sphereRect(centre, R, cam) {
  const v = xform(cam.view, centre);
  if (-v[2] - R <= cam.near) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const dx of [-R, R]) for (const dy of [-R, R]) for (const dz of [-R, R]) {
    const c = xform(cam.proj, [v[0] + dx, v[1] + dy, v[2] + dz]);
    const nx = c[0] / c[3];
    const ny = c[1] / c[3];
    x0 = Math.min(x0, nx);
    x1 = Math.max(x1, nx);
    y0 = Math.min(y0, ny);
    y1 = Math.max(y1, ny);
  }
  const zc = xform(cam.proj, [0, 0, v[2] + R]);
  const px = (n) => Math.min(cam.width - 1e-3, Math.max(0, (n * 0.5 + 0.5) * cam.width));
  const py = (n) => Math.min(cam.height - 1e-3, Math.max(0, (0.5 - n * 0.5) * cam.height));
  return { rect: { x0: px(x0), x1: px(x1), y0: py(y1), y1: py(y0) }, near: zc[2] / zc[3] };
}

export function chooseFile(want, prev, loaded) {
  if (want !== NONE && loaded(want)) return want;
  if (prev !== NONE && loaded(prev)) return prev;
  for (let k = want + 1; k < MAX_LODS; k++) if (loaded(k)) return k;
  for (let k = Math.min(want, MAX_LODS) - 1; k >= 0; k--) if (loaded(k)) return k;
  return NONE;
}

// The tables the pass reads, as the CPU keeps them:
// - info: Float32Array, 8 a mesh: the bounds' centre (x, y, z), the pack's
//   radius (−1: dropped on this tier), then the four LOD steps;
// - u32: Uint32Array, MESH_U32 a mesh (LOD n → file k or NONE; then (k,
//   mirrored) → key + 1, 0 while the file is not loaded), then a key's base
//   in the list buffer, one a key, at keyBaseAt;
// - keys: [{ mesh, file, mirrored, glb, room, base }]; room the pack's count
//   of the mesh's rows (mirrored or not), base the sum of the rooms before it.
export function meshTable(pack, tier, { mirrored = null, counts = null } = {}) {
  const meshes = pack.meshes ?? [];
  const n = meshes.length;
  if (!counts) {
    counts = new Map();
    for (const d of [...(pack.far?.draws ?? []), ...(pack.horizon?.draws ?? [])]) counts.set(`${d.mesh}|${d.mirrored ? 1 : 0}`, (counts.get(`${d.mesh}|${d.mirrored ? 1 : 0}`) ?? 0) + d.count);
  }
  mirrored ??= new Set([...counts.keys()].filter((k) => k.endsWith('|1') && counts.get(k)).map((k) => Number(k.split('|')[0])));
  const cull = pack.cull?.[tier] ?? pack.cull?.high ?? { K: Infinity, dropped: [] };
  const dropped = new Set(cull.dropped ?? []);
  const info = new Float32Array(n * 8);
  const keys = [];
  const byGlb = new Map();
  const keyIndex = new Map();
  let base = 0;
  for (const [m, mesh] of meshes.entries()) {
    const b = mesh.bounds ?? [0, 0, 0, 0, 0, 0];
    info.set([(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2, dropped.has(m) ? -1 : (mesh.radius ?? 1)], m * 8);
    info.set(stepsTable(mesh.lods?.length ? mesh.lods : [1], tier), m * 8 + 4);
    for (const [k, glb] of (mesh.glb ?? []).entries()) {
      if (!glb || k >= MAX_LODS) continue;
      for (const mir of mirrored.has(m) ? [0, 1] : [0]) {
        const room = counts.get(`${m}|${mir}`) ?? 0;
        const key = keys.length;
        keys.push({ mesh: m, file: k, mirrored: Boolean(mir), glb, room, base });
        keyIndex.set(`${m}|${k}|${mir}`, key);
        base += room;
        if (!byGlb.has(glb)) byGlb.set(glb, []);
        byGlb.get(glb).push(key);
      }
    }
  }
  const keyBaseAt = n * MESH_U32;
  const u32 = new Uint32Array(keyBaseAt + Math.max(1, keys.length));
  for (const [m, mesh] of meshes.entries()) {
    const glbs = mesh.glb ?? [];
    for (let l = 0; l < MAX_LODS; l++) {
      let k = l;
      while (k < glbs.length && !glbs[k]) k++;
      u32[m * MESH_U32 + l] = l < (mesh.lods?.length ?? 1) && k < Math.min(glbs.length, MAX_LODS) ? k : NONE;
    }
  }
  keys.forEach((k, i) => (u32[keyBaseAt + i] = k.base));
  const loadedKeys = new Set();
  let version = 0;
  const keyOf = (m, k, mir) => keyIndex.get(`${m}|${k}|${mir ? 1 : 0}`) ?? -1;
  return {
    meshes: n,
    info,
    u32,
    keys,
    keyBaseAt,
    room: base,
    K: cull.K ?? Infinity,
    L0: (LOD[tier] ?? LOD.high).L0,
    get version() {
      return version;
    },
    // a LOD file arrived: every key that draws it may be listed now
    load(glb) {
      for (const key of byGlb.get(glb) ?? []) {
        if (loadedKeys.has(key)) continue;
        loadedKeys.add(key);
        const { mesh, file, mirrored: mir } = keys[key];
        u32[mesh * MESH_U32 + MAX_LODS + file * 2 + (mir ? 1 : 0)] = key + 1;
        version++;
      }
    },
    keysOf: (glb) => byGlb.get(glb) ?? [],
    keyOf,
    keyInfo: (key) => keys[key],
    fileOf: (m, l) => u32[m * MESH_U32 + Math.min(l, MAX_LODS - 1)],
    loaded: (m, k, mir) => k !== NONE && loadedKeys.has(keyOf(m, k, mir)),
  };
}

const MIN = MIN_RADIUS;

export function cullCpu({ scene, table, camera, tier, hzb = null, K = table.K, state = null, now = 0, fade = FADE, shadowReach = SHADOW_REACH }) {
  const count = scene.count;
  const L0 = (LOD[tier] ?? LOD.high).L0;
  const planes = planesOf(camera.viewProj);
  const lods = new Uint8Array(count).fill(NONE);
  const prev = new Uint8Array(count).fill(NONE);
  const changed = new Float32Array(count).fill(-Infinity);
  const lists = new Map();
  const shadow = new Map();
  const stats = { tested: 0, culled: 0, occluded: 0, drawn: 0 };
  const push = (map, key, i) => (map.get(key) ?? map.set(key, []).get(key)).push(i);
  for (let i = 0; i < count; i++) {
    const row = unpackInstance(scene.rows, i);
    if (!(row.flags & FLAG.live)) continue;
    stats.tested++;
    const m = row.mesh;
    const mir = Boolean(row.flags & FLAG.mirrored);
    const info = table.info.subarray(m * 8, m * 8 + 8);
    if (info[3] < 0) {
      stats.culled++;
      continue;
    }
    const [sx, sy, sz] = row.scale;
    const R = Math.max(MIN, info[3] * Math.max(Math.abs(sx), Math.abs(sy), Math.abs(sz)));
    const c = rotate(row.quaternion, [info[0] * sx, info[1] * sy, info[2] * sz]).map((v, j) => v + row.position[j]);
    const d = Math.hypot(row.position[0] - camera.position[0], row.position[2] - camera.position[2]);
    const old = state?.lods?.[i] ?? NONE;
    prev[i] = state?.prev?.[i] ?? NONE;
    changed[i] = state?.changed?.[i] ?? -Infinity;
    if (d > K * R) {
      stats.culled++;
      continue;
    }
    const want = table.fileOf(m, lodFrom(d, R, L0, Array.from(info.subarray(4, 8))));
    const k = chooseFile(want, old, (f) => table.loaded(m, f, mir));
    if (k === NONE) {
      stats.culled++;
      continue;
    }
    lods[i] = k;
    if (old !== NONE && old !== k) {
      prev[i] = old;
      changed[i] = now;
    }
    if (d - R <= shadowReach && !(row.flags & FLAG.horizon)) push(shadow, table.keyOf(m, k, mir), i);
    if (!planes.every((p) => p[0] * c[0] + p[1] * c[1] + p[2] * c[2] + p[3] >= -R)) {
      stats.culled++;
      continue;
    }
    if (hzb) {
      const s = sphereRect(c, R, camera);
      if (s && occludedAt(s.rect, s.near, hzb, { reversed: camera.reversed })) {
        stats.occluded++;
        continue;
      }
    }
    stats.drawn++;
    push(lists, table.keyOf(m, k, mir), i);
    if (prev[i] !== NONE && prev[i] !== k && now - changed[i] < fade && table.loaded(m, prev[i], mir)) push(lists, table.keyOf(m, prev[i], mir), i);
  }
  return { lists, shadow, lods, state: { lods, prev, changed }, stats };
}

// v turned by the unit quaternion q (x, y, z, w)
export function rotate([qx, qy, qz, qw], [vx, vy, vz]) {
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [vx + qw * tx + (qy * tz - qz * ty), vy + qw * ty + (qz * tx - qx * tz), vz + qw * tz + (qx * ty - qy * tx)];
}

