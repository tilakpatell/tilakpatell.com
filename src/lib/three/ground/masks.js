// Where each of a terrain's paint layers lies, derived (lane Q2: docs/
// superpowers/specs/2026-10-10-bf2017-surfaces-design.md, "The ground").
// The game's own layer masks are in the streaming tree's undecoded section
// (web/maps/README.md, "Terrain scattering"), so until the desktop decodes
// them the masks are read from the ground itself: its slope, its height
// against the field round it, and how thickly the level places its meshes.
// One derivation for the ground's layers and lane N's scatter, so the grass
// and the snow agree on where the rock is: lane N imports maskOf.
//
// A world's rules (ground.json's `rules`, in order) each name a layer and
// soft ranges: `slope` in degrees, `height` in metres against the field (the
// mean of the ground within `fieldM` metres), `density` 'low', 'high' or
// 'any'. A null end is open. The first rule that holds claims a pixel, with
// a soft edge: rule i takes s_i × Π_{j<i}(1 − s_j), and the last layer
// takes what is left, so the layers sum to one everywhere.
//
// Pure: no three.js. Every array is the heightmap's size, row-major (z
// down the rows, x along them), in the frame { w, h, minX, minZ,
// metresPerPixel }.
//
//   slopeOf(heights, frame) → Float32Array (degrees)
//   fieldOf(heights, frame, radiusM) → Float32Array (metres: the mean round each pixel)
//   densityOf(points [x, z, …], frame, { radius, full }) → Float32Array (0…1)
//   masksOf(rules, { heights, slope?, field?, density?, frame, fieldM? }) → { [layer]: Float32Array }
//   maskOf(layer, { heights, slope?, field?, density?, frame, rules, fieldM? }) → Float32Array
//   softRange(x, [min, max], feather) → 0…1

// the soft edges of a rule's ranges: wide enough that the layers blend over
// a few metres rather than cut, narrow enough that a 30° rule means 30°
export const FEATHER = { slope: 4, height: 0.75, density: 0.15 };
// where density counts as 'high': half of `full` (a level's own apron, its
// dressing round a door, is several meshes a square metre)
export const DENSITY_HIGH = 0.5;
// metres: the field a pixel's height is measured against, when the world's
// ground.json does not say (a trench is a few tens of metres across)
export const FIELD_M = 64;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function softRange(x, range, feather) {
  if (!range) return 1;
  const [lo, hi] = range;
  const above = lo === null || lo === undefined ? 1 : smooth(lo - feather, lo + feather, x);
  const below = hi === null || hi === undefined ? 1 : 1 - smooth(hi - feather, hi + feather, x);
  return above * below;
}

export function slopeOf(heights, { w, h, metresPerPixel }) {
  const out = new Float32Array(w * h);
  const at = (x, z, c) => {
    if (x < 0 || z < 0 || x >= w || z >= h) return c;
    const v = heights[z * w + x];
    return Number.isNaN(v) ? c : v;
  };
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const c = heights[z * w + x];
      if (Number.isNaN(c)) continue;
      // (central differences; an edge or a hole beside reads as the centre,
      // so the side it lacks adds no slope)
      const l = at(x - 1, z, c);
      const r = at(x + 1, z, c);
      const u = at(x, z - 1, c);
      const d = at(x, z + 1, c);
      const sx = (x > 0 && x < w - 1 ? 2 : 1) * metresPerPixel;
      const sz = (z > 0 && z < h - 1 ? 2 : 1) * metresPerPixel;
      const gx = (r - l) / sx;
      const gz = (d - u) / sz;
      out[z * w + x] = (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI;
    }
  }
  return out;
}

// a box mean over (2r + 1)² pixels, holes left out (summed-area tables)
function boxMean(values, w, h, r) {
  const W = w + 1;
  const sum = new Float64Array(W * (h + 1));
  const cnt = new Float64Array(W * (h + 1));
  for (let z = 0; z < h; z++) {
    let rs = 0;
    let rc = 0;
    for (let x = 0; x < w; x++) {
      const v = values[z * w + x];
      if (!Number.isNaN(v)) {
        rs += v;
        rc++;
      }
      sum[(z + 1) * W + x + 1] = sum[z * W + x + 1] + rs;
      cnt[(z + 1) * W + x + 1] = cnt[z * W + x + 1] + rc;
    }
  }
  const out = new Float32Array(w * h);
  for (let z = 0; z < h; z++) {
    const z0 = Math.max(0, z - r);
    const z1 = Math.min(h, z + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const s = sum[z1 * W + x1] - sum[z0 * W + x1] - sum[z1 * W + x0] + sum[z0 * W + x0];
      const n = cnt[z1 * W + x1] - cnt[z0 * W + x1] - cnt[z1 * W + x0] + cnt[z0 * W + x0];
      out[z * w + x] = n ? s / n : NaN;
    }
  }
  return out;
}

export function fieldOf(heights, { w, h, metresPerPixel }, radiusM = FIELD_M) {
  return boxMean(heights, w, h, Math.max(1, Math.round(radiusM / metresPerPixel)));
}

// placed meshes a square metre within `radius` metres, over `full` (1 at or past it)
export function densityOf(points, { w, h, minX, minZ, metresPerPixel }, { radius = 8, full = 1 } = {}) {
  const counts = new Float32Array(w * h);
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = Math.floor((points[i] - minX) / metresPerPixel);
    const z = Math.floor((points[i + 1] - minZ) / metresPerPixel);
    if (x >= 0 && z >= 0 && x < w && z < h) counts[z * w + x]++;
  }
  const mean = boxMean(counts, w, h, Math.max(1, Math.round(radius / metresPerPixel)));
  const area = metresPerPixel * metresPerPixel;
  for (let i = 0; i < mean.length; i++) mean[i] = Math.min(1, mean[i] / area / full);
  return mean;
}

const DENSITY = { high: [DENSITY_HIGH, null], low: [null, DENSITY_HIGH] };

export function masksOf(rules, { heights, slope, field, density, frame, fieldM = FIELD_M }) {
  const n = frame.w * frame.h;
  const s = slope ?? slopeOf(heights, frame);
  const f = field ?? fieldOf(heights, frame, fieldM);
  const out = Object.fromEntries(rules.map((r) => [r.layer, new Float32Array(n)]));
  const last = rules.length - 1;
  for (let i = 0; i < n; i++) {
    const hRel = Number.isNaN(heights[i]) || Number.isNaN(f[i]) ? 0 : heights[i] - f[i];
    const d = density ? density[i] : 0;
    let left = 1;
    for (let k = 0; k <= last && left > 0; k++) {
      const r = rules[k];
      const want = r.density && r.density !== 'any' ? DENSITY[r.density] : null;
      const hold = k === last ? 1 : softRange(s[i], r.slope, FEATHER.slope) * softRange(hRel, r.height, FEATHER.height) * softRange(d, want, FEATHER.density);
      out[r.layer][i] += hold * left;
      left *= 1 - hold;
    }
  }
  return out;
}

export function maskOf(layer, ctx) {
  const m = masksOf(ctx.rules, ctx)[layer];
  if (!m) throw new Error(`no rule names the layer ${layer}`);
  return m;
}
