// A world's floor masks, made in the browser through the world's own scene
// (lib/three/grounding reads them), two ways:
//
//   bakeFloorMask     offline: scripts/bake-floor-shadows.mjs drives it in
//                     headless Chromium and commits what it returns, for a
//                     world that wants several times of day (Albuquerque)
//   bakeFloorTexture  on arrival: run once when a world is built, for one
//                     sun, and kept on the GPU (lib/three/groundwork's
//                     groundWorld): no download, any seeded world
//
// Both are Bruno Simon's floor shadows (his folio-2019, bruno-simon.com),
// rendered by the site's own code instead of in Blender.
//
// A mask is how much of the sun reaches each point of the floor, at each
// named time of day, and how much of the sky does. It's rendered rather
// than traced: the floor is drawn once from straight above into a picture of
// where each of its points is, then for every direction a light can come
// from, the static world is drawn into a shadow map from that direction and
// one pass over the picture adds up which points it can see:
//
//   the sun   48 directions about where the sun is at each time, inside a
//             cone a few degrees across, so the edges of shadows are soft
//             (a penumbra), the softer the further from what casts them
//   the sky   64 directions over the whole sky, more of them high than low
//             (cosine-weighted): occlusion from the sky, the term that
//             darkens a wall's foot and the gap between two buildings
//
// bakeFloorMask(renderer, scene, { area, size, floor, casters, times, sunAt })
//   → { width, height, data } (RGBA bytes, top row first: R, G, B the sun
//   at the times whose channel is 0, 1, 2; A the sky)

import * as THREE from 'three';
import { nextFrame as gpuFrame } from './gpuWork';

const DEG = Math.PI / 180;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// Directions inside a cone of `half` radians about `axis` (a spiral over
// its disc, so they're even and the same every bake), none lower than `low`
// radians over the horizon.
export function coneDirections(axis, half, n, low = 2 * DEG) {
  const a = axis.clone().normalize();
  const t1 = new THREE.Vector3().crossVectors(a, Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const t2 = new THREE.Vector3().crossVectors(a, t1);
  const out = [];
  const minY = Math.sin(low);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + 0.5) / n) * Math.tan(half);
    const p = i * GOLDEN;
    const d = a.clone().addScaledVector(t1, r * Math.cos(p)).addScaledVector(t2, r * Math.sin(p)).normalize();
    if (d.y < minY) {
      const h = Math.hypot(d.x, d.z) || 1;
      const k = Math.sqrt(1 - minY * minY) / h;
      d.set(d.x * k, minY, d.z * k);
    }
    out.push(d);
  }
  return out;
}

// A sun no lower than `deg` degrees over the horizon, facing the same way.
// A sun just risen throws every shadow a hundred metres and more, which on a
// floor mask is a town drowned in shade; baked as if it stood a little
// higher, the shadows still run long and the right way, and the street
// stays legible. (Only the mask's sun is lifted: the walls are still lit by
// the real one.) A new vector; `dir` is left alone.
export function liftSun(dir, deg = 0) {
  if (!(deg > 0)) return dir.clone();
  const out = dir.clone().normalize();
  const min = Math.sin(deg * DEG);
  if (out.y >= min) return out;
  const k = Math.sqrt(1 - min * min) / (Math.hypot(out.x, out.z) || 1);
  return out.set(out.x * k, min, out.z * k);
}

// Directions over the sky, cosine-weighted (Hammersley points), so their
// plain average is the sky's light on a level floor.
export function skyDirections(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let bits = i;
    let v = 0;
    let f = 0.5;
    while (bits) {
      if (bits & 1) v += f;
      bits >>= 1;
      f /= 2;
    }
    const u = (i + 0.5) / n;
    const r = Math.sqrt(u);
    const p = 2 * Math.PI * v;
    out.push(new THREE.Vector3(r * Math.cos(p), Math.sqrt(1 - u), r * Math.sin(p)));
  }
  return out;
}

const POS_VERT = /* glsl */ `
varying vec3 vP;
void main() {
  vec4 wp = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  wp = modelMatrix * wp;
  vP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const POS_FRAG = /* glsl */ `
varying vec3 vP;
void main() { gl_FragColor = vec4(vP, 1.0); }`;

const ADD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// one direction's light on every point of the floor, added in with its weight
const ADD_FRAG = /* glsl */ `
uniform sampler2D uPos;
uniform sampler2D uDepth;
uniform mat4 uShadowMatrix;
uniform vec4 uWeight;
uniform float uBias;
varying vec2 vUv;
void main() {
  vec4 p = texture2D(uPos, vUv);
  float lit = 1.0;
  if (p.w > 0.5) {
    vec4 sc = uShadowMatrix * vec4(p.xyz, 1.0);
    vec3 s = sc.xyz / sc.w;
    if (s.x > 0.0 && s.x < 1.0 && s.y > 0.0 && s.y < 1.0 && s.z < 1.0) lit = step(s.z - uBias, texture2D(uDepth, s.xy).r);
  }
  gl_FragColor = uWeight * lit;
}`;

const nextFrame = () => new Promise((r) => setTimeout(r, 0));
// (between a bake's chunks, the world's own frame: the world goes on drawing)
// (a frame, or gpuWork's FRAME_WAIT in a background tab, which gets none)
const nextPaint = gpuFrame;

// ── what a bake on arrival costs, by the device's tier ──

// The mask's size, how many directions about the sun and over the sky, and
// the shadow map each is drawn with. A phone gets a coarser, noisier bake in
// a fraction of the passes; the picture it gives is the same kind.
// How high a low sun is baked, at least (liftSun), in degrees: a dusk sun's
// shadows run five times as long as what throws them, and one hill would
// drown a town in them. Bruno Simon's folio has its sun at about 46°.
export const BAKE_LIFT = 20;

export const BAKE_TIERS = {
  high: { size: 1024, sun: 40, sky: 40, shadow: 2048 },
  mid: { size: 512, sun: 24, sky: 24, shadow: 2048 },
  low: { size: 512, sun: 12, sky: 16, shadow: 1024 },
};

// ── the floor's height, in two bytes ──

// A mask baked on arrival keeps the floor's height in its G and B (high byte,
// low byte, over `range`), so the bounce knows how far above the floor any
// point is, on hills and terraces alike. 0, 0 means no floor there at all, so
// even the lowest height is stored as at least 1 of 65535. (Linear filtering
// between two texels mixes 256·G + B linearly too, so a filtered read is a
// filtered height.)
export function packHeight(h, [lo, hi]) {
  const span = hi - lo || 1;
  const t = Math.min(1, Math.max(0, (h - lo) / span));
  const v = 1 + Math.round(t * 65534);
  return [v >> 8, v & 255];
}

export function unpackHeight(g, b, [lo, hi]) {
  const v = g * 256 + b;
  if (v < 0.5) return null;
  return lo + ((v - 1) / 65534) * (hi - lo);
}

// The floor's height under a point, from a baked mask read back as bytes
// (RGBA, row 0 the area's z0 edge): null where no floor was seen, or outside
// the area. What a blob is laid on where a world has no height of its own.
export function heightFromPixels(px, size, area, range, x, z) {
  if (!px) return null;
  const u = (x - area.x0) / area.w;
  const v = (z - area.z0) / area.d;
  if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) return null;
  const i = (Math.min(size - 1, Math.floor(v * size)) * size + Math.min(size - 1, Math.floor(u * size))) * 4;
  return unpackHeight(px[i + 1], px[i + 2], range);
}

// ── what a bake draws, and what it leaves out ──

const meshMaterials = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);
const scaleOf = (o) => {
  const e = o.matrixWorld.elements;
  return Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])) || 1;
};

// Whether a mesh shadows the floor in a bake: not points, lines or sprites
// (they aren't meshes), not a skinned figure (those move), nothing
// see-through, nothing that asks not to be (`userData.noBake`), not a sky
// dome or a far rim bigger than `radius` across (it would shadow the whole
// mask), and not a piece smaller than a quarter of a metre (grass, pebbles:
// finer than a texel of the mask, and thousands of them).
export function bakeable(o, radius = Infinity) {
  if (!o?.isMesh || o.isSkinnedMesh || o.userData?.noBake) return false;
  const mats = meshMaterials(o);
  if (!mats.length || mats.some((m) => m.transparent || m.opacity < 1)) return false;
  const g = o.geometry;
  if (!g) return false;
  if (!g.boundingSphere) g.computeBoundingSphere?.();
  const r = (g.boundingSphere?.radius ?? 0) * scaleOf(o);
  if (r < 0.25) return false;
  if (!o.isInstancedMesh && r > radius) return false;
  return true;
}

// Holds the scene for one chunk of a bake: every light's shadow off (the
// world's own sun would otherwise draw its shadow map too), every mesh's
// casting off but the casters' (through `filter`), the floor never casting,
// and what moves hidden. Returns what puts it all back as it was.
export function holdForBake(scene, { floor = [], casters = [], skip = [], radius = Infinity, filter = null } = {}) {
  const undo = [];
  const set = (o, k, v) => {
    undo.push([o, k, o[k]]);
    o[k] = v;
  };
  const floorSet = new Set();
  for (const root of floor) root.traverse((o) => o.isMesh && floorSet.add(o));
  const skipSet = new Set(skip.filter(Boolean));
  const ok = filter ?? ((o) => bakeable(o, radius));
  scene.traverse((o) => {
    if (o.isLight && o.castShadow) set(o, 'castShadow', false);
    else if (o.isMesh && o.castShadow) set(o, 'castShadow', false);
  });
  const visit = (o) => {
    if (skipSet.has(o) || o.userData?.noBake) return;
    if (o.isMesh && !floorSet.has(o) && o.visible && ok(o)) set(o, 'castShadow', true);
    for (const c of o.children) visit(c);
  };
  for (const root of casters) visit(root);
  for (const o of skipSet) set(o, 'visible', false);
  return () => {
    for (let i = undo.length - 1; i >= 0; i--) undo[i][0][undo[i][1]] = undo[i][2];
    undo.length = 0;
  };
}

// The machinery both bakes share: the picture of where the floor is, the
// light and its shadow map, and the pass that adds up what one direction of
// light sees. `begin()` holds the scene and the renderer for a run of passes,
// `end()` gives them back; nothing is left changed between the two.
function makeBaker(renderer, scene, { area, size, floor, casters, skip = [], filter = null, top = 90, bottom = -1, shadowSize = 4096, accType = THREE.FloatType }) {
  const { x0, z0, w, d } = area;
  const cx = x0 + w / 2;
  const cz = z0 + d / 2;
  const radius = Math.hypot(w, d);
  const LAYER = 31;
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const floorMeshes = [];
  for (const root of floor) root.traverse((o) => (o.isMesh ? floorMeshes.push(o) : null));

  let kept = null;
  let restore = null;
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.castShadow = true;
  light.shadow.mapSize.set(shadowSize, shadowSize);
  light.shadow.bias = 0;
  light.shadow.normalBias = 0;
  const centre = new THREE.Vector3(cx, 0, cz);
  light.target.position.copy(centre);
  light.target.updateMatrixWorld(true);

  const begin = () => {
    kept = {
      target: renderer.getRenderTarget(),
      autoClear: renderer.autoClear,
      shadows: renderer.shadowMap.enabled,
      type: renderer.shadowMap.type,
      autoUpdate: renderer.shadowMap.autoUpdate,
      override: scene.overrideMaterial,
      background: scene.background,
      fog: scene.fog,
      clear: renderer.getClearColor(new THREE.Color()),
      alpha: renderer.getClearAlpha(),
    };
    restore = holdForBake(scene, { floor, casters, skip, radius: 2 * radius, filter });
    scene.updateMatrixWorld(true);
  };
  const end = () => {
    if (light.parent) scene.remove(light, light.target);
    restore?.();
    restore = null;
    if (!kept) return;
    scene.overrideMaterial = kept.override;
    scene.background = kept.background;
    scene.fog = kept.fog;
    renderer.shadowMap.enabled = kept.shadows;
    renderer.shadowMap.type = kept.type;
    renderer.shadowMap.autoUpdate = kept.autoUpdate;
    renderer.autoClear = kept.autoClear;
    renderer.setClearColor(kept.clear, kept.alpha);
    renderer.setRenderTarget(kept.target);
    kept = null;
  };

  // ── where each point of the floor is, seen from straight above ──
  // (screen right is +x and screen up is −z, so the rows read back top
  // first are the image's, and v = 0 is the area's z0 edge)
  const pos = own(new THREE.WebGLRenderTarget(size, size, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true }));
  const posMat = own(new THREE.ShaderMaterial({ vertexShader: POS_VERT, fragmentShader: POS_FRAG, side: THREE.DoubleSide }));
  const drawPositions = () => {
    const above = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 1, 2000);
    above.up.set(0, 0, -1);
    above.position.set(cx, 1000, cz);
    above.lookAt(cx, 0, cz);
    above.updateMatrixWorld(true);
    above.layers.set(LAYER);
    for (const m of floorMeshes) m.layers.enable(LAYER);
    renderer.shadowMap.enabled = false;
    scene.background = null;
    scene.overrideMaterial = posMat;
    renderer.setRenderTarget(pos);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(scene, above);
    scene.overrideMaterial = kept.override;
    scene.background = kept.background;
    for (const m of floorMeshes) m.layers.disable(LAYER);
  };

  // ── the light, and what adds up what it sees ──
  const acc = own(new THREE.WebGLRenderTarget(size, size, { type: accType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false }));
  const add = own(
    new THREE.ShaderMaterial({
      vertexShader: ADD_VERT,
      fragmentShader: ADD_FRAG,
      uniforms: { uPos: { value: pos.texture }, uDepth: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() }, uWeight: { value: new THREE.Vector4() }, uBias: { value: 0 } },
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquation: THREE.AddEquation,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const quadGeo = own(new THREE.PlaneGeometry(2, 2));
  const quad = new THREE.Mesh(quadGeo, add);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const clearAcc = () => {
    renderer.setRenderTarget(acc);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
  };
  // (three draws a shadow map only inside a render of the scene: one into a
  // single pixel, from a camera looking away at nothing, with the cheapest
  // material there is for what isn't culled, sets it off)
  const pixel = own(new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }));
  const nowhere = new THREE.OrthographicCamera(-0.001, 0.001, 0.001, -0.001, 0.1, 0.2);
  nowhere.position.set(0, -1e5, 0);
  nowhere.lookAt(0, -2e5, 0);
  nowhere.updateMatrixWorld(true);
  const cheap = own(new THREE.MeshBasicMaterial({ colorWrite: false }));

  // the corners of everything that can shadow the area from `dir`: the
  // area up to `top`, and as far toward the light as something that tall
  // throws its shadow
  const corners = (dir) => {
    const up = Math.max(0.05, dir.y);
    const reach = Math.min(400, top / up);
    const ex = (dir.x / Math.hypot(dir.x, dir.z) || 0) * reach * Math.sqrt(1 - up * up);
    const ez = (dir.z / Math.hypot(dir.x, dir.z) || 0) * reach * Math.sqrt(1 - up * up);
    const pts = [];
    for (const [x, z] of [
      [x0, z0],
      [x0 + w, z0],
      [x0, z0 + d],
      [x0 + w, z0 + d],
    ])
      for (const y of [bottom, top]) {
        pts.push(new THREE.Vector3(x, y, z));
        pts.push(new THREE.Vector3(x + ex, y, z + ez));
      }
    return pts;
  };
  const cam = light.shadow.camera;
  const v = new THREE.Vector3();
  const pass = (dir, weight) => {
    if (!light.parent) scene.add(light, light.target);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    light.position.copy(centre).addScaledVector(dir, 1500);
    light.updateMatrixWorld(true);
    // the shadow camera as the shadow pass will place it, fitted round the corners
    cam.position.copy(light.position);
    cam.lookAt(centre);
    cam.updateMatrixWorld(true);
    let [l, r, b, t, n, f] = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
    for (const p of corners(dir)) {
      v.copy(p).applyMatrix4(cam.matrixWorldInverse);
      l = Math.min(l, v.x);
      r = Math.max(r, v.x);
      b = Math.min(b, v.y);
      t = Math.max(t, v.y);
      n = Math.min(n, -v.z);
      f = Math.max(f, -v.z);
    }
    Object.assign(cam, { left: l - 1, right: r + 1, bottom: b - 1, top: t + 1, near: Math.max(0.5, n - 20), far: f + 20 });
    cam.updateProjectionMatrix();
    scene.overrideMaterial = cheap;
    scene.background = null;
    scene.fog = null;
    renderer.setRenderTarget(pixel);
    renderer.autoClear = true;
    renderer.render(scene, nowhere);
    scene.overrideMaterial = kept.override;
    scene.background = kept.background;
    scene.fog = kept.fog;
    add.uniforms.uDepth.value = light.shadow.map.depthTexture;
    add.uniforms.uShadowMatrix.value.copy(light.shadow.matrix);
    add.uniforms.uWeight.value.copy(weight);
    add.uniforms.uBias.value = 0.05 / (cam.far - cam.near);
    renderer.setRenderTarget(acc);
    renderer.autoClear = false;
    renderer.render(quadScene, quadCam);
  };

  return {
    pos,
    acc,
    begin,
    end,
    drawPositions,
    clearAcc,
    pass,
    dispose() {
      if (light.parent) scene.remove(light, light.target);
      light.shadow.map?.depthTexture?.dispose();
      light.shadow.map?.dispose();
      light.dispose();
      for (const o of owned) o.dispose?.();
    },
  };
}

// The passes of a bake: `sunSamples` directions about the sun at each named
// time (its channel's weight), then `skySamples` over the sky (alpha).
function bakeJobs({ times, sunAt, sunSamples, skySamples, cone }) {
  const jobs = [];
  const named = times.filter((x) => x.channel >= 0 && x.channel <= 2);
  for (const tm of named) {
    const weight = new THREE.Vector4();
    weight.setComponent(tm.channel, 1 / sunSamples);
    // (a time may ask for its sun to be baked higher than it stands: `lift`, in degrees)
    for (const dir of coneDirections(liftSun(sunAt(tm.tod), tm.lift), cone, sunSamples)) jobs.push([dir, weight]);
  }
  const sky = new THREE.Vector4(0, 0, 0, 1 / skySamples);
  for (const dir of skyDirections(skySamples)) jobs.push([dir, sky]);
  return { jobs, named };
}

// `area` { x0, z0, w, d } in metres; `size` the mask's width and height in
// texels; `floor` the meshes (or groups) that are the floor, drawn from above;
// `casters` the static world that shadows it (everything else is left out,
// so hide what moves first); `times` [{ tod, channel }]; `sunAt(tod)` the
// direction to the sun; a time with `lift` (degrees) is baked with its sun at
// least that high (liftSun). `top` is as high as anything casting stands.
export async function bakeFloorMask(renderer, scene, { area, size = 1024, floor, casters, times, sunAt, sunSamples = 48, skySamples = 64, cone = 4 * DEG, top = 90, shadowSize = 4096, onProgress = null } = {}) {
  // (every visible mesh of the casters, as the masks committed for
  // Albuquerque were made: the bake on arrival leaves more out, `bakeable`)
  const baker = makeBaker(renderer, scene, { area, size, floor, casters, top, shadowSize, filter: (o) => o.isMesh && o.visible });
  baker.begin();
  try {
    baker.drawPositions();
    baker.clearAcc();
    const { jobs, named } = bakeJobs({ times, sunAt, sunSamples, skySamples, cone });
    const t0 = performance.now();
    for (let i = 0; i < jobs.length; i++) {
      baker.pass(jobs[i][0], jobs[i][1]);
      if (i % 4 === 3) {
        // (a finish now and then, so the time per pass is real and the page answers)
        renderer.getContext().finish();
        onProgress?.({ done: i + 1, of: jobs.length, ms: performance.now() - t0 });
        await nextFrame();
      }
    }

    // ── read back, as bytes ──
    const raw = new Float32Array(size * size * 4);
    renderer.readRenderTargetPixels(baker.acc, 0, 0, size, size, raw);
    const data = new Uint8Array(size * size * 4);
    const has = [0, 1, 2].map((c) => named.some((x) => x.channel === c));
    for (let i = 0; i < size * size; i++) {
      for (let c = 0; c < 3; c++) data[i * 4 + c] = has[c] ? Math.round(Math.min(1, Math.max(0, raw[i * 4 + c])) * 255) : 255;
      data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, raw[i * 4 + 3])) * 255);
    }
    return { width: size, height: size, data, ms: performance.now() - t0, passes: jobs.length };
  } finally {
    baker.end();
    baker.dispose();
  }
}

// ── the bake on arrival ──

// the sum of the passes, a little softened (a 3 × 3 tent: the shadow maps'
// texels are hard-edged), as R the sun and A the sky; G and B the floor's
// height (packHeight); where there's no floor, full light and no height.
// Turned over top to bottom: the floor was drawn with the area's z0 edge at
// the top of the picture, and a texture's v = 0 is its bottom row, where the
// floor's shader looks for z0 (the offline masks are turned over by being
// read back and saved as images).
const RESOLVE_FRAG = /* glsl */ `
uniform sampler2D uAcc;
uniform sampler2D uPos;
uniform vec2 uTexel;
uniform vec2 uRange;
varying vec2 vUv;
void main() {
  vec2 q = vec2(vUv.x, 1.0 - vUv.y);
  vec4 s = vec4(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    float k = (2.0 - abs(float(i))) * (2.0 - abs(float(j)));
    s += k * texture2D(uAcc, q + vec2(float(i), float(j)) * uTexel);
  }
  s /= 16.0;
  vec4 p = texture2D(uPos, q);
  if (p.w < 0.5) { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
  float t = clamp((p.y - uRange.x) / max(uRange.y - uRange.x, 1e-4), 0.0, 1.0);
  float v = 1.0 + floor(t * 65534.0 + 0.5);
  float hi = floor(v / 256.0);
  float lo = v - hi * 256.0;
  gl_FragColor = vec4(clamp(s.r, 0.0, 1.0), hi / 255.0, lo / 255.0, clamp(s.a, 0.0, 1.0));
}`;

// How high the floor's meshes reach: the range their height is packed over,
// with half a metre to spare either way.
function floorRange(floor) {
  const box = new THREE.Box3();
  for (const root of floor) box.expandByObject(root);
  if (box.isEmpty()) return [-1, 1];
  return [box.min.y - 0.5, box.max.y + 0.5];
}

// How high anything that casts stands, over the floor's lowest point, to fit
// each shadow camera round what can shadow the area.
export function castersTop(casters, radius, low) {
  const box = new THREE.Box3();
  const one = new THREE.Box3();
  for (const root of casters)
    root.traverse((o) => {
      if (!bakeable(o, radius)) return;
      // (an instanced flock by all its instances: a city's towers)
      if (o.isInstancedMesh) {
        o.computeBoundingBox();
        one.copy(o.boundingBox);
      } else {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        one.copy(o.geometry.boundingBox);
      }
      box.union(one.applyMatrix4(o.matrixWorld));
    });
  if (box.isEmpty()) return 20;
  return Math.min(400, Math.max(5, box.max.y - low));
}

// A world's floor light, baked when the world is built, kept on the GPU:
// the same mask as bakeFloorMask's, for one sun, with the floor's height in
// G and B. It goes in chunks of `chunk` passes, each one holding the scene
// and giving it back, so the world goes on drawing in between. `sun` points
// at the sun; it's baked at least `lift` degrees up (liftSun: a low sun's
// shadows would drown the floor); with no `sun`, only the sky is baked.
// `signal.aborted` stops it at the next
// chunk. Resolves { texture, range, area, ms, passes, dispose() }, or null
// where it can't be done (no float pictures on this GPU, or anything going
// wrong): the world then stands as it is. `pixels` is the mask read back
// (heightFromPixels).
export async function bakeFloorTexture(renderer, scene, { area, floor = [], casters = [], skip = [], sun, size = BAKE_TIERS.mid.size, sunSamples = BAKE_TIERS.mid.sun, skySamples = BAKE_TIERS.mid.sky, shadowSize = BAKE_TIERS.mid.shadow, cone = 4 * DEG, lift = BAKE_LIFT, top = null, range = null, chunk = 6, signal = null } = {}) {
  if (!renderer?.extensions?.has?.('EXT_color_buffer_float') || !area || !floor.length) return null;
  let baker = null;
  let out = null;
  const owned = [];
  try {
    scene.updateMatrixWorld(true);
    const span = range ?? floorRange(floor);
    const reach = top ?? castersTop(casters, 2 * Math.hypot(area.w, area.d), span[0]);
    baker = makeBaker(renderer, scene, { area, size, floor, casters, skip, top: span[0] + reach, bottom: Math.min(-1, span[0]), shadowSize, accType: THREE.HalfFloatType });
    // (no sun: the sky's occlusion alone, for a world that keeps its own shadow pass)
    const { jobs } = bakeJobs({ times: sun ? [{ tod: 0, channel: 0, lift }] : [], sunAt: () => sun.clone().normalize(), sunSamples, skySamples, cone });
    const t0 = performance.now();
    baker.begin();
    try {
      baker.drawPositions();
      baker.clearAcc();
    } finally {
      baker.end();
    }
    for (let i = 0; i < jobs.length; i += chunk) {
      await nextPaint();
      if (signal?.aborted) return null;
      baker.begin();
      try {
        for (let k = i; k < Math.min(jobs.length, i + chunk); k++) baker.pass(jobs[k][0], jobs[k][1]);
      } finally {
        baker.end();
      }
    }
    if (signal?.aborted) return null;

    // ── resolved into a picture the floor reads ──
    out = new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false });
    out.texture.colorSpace = THREE.NoColorSpace;
    const resolve = new THREE.ShaderMaterial({
      vertexShader: ADD_VERT,
      fragmentShader: RESOLVE_FRAG,
      uniforms: { uAcc: { value: baker.acc.texture }, uPos: { value: baker.pos.texture }, uTexel: { value: new THREE.Vector2(1 / size, 1 / size) }, uRange: { value: new THREE.Vector2(span[0], span[1]) } },
      depthTest: false,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(2, 2);
    owned.push(resolve, geo);
    const quad = new THREE.Mesh(geo, resolve);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const kept = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear };
    renderer.setRenderTarget(out);
    renderer.autoClear = true;
    renderer.render(quadScene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
    renderer.setRenderTarget(kept.target);
    renderer.autoClear = kept.autoClear;
    // (read back once, a moment's stall: where the floor is, for whatever
    // lays a blob on it)
    const pixels = new Uint8Array(size * size * 4);
    renderer.readRenderTargetPixels(out, 0, 0, size, size, pixels);
    const result = out;
    out = null;
    return { texture: result.texture, pixels, size, range: span, area: { ...area }, ms: performance.now() - t0, passes: jobs.length, dispose: () => result.dispose() };
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[grounding] the floor bake failed; the world stands without it', err);
    return null;
  } finally {
    out?.dispose();
    baker?.dispose();
    for (const o of owned) o.dispose();
  }
}

// The bytes as a data URL (what a script reads back through the page).
export function bytesToDataUrl(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return `data:application/octet-stream;base64,${btoa(s)}`;
}
