// The lie of a world's land, in metres: its height at any (x, z) on the
// ground you've landed on (+y up, the landing spot near the middle). A site
// (sites.js) describes its ground as layers, summed: broad swells, dunes
// strung out along the wind, mesas with cliffs, rolling hills, sharp ridges,
// mountains rising round the horizon, channels carved for rivers of water
// or lava, islands out of the sea. Then flats: level ground where you land
// and where things are built (a pad, a homestead, a base), eased into the
// land round them.
//
// Pure (no three.js), so it's the same in a test as on the screen, and so
// that what you walk on is what's drawn: the ground mesh (ground.js) is a
// grid of these heights, fine where you can walk and stretched out beyond
// to the horizon, and heightAt reads the grid back, triangle by triangle,
// exactly as it's drawn.

import { fbm, noise2, ridged, smoothstep } from './noise';

// the walkable square: HALF metres each way from the middle; you're turned
// back at REACH
export const HALF = 640;
export const REACH = 590;
// how far the grid stretches beyond it, to the horizon
export const FAR = 9000;

// ── The layers ──

const LAYERS = {
  // broad rises and falls, ±height
  swell: (x, z, l, seed) => fbm(x / l.scale, z / l.scale, { octaves: 4, seed }) * l.height,
  // rolling hills, 0…height
  hills: (x, z, l, seed) => (fbm(x / l.scale, z / l.scale, { octaves: l.octaves ?? 5, seed }) * 0.5 + 0.5) * l.height,
  // dunes: crests across the wind, sharp on top, strung out along it; 0…height
  dunes: (x, z, l, seed) => {
    const a = l.wind ?? 0;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const u = x * c - z * s; // along the wind
    const v = x * s + z * c; // across it
    const crest = ridged(u / (l.scale * 2.6), v / l.scale, { octaves: 3, seed, gain: 0.45 });
    const where = smoothstep(-0.35, 0.35, fbm(x / (l.scale * 6), z / (l.scale * 6), { octaves: 2, seed: seed + 5 }));
    return crest ** 1.6 * l.height * (0.35 + 0.65 * where);
  },
  // flat-topped mesas with steep sides: 0…height where the noise is over `cover`
  mesas: (x, z, l, seed) => {
    const m = fbm(x / l.scale, z / l.scale, { octaves: 4, seed });
    const up = smoothstep(l.cover, l.cover + (l.cliff ?? 0.05), m);
    const ledge = smoothstep(l.cover - 0.12, l.cover - 0.06, m) * 0.18; // a step at the foot
    return (up * (1 + fbm(x / 40, z / 40, { octaves: 2, seed: seed + 3 }) * 0.04) + ledge * (1 - up)) * l.height;
  },
  // sharp ridges: 0…height
  ridges: (x, z, l, seed) => ridged(x / l.scale, z / l.scale, { octaves: l.octaves ?? 5, seed }) * l.height,
  // mountains round the horizon, rising from `from` metres out to their full height by `to`
  mountains: (x, z, l, seed) => {
    const r = Math.hypot(x, z);
    if (r < l.from) return 0;
    const k = smoothstep(l.from, l.to, r);
    return k * (0.3 + 0.7 * ridged(x / l.scale, z / l.scale, { octaves: 6, seed })) * l.height;
  },
  // rivers (of water, lava, salt): channels `depth` deep where the noise crosses zero
  channels: (x, z, l, seed) => {
    const n = fbm(x / l.scale, z / l.scale, { octaves: 3, seed });
    const wobble = noise2(x / 23, z / 23, seed + 9) * 0.012;
    return -(1 - smoothstep(0, l.width ?? 0.06, Math.abs(n + wobble))) * l.depth;
  },
  // an island (or a hill, or a crater with a negative height): `height` at
  // `at`, falling away to nothing by `r`, its edge broken up
  island: (x, z, l, seed) => {
    const [cx, cz] = l.at ?? [0, 0];
    const d = Math.hypot(x - cx, z - cz) * (1 + fbm(x / (l.r * 0.5), z / (l.r * 0.5), { octaves: 3, seed }) * (l.ragged ?? 0.35));
    return smoothstep(l.r, l.r * (l.core ?? 0.25), d) * l.height;
  },
  // a constant
  level: (x, z, l) => l.height,
};
export const LAYER_TYPES = Object.keys(LAYERS);

// The land's height, layers only (no flats)
export function makeRaw(ground) {
  const seed = ground.seed ?? 1;
  const layers = ground.layers ?? [];
  const base = ground.base ?? 0;
  return (x, z) => {
    let h = base;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      h += LAYERS[l.type](x, z, l, seed + i * 101);
    }
    return h;
  };
}

// A world's flats: each { at: [x, z], r, edge, h } (h: the height it's
// levelled to; left out, the land's own height at its middle)
export function levelled(raw, flats = []) {
  const pads = flats.map((f) => ({ x: f.at[0], z: f.at[1], r: f.r, edge: f.edge ?? Math.max(8, f.r * 0.6), h: f.h ?? raw(f.at[0], f.at[1]) }));
  if (!pads.length) return raw;
  return (x, z) => {
    let h = raw(x, z);
    for (const p of pads) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d >= p.r + p.edge) continue;
      const w = 1 - smoothstep(p.r, p.r + p.edge, d);
      h += (p.h - h) * w;
    }
    return h;
  };
}

// Pits dug into it: each { at: [x, z], r, depth, cone } (cone: sloping all
// the way to the middle, as the Sarlacc's; otherwise steep-sided with a
// flat floor, as the Lars homestead's courtyard); or { at, r, floor }: down
// to that height, whatever's there (a run of them, a canyon through a mesa)
export function dug(height, pits = []) {
  const holes = pits.map((p) => ({ x: p.at[0], z: p.at[1], r: p.r, depth: p.depth, cone: p.cone, floor: p.floor ?? height(p.at[0], p.at[1]) - p.depth }));
  if (!holes.length) return height;
  return (x, z) => {
    let h = height(x, z);
    for (const p of holes) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d >= p.r) continue;
      const w = p.cone ? (1 - d / p.r) ** 0.85 : 1 - smoothstep(p.r * 0.7, p.r, d);
      h = Math.min(h, h + (p.floor - h) * w);
    }
    return h;
  };
}

export const makeHeight = (ground) => dug(levelled(makeRaw(ground), ground.flats), ground.pits);

// ── The grid ──

// Where the grid's lines are along one axis: evenly every `cell` metres
// out to ±HALF, then each step `grow` times the one before, out to ±FAR.
export function gridLines(n, grow) {
  const cell = (2 * HALF) / n;
  const out = [];
  let step = cell;
  let at = HALF;
  while (at < FAR) {
    step *= grow;
    at = Math.min(FAR, at + step);
    out.push(at);
  }
  const inner = Array.from({ length: n + 1 }, (_, i) => -HALF + i * cell);
  return [...out.map((v) => -v).reverse(), ...inner, ...out];
}

// The heights on the grid, and the height anywhere inside it read back off
// its triangles. Each cell (i, j) to (i + 1, j + 1) is two triangles split
// from (i, j + 1) to (i + 1, j), as ground.js draws them.
export function heightGrid(height, { n = 256, grow = 1.08 } = {}) {
  const lines = gridLines(n, grow);
  const w = lines.length;
  const heights = new Float32Array(w * w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) heights[j * w + i] = height(lines[i], lines[j]);
  const first = lines.indexOf(-HALF);
  const cell = (2 * HALF) / n;
  const at = (i, j) => heights[j * w + i];
  // the line at or before v, and how far on to the next (0…1), held at the ends
  const span = (v) => {
    if (v <= lines[0]) return [0, 0];
    if (v >= lines[w - 1]) return [w - 2, 1];
    let lo = 0;
    let hi = w - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lines[mid] <= v) lo = mid;
      else hi = mid;
    }
    return [lo, (v - lines[lo]) / (lines[lo + 1] - lines[lo])];
  };
  // (the cells split corner to corner as the square's are)
  const far = (x, z) => {
    const [I, fx] = span(x);
    const [J, fz] = span(z);
    if (fx + fz <= 1) return at(I, J) + (at(I + 1, J) - at(I, J)) * fx + (at(I, J + 1) - at(I, J)) * fz;
    const h11 = at(I + 1, J + 1);
    return h11 + (at(I, J + 1) - h11) * (1 - fx) + (at(I + 1, J) - h11) * (1 - fz);
  };
  return {
    lines,
    heights,
    size: w,
    cell,
    // the drawn height at (x, z); outside the walkable square, read off the
    // grid's growing lines out to the horizon (cheap: the zones' rooms, far
    // out, ask every frame), held at its edge past them
    heightAt(x, z) {
      const gx = (x + HALF) / cell;
      const gz = (z + HALF) / cell;
      if (gx < 0 || gz < 0 || gx >= n || gz >= n) return far(x, z);
      const i = Math.floor(gx);
      const j = Math.floor(gz);
      const fx = gx - i;
      const fz = gz - j;
      const I = first + i;
      const J = first + j;
      if (fx + fz <= 1) return at(I, J) + (at(I + 1, J) - at(I, J)) * fx + (at(I, J + 1) - at(I, J)) * fz;
      const h11 = at(I + 1, J + 1);
      return h11 + (at(I, J + 1) - h11) * (1 - fx) + (at(I + 1, J) - h11) * (1 - fz);
    },
    // the ground's slope at (x, z): its normal, [nx, ny, nz]
    normalAt(x, z, e = 0.6) {
      const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
      const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
      const l = Math.hypot(dx, 2 * e, dz);
      return [-dx / l, (2 * e) / l, -dz / l];
    },
  };
}
