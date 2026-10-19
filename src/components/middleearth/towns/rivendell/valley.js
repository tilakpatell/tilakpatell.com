// Rivendell's valley, made in code (moved out of props.js, which keeps the
// falls' shaders and makes the kit): the cliffs of the gorge, beeches and
// birches in their autumn gold, and the leaves they drop. Each is one
// geometry for instancing, its colours on its vertices (the kit's cliff,
// tree and leaves materials read them). Free of GLSL, so a 'nodes' world
// (the Road) may plant them; ./build.js re-exports them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, fbm, makeNoise, mix, smooth } from '../../../../lib/paint';
import { blob, boxUV, rng, tube } from '../../shire/build';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

// ── small helpers ──

// A colour on every vertex, from fn(x, y, z, out, i).
const _kc = new THREE.Color();
function tint(geo, fn) {
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), _kc, i);
    col[i * 3] = _kc.r;
    col[i * 3 + 1] = _kc.g;
    col[i * 3 + 2] = _kc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Geometries in one, for instancing: positions, normals and colours only.
function oneGeo(list) {
  const out = list.map((geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  });
  const g = mergeGeometries(out, false);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// ── the valley ──

// A piece of the valley's wall for instancing, about 20 m high and 14 m
// wide (x), its face to +z, its foot sunk a little below y = 0, standing
// from z = -4 to about +3: tall faces of pale rock split by vertical joints
// into columns, bulging in buttresses and falling back in bays, stepped
// back at a few ledges (moss on them) that wander along it; streaks of
// ochre and of old water down it, moss in the cracks; grassy on top.
function cliffGeo(seed = 1) {
  const r = rng(seed * 31 + 7);
  const n = makeNoise(seed * 3 + 1);
  const W = 14;
  const H = 20;
  // the ledges, where the face steps back, and how far
  const ledges = [];
  for (let y = 3 + r() * 2; y < H - 2.5; y += 3.2 + r() * 3.5) ledges.push([y, 0.35 + r() * 0.8]);
  const wander = (x) => (n(x * 0.07 + 3, 9.1) - 0.5) * 2.2;
  // how far the rock stands out at (along, height), on the front
  const relief = (d, y) => {
    const big = (fbm(n, d * 0.075 + 1, y * 0.045, { octaves: 3 }) - 0.5) * 2.8;
    const ridge = 1 - Math.abs(fbm(n, d * 0.32 + 7, y * 0.035 + 2, { octaves: 2 }) * 2 - 1);
    const cols = (smooth(0.45, 1.0, ridge) - 0.4) * 0.55;
    let steps = 0;
    for (const [ly, k] of ledges) steps -= k * smooth(-0.1, 0.1, y - ly);
    const fine = (fbm(n, d * 0.6 + 5, y * 0.45, { octaves: 2 }) - 0.5) * 0.5;
    return [big + cols + steps + fine - y * 0.05, cols + big * 0.25];
  };
  // the outline in plan: [x, z, nx, nz, along]
  const ring = [];
  // the face curls back at its ends, so neighbours overlap into one wall
  const front = 24;
  const curl = (x) => 1.6 - smooth(4.2, 7, Math.abs(x)) * 2.6;
  for (let i = 0; i <= front; i++) {
    const x = -W / 2 + (i / front) * W + (i % 2 ? 0.12 : -0.12) * (i > 0 && i < front ? 1 : 0);
    const dz = (curl(x + 0.05) - curl(x - 0.05)) / 0.1;
    const l = Math.hypot(dz, 1);
    ring.push([x, curl(x), -dz / l, 1 / l]);
  }
  for (let i = 1; i <= 3; i++) ring.push([W / 2 + Math.sin((i / 4) * Math.PI) * 0.6, mix(curl(W / 2), -4, i / 4), 1, 0]);
  for (let i = 0; i <= 4; i++) ring.push([W / 2 - (i / 4) * W, -4, 0, -1]);
  for (let i = 1; i <= 3; i++) ring.push([-W / 2 - Math.sin((i / 4) * Math.PI) * 0.6, mix(-4, curl(-W / 2), i / 4), -1, 0]);
  let dd = 0;
  ring.forEach((q, i) => {
    if (i) dd += Math.hypot(q[0] - ring[i - 1][0], q[1] - ring[i - 1][1]);
    q.push(dd);
  });
  // rows: every metre or so, closer either side of each ledge
  const ys = new Set();
  for (let y = 0; y <= H; y += 1.7) ys.add(+y.toFixed(3));
  for (const [ly] of ledges) for (const dy of [-0.2, 0.2]) ys.add(+(ly + dy).toFixed(3));
  ys.add(H);
  const rowsY = [...ys].sort((p, q) => p - q);
  const M = ring.length;
  const pos = [];
  const depth = [];
  rowsY.forEach((y, j) => {
    for (const [x, z, nx, nz, d] of ring) {
      const back = nz < -0.5 ? 0.35 : 1;
      const [o, cols] = relief(d, y);
      // the bedding wanders up and down along the face; the foot sinks
      let yy = j === 0 ? -0.8 : y + wander(d) * clamp01(y / 2.5) * clamp01((H - y) / 2.5);
      if (j === rowsY.length - 1) yy += (n(d * 0.3, 4.4) - 0.5) * 1.4;
      pos.push(x + nx * o * back, yy, z + nz * o * back);
      depth.push(cols);
    }
  });
  const idx = [];
  for (let j = 0; j < rowsY.length - 1; j++) {
    for (let i = 0; i < M; i++) {
      const a0 = j * M + i;
      const b0 = j * M + ((i + 1) % M);
      idx.push(a0, b0, a0 + M, b0, b0 + M, a0 + M);
    }
  }
  // a lumpy, grassy top: a ring in from the edge and a fan to its middle
  const last = (rowsY.length - 1) * M;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < M; i++) {
    cx += pos[(last + i) * 3] / M;
    cz += pos[(last + i) * 3 + 2] / M;
  }
  const inner = pos.length / 3;
  for (let i = 0; i < M; i++) {
    const k = (last + i) * 3;
    pos.push(mix(pos[k], cx, 0.3), pos[k + 1] + 0.4 + n(i * 0.7, 8) * 0.8, mix(pos[k + 2], cz, 0.3));
    depth.push(0);
  }
  const mid = pos.length / 3;
  pos.push(cx, H + 1.2, cz);
  depth.push(0);
  for (let i = 0; i < M; i++) {
    const i1 = (i + 1) % M;
    idx.push(last + i, last + i1, inner + i, last + i1, inner + i1, inner + i);
    idx.push(inner + i, inner + i1, mid);
  }
  const dep = new Float32Array(idx.map((k) => depth[k]));
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  // faceted, its facets' edges softened a little; each face's own slope
  // kept for the moss
  geo.computeVertexNormals();
  geo = geo.toNonIndexed();
  const flat = geo.clone();
  flat.computeVertexNormals();
  const sn = geo.attributes.normal;
  const fn = flat.attributes.normal;
  for (let k = 0; k < sn.count; k++) {
    const nx = sn.getX(k) * 0.4 + fn.getX(k) * 0.6;
    const ny = sn.getY(k) * 0.4 + fn.getY(k) * 0.6;
    const nz = sn.getZ(k) * 0.4 + fn.getZ(k) * 0.6;
    const l = Math.hypot(nx, ny, nz) || 1;
    sn.setXYZ(k, nx / l, ny / l, nz / l);
  }
  // colour: smooth over the rock from where each corner is, the face's own
  // slope for moss and for overhangs
  const grey = C(0xa2a6a6);
  const pale = C(0xd0d2ce);
  const ochre = C(0xc6a676);
  const water = C(0x8a8a84);
  const moss = C(0x56662c);
  const grass = C(0x6e7a32);
  const p = geo.attributes.position;
  const nr = flat.attributes.normal;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k);
    const y = p.getY(k);
    const z = p.getZ(k);
    const f = Math.floor(k / 3) * 3;
    const ny = nr.getY(f);
    c.copy(grey).lerp(pale, smooth(0.35, 0.65, fbm(n, x * 0.12 + 3, y * 0.08, { octaves: 3 })));
    c.lerp(ochre, smooth(0.55, 0.85, fbm(n, x * 0.18 + 11, y * 0.015 + 2, { octaves: 2 })) * 0.55);
    c.lerp(water, smooth(0.68, 0.84, n(x * 0.9 + 21, y * 0.02 + 4)) * 0.35);
    // crevices darker, ridges lighter, the foot damp
    c.multiplyScalar(0.9 + smooth(-0.6, 0.6, dep[k]) * 0.16);
    c.multiplyScalar(0.8 + 0.2 * smooth(-0.8, 1.6, y));
    if (ny < -0.2) c.multiplyScalar(0.62);
    const m = smooth(0.35, 0.7, ny) * (0.55 + 0.45 * smooth(0.35, 0.6, n(x * 0.5, z * 0.5 + y)));
    c.lerp(y > H - 0.4 ? grass : moss, m * 0.88);
    col[k * 3] = c.r;
    col[k * 3 + 1] = c.g;
    col[k * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  boxUV(geo, 0.16);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

// The colours of autumn leaves.
const AUTUMN = {
  rust: C(0x7e2c12),
  red: C(0xa23818),
  amber: C(0xbc6a1c),
  gold: C(0xd6a02e),
  light: C(0xeccc6a),
  inner: C(0x2a1408),
};
const BIRCH = { inner: C(0x3a2808), deep: C(0xa0721a), gold: C(0xdcb432), lime: C(0xc8bc44), light: C(0xf4e08a) };

// A crown of leaf clumps for instancing: blobs round a dome, each vertex's
// colour from how high and how far out it is (darker under and inside,
// bright gold out on top), in patches of hue; the normals turned out from
// the crown's middle, so it shades as one rounded mass.
function crownGeo(blobs, centre, { seed = 1, palette, detail = 1, span = 4.5 }) {
  const n = makeNoise(seed + 7);
  const list = [];
  const ctr = V3(...centre);
  const tmp = V3();
  blobs.forEach(([x, y, z, rad], i) => {
    const geo = blob(rad, { detail, amp: 0.34, freq: 1.8, seed: seed * 13 + i });
    geo.translate(x, y, z);
    const nr = geo.attributes.normal;
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      tmp.set(p.getX(k), p.getY(k), p.getZ(k)).sub(ctr).normalize();
      const nx = nr.getX(k) * 0.4 + tmp.x * 0.6;
      const ny = nr.getY(k) * 0.4 + tmp.y * 0.6 + 0.15;
      const nz = nr.getZ(k) * 0.4 + tmp.z * 0.6;
      const l = Math.hypot(nx, ny, nz);
      nr.setXYZ(k, nx / l, ny / l, nz / l);
    }
    const own = n(i * 3.7 + 0.5, seed + 0.5);
    tint(geo, (px, py, pz, out) => {
      const up = (py - ctr.y) / span;
      const outward = Math.hypot(px - ctr.x, (py - ctr.y) * 0.6, pz - ctr.z) / span;
      const t = clamp01(0.42 + up * 0.38 + (outward - 0.62) * 0.7 + (n(px * 1.6, py * 1.6 + pz) - 0.5) * 0.3);
      palette(t, own, out);
    });
    list.push(geo);
  });
  return list;
}

// A beech for instancing, 9 to 12 m: a smooth grey trunk that parts into a
// few heavy limbs under a broad dome of leaf in its autumn colours: gold
// on top and out in the sun, amber and rust lower and within.
function beechGeo(seed = 1) {
  const r = rng(seed * 7 + 3);
  const n = makeNoise(seed + 20);
  const H = 9 + r() * 3;
  const list = [];
  const trunkH = H * 0.38;
  const trunk = new THREE.CylinderGeometry(0.26, 0.42, trunkH, 9, 4, true).translate(0, trunkH / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const a = Math.atan2(tp.getZ(i), tp.getX(i));
    const flare = 1 + Math.max(0, 1 - y / 0.9) * (0.35 + Math.sin(a * 4) * 0.2);
    tp.setX(i, tp.getX(i) * flare);
    tp.setZ(i, tp.getZ(i) * flare);
  }
  trunk.computeVertexNormals();
  const bark = (x, y, z, out) => out.setRGB(0.36, 0.35, 0.33).multiplyScalar(0.8 + n(y * 2, Math.atan2(z, x) * 2) * 0.4);
  list.push(tint(trunk, bark));
  const limbs = 4 + Math.floor(r() * 2);
  const ends = [];
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * TAU + r() * 0.8;
    const reach = 1.6 + r() * 1.4;
    const top = H * (0.62 + r() * 0.12);
    const end = [Math.cos(a) * reach, top, Math.sin(a) * reach];
    ends.push(end);
    const g = tube([[0, trunkH - 0.4, 0], [end[0] * 0.35, trunkH + (top - trunkH) * 0.45, end[2] * 0.35], end], 0.24, 0.07, { seg: 5, radial: 6 });
    list.push(tint(g, bark));
  }
  // the crown: a broad dome of clumps
  const cy = H * 0.66;
  const R = H * 0.42;
  const blobs = [[0, cy + R * 0.2, 0, R * 0.55]];
  const count = 19 + Math.floor(r() * 4);
  for (let k = 0; k < count; k++) {
    const a = k * 2.39996 + r() * 0.5;
    const el = Math.asin(mix(-0.25, 0.95, (k + 0.5) / count));
    const rr = R * (0.72 + r() * 0.22);
    blobs.push([Math.cos(a) * Math.cos(el) * rr * 1.08, cy + Math.sin(el) * rr * 0.7, Math.sin(a) * Math.cos(el) * rr * 1.08, R * (0.24 + r() * 0.12)]);
  }
  const palette = (t, own, out) => {
    out.copy(AUTUMN.inner).lerp(AUTUMN.rust, smooth(0.0, 0.32, t));
    out.lerp(own > 0.62 ? AUTUMN.red : AUTUMN.amber, smooth(0.25, 0.55, t));
    out.lerp(AUTUMN.gold, smooth(0.5, 0.82, t) * (own < 0.7 ? 1 : 0.45));
    out.lerp(AUTUMN.light, smooth(0.84, 1, t) * 0.55);
  };
  list.push(...crownGeo(blobs, [0, cy, 0], { seed, palette, span: R }));
  return oneGeo(list);
}

// A golden birch for instancing, about 10 m: a slender pale trunk, a little
// bent, black-marked and dark at its foot, thin limbs going up, and light
// airy crowns of clear gold.
function birchGeo(seed = 1) {
  const r = rng(seed * 13 + 1);
  const n = makeNoise(seed + 40);
  const list = [];
  const H = 8.6 + r() * 1.4;
  const lean = (y) => Math.sin(y * 0.3 + seed) * 0.2;
  const trunk = new THREE.CylinderGeometry(0.09, 0.17, H, 7, 12).translate(0, H / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setX(i, tp.getX(i) + lean(tp.getY(i)));
  trunk.computeVertexNormals();
  list.push(tint(trunk, (x, y, z, out) => {
    const a = Math.atan2(z, x - lean(y));
    const mark = n(y * 3.2, a * 1.2) > 0.7 || n(y * 1.2 + 9, a) > 0.8;
    out.setRGB(0.86, 0.84, 0.78);
    if (mark) out.setRGB(0.08, 0.07, 0.06);
    if (y < 1.0) out.lerp(_kc.setRGB(0.1, 0.09, 0.08), 1 - y / 1.0);
  }));
  for (let i = 0; i < 6; i++) {
    const y = 3.8 + i * 0.75;
    const a = i * 2.3 + r();
    const l = 1.3 + r() * 0.8;
    const geo = new THREE.CylinderGeometry(0.02, 0.05, l, 4, 1).translate(0, l / 2, 0);
    geo.rotateZ(-0.6 - r() * 0.3).rotateY(a).translate(lean(y), y, 0);
    list.push(tint(geo, (x, yy, z, out) => out.setRGB(0.5, 0.47, 0.42)));
  }
  const blobs = [];
  const count = 9 + Math.floor(r() * 3);
  for (let k = 0; k < count; k++) {
    const t = k / count;
    const a = k * 2.4 + r();
    const y = mix(5.2, H + 0.6, t) + r() * 0.4;
    const rr = mix(1.5, 0.5, t) + r() * 0.3;
    blobs.push([lean(y) + Math.cos(a) * rr, y, Math.sin(a) * rr, mix(1.15, 0.75, t) + r() * 0.25]);
  }
  const palette = (t, own, out) => {
    out.copy(BIRCH.inner).lerp(BIRCH.deep, smooth(0.0, 0.35, t));
    out.lerp(own > 0.65 ? BIRCH.lime : BIRCH.gold, smooth(0.3, 0.62, t));
    out.lerp(BIRCH.light, smooth(0.66, 1, t) * 0.8);
  };
  list.push(...crownGeo(blobs, [0, H * 0.75, 0], { seed: seed + 50, palette, span: 2.6 }));
  return oneGeo(list);
}

// A small scatter of fallen leaves, for instancing on the ground: forty or
// so, red, rust, amber and gold, each a little pointed leaf folded along
// its midrib, lying every way within about 1.2 m, a few on top of others.
function fallenLeavesGeo(seed = 1) {
  const r = rng(seed * 17 + 9);
  const pos = [];
  const col = [];
  const hues = [AUTUMN.red, AUTUMN.rust, AUTUMN.amber, AUTUMN.gold, AUTUMN.light, C(0x6a3a14)];
  const c = new THREE.Color();
  const count = 36 + Math.floor(r() * 12);
  for (let k = 0; k < count; k++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 1.2;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const y = 0.006 + r() * 0.02;
    const len = 0.07 + r() * 0.06;
    const wid = len * (0.45 + r() * 0.2);
    const turn = r() * TAU;
    const fold = 0.006 + r() * 0.01;
    const tilt = (r() - 0.5) * 0.3;
    c.copy(hues[Math.floor(r() * hues.length)]).multiplyScalar(0.8 + r() * 0.3);
    const P = (u, v, lift) => {
      const lx = u * len;
      const lz = v * wid;
      return [x + Math.cos(turn) * lx - Math.sin(turn) * lz, y + lift + lx * tilt, z + Math.sin(turn) * lx + Math.cos(turn) * lz];
    };
    const base = P(-0.5, 0, 0);
    const tip = P(0.5, 0, 0.004);
    const l = P(-0.05, -0.5, 0);
    const rr = P(-0.05, 0.5, 0);
    const mid = P(0, 0, fold);
    for (const tri of [[base, mid, l], [mid, tip, l], [base, rr, mid], [mid, rr, tip]]) {
      for (const v of tri) {
        pos.push(...v);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const nr = geo.attributes.normal;
  for (let k = 0; k < nr.count; k++) if (nr.getY(k) < 0) nr.setXYZ(k, -nr.getX(k), -nr.getY(k), -nr.getZ(k));
  geo.computeBoundingSphere();
  return geo;
}

export { tint, oneGeo, cliffGeo, AUTUMN, BIRCH, crownGeo, beechGeo, birchGeo, fallenLeavesGeo };
