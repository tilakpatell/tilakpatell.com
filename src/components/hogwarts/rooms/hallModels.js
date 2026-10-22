// The Great Hall's furniture as models (world/heroes.js: Sketchfab's, under
// CC-BY), in place of the kit's stand-ins once they are in: each house
// table as lengths of dark oak trestle table end to end, each bench a
// length at a time, the staff's high-backed chairs, and the floating
// candles' wax. Every part of a model is instanced, so a model is a draw a
// material however many of it stand in the hall. The Headmaster's gold
// chair, the high table under its cloth and the lectern stay the kit's.
//
//   CUTS: { part: { tier: cut } }: which cut each takes at a tier (the
//     benches and the candles repeat in their hundreds: their light cuts)
//   urlOf(part, tier) → the file, or null where the hall keeps its own
//   placements(plan, sizes) → { table: [{ at, ry, s }], bench: […], chair: […] }
//     (pure) sizes: { table, bench, chair }: each model's [x, y, z] as cut,
//     its length along x
//   dressHall({ plan, load, tier }) → { group, ready: Promise<boolean>, info(), dispose() }
//     load(url) → Promise<gltf>: the room's loader (ctx.load, else rt.assets.gltf)
//   waxOf(gltf) → BufferGeometry: a candle model's wax, merged, its foot on y 0

import * as THREE from 'three';
import { HALL } from './plan/greatHall';
import { fileOf } from '../world/heroes';

const MODELS = { table: 'house-table', bench: 'bench', chair: 'teacher-chair', candle: 'candle' };
// (a tier's detail name to the cut the hall asks for: the tables are seen
// close down their length, the benches and candles are many)
export const CUTS = {
  table: { ultra: 'mid', high: 'lo', mid: 'lo', low: 'lo' },
  bench: { ultra: 'mid', high: 'lo', mid: 'lo', low: 'lo' },
  chair: { ultra: 'mid', high: 'mid', mid: 'mid', low: 'lo' },
  // (on ultra alone: its drips are a pixel or two hung metres up, and 420
  // of them took the hall past its 800,000 triangles on high)
  candle: { ultra: 'lo' },
};
export const urlOf = (part, tier) => (CUTS[part][tier] ? fileOf(MODELS[part], CUTS[part][tier]) : null);

export function placements(plan, sizes) {
  const { table: T, bench: B } = HALL;
  // lengths along a run of `len` metres, as near the model's own as divides it evenly
  const lengths = (len, own) => {
    const n = Math.max(1, Math.round(len / own));
    return { n, each: len / n };
  };
  const table = [];
  for (const t of plan.tables) {
    const { n, each } = lengths(t.z1 - t.z0, sizes.table[0]);
    // (the model's length along x turned to run down the hall, its top at the table's height, its width the table's)
    for (let i = 0; i < n; i++) table.push({ at: [t.x, 0, t.z0 + each * (i + 0.5)], ry: Math.PI / 2, s: [each / sizes.table[0], T.top / sizes.table[1], T.width / sizes.table[2]] });
  }
  const bench = [];
  for (const b of plan.benches) {
    const { n, each } = lengths(b.z1 - b.z0, sizes.bench[0]);
    for (let i = 0; i < n; i++) bench.push({ at: [b.x, 0, b.z0 + each * (i + 0.5)], ry: Math.PI / 2, s: [each / sizes.bench[0], B.top / sizes.bench[1], B.width / sizes.bench[2]] });
  }
  // (the staff's chairs on the dais facing the hall, the gold one the kit's)
  const chair = plan.staff.filter((s) => !s.gold).map((s) => ({ at: [s.at[0], HALL.dais.height, s.at[2]], ry: 0, s: 1 }));
  return { table, bench, chair };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// a model's every drawn part instanced at the transforms, each part's own
// place in the model kept (its matrix under the scene's root)
function instance(scene, transforms, { shadows }) {
  const out = [];
  scene.updateMatrixWorld(true);
  const root = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const local = new THREE.Matrix4().multiplyMatrices(root, o.matrixWorld);
    const mesh = new THREE.InstancedMesh(o.geometry, o.material, transforms.length);
    transforms.forEach((t, i) => {
      _e.set(0, t.ry ?? 0, 0, 'YXZ');
      _q.setFromEuler(_e);
      _p.set(...t.at);
      const s = t.s ?? 1;
      _s.set(...(Array.isArray(s) ? s : [s, s, s]));
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s).multiply(local));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.computeBoundingSphere();
    mesh.name = `hall:${o.name || 'part'}`;
    out.push(mesh);
  });
  return out;
}

const sizeOf = (scene) => new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).toArray();

export function waxOf(gltf) {
  // (read corner by corner into plain floats: the cut's positions are
  // meshopt's 16-bit integers, which a transform in place would clamp)
  const out = [];
  const v = new THREE.Vector3();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
      out.push(v.x, v.y, v.z);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y, 0);
  return g;
}

export function dressHall({ plan, load, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'hall:models';
  const shadows = tier !== 'low';
  const made = [];
  let gone = false;
  const parts = ['table', 'bench', 'chair'];
  const ready = Promise.all(parts.map((p) => Promise.resolve(load(urlOf(p, tier))).catch(() => null)))
    .then((got) => {
      if (gone || got.some((g) => !g?.scene)) return false;
      const sizes = Object.fromEntries(parts.map((p, i) => [p, sizeOf(got[i].scene)]));
      const at = placements(plan, sizes);
      parts.forEach((p, i) => {
        for (const m of instance(got[i].scene, at[p], { shadows })) {
          made.push(m);
          group.add(m);
        }
      });
      return true;
    })
    .catch(() => false);
  return {
    group,
    ready,
    info: () => ({ instanced: made.length }),
    dispose() {
      gone = true;
      // (the geometry and materials are the loader's cache's, shared: only the instances go)
      for (const m of made) m.dispose?.();
      group.removeFromParent();
    },
  };
}
