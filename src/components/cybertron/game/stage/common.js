// What Cybertron's places share when they're drawn: a sky to stand under,
// fires that burn and smoke, strips of light (energon in the gutters, a
// tower's lit edges), and the plated metal everything's built of, worked
// out in the shader from where it is in the world, so a tower a hundred
// metres tall is panelled as finely at its foot as at its top, whatever
// its size, in one draw for the whole city.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ── the sky ──

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }`;

// Iacon's: night, the galaxy's band and a nebula behind it, the two moons,
// the stars, and the city's fires lighting the haze orange low down
const IACON_SKY = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFire;
  varying vec3 vDir;
  float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  vec3 moon(vec3 d, vec3 at, float r, vec3 col) {
    float c = dot(d, normalize(at));
    float disc = smoothstep(cos(r), cos(r * 0.96), c);
    vec3 n = normalize(d - normalize(at) * c);
    float lit = 0.25 + 0.75 * smoothstep(-0.3, 0.6, dot(n, normalize(vec3(-1.0, 0.4, 0.2))));
    float craters = 0.75 + 0.25 * fbm(d * 60.0);
    float halo = pow(max(c, 0.0), 900.0 / r) * 0.25;
    return col * disc * lit * craters + col * halo;
  }
  void main() {
    vec3 d = normalize(vDir);
    float up = d.y;
    vec3 col = mix(vec3(0.03, 0.035, 0.07), vec3(0.006, 0.008, 0.02), smoothstep(0.0, 0.7, up));
    // the galaxy's band and the nebula round it
    float band = exp(-pow(dot(d, normalize(vec3(0.35, 0.55, -0.75))) * 3.0, 2.0));
    float neb = fbm(d * 3.0 + vec3(0.0, 0.0, uTime * 0.002));
    col += vec3(0.09, 0.05, 0.16) * band * smoothstep(0.35, 0.8, neb) * 1.4;
    col += vec3(0.02, 0.08, 0.12) * smoothstep(0.55, 0.85, fbm(d * 5.0 + 3.0)) * (0.3 + band);
    // stars
    vec3 sp = d * 380.0;
    float st = step(0.9965, h3(floor(sp))) * smoothstep(0.0, 0.25, up);
    col += vec3(0.8, 0.88, 1.0) * st * (0.5 + 0.5 * sin(uTime * 2.0 + h3(floor(sp) + 1.0) * 40.0));
    // the moons
    col += moon(d, vec3(-0.5, 0.42, -0.75), 0.075, vec3(0.75, 0.78, 0.86));
    col += moon(d, vec3(0.62, 0.3, -0.72), 0.035, vec3(0.86, 0.7, 0.62));
    // the war: the haze lit orange low down, smoke lanes through it
    float low = smoothstep(0.35, -0.02, up);
    float smoke = fbm(vec3(d.x * 4.0, d.y * 9.0 - uTime * 0.03, d.z * 4.0));
    col += uFire * low * low * (0.35 + 0.65 * smoke) * 0.55;
    col *= 1.0 - 0.45 * smoothstep(0.45, 0.75, smoke) * smoothstep(0.5, 0.0, up);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

// The desert's: a hot noon sky over Nevada, paler toward the horizon, with
// the sun and a dust haze low down
const DESERT_SKY = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float up = max(d.y, 0.0);
    vec3 col = mix(vec3(0.78, 0.74, 0.68), vec3(0.24, 0.45, 0.78), pow(up, 0.5));
    col = mix(col, vec3(0.9, 0.72, 0.52), smoothstep(0.12, -0.05, d.y) * 0.7);
    float s = max(dot(d, normalize(uSun)), 0.0);
    col += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 30.0 + pow(s, 12.0) * 0.35);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export function makeSky(kind, { sun = [0.5, 0.8, 0.3], fire = '#ff6a1c' } = {}) {
  if (kind === 'base') return null;
  const uniforms = { uTime: { value: 0 }, uFire: { value: new THREE.Color(fire) }, uSun: { value: new THREE.Vector3(...sun) } };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(4000, 48, 24),
    new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERT, fragmentShader: kind === 'desert' ? DESERT_SKY : IACON_SKY, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.uniforms = uniforms;
  mesh.userData.sky = true; // (scene.js lights the metal with it)
  return mesh;
}

// ── fire and smoke ──

// Billboards turned to the camera in the vertex shader: a column of fire at
// each point, licking upward, and smoke rising from it into the sky
const FIRE_VERT = /* glsl */ `
  attribute vec4 aAt; // x, y, z, size
  attribute float aSeed;
  attribute float aSmoke;
  varying vec2 vUv;
  varying float vSeed;
  varying float vSmoke;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vSmoke = aSmoke;
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(0.0, 1.0, 0.0);
    float tall = aSmoke > 0.5 ? 4.0 : 1.6;
    vec3 p = aAt.xyz + right * (uv.x - 0.5) * aAt.w + up * uv.y * aAt.w * tall;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const FIRE_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vSeed;
  varying float vSmoke;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { s += a * n(p); p *= 2.1; a *= 0.5; } return s; }
  void main() {
    vec2 q = vUv;
    float t = uTime * (vSmoke > 0.5 ? 0.12 : 1.4) + vSeed * 10.0;
    float body = fbm(vec2(q.x * 3.0, q.y * (vSmoke > 0.5 ? 2.0 : 4.0) - t));
    float edge = 1.0 - abs(q.x - 0.5) * 2.0;
    if (vSmoke > 0.5) {
      float a = smoothstep(0.0, 0.5, edge * (0.6 + q.y * 0.6)) * smoothstep(1.0, 0.3, q.y) * smoothstep(0.0, 0.12, q.y) * smoothstep(0.35, 0.75, body);
      gl_FragColor = vec4(vec3(0.05, 0.045, 0.05) + vec3(0.25, 0.1, 0.03) * (1.0 - q.y), a * 0.6);
      return;
    }
    float shape = edge * (1.0 - q.y) * 1.6 - (1.0 - body) * 0.9;
    float a = smoothstep(0.0, 0.25, shape);
    vec3 col = mix(vec3(1.4, 0.3, 0.04), vec3(4.0, 2.2, 0.6), smoothstep(0.25, 0.8, shape));
    gl_FragColor = vec4(col * a, a);
  }`;

export function makeFires(points, { smoke = true } = {}) {
  const list = [];
  for (const [i, [x, y, z, size]] of points.entries()) {
    list.push([x, y, z, size, hash(i + 1), 0]);
    if (smoke) list.push([x, y + size * 0.6, z, size * 3, hash(i + 7), 1]);
  }
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0.5, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index;
  g.setAttribute('position', quad.attributes.position);
  g.setAttribute('uv', quad.attributes.uv);
  g.setAttribute('aAt', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap((f) => f.slice(0, 4))), 4));
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(list.map((f) => f[4])), 1));
  g.setAttribute('aSmoke', new THREE.InstancedBufferAttribute(new Float32Array(list.map((f) => f[5])), 1));
  g.instanceCount = list.length;
  const uniforms = { uTime: { value: 0 } };
  // the smoke drawn first (behind the flames), blended; the flames added
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: FIRE_VERT, fragmentShader: FIRE_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending, premultipliedAlpha: false });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return {
    mesh,
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      g.dispose();
      quad.dispose();
      mat.dispose();
    },
  };
}

// ── strips of light ──

// Thin glowing boxes along segments [[x0, z0, x1, z1, y, width, height], …],
// merged into one mesh, bright enough to bloom
export function makeStrips(segments, color, intensity = 3) {
  const parts = segments.map(([x0, z0, x1, z1, y = 0.05, w = 0.6, h = 0.12]) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.BoxGeometry(w, h, len);
    g.rotateY(Math.atan2(x1 - x0, z1 - z0));
    g.translate((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
    return g;
  });
  if (!parts.length) return null;
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false }));
  parts.forEach((g) => g.dispose());
  return mesh;
}

// ── plated metal, worked out in the world ──

// A MeshStandardMaterial whose plating, seams, wear and lit windows are
// drawn from the world position: `windows` (0…1, how many are lit on walls),
// colours for the metal and the light. Per-object variation from the
// vertex colour's red channel (a seed baked into the geometry).
// `lights`: 'windows' (a human town's, in a grid) or 'slits' (Cybertron's:
// long thin bands along the floors, broken here and there, and a seam lit
// top to bottom now and then).
export function platedMaterial({ base = '#2a2f38', alt = '#3b4352', trim = '#7a8494', windows = 0.4, warm = '#ffb060', cool = '#7fd8ff', glow = 2.4, panel = [5, 4], roughness = 0.5, metalness = 0.7, lights = 'windows' } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness, vertexColors: true });
  if (lights === 'slits') mat.defines = { CY_SLITS: '' };
  const u = {
    uBase: { value: new THREE.Color(base) },
    uAlt: { value: new THREE.Color(alt) },
    uTrim: { value: new THREE.Color(trim) },
    uWarm: { value: new THREE.Color(warm) },
    uCool: { value: new THREE.Color(cool) },
    uWindows: { value: windows },
    uGlow: { value: glow },
    uPanel: { value: new THREE.Vector2(...panel) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPW;\nvarying vec3 vNW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNW = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vPW;
        varying vec3 vNW;
        uniform vec3 uBase, uAlt, uTrim, uWarm, uCool;
        uniform float uWindows, uGlow;
        uniform vec2 uPanel;
        float pH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        vec2 faceUv() {
          vec3 n = abs(vNW);
          if (n.y > 0.6) return vPW.xz;
          return n.x > n.z ? vec2(vPW.z, vPW.y) : vec2(vPW.x, vPW.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 fuv = faceUv();
        vec2 cell = floor(fuv / uPanel);
        vec2 f = fract(fuv / uPanel);
        float id = pH(cell + vColor.r * 97.0);
        float seam = smoothstep(0.0, 0.03, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
        vec3 metal = mix(uBase, uAlt, step(0.7, id) * 0.8 + id * 0.2);
        metal = mix(metal, uTrim, step(0.93, id));
        // grime gathering low down, streaks running down the walls
        float streak = pH(vec2(floor(fuv.x * 0.7), vColor.r)) * smoothstep(1.0, 0.0, fract(fuv.y * 0.02 + pH(vec2(floor(fuv.x * 0.7), 3.0))));
        metal *= (0.75 + 0.25 * seam) * (1.0 - 0.25 * streak * (1.0 - abs(vNW.y)));
        diffuseColor.rgb = metal;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float wall = 1.0 - smoothstep(0.4, 0.6, abs(vNW.y));
          #ifdef CY_SLITS
          // Cybertron's lights: a thin band along a floor, running a few
          // panels and breaking off, most energon blue, now and then amber
          vec2 w = vec2(fuv.x / (uPanel.x * 3.0), fuv.y / 3.6);
          vec2 wc = floor(w);
          vec2 wf = fract(w);
          float run = step(1.0 - uWindows, pH(wc + vColor.r * 13.0));
          float band = smoothstep(0.44, 0.47, wf.y) * (1.0 - smoothstep(0.53, 0.56, wf.y));
          float ends = smoothstep(0.04, 0.1, wf.x) * (1.0 - smoothstep(0.9, 0.96, wf.x));
          // (and a seam lit floor to floor, here and there)
          float seamLit = step(0.93, pH(vec2(cell.x, vColor.r * 5.0 + 2.0))) * (1.0 - smoothstep(0.0, 0.02, min(f.x, 1.0 - f.x)));
          vec3 lamp = mix(uCool, uWarm, step(0.86, pH(wc + 7.0)));
          totalEmissiveRadiance += lamp * (run * band * ends + seamLit * 0.6) * wall * uGlow * step(5.0, vPW.y) * (0.55 + 0.45 * pH(wc + 1.0));
          #else
          // lit windows on the walls, in bands, some warm, most cool
          vec2 w = fuv / vec2(2.6, 4.5);
          vec2 wc = floor(w);
          vec2 wf = fract(w);
          float lit = step(1.0 - uWindows, pH(wc + vColor.r * 13.0)) * step(0.25, wf.x) * step(wf.x, 0.75) * step(0.3, wf.y) * step(wf.y, 0.62);
          vec3 lamp = mix(uCool, uWarm, step(0.8, pH(wc + 7.0)));
          totalEmissiveRadiance += lamp * lit * wall * uGlow * step(4.0, vPW.y) * (0.6 + 0.4 * pH(wc + 1.0));
          #endif
        }`,
      );
  };
  mat.customProgramCacheKey = () => `cy-plated-${lights}`;
  mat.userData.plating = u;
  return mat;
}

// A box from (x, z, half sizes, turn) between two heights, its vertices
// carrying a seed in their colour (for platedMaterial's variation)
export function slab(x, z, hw, hd, y0, y1, yaw = 0, seed = 0) {
  const g = new THREE.BoxGeometry(hw * 2, y1 - y0, hd * 2);
  g.rotateY(yaw);
  g.translate(x, (y0 + y1) / 2, z);
  const c = new Float32Array(g.attributes.position.count * 3).fill(seed);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// A cylinder (or a cone, or a prism with few sides) seeded the same way
export function drum(x, z, rb, rt, y0, y1, sides = 24, seed = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, y1 - y0, sides, 1);
  g.translate(x, (y0 + y1) / 2, z);
  const c = new Float32Array(g.attributes.position.count * 3).fill(seed);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// A prism standing on an octagon: a box's footprint (half sizes hw, hd,
// turned by yaw) with its corners cut off by `cut` metres, its top drawn in
// by `taper` (1: straight up). Flat-shaded, seeded as slab() is.
export function prism(x, z, hw, hd, y0, y1, { yaw = 0, cut = 0, taper = 1, seed = 0 } = {}) {
  const k = Math.min(cut, hw * 0.45, hd * 0.45);
  const ring = [[hw - k, hd], [hw, hd - k], [hw, -hd + k], [hw - k, -hd], [-hw + k, -hd], [-hw, -hd + k], [-hw, hd - k], [-hw + k, hd]];
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const at = (px, pz, y, s) => [x + (px * c + pz * sn) * s, y, z + (-px * sn + pz * c) * s];
  const pos = [];
  for (let i = 0; i < 8; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % 8];
    const a0 = at(ax, az, y0, 1);
    const b0 = at(bx, bz, y0, 1);
    const a1 = at(ax, az, y1, taper);
    const b1 = at(bx, bz, y1, taper);
    pos.push(...a0, ...b0, ...a1, ...b0, ...b1, ...a1);
  }
  // the top
  const mid = [x, y1, z];
  for (let i = 0; i < 8; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % 8];
    pos.push(...mid, ...at(ax, az, y1, taper), ...at(bx, bz, y1, taper));
  }
  return seeded(pos, seed);
}

// A buttress: a fin from the ground at (ox, oz) up to a wall at (wx, wz),
// meeting it at height h, w thick
// (standing on y0: a crown's fins stand on its roof)
export function wedge(ox, oz, wx, wz, h, w, seed = 0, y0 = 0) {
  const dx = wx - ox;
  const dz = wz - oz;
  const l = Math.hypot(dx, dz) || 1;
  const px = (-dz / l) * (w / 2);
  const pz = (dx / l) * (w / 2);
  const A = [ox, y0, oz];
  const B = [wx, y0, wz];
  const C = [wx, y0 + h, wz];
  const side = (s) => [A, B, C].map(([x, y, z]) => [x + px * s, y, z + pz * s]);
  const [a, b, c] = side(1);
  const [a2, b2, c2] = side(-1);
  // its two faces, and the sloping back
  const pos = [...a, ...b, ...c, ...a2, ...c2, ...b2, ...a, ...c, ...c2, ...a, ...c2, ...a2];
  return seeded(pos, seed);
}

// raw triangles as a geometry the city's merge takes: flat normals, uvs
// (unused: the plating is worked out in the world), and the seed
function seeded(pos, seed) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const n = pos.length / 3;
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(seed), 3));
  return g;
}

export function merged(parts) {
  const ok = parts.filter(Boolean).map((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    return flat;
  });
  const g = mergeGeometries(ok);
  ok.forEach((p) => p.dispose());
  return g;
}

// ── the cities' buildings ──

// A tower on its footprint, the way Fall of Cybertron builds them: its
// corners cut, buttresses up its lowest tier, ribs up the faces of the rest,
// a collar standing proud at each setback, a crown of fins, a spire or a
// mast. Lit at its corners, its collars and up some of its ribs. (The
// buttresses stand inside the footprint, the wall a little behind them:
// where you stop is where the stone is.)
export function tower(s, i, parts, strips) {
  const seed = hash(i * 7.3);
  const tiers = 2 + Math.floor(seed * 3);
  const yaw = s.yaw ?? 0;
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const corner = (x, z) => [s.x + x * c + z * sn, s.z - x * sn + z * c];
  const inset = 2.6;
  let hw = s.hw - inset;
  let hd = s.hd - inset;
  let y = 0;
  parts.push(prism(s.x, s.z, s.hw, s.hd, 0, 2.2, { yaw, cut: 4, seed }));
  for (let t = 0; t < tiers; t++) {
    const last = t === tiers - 1;
    const share = last ? 1 : 0.35 + hash(i + t * 3.1) * 0.25;
    const y1 = last ? s.top : y + (s.top - y) * share;
    const cut = Math.min(hw, hd) * (0.16 + hash(i + t * 5.7) * 0.14);
    parts.push(prism(s.x, s.z, hw, hd, y, y1, { yaw, cut, seed }));
    if (t === 0) {
      // buttresses up the long faces, from the footprint's edge to the wall
      const along = hw > hd;
      const span = (along ? hw : hd) - cut;
      const n = 2 + Math.floor(span / 14);
      const h = Math.min(42, (y1 - y) * (0.45 + seed * 0.2));
      for (let k = 0; k < n; k++) {
        const f = ((k + 0.5) / n) * 2 - 1;
        for (const side of [-1, 1]) {
          const [ox, oz] = along ? corner(f * span, side * (hd + inset)) : corner(side * (hw + inset), f * span);
          const [wx, wz] = along ? corner(f * span, side * hd) : corner(side * hw, f * span);
          parts.push(wedge(ox, oz, wx, wz, h, 1.8, seed));
        }
      }
    } else {
      // ribs up the faces
      const ribs = 2 + Math.floor(hash(i + t * 2.3) * 3);
      for (let r = 0; r < ribs; r++) {
        const f = ((r + 0.5) / ribs) * 2 - 1;
        for (const side of [-1, 1]) {
          const [ax, az] = corner(f * (hw - cut) * 0.85, side * (hd + 0.5));
          const [bx, bz] = corner(side * (hw + 0.5), f * (hd - cut) * 0.85);
          parts.push(slab(ax, az, 0.7, 0.5, y + 3, y1 - 2, yaw, seed));
          parts.push(slab(bx, bz, 0.5, 0.7, y + 3, y1 - 2, yaw, seed));
          // energon up one rib in three
          if (hash(i * 3.1 + t + r) < 0.34) {
            const [lx, lz] = corner(f * (hw - cut) * 0.85, side * (hd + 1.05));
            strips.push([lx, lz, lx + 0.01, lz, y + 4, 0.35, y1 - y - 7]);
          }
        }
      }
    }
    // the cut corners lit, top to bottom
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const [x, z] = corner(sx * (hw - cut / 2 + 0.2), sz * (hd - cut / 2 + 0.2));
      strips.push([x, z, x, z + 0.01, y + 2, 0.45, y1 - y - 4]);
    }
    if (!last) {
      // a collar at the setback, standing proud, lit along its faces
      const cw = hw * 0.97 + 1.2;
      const cd = hd * 0.97 + 1.2;
      parts.push(prism(s.x, s.z, cw, cd, y1 - 1.8, y1 + 0.4, { yaw, cut: cut + 1, seed }));
      for (const side of [-1, 1]) {
        const [ax, az] = corner(-cw + cut, side * (cd + 0.15));
        const [bx, bz] = corner(cw - cut, side * (cd + 0.15));
        strips.push([ax, az, bx, bz, y1 - 1.2, 0.4, 0.5]);
        const [qx, qz] = corner(side * (cw + 0.15), -cd + cut);
        const [rx, rz] = corner(side * (cw + 0.15), cd - cut);
        strips.push([qx, qz, rx, rz, y1 - 1.2, 0.4, 0.5]);
      }
    }
    y = y1;
    hw *= 0.72 + hash(i + t) * 0.12;
    hd *= 0.72 + hash(i + t + 9) * 0.12;
  }
  // the crown: a ring of fins, a faceted spire, or a deck with a mast
  const kind = Math.floor(hash(i * 3.3) * 3);
  const r = Math.min(hw, hd);
  if (kind === 0) {
    const fins = 4 + Math.floor(seed * 3) * 2;
    for (let f = 0; f < fins; f++) {
      const a = (f / fins) * Math.PI * 2 + yaw;
      parts.push(wedge(s.x + Math.sin(a) * r * 1.1, s.z + Math.cos(a) * r * 1.1, s.x + Math.sin(a) * 0.6, s.z + Math.cos(a) * 0.6, 16 + seed * 22, 1.2, seed, y));
    }
    parts.push(drum(s.x, s.z, 1.4, 0.3, y, y + 26 + seed * 24, 6, seed));
  } else if (kind === 1) {
    parts.push(prism(s.x, s.z, hw * 0.55, hd * 0.55, y, y + 18 + seed * 26, { yaw, cut: r * 0.2, taper: 0.06, seed }));
  } else {
    parts.push(prism(s.x, s.z, hw * 0.8, hd * 0.8, y, y + 2.4, { yaw, cut: r * 0.3, seed }));
    parts.push(drum(s.x, s.z, 0.8, 0.4, y + 2.4, y + 30, 8, seed));
    parts.push(drum(s.x, s.z, r * 0.5, r * 0.5, y + 14, y + 15, 16, seed));
  }
}

// The megastructures beyond a city, from its stage's `skyline` list: rings
// stepping up round a spire, radial fins between them, every rim lit (`hot`
// where the war has got to it, by each one's `war`); out past the fog, which
// would only make them shadows, so they stand dark against the sky with
// their rims glowing. → the meshes to add
export function buildSkyline(list, { cool = '#3fd2ff', hot = '#ff8a2a', keep = (x) => x } = {}) {
  const far = [];
  const rims = { cool: [], hot: [] };
  for (const [n, m] of (list ?? []).entries()) {
    const seed = hash(n * 4.1 + 0.3);
    let y = 0;
    for (let t = 0; t < m.tiers; t++) {
      const r = m.r * (1 - t / (m.tiers + 0.6));
      const h = m.r * (0.12 + 0.05 * hash(n + t * 1.9));
      far.push(drum(m.x, m.z, r, r * 0.94, y, y + h, 64, seed));
      // the rim, as a ring of short strips
      const rim = hash(n * 7 + t) < m.war ? rims.hot : rims.cool;
      const rr = r * 0.94 + 0.6;
      for (let k = 0; k < 48; k++) {
        const a0 = (k / 48) * Math.PI * 2;
        const a1 = ((k + 1) / 48) * Math.PI * 2;
        rim.push([m.x + Math.cos(a0) * rr, m.z + Math.sin(a0) * rr, m.x + Math.cos(a1) * rr, m.z + Math.sin(a1) * rr, y + h - 1.5, 2.2, 1.6]);
      }
      // fins between this ring and the next, all round
      if (t < m.tiers - 1)
        for (let f = 0; f < 12; f++) {
          const a = (f / 12) * Math.PI * 2 + seed;
          const r2 = m.r * (1 - (t + 1) / (m.tiers + 0.6));
          far.push(wedge(m.x + Math.cos(a) * r * 0.97, m.z + Math.sin(a) * r * 0.97, m.x + Math.cos(a) * r2 * 0.95, m.z + Math.sin(a) * r2 * 0.95, h * 1.6, 6, seed, y + h));
        }
      y += h;
    }
    // the spire, and its light
    far.push(drum(m.x, m.z, m.r * 0.08, 2, y, y + m.r * 0.9, 8, seed));
    rims.cool.push([m.x, m.z, m.x + 0.01, m.z, y + m.r * 0.9 - 6, 5, 6]);
  }
  const out = [];
  if (far.length) {
    const farMat = keep(platedMaterial({ lights: 'slits', windows: 0.12, base: '#1a1e26', alt: '#232934', trim: '#3a4250', panel: [24, 14], glow: 1.6, metalness: 0.6, roughness: 0.6 }));
    farMat.fog = false;
    out.push(new THREE.Mesh(keep(merged(far)), farMat));
    for (const [rim, color, k] of [
      [rims.cool, cool, 2.2],
      [rims.hot, hot, 2.6],
    ]) {
      const m = makeStrips(rim, color, k);
      if (!m) continue;
      m.material.fog = false;
      keep(m.material);
      out.push(m);
    }
  }
  return out;
}
