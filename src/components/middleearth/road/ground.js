// A stage’s ground, drawn: one indexed mesh over terrain.js’s land, fine
// near the road and coarse beyond, coloured by a ground map the stage paints
// (groundmapNodes) under the house’s look.
//
//   createGround(land, { house, tier, paint, from, to }) → { mesh, groundMap, update(camera), dispose }
//   groundJob(land, …): the same as a generator, a few rows a step (terrain.js’s run)
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
import { boundsOf, distanceTo } from '../../../lib/land/paths.js';

export const NEAR = 60; // m either side of the road
const COARSE = 2; // the far grid takes every other sample

// The default paint until a stage writes its own: grass by height and a
// slow noise, worn to dirt on the road, mud where the land dips under its
// neighbours. `out` takes the linear colour; the return is the grass, 0…1.
const C = (hex) => new THREE.Color(hex).toArray();
const GRASS = C(0x5c8f3a);
const DEEP = C(0x3d6e2b);
const SUN = C(0x93b54c);
const DIRT = C(0xb59d72);
export function paintFor(land, { greens = [DEEP, GRASS, SUN], dirt = DIRT } = {}) {
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
  return (x, z, out) => {
    const h = land.heightAt(x, z);
    const n = noise2(x / 37, z / 37, 3) * 0.5 + noise2(x / 9, z / 9, 5) * 0.25;
    const t = Math.min(1, Math.max(0, 0.5 + h / 24 + n));
    if (t < 0.5) mix(out, greens[0], greens[1], t * 2);
    else mix(out, greens[1], greens[2], (t - 0.5) * 2);
    const d = dAt(x, z);
    if (d < 2.8) {
      const worn = Math.min(1, (2.8 - d) / 1.2) * (0.85 + noise2(x / 3, z / 3, 9) * 0.15);
      mix(out, out, dirt, worn);
      return 1 - worn;
    }
    return 1;
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

// the ground map's colours, a row of texels a step, as createGroundMap lays
// them out (a texel's middle), then read back by createGroundMap's own loop
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

export function* groundJob(land, { house = null, tier = 'high', paint = null, from, to } = {}) {
  const geometry = yield* geometryJob(land, { tier, from, to });
  const area = { x0: land.x0, z0: land.z0, w: land.w, d: land.d };
  const size = tier === 'low' ? 512 : 1024;
  const painted = yield* paintJob(area, size, paint ?? paintFor(land));
  const groundMap = createGroundMap({ area, size, paint: painted });
  yield;
  const raw = house ? house.material({ color: 0xffffff }) : new MeshLambertNodeMaterial({ color: 0xffffff });
  const material = groundMap.paint(raw);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = tier !== 'low';
  mesh.name = 'road:ground';
  return {
    mesh,
    groundMap,
    // (the grounding pass of groundworkNodes follows the walkers here once a
    // stage has props worth grounding: none has yet)
    update() {},
    dispose() {
      geometry.dispose();
      material.dispose();
      if (raw !== material) raw.dispose();
      groundMap.dispose();
    },
  };
}
