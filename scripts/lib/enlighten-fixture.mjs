// The lit fixture's Enlighten set (GPU-first lane N3): a 256² stand-in in
// the export's shape (an irradiance atlas, three direction maps one a colour
// channel, a sky visibility), gathered over the fixture's ground from Hoth
// Sunny's own numbers, because Hoth's atlas (EN_Hoth_01_Static_Sunset_*,
// 3,128 × 3,680) is on the owner's desktop and not in the bucket yet (lane
// W's `atlases` job sends it). It is not the game's bake: it is the record's
// sky and sun gathered the way Enlighten gathers them, so the sampler, the
// directional decode and the calibration have something real-shaped to read.
//
// What it gathers, per texel of the ground (normal up), over cosine-weighted
// directions:
// - the sky: the record's own probe radiances (src/data/bf2017/light/hoth.json,
//   weathers.sunny.probe: zenith, horizon and ground in the record's units),
//   zenith to horizon by the sine of the elevation;
// - an occluder (the fixture's pillars, spheres and cube) in the way: its
//   bounce, the stone's albedo × (the open sky's irradiance + the record's
//   sun × SUN_SCALE on the side it faces) / π.
// Irradiance is in the record's units (lux, as SunIntensity); light/baked.js
// brings it to the site by lane S's gameToSite.
//
// The directions, per channel: the radiance-weighted mean incoming direction
// m (length ≤ 1), stored as 0.5 + 0.5 m, its alpha the rebalance
// 0.5 + 0.5 m·up, so the decode at the up normal gives the irradiance back
// (baked.js's directionalIrradiance).
//
// gatherTexel(x, z, scene, sky, n) → { irr: [r, g, b], dirs: [[x, y, z, w] × 3], sky: v }   (pure)
// fixtureScene() → { boxes, spheres }   (the lit fixture's ring, litWorld.js's numbers)
// skyRadiance(sky, dir) → [r, g, b]

export const SIZE = 256; // texels a side (the plan's 256² cut)
export const SPAN = 48; // m of ground the atlas covers, centred (the ring is 20 m across)
export const GROUND = 200; // m: the fixture's ground plane (litWorld.js)
export const SAMPLES = 128; // directions a texel
// the share of the sun Enlighten bounces (_source: the surfaces design, Hoth Sunny's EnlightenComponentData SunScale 0.5)
export const SUN_SCALE = 0.5;
// the fixture's stone (litWorld.js 0xd8d2c8), linear
export const STONE = [0.686, 0.644, 0.578];

// the ground's chart: the plane's uv1 (0…1 over GROUND, v up −z) into the atlas over SPAN
export const CHART = (() => {
  const s = GROUND / SPAN;
  const o = 0.5 - 0.5 * s;
  return [s, s, o, o];
})();

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function fixtureScene() {
  const boxes = [];
  const spheres = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const [px, pz] = [Math.cos(a) * 10, Math.sin(a) * 10];
    boxes.push({ min: [px - 0.5, 0, pz - 0.5], max: [px + 0.5, 5, pz + 0.5] });
    spheres.push({ c: [Math.cos(a + 0.26) * 5, 0.9, Math.sin(a + 0.26) * 5], r: 0.9 });
  }
  // the cube at rest (it turns in the fixture; its footprint is what shades)
  boxes.push({ min: [-1, 0.6, -1], max: [1, 2.6, 1] });
  return { boxes, spheres };
}

export function skyRadiance(sky, d) {
  if (d[1] < 0) return sky.ground;
  const t = d[1];
  return [0, 1, 2].map((c) => sky.horizon[c] + (sky.zenith[c] - sky.horizon[c]) * t);
}

function hitBox(o, d, b) {
  let t0 = 1e-4;
  let t1 = Infinity;
  let axis = -1;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) {
      if (o[k] < b.min[k] || o[k] > b.max[k]) return null;
      continue;
    }
    let a = (b.min[k] - o[k]) / d[k];
    let c = (b.max[k] - o[k]) / d[k];
    if (a > c) [a, c] = [c, a];
    if (a > t0) {
      t0 = a;
      axis = k;
    }
    t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  if (axis < 0) return null;
  const n = [0, 0, 0];
  n[axis] = d[axis] > 0 ? -1 : 1;
  return { t: t0, n };
}

function hitSphere(o, d, s) {
  const oc = [o[0] - s.c[0], o[1] - s.c[1], o[2] - s.c[2]];
  const b = dot(oc, d);
  const c = dot(oc, oc) - s.r * s.r;
  const h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  if (t <= 1e-4) return null;
  const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
  return { t, n: [(p[0] - s.c[0]) / s.r, (p[1] - s.c[1]) / s.r, (p[2] - s.c[2]) / s.r] };
}

// the nearest occluder along the ray, or null
function trace(o, d, scene) {
  let best = null;
  for (const b of scene.boxes) {
    const h = hitBox(o, d, b);
    if (h && (!best || h.t < best.t)) best = h;
  }
  for (const s of scene.spheres) {
    const h = hitSphere(o, d, s);
    if (h && (!best || h.t < best.t)) best = h;
  }
  return best;
}

// Hammersley's i-th of n, cosine-weighted about up
function cosineDir(i, n) {
  let bits = i;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  const u = (i + 0.5) / n;
  const v = bits / 4294967296;
  const r = Math.sqrt(u);
  const phi = 2 * Math.PI * v;
  return [r * Math.cos(phi), Math.sqrt(Math.max(0, 1 - u)), r * Math.sin(phi)];
}

// the open sky's irradiance on a surface of normal n (by the same samples, turned)
export function openIrradiance(sky, n = [0, 1, 0], samples = SAMPLES) {
  const e = [0, 0, 0];
  for (let i = 0; i < samples; i++) {
    const [x, y, z] = cosineDir(i, samples);
    // (about n: a frame with n as its up)
    const t = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const b1 = norm(cross(t, n));
    const b2 = cross(n, b1);
    const d = [b1[0] * x + n[0] * y + b2[0] * z, b1[1] * x + n[1] * y + b2[1] * z, b1[2] * x + n[2] * y + b2[2] * z];
    const L = skyRadiance(sky, d);
    for (let c = 0; c < 3; c++) e[c] += L[c];
  }
  // (cosine-weighted: E = π × the mean radiance)
  return e.map((v) => (Math.PI * v) / samples);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
};

// sky: { zenith, horizon, ground } (the record's probe), sun: { dir, lux }
export function gatherTexel(x, z, scene, sky, sun, samples = SAMPLES, ctx = {}) {
  const o = [x, 0.01, z];
  const open = ctx.open ?? openIrradiance(sky, [0, 1, 0], samples);
  const sum = [0, 0, 0];
  const dirSum = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let seen = 0;
  for (let i = 0; i < samples; i++) {
    const d = cosineDir(i, samples);
    const hit = trace(o, d, scene);
    let L;
    if (!hit) {
      L = skyRadiance(sky, d);
      seen++;
    } else {
      // the occluder's bounce: its albedo × (the open sky's irradiance and the record's sun on its face) / π
      const lit = SUN_SCALE * sun.lux * Math.max(0, dot(hit.n, sun.dir));
      const half = ctx.vertical ?? open.map((v) => v * 0.5);
      L = STONE.map((a, c) => (a * ((hit.n[1] > 0.5 ? open[c] : half[c]) + lit)) / Math.PI);
    }
    for (let c = 0; c < 3; c++) {
      sum[c] += L[c];
      for (let k = 0; k < 3; k++) dirSum[c][k] += L[c] * d[k];
    }
  }
  const irr = sum.map((v) => (Math.PI * v) / samples);
  const dirs = [0, 1, 2].map((c) => {
    const m = sum[c] > 0 ? dirSum[c].map((v) => v / sum[c]) : [0, 0, 0];
    return [0.5 + 0.5 * m[0], 0.5 + 0.5 * m[1], 0.5 + 0.5 * m[2], 0.5 + 0.5 * m[1]];
  });
  return { irr, dirs, sky: seen / samples };
}

// the world x, z of atlas texel (i, j) through the ground's chart (row j at v = (j + ½) / SIZE)
export function texelToWorld(i, j, size = SIZE, chart = CHART) {
  const a = [(i + 0.5) / size, (j + 0.5) / size];
  const u = (a[0] - chart[2]) / chart[0];
  const v = (a[1] - chart[3]) / chart[1];
  return [(u - 0.5) * GROUND, -(v - 0.5) * GROUND];
}
