// The grounds’ ground, drawn: one ground map over the whole of it (lib/three
// /groundmapNodes: its colours painted once from the baked land, land.js;
// its heights for the blades, the lake’s shallows and the house’s bounce),
// a cover map beside it (forest, moor, the worn ways, the strand: which
// photo scan a point wears), and two kinds of mesh over the field:
//
//   the far ground  one mesh out to the far hills (SKIRT), FAR_STEP metres a
//                   cell over the ground and coarser past it, always drawn;
//                   where a near cell is built its vertices sink out of the
//                   way (`near(rects)`), the cell’s border on the far
//                   ground’s own heights, so the two meet with no crack
//   a near cell     CELL metres square, NEAR_STEP a vertex, the field
//                   exactly inside it (cells.js builds three round you)
//
// The material is the house’s Lambert painted by the map, with the scans
// close up (the soils’ way, middleearth/road/soil.js: grass on the lawns,
// the needles under the forest, gravel on the ways and the strand, rock
// where it is steep, each at two sizes, fading with distance), snow lying
// on what is level when the winter comes (`snow`), darker in the rain.
//
//   CELL, FAR_STEP, NEAR_STEP
//   paintFor(land) → (x, z, out) → grass: the ground map’s paint (pure)
//   createGroundMaps(land, { tier }) → { groundMap, coverMap, dispose }   (a job: groundMapsJob)
//   createGroundMaterial({ house, groundMap, coverMap, tier, sink }) → { material, uniforms: { uSnow, uWet, uRects }, near(rects), dispose }
//   farGeometry(land, { tier }) → BufferGeometry
//   cellJob(land, i, j, { tier }) → a generator returning the cell’s BufferGeometry

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { abs, cameraPosition, cameraViewMatrix, dot, float, length, mat2, mix, normalWorldGeometry, normalize, positionLocal, positionWorld, pow, select, sin, smoothstep, texture, uniform, uniformArray, vec2, vec3, vec4 } from 'three/tsl';
import { createGroundMap } from '../../../lib/three/groundmapNodes';
import { loadScan, scanOf } from '../../../lib/three/scansNodes';
import { onColor, onNormal, onPosition } from '../../../lib/three/hookNodes';
import { HALF, LAKE, SKIRT, noise2 } from './terrain';

export const CELL = 200; // m
export const FAR_STEP = { low: 20, mid: 10, high: 10, ultra: 10 };
export const NEAR_STEP = { low: 4, mid: 2, high: 2, ultra: 1 };
const SINK = 40; // m a far vertex under a built cell drops

const C = (hex) => new THREE.Color(hex).toArray(); // linear
const LAWN = [C(0x34482a), C(0x4c6a30), C(0x6e8a40)];
const FOREST = C(0x2e2e1e);
const NEEDLES = C(0x4a3a26);
const HEATHER = [C(0x5a3c4c), C(0x7a5266)];
const BRACKEN = C(0x7a5a30);
const MOORGRASS = C(0x6a6640);
const ROCK = C(0x6e6a62);
const SHINGLE = C(0x7a7266);
const WET = C(0x4a453c);
const SILT = C(0x2e2a20);
const DIRT = C(0x7c6a4c);

const mixTo = (o, a, b, t) => {
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
};
const clamp01 = (x) => (x > 0 ? (x < 1 ? x : 1) : 0);

// The ground’s colour at a point and how much grass stands there. The
// lawns three greens by a slow noise; the forest’s floor dark under the
// pines, brown with needles; the moor heather in its late purple with
// bracken and moor grass through it; rock grey where it is steep; the
// strand shingle, wet and dark at the water; the bed silt under the lake;
// the worn ways bare earth.
export function paintFor(land) {
  const cv = {};
  return (x, z, out) => {
    const h = land.heightAt(x, z);
    land.coverAt(x, z, cv);
    const n = noise2(x / 41, z / 41, 3) * 0.5 + noise2(x / 9, z / 9, 7) * 0.25;
    // the lawn
    const t = clamp01(0.5 + n + (h - 20) / 90);
    if (t < 0.5) mixTo(out, LAWN[0], LAWN[1], t * 2);
    else mixTo(out, LAWN[1], LAWN[2], (t - 0.5) * 2);
    let grass = 1;
    // the forest’s floor
    if (cv.forest > 0) {
      const floor = [0, 0, 0];
      mixTo(floor, FOREST, NEEDLES, clamp01(0.5 + n * 1.4));
      mixTo(out, out, floor, cv.forest);
      grass -= cv.forest * 0.75;
    }
    // the moor
    if (cv.moor > 0) {
      const m = [0, 0, 0];
      const k = noise2(x / 23, z / 23, 11);
      mixTo(m, HEATHER[0], HEATHER[1], clamp01(0.5 + k));
      if (k < -0.15) mixTo(m, m, BRACKEN, clamp01((-0.15 - k) * 3));
      if (k > 0.35) mixTo(m, m, MOORGRASS, clamp01((k - 0.35) * 3));
      mixTo(out, out, m, cv.moor);
      grass -= cv.moor * 0.35;
    }
    if (cv.rock > 0) {
      mixTo(out, out, ROCK, cv.rock);
      grass -= cv.rock;
    }
    // the strand, the water’s edge and the bed
    if (h < 2.5) {
      const s = clamp01((2.5 - h) / 2.2) * clamp01(1 - land.shoreAt(x, z) / 30);
      mixTo(out, out, SHINGLE, s);
      grass -= s;
      if (h < 0.6) mixTo(out, out, WET, clamp01((0.6 - h) / 0.8));
      if (h < LAKE) mixTo(out, out, SILT, clamp01(-h / 3));
    }
    // the worn ways
    const d = land.pathAt(x, z);
    if (d < 1.2) {
      const worn = clamp01((1.2 - d) / 1.4) * (0.85 + noise2(x / 3, z / 3, 13) * 0.15);
      mixTo(out, out, DIRT, worn);
      grass -= worn;
    }
    return clamp01(grass);
  };
}

// the cover map’s texel: forest, moor, the ways, the strand (0…255 each)
function coverOf(land, x, z, cv) {
  land.coverAt(x, z, cv);
  const h = land.heightAt(x, z);
  const way = clamp01((1.2 - land.pathAt(x, z)) / 1.4);
  const strand = h < 2.5 ? clamp01((2.5 - h) / 2.2) : 0;
  return [cv.forest, cv.moor, Math.max(way, strand), cv.rock];
}

const AREA = { x0: -HALF, z0: -HALF, w: 2 * HALF, d: 2 * HALF };

export function createGroundMaps(land, { tier = 'high' } = {}) {
  const size = tier === 'low' ? 512 : 1024;
  const groundMap = createGroundMap({ area: { ...AREA }, size, heightSize: 512, paint: paintFor(land), height: (x, z) => land.heightAt(x, z) });
  const cs = 512;
  const px = new Uint8Array(cs * cs * 4);
  const cv = {};
  for (let j = 0; j < cs; j++) {
    const z = AREA.z0 + ((j + 0.5) / cs) * AREA.d;
    for (let i = 0; i < cs; i++) {
      const x = AREA.x0 + ((i + 0.5) / cs) * AREA.w;
      const c = coverOf(land, x, z, cv);
      const k = (j * cs + i) * 4;
      for (let q = 0; q < 4; q++) px[k + q] = Math.round(clamp01(c[q]) * 255);
    }
  }
  const coverMap = new THREE.DataTexture(px, cs, cs, THREE.RGBAFormat, THREE.UnsignedByteType);
  coverMap.wrapS = coverMap.wrapT = THREE.ClampToEdgeWrapping;
  coverMap.magFilter = THREE.LinearFilter;
  coverMap.minFilter = THREE.LinearFilter;
  coverMap.needsUpdate = true;
  return {
    groundMap,
    coverMap,
    dispose() {
      groundMap.dispose();
      coverMap.dispose();
    },
  };
}

const blank = (r, g, b) => {
  const t = new THREE.DataTexture(Uint8Array.from([r, g, b, 255]), 1, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
};
const ROLES = { grass: 'grass', floor: 'needles', way: 'gravel', steep: 'rock' };
const NEAR = 26; // m: the scans whole to here
const FAR = 140; // m: gone by here
const TURN = mat2(0.8, -0.6, 0.6, 0.8);
const LUMA = vec3(0.2126, 0.7152, 0.0722);
const HUE = 0.3;

export function createGroundMaterial({ house = null, groundMap, coverMap, tier = 'high', sink = false }) {
  const raw = house ? house.material({ color: 0xffffff }) : new MeshLambertNodeMaterial({ color: 0xffffff });
  const m = raw;
  const uSnow = uniform(0);
  const uWet = uniform(0);
  const uCover = texture(coverMap);
  const rect = { x0: AREA.x0, z0: AREA.z0, w: AREA.w, d: AREA.d };
  const coverAt = (xz) => uCover.sample(xz.sub(vec2(rect.x0, rect.z0)).div(vec2(rect.w, rect.d)).clamp(0, 1));
  const nodes = { ...groundMap.uniforms, uCover, uSnow, uWet };

  // the far ground: under a built near cell, its vertices dropped out of the way
  const rects = uniformArray([new THREE.Vector4(1e9, 1e9, 1e9, 1e9), new THREE.Vector4(1e9, 1e9, 1e9, 1e9), new THREE.Vector4(1e9, 1e9, 1e9, 1e9), new THREE.Vector4(1e9, 1e9, 1e9, 1e9)], 'vec4');
  if (sink)
    onPosition(
      m,
      (p) => {
        let drop = float(0);
        for (let i = 0; i < 4; i++) {
          const r = rects.element(i);
          // (strictly inside: a vertex on the border keeps its height, so the cell meets it)
          const inside = p.x.greaterThan(r.x.add(0.01)).and(p.x.lessThan(r.z.sub(0.01))).and(p.z.greaterThan(r.y.add(0.01))).and(p.z.lessThan(r.w.sub(0.01)));
          drop = select(inside, float(SINK), drop);
        }
        return vec3(p.x, p.y.sub(drop), p.z);
      },
      'grounds:sink',
      { rects },
    );

  const scans = tier !== 'low';
  const u = {};
  if (scans)
    for (const [key, role] of Object.entries(ROLES)) {
      u[key] = { map: texture(blank(146, 146, 146)), normal: texture(blank(128, 128, 255)), k: uniform(new THREE.Vector3(0.5, 0.573, 0)) };
      const row = scanOf(role);
      if (!row) continue;
      loadScan(role).then((got) => {
        if (!got) return;
        u[key].map.value = got.map;
        if (got.normalMap) u[key].normal.value = got.normalMap;
        u[key].k.value.set(1 / (row.metres ?? 2), Math.pow(row.mean ?? 0.8, 2.2), got.normalMap ? 1 : 0);
      });
      Object.assign(nodes, { [`${key}Map`]: u[key].map, [`${key}N`]: u[key].normal, [`${key}K`]: u[key].k });
    }
  const near = () => smoothstep(NEAR, FAR, length(positionWorld.sub(cameraPosition))).oneMinus();
  const steepOf = () => smoothstep(0.3, 0.55, normalize(normalWorldGeometry).y.oneMinus());
  const flat = (key, xz) => {
    const { map, k } = u[key];
    const a = map.sample(xz.mul(k.x)).rgb;
    const b = map.sample(TURN.mul(xz).mul(k.x.mul(0.37))).rgb;
    const s = mix(a, a.mul(b).div(k.y.max(0.05)), 0.5).div(k.y.max(0.05));
    return mix(vec3(dot(s, LUMA)), s, HUE);
  };
  const tri = (key, p) => {
    const { map, k } = u[key];
    const w = pow(abs(normalize(normalWorldGeometry)), vec3(4)).toVar();
    w.divAssign(w.x.add(w.y).add(w.z));
    const q = p.mul(k.x);
    const s = map.sample(q.zy).rgb.mul(w.x).add(map.sample(q.xz).rgb.mul(w.y)).add(map.sample(q.xy).rgb.mul(w.z)).div(k.y.max(0.05));
    return mix(vec3(dot(s, LUMA)), s, HUE);
  };

  onColor(
    m,
    (d) => {
      const xz = positionWorld.xz;
      let c = d.rgb.mul(groundMap.groundColour(xz));
      if (scans) {
        const cv = coverAt(xz);
        const detail = flat('grass', xz).toVar();
        detail.assign(mix(detail, flat('floor', xz), smoothstep(0.3, 0.8, cv.x)));
        detail.assign(mix(detail, flat('way', xz), smoothstep(0.2, 0.7, cv.z)));
        const rocky = steepOf().max(cv.w.mul(0.8));
        detail.assign(mix(detail, tri('steep', positionWorld), rocky));
        c = c.mul(mix(vec3(1), detail, near().mul(0.85)));
        // (a cliff seen from across the water: the rock’s scan at seven times its size, never faded,
        // and its strata, so a crag reads as rock at any distance and not as a grey slope)
        const big = tri('steep', positionWorld.mul(0.14));
        const strata = sin(positionWorld.y.mul(0.85).add(big.x.mul(3))).mul(0.12).add(1);
        c = c.mul(mix(vec3(1), big.mul(strata).mul(1.05), rocky.mul(0.85)));
      }
      // the wet: darker; the snow: lying on what is level and above the water, thin where it is steep
      c = c.mul(mix(float(1), float(0.78), uWet));
      const level = smoothstep(0.72, 0.9, normalize(normalWorldGeometry).y);
      const dry = smoothstep(0.2, 0.9, positionWorld.y);
      const drift = smoothstep(-0.4, 0.5, groundMap.groundGrass(xz).add(level).sub(0.6));
      return mix(c, vec3(0.82, 0.85, 0.9), uSnow.mul(level).mul(dry).mul(drift.mul(0.5).add(0.5)));
    },
    'grounds:soil',
    nodes,
  );
  if (scans)
    onNormal(
      m,
      (normal) => {
        const xz = positionWorld.xz;
        const cv = coverAt(xz);
        const read = (key) => u[key].normal.sample(xz.mul(u[key].k.x)).xyz.mul(2).sub(1).mul(u[key].k.z);
        const t = mix(mix(read('grass'), read('floor'), smoothstep(0.3, 0.8, cv.x)), read('way'), smoothstep(0.2, 0.7, cv.z));
        const k = near().mul(near()).mul(steepOf().oneMinus()).mul(0.5).mul(uSnow.oneMinus());
        return normalize(normal.add(cameraViewMatrix.mul(vec4(t.x.mul(k), 0, t.y.mul(k), 0)).xyz));
      },
      'grounds:relief',
      nodes,
    );
  void positionLocal;
  return {
    material: m,
    uniforms: { uSnow, uWet },
    // the near cells’ rects [x0, z0, x1, z1], up to four
    near(list) {
      for (let i = 0; i < 4; i++) {
        const r = list[i];
        rects.array[i].set(...(r ?? [1e9, 1e9, 1e9, 1e9]));
      }
    },
    dispose() {
      m.dispose();
    },
  };
}

// the far ground’s grid lines along an axis: FAR_STEP apart over the ground,
// coarser out to the skirt, every line a cell’s border falls on among them
function farLines(step) {
  const out = [];
  for (let v = -SKIRT; v < -HALF; v += 100) out.push(v);
  for (let v = -HALF; v <= HALF + 1e-6; v += step) out.push(Math.round(v * 1000) / 1000);
  for (let v = HALF + 100; v <= SKIRT + 1e-6; v += 100) out.push(v);
  if (out[out.length - 1] < SKIRT) out.push(SKIRT);
  return out;
}

export function farGeometry(land, { tier = 'high' } = {}) {
  const lines = farLines(FAR_STEP[tier] ?? 10);
  const n = lines.length;
  const pos = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = (j * n + i) * 3;
      pos[k] = lines[i];
      pos[k + 1] = land.heightAt(lines[i], lines[j]);
      pos[k + 2] = lines[j];
    }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let q = 0;
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      idx[q++] = a;
      idx[q++] = a + n;
      idx[q++] = a + 1;
      idx[q++] = a + 1;
      idx[q++] = a + n;
      idx[q++] = a + n + 1;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// A near cell: (i, j) of the ground’s CELL-metre cells from its north-west
// corner, NEAR_STEP a vertex, the field exactly inside it and its border on
// the far ground’s own heights (read between that grid’s vertices), so the
// two meet with no crack where the far ground sinks under it.
export function cellRect(i, j) {
  const x0 = -HALF + i * CELL;
  const z0 = -HALF + j * CELL;
  return [x0, z0, x0 + CELL, z0 + CELL];
}

export function* cellJob(land, i, j, { tier = 'high', exact = null } = {}) {
  const step = NEAR_STEP[tier] ?? 2;
  const far = FAR_STEP[tier] ?? 10;
  const [x0, z0] = cellRect(i, j);
  const n = Math.round(CELL / step) + 1;
  const pos = new Float32Array(n * n * 3);
  const field = exact ?? land.heightAt;
  // (the border between the far grid’s vertices, as that mesh draws it)
  const border = (x, z, alongX) => {
    if (alongX) {
      const a = Math.floor((x - x0) / far) * far + x0;
      const t = (x - a) / far;
      return land.heightAt(a, z) * (1 - t) + land.heightAt(a + far, z) * t;
    }
    const a = Math.floor((z - z0) / far) * far + z0;
    const t = (z - a) / far;
    return land.heightAt(x, a) * (1 - t) + land.heightAt(x, a + far) * t;
  };
  for (let b = 0; b < n; b++) {
    const z = z0 + b * step;
    for (let a = 0; a < n; a++) {
      const x = x0 + a * step;
      const k = (b * n + a) * 3;
      pos[k] = x;
      pos[k + 2] = z;
      if (b === 0 || b === n - 1) pos[k + 1] = border(x, z, true);
      else if (a === 0 || a === n - 1) pos[k + 1] = border(x, z, false);
      else pos[k + 1] = field(x, z);
    }
    if (b % 10 === 9) yield;
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let q = 0;
  for (let b = 0; b < n - 1; b++)
    for (let a = 0; a < n - 1; a++) {
      const p = b * n + a;
      idx[q++] = p;
      idx[q++] = p + n;
      idx[q++] = p + 1;
      idx[q++] = p + 1;
      idx[q++] = p + n;
      idx[q++] = p + n + 1;
    }
  yield;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
