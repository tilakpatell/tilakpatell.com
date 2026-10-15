// The places to find (../placesDraw.js) on the node renderer: the same
// two draws, the same seeded shapes. The solids are one mesh under the
// MeshStandardMaterial’s node twin, the same settings, lit by the system’s
// suns as before. The glows were a cloud of points sized by gl_PointSize;
// the node renderer draws a point one pixel wide, so a glow is a sprite
// instanced once a point (three’s PointsNodeMaterial on a Sprite, its
// geometry the Sprite’s quad with each glow’s attributes stepped once an
// instance, `aAt` its place), its sizeNode the GLSL’s gl_PointSize, line for
// line, and its fragment the GLSL’s: a soft disc, cut at its rim. The same
// uniforms under the same names (nodes, on `material.uniforms`), the same
// flags. A point’s centre off the picture dropped the whole point on WebGL;
// a sprite’s quad is clipped instead, so a glow at the picture’s edge shows
// its half.
//
// createPlaces({ places, sun, small, rand }) → { group, update(t, dt), dispose() }
//   sun: the way to the system’s first sun (a unit vector), for the comet’s tail

import * as THREE from 'three';
import { MeshStandardNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import { attribute, clamp, float, length, max, positionView, screenDPR, select, sin, smoothstep, uniform, uv } from 'three/tsl';

const TAU = Math.PI * 2;

// a seeded random sequence (rocks.js’s)
const rng = (seed) => {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// one piece of a solid place: a geometry at `at` with a colour
const piece = (parts, geom, at, color, q = null, scale = 1) => {
  // (the icosahedron and octahedron come non-indexed: three warns on asking again)
  const g = geom.index ? geom.toNonIndexed() : geom;
  if (q) g.applyQuaternion(q);
  if (scale !== 1) g.scale(scale, scale, scale);
  g.translate(at[0], at[1], at[2]);
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(color, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (g !== geom) geom.dispose();
  parts.push(g);
};
// an icosahedron with its surface pushed in and out by the seed: a rock, a comet’s head
const lump = (r, detail, rand, rough = 0.35) => {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (rand() - 0.5) * rough);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
};
const tilt = (rand) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * TAU, rand() * TAU, rand() * TAU));
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

const HULL = [0.3, 0.3, 0.32];
const SCORCH = [0.14, 0.11, 0.1];
const ROCK = [0.42, 0.38, 0.34];
const ICE = [0.78, 0.84, 0.92];
const STEEL = [0.5, 0.52, 0.56];

// the solid shapes of a place, as parts of the one geometry
const SOLID = {
  wreck(parts, at, rand) {
    const q = tilt(rand);
    const along = new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray();
    // (a frigate’s hull: 4 long, where a Star Destroyer’s 16)
    piece(parts, new THREE.CylinderGeometry(0.45, 0.7, 4.2, 10, 1, false), at, HULL, q);
    piece(parts, new THREE.BoxGeometry(1, 0.55, 0.85), add(at, along, 1.6), HULL, q);
    piece(parts, new THREE.BoxGeometry(0.16, 1.7, 0.9), add(at, along, -1), SCORCH, q);
    // what came off it, drifting near
    for (let i = 0; i < 5; i++) piece(parts, lump(0.2 + rand() * 0.25, 0, rand), add(at, [rand() - 0.5, rand() - 0.5, rand() - 0.5], 7), i % 2 ? SCORCH : HULL, tilt(rand));
  },
  comet(parts, at, rand) {
    piece(parts, lump(4, 1, rand, 0.5), at, ICE, tilt(rand));
  },
  rocks(parts, at, rand) {
    for (let i = 0; i < 14; i++) {
      const off = [rand() - 0.5, (rand() - 0.5) * 0.6, rand() - 0.5];
      piece(parts, lump(1 + rand() * 2.6, i < 4 ? 1 : 0, rand), add(at, off, 18), ROCK, tilt(rand));
    }
  },
  beacon(parts, at) {
    piece(parts, new THREE.OctahedronGeometry(0.6, 0), at, STEEL);
    piece(parts, new THREE.CylinderGeometry(0.06, 0.06, 2.8, 6), at, STEEL);
    piece(parts, new THREE.TorusGeometry(0.45, 0.05, 6, 20), add(at, [0, -1, 0]), STEEL, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
  },
  outpost(parts, at, rand) {
    const q = tilt(rand);
    const along = new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray();
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)).premultiply(q);
    // (a platform the size of a small station: rings 8 across on a spar 10 long)
    piece(parts, new THREE.CylinderGeometry(0.28, 0.28, 10, 8), at, STEEL, q);
    piece(parts, new THREE.TorusGeometry(4, 0.45, 8, 28), add(at, along, 1.6), STEEL, flat);
    piece(parts, new THREE.TorusGeometry(2.8, 0.32, 8, 24), add(at, along, -2.2), HULL, flat);
    piece(parts, new THREE.SphereGeometry(1.1, 10, 8), add(at, along, 4.8), STEEL);
  },
  nebula() {},
};

// the glows’ shader: VERT and FRAG of the original, as nodes
function glowMaterial() {
  const u = { uTime: uniform(0), uScale: uniform(600) }; // uScale: half the picture’s height in pixels, over the tangent of half the view
  const mat = new PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, sizeAttenuation: false });
  const aSize = attribute('aSize', 'float');
  const aPhase = attribute('aPhase', 'float');
  const aKind = attribute('aKind', 'float'); // 0: steady, 1: a blink, 2: a slow breathing
  mat.positionNode = attribute('aAt', 'vec3');
  const pulse = select(aKind.greaterThan(1.5), sin(u.uTime.mul(0.7).add(aPhase)).mul(0.3).add(0.7), select(aKind.greaterThan(0.5), smoothstep(0.55, 0.75, sin(u.uTime.mul(3.2).add(aPhase))), float(1)));
  const vAlpha = pulse.toVarying('vAlpha');
  const vColor = attribute('aColor', 'vec3').toVarying('vColor');
  // gl_PointSize, in the drawing buffer’s pixels (three’s sprite multiplies by the DPR again)
  const px = aSize.mul(u.uScale).div(max(1, positionView.z.negate()));
  mat.sizeNode = select(positionView.z.greaterThan(-0.5), float(0), clamp(px, 2, 160)).div(screenDPR);
  const r = length(uv().sub(0.5)).mul(2);
  const a = r.oneMinus().mul(r.oneMinus());
  mat.colorNode = vColor.mul(a).mul(vAlpha);
  mat.opacityNode = a.mul(vAlpha);
  mat.maskNode = r.lessThanEqual(1);
  mat.uniforms = u;
  return mat;
}

export function createPlaces({ places, sun = [0, 1, 0], small = false, rand = rng(11) } = {}) {
  const group = new THREE.Group();
  group.name = 'places';
  // ── the solids, one mesh ──
  const parts = [];
  for (const p of places) SOLID[p.kind]?.(parts, p.at, rand);
  let solid;
  if (parts.length) {
    const n = parts.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    let at = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, at * 3);
      nor.set(g.attributes.normal.array, at * 3);
      col.set(g.attributes.color.array, at * 3);
      at += g.attributes.position.count;
      g.dispose();
    }
    solid = new THREE.BufferGeometry();
    solid.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    solid.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    solid.setAttribute('color', new THREE.BufferAttribute(col, 3));
  } else solid = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  solid.computeBoundingSphere();
  const solidMat = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.2, flatShading: true });
  const mesh = new THREE.Mesh(solid, solidMat);
  mesh.name = 'places-solid';
  group.add(mesh);

  // ── the glows, one cloud ──
  const pts = []; // [x, y, z, r, g, b, size, phase, kind]
  const glow = (at, color, size, kind = 0, phase = 0) => pts.push(at[0], at[1], at[2], color[0], color[1], color[2], size, phase, kind);
  const away = new THREE.Vector3(...sun).normalize().multiplyScalar(-1);
  const side = new THREE.Vector3(0, 1, 0).cross(away).normalize();
  const up = away.clone().cross(side).normalize();
  const k = small ? 0.4 : 1;
  for (const p of places) {
    // the marker: a soft point over every place, so it reads from across the system
    glow(p.at, p.kind === 'nebula' ? [0.5, 0.35, 0.9] : [0.55, 0.7, 1], 70, 2, rand() * TAU);
    if (p.kind === 'beacon') glow(add(p.at, [0, 1.5, 0]), [1.6, 0.25, 0.1], 18, 1, rand() * TAU);
    else if (p.kind === 'comet') {
      const n = Math.round(80 * k);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const d = 6 + t * t * 240;
        const spread = 1.5 + t * 14;
        const at = add(add(add(p.at, away.toArray(), d), side.toArray(), (rand() - 0.5) * spread), up.toArray(), (rand() - 0.5) * spread);
        glow(at, [0.6 * (1 - t) + 0.2, 0.75 * (1 - t) + 0.3, 1], 10 + t * 26, 0);
      }
    } else if (p.kind === 'nebula') {
      const n = Math.round(140 * k);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.6, rand() - 0.5).normalize().multiplyScalar(Math.pow(rand(), 0.6) * 44);
        const warm = rand();
        glow(add(p.at, v.toArray()), [0.35 + warm * 0.45, 0.2 + (1 - warm) * 0.2, 0.7 + (1 - warm) * 0.3], 26 + rand() * 30, 2, rand() * TAU);
      }
    } else if (p.kind === 'outpost') for (let i = 0; i < 6; i++) glow(add(p.at, [rand() - 0.5, rand() - 0.5, rand() - 0.5], 8), [1.3, 1.1, 0.6], 4, 1, rand() * TAU);
  }
  const m = pts.length / 9;
  const position = new Float32Array(m * 3);
  const aColor = new Float32Array(m * 3);
  const aSize = new Float32Array(m);
  const aPhase = new Float32Array(m);
  const aKind = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    position.set(pts.slice(i * 9, i * 9 + 3), i * 3);
    aColor.set(pts.slice(i * 9 + 3, i * 9 + 6), i * 3);
    aSize[i] = pts[i * 9 + 6];
    aPhase[i] = pts[i * 9 + 7];
    aKind[i] = pts[i * 9 + 8];
  }
  // (a glow a sprite, instanced: the quad three’s Sprite has, each glow’s
  // own attributes stepped once a sprite)
  const cloud = new THREE.InstancedBufferGeometry();
  cloud.setIndex([0, 1, 2, 0, 2, 3]);
  cloud.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  cloud.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  cloud.setAttribute('aAt', new THREE.InstancedBufferAttribute(position, 3));
  cloud.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3));
  cloud.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 1));
  cloud.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
  cloud.setAttribute('aKind', new THREE.InstancedBufferAttribute(aKind, 1));
  cloud.instanceCount = m;
  const cloudMat = glowMaterial();
  const points = new THREE.Sprite(cloudMat);
  points.geometry = cloud;
  points.count = m;
  points.name = 'places-glow';
  points.frustumCulled = false; // (one cloud across the whole system: its sphere is most of it anyway)
  // (points are sized in pixels, by the picture’s height and the view: read off the renderer each draw)
  const px = new THREE.Vector2();
  points.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(px);
    cloudMat.uniforms.uScale.value = (px.y / 2) * camera.projectionMatrix.elements[5];
  };
  group.add(points);

  return {
    group,
    update(t) {
      cloudMat.uniforms.uTime.value = t;
    },
    dispose() {
      solid.dispose();
      solidMat.dispose();
      cloud.dispose();
      cloudMat.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}
