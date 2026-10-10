// Rocks in space: Geonosis' asteroid ring, the Hoth asteroid field, what's
// left of Alderaan. A handful of rock shapes (icosahedra pushed in and out
// by noise, chipped flat here and there, faceted), drawn instanced, a few
// draw calls for hundreds of rocks; each tumbling slowly where it is. Where
// they are, how big, which way they turn: all from the seed, so every
// pilot sees the same field and the big rocks the ship can hit stay put.
//
// The tumbling is the graphics card's: an instance's matrix is only where
// the rock is and how big, written once, and each rock carries its axis and
// its phase and speed as instance attributes, so the vertex shader turns it
// (about its own middle, by phase + time * speed) before the instance
// matrix puts it in place. A frame costs one uniform, not a matrix per rock.
// The smaller half of the rocks, too small to show their facets, are drawn
// with the shape one subdivision coarser; the finest is for the big rocks.
//
// createRocks({ kind = 'field', at = [0, 0, 0], count = 400, seed = 1, small = false, ...shape })
//   → { group, solids, update(t), dispose() }
// kind 'ring': { inner, outer, thickness, tilt: [x, z] } round a planet at `at`
//      'field': { radius } a loose cloud, a few huge rocks, many small
//      'debris': { radius } a planet's remains, chunks scorched and still glowing
//      'placed': { pieces, models, tracks, keep } a game's space level's own
//      rocks, each where its map put it, turning on its track (rocksPlaced.js)
// solids: [{ id: 'rock-N', at: [x, y, z] (world), r, reach }], the big rocks (at most 60)

import * as THREE from 'three';
import { createPlacedRocks } from './rocksPlaced';

const MAX_SOLIDS = 60;

// a seeded random sequence
const rng = (seed) => {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 3D value noise, for the rocks' shapes
const hash = (x, y, z, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t) => t * t * (3 - 2 * t);
const vnoise = (x, y, z, s) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(ix + dx, iy + dy, iz + dz, s);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy), l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz) * 2 - 1;
};
const fbm = (x, y, z, s, n = 3) => {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < n; i++) {
    v += a * vnoise(x, y, z, s + i * 17);
    x *= 2.1;
    y *= 2.1;
    z *= 2.1;
    a *= 0.5;
  }
  return v;
};

// one rock shape: a lumpy, chipped, stretched icosahedron, about unit size
function rockGeometry(seed, detail, chunky) {
  const rand = rng(seed * 31 + 7);
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const stretch = new THREE.Vector3(1 + rand() * 0.35, 0.75 + rand() * 0.25, 0.85 + rand() * 0.3);
  // chips: flat faces where a piece broke off
  const cuts = [];
  for (let i = 0; i < (chunky ? 6 : 3); i++) {
    const n = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    cuts.push({ n, d: (chunky ? 0.55 : 0.7) + rand() * 0.25 });
  }
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const k = 1 + 0.32 * fbm(v.x * 1.3 + seed, v.y * 1.3, v.z * 1.3, seed, 3) + 0.1 * vnoise(v.x * 4, v.y * 4, v.z * 4, seed + 5);
    v.multiplyScalar(k);
    for (const c of cuts) {
      const d = v.dot(c.n);
      if (d > c.d) v.addScaledVector(c.n, -(d - c.d) * 0.85);
    }
    v.multiply(stretch);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  // (sized so its mean radius is about 1: what the collision sphere is)
  geo.computeBoundingSphere();
  let sum = 0;
  for (let i = 0; i < pos.count; i++) sum += v.fromBufferAttribute(pos, i).length();
  const mean = sum / pos.count;
  geo.scale(1 / mean, 1 / mean, 1 / mean);
  geo.computeBoundingSphere();
  return geo;
}

// A rock material that turns each instance in the vertex shader: about the
// axis in aSpinAxis, by aSpin.x (its phase) + uTime * aSpin.y (its speed).
// It turns the vertex and the normal in the rock's own space, before the
// instance matrix moves and sizes it (three applies that later, in
// project_vertex and defaultnormal_vertex). The uniform is one object the
// rocks keep hold of, so a frame is one number.
const SPIN = `
attribute vec3 aSpinAxis;
attribute vec2 aSpin;
uniform float uTime;
vec3 rockSpin(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}`;
function spinning(material, time) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${SPIN}`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nfloat rockAngle = aSpin.x + uTime * aSpin.y;\nobjectNormal = rockSpin(objectNormal, aSpinAxis, rockAngle);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = rockSpin(transformed, aSpinAxis, rockAngle);');
  };
  // (its own program, whatever other materials' compile hooks look like)
  material.customProgramCacheKey = () => 'rock-spin';
  return material;
}

const PALETTES = {
  field: ['#5a5550', '#6b625a', '#4a4744', '#5e5a56', '#3f3b38'],
  ring: ['#7a5240', '#8a6a52', '#5e4a3e', '#9a7a60', '#6e4430'],
  debris: ['#4a4440', '#6a5a4a', '#3a3632', '#8a8070', '#5a4434'],
};

// where each rock goes and how big it is
function layout(kind, count, rand, shape) {
  const out = [];
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  if (kind === 'ring') {
    const { inner = 50, outer = 80, thickness = 4 } = shape;
    for (let i = 0; i < count; i++) {
      const u = (rand() + rand()) / 2;
      const rr = inner + (outer - inner) * u;
      const a = rand() * Math.PI * 2;
      const big = rand() < 0.05;
      const size = big ? 1.4 + rand() * 1.8 : 0.18 + Math.pow(rand(), 3) * 1.2;
      out.push({ p: new THREE.Vector3(Math.cos(a) * rr, gauss() * thickness * 0.5, Math.sin(a) * rr), size });
    }
  } else {
    const R = shape.radius ?? 60;
    const debris = kind === 'debris';
    for (let i = 0; i < count; i++) {
      // a few huge, many small
      const u = rand();
      const size = debris ? 0.15 + Math.pow(u, 5) * 3.2 : 0.25 + Math.pow(u, 7) * 7.75;
      const d = new THREE.Vector3(gauss(), gauss() * (debris ? 0.45 : 0.6), gauss()).normalize();
      const rr = R * Math.pow(rand(), debris ? 0.6 : 0.45);
      out.push({ p: d.multiplyScalar(rr), size });
    }
  }
  return out;
}

export function createRocks({ kind = 'field', at = [0, 0, 0], count = 400, seed = 1, small = false, ...shape } = {}) {
  if (kind === 'placed') {
    const placed = createPlacedRocks(shape);
    placed.group.position.set(...at);
    for (const x of placed.solids) x.at = x.at.map((v, k) => v + at[k]);
    return placed;
  }
  const rand = rng(seed);
  const group = new THREE.Group();
  group.position.set(...at);
  if (kind === 'ring' && shape.tilt) group.rotation.set(shape.tilt[0] ?? 0, 0, shape.tilt[1] ?? 0);
  group.updateMatrixWorld(true);
  const made = [];
  const n = Math.max(1, Math.round(count * (small ? 0.6 : 1)));
  const rocks = layout(kind, n, rand, shape);

  // the big ones can't overlap each other: nudge them apart
  const order = rocks.map((_, i) => i).sort((a, b) => rocks[b].size - rocks[a].size);
  const bigs = order.slice(0, MAX_SOLIDS).filter((i) => rocks[i].size >= (kind === 'debris' ? 1 : 1.2));
  for (let pass = 0; pass < 4; pass++) {
    for (let a = 0; a < bigs.length; a++) {
      for (let b = a + 1; b < bigs.length; b++) {
        const A = rocks[bigs[a]];
        const B = rocks[bigs[b]];
        const d = A.p.distanceTo(B.p);
        const min = (A.size + B.size) * 1.15;
        if (d < min) {
          const push = B.p.clone().sub(A.p).normalize().multiplyScalar((min - d) * 0.5 + 0.01);
          if (!Number.isFinite(push.x)) push.set(min, 0, 0);
          A.p.sub(push);
          B.p.add(push);
        }
      }
    }
  }

  // the shapes, the materials
  const variants = small ? 3 : 5;
  const detail = small ? 1 : 2;
  const timeUniform = { value: 0 };
  const rockMat = spinning(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.94, metalness: 0.04, flatShading: true }), timeUniform);
  const hotMat = spinning(new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.8, metalness: 0, emissive: new THREE.Color('#ff9a3a'), emissiveIntensity: 3, flatShading: true }), timeUniform);
  made.push(rockMat, hotMat);
  const palette = (PALETTES[kind] ?? PALETTES.field).map((c) => new THREE.Color(c));

  // a rock's shape: a variant, one subdivision coarser for the small ones (never below detail 1), made once
  const variantGeos = new Map();
  const shapeDetail = (v, coarse) => Math.max(1, (v === 0 && !small ? 3 : detail) - (coarse ? 1 : 0));
  const variantGeo = (v, coarse) => {
    const key = `${v}${coarse ? 'c' : ''}`;
    if (!variantGeos.has(key)) variantGeos.set(key, rockGeometry(seed * 13 + v, shapeDetail(v, coarse), kind === 'debris'));
    return variantGeos.get(key);
  };

  // which rock is drawn by which mesh: the hot ones (debris) apart, and the smaller half of the rocks
  // (where that's a coarser shape at all) apart from the bigger
  const smaller = new Set(order.slice(n - Math.floor(n / 2)));
  const buckets = new Map();
  const tmpC = new THREE.Color();
  rocks.forEach((rk, i) => {
    const hot = kind === 'debris' && rk.size < 1.6 && rand() < 0.14;
    const v = Math.floor(rand() * variants);
    const coarse = smaller.has(i) && shapeDetail(v, true) < shapeDetail(v, false);
    const key = `${hot ? 'h' : 'r'}${v}${coarse ? 'c' : ''}`;
    if (!buckets.has(key)) buckets.set(key, { v, hot, coarse, list: [] });
    const axis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
    const speed = (0.03 + rand() * 0.25) / Math.sqrt(rk.size) * (rand() < 0.5 ? -1 : 1);
    const phase = rand() * Math.PI * 2;
    const scorched = kind === 'debris' && rand() < 0.35;
    tmpC.copy(palette[Math.floor(rand() * palette.length)]).multiplyScalar(0.8 + rand() * 0.4);
    if (scorched) tmpC.lerp(new THREE.Color('#2a221c'), 0.6);
    buckets.get(key).list.push({ axis, speed, phase, size: rk.size, p: rk.p, color: tmpC.clone() });
  });

  // one mesh to a bucket, each on its own copy of the shape (the instance attributes can't sit on a geometry
  // others share), a rock's place and size written once, its axis and spin beside them
  const meshes = [];
  const m = new THREE.Matrix4();
  const still = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  for (const b of buckets.values()) {
    const geo = variantGeo(b.v, b.coarse).clone();
    // (about its own middle, whichever way it's turned: a sphere that holds in every turn, for the culling)
    const pos = geo.attributes.position;
    let reach = 0;
    for (let k = 0; k < pos.count; k++) reach = Math.max(reach, pos.getX(k) ** 2 + pos.getY(k) ** 2 + pos.getZ(k) ** 2);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(reach));
    const axes = new Float32Array(b.list.length * 3);
    const spins = new Float32Array(b.list.length * 2);
    const mesh = new THREE.InstancedMesh(geo, b.hot ? hotMat : rockMat, b.list.length);
    b.list.forEach((s, j) => {
      m.compose(s.p, still, sc.setScalar(s.size));
      mesh.setMatrixAt(j, m);
      axes.set([s.axis.x, s.axis.y, s.axis.z], j * 3);
      spins.set([s.phase, s.speed], j * 2);
      if (!b.hot) mesh.setColorAt(j, s.color);
    });
    geo.setAttribute('aSpinAxis', new THREE.InstancedBufferAttribute(axes, 3));
    geo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spins, 2));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    made.push(geo);
    group.add(mesh);
    meshes.push(mesh);
  }

  // the big rocks, in the world
  const w = new THREE.Vector3();
  const solids = bigs.map((i, k) => {
    w.copy(rocks[i].p).applyMatrix4(group.matrixWorld);
    const r = rocks[i].size * 0.95;
    return { id: `rock-${k}`, at: [w.x, w.y, w.z], r, reach: r };
  });

  return {
    group,
    solids,
    update(t) {
      timeUniform.value = t;
      hotMat.emissiveIntensity = 2.8 + 0.5 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1);
    },
    dispose() {
      for (const mesh of meshes) mesh.dispose();
      for (const x of made) x.dispose();
      made.length = 0;
    },
  };
}
