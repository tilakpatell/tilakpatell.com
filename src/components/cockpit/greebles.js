// The small things a cockpit is crowded with, each kind one draw however
// many there are: rivets round a frame, knobs on a console, bundles of
// conduit clamped along a wall. Built from code like the rest of the kit
// (./kit.js), nothing downloaded; the Falcon and the X-wing wear them.
//
//   rivets(spots, mat, { radius }) → InstancedMesh: low domes
//   knobs(spots, mat, { radius, height }) → InstancedMesh: rotary knobs, a
//     ridge across each top so it reads as turned to a setting
//   conduit(path, mat, { count, radius, gap, clampMat, every }) → Group: `count`
//     tubes side by side along `path` ([x, y, z] points), clamped in bands
//
//   spots: [{ at: Vector3, n: Vector3 (out of the surface), spin? (radians) }]

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, tubeAlong } from './kit';

const Y = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _s = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);

// one InstancedMesh of `geo` stood on each spot, its +y out of the surface
function stood(geo, mat, spots) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
  const m = new THREE.Matrix4();
  spots.forEach((sp, i) => {
    _q.setFromUnitVectors(Y, sp.n.clone().normalize());
    _s.setFromAxisAngle(Y, sp.spin ?? 0);
    mesh.setMatrixAt(i, m.compose(sp.at, _q.clone().multiply(_s), _one));
  });
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function rivets(spots, mat, { radius = 0.0055 } = {}) {
  const geo = new THREE.SphereGeometry(radius, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, 0.45, 1);
  return stood(geo, mat, spots);
}

export function knobs(spots, mat, { radius = 0.009, height = 0.012 } = {}) {
  const body = new THREE.CylinderGeometry(radius * 0.92, radius, height, 16).translate(0, height / 2, 0);
  const skirt = new THREE.CylinderGeometry(radius * 1.35, radius * 1.4, height * 0.22, 16).translate(0, height * 0.11, 0);
  const ridge = new THREE.BoxGeometry(radius * 0.3, height * 0.25, radius * 1.7).translate(0, height * 1.05, 0);
  const geo = mergeGeometries([body, skirt, ridge].map((g) => g.toNonIndexed()));
  for (const g of [body, skirt, ridge]) g.dispose();
  return stood(geo, mat, spots);
}

export function conduit(path, mat, { count = 3, radius = 0.008, gap = 0.021, clampMat = mat, every = 0.3, seed = 3 } = {}) {
  const r = rng(seed);
  const pts = path.map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts);
  const len = curve.getLength();
  // (side by side across the way the wall faces: the bundle lies flat on it)
  const across = (t) => {
    const tan = curve.getTangentAt(t);
    const out = new THREE.Vector3().crossVectors(tan, Y);
    if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
    return out.normalize();
  };
  const tubes = [];
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * gap;
    const wobble = (r() - 0.5) * 0.004;
    const line = [];
    const n = Math.max(4, Math.round(len / 0.08));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      line.push(curve.getPointAt(t).addScaledVector(across(t), off + wobble).toArray());
    }
    tubes.push(tubeAlong(line, radius * (0.8 + r() * 0.4), { segs: n * 3, radial: 8 }));
  }
  const group = new THREE.Group();
  const geo = mergeGeometries(tubes);
  for (const t of tubes) t.dispose();
  group.add(new THREE.Mesh(geo, mat));
  // the bands round the bundle
  const bands = Math.max(1, Math.floor(len / every));
  const clamp = new THREE.BoxGeometry(count * gap + radius * 2.6, radius * 3, 0.016);
  const clamps = new THREE.InstancedMesh(clamp, clampMat, bands);
  const m = new THREE.Matrix4();
  const look = new THREE.Matrix4();
  for (let b = 0; b < bands; b++) {
    const t = (b + 0.5) / bands;
    const at = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const x = across(t);
    const y = new THREE.Vector3().crossVectors(tan, x).normalize();
    look.makeBasis(x, y, tan);
    clamps.setMatrixAt(b, m.copy(look).setPosition(at));
  }
  clamps.instanceMatrix.needsUpdate = true;
  clamps.computeBoundingSphere();
  group.add(clamps);
  return group;
}
