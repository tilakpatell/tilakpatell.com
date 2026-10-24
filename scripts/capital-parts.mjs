// Where each capital ship's subsystems and batteries (universe/wars.js's
// SUBSYSTEMS and TURRETS) are on the model the battles draw: how far each
// point is off the hull, the hull's surface over and under it, and the
// pieces of the model a part there would take with it when it's shot off
// (galaxy/capitalParts.js's rule: the model's separate pieces whose middle
// is within the part's reach and that are no bigger than it). A point in
// empty space is a hitbox nobody can see; this says where the ship is.
//
//   node scripts/capital-parts.mjs [--kinds destroyer,moncal] [--turrets] [--snap] [--probe 'x,z;x,z']
//
// It reads the light cut each kind has in public/ (the same hull as every
// other cut, so the same shares of its length), turned and fitted as
// galaxy/models.js fits it.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { parseArgs } from './lib/args.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

// src modules use Vite's extensionless imports: loaded through Vite
const { createServer } = await import('vite');
const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error' });
try {
  const load = (path) => vite.ssrLoadModule(`/${path}`);
  const { SUBSYSTEMS, TURRETS } = await load('src/components/universe/wars.js');
  const { modelsAt } = await load('src/components/galaxy/models.js');
  const { reachOf, piecesOf } = await load('src/components/galaxy/capitalParts.js');
  const { fitScale } = await load('src/components/universe/shipFit.js');
  const MODELS = modelsAt('mid');
  const kinds = typeof args.kinds === 'string' ? args.kinds.split(',') : args.snap ? Object.keys(TURRETS) : Object.keys(SUBSYSTEMS);
  for (const kind of kinds) {
    const row = MODELS[kind];
    const file = row && join(ROOT, 'public', row.url);
    if (!file || !existsSync(file)) {
      console.log(`${kind}: no model in public/ (${row?.url ?? 'none'})`);
      continue;
    }
    const meshes = await unitMeshes(file, row.nose ?? 0, kind, fitScale);
    console.log(`\n${kind}  ${row.url}  nose ${(row.nose ?? 0).toFixed(3)}`);
    // (--probe x,z;x,z…: the hull's top and keel at each, for placing a part)
    if (typeof args.probe === 'string')
      for (const xz of args.probe.split(';')) {
        const [x, z] = xz.split(',').map(Number);
        const p = new THREE.Vector3(x, 0, z);
        console.log(`  probe ${x.toFixed(3)}, ${z.toFixed(3)}: top ${cast(meshes, p, -1)?.y.toFixed(3) ?? 'none'}  keel ${cast(meshes, p, 1)?.y.toFixed(3) ?? 'none'}`);
      }
    // (--snap: each battery put on the hull, its top or its keel by which
    // side of the middle it was meant for, in from the beam where its place
    // is past the hull's edge; printed as TURRETS' row)
    if (args.snap) {
      const rows = (TURRETS[kind] ?? []).map(([x, y, z]) => {
        for (let k = 1; k >= 0.2; k -= 0.05) {
          const hit = cast(meshes, new THREE.Vector3(x * k, y, z), y < 0 ? 1 : -1);
          if (hit) return [x * k, hit.y + (y < 0 ? -1 : 1) * 0.004, z].map((v) => +v.toFixed(3));
        }
        return [x, y, z];
      });
      console.log(`  ${kind}: ${JSON.stringify(rows)},`);
      continue;
    }
    const parts = (SUBSYSTEMS[kind] ?? []).map((s) => ({ id: s.id, kind: s.kind, at: s.at, r: s.r }));
    if (args.turrets) (TURRETS[kind] ?? []).forEach((at, i) => parts.push({ id: `battery-${i}`, kind: 'battery', at, r: 0.012 }));
    for (const p of parts) {
      const at = new THREE.Vector3(...p.at);
      const near = nearest(meshes, at);
      const top = cast(meshes, at, -1);
      const keel = cast(meshes, at, 1);
      const pieces = piecesOf(meshes.map((m) => m.mesh), { at: p.at, reach: reachOf(p) });
      const tris = pieces.reduce((n, x) => n + x.tris.length, 0);
      const fmt = (v) => (v ? `[${v.toArray().map((n) => n.toFixed(3)).join(', ')}]` : 'none');
      console.log(`  ${p.id.padEnd(11)} at ${fmt(at)} r ${p.r}  off the hull ${near.toFixed(3)}  top ${fmt(top)}  keel ${fmt(keel)}  takes ${tris} triangles in ${pieces.length} meshes`);
    }
  }
} finally {
  await vite.close();
}

// the model's meshes in its unit frame: centred on its box, nose to +z, 1 long
async function unitMeshes(file, nose, kind, fitScale) {
  const doc = await io.read(file);
  const turn = new THREE.Matrix4().makeRotationY(nose);
  const root = new THREE.Group();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = turn.clone().multiply(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const n = pos.getCount();
      const p = new Float32Array(n * 3);
      const e = [];
      for (let i = 0; i < n; i++) p.set(pos.getElement(i, e), i * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const idx = prim.getIndices();
      if (idx) g.setIndex(Array.from({ length: idx.getCount() }, (_, i) => idx.getScalar(i)));
      const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      o.name = prim.getMaterial()?.getName() ?? '';
      o.applyMatrix4(m);
      root.add(o);
    }
  }
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true); // (precise, as models.js fits it)
  const size = box.getSize(new THREE.Vector3());
  const k = fitScale(kind, size);
  const fit = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(...box.getCenter(new THREE.Vector3()).negate().toArray()));
  const unit = new THREE.Group();
  unit.applyMatrix4(fit);
  unit.add(...root.children);
  unit.updateMatrixWorld(true);
  return unit.children.map((mesh) => ({ mesh }));
}

// the distance from `at` to the nearest of the hull's triangles
function nearest(meshes, at) {
  let best = Infinity;
  const tri = new THREE.Triangle();
  const q = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const { mesh } of meshes) {
    const pos = mesh.geometry.attributes.position;
    const idx = mesh.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const [i0, i1, i2] = idx ? [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] : [i, i + 1, i + 2];
      a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      tri.set(a, b, c).closestPointToPoint(at, q);
      const d = q.distanceTo(at);
      if (Number.isFinite(d)) best = Math.min(best, d);
    }
  }
  return best;
}

// the hull's top (dir −1: cast down from over the ship) or its keel (dir 1:
// up from under it) at `at`'s x and z
function cast(meshes, at, dir) {
  const ray = new THREE.Raycaster(new THREE.Vector3(at.x, -dir * 2, at.z), new THREE.Vector3(0, dir, 0));
  const hit = ray.intersectObjects(meshes.map((m) => m.mesh), false)[0];
  return hit?.point ?? null;
}
