// The places to find (places.js), drawn: all of a system's in two draws,
// however many there are. The solid ones in one mesh (a derelict's hull, an
// outpost's rings on their spar, a comet's head, a beacon's body, a knot of
// rocks: icosahedra, cylinders and rings pushed about by the seed, one
// material, the colour in the vertices), and every glow in one cloud of
// points under one shader (a soft marker over each place so it reads from
// far off, the comet's tail streaming away from the sun, the nebula's puffs,
// the beacon's blink): no textures, the glow's worked out in the fragment
// shader. The mesh is lit by the system's suns like everything else. On a
// small tier the solids are the same (one draw, a few thousand triangles)
// and the glows are fewer.
//
// createPlaces({ places, sun, small, rand }) → { group, update(t, dt), dispose() }
//   sun: the way to the system's first sun (a unit vector), for the comet's tail

import * as THREE from 'three';

const TAU = Math.PI * 2;

// a seeded random sequence (rocks.js's)
const rng = (seed) => {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aPhase;
attribute float aKind; // 0: steady, 1: a blink, 2: a slow breathing
uniform float uTime;
uniform float uScale; // half the picture's height in pixels, over the tangent of half the view
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float pulse = aKind > 1.5 ? 0.7 + 0.3 * sin(uTime * 0.7 + aPhase) : aKind > 0.5 ? smoothstep(0.55, 0.75, sin(uTime * 3.2 + aPhase)) : 1.0;
  vAlpha = pulse;
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
  float px = aSize * uScale / max(1.0, -mv.z);
  gl_PointSize = clamp(px, 2.0, 160.0);
  if (mv.z > -0.5) gl_PointSize = 0.0;
}
`;
const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float a = (1.0 - r) * (1.0 - r);
  gl_FragColor = vec4(vColor * a * vAlpha, a * vAlpha);
}
`;

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
// an icosahedron with its surface pushed in and out by the seed: a rock, a comet's head
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
    // (a frigate's hull: 4 long, where a Star Destroyer's 16)
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
  const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.2, flatShading: true });
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
  const cloud = new THREE.BufferGeometry();
  cloud.setAttribute('position', new THREE.BufferAttribute(position, 3));
  cloud.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
  cloud.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  cloud.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
  cloud.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  cloud.computeBoundingSphere();
  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 }, uScale: { value: 600 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(cloud, cloudMat);
  points.name = 'places-glow';
  points.frustumCulled = false; // (one cloud across the whole system: its sphere is most of it anyway)
  // (points are sized in pixels, by the picture's height and the view: read off the renderer each draw)
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
