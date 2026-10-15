// Roll out's land: ground that rolls away from the road into swells, rock
// ridges and flat-topped buttes in Jasper, or rises in plated iron terraces
// round Kaon. The height is one function written twice, in JavaScript to
// stand things on the ground and in GLSL to shape the ground itself, over
// the same integer hash, so the two agree. The mesh steps forward with you
// on a fixed lattice (rows every 2 m near you, coarser far off; columns
// closer by the road), so the land never swims as you drive.
//
// The surface blends scanned CC0 sets by slope: soil and gravel where it's
// flat, cliff rock projected from three sides where it's steep, each sampled
// at two scales and tinted by slow noise so no tiling shows. Where a bridge
// is out, the land is cut through and a rock face (shaped by the same
// height function) fills the cut.

import * as THREE from 'three';

// ── noise, twice ──

const OFF = 32768;

export function hash(ix, iy) {
  const x = (ix + OFF) >>> 0;
  const y = (iy + OFF) >>> 0;
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967296;
}

// gradient noise, 0..1: each lattice point gets a direction from the hash
const grad = (ix, iy, x, y) => {
  const a = hash(ix, iy) * 6.283185307179586;
  return Math.cos(a) * x + Math.sin(a) * y;
};
export function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = grad(ix, iy, fx, fy);
  const b = grad(ix + 1, iy, fx - 1, fy);
  const c = grad(ix, iy + 1, fx, fy - 1);
  const d = grad(ix + 1, iy + 1, fx - 1, fy - 1);
  return 0.5 + 0.72 * (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy);
}

export function fbm(x, y, octaves) {
  let s = 0;
  let a = 0.5;
  let n = 0;
  for (let i = 0; i < octaves; i++) {
    s += a * noise(x, y);
    n += a;
    const nx = 1.6 * x + 1.2 * y;
    y = -1.2 * x + 1.6 * y;
    x = nx;
    a *= 0.5;
  }
  return s / n;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const GLSL_NOISE = /* glsl */ `
float tHash(ivec2 c) {
  uvec2 u = uvec2(c + ${OFF});
  uint h = (u.x * 0x27d4eb2du) ^ (u.y * 0x165667b1u);
  h = (h ^ (h >> 15u)) * 0x2c1b3c6du;
  h = (h ^ (h >> 12u)) * 0x297a2d39u;
  h ^= h >> 15u;
  return float(h) / 4294967296.0;
}
float tGrad(ivec2 c, vec2 f) {
  float a = tHash(c) * 6.283185307179586;
  return cos(a) * f.x + sin(a) * f.y;
}
float tNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec2 c = ivec2(i);
  float a = tGrad(c, f), b = tGrad(c + ivec2(1, 0), f - vec2(1.0, 0.0)), d = tGrad(c + ivec2(0, 1), f - vec2(0.0, 1.0)), e = tGrad(c + ivec2(1, 1), f - vec2(1.0, 1.0));
  return 0.5 + 0.72 * (a + (b - a) * u.x + (d - a) * u.y + (a - b - d + e) * u.x * u.y);
}
float tFbm(vec2 p, int octaves) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    s += a * tNoise(p);
    n += a;
    p = vec2(1.6 * p.x + 1.2 * p.y, -1.2 * p.x + 1.6 * p.y);
    a *= 0.5;
  }
  return s / n;
}`;

// ── the land, per stage: height at world (x, z) ──
// The road runs down x = 0 at height 0; the ground drops a little under it
// (|x| < 6.4) so the two never fight, and lies just below it on the shoulder.

const ROADBED = (ax) => -0.02 - 0.33 * (1 - smooth(6.3, 6.5, ax));

export const LAND = {
  // Jasper: broad swells, rock ridges breaking through, and buttes standing
  // off in the distance, two tiers each, with ragged rims
  desert: {
    height(x, z) {
      const ax = Math.abs(x);
      const edge = smooth(9, 38, ax);
      const swell = (fbm(x / 150, z / 150, 4) - 0.5) * 22;
      const ridge = Math.max(0, 1 - Math.abs(noise(x / 46 + 31, z / 46) * 2 - 1)) ** 4 * 8 * smooth(0.4, 0.75, noise(x / 230 - 9, z / 230));
      const wx = (fbm(x / 260 + 3, z / 260, 2) - 0.5) * 150;
      const wz = (fbm(x / 260, z / 260 + 7, 2) - 0.5) * 150;
      const m = fbm((x + wx) / 300 + 17, (z + wz) / 300, 3) + (noise(x / 22, z / 22) - 0.5) * 0.035;
      const butte = (smooth(0.6, 0.617, m) * 0.42 + smooth(0.637, 0.65, m) * 0.58) * (50 + 50 * noise(x / 130 + 3, z / 130)) * smooth(85, 170, ax);
      return ROADBED(ax) + edge * (swell + ridge) + butte;
    },
    glsl: /* glsl */ `
float landH(vec2 p) {
  float ax = abs(p.x);
  float edge = smoothstep(9.0, 38.0, ax);
  float swell = (tFbm(p / 150.0, 4) - 0.5) * 22.0;
  float ridge = pow(max(0.0, 1.0 - abs(tNoise(vec2(p.x / 46.0 + 31.0, p.y / 46.0)) * 2.0 - 1.0)), 4.0) * 8.0 * smoothstep(0.4, 0.75, tNoise(vec2(p.x / 230.0 - 9.0, p.y / 230.0)));
  vec2 wp = p + (vec2(tFbm(vec2(p.x / 260.0 + 3.0, p.y / 260.0), 2), tFbm(vec2(p.x / 260.0, p.y / 260.0 + 7.0), 2)) - 0.5) * 150.0;
  float m = tFbm(vec2(wp.x / 300.0 + 17.0, wp.y / 300.0), 3) + (tNoise(p / 22.0) - 0.5) * 0.035;
  float butte = (smoothstep(0.6, 0.617, m) * 0.42 + smoothstep(0.637, 0.65, m) * 0.58) * (50.0 + 50.0 * tNoise(vec2(p.x / 130.0 + 3.0, p.y / 130.0))) * smoothstep(85.0, 170.0, ax);
  return -0.02 - 0.33 * (1.0 - smoothstep(6.3, 6.5, ax)) + edge * (swell + ridge) + butte;
}`,
  },
  // Kaon: iron plating that steps up in terraces away from the road
  kaon: {
    height(x, z) {
      const ax = Math.abs(x);
      const edge = smooth(12, 22, ax);
      const q = (fbm(x / 150 + 5, z / 150, 3) - 0.38) * 16;
      const step = Math.floor(q) + smooth(0.84, 1, q - Math.floor(q));
      return ROADBED(ax) + edge * Math.max(0, step) * 6;
    },
    glsl: /* glsl */ `
float landH(vec2 p) {
  float ax = abs(p.x);
  float edge = smoothstep(12.0, 22.0, ax);
  float q = (tFbm(vec2(p.x / 150.0 + 5.0, p.y / 150.0), 3) - 0.38) * 16.0;
  float s = floor(q) + smoothstep(0.84, 1.0, q - floor(q));
  return -0.02 - 0.33 * (1.0 - smoothstep(6.3, 6.5, ax)) + edge * max(0.0, s) * 6.0;
}`,
  },
};

// How far a canyon reaches either side of a broken bridge (road z), at a
// distance x from the road: the cut widens and wanders away from the road.
export const CUT_PAD = 3.4;
export function cutWiden(x) {
  const ax = Math.abs(x);
  return smooth(8, 70, ax) * (5 + noise(x / 9 + 40, 3.5) * 4) + Math.max(0, ax - 70) * 0.05;
}
const GLSL_CUT = /* glsl */ `
float cutWiden(float x) {
  float ax = abs(x);
  return smoothstep(8.0, 70.0, ax) * (5.0 + tNoise(vec2(x / 9.0 + 40.0, 3.5)) * 4.0) + max(0.0, ax - 70.0) * 0.05;
}`;

// ── the mesh ──

// columns: close by the road, spreading out with distance
export function landColumns(reach = 820) {
  const xs = [0, 2, 4, 5.4, 6.3, 6.5, 7.2, 8];
  let x = 8;
  while (x < reach) {
    x += 1.4 + x * 0.034;
    xs.push(Math.min(x, reach));
  }
  return [...xs.slice(1).reverse().map((v) => -v), ...xs];
}
// rows (ahead of the mesh's origin): 2 m, then 4 m, then 8 m apart. The mesh
// steps 8 m at a time, so every row stays on the same world lattice.
const LAND_STEP = 8;
function landRows(big) {
  const zs = [];
  const near = big ? 2 : 4;
  for (let d = 0; d < 300; d += near) zs.push(d);
  for (let d = 300; d < 500; d += 4) zs.push(d);
  for (let d = 500; d <= 760; d += 8) zs.push(d);
  return zs;
}
const LAND_BEHIND = 64; // the mesh starts this far behind you

function landGeometry(big) {
  const xs = landColumns();
  const zs = landRows(big);
  const pos = new Float32Array(xs.length * zs.length * 3);
  let k = 0;
  for (const d of zs)
    for (const x of xs) {
      pos[k++] = x;
      pos[k++] = 0;
      pos[k++] = -d;
    }
  const idx = [];
  const W = xs.length;
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < W - 1; i++) {
      const a = j * W + i;
      const b = a + 1;
      const c = a + W;
      const d = c + 1;
      idx.push(a, b, c, b, d, c); // counter-clockwise from above
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length).fill(0), 3));
  geo.setIndex(idx);
  return geo;
}

// ── the surface ──
// sets: { flat, flat2, rock } scanned sets ({ color, normal, arm }); tiles in
// metres; tints multiply each.
function landMaterial(land, sets, o, big) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: o.metal ? 1 : 0, envMapIntensity: o.env ?? 0.7 });
  // small screens skip the second, wider sample of each texture
  if (!big) mat.defines = { LAND_LITE: '' };
  mat.userData.gaps = new Array(3).fill(null).map(() => new THREE.Vector2(1e9, 1e9));
  const tex = (set, key) => set?.[key] ?? null;
  const uniforms = {
    uGaps: { value: mat.userData.gaps },
    tFc: { value: tex(sets.flat, 'color') },
    tFn: { value: tex(sets.flat, 'normal') },
    tFa: { value: tex(sets.flat, 'arm') },
    tGc: { value: tex(sets.flat2, 'color') ?? tex(sets.flat, 'color') },
    tRc: { value: tex(sets.rock, 'color') ?? tex(sets.flat, 'color') },
    tRn: { value: tex(sets.rock, 'normal') ?? tex(sets.flat, 'normal') },
    tRa: { value: tex(sets.rock, 'arm') ?? tex(sets.flat, 'arm') },
    uTile: { value: new THREE.Vector3(o.tile[0], o.tile[1], o.tile[2]) },
    uTintF: { value: new THREE.Color(o.tint[0]) },
    uTintG: { value: new THREE.Color(o.tint[1]) },
    uTintR: { value: new THREE.Color(o.tint[2]) },
    uRock: { value: new THREE.Vector2(o.rock[0], o.rock[1]) },
    uSheen: { value: o.sheen ?? 1 },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vTW;\nvarying vec3 vTN;\n${GLSL_NOISE}\n${land.glsl}`)
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 tWp = (modelMatrix * vec4(position, 1.0)).xyz;
        float tH = landH(tWp.xz);
        float hx = landH(tWp.xz + vec2(0.8, 0.0));
        float hz = landH(tWp.xz + vec2(0.0, 0.8));
        vec3 objectNormal = normalize(vec3(tH - hx, 0.8, tH - hz));
        vTW = vec3(tWp.x, tH, tWp.z);
        vTN = objectNormal;`,
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, tH, position.z);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTW;
        varying vec3 vTN;
        uniform vec2 uGaps[3];
        uniform sampler2D tFc, tFn, tFa, tGc, tRc, tRn, tRa;
        uniform vec3 uTile, uTintF, uTintG, uTintR;
        uniform vec2 uRock;
        uniform float uSheen;
        ${GLSL_NOISE}
        ${GLSL_CUT}
        // a scanned normal, turned into the world along tangent t, bitangent b
        vec3 tPerturb(vec3 n, vec3 t, vec3 b, vec3 g, float k) { return normalize(t * n.x * k + b * n.y * k + g * n.z); }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        {
          float w = ${CUT_PAD.toFixed(2)} + cutWiden(vTW.x);
          for (int i = 0; i < 3; i++) if (-vTW.z > uGaps[i].x - w && -vTW.z < uGaps[i].y + w) discard;
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `vec3 tAlb; vec3 tArm; vec3 tNw;
        {
          vec3 g = normalize(vTN);
          float dist = length(vTW - cameraPosition);
          #ifdef LAND_LITE
            float far = 0.0;
          #else
            float far = smoothstep(20.0, 160.0, dist) * 0.65;
          #endif
          float macro = tFbm(vTW.xz / 80.0, 3);
          float fine = tNoise(vTW.xz / 9.0);
          // flat: two scanned grounds in patches, each at two scales
          vec2 uf = vec2(vTW.x, -vTW.z) / uTile.x;
          vec2 uf2 = uf * 0.29 + vec2(0.37, 0.11);
          vec3 fc = mix(texture2D(tFc, uf).rgb, texture2D(tFc, uf2).rgb, far);
          vec3 gc = mix(texture2D(tGc, uf / uTile.y * uTile.x).rgb, texture2D(tGc, uf2 * 0.83).rgb, far);
          vec3 fa = mix(texture2D(tFa, uf).rgb, texture2D(tFa, uf2).rgb, far);
          vec3 fnS = mix(texture2D(tFn, uf).xyz, texture2D(tFn, uf2).xyz, far) * 2.0 - 1.0;
          float patchK = smoothstep(0.38, 0.62, macro + (fine - 0.5) * 0.25);
          vec3 flatC = mix(fc * uTintF, gc * uTintG, patchK);
          vec3 flatN = tPerturb(fnS, vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, -1.0), g, 1.0);
          // steep: rock, projected from three sides
          vec3 w = pow(abs(g), vec3(4.0));
          w /= w.x + w.y + w.z;
          float sx = g.x < 0.0 ? -1.0 : 1.0;
          float sz = g.z < 0.0 ? -1.0 : 1.0;
          vec2 ux = vec2(-vTW.z * sx, vTW.y) / uTile.z;
          vec2 uy = vec2(vTW.x, -vTW.z) / uTile.z;
          vec2 uz = vec2(vTW.x * sz, vTW.y) / uTile.z;
          vec3 rc = texture2D(tRc, ux).rgb * w.x + texture2D(tRc, uy).rgb * w.y + texture2D(tRc, uz).rgb * w.z;
          vec3 ra = texture2D(tRa, ux).rgb * w.x + texture2D(tRa, uy).rgb * w.y + texture2D(tRa, uz).rgb * w.z;
          vec3 rn = tPerturb(texture2D(tRn, ux).xyz * 2.0 - 1.0, vec3(0.0, 0.0, -sx), vec3(0.0, 1.0, 0.0), g, 1.3) * w.x
                  + tPerturb(texture2D(tRn, uy).xyz * 2.0 - 1.0, vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, -1.0), g, 1.3) * w.y
                  + tPerturb(texture2D(tRn, uz).xyz * 2.0 - 1.0, vec3(sz, 0.0, 0.0), vec3(0.0, 1.0, 0.0), g, 1.3) * w.z;
          // strata: the rock's colour drifts with height
          rc *= uTintR * mix(vec3(1.0), vec3(1.1, 0.93, 0.82), tNoise(vec2(vTW.y / 7.0, 0.5)) * 0.8);
          float slope = 1.0 - g.y;
          float rk = smoothstep(uRock.x, uRock.y, slope + (fine - 0.5) * 0.12);
          tAlb = mix(flatC, rc, rk) * mix(0.84, 1.1, macro);
          tArm = mix(fa, ra, rk);
          tNw = normalize(mix(flatN, normalize(rn), rk));
        }
        diffuseColor.rgb *= tAlb;`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * tArm.g;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * tArm.b;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize(mat3(viewMatrix) * tNw);')
      .replace(
        '#include <aomap_fragment>',
        `{
          // soil is dull: keep the grazing sheen of rough ground from washing it out
          float ao = mix(1.0, tArm.r, 0.9);
          reflectedLight.indirectDiffuse *= ao;
          reflectedLight.indirectSpecular *= ao * uSheen;
          reflectedLight.directSpecular *= mix(uSheen, 1.0, 0.4);
        }`,
      );
  };
  mat.customProgramCacheKey = () => `land-${o.key}-${big ? 'full' : 'lite'}`;
  return mat;
}

// The land for one stage. height(x, roadZ) stands things on it.
export function createLand(kind, { big, sets, look }) {
  const land = LAND[kind];
  const mesh = new THREE.Mesh(landGeometry(big), landMaterial(land, sets, look, big));
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  const height = (x, z) => land.height(x, -z);
  return {
    mesh,
    material: mesh.material,
    height,
    // step forward with you, on the lattice
    follow(z) {
      const zg = Math.floor((z - LAND_BEHIND) / LAND_STEP) * LAND_STEP;
      mesh.position.set(0, 0, -zg);
    },
  };
}

// The rock face where a canyon cuts through the land: its top follows the
// land's height along the cut, it leans in as it goes down, and it's ragged.
export function cutFace(height, { big }) {
  const xs = landColumns(820).filter((_, i) => big || i % 2 === 0);
  const rows = 14;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(xs.length * (rows + 1) * 3);
  const uv = new Float32Array(xs.length * (rows + 1) * 2);
  const col = new Float32Array(xs.length * (rows + 1) * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // darker the deeper it goes: little light gets down there
  for (let j = 0; j <= rows; j++) for (let i = 0; i < xs.length; i++) col.fill(1 - (j / rows) ** 0.8 * 0.7, (j * xs.length + i) * 3, (j * xs.length + i) * 3 + 3);
  const idx = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const a = j * xs.length + i;
      idx.push(a, a + 1, a + xs.length, a + 1, a + xs.length + 1, a + xs.length);
    }
  geo.setIndex(idx);
  // edge: the road z of the lip; dir: +1 if the canyon lies ahead of it
  const shape = (edge, dir, floor) => {
    let k = 0;
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i];
        const lip = edge - dir * (CUT_PAD + cutWiden(x));
        const top = height(x, lip) + 0.25;
        const t = j / rows;
        const y = top + (floor - top) * t;
        const lean = t * (2.5 + noise(x / 6, j * 0.7 + edge) * 3) + (noise(x / 3.1, j * 1.3) - 0.5) * 1.6 * t;
        const zr = lip + dir * lean;
        pos[k * 3] = x;
        pos[k * 3 + 1] = y;
        pos[k * 3 + 2] = -zr;
        uv[k * 2] = x / 14;
        uv[k * 2 + 1] = y / 14;
        k++;
      }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  };
  return { geo, shape };
}
