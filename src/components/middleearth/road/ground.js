// A stage’s ground, drawn: one indexed mesh over terrain.js’s land, fine
// near the road and coarse beyond, coloured by a ground map painted in its
// soil’s colours (stages/soils.js, groundmapNodes), its photo scans close
// up (soil.js), its grass standing round you (blades.js), under the
// house’s look.
//
//   createGround(land, { house, tier, soil, own, mounds, wind, paint, from, to }) → { mesh, groundMap, blades, update(x, z), dispose }
//     own: the stage’s `ground.paint`, over its soil’s colours
//     mounds: the stage’s `ground.mounds` (the Hill at Hobbiton): their
//       blades grow over them too, from a small map of their own
//     update(x, z): the camera, in the stage’s frame (the blades’ patch follows it)
//   groundJob(land, …): the same as a generator, a few rows a step (terrain.js’s run)
//   moundTop(heightAt, mound) → (x, z) → a mound’s surface there (−∞ off it),
//     its `.low` the lowest of the land round its foot; a mound is
//     { at: [x, z], r, squash, sink }: a dome `r` across, squashed by
//     `squash`, its foot `sink` under that lowest
//
// The near strip runs NEAR metres either side of the road’s widest reach at
// 1 m (2 m on low); the rest is a coarse grid at twice the land’s `res` (4 m;
// 8 m on low), which keeps a stage under 200,000 triangles on high where the
// plan’s `res` beyond would be near 400,000. Both read the land exactly
// (`field`). The strip’s outer columns take the coarse grid’s heights
// between its vertices, so the two meet with no crack. The mesh spans z from
// `from` to `to` in the stage’s frame, both rows exact, so neighbours abut
// at a seam.

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { createGroundMap } from '../../../lib/three/groundmapNodes';
import { noise2 } from '../../../lib/land/layers.js';
import { run } from './terrain';
import { soilHook } from './soil';
import { createBlades } from './blades';
import { boundsOf, distanceTo } from '../../../lib/land/paths.js';

export const NEAR = 60; // m either side of the road
const COARSE = 2; // the far grid takes every other sample

// The paint: the soil’s colours (stages/soils.js) by height and a slow
// noise, its rock where the land is steep, worn to its dirt on the road. A
// stage’s own (its `ground.paint`) gives its greens and its dirt as hex over
// the soil’s, and may lay snow over the land above a height: `snow: [foot,
// top]`, none under the foot, whole over the top, the line wandering with the
// noise, trodden grey on the road. Its paved places (the land's `bare`
// circles, a town's streets and yards) are its dirt with no grass. `out`
// takes the linear colour; the return is the grass, 0…1 (none on rock,
// road, paving or snow).
const C = (hex) => new THREE.Color(hex).toArray();
const GRASS = C(0x5c8f3a);
const DEEP = C(0x3d6e2b);
const SUN = C(0x93b54c);
const DIRT = C(0xb59d72);
const ROCK = C(0x8a8272);
const SNOW = C(0xf4f4f2);
const TRODDEN = C(0xb8bec8);
const BARE = C(0x5e6068); // (the rock through the snow)
const linear = (c) => (typeof c === 'number' ? C(c) : c);
const BARE_EDGE = 3; // m a stage's paved places ease into its grass over
export function paintFor(land, { greens = [DEEP, GRASS, SUN], dirt = DIRT, rock = ROCK, snow = null } = {}) {
  greens = greens.map(linear);
  dirt = linear(dirt);
  rock = linear(rock);
  // the road’s nearness, gridded at 1 m over its bounds once rather than
  // searched at every texel
  const reach = 6;
  const { x0, x1, z0, z1 } = boundsOf(land.road);
  const gx = x0 - reach;
  const gz = z0 - reach;
  const cols = Math.ceil(x1 - x0 + 2 * reach) + 1;
  const rows = Math.ceil(z1 - z0 + 2 * reach) + 1;
  const near = new Float32Array(cols * rows);
  const off = distanceTo(land.road);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) near[j * cols + i] = off(gx + i, gz + j);
  const dAt = (x, z) => {
    const i = Math.round(x - gx);
    const j = Math.round(z - gz);
    return i < 0 || i >= cols || j < 0 || j >= rows ? Infinity : near[j * cols + i];
  };
  const mix = (o, a, b, t) => {
    o[0] = a[0] + (b[0] - a[0]) * t;
    o[1] = a[1] + (b[1] - a[1]) * t;
    o[2] = a[2] + (b[2] - a[2]) * t;
  };
  const white = [0, 0, 0];
  const bare = land.bare ?? [];
  const bareAt = (x, z) => {
    let k = 0;
    for (const b of bare) {
      const f = Math.hypot(x - b.at[0], z - b.at[1]);
      if (f < b.r + BARE_EDGE) k = Math.max(k, Math.min(1, (b.r + BARE_EDGE - f) / BARE_EDGE));
    }
    return k;
  };
  return (x, z, out) => {
    const h = land.heightAt(x, z);
    const n = noise2(x / 37, z / 37, 3) * 0.5 + noise2(x / 9, z / 9, 5) * 0.25;
    const t = Math.min(1, Math.max(0, 0.5 + h / 24 + n));
    if (t < 0.5) mix(out, greens[0], greens[1], t * 2);
    else mix(out, greens[1], greens[2], (t - 0.5) * 2);
    // the slope over a metre each way: rock showing through where it’s steep
    const sx = land.heightAt(x + 1, z) - land.heightAt(x - 1, z);
    const sz = land.heightAt(x, z + 1) - land.heightAt(x, z - 1);
    const steep = Math.min(1, Math.max(0, (Math.hypot(sx, sz) / 2 - 0.55 + noise2(x / 7, z / 7, 4) * 0.2) / 0.35));
    if (steep > 0) mix(out, out, rock, steep);
    let grass = 1 - steep;
    // (a paved place, a town's streets and yards: its dirt, and no grass, its edge eased over BARE_EDGE)
    const paved = bareAt(x, z);
    if (paved) {
      mix(out, out, dirt, paved);
      grass *= 1 - paved;
    }
    const d = dAt(x, z);
    const worn = d < 2.8 ? Math.min(1, (2.8 - d) / 1.2) * (0.85 + noise2(x / 3, z / 3, 9) * 0.15) : 0;
    if (worn) {
      mix(out, out, dirt, worn);
      grass = Math.min(grass, 1 - worn);
    }
    if (!snow) return grass;
    const k = Math.min(1, Math.max(0, (h - snow[0]) / (snow[1] - snow[0]) + n * 0.5));
    // (none holds on a face steeper than about 40°: the rock shows through, the snow in its ledges)
    const slope = (Math.abs(land.heightAt(x + 2, z) - land.heightAt(x - 2, z)) + Math.abs(land.heightAt(x, z + 2) - land.heightAt(x, z - 2))) / 4;
    const bare = Math.min(1, Math.max(0, (slope - 0.8) / 0.5));
    if (bare) mix(out, out, BARE, bare * (0.8 + n * 0.2));
    const lie = k * k * (3 - 2 * k) * (1 - bare * 0.85);
    if (lie) {
      mix(white, SNOW, TRODDEN, worn);
      mix(out, out, white, lie);
    }
    return grass * (1 - lie) * (1 - bare);
  };
}

export function* geometryJob(land, { tier = 'high', from = land.z0, to = land.z0 + land.d } = {}) {
  const { res, x0, field } = land;
  const fine = tier === 'low' ? 2 : 1;
  const big = res * COARSE;
  // the coarse grid: columns `big` apart across the land; rows `big` apart
  // between `from` and `to`, those two exactly (the seams)
  const nci = Math.floor(land.w / big) + 1;
  const xs = Array.from({ length: nci }, (_, i) => x0 + i * big);
  const zs = [from];
  for (let z = Math.ceil(from / big + 1e-6) * big; z < to - 1e-6; z += big) zs.push(z);
  zs.push(to);
  // the strip: the road’s reach in x, out to the coarse columns either side
  let rx0 = Infinity;
  let rx1 = -Infinity;
  for (let m = 0; m <= land.road.length; m += 4) {
    const x = land.road.pointAt(m).x;
    rx0 = Math.min(rx0, x);
    rx1 = Math.max(rx1, x);
  }
  const iA = Math.max(0, Math.floor((rx0 - NEAR - x0) / big));
  const iB = Math.min(nci - 1, Math.ceil((rx1 + NEAR - x0) / big));
  const pos = [];
  const idx = [];
  // the coarse grid, from the land exactly, its cells inside the strip left out
  const hs = new Float32Array(zs.length * nci);
  for (let j = 0; j < zs.length; j++) {
    for (let i = 0; i < nci; i++) {
      const y = field(xs[i], zs[j]);
      hs[j * nci + i] = y;
      pos.push(xs[i], y, zs[j]);
    }
    yield;
  }
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < nci - 1; i++) {
      if (i >= iA && i < iB) continue;
      const a = j * nci + i;
      idx.push(a, a + nci, a + 1, a + 1, a + nci, a + nci + 1);
    }
  // the strip, `fine` apart, between the coarse columns iA and iB; its outer
  // columns on the coarse edges, so the two meet with no crack
  const sx0 = xs[iA];
  const nx = Math.round((xs[iB] - sx0) / fine);
  const rowsZ = [];
  for (let z = from; z < to - 1e-6; z += fine) rowsZ.push(z);
  rowsZ.push(to);
  const start = pos.length / 3;
  let j = 0;
  for (const z of rowsZ) {
    while (j < zs.length - 2 && zs[j + 1] <= z) j++;
    const k = (z - zs[j]) / (zs[j + 1] - zs[j]);
    const edge = (i) => hs[j * nci + i] + (hs[(j + 1) * nci + i] - hs[j * nci + i]) * k;
    for (let a = 0; a <= nx; a++) {
      const x = sx0 + a * fine;
      pos.push(x, a === 0 ? edge(iA) : a === nx ? edge(iB) : field(x, z), z);
    }
    yield;
  }
  for (let b = 0; b < rowsZ.length - 1; b++)
    for (let a = 0; a < nx; a++) {
      const p = start + b * (nx + 1) + a;
      idx.push(p, p + nx + 1, p + 1, p + 1, p + nx + 1, p + nx + 2);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// the ground map’s colours, a row of texels a step, as createGroundMap lays
// them out (a texel’s middle), then read back by createGroundMap’s own loop
function* paintJob(area, size, paint) {
  const px = new Float32Array(size * size * 4);
  const out = [0, 0, 0];
  for (let j = 0; j < size; j++) {
    const z = area.z0 + ((j + 0.5) / size) * area.d;
    for (let i = 0; i < size; i++) {
      out[0] = out[1] = out[2] = 0;
      const g = paint(area.x0 + ((i + 0.5) / size) * area.w, z, out);
      px.set([out[0], out[1], out[2], g ?? 1], (j * size + i) * 4);
    }
    if (j % 8 === 7) yield;
  }
  return (x, z, o) => {
    const i = Math.round(((x - area.x0) / area.w) * size - 0.5);
    const j = Math.round(((z - area.z0) / area.d) * size - 0.5);
    const k = (j * size + i) * 4;
    o[0] = px[k];
    o[1] = px[k + 1];
    o[2] = px[k + 2];
    return px[k + 3];
  };
}

export function createGround(land, opts = {}) {
  return run(groundJob(land, opts));
}

// the land’s heights over the area, `size` a side, a few rows a step, for
// the blades to stand on (read back as createGroundMap lays its texels)
function* heightJob(land, area, size) {
  const hs = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    const z = area.z0 + ((j + 0.5) / size) * area.d;
    // (the land’s samples, bilinear: the field exactly would be its noise a quarter of a million times; a little under, so no blade stands off the ground)
    for (let i = 0; i < size; i++) hs[j * size + i] = land.heightAt(area.x0 + ((i + 0.5) / size) * area.w, z) - 0.04;
    if (j % 16 === 15) yield;
  }
  return (x, z) => {
    const i = Math.round(((x - area.x0) / area.w) * size - 0.5);
    const j = Math.round(((z - area.z0) / area.d) * size - 0.5);
    return hs[j * size + i];
  };
}

export function moundTop(heightAt, { at: [cx, cz], r, squash = 1, sink = 0 }) {
  let low = Infinity;
  for (let a = 0; a < 16; a++) low = Math.min(low, heightAt(cx + Math.cos(a / 2.55) * r, cz + Math.sin(a / 2.55) * r));
  const top = (x, z) => {
    const d2 = ((x - cx) ** 2 + (z - cz) ** 2) / (r * r);
    return d2 < 1 ? low - sink + r * squash * Math.sqrt(1 - d2) : -Infinity;
  };
  top.low = low;
  return top;
}

// the blades over a stage’s mounds: a map of their own over their bounds,
// fine enough for a dome’s sides (a third of a metre), grass on them short
// of their foot (where the dome rises too steeply for a texel to follow),
// the soil’s mid green, the heights a little under the turf’s facets
const MOUND = { texel: 0.32, foot: 0.6, under: 0.12 };
function moundBlades(land, mounds, colour, { wind, soil, tier }) {
  const tops = mounds.map((m) => ({ m, top: moundTop(land.heightAt, m) }));
  const x0 = Math.min(...mounds.map((m) => m.at[0] - m.r)) - 2;
  const z0 = Math.min(...mounds.map((m) => m.at[1] - m.r)) - 2;
  const w = Math.max(...mounds.map((m) => m.at[0] + m.r)) + 2 - x0;
  const d = Math.max(...mounds.map((m) => m.at[1] + m.r)) + 2 - z0;
  const size = Math.min(256, Math.ceil(Math.max(w, d) / MOUND.texel));
  const c = linear(colour);
  const on = (x, z) => tops.some(({ m }) => Math.hypot(x - m.at[0], z - m.at[1]) < m.r - MOUND.foot);
  const groundMap = createGroundMap({
    area: { x0, z0, w, d },
    size,
    heightSize: size,
    paint: (x, z, out) => {
      out[0] = c[0];
      out[1] = c[1];
      out[2] = c[2];
      return on(x, z) ? 1 : 0;
    },
    height: (x, z) => Math.max(land.heightAt(x, z), ...tops.map(({ top }) => top(x, z))) - MOUND.under,
  });
  const blades = createBlades({ groundMap, wind, soil, tier });
  if (!blades) {
    groundMap.dispose();
    return null;
  }
  return {
    ...blades,
    dispose() {
      blades.dispose();
      groundMap.dispose();
    },
  };
}

export function* groundJob(land, { house = null, tier = 'high', soil = null, own = null, mounds = null, wind = null, paint = null, from, to } = {}) {
  const geometry = yield* geometryJob(land, { tier, from, to });
  const area = { x0: land.x0, z0: land.z0, w: land.w, d: land.d };
  const size = tier === 'low' ? 512 : 1024;
  const colours = { ...(soil ? { greens: soil.greens, dirt: soil.dirt, rock: soil.rock } : {}), ...(own ?? {}) };
  const painted = yield* paintJob(area, size, paint ?? paintFor(land, colours));
  // (heights only where blades will stand on them)
  const grows = Boolean(wind && soil?.blades > 0 && tier !== 'low');
  const heightSize = 512;
  const height = grows ? yield* heightJob(land, area, heightSize) : null;
  const groundMap = createGroundMap({ area, size, paint: painted, heightSize, height });
  yield;
  const raw = house ? house.material({ color: 0xffffff }) : new MeshLambertNodeMaterial({ color: 0xffffff });
  const material = soilHook(raw, { groundMap, soil, tier });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = tier !== 'low';
  mesh.name = 'road:ground';
  const field = grows ? createBlades({ groundMap, wind, soil, tier }) : null;
  const hills = field && mounds?.length ? moundBlades(land, mounds, colours.greens?.[1] ?? GRASS, { wind, soil, tier }) : null;
  // (one patch, or the field’s and the mounds’ together: a group the lands show and hide as one)
  let blades = field;
  if (hills) {
    const mesh = new THREE.Group();
    mesh.name = 'road:blades';
    mesh.add(field.mesh, hills.mesh);
    blades = {
      mesh,
      update(x, z) {
        field.update(x, z);
        hills.update(x, z);
      },
      dispose() {
        field.dispose();
        hills.dispose();
      },
    };
  }
  return {
    mesh,
    groundMap,
    blades,
    update(x, z) {
      blades?.update(x, z);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      if (raw !== material) raw.dispose();
      blades?.dispose();
      groundMap.dispose();
    },
  };
}
