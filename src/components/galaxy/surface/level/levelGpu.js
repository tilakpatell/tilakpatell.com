// A level pack drawn by the GPU scene (GPU-first lane N1): the third path
// beside lane L's InstancedMesh one and lane U's BatchedMesh one in
// levelScene.js, with their face. Every row of the far table and the horizon
// lives in one storage buffer (src/lib/three/gpuScene/), appended a cell at
// a time and freed a cell at a time; each frame a compute pass culls the
// rows by the frustum, lodAt's cut and the depth pyramid and writes the
// indirect arguments, and the CPU issues one draw a material group.
// levelScene.js routes here for `gpuScene: true` on a renderer that draws
// indirect (WebGPU with indirect-first-instance); the node renderer over
// WebGL 2 and the low tier never come here.
//
//   createLevelGpu({ scene, pack, loadGltf, tier, renderer?, keyOf?, occlude = true }) → {
//     root, setTable(bin), setHorizon(bin), update([x, z]), beforeRender(camera) (each frame, before the
//     scene is drawn: the occluders' depth, the pyramid, the cull), afterRender(), rebuilds(),
//     cells(), stats() → { tris, calls, instances, indirect, groups, culled, occluded, drawn, dead }, dispose() }
//
// The LOD files are fetched as levelScene.js fetches them: the first time
// lodAt wants one round you (sorted again after STEP metres walked); a row
// whose file has not come is drawn at the one it had, or the nearest loaded.
// Without a renderer (Node: scripts/level-draws.mjs) nothing is drawn: the
// cull's CPU twin counts what the GPU would draw round the last place given.

import * as THREE from 'three';
import { MIN_RADIUS, lodAt, seenAt } from '../../../../lib/level/lod.js';
import { cullCpu, meshTable } from '../../../../lib/three/gpuScene/cull.js';
import { groupsOf } from '../../../../lib/three/gpuScene/draws.js';
import { ROW_U32, packInstances, rowsOfBin, unpackInstance } from '../../../../lib/three/gpuScene/pack.js';
import { createGpuScene } from '../../../../lib/three/gpuScene/scene.js';
import { hasIndirect } from '../../../../lib/three/gpuScene/three.js';
import { materialKey } from './levelBatch.js';

// metres walked before the wanted files are worked out again (levelScene.js's STEP)
const STEP = 8;

export const canDrawGpuScene = (renderer) => Boolean(renderer) && hasIndirect(renderer);

// The camera in the level's own frame. The rows are in the pack's frame,
// and the Battlefront map puts the level group at the pack's origin, turned
// by its yaw (map/level.js), while the cull and the occluders' prepass read
// a camera in the frame of the rows: given the world's camera they culled
// everything (Hoth: 5,813 of 6,050 rows, nothing drawn). The scene's own
// draws sit under the group and three places them; only the cull's camera
// moves. (the galaxy's level is at the origin: the two are the same there)
const _rootInv = new THREE.Matrix4();
export function localCameraOf(root, camera, local = new THREE.PerspectiveCamera()) {
  local.matrixAutoUpdate = false;
  local.matrixWorldAutoUpdate = false;
  root.updateWorldMatrix(true, false);
  _rootInv.copy(root.matrixWorld).invert();
  local.matrixWorld.multiplyMatrices(_rootInv, camera.matrixWorld);
  local.matrix.copy(local.matrixWorld);
  local.matrixWorldInverse.copy(local.matrixWorld).invert();
  local.projectionMatrix.copy(camera.projectionMatrix);
  local.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  local.near = camera.near;
  local.far = camera.far;
  local.coordinateSystem = camera.coordinateSystem;
  local._reversedDepth = camera.reversedDepth; // (the renderer's own field under the getter)
  return local;
}

export function createLevelGpu({ scene, pack, loadGltf, tier, renderer = null, keyOf = materialKey, occlude = true }) {
  const root = new THREE.Group();
  root.name = 'level:gpuScene';
  scene.add(root);
  const table = meshTable(pack, tier);
  const dropped = new Set(pack.cull?.[tier]?.dropped ?? pack.cull?.high?.dropped ?? []);
  const capacity = Math.max(64, [...(pack.far?.draws ?? []), ...(pack.horizon?.draws ?? [])].reduce((n, d) => n + d.count, 0));
  const rows = createGpuScene({ capacity });
  const ranges = new Map(); // cell key (or 'horizon') → [{ start, count }]
  const files = new Map(); // glb → 'loading' | parts
  let gpu = null; // { cull, draws, hzb } once three is loaded (a renderer that draws indirect)
  let ready = null;
  let last = null;
  let sorts = 0;
  let disposed = false;
  let frames = 0;
  const clock = typeof performance !== 'undefined' ? () => performance.now() / 1000 : () => Date.now() / 1000;
  const t0 = clock();

  if (canDrawGpuScene(renderer)) {
    ready = Promise.all([import('../../../../lib/three/gpuScene/three.js'), import('../../../../lib/three/gpuScene/cullPass.js'), import('../../../../lib/three/gpuScene/draws.js'), import('../../../../lib/three/gpuScene/hzb.js')]).then(async ([t, c, d, h]) => {
      const three = await t.loadGpuThree();
      if (disposed) return;
      const size = renderer.getDrawingBufferSize(new three.THREE.Vector2());
      const hzb = occlude ? h.createHzb(renderer, { width: size.x, height: size.y, three }) : null;
      // (a slot a part and key: the pack's mesh materials over its files, both sides)
      const slots = Math.max(64, table.keys.reduce((n, k) => n + (pack.meshes[k.mesh].mats ?? 2), 0) * 2);
      const cull = c.createCull(renderer, { scene: rows, table, hzb, three, slots });
      const draws = d.createDraws(renderer, { cull, three, parent: root, keyOf });
      gpu = { cull, draws, hzb, three, size };
      for (const [glb, parts] of files) if (parts !== 'loading') place(glb, parts);
    }).catch((e) => {
      if (import.meta.env?.DEV) console.warn('the GPU scene failed', e);
    });
  }

  function append(key, list, horizon = false) {
    for (const r of ranges.get(key) ?? []) rows.free(r);
    const kept = list.filter((r) => !dropped.has(r.mesh)).map((r) => ({ ...r, horizon }));
    if (!kept.length) return ranges.delete(key);
    const packed = new Uint32Array(kept.length * ROW_U32);
    packInstances(kept, packed);
    ranges.set(key, [rows.append(packed, kept.length)]);
  }

  // a cell's rows in, or out (the stream's onCell and onDrop, when it hands the arena a cell at a time)
  function onCell(key, list) {
    append(key, list);
    if (last) want(last);
  }
  function onDrop(key) {
    for (const r of ranges.get(key) ?? []) rows.free(r);
    ranges.delete(key);
  }

  // the parts of a file in the GPU scene, its keys listed from then on
  function place(glb, parts) {
    const keys = table.keysOf(glb).map((key) => ({ key, ...table.keyInfo(key) }));
    if (gpu) gpu.draws.add(parts, keys);
    table.load(glb);
  }

  function load(glb) {
    if (files.has(glb) || disposed) return;
    files.set(glb, 'loading');
    Promise.resolve(loadGltf(glb)).then((gltf) => {
      if (disposed || !gltf) return files.delete(glb);
      gltf.scene.updateMatrixWorld(true);
      const parts = [];
      gltf.scene.traverse((o) => o.isMesh && parts.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone() }));
      files.set(glb, parts);
      // (before three is up, the file waits for it: `ready` places what came)
      if (gpu || !renderer) place(glb, parts);
    });
  }

  // the files lodAt wants round [x, z], asked for once each (levelScene.js's sort)
  function want([x, z]) {
    sorts++;
    rows.each((i) => {
      const row = unpackInstance(rows.rows, i);
      const mesh = pack.meshes[row.mesh];
      const d = Math.hypot(row.position[0] - x, row.position[2] - z);
      // (the radius as levelScene.js's rowsOf has it: the pack's, by the row's largest axis)
      const r = Math.max(MIN_RADIUS, (mesh.radius ?? 1) * Math.max(...row.scale.map(Math.abs)));
      if (!seenAt(d, r, table.K)) return;
      const glb = mesh.glb[table.fileOf(row.mesh, lodAt(mesh.lods, d, r, tier))];
      if (glb) load(glb);
    });
  }

  function counted() {
    const camera = { position: [last?.[0] ?? 0, 0, last?.[1] ?? 0] };
    const r = cullCpu({ scene: rows, table, camera, tier });
    const used = [];
    let tris = 0;
    for (const [key, list] of r.lists) {
      const parts = files.get(table.keyInfo(key).glb);
      if (!Array.isArray(parts)) continue;
      for (const p of parts) {
        used.push({ ...p, key });
        tris += list.length * ((p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count) / 3);
      }
    }
    const { groups } = groupsOf(used, { keyOf });
    return { tris, calls: groups.length, indirect: used.length, groups: groups.length, culled: r.stats.culled, occluded: 0, drawn: r.stats.drawn };
  }

  return {
    root,
    ready: () => ready ?? Promise.resolve(),
    setTable(bin) {
      const byCell = new Map();
      for (const row of rowsOfBin(pack.far.draws, bin)) (byCell.get(row.cell ?? 'far') ?? byCell.set(row.cell ?? 'far', []).get(row.cell ?? 'far')).push(row);
      for (const key of [...ranges.keys()]) if (key !== 'horizon' && !byCell.has(key)) onDrop(key);
      for (const [key, list] of byCell) append(key, list);
      if (last) want(last);
    },
    setHorizon(bin) {
      // (lane N4's coarse horizon cells are the CPU scene's, levelScene.js: not drawn here yet)
      if (bin?.coarse) return null;
      if (!pack.horizon?.draws?.length) return;
      append('horizon', rowsOfBin(pack.horizon.draws, bin), true);
      if (last) want(last);
    },
    onCell,
    onDrop,
    update(at) {
      if (disposed || (last && Math.hypot(at[0] - last[0], at[1] - last[1]) < STEP)) return;
      last = [at[0], at[1]];
      want(last);
    },
    // each frame before the scene is drawn: the occluders' depth with this
    // frame's camera, the pyramid, then the cull (no pyramid on the first frame)
    beforeRender(camera) {
      if (!gpu || disposed) return;
      renderer.getDrawingBufferSize(gpu.size);
      if (gpu.hzb && frames > 0) gpu.hzb.update(gpu.draws.prepass(camera, gpu.size.x, gpu.size.y));
      gpu.cull.run(camera, { now: clock() - t0, width: gpu.size.x, height: gpu.size.y, occlude: Boolean(gpu.hzb) });
      frames++;
    },
    afterRender() {},
    rebuilds: () => sorts,
    cells: () => [...ranges.keys()],
    stats() {
      const instances = rows.count - rows.dead;
      if (!gpu) return { instances, dead: rows.dead, ...counted() };
      const s = gpu.cull.stats();
      const d = gpu.draws.stats();
      return { tris: null, calls: d.groups, instances, dead: rows.dead, indirect: d.slots, groups: d.groups, refused: d.refused, culled: s.culled, occluded: s.occluded, drawn: s.drawn };
    },
    dispose() {
      disposed = true;
      gpu?.draws.dispose();
      gpu?.cull.dispose();
      gpu?.hzb?.dispose();
      scene.remove(root);
    },
  };
}
