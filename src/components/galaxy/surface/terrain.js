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

import { LAYERS } from '../../../lib/land/layers.js';
import { flatten } from '../../../lib/land/flats.js';
import { fbm, noise2, smoothstep } from './noise';

// the walkable square: HALF metres each way from the middle; you're turned
// back at REACH
export const HALF = 640;
export const REACH = 590;
// how far the grid stretches beyond it, to the horizon
export const FAR = 9000;

// ── The layers (src/lib/land/layers.js, shared with the planets' land) ──

export const LAYER_TYPES = Object.keys(LAYERS);

// The fine relief ultra lays over the land (amounts.js's `relief`, 0…1):
// two more octaves than any layer goes to, small hollows and rises 6 to 12
// metres across and a hand's height (the grid at ultra is fine enough to
// draw them, a vertex every 2.5 m). A site may scale it (`ground.relief`:
// 0.5 for packed snow, 1.4 for broken lava). Under the flats it's levelled
// away with the rest, so pads and built ground stay flat.
const RELIEF = { metres: [12, 6], height: [0.26, 0.1] }; // (every wavelength ≥ 5 m: two cells or more of ultra's 2.5 m grid, so none shimmers)
const fineRelief = (x, z, seed) =>
  fbm(x / RELIEF.metres[0], z / RELIEF.metres[0], { octaves: 2, seed: seed + 977 }) * RELIEF.height[0] + noise2(x / RELIEF.metres[1], z / RELIEF.metres[1], seed + 991) * RELIEF.height[1];

// The land's height, layers only (no flats); with `relief`, the fine relief over it
export function makeRaw(ground, { relief = 0 } = {}) {
  const seed = ground.seed ?? 1;
  const layers = ground.layers ?? [];
  const base = ground.base ?? 0;
  const fine = relief * (ground.relief ?? 1);
  return (x, z) => {
    let h = base;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      h += LAYERS[l.type](x, z, l, seed + i * 101);
    }
    return fine ? h + fineRelief(x, z, seed) * fine : h;
  };
}

// A world's flats: each { at: [x, z], r, edge, h } (h: the height it's
// levelled to; left out, the land's own height at its middle). The body is
// lib/land/flats.js's, so the flight's planets level their POIs the same way
export const levelled = flatten;

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
      if (Math.abs(x - p.x) >= p.r || Math.abs(z - p.z) >= p.r) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d >= p.r) continue;
      const w = p.cone ? (1 - d / p.r) ** 0.85 : 1 - smoothstep(p.r * 0.7, p.r, d);
      h = Math.min(h, h + (p.floor - h) * w);
    }
    return h;
  };
}

export const makeHeight = (ground, { relief = 0 } = {}) => dug(levelled(makeRaw(ground, { relief }), ground.flats), ground.pits);

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
// from (i, j + 1) to (i + 1, j), as ground.js draws them. `centre` is where
// the grid lies (the origin; the free roam's moves it round you: roam.js),
// its `lines` round it and its `centre` kept, so the height at (x, z) is
// the world's wherever it lies.
export function heightGrid(height, { n = 256, grow = 1.08, centre = [0, 0] } = {}) {
  const build = gridBuild(height, { n, grow, centre });
  build.step(Infinity);
  return build.grid;
}

// The same grid sampled a few rows at a time: `step(ms)` samples rows till
// `ms` milliseconds have gone (Infinity: all of them) and says whether it's
// done; `grid` is the grid once it is (null till then), `progress` 0…1.
export function gridBuild(height, { n = 256, grow = 1.08, centre = [0, 0] } = {}) {
  const lines = gridLines(n, grow);
  const w = lines.length;
  const [cx, cz] = centre;
  const heights = new Float32Array(w * w);
  let row = 0;
  const build = {
    grid: null,
    get progress() {
      return row / w;
    },
    step(ms = Infinity) {
      const t0 = performance.now();
      while (row < w) {
        for (let i = 0; i < w; i++) heights[row * w + i] = height(cx + lines[i], cz + lines[row]);
        row++;
        if (performance.now() - t0 >= ms) break;
      }
      if (row >= w && !build.grid) build.grid = gridOf(lines, heights, n, centre);
      return Boolean(build.grid);
    },
  };
  return build;
}

function gridOf(lines, heights, n, centre) {
  const w = lines.length;
  const [cx, cz] = centre;
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
    centre: [cx, cz],
    // the drawn height at (x, z); outside the walkable square, read off the
    // grid's growing lines out to the horizon (cheap: the zones' rooms, far
    // out, ask every frame), held at its edge past them
    heightAt(x, z) {
      const lx = x - cx;
      const lz = z - cz;
      const gx = (lx + HALF) / cell;
      const gz = (lz + HALF) / cell;
      if (gx < 0 || gz < 0 || gx >= n || gz >= n) return far(lx, lz);
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
