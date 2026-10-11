// The lit fixture's GPU scene stress (GPU-first lane N1, scripts/light-fixture.mjs
// --gpuscene): 3,000 pillars and crates out round the ring, a share of the
// crates mirrored, each mesh with two LOD files, drawn through
// src/lib/three/gpuScene (one storage buffer, the compute cull with the LOD
// cut and the depth pyramid, one indirect draw a material group) on a
// renderer that draws indirect; on the node renderer over WebGL 2 the same
// rows as lane L draws them, an InstancedMesh a mesh, file and side (the
// fallback by data: the path is never taken there). The world's own
// fixture code; the level's path is src/components/galaxy/surface/level/levelGpu.js.
//
//   createGpuSceneField({ scene, renderer, tier, count = 3000 }) → Promise<{
//     path: 'gpuScene' | 'instanced', beforeRender(camera), stats() → { path, draws, rows, … the cull's }, dispose() }>

import { ROW_U32, packInstances } from '../../lib/three/gpuScene/pack.js';
import { meshTable } from '../../lib/three/gpuScene/cull.js';
import { createGpuScene } from '../../lib/three/gpuScene/scene.js';
import { hasIndirect, loadGpuThree } from '../../lib/three/gpuScene/three.js';

const PILLAR = { radius: 2.6, bounds: [-0.5, 0, -0.5, 0.5, 5, 0.5], lods: [1200, 12], glb: ['pillar0', 'pillar1'] };
const CRATE = { radius: 0.9, bounds: [-0.5, 0, -0.5, 0.5, 1, 0.5], lods: [800, 60], glb: ['crate0', 'crate1'] };

// the rows: pillars on rings from 18 m out, crates between them, every fifth crate mirrored (seeded)
export function fieldRows(count = 3000, seed = 3) {
  let s = seed >>> 0;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const rows = [];
  for (let i = 0; i < count; i++) {
    const crate = i % 3 === 0;
    const mirrored = crate && i % 5 === 0;
    const a = r() * Math.PI * 2;
    const d = 18 + Math.sqrt(r()) * 160;
    const turn = r() * Math.PI * 2;
    const k = crate ? 0.8 + r() * 0.8 : 1;
    rows.push({ position: [Math.cos(a) * d, 0, Math.sin(a) * d], quaternion: [0, Math.sin(turn / 2), 0, Math.cos(turn / 2)], scale: [mirrored ? -k : k, k, k], mesh: crate ? 1 : 0, mirrored });
  }
  return rows;
}

export async function createGpuSceneField({ scene, renderer, tier = 'ultra', count = 3000 }) {
  const three = await loadGpuThree();
  const { THREE } = three;
  const stone = new THREE.MeshStandardNodeMaterial({ color: 0xd8d2c8, roughness: 0.7 });
  const wood = new THREE.MeshStandardNodeMaterial({ color: 0x8a5a32, roughness: 0.8 });
  const steel = new THREE.MeshStandardNodeMaterial({ color: 0x9aa4b0, roughness: 0.35, metalness: 0.6 });
  const crate = (n) => [
    { geometry: new THREE.BoxGeometry(1, 1, 1, n, n, n).translate(0, 0.5, 0), material: wood, local: new THREE.Matrix4() },
    // (a wedge on one side: a mirrored crate reads mirrored)
    { geometry: new THREE.ConeGeometry(0.3, 0.5, n * 4 + 4).rotateZ(-Math.PI / 2).translate(0.5, 0.5, 0.2), material: steel, local: new THREE.Matrix4() },
  ];
  const files = {
    pillar0: [{ geometry: new THREE.CylinderGeometry(0.5, 0.5, 5, 32, 8).translate(0, 2.5, 0), material: stone, local: new THREE.Matrix4() }],
    pillar1: [{ geometry: new THREE.BoxGeometry(1, 5, 1).translate(0, 2.5, 0), material: stone, local: new THREE.Matrix4() }],
    crate0: crate(4),
    crate1: crate(1),
  };
  const rows = fieldRows(count);
  const pack = { meshes: [PILLAR, CRATE] };
  const counts = new Map();
  for (const row of rows) counts.set(`${row.mesh}|${row.mirrored ? 1 : 0}`, (counts.get(`${row.mesh}|${row.mirrored ? 1 : 0}`) ?? 0) + 1);
  const made = [stone, wood, steel, ...Object.values(files).flatMap((p) => p.map((x) => x.geometry))];

  if (!hasIndirect(renderer)) {
    // lane L's path: the finest file of each mesh, an InstancedMesh a part and side
    const group = new THREE.Group();
    const m = new THREE.Matrix4();
    for (const [mesh, glb] of [
      [0, 'pillar0'],
      [1, 'crate0'],
    ]) {
      for (const mirrored of [false, true]) {
        const mine = rows.filter((row) => row.mesh === mesh && row.mirrored === mirrored);
        if (!mine.length) continue;
        for (const part of files[glb]) {
          let g = part.geometry;
          if (mirrored) {
            g = g.clone();
            const ix = g.index.array;
            for (let t = 0; t + 2 < ix.length; t += 3) [ix[t + 1], ix[t + 2]] = [ix[t + 2], ix[t + 1]];
            made.push(g);
          }
          const im = new THREE.InstancedMesh(g, part.material, mine.length);
          mine.forEach((row, i) => im.setMatrixAt(i, m.compose(new THREE.Vector3(...row.position), new THREE.Quaternion(...row.quaternion), new THREE.Vector3(...row.scale))));
          im.castShadow = im.receiveShadow = true;
          group.add(im);
        }
      }
    }
    scene.add(group);
    return {
      path: 'instanced',
      beforeRender() {},
      stats: () => ({ path: 'instanced', draws: group.children.length, rows: rows.length }),
      dispose() {
        scene.remove(group);
        for (const x of made) x.dispose();
      },
    };
  }

  const [{ createCull }, { createDraws }, { createHzb }] = await Promise.all([import('../../lib/three/gpuScene/cullPass.js'), import('../../lib/three/gpuScene/draws.js'), import('../../lib/three/gpuScene/hzb.js')]);
  const rowsBuf = createGpuScene({ capacity: rows.length });
  const packed = new Uint32Array(rows.length * ROW_U32);
  packInstances(rows, packed);
  rowsBuf.append(packed, rows.length);
  const table = meshTable(pack, tier, { counts });
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const hzb = createHzb(renderer, { width: size.x, height: size.y, three });
  const cull = createCull(renderer, { scene: rowsBuf, table, hzb, three, slots: 64 });
  const draws = createDraws(renderer, { cull, three, parent: scene, keyOf: (mat) => mat.uuid });
  for (const [glb, parts] of Object.entries(files)) {
    draws.add(parts, table.keysOf(glb).map((key) => ({ key, ...table.keyInfo(key) })));
    table.load(glb);
  }
  const t0 = performance.now();
  let frames = 0;
  return {
    path: 'gpuScene',
    beforeRender(camera) {
      renderer.getDrawingBufferSize(size);
      if (frames > 0) hzb.update(draws.prepass(camera, size.x, size.y));
      cull.run(camera, { now: (performance.now() - t0) / 1000, width: size.x, height: size.y });
      frames++;
    },
    stats: () => ({ path: 'gpuScene', draws: draws.stats().groups, indirect: draws.stats().slots, rows: rows.length, ...cull.stats() }),
    dispose() {
      draws.dispose();
      cull.dispose();
      hzb.dispose();
      for (const x of made) x.dispose();
    },
  };
}
