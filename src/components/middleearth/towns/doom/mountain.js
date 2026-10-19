// Orodruin: the cone, its gullies of fire and the lake in its crater, the
// road up its side to the door of the Sammath Naur, the plume, the fountain
// and the bombs. Moved out of props.js as it was; its fire and smoke are the
// kit's materials.

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { hot } from '../../../../lib/three/canvasTexture';
import { clamp01, fbm, makeNoise, mix, ridge, smooth } from '../../../../lib/paint';
import { boxUV, rng } from '../../shire/build';
import { _kc, _kc2, bombCloud, C, cardCloud, facet, geoOf, glowSprite, hullRock, noise3, oneGeo, prof, spikeAt, TAU, tint, UP, V3 } from './helpers';
import { spikeGeo } from './plain';

// ── Orodruin ──

// The Mountain's section, [r, y]: the crater floor, its rim 54 m out and
// 326 up, the cone steepening down to a broad shoulder of old flows, its
// skirts going down under the plain.
const DOOM_PROFILE = [[0, 297], [30, 298], [44, 313], [54, 326], [66, 321], [90, 301], [130, 256], [170, 205], [210, 160], [250, 128], [290, 111], [340, 97], [400, 72], [450, 44], [500, 18], [540, 3], [580, -6]];
const DOOM = { door: 213, edge: 580, roadW: 4.6, west: Math.PI };
// The streams of fire: [heading (0 east, π west, π/2 south), from r, to r,
// width, seed]. The road's side (west, ±0.62) is kept clear but for the
// one that comes down just over the door.
const DOOM_RIVERS = [
  [Math.PI - 0.4, 60, 136, 4, 1],
  [Math.PI + 0.98, 58, 330, 5, 2],
  [Math.PI - 1.08, 96, 300, 5.5, 3],
  [Math.PI - 0.84, 62, 225, 3.5, 4],
  [0.2, 56, 380, 7, 5],
  [0.42, 70, 250, 4, 11],
  [0.95, 120, 300, 5, 6],
  [-0.6, 58, 250, 5.5, 7],
  [1.75, 58, 310, 5.5, 8],
  [-1.45, 140, 335, 5, 9],
  [-0.64, 292, 470, 7, 10],
];
const DOOMC = {
  ash: C(0x5a524c),
  cinder: C(0x2e2826),
  rock: C(0x221e1d),
  pale: C(0x8e867e),
  rust: C(0x6e3622),
  sulphur: C(0x9e8a44),
  scorch: C(0x120c0a),
  ember: C(0x6a1e0e),
  road: C(0xa29482),
  bank: C(0x4a403a),
};
const wrapA = (a) => a - TAU * Math.round(a / TAU);

// The ground of the Mountain before the road is cut: at (r, φ) its height,
// and how hot it is (by the streams, in the crater).
function doomShape() {
  const n = makeNoise(1301);
  const n2 = makeNoise(1309);
  const n3 = makeNoise(1319);
  const rivers = DOOM_RIVERS.map(([phi, r0, r1, w, s]) => ({ phi, r0, r1, w, s, at: (r) => phi + 0.08 * Math.sin(r * 0.015 + s * 1.3) + 0.035 * Math.sin(r * 0.043 + s * 2.9) + 0.012 * Math.sin(r * 0.11 + s) }));
  const at = (r, phi) => {
    const x = r * Math.cos(phi);
    const z = r * Math.sin(phi);
    let y = prof(DOOM_PROFILE, r)[0];
    const u = ((((phi / TAU) % 1) + 1) % 1) * 36;
    // ridges and gullies running down it, finer ones on them
    const cone = smooth(46, 110, r) * (1 - 0.6 * smooth(250, 560, r));
    y += (ridge(n, u, r * 0.011, { period: 36, octaves: 3 }) - 0.62) * 22 * cone;
    y += (ridge(n2, u * 3, r * 0.03, { period: 108, octaves: 2 }) - 0.6) * 6.5 * cone;
    // the rim broken down on the east, where the fire spills over most
    y -= 18 * Math.exp(-((wrapA(phi - 0.2) / 0.32) ** 2)) * (1 - smooth(60, 150, r)) * smooth(30, 50, r);
    // great lumps of old flows, and a lesser cone on its north-east shoulder
    y += (fbm(n3, x * 0.004 + 9, z * 0.004, { octaves: 3 }) - 0.5) * 30 * smooth(70, 200, r) * (1 - smooth(470, 580, r));
    y += 36 * Math.exp(-((x - 230) ** 2 + (z + 170) ** 2) / 8000);
    // the crater broken and rough inside
    if (r < 62) y += (fbm(n2, x * 0.08, z * 0.08, { octaves: 3 }) - 0.5) * 9 * (1 - smooth(50, 62, r));
    let heat = r < 46 ? smooth(46, 28, r) : 0;
    // each stream in its gully, banked up either side by its own levees
    for (const R of rivers) {
      if (r < R.r0 - 8 || r > R.r1 + 40) continue;
      const d = wrapA(phi - R.at(r)) * r;
      if (Math.abs(d) > R.w * 4) continue;
      const w = R.w * 0.95;
      const run = smooth(R.r0 - 8, R.r0 + 4, r) * (1 - smooth(R.r1 + 5, R.r1 + 40, r));
      y += (-4.6 * Math.exp(-((d / w) ** 2)) + 1.7 * Math.exp(-(((Math.abs(d) - w * 1.3) / (w * 0.45)) ** 2))) * run;
      heat = Math.max(heat, Math.exp(-((d / (w * 1.7)) ** 2)) * smooth(R.r0 - 6, R.r0, r) * (1 - smooth(R.r1 - 10, R.r1 + 18, r)));
    }
    return [y, heat];
  };
  return { at, rivers };
}

// The road: up the western side in four long sweeps, hairpins between, to
// the door. Its curve, samples every 2 m, and a lookup of the nearest one.
function doomRoad(shape) {
  const legs = [[-0.6, 0.6], [0.6, -0.55], [-0.55, 0.5], [0.5, -0.17]];
  const top = DOOM.door;
  const rAt = (phi, y) => {
    let a = 70;
    let b = 576;
    for (let i = 0; i < 26; i++) {
      const m = (a + b) / 2;
      if (shape.at(m, phi)[0] > y) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  const STEPS = 12;
  let ys = null;
  let pts = [];
  // twice over, the second time spreading the climb evenly along the way
  for (let pass = 0; pass < 3; pass++) {
    pts = [];
    let k = 0;
    legs.forEach(([a, b], i) => {
      for (let s = i ? 1 : 0; s <= STEPS; s++) {
        const f = s / STEPS;
        const phi = DOOM.west + mix(a, b, f);
        const y = ys ? ys[k] : (top * (i + f)) / legs.length;
        const r = rAt(phi, Math.max(0.6, y));
        pts.push(V3(r * Math.cos(phi), Math.max(0.15, y), r * Math.sin(phi)));
        k++;
      }
    });
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    ys = len.map((l) => (top * l) / len[len.length - 1]);
  }
  // the last of it turns in off the slope to the door, a little way in
  const E = pts[pts.length - 1];
  const phiE = Math.atan2(E.z, E.x);
  const rE = Math.hypot(E.x, E.z);
  const door = V3((rE - 9) * Math.cos(phiE - 0.03), top, (rE - 9) * Math.sin(phiE - 0.03));
  const mid = V3((rE - 4) * Math.cos(phiE - 0.045), top, (rE - 4) * Math.sin(phiE - 0.045));
  pts.push(mid, door);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const length = curve.getLength();
  const samples = curve.getSpacedPoints(Math.round(length / 2));
  const CELL = 16;
  const grid = new Map();
  samples.forEach((p, i) => {
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  });
  // the nearest sample to (x, z) within about 30 m: [distance, index]
  const nearest = (x, z) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = 1e9;
    let bi = -1;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const list = grid.get(`${cx + dx},${cz + dz}`);
        if (!list) continue;
        for (const i of list) {
          const d = (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2;
          if (d < best) {
            best = d;
            bi = i;
          }
        }
      }
    }
    return [Math.sqrt(best), bi];
  };
  return { curve, length, samples, nearest, door, end: E };
}

// Mount Doom: Orodruin, 326 m to its crater's rim, a kilometre across its
// foot, the group's origin at the middle of its base on the plain. Black
// ash and cinder, ridged and gullied, streams of fire running down its
// gullies, a heavy plume going up out of the crater and leaning east; a
// road climbing its western side in four long sweeps to the door of the
// Sammath Naur, two-thirds of the way up, a dark mouth with a red glow in
// it. road(k) is the road's surface at k (0 its foot, 1 the door), door the
// threshold; groundAt(x, z) the ground's height. update(t, { erupt }):
// erupt 0..1 sets it blazing.
export function mountDoom(K) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'mountDoom';
  const shape = doomShape();
  const road = doomRoad(shape);
  const n = makeNoise(1331);
  const jn = makeNoise(1337);
  const top = DOOM.door;

  // the ground with the road cut into it, and the landing before the door
  const ground = (x, z) => {
    const r = Math.hypot(x, z);
    const phi = Math.atan2(z, x);
    let [y, heat] = shape.at(r, phi);
    let cut = 0;
    if (Math.abs(wrapA(phi - DOOM.west)) < 1.1 && r > 120) {
      const [d, i] = road.nearest(x, z);
      if (i >= 0 && d < 22) {
        const ry = road.samples[i].y - 0.1;
        const k = smooth(6.5, 21, d);
        y = mix(ry, y, k);
        cut = 1 - smooth(5, 9, d);
        heat *= k;
      }
      const dd = Math.min(Math.hypot(x - road.door.x, z - road.door.z), Math.hypot(x - road.end.x, z - road.end.z));
      if (dd < 26) {
        const k = smooth(11, 26, dd);
        y = mix(top - 0.1, y, k);
        cut = Math.max(cut, 1 - smooth(9, 13, dd));
        heat *= k;
      }
    }
    return [y, heat, cut];
  };

  // ── the Mountain: rings out from the crater, closer together on the
  // western side where the road is
  const rings = [];
  for (let r = 0.6; r < 60; r += 3) rings.push(r);
  for (let r = 60; r < 200; r += 3.6) rings.push(r);
  for (let r = 200; r <= DOOM.edge; r += 4.6) rings.push(r);
  const NP = 216;
  const NR = rings.length;
  const pos = new Float32Array(NR * NP * 3);
  const heatA = new Float32Array(NR * NP);
  const cutA = new Float32Array(NR * NP);
  const uv = new Float32Array(NR * NP * 2);
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NP; j++) {
      const s = j / NP;
      const phi0 = TAU * s + 0.42 * Math.sin(TAU * s);
      const r0 = rings[i];
      // jittered off the rings, so it isn't a spider's web
      const jr = r0 > 2 ? (jn(i * 0.7, j * 0.7) - 0.5) * 2.4 : 0;
      const jp = r0 > 2 ? ((jn(i * 0.7 + 50, j * 0.7) - 0.5) * 1.6) / Math.max(r0, 20) : 0;
      const x = (r0 + jr) * Math.cos(phi0 + jp);
      const z = (r0 + jr) * Math.sin(phi0 + jp);
      const [y, heat, cut] = ground(x, z);
      const k = i * NP + j;
      pos.set([x, y, z], k * 3);
      heatA[k] = heat;
      cutA[k] = cut;
      uv.set([x * 0.07, z * 0.07], k * 2);
    }
  }
  const idx = [];
  for (let i = 0; i < NR - 1; i++) {
    for (let j = 0; j < NP; j++) {
      const a = i * NP + j;
      const b = i * NP + ((j + 1) % NP);
      const c = (i + 1) * NP + j;
      const d = (i + 1) * NP + ((j + 1) % NP);
      idx.push(a, b, c, b, d, c);
    }
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  mg.setAttribute('heat', new THREE.BufferAttribute(heatA, 1));
  mg.setIndex(idx);
  mg.computeVertexNormals();
  {
    const nr = mg.attributes.normal;
    const col = new Float32Array(NR * NP * 3);
    for (let k = 0; k < NR * NP; k++) {
      const x = pos[k * 3];
      const y = pos[k * 3 + 1];
      const z = pos[k * 3 + 2];
      const r = Math.hypot(x, z);
      const phi = Math.atan2(z, x);
      const ny = nr.getY(k);
      const u = ((((phi / TAU) % 1) + 1) % 1) * 140;
      const v = noise3(n, x * 0.03, y * 0.03, z * 0.03);
      // cinder on the steeps, grey ash lying where it is gentler
      _kc.copy(DOOMC.cinder).lerp(DOOMC.ash, smooth(0.6, 0.92, ny) * 0.85).multiplyScalar(0.75 + v * 0.55);
      _kc.lerp(DOOMC.rock, smooth(0.6, 0.35, ny) * 0.7);
      // pale ash and rust in long streaks down the slope
      const streak = n(u, r * 0.006);
      _kc.lerp(DOOMC.pale, smooth(0.62, 0.8, streak) * 0.45 * smooth(70, 140, r));
      _kc.lerp(DOOMC.rust, smooth(0.6, 0.78, n(u * 0.6 + 40, r * 0.01)) * 0.5);
      // yellow and red stains about the crater's rim
      const rim = smooth(28, 48, r) * (1 - smooth(70, 110, r));
      _kc.lerp(DOOMC.sulphur, rim * smooth(0.45, 0.7, noise3(n, x * 0.06 + 3, y * 0.06, z * 0.06)) * 0.7);
      _kc.lerp(DOOMC.rust, rim * 0.3);
      // scorched black about the fire
      const h = heatA[k];
      _kc.lerp(DOOMC.scorch, smooth(0.05, 0.4, h) * 0.8).lerp(DOOMC.ember, smooth(0.5, 0.9, h) * 0.6);
      // the trodden road, and dust settled about the foot
      _kc.lerp(DOOMC.bank, smooth(0, 0.6, cutA[k]) * 0.5).lerp(DOOMC.road, smooth(0.6, 1, cutA[k]) * 0.6);
      _kc.lerp(DOOMC.ash, smooth(470, 560, r) * 0.4);
      col.set([_kc.r, _kc.g, _kc.b], k * 3);
    }
    mg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  mg.computeBoundingSphere();
  const mountain = new THREE.Mesh(mg, mats.doom);
  mountain.name = 'orodruin';
  g.add(mountain);

  // the height of the Mountain as drawn (its triangles, not the sums they
  // were sampled from) at (x, z), so what lies on it lies on it
  const tri = (ia, ib, ic, x, z) => {
    const ax = pos[ia * 3];
    const az = pos[ia * 3 + 2];
    const v0x = pos[ic * 3] - ax;
    const v0z = pos[ic * 3 + 2] - az;
    const v1x = pos[ib * 3] - ax;
    const v1z = pos[ib * 3 + 2] - az;
    const v2x = x - ax;
    const v2z = z - az;
    const den = v0x * v1z - v1x * v0z;
    if (Math.abs(den) < 1e-9) return null;
    const u = (v2x * v1z - v1x * v2z) / den;
    const v = (v0x * v2z - v2x * v0z) / den;
    if (u < -1e-5 || v < -1e-5 || u + v > 1 + 1e-5) return null;
    const ay = pos[ia * 3 + 1];
    return ay + u * (pos[ic * 3 + 1] - ay) + v * (pos[ib * 3 + 1] - ay);
  };
  const surface = (x, z) => {
    const r = Math.hypot(x, z);
    let phi = Math.atan2(z, x);
    if (phi < 0) phi += TAU;
    let sv = phi / TAU;
    for (let k = 0; k < 6; k++) sv -= (TAU * sv + 0.42 * Math.sin(TAU * sv) - phi) / (TAU * (1 + 0.42 * Math.cos(TAU * sv)));
    const j0 = Math.floor(sv * NP);
    let lo = 0;
    let hi = NR - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (rings[m] > r) hi = m;
      else lo = m;
    }
    for (let di = -1; di <= 1; di++) {
      const i = lo + di;
      if (i < 0 || i >= NR - 1) continue;
      for (let dj = -2; dj <= 2; dj++) {
        const j = (((j0 + dj) % NP) + NP) % NP;
        const a = i * NP + j;
        const b = i * NP + ((j + 1) % NP);
        const c = (i + 1) * NP + j;
        const d = (i + 1) * NP + ((j + 1) % NP);
        const y = tri(a, b, c, x, z) ?? tri(b, d, c, x, z);
        if (y != null) return y;
      }
    }
    return ground(x, z)[0];
  };

  // ── the streams of fire, each a ribbon down its gully
  {
    const pl = [];
    const ul = [];
    const el = [];
    const il = [];
    const ACROSS = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];
    for (const R of shape.rivers) {
      const base = pl.length / 3;
      let rows = 0;
      let run = 0;
      let last = null;
      for (let r = R.r0; r <= R.r1; r += 2.5) {
        const c = R.at(r);
        const w = R.w * (0.5 + 0.5 * smooth(R.r0, R.r0 + 30, r)) * (1 - 0.65 * smooth(R.r1 - 45, R.r1, r)) * (0.85 + 0.3 * n(r * 0.05, R.s * 3));
        const cy = shape.at(r, c)[0];
        const here = V3(r * Math.cos(c), cy, r * Math.sin(c));
        if (last) run += here.distanceTo(last);
        last = here;
        for (const o of ACROSS) {
          const phi = c + (o * w * 0.5) / r;
          const x = r * Math.cos(phi);
          const z = r * Math.sin(phi);
          const y = Math.max(surface(x, z), shape.at(r, phi)[0]) + 0.5 - Math.abs(o) * 0.12;
          pl.push(x, y, z);
          ul.push(o * w * 0.5, run);
          el.push(Math.abs(o));
        }
        rows++;
      }
      for (let k = 0; k < rows - 1; k++) {
        for (let j = 0; j < ACROSS.length - 1; j++) {
          const a = base + k * ACROSS.length + j;
          const b = a + ACROSS.length;
          il.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const rg = geoOf(pl, il, ul);
    rg.setAttribute('aEdge', new THREE.Float32BufferAttribute(el, 1));
    const streams = new THREE.Mesh(rg, mats.doomLava);
    streams.name = 'lavaStreams';
    streams.renderOrder = 1;
    g.add(streams);
  }
  // the lava lake in the crater
  {
    const lake = new THREE.CircleGeometry(40, 40).rotateX(-Math.PI / 2);
    const p = lake.attributes.position;
    const u2 = lake.attributes.uv;
    for (let i = 0; i < p.count; i++) u2.setXY(i, p.getX(i), p.getZ(i));
    const m = new THREE.Mesh(lake, mats.doomLake);
    m.position.y = 301.5;
    m.name = 'craterLake';
    g.add(m);
  }

  // ── the road's surface, a kerb of boulders on its outer edge, crags on
  // the ridges and about the rim
  {
    const S = road.samples;
    const pl = [];
    const ul = [];
    const il = [];
    const cl = [];
    const ACROSS = [-1, -0.7, -0.3, 0.3, 0.7, 1];
    const T = V3();
    const X = V3();
    let run = 0;
    S.forEach((p, i) => {
      T.subVectors(S[Math.min(S.length - 1, i + 1)], S[Math.max(0, i - 1)]).setY(0).normalize();
      X.set(-T.z, 0, T.x);
      if (i) run += p.distanceTo(S[i - 1]);
      for (const o of ACROSS) {
        const w = DOOM.roadW * 0.5;
        const edge = Math.abs(o) > 0.95 ? 0.16 : 0;
        pl.push(p.x + X.x * o * w, p.y + 0.12 + 0.05 * (1 - o * o) - edge, p.z + X.z * o * w);
        ul.push(o * w * 0.3, run * 0.3);
        const v = n(run * 0.2, o * 2);
        _kc.copy(DOOMC.road).multiplyScalar(0.8 + v * 0.4 - Math.abs(o) * 0.18);
        cl.push(_kc.r, _kc.g, _kc.b);
      }
      if (i < S.length - 1) {
        const a = i * ACROSS.length;
        for (let j = 0; j < ACROSS.length - 1; j++) il.push(a + j, a + j + ACROSS.length, a + j + 1, a + j + 1, a + j + ACROSS.length, a + j + ACROSS.length + 1);
      }
    });
    const rgeo = geoOf(pl, il, ul);
    rgeo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    const surface = new THREE.Mesh(rgeo, mats.doomRoad);
    surface.name = 'road';
    g.add(surface);

    const rocks = [];
    const r = rng(1401);
    const rockTint = (geo, ash = 0.5) =>
      tint(geo, (x, y, z, out, nx, ny) => {
        out.copy(DOOMC.rock).multiplyScalar(1.2 + noise3(n, x * 0.3, y * 0.3, z * 0.3) * 0.8);
        out.lerp(DOOMC.ash, smooth(0.4, 0.85, ny) * ash);
      });
    // the kerb: on the outer side, every few metres, gaps here and there
    for (let i = 4; i < S.length - 6; i += 3) {
      if (n(i * 0.13, 7) < 0.36) continue;
      const p = S[i];
      T.subVectors(S[i + 1], S[i - 1]).setY(0).normalize();
      X.set(-T.z, 0, T.x);
      const out = Math.sign(X.x * p.x + X.z * p.z) || 1;
      const s = 0.35 + r() * 0.55;
      const at = p.clone().addScaledVector(X, out * (DOOM.roadW * 0.5 + 0.5 + r() * 0.6));
      rocks.push(rockTint(hullRock(1500 + i, [s * 1.3, s, s * 1.1], [at.x, p.y + s * 0.35, at.z], 9), 0.6));
    }
    // crags on the ridges of the cone, clear of the road and the fire
    let placed = 0;
    for (let tries = 0; tries < 900 && placed < 70; tries++) {
      const rr = 62 + r() * 330;
      const phi = r() * TAU;
      const x = rr * Math.cos(phi);
      const z = rr * Math.sin(phi);
      const [y, heat, cut] = ground(x, z);
      if (heat > 0.15 || cut > 0) continue;
      if (Math.abs(wrapA(phi - DOOM.west)) < 1.1 && road.nearest(x, z)[0] < 16) continue;
      if (Math.hypot(x - road.door.x, z - road.door.z) < 30) continue;
      const ys = shape.at(rr + 4, phi)[0];
      const yn = shape.at(rr - 4, phi)[0];
      // only where it stands proud: on a crest, not in a gully
      const side = shape.at(rr, phi + 6 / rr)[0] + shape.at(rr, phi - 6 / rr)[0];
      if (y * 2 - side < 1.2) continue;
      const s = (2.5 + r() * 6) * (rr < 150 ? 1 : 0.8);
      const lean = (yn - ys) / 8;
      const geo = placed % 2 ? spikeGeo(1600 + tries).clone().scale(s * 0.45, s * (0.4 + r() * 0.3), s * 0.45) : hullRock(1600 + tries, [s * 0.8, s * (0.6 + r() * 0.5), s * 0.7], [0, s * 0.3, 0], 16);
      geo.rotateY(r() * TAU).rotateX(lean * 0.2).translate(x, y - s * 0.25, z);
      rocks.push(rockTint(geo, 0.35));
      placed++;
    }
    // the crater's rim, jagged
    for (let i = 0; i < 26; i++) {
      const phi = (i / 26) * TAU + r() * 0.15;
      const rr = 50 + r() * 8;
      const x = rr * Math.cos(phi);
      const z = rr * Math.sin(phi);
      const y = shape.at(rr, phi)[0];
      const s = 4 + r() * 7;
      const geo = hullRock(1700 + i, [s * 0.9, s * (0.8 + r()), s * 0.8], [0, 0, 0], 12);
      geo.rotateY(r() * TAU).translate(x, y - s * 0.2, z);
      rocks.push(rockTint(geo, 0.25));
    }
    const rk = new THREE.Mesh(oneGeo(rocks), mats.doomRock);
    boxUV(rk.geometry, 0.25);
    rk.name = 'crags';
    g.add(rk);
  }

  // ── the door of the Sammath Naur: a mouth in a buttress of black rock,
  // facing out over the road; dark, and red deep inside
  const door = road.door.clone();
  {
    const out = V3(door.x, 0, door.z).normalize();
    const right = V3().crossVectors(UP, out);
    const frame = new THREE.Matrix4().makeBasis(right, UP, out).setPosition(door);
    const r = rng(1801);
    const block = (seed, [x0, x1], [y0, y1], [z0, z1], j = 0.6) => {
      const br = rng(seed);
      const pts = [];
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(V3(x + (br() - 0.5) * j, y + (br() - 0.5) * j, z + (br() - 0.5) * j));
      for (let i = 0; i < 6; i++) pts.push(V3(mix(x0, x1, br()), mix(y0, y1, br()), mix(z0, z1, br())));
      return facet(new ConvexGeometry(pts));
    };
    const W = 2.25;
    const Hd = 6.4;
    const list = [
      block(11, [-9, -W - 0.05], [-1.5, 10], [-12, 1.2], 1.4),
      block(12, [W + 0.05, 9.5], [-1.5, 9], [-12, 1.4], 1.4),
      block(13, [-W - 1.2, W + 1.2], [Hd, 10], [-11, 1.6], 0.8),
      block(14, [-7, 6.5], [9.2, 12.5], [-13, 0.4], 2.2),
      block(15, [-4, 4], [-1.5, 9], [-18, -5.2], 1),
      block(16, [-14, -8], [-1.5, 6], [-10, 0.5], 2.2),
      block(17, [8, 14], [-1.5, 5], [-10, 0.8], 2.2),
    ];
    for (let i = 0; i < 9; i++) {
      const x = -11 + i * 2.8 + (r() - 0.5);
      const sz = 1.4 + r() * 2;
      list.push(hullRock(1820 + i, [sz, sz * (0.8 + r() * 0.8), sz * 1.1], [x, 8 + r() * 4 - Math.abs(x) * 0.25, -3 - r() * 6], 12));
    }
    // fangs hung over the mouth, a couple of fallen stones
    list.push(facet(spikeAt(V3(-1.2, Hd + 0.4, 1.0), V3(0.1, -1, 0.15), 1.5, 0.45, 4)));
    list.push(facet(spikeAt(V3(1.0, Hd + 0.4, 1.1), V3(-0.1, -1, 0.1), 1.1, 0.4, 4)));
    list.push(hullRock(1811, [1.2, 0.8, 1], [-4.6, 0.3, 3.4], 9), hullRock(1812, [0.8, 0.6, 0.9], [4.2, 0.2, 4.2], 9));
    const geo = oneGeo(list);
    tint(geo, (x, y, z, o, nx, ny) => {
      o.copy(DOOMC.rock).multiplyScalar(1.1 + noise3(n, x * 0.4, y * 0.4, z * 0.4) * 0.8);
      o.lerp(DOOMC.ash, smooth(0.5, 0.9, ny) * 0.5);
      // red-lit about the mouth
      const d = Math.hypot(x, (y - 3) * 0.8, Math.max(0, z - 0.5));
      o.lerp(DOOMC.ember, (1 - smooth(2, 6, d)) * 0.7);
    });
    geo.applyMatrix4(frame);
    boxUV(geo, 0.3);
    const portal = new THREE.Mesh(geo, mats.doomRock);
    portal.name = 'sammathNaurDoor';
    g.add(portal);
    // the dark inside, going in and down to the fire
    const ip = [];
    const ic = [];
    const D = 6;
    const quad = (a, b, c2, d) => ip.push(...a, ...b, ...c2, ...a, ...c2, ...d);
    quad([-W, 0, 0.6], [-W, 0, -D], [-W, Hd, -D], [-W, Hd, 0.6]);
    quad([W, 0, -D], [W, 0, 0.6], [W, Hd, 0.6], [W, Hd, -D]);
    quad([-W, Hd, 0.6], [-W, Hd, -D], [W, Hd, -D], [W, Hd, 0.6]);
    quad([-W, 0, -D], [-W, 0, 0.6], [W, 0, 0.6], [W, 0, -D]);
    quad([-W, 0, -D], [W, 0, -D], [W, Hd, -D], [-W, Hd, -D]);
    for (let i = 0; i < ip.length; i += 9) {
      // the far wall red-hot low down; the sides and floor darker
      const back = ip[i + 2] < -D + 0.01 && ip[i + 5] < -D + 0.01 && ip[i + 8] < -D + 0.01;
      for (let k = 0; k < 9; k += 3) {
        const z = ip[i + k + 2];
        const y = ip[i + k + 1];
        const deep = smooth(0.6, -D, z);
        if (back) _kc.setRGB(0.12, 0.015, 0.004).lerp(_kc2.setRGB(1.1, 0.22, 0.035), 1 - (y / Hd) * 0.9);
        else _kc.setRGB(0.006, 0.003, 0.002).lerp(_kc2.setRGB(0.32, 0.045, 0.008), deep * deep * deep * (1 - (y / Hd) * 0.6));
        ic.push(_kc.r, _kc.g, _kc.b);
      }
    }
    const inside = geoOf(ip, null);
    inside.setAttribute('color', new THREE.Float32BufferAttribute(ic, 3));
    inside.applyMatrix4(frame);
    const mouth = new THREE.Mesh(inside, mats.doorDark);
    mouth.name = 'doorDark';
    g.add(mouth);
    const glow = glowSprite(K.tex.glow, hot(0xff4a12, 1.0), 8, 0.35);
    glow.position.set(0, 2.6, -1).applyMatrix4(frame);
    g.add(glow);
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(9, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: K.tex.glow, color: hot(0xff3a10, 0.8), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    spill.position.set(0, 0.22, 2.4).applyMatrix4(frame);
    spill.quaternion.setFromRotationMatrix(frame);
    spill.renderOrder = 2;
    g.add(spill);
    void r;
  }

  // ── the plume: the reek going up out of the crater, leaning east, and a
  // little from the lesser cone; the glow of the fire on its underside
  const r = rng(1901);
  const emits = [];
  for (let i = 0; i < 64; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 34;
    emits.push(V3(Math.cos(a) * d, 300 + r() * 14, Math.sin(a) * d));
  }
  const plume = cardCloud(mats.plume, emits, 1903);
  plume.name = 'plume';
  g.add(plume);
  const vent = [];
  for (let i = 0; i < 7; i++) vent.push(V3(230 + (r() - 0.5) * 16, 300 + r() * 4, -170 + (r() - 0.5) * 16));
  for (const p of vent) p.y = shape.at(Math.hypot(p.x, p.z), Math.atan2(p.z, p.x))[0] + 2;
  const wisps = cardCloud(mats.ventSmoke, vent, 1905);
  wisps.name = 'ventSmoke';
  g.add(wisps);
  const craterGlow = glowSprite(K.tex.glow, hot(0xff4410, 0.7), 320, 0.55);
  craterGlow.position.set(0, 345, 0);
  g.add(craterGlow);
  // fire thrown up out of the crater, when it erupts
  const fountainPts = [];
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 28;
    fountainPts.push(V3(Math.cos(a) * d, 300, Math.sin(a) * d));
  }
  const fountain = cardCloud(mats.fountain, fountainPts, 1907);
  fountain.name = 'fountain';
  g.add(fountain);
  const bombs = bombCloud(mats.bombs, 70, V3(0, 306, 0), 26, 1909);
  bombs.name = 'bombs';
  g.add(bombs);

  const update = (t, { erupt = 0 } = {}) => {
    const e = clamp01(erupt);
    U.uTime.value = t;
    U.uErupt.value = e;
    mats.doom.userData.glow.value = 1 + e * 1.8;
    mats.doomLava.uniforms.uHeat.value = 1.05 + e * 0.5;
    mats.doomLake.uniforms.uHeat.value = 1.2 + e * 0.6;
    mats.fountain.uniforms.uK.value = e * 1.3;
    mats.bombs.uniforms.uK.value = smooth(0.05, 0.4, e);
    mats.bombs.userData.fit(K.renderer);
    const f = 0.9 + 0.1 * Math.sin(t * 1.7) * Math.sin(t * 0.73 + 1);
    craterGlow.material.opacity = (0.45 + 0.5 * e) * f;
    craterGlow.scale.setScalar(320 + 260 * e);
    fountain.visible = e > 0.01;
    bombs.visible = e > 0.01;
  };
  update(0);
  return {
    group: g,
    door,
    road: (k) => road.curve.getPointAt(clamp01(k)).add(V3(0, 0.17, 0)),
    roadLength: road.length,
    groundAt: (x, z) => surface(x, z),
    update,
  };
}
