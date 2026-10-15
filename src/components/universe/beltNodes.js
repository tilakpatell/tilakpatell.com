// belt.js on the node renderer: the asteroid belt and the dust, the same
// draws from the same seeded dice. The belt’s rocks are rockNodes.js’s
// (lib/three/rock’s twin), so their pits are nodes; beltRocks and the
// belt’s instancing are belt.js’s, copied (belt.js holds the dust’s GLSL
// beside them, and importing them would bring it into a 'nodes' world).
//
// What differs on the node renderer: the dust was a cloud of points sized
// by gl_PointSize, and the node renderer draws a point one pixel wide, so a
// speck is a sprite instanced once a point (three’s PointsNodeMaterial on a
// Sprite with a count, its place an instance attribute), its sizeNode the
// GLSL’s gl_PointSize and its fragment the GLSL’s, line for line. `points`
// is that Sprite. The uniforms keep their names, as uniform nodes on
// `points.material.uniforms`, so update writes `.value` as before. A
// speck whose middle is off the picture was dropped whole on WebGL; a
// sprite’s quad is clipped instead, so one at the edge shows its half.
//
// createBelt({ small, band, seed, tones, scale, spin, count, tier }) → { group, rocks, hide(i), show(i), update(t) }
// beltRocks({ small, band, seed, scale, count }) → where each of its rocks is (pure)
// rock(seed, { craters }) → a lumpy rock’s geometry, about a unit across
// createDust({ small }) → { points, update(cameraInParent, amount, dpr) }

import * as THREE from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import { clamp, floor, instancedBufferAttribute, length, positionView, screenDPR, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import { BELT } from './layout';
import { rng, rock, rockMaterial } from '../../lib/three/rockNodes';

export { rock };

// one rock in this many is a boulder: twice the size, cratered
const BOULDER = 40;

const TONES = ['#8b857c', '#6f6a63', '#9a8f80', '#7a6a58', '#5b5550', '#a08466'];

// Where each rock of a ring is, as plain numbers, so the belt's mesh and the
// ship's collider (rockHits.js) read the same rocks. `band`: where it goes
// ({ inner, outer, height }: the home belt, layout.js's BELT, unless another
// ring is wanted: the rim at the edge of the map, RIM); `scale`: how many
// times bigger than the belt's rocks (the rim's are seen from thousands of
// units off). The draws from the seeded random are in the order they always
// were, so the belt looks as it did.
// → [{ x, y, z, sx, sy, sz, rx, ry, rz, shape, tone, tint, r }]: r, how near
// the ship's way must come to it (a little inside its biggest side: the
// rocks are lumpy)
export function beltRocks({ small = false, band = BELT, seed = 1977, scale = 1, count = 3200, tones = TONES.length } = {}) {
  const rand = rng(seed);
  const N = small ? Math.round(count * 0.375) : count;
  const counts = [Math.ceil(N * 0.4), Math.ceil(N * 0.35), Math.floor(N * 0.25)];
  const rocks = [];
  counts.forEach((n, shape) => {
    for (let i = 0; i < n; i++) {
      // across the band: most in the middle, a few toward its edges
      const across = (rand() + rand() + rand()) / 3 - 0.5;
      const r = (band.inner + band.outer) / 2 + across * (band.outer - band.inner);
      const a = rand() * Math.PI * 2;
      const y = (rand() - 0.5) * band.height * (1 - Math.abs(across) * 1.4);
      // mostly small, now and then a big one
      const size = (0.15 + rand() ** 4 * 1.9) * scale;
      const sx = size;
      const sy = size * (0.7 + rand() * 0.6);
      const sz = size * (0.8 + rand() * 0.4);
      const rx = rand() * 6.3;
      const ry = rand() * 6.3;
      const rz = rand() * 6.3;
      const tone = Math.floor(rand() * tones);
      const tint = 0.75 + rand() * 0.45;
      rocks.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, sx, sy, sz, rx, ry, rz, shape, tone, tint, r: Math.max(sx, sy, sz) * 0.9 });
    }
  });
  // one in each forty a boulder, picked by a draw of its own (so every other
  // rock is where it always was)
  const pick = rng(seed ^ 0xb01d);
  for (let b = 0; b + BOULDER <= rocks.length; b += BOULDER) {
    const o = rocks[b + Math.floor(pick() * BOULDER)];
    o.shape = 3;
    o.sx *= 2;
    o.sy *= 2;
    o.sz *= 2;
    o.r = Math.max(o.sx, o.sy, o.sz) * 0.9;
  }
  return rocks;
}

// `tones`: its rocks' colours; `spin`: radians a second round the sun.
// hide(i) and show(i) take one of `rocks` out of the ring and put it back
// (one the ship has smashed)
export function createBelt({ small = false, band = BELT, seed = 1977, tones = TONES, scale = 1, spin = 0.006, count = 3200, tier = 'high' } = {}) {
  const rocks = beltRocks({ small, band, seed, scale, count, tones: tones.length });
  const group = new THREE.Group();
  // (the home belt's own shapes as they always were, and its boulder; another seed, other shapes)
  const shapes = [...[11, 23, 37].map((k) => rock(k + seed - 1977)), rock(53 + seed - 1977, { craters: true })];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const at = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const c = new THREE.Color();
  // (a material a shape: rockNodes’ noise functions, built once in one
  // material’s first shader, go undeclared in a second mesh’s; the GLSL
  // shared one material over the four)
  const meshes = shapes.map((geo, s) => new THREE.InstancedMesh(geo, rockMaterial({ tier }), rocks.filter((o) => o.shape === s).length));
  const slot = []; // each rock's [mesh, instance]
  const filled = [0, 0, 0, 0];
  const place = (i, gone = false) => {
    const o = rocks[i];
    const [mesh, k] = slot[i];
    at.set(o.x, o.y, o.z);
    q.setFromEuler(e.set(o.rx, o.ry, o.rz));
    sc.set(o.sx, o.sy, o.sz);
    if (gone) sc.setScalar(0);
    mesh.setMatrixAt(k, m.compose(at, q, sc));
    mesh.instanceMatrix.needsUpdate = true;
  };
  rocks.forEach((o, i) => {
    const mesh = meshes[o.shape];
    const k = filled[o.shape]++;
    slot[i] = [mesh, k];
    place(i);
    mesh.setColorAt(k, c.set(tones[o.tone]).multiplyScalar(o.tint));
  });
  for (const mesh of meshes) {
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return {
    group,
    rocks,
    hide: (i) => slot[i] && place(i, true),
    show: (i) => slot[i] && place(i),
    update(t) {
      group.rotation.y = t * spin; // slowly round the sun
    },
  };
}

// GLSL’s mod (floored, for the negatives too)
const mod = (a, b) => a.sub(b.mul(floor(a.div(b))));
// (GLSL’s smoothstep with its edges reversed, as nodes: WGSL’s is undefined there)
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// DUST_VERT and DUST_FRAG, as nodes: `position` the speck’s place, an instance attribute
function dustMaterial(u, position, aSize) {
  const material = new PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: false, forceSinglePass: true });
  // each speck’s place in a box round the camera, wrapping as it moves
  const half = vec3(u.uBox.mul(0.5));
  const p = mod(position.sub(u.uCam).add(half), vec3(u.uBox)).sub(half);
  const vFade = smoothstep(u.uBox.mul(0.28), u.uBox.mul(0.5), length(p)).oneMinus().toVarying('vFade');
  material.positionNode = p.add(u.uCam);
  // gl_PointSize, in the drawing buffer’s pixels (three’s sprite multiplies by the DPR again)
  material.sizeNode = clamp(aSize.mul(u.uDpr).mul(positionView.z.negate().reciprocal().mul(6)), 1, u.uDpr.mul(3)).div(screenDPR);
  const d = length(uv().sub(0.5));
  const a = fall(0.5, 0.15, d).mul(vFade).mul(u.uAmount);
  material.colorNode = vec3(0.75, 0.82, 1.0).mul(a).mul(0.6);
  material.uniforms = u;
  return material;
}

export function createDust({ small = false } = {}) {
  const rand = rng(42);
  const N = small ? 320 : 800;
  const BOX = 14;
  const pos = new Float32Array(N * 3);
  const size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos.set([(rand() - 0.5) * BOX, (rand() - 0.5) * BOX * 0.6, (rand() - 0.5) * BOX], i * 3);
    size[i] = 0.6 + rand() * 1.4;
  }
  const u = { uCam: uniform(new THREE.Vector3()), uBox: uniform(BOX), uDpr: uniform(1), uAmount: uniform(0) };
  const mat = dustMaterial(u, instancedBufferAttribute(new THREE.InstancedBufferAttribute(pos, 3)), instancedBufferAttribute(new THREE.InstancedBufferAttribute(size, 1)));
  const points = new THREE.Sprite(mat);
  points.count = N;
  points.frustumCulled = false;
  points.visible = false;
  return {
    points,
    // cam: the camera’s position in the dust’s parent; amount 0…1
    update(cam, amount, dpr = 1) {
      points.visible = amount > 0.01;
      mat.uniforms.uAmount.value = amount;
      mat.uniforms.uCam.value.copy(cam);
      mat.uniforms.uDpr.value = dpr;
    },
  };
}
