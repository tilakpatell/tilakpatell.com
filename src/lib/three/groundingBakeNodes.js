// grounding-bake.js on the node renderer: a world's floor masks, made in
// the browser through the world's own scene, the same two ways and the same
// picture. What changes is how: the classic bake read three's shadow map
// from inside its WebGLRenderer; here each direction's depth is drawn into
// a depth texture of the bake's own (the casters alone, on a layer), one
// pass over the floor's positions adds up what it sees (texelFetch, so the
// two pictures meet texel for texel on either backend), and the sum is read
// back and resolved on the CPU (the tent, the height packed in G and B),
// orienting the picture by the world positions it holds, so a backend that
// stores its rows the other way round makes the same mask. The pure parts
// are grounding-bake.js's, copied: importing them would bring its GLSL
// into a 'nodes' world's closure.
//
//   bakeFloorMask(renderer, scene, opts) → { width, height, data, ms, passes }
//   bakeFloorTexture(renderer, scene, opts) → { texture, pixels, size, range, area, ms, passes, dispose() } | null
//   coneDirections, liftSun, skyDirections, BAKE_LIFT, BAKE_TIERS, packHeight,
//   unpackHeight, heightFromPixels, bakeable, holdForBake, castersTop, bytesToDataUrl

import * as THREE from 'three';
import { nextFrame as gpuFrame } from './gpuWork';
import { MeshBasicNodeMaterial, QuadMesh } from 'three/webgpu';
import { Fn, If, float, ivec2, positionWorld, screenCoordinate, select, step, textureLoad, uniform, vec4 } from 'three/tsl';

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

// The machinery both bakes share: the picture of where the floor is, a
// depth picture from each direction of light, and the pass that adds up
// what one direction sees. `begin()` holds the scene and the renderer for a
// run of passes, `end()` gives them back.
const LAYER = 31;
function makeBaker(renderer, scene, { area, size, floor, casters, skip = [], filter = null, top = 90, bottom = -1, shadowSize = 4096 }) {
  const { x0, z0, w, d } = area;
  const cx = x0 + w / 2;
  const cz = z0 + d / 2;
  const radius = Math.hypot(w, d);
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const floorMeshes = [];
  for (const root of floor) root.traverse((o) => (o.isMesh ? floorMeshes.push(o) : null));
  const centre = new THREE.Vector3(cx, 0, cz);
  const webgpu = renderer.coordinateSystem === THREE.WebGPUCoordinateSystem;

  let kept = null;
  let restore = null;
  let casting = [];
  const begin = () => {
    kept = {
      target: renderer.getRenderTarget(),
      autoClear: renderer.autoClear,
      override: scene.overrideMaterial,
      background: scene.background,
      fog: scene.fog,
      clear: renderer.getClearColor(new THREE.Color()),
      alpha: renderer.getClearAlpha(),
    };
    restore = holdForBake(scene, { floor, casters, skip, radius: 2 * radius, filter });
    // (what casts, on the bake's layer: the depth pictures draw it alone)
    casting = [];
    scene.traverse((o) => {
      if (o.isMesh && o.castShadow && o.visible) {
        o.layers.enable(LAYER);
        casting.push(o);
      }
    });
    scene.updateMatrixWorld(true);
  };
  const end = () => {
    for (const o of casting) o.layers.disable(LAYER);
    casting = [];
    restore?.();
    restore = null;
    if (!kept) return;
    scene.overrideMaterial = kept.override;
    scene.background = kept.background;
    scene.fog = kept.fog;
    renderer.autoClear = kept.autoClear;
    renderer.setClearColor(kept.clear, kept.alpha);
    renderer.setRenderTarget(kept.target);
    kept = null;
  };

  // ── where each point of the floor is, seen from straight above ──
  const pos = own(new THREE.RenderTarget(size, size, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true }));
  const posMat = own(new MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false }));
  posMat.fragmentNode = vec4(positionWorld, 1);
  const drawPositions = () => {
    const above = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 1, 2000);
    above.up.set(0, 0, -1);
    above.position.set(cx, 1000, cz);
    above.lookAt(cx, 0, cz);
    above.updateMatrixWorld(true);
    above.layers.set(LAYER - 1);
    for (const m of floorMeshes) m.layers.enable(LAYER - 1);
    scene.background = null;
    scene.overrideMaterial = posMat;
    renderer.setRenderTarget(pos);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(scene, above);
    scene.overrideMaterial = kept.override;
    scene.background = kept.background;
    for (const m of floorMeshes) m.layers.disable(LAYER - 1);
  };

  // ── a direction's depth, and what adds up what it sees ──
  const depthTex = own(new THREE.DepthTexture(shadowSize, shadowSize, THREE.FloatType));
  const depth = own(new THREE.RenderTarget(shadowSize, shadowSize, { depthBuffer: true, depthTexture: depthTex }));
  const cheap = own(new MeshBasicNodeMaterial({ colorWrite: false, side: THREE.DoubleSide, fog: false }));
  const acc = own(new THREE.RenderTarget(size, size, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false }));
  const u = { uShadowMatrix: uniform(new THREE.Matrix4()), uWeight: uniform(new THREE.Vector4()), uBias: uniform(0) };
  const add = own(new MeshBasicNodeMaterial({ blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, depthTest: false, depthWrite: false, transparent: true, fog: false }));
  // ADD_FRAG: this texel's floor point, seen from the light or shadowed
  add.fragmentNode = Fn(() => {
    const p = textureLoad(pos.texture, ivec2(screenCoordinate.xy)).toVar();
    const lit = float(1).toVar();
    If(p.w.greaterThan(0.5), () => {
      const sc = u.uShadowMatrix.mul(vec4(p.xyz, 1));
      const s = sc.xyz.div(sc.w).toVar();
      // (the depth picture's texel: the node renderer stores a render
      // target's rows top first on both backends; and the depth as this
      // backend's buffer holds it, 0 to 1 near to far)
      const sx = s.x.mul(0.5).add(0.5);
      const sy = s.y.mul(0.5).add(0.5).oneMinus();
      const sz = webgpu ? s.z : s.z.mul(0.5).add(0.5);
      const inside = sx.greaterThan(0).and(sx.lessThan(1)).and(sy.greaterThan(0)).and(sy.lessThan(1)).and(sz.lessThan(1));
      const at = ivec2(sx.mul(shadowSize).clamp(0, shadowSize - 1), sy.mul(shadowSize).clamp(0, shadowSize - 1));
      const seen = step(sz.sub(u.uBias), textureLoad(depthTex, at).x);
      lit.assign(select(inside, seen, float(1)));
    });
    return u.uWeight.mul(lit);
  })();
  const quad = new QuadMesh(add);
  const clearAcc = () => {
    renderer.setRenderTarget(acc);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
  };

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
  const cam = new THREE.OrthographicCamera();
  cam.layers.set(LAYER);
  const v = new THREE.Vector3();
  const pass = (dir, weight) => {
    // the light's camera, fitted round everything that can shadow the area
    cam.position.copy(centre).addScaledVector(dir, 1500);
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
    cam.coordinateSystem = renderer.coordinateSystem;
    cam.updateProjectionMatrix();
    scene.overrideMaterial = cheap;
    scene.background = null;
    scene.fog = null;
    renderer.setRenderTarget(depth);
    renderer.autoClear = true;
    renderer.render(scene, cam);
    scene.overrideMaterial = kept.override;
    scene.background = kept.background;
    scene.fog = kept.fog;
    u.uShadowMatrix.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    u.uWeight.value.copy(weight);
    // (the classic bake's bias, over a depth that runs 0 to 1 near to far)
    u.uBias.value = 0.05 / (cam.far - cam.near);
    renderer.setRenderTarget(acc);
    renderer.autoClear = false;
    quad.render(renderer);
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
// texels; `floor`, `casters`, `times`, `sunAt` as grounding-bake.js's.
// (Its rows are the area's z0 edge first, as the offline masks are saved.)
export async function bakeFloorMask(renderer, scene, { area, size = 1024, floor, casters, times, sunAt, sunSamples = 48, skySamples = 64, cone = 4 * DEG, top = 90, shadowSize = 4096, onProgress = null } = {}) {
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
        onProgress?.({ done: i + 1, of: jobs.length, ms: performance.now() - t0 });
        await nextFrame();
      }
    }
    const raw = await read(renderer, baker.acc, size);
    const pos = await read(renderer, baker.pos, size);
    // (the offline masks have the area's z0 edge in their first row: the
    // rows put that way round by the positions, as resolveMask does)
    const rowZ = (row) => {
      for (let x = 0; x < size; x++) if (pos[(row * size + x) * 4 + 3] > 0.5) return pos[(row * size + x) * 4 + 2];
      return null;
    };
    const flip = (rowZ(0) ?? 0) > (rowZ(size - 1) ?? 0);
    const data = new Uint8Array(size * size * 4);
    const has = [0, 1, 2].map((c) => named.some((x) => x.channel === c));
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const s = ((flip ? size - 1 - j : j) * size + i) * 4;
        const o = (j * size + i) * 4;
        for (let c = 0; c < 3; c++) data[o + c] = has[c] ? Math.round(Math.min(1, Math.max(0, raw[s + c])) * 255) : 255;
        data[o + 3] = Math.round(Math.min(1, Math.max(0, raw[s + 3])) * 255);
      }
    return { width: size, height: size, data, ms: performance.now() - t0, passes: jobs.length };
  } finally {
    baker.end();
    baker.dispose();
  }
}

// RESOLVE_FRAG on the CPU: the sum a little softened (a 3 × 3 tent), as R
// the sun and A the sky; G and B the floor's height (packHeight); where
// there's no floor, full light and no height. Row 0 is the area's z0 edge
// and column 0 its x0 edge, found from the positions themselves (whichever
// way round the backend read its rows back).
export function resolveMask(acc, pos, size, range) {
  const at = (x, y) => (y * size + x) * 4;
  // which way the rows and the columns run: the floor's z and x across them
  const zOf = (row) => {
    let s = 0;
    let n = 0;
    for (let x = 0; x < size; x++) {
      const i = at(x, row);
      if (pos[i + 3] > 0.5) {
        s += pos[i + 2];
        n++;
      }
    }
    return n ? s / n : null;
  };
  const xOf = (col) => {
    let s = 0;
    let n = 0;
    for (let y = 0; y < size; y++) {
      const i = at(col, y);
      if (pos[i + 3] > 0.5) {
        s += pos[i];
        n++;
      }
    }
    return n ? s / n : null;
  };
  const firstRow = zOf(0);
  const lastRow = zOf(size - 1);
  const flipRows = firstRow != null && lastRow != null && firstRow > lastRow;
  const firstCol = xOf(0);
  const lastCol = xOf(size - 1);
  const flipCols = firstCol != null && lastCol != null && firstCol > lastCol;
  const out = new Uint8Array(size * size * 4);
  const span = Math.max(range[1] - range[0], 1e-4);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const sx = flipCols ? size - 1 - i : i;
      const sy = flipRows ? size - 1 - j : j;
      let r = 0;
      let a = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const k = (2 - Math.abs(di)) * (2 - Math.abs(dj));
          const q = at(Math.min(size - 1, Math.max(0, sx + di)), Math.min(size - 1, Math.max(0, sy + dj)));
          r += k * acc[q];
          a += k * acc[q + 3];
        }
      const o = (j * size + i) * 4;
      const p = at(sx, sy);
      if (pos[p + 3] < 0.5) {
        out[o] = 255;
        out[o + 3] = 255;
        continue;
      }
      const t = Math.min(1, Math.max(0, (pos[p + 1] - range[0]) / span));
      const v = 1 + Math.floor(t * 65534 + 0.5);
      out[o] = Math.round(Math.min(1, Math.max(0, r / 16)) * 255);
      out[o + 1] = v >> 8;
      out[o + 2] = v & 255;
      out[o + 3] = Math.round(Math.min(1, Math.max(0, a / 16)) * 255);
    }
  return out;
}

const read = (renderer, target, size) => renderer.readRenderTargetPixelsAsync(target, 0, 0, size, size);

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
  if (!renderer?.readRenderTargetPixelsAsync || !area || !floor.length) return null;
  let baker = null;
  try {
    scene.updateMatrixWorld(true);
    const span = range ?? floorRange(floor);
    const reach = top ?? castersTop(casters, 2 * Math.hypot(area.w, area.d), span[0]);
    baker = makeBaker(renderer, scene, { area, size, floor, casters, skip, top: span[0] + reach, bottom: Math.min(-1, span[0]), shadowSize });
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
    // ── read back and resolved into the picture the floor reads ──
    const acc = await read(renderer, baker.acc, size);
    const pos = await read(renderer, baker.pos, size);
    const pixels = resolveMask(acc, pos, size, span);
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return { texture, pixels, size, range: span, area: { ...area }, ms: performance.now() - t0, passes: jobs.length, dispose: () => texture.dispose() };
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[grounding] the floor bake failed; the world stands without it', err);
    return null;
  } finally {
    baker?.dispose();
  }
}

// The bytes as a data URL (what a script reads back through the page).
export function bytesToDataUrl(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return `data:application/octet-stream;base64,${btoa(s)}`;
}
