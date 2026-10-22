// The village’s static parts, merged one mesh a material (a street of a
// dozen houses in a few dozen draws), as the rooms’ kit merges a room’s;
// but each piece keeps a tint in its vertex colours, so the twelve houses’
// plaster, paint and stone can each be their own shade under one material.
// A piece goes in already where it stands: a frame (a building’s turn and
// place) is a matrix the builder multiplies in.
//
//   createBuckets() → {
//     frame(matrix?, { deform }) → a frame: { box(mat, x, y, z, w, h, d, { rx, ry, rz, tint, uv }),
//       cyl(mat, x, y, z, r0, r1, h, opts), add(mat, geometry, { at, rx, ry, rz, scale, tint }),
//       local({ at, ry }) → a child frame, bent(deform) → this frame with a bend (deform(geometry), in its own space) },
//     build(group, { shadows, receive }) → { draws, triangles }, dispose() }
//   metricUv(geometry, { scale, axes }) → the geometry with its uvs in metres (scale: metres a repeat)

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const WHITE = new THREE.Color(1, 1, 1);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// (one shape for the merge: an index, a position, a normal, a uv and a colour)
function clean(g, tint) {
  if (g.index === null) g.setIndex([...Array(g.attributes.position.count).keys()]);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.color) {
    const c = tint ? (tint.isColor ? tint : new THREE.Color(tint)) : WHITE;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = c.r;
      a[i * 3 + 1] = c.g;
      a[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

// uvs from the position, in metres: each face takes the two axes it lies
// across (so a slate course or a sett is its own size on any face)
export function metricUv(g, { scale = 1, axes = null } = {}) {
  const p = g.attributes.position;
  const n = g.attributes.normal ?? (g.computeVertexNormals(), g.attributes.normal);
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    let u;
    let v;
    if (axes) [u, v] = axes(x, y, z, n.getX(i), n.getY(i), n.getZ(i));
    else {
      const ax = Math.abs(n.getX(i));
      const ay = Math.abs(n.getY(i));
      const az = Math.abs(n.getZ(i));
      if (ay >= ax && ay >= az) [u, v] = [x, z];
      else if (ax >= az) [u, v] = [z, y];
      else [u, v] = [x, y];
    }
    uv[i * 2] = u / scale;
    uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function createBuckets() {
  const buckets = new Map(); // material → [geometry]
  const merged = [];
  const meshes = [];

  const put = (mat, g, matrix, tint) => {
    if (!mat) {
      g.dispose();
      return;
    }
    if (matrix) g.applyMatrix4(matrix);
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(clean(g, tint));
  };

  const frame = (base = null, { deform = null } = {}) => {
    const M = base ? base.clone() : new THREE.Matrix4();
    const f = {
      matrix: M,
      add(mat, g, { at = [0, 0, 0], rx = 0, ry = 0, rz = 0, scale = 1, tint = null } = {}) {
        _e.set(rx, ry, rz, 'YXZ');
        _q.setFromEuler(_e);
        const sc = Array.isArray(scale) ? scale : [scale, scale, scale];
        _m.compose(_p.set(...at), _q, _s.set(...sc));
        g.applyMatrix4(_m);
        // (a crooked house: bent in its own frame, then stood where it stands)
        if (deform) {
          deform(g);
          g.computeVertexNormals();
        }
        put(mat, g, M, tint);
        return f;
      },
      bent(fn) {
        return frame(M, { deform: fn });
      },
      box(mat, x, y, z, w, h, d, { rx = 0, ry = 0, rz = 0, tint = null, uv = null } = {}) {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(0, h / 2, 0);
        if (uv) metricUv(g, { scale: uv });
        return f.add(mat, g, { at: [x, y, z], rx, ry, rz, tint });
      },
      cyl(mat, x, y, z, r0, r1, h, { seg = 10, rx = 0, ry = 0, rz = 0, tint = null, open = false } = {}) {
        const g = new THREE.CylinderGeometry(r0, r1, h, seg, 1, open);
        g.translate(0, h / 2, 0);
        return f.add(mat, g, { at: [x, y, z], rx, ry, rz, tint });
      },
      // a child frame: moved and turned within this one
      local({ at = [0, 0, 0], ry = 0 } = {}) {
        _e.set(0, ry, 0, 'YXZ');
        _q.setFromEuler(_e);
        return frame(M.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...at), _q.clone(), new THREE.Vector3(1, 1, 1))), { deform });
      },
    };
    return f;
  };

  return {
    frame,
    build(group, { shadows = true, receive = true } = {}) {
      let draws = 0;
      let triangles = 0;
      for (const [mat, geos] of buckets) {
        const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        for (const x of geos) if (x !== g) x.dispose();
        if (!g) continue;
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = shadows && !mat.userData.noHouse && !mat.transparent;
        mesh.receiveShadow = receive && !mat.userData.noHouse;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        group.add(mesh);
        merged.push(g);
        meshes.push(mesh);
        draws++;
        triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
      buckets.clear();
      return { draws, triangles };
    },
    meshes,
    dispose() {
      for (const g of merged) g.dispose();
      for (const geos of buckets.values()) for (const g of geos) g.dispose();
      merged.length = 0;
      buckets.clear();
    },
  };
}
