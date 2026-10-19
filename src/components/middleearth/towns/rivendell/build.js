// Rivendell's buildings, made in code (moved out of props.js, which keeps
// the falls' shaders and makes the kit): the house of Elrond, the room
// where Frodo wakes, Bilbo's pavilion, the hall of Narsil with its statue
// and the shards, the Council's court and its chairs, the bridge over the
// gorge, the south gate, lamps, the Ring and the terraces. Free of GLSL, so
// a 'nodes' world (the Road) may build with them on materials of its own:
// each takes a kit K = { mats, tex } as createRivendellKit (./props.js)
// makes one. The parts they are carved from (./parts.js), the valley
// (./valley.js) and the painted canvases (./canvases.js) are re-exported
// here, so the Road has one way in to all of it.

import * as THREE from 'three';
import { hot } from '../../../../lib/three/canvasTexture';
import { clamp01, makeNoise, mix } from '../../../../lib/paint';
import { B, ball, cyl, cylX, lathe, parts, rng, roundBox, tube } from '../../shire/build';
import { arcadeShape, archFill, archFrame, archOpening, archTop, archWindow, balustrade, bayRise, column, ext, friezeGeo, lanternParts, leafBlade, ribbon, roofOn, scaleU, shapeOf, shapeUV, wallShape } from './parts';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ── the house of Elrond ──

// The main hall of Elrond's house, 18 m across and 10 deep, its front to
// +z. Below, an open arcade of slender columns and pointed arches before a
// deep porch, the great door at its back; above, a storey of tall arched
// windows with a taller bay in the middle under a roof of its own, and at
// the east end of the front a round balcony on a carved corbel: Frodo's
// room. Upswept leaf-roofs with long eaves, gilt along their edges; a slim
// round tower at the back west corner under a tall leaf-roof of its own.
function house(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'house';
  const bk = parts();
  const W = 18;
  const D = 10;
  const base = 0.15; // the floor
  const H1 = 5.5; // the upper floor
  const H2 = 9.4; // the eaves
  const HC = 11.0; // the middle bay's eaves
  const PZ = 2; // the face of the porch's back wall
  const T = 0.4; // walls
  const colTop = 3.35;
  const xs = Array.from({ length: 8 }, (_, i) => -8.6 + (i * 17.2) / 7);
  const half = 0.27;
  const band = H1 - colTop;
  const lamps = [];

  // the plinth, the porch's paving
  bk.add(mats.elfstone, B(W + 0.6, base, D + 0.9), { p: [0, base / 2, 0.15], uv: 0.5 });
  bk.add(mats.pave, B(W - 0.4, 0.02, 5.6 - PZ), { p: [0, base + 0.01, (5.6 + PZ) / 2], uv: 0.45 });

  // the arcade: columns, the band of arches over them, mouldings round the
  // arches with a gilt line inside, a carved roundel over each column
  for (const x of xs) column(bk, K, { x, y: base, z: 4.75, h: colTop - base, r: 0.17 });
  bk.add(mats.elfstone, ext(arcadeShape(xs, half, band), 0.5), { p: [0, colTop, 4.5], uv: 0.5 });
  for (let i = 0; i < xs.length - 1; i++) {
    const a = (xs[i + 1] - xs[i] - 2 * half) / 2;
    const cx = (xs[i] + xs[i + 1]) / 2;
    const rise = bayRise(a, band);
    bk.add(mats.carve, ext(shapeOf(archFrame(a, 0, rise, 0.13, 9, 0.35)), 0.06), { p: [cx, colTop, 5.0], uv: 1 });
    bk.add(mats.gilt, ext(shapeOf(archFrame(a, 0, rise, 0.035, 9, 0.35)), 0.075), { p: [cx, colTop, 5.0] });
    archFill(bk, mats.stoneFill, { x: cx, y0: colTop + rise * 0.55, a: a * 0.55, rise: rise * 0.45, z: 4.75 });
  }
  for (const x of xs.slice(1, -1)) {
    bk.add(mats.carve, cyl(0.22, 0.22, 0.06, 16), { p: [x, colTop + band * 0.58, 5.02], r: [Math.PI / 2, 0, 0], uv: 1 });
    bk.add(mats.gilt, new THREE.TorusGeometry(0.22, 0.025, 4, 16), { p: [x, colTop + band * 0.58, 5.05] });
    bk.add(mats.gilt, leafBlade(0.3, 0.12, { curl: 0, seg: 3, thick: 0.01 }), { p: [x, colTop + band * 0.58 - 0.15, 5.06] });
  }

  // the porch: its ceiling on beams of warm wood, lanterns hanging
  bk.add(mats.carve, B(W - 0.6, 0.25, 4.5 - PZ), { p: [0, H1 - 0.125, (4.5 + PZ) / 2], uv: 0.5 });
  for (const x of xs.slice(1, -1)) bk.add(mats.elfwood, B(0.16, 0.24, 4.5 - PZ), { p: [x, H1 - 0.37, (4.5 + PZ) / 2], uv: 1 });
  for (const x of [-4.91, 4.91]) {
    bk.add(mats.gilt, cyl(0.012, 0.012, 0.75, 4), { p: [x, H1 - 0.62, 3.4] });
    lanternParts(bk, K, x, H1 - 1.25, 3.4, 1.2);
    lamps.push(V3(x, H1 - 1.25, 3.4));
  }

  // walls: each in its own frame, its face at z = 0, x along it
  const wall = (o, ry, w, h, opens, fn) =>
    bk.at(o, ry, () => {
      bk.add(mats.elfstone, ext(wallShape(w, h, opens), T), { p: [0, 0, -T], uv: 0.5 });
      fn?.();
    });
  const glassAt = (list, o = {}) => list.forEach((w) => archWindow(bk, K, { ...w, ...o }));

  // the porch's back wall and the great door
  const door = { x: 0, y: 0, a: 1.05, hs: 2.5, rise: 1.45 };
  const porchWins = [-6.6, -3.7, 3.7, 6.6].map((x) => ({ x, y: 1.0, a: 0.5, hs: 1.7, rise: 0.8 }));
  wall([0, base, PZ], 0, W, H1 - base, [door, ...porchWins], () => {
    glassAt(porchWins);
    archWindow(bk, K, { ...door, frame: 0.16, pane: false, sill: false, finial: true });
    // two leaves of warm wood, a gilt fan of tracery over them
    const top = door.hs + archTop(door.a, door.rise, 0.35);
    const outline = archOpening(door.a, door.hs, door.rise, 6, 0.35);
    const leafPts = outline.filter(([x]) => x <= 1e-6);
    leafPts.push([0, top], [0, 0]);
    for (const s of [-1, 1]) {
      const pts = s < 0 ? leafPts : leafPts.map(([x, y]) => [-x, y]).reverse();
      bk.add(mats.elfwood, ext(shapeOf(pts), 0.09), { p: [0, 0, -0.3], uv: 0.8 });
      for (const k of [0.32, 0.72]) bk.add(mats.gilt, B(0.03, door.hs - 0.3, 0.02), { p: [s * door.a * k, door.hs / 2, -0.2] });
      bk.add(mats.gilt, new THREE.TorusGeometry(0.07, 0.012, 4, 12), { p: [s * 0.16, 1.25, -0.19] });
    }
    archFill(bk, mats.giltTracery, { y0: door.hs, a: door.a - 0.02, rise: door.rise - 0.02, z: -0.19 });
    bk.add(mats.gilt, B(2 * door.a, 0.05, 0.03), { p: [0, door.hs, -0.19] });
    for (const s of [-1, 1]) {
      bk.add(mats.gilt, tube([[s * 1.6, 2.35, 0], [s * 1.68, 2.6, 0.22], [s * 1.7, 2.85, 0.32]], 0.02, 0.015, { seg: 5, radial: 4 }));
      lanternParts(bk, K, s * 1.7, 2.6, 0.32, 0.9);
      lamps.push(V3(s * 1.7, base + 2.6, PZ + 0.32));
    }
  });

  // the upper storey's front, either side of the middle bay
  const frontL = [-7.0, -4.4].map((x) => ({ x: x + 5.7, y: 0.55, a: 0.48, hs: 1.75, rise: 0.85 }));
  const frontR = [{ x: 3.7 - 5.7, y: 0.55, a: 0.48, hs: 1.75, rise: 0.85 }];
  const balconyDoor = { x: 6.14 - 5.7, y: 0, a: 0.72, hs: 2.15, rise: 1.05 };
  wall([-5.7, H1, 5.0], 0, 6.6, H2 - H1, frontL, () => glassAt(frontL, { finial: true }));
  wall([5.7, H1, 5.0], 0, 6.6, H2 - H1, [...frontR, balconyDoor], () => {
    glassAt(frontR, { finial: true });
    archWindow(bk, K, { ...balconyDoor, pane: mats.inside, depth: T - 0.04, sill: false, finial: true });
    // curtains drawn back either side of the doorway
    for (const s of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push([balconyDoor.x + s * (0.42 + k * 0.035), 0.12, -0.12 - Math.sin(k * 1.9) * 0.05]);
      bk.add(mats.curtain, ribbon(pts, 0, 2.9, 0.5));
    }
  });
  // the middle bay, taller, its great window
  const bigWin = { x: 0, y: 0.45, a: 0.85, hs: 2.6, rise: 1.45 };
  wall([0, H1, 5.3], 0, 4.8, HC - H1, [bigWin], () => {
    archWindow(bk, K, { ...bigWin, frame: 0.14, finial: true });
    bk.add(mats.frieze, friezeGeo(4.9, 0.4), { p: [0, HC - H1 - 0.5, 0.02] });
    bk.add(mats.carve, roundBox(5.2, 0.2, 0.36, 0.03), { p: [0, HC - H1 - 0.2, -0.06], uv: 1 });
  });
  for (const s of [-1, 1]) {
    bk.add(mats.elfstone, B(T, HC - H1, 8.3), { p: [s * (2.4 - T / 2), (H1 + HC) / 2, 1.15], uv: 0.5 });
    bk.add(mats.frieze, friezeGeo(8.3, 0.4, 'z'), { p: [s * 2.42, HC - 0.5, 1.15] });
    bk.add(mats.carve, roundBox(0.36, 0.2, 8.6, 0.03), { p: [s * 2.42, HC - 0.2, 1.15], uv: 1 });
  }
  bk.add(mats.elfstone, B(4.8, HC - H1, T), { p: [0, (H1 + HC) / 2, -3 + T / 2], uv: 0.5 });
  bk.add(mats.carve, B(4.7, 0.12, 8.2), { p: [0, HC - 0.06, 1.15], uv: 0.5 });

  // pilasters between the upper windows, each with a leafy capital
  for (const x of [-8.72, -5.7, -2.62, 2.62, 4.82, 8.72]) {
    bk.add(mats.carve, roundBox(0.26, H2 - H1 - 0.85, 0.1, 0.02), { p: [x, (H1 + H2 - 0.85) / 2 + 0.05, 5.04], uv: 1 });
    bk.add(mats.carve, roundBox(0.36, 0.16, 0.14, 0.02), { p: [x, H1 + 0.12, 5.05], uv: 1 });
    for (const s of [-1, 1]) bk.add(mats.gilt, leafBlade(0.32, 0.12, { curl: 0.9, seg: 3, thick: 0.01 }), { p: [x + s * 0.05, H2 - 0.95, 5.08], r: [0, s * 0.5, s * -0.3] });
  }

  // the sides, full height: a tall arch through to the porch, windows
  for (const s of [-1, 1]) {
    const wins = [
      { x: s * 1.0, y: 1.0, a: 0.48, hs: 1.7, rise: 0.8 },
      { x: s * 1.2, y: H1 - base + 0.55, a: 0.48, hs: 1.75, rise: 0.85 },
      { x: -s * 2.4, y: H1 - base + 0.55, a: 0.48, hs: 1.75, rise: 0.85 },
    ];
    const arch = { x: -s * 3.5, y: 0, a: 1.05, hs: 2.0, rise: 1.4 };
    wall([s * 9, base, 0], (s * Math.PI) / 2, D, H2 - base, [arch, ...wins], () => {
      glassAt(wins);
      archWindow(bk, K, { ...arch, pane: false, sill: false, frame: 0.14 });
    });
  }

  // the back, full height
  const back = [
    ...[-4.2, -0.8, 2.6, 6.2].map((x) => ({ x: -x, y: 1.0, a: 0.48, hs: 1.7, rise: 0.8 })),
    ...[-4.6, -1.6, 1.6, 4.6, 7.4].map((x) => ({ x: -x, y: H1 - base + 0.55, a: 0.48, hs: 1.75, rise: 0.85 })),
  ];
  wall([0, base, -5], Math.PI, W, H2 - base, back, () => glassAt(back, { gilt: false }));

  // string course at the upper floor, frieze and cornice at the eaves
  bk.add(mats.carve, roundBox(W + 0.4, 0.22, 0.42, 0.03), { p: [0, H1, 4.92], uv: 1 });
  bk.add(mats.gilt, B(W + 0.42, 0.03, 0.03), { p: [0, H1 - 0.07, 5.14] });
  bk.add(mats.carve, roundBox(W + 0.4, 0.22, 0.42, 0.03), { p: [0, H1, -4.92], uv: 1 });
  for (const s of [-1, 1]) bk.add(mats.carve, roundBox(0.42, 0.22, D + 0.4, 0.03), { p: [s * 8.92, H1, 0], uv: 1 });
  for (const s of [-1, 1]) bk.add(mats.frieze, friezeGeo(6.6, 0.4), { p: [s * 5.7, H2 - 0.35, 5.03] });
  bk.add(mats.frieze, friezeGeo(W, 0.4), { p: [0, H2 - 0.35, -5.03] });
  for (const s of [-1, 1]) bk.add(mats.frieze, friezeGeo(D, 0.4, 'z'), { p: [s * 9.03, H2 - 0.35, 0] });
  bk.add(mats.carve, roundBox(W + 0.5, 0.2, D + 0.5, 0.04), { p: [0, H2 - 0.07, 0], uv: 1 });
  bk.add(mats.carve, B(W - 0.1, 0.12, D - 0.1), { p: [0, H2 - 0.06, 0], uv: 0.5 });

  // the balcony: a half-round floor on a corbel that springs from a column
  const bx = xs[6];
  const bTop = H1 + 0.12;
  bk.add(mats.carve, lathe([[0.26, colTop], [0.34, colTop + 0.2], [0.5, colTop + 0.7], [0.85, colTop + 1.2], [1.35, bTop - 0.62], [1.8, bTop - 0.42], [1.98, bTop - 0.36]], 18, -Math.PI / 2, Math.PI), { p: [bx, 0, 5.0], uv: 1 });
  bk.add(mats.elfstone, new THREE.CylinderGeometry(2.0, 1.98, 0.36, 24, 1, false, -Math.PI / 2, Math.PI), { p: [bx, bTop - 0.18, 5.0], uv: 0.6 });
  bk.add(mats.gilt, new THREE.TorusGeometry(2.0, 0.025, 4, 24, Math.PI), { p: [bx, bTop - 0.3, 5.0], r: [Math.PI / 2, 0, 0] });
  bk.add(mats.pave, new THREE.CircleGeometry(1.95, 24, Math.PI, Math.PI), { p: [bx, bTop + 0.005, 5.0], r: [-Math.PI / 2, 0, 0] });
  // gilt ribs down the corbel
  const corbel = [[0.3, colTop + 0.1], [0.38, colTop + 0.3], [0.54, colTop + 0.72], [0.88, colTop + 1.2], [1.38, bTop - 0.62], [1.83, bTop - 0.42]];
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + ((k + 0.5) / 5) * Math.PI;
    bk.add(mats.gilt, tube(corbel.map(([r, y]) => [bx + Math.sin(a) * (r + 0.02), y, 5.0 + Math.cos(a) * (r + 0.02)]), 0.03, 0.03, { seg: 10, radial: 4 }));
  }
  const rail = [];
  for (let k = 0; k <= 24; k++) {
    const a = -Math.PI / 2 + (k / 24) * Math.PI;
    rail.push([bx + Math.sin(a) * 1.82, bTop, 5.0 + Math.cos(a) * 1.82]);
  }
  balustrade(bk, K, rail, { h: 1.0, step: 1.15 });

  // the roofs: the long one, the middle bay's across it
  const main = roofOn(bk, K, { ridge: 3.8, dx: 6.4, dz: 6.3, rise: 5.0, prof: (q) => Math.pow(1 - q, 1.4), lift: 0.3, tips: 0.6, n: 5, rings: 11, around: 64 }, { p: [0, H2 + 0.02, 0], finial: 1.4 });
  // curved brackets of warm wood from the cornice up under the eaves
  const bracket = (x, z, nx, nz) => {
    const ex = x + nx * 0.85;
    const ez = z + nz * 0.85;
    const ey = H2 + 0.02 + main.yAt(ex, ez) - main.t - 0.04;
    bk.add(mats.elfwood, tube([[x - nx * 0.1, H2 - 0.32, z - nz * 0.1], [x + nx * 0.12, H2 + 0.02, z + nz * 0.12], [x + nx * 0.5, ey - 0.2, z + nz * 0.5], [ex, ey, ez]], 0.065, 0.045, { seg: 6, radial: 4 }), { uv: 1.5 });
  };
  for (let x = -8.2; x <= 8.3; x += 2.05) {
    if (Math.abs(x) > 2.8) bracket(x, 5.2, 0, 1);
    if (x > -6.4) bracket(x, -5.2, 0, -1);
  }
  for (const s of [-1, 1]) for (let z = -3.6; z <= 4; z += 2.4) if (s > 0 || z > -2.3) bracket(s * 9.2, z, s, 0);
  roofOn(bk, K, { ridge: 2.2, dx: 2.6, dz: 3.3, rise: 4.0, prof: (q) => Math.pow(1 - q, 1.4), lift: 0.25, tips: 0.5, n: 5, rings: 10, around: 56 }, { p: [0, HC + 0.02, 1.15], ry: Math.PI / 2, finial: 1.3 });

  // the tower at the back west corner
  const tx = -8.3;
  const tz = -4.3;
  const rt = 1.75;
  const TT = 14.0;
  bk.add(mats.elfstone, lathe([[rt + 0.2, 0], [rt + 0.2, 0.45], [rt, 0.62], [rt, TT]], 24), { p: [tx, 0, tz], uv: 0.5 });
  for (const y of [H1, H2]) bk.add(mats.carve, lathe([[rt, y - 0.1], [rt + 0.14, y - 0.06], [rt + 0.14, y + 0.08], [rt, y + 0.12]], 24), { p: [tx, 0, tz], uv: 1 });
  bk.add(mats.carve, lathe([[rt, 11.6], [rt + 0.2, 11.9], [rt + 0.5, 12.15], [rt + 0.6, 12.2], [rt + 0.6, 12.38], [rt, 12.38]], 24), { p: [tx, 0, tz], uv: 1 });
  const ring = [];
  for (let k = 0; k <= 28; k++) ring.push([tx + Math.cos((k / 28) * TAU) * (rt + 0.45), 12.38, tz + Math.sin((k / 28) * TAU) * (rt + 0.45)]);
  balustrade(bk, K, ring, { h: 0.85, step: 1.6, ends: false });
  bk.add(mats.frieze, scaleU(new THREE.CylinderGeometry(rt + 0.03, rt + 0.03, 0.4, 24, 1, true), (TAU * rt) / 1.6), { p: [tx, TT - 0.45, tz] });
  bk.add(mats.carve, lathe([[rt, TT - 0.25], [rt + 0.2, TT - 0.15], [rt + 0.25, TT], [rt, TT + 0.05]], 24), { p: [tx, 0, tz], uv: 1 });
  for (const [y, a] of [[1.6, -2.4], [6.3, -2.4], [6.3, Math.PI], [10.1, -2.0], [10.1, 2.8], [10.1, -0.9]]) {
    bk.at([tx + Math.cos(a) * rt, y, tz + Math.sin(a) * rt], Math.PI / 2 - a, () => archWindow(bk, K, { x: 0, y: 0, a: 0.26, hs: 0.95, rise: 0.5, depth: -0.02, gilt: y > 10, frame: 0.08 }));
  }
  roofOn(bk, K, { dx: 2.55, dz: 2.55, rise: 5.6, prof: (s) => Math.pow(1 - s, 1.9), lift: 0.35, tips: 0, n: 2, rings: 14, around: 40 }, { p: [tx, TT + 0.02, tz], ribs: [0, 0.25, 0.5, 0.75], finial: 1.5 });

  bk.build(g);
  return {
    group: g,
    balcony: V3(bx, bTop, 5.9),
    door: V3(0, base + 0.02, PZ + 0.6),
    lamps,
    footprint: { w: W, d: D },
    porch: { z0: PZ, z1: 5, x0: -9, x1: 9 },
    tower: { x: tx, z: tz, r: rt + 0.2 },
  };
}

// ── furnishings ──

// A cloth over a w × d top (its middle at the origin, the top at y = 0),
// hanging `hang` down over the sides listed ([-x, +x, -z, +z]), in soft
// folds that deepen towards the hem.
function drapeGeo(w, d, hang, { sides = [1, 1, 1, 1], folds = 9, depth = 0.025, nx = 24, nz = 14, seed = 1 } = {}) {
  const n = makeNoise(seed);
  const x0 = -w / 2 - (sides[0] ? hang : 0);
  const x1 = w / 2 + (sides[1] ? hang : 0);
  const z0 = -d / 2 - (sides[2] ? hang : 0);
  const z1 = d / 2 + (sides[3] ? hang : 0);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const v = j / nz;
      const x = mix(x0, x1, u);
      const z = mix(z0, z1, v);
      const ex = Math.max(0, Math.abs(x) - w / 2);
      const ez = Math.max(0, Math.abs(z) - d / 2);
      const e = Math.hypot(ex, ez);
      const k = Math.min(1, e / hang);
      // over the edge it hangs, standing a little out, rippled into folds
      const along = ex > ez ? z : x;
      const ripple = Math.sin(along * folds * 2 + n(along * 3, 1) * 3) * depth * k;
      const ox = ex > 0 ? Math.sign(x) * (w / 2 + e * 0.12 + (ex >= ez ? ripple : 0)) : x;
      const oz = ez > 0 ? Math.sign(z) * (d / 2 + e * 0.12 + (ez > ex ? ripple : 0)) : z;
      const y = e > 0 ? -e * 0.98 : (n(x * 6, z * 6) - 0.5) * 0.008;
      pos.push(ox, y, oz);
      uv.push(u * (x1 - x0), v * (z1 - z0));
      if (i && j) {
        const a = (j - 1) * (nx + 1) + i - 1;
        const b = a + nx + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A high-backed elven chair facing +x (its back to -x, its seat's middle
// over the origin): curved legs, a cushioned seat, arms that end in
// scrolls, and a tall back shaped like a pointed arch, gilt tracery in its
// head and gilt leaves on its posts.
function chairParts(bk, K, { back = 2.0, seatH = 0.5, w = 0.64, d = 0.56, cushion = null } = {}) {
  const { mats } = K;
  const wood = mats.elfwood;
  const hx = d / 2;
  const hz = w / 2;
  bk.add(wood, roundBox(d, 0.07, w, 0.02), { p: [0, seatH - 0.035, 0], uv: 1 });
  bk.add(cushion || mats.velvet, roundBox(d - 0.06, 0.07, w - 0.1, 0.03), { p: [0.01, seatH + 0.03, 0], uv: 1 });
  const ay = seatH + 0.26;
  for (const s of [-1, 1]) {
    bk.add(wood, tube([[hx - 0.05, seatH - 0.05, s * (hz - 0.05)], [hx, seatH * 0.45, s * (hz - 0.03)], [hx + 0.05, 0.02, s * hz]], 0.03, 0.022, { seg: 4, radial: 4 }), { uv: 2 });
    bk.add(wood, tube([[-hx + 0.02, 0, s * hz], [-hx + 0.04, seatH, s * (hz - 0.02)], [-hx + 0.01, mix(seatH, back, 0.6), s * (hz - 0.03)], [-hx - 0.02, back - 0.04, s * (hz - 0.05)]], 0.034, 0.026, { seg: 6, radial: 4 }), { uv: 2 });
    bk.add(mats.gilt, leafBlade(0.2, 0.08, { curl: 0.6, seg: 3, thick: 0.008 }), { p: [-hx - 0.02, back - 0.05, s * (hz - 0.05)], r: [0, -Math.PI / 2, 0] });
    bk.add(wood, tube([[-hx, ay + 0.02, s * (hz - 0.01)], [0, ay + 0.04, s * (hz + 0.03)], [hx, ay, s * (hz + 0.02)], [hx + 0.07, ay - 0.06, s * hz], [hx + 0.03, ay - 0.11, s * hz], [hx - 0.01, ay - 0.06, s * hz]], 0.026, 0.018, { seg: 8, radial: 4 }), { uv: 2 });
    bk.add(wood, tube([[hx - 0.03, seatH, s * (hz - 0.02)], [hx - 0.01, ay - 0.09, s * hz]], 0.018, 0.018, { seg: 2, radial: 4 }));
  }
  // the back: a pointed arch of wood with a carved rim, gilt tracery in its head
  const a = hz - 0.06;
  const rise = a * 1.7;
  const hs = Math.max(0.2, back - seatH - 0.14 - archTop(a, rise, 0.4) - 0.04);
  bk.at([-hx + 0.0, seatH + 0.1, 0], Math.PI / 2, () => {
    bk.add(wood, ext(shapeOf(archOpening(a, hs, rise, 6, 0.4)), 0.035), { p: [0, 0, -0.035], uv: 1.5 });
    bk.add(wood, ext(shapeOf(archFrame(a - 0.05, hs, rise - 0.06, 0.05, 6, 0.4)), 0.025), { p: [0, 0, 0], uv: 1.5 });
    archFill(bk, mats.giltTracery, { y0: hs, a: a - 0.06, rise: rise - 0.08, kick: 0.4, z: 0.012, n: 6 });
    bk.add(mats.gilt, B(2 * a - 0.12, 0.02, 0.02), { p: [0, hs, 0.012] });
    bk.add(mats.gilt, leafBlade(0.22, 0.09, { curl: 0.3, seg: 3, thick: 0.008 }), { p: [0, hs + archTop(a, rise, 0.4) - 0.02, -0.018] });
  });
}

// ── the room where Frodo wakes ──

// Frodo's room in the house of Elrond, a set apart from the town (as
// Bree's common room is): 6 m by 5, its floor at y = 0, pale walls under a
// ceiling of curved ribs, tall arched windows down the +x side full of
// sun with shafts of it falling across the floor; a carved bed with white
// linen and pillows, its head to -z; a chair beside it for Gandalf; a
// little table with a jug; a rug; a chest; the door in the -x wall, its
// leaf hung so it can swing.
function bedroom(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'bedroom';
  const bk = parts();
  const W = 6;
  const D = 5;
  const H = 4.4;
  const T = 0.25;
  bk.add(mats.pave, B(W + 2 * T, 0.1, D + 2 * T), { p: [0, -0.05, 0], uv: 0.6 });
  bk.add(mats.carve, B(W + 2 * T, 0.15, D + 2 * T), { p: [0, H + 0.075, 0], uv: 0.5 });
  for (let x = -2.4; x <= 2.41; x += 1.2) bk.add(mats.elfwood, tube([[x, H - 0.55, -D / 2], [x, H - 0.12, -D / 4], [x, H - 0.05, 0], [x, H - 0.12, D / 4], [x, H - 0.55, D / 2]], 0.07, 0.07, { seg: 12, radial: 5 }), { uv: 1.5 });
  bk.add(mats.elfwood, tube([[-W / 2, H - 0.06, 0], [W / 2, H - 0.06, 0]], 0.08, 0.08, { seg: 2, radial: 5 }), { uv: 1.5 });
  // the walls, their faces to the room
  const wins = [-1.5, 0, 1.5].map((z) => ({ x: z, y: 0.75, a: 0.5, hs: 2.1, rise: 1.0 }));
  const door = { x: -1.2, y: 0, a: 0.6, hs: 2.2, rise: 0.85 };
  bk.add(mats.elfstone, B(W + 2 * T, H, T), { p: [0, H / 2, -D / 2 - T / 2], uv: 0.5 });
  bk.add(mats.elfstone, B(W + 2 * T, H, T), { p: [0, H / 2, D / 2 + T / 2], uv: 0.5 });
  bk.at([W / 2, 0, 0], -Math.PI / 2, () => {
    bk.add(mats.elfstone, ext(wallShape(D, H, wins), T), { p: [0, 0, -T], uv: 0.5 });
    wins.forEach((w) => archWindow(bk, K, { ...w, pane: mats.sunpane, depth: T * 0.6 }));
    for (const z of [-0.75, 0.75]) bk.add(mats.carve, roundBox(0.2, H - 0.9, 0.08, 0.02), { p: [z, (H - 0.9) / 2 + 0.05, 0.03], uv: 1 });
    for (const w of wins) {
      for (const s of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 6; k++) pts.push([w.x + s * (0.62 + k * 0.03), 0.02, 0.08 + Math.sin(k * 2.1) * 0.035]);
        bk.add(mats.curtain, ribbon(pts, 0, 3.7, 0.4));
      }
      bk.add(mats.gilt, cylX(0.015, 1.5, 6), { p: [w.x, 3.75, 0.08], r: [0, 0, 0] });
    }
  });
  bk.at([-W / 2, 0, 0], Math.PI / 2, () => {
    bk.add(mats.elfstone, ext(wallShape(D, H, [door]), T), { p: [0, 0, -T], uv: 0.5 });
    archWindow(bk, K, { ...door, pane: false, sill: false, frame: 0.12, finial: true });
  });
  // a carved frieze round the top of the walls
  for (const s of [-1, 1]) {
    bk.add(mats.frieze, friezeGeo(W, 0.36), { p: [0, H - 0.4, s * (D / 2 - 0.02)] });
    bk.add(mats.frieze, friezeGeo(D, 0.36, 'z'), { p: [s * (W / 2 - 0.02), H - 0.4, 0] });
  }

  // the bed, its head to the back wall
  const bx = 0.7;
  const bz = -1.25;
  const top = 0.62;
  bk.at([bx, 0, -2.42], 0, () => {
    bk.add(mats.elfwood, ext(shapeOf(archOpening(0.86, 1.0, 0.7, 8, 0.4)), 0.07), { p: [0, 0.25, -0.04], uv: 1.2 });
    bk.add(mats.elfwood, ext(shapeOf(archFrame(0.7, 0.95, 0.56, 0.06, 8, 0.4)), 0.03), { p: [0, 0.3, 0.03], uv: 1.2 });
    archFill(bk, mats.giltTracery, { y0: 1.25, a: 0.68, rise: 0.54, kick: 0.4, z: 0.045 });
    bk.add(mats.gilt, B(1.36, 0.025, 0.02), { p: [0, 1.25, 0.05] });
    bk.add(mats.gilt, leafBlade(0.3, 0.12, { curl: 0.3, seg: 3, thick: 0.01 }), { p: [0, 0.25 + 1.0 + archTop(0.86, 0.7, 0.4), 0] });
  });
  for (const [sx, sz, h] of [[-1, -1, 1.55], [1, -1, 1.55], [-1, 1, 0.95], [1, 1, 0.95]]) {
    const x = bx + sx * 0.86;
    const z = bz + sz * 1.17;
    bk.add(mats.elfwood, lathe([[0.06, 0], [0.06, 0.08], [0.045, 0.14], [0.042, h - 0.12], [0.06, h - 0.06], [0.03, h]], 8), { p: [x, 0, z], uv: 1.5 });
    bk.add(mats.gilt, leafBlade(0.16, 0.07, { curl: 0.2, seg: 3, thick: 0.008 }), { p: [x, h - 0.01, z] });
  }
  bk.at([bx, 0, bz + 1.18], 0, () => {
    bk.add(mats.elfwood, ext(shapeOf(archOpening(0.82, 0.45, 0.32, 8, 0.4)), 0.05), { p: [0, 0.2, -0.025], uv: 1.2 });
    bk.add(mats.gilt, ext(shapeOf(archFrame(0.7, 0.4, 0.24, 0.025, 8, 0.4)), 0.012), { p: [0, 0.25, 0.025] });
  });
  for (const s of [-1, 1]) bk.add(mats.elfwood, roundBox(0.07, 0.2, 2.3, 0.02), { p: [bx + s * 0.84, 0.36, bz], uv: 1.2 });
  bk.add(mats.linen, roundBox(1.62, 0.24, 2.26, 0.08), { p: [bx, top - 0.12, bz], uv: 1.5 });
  bk.add(mats.coverlet, drapeGeo(1.66, 1.6, 0.3, { sides: [1, 1, 0, 1], folds: 7, seed: 3 }), { p: [bx, top + 0.025, bz + 0.35] });
  bk.add(mats.linen, roundBox(1.7, 0.035, 0.22, 0.015), { p: [bx, top + 0.04, bz - 0.38], r: [0.05, 0, 0], uv: 1.5 });
  for (const s of [-1, 1]) {
    const pill = new THREE.SphereGeometry(0.3, 14, 8);
    bk.add(mats.linen, pill, { p: [bx + s * 0.36, top + 0.08, bz - 0.85], s: [1.15, 0.36, 0.72], r: [-0.25, s * 0.08, 0], uv: 1.5 });
  }

  // Gandalf's chair beside the bed, facing it; a table with a jug at the
  // bed's head; a chest at its foot; a rug
  bk.at([2.15, 0, -1.0], Math.PI, () => chairParts(bk, K, { back: 1.55, seatH: 0.48, w: 0.6, d: 0.52 }));
  const tx = -0.65;
  const tz = -1.95;
  bk.add(mats.elfwood, lathe([[0.001, 0.68], [0.3, 0.68], [0.32, 0.65], [0.3, 0.62], [0.05, 0.6], [0.04, 0.4], [0.06, 0.2], [0.04, 0.08], [0.001, 0.06]], 14), { p: [tx, 0, tz], uv: 1.5 });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.5;
    bk.add(mats.elfwood, tube([[tx, 0.12, tz], [tx + Math.cos(a) * 0.16, 0.06, tz + Math.sin(a) * 0.16], [tx + Math.cos(a) * 0.24, 0.0, tz + Math.sin(a) * 0.24]], 0.025, 0.018, { seg: 4, radial: 4 }));
  }
  bk.add(mats.glaze, lathe([[0.001, 0], [0.07, 0.005], [0.085, 0.06], [0.08, 0.14], [0.05, 0.2], [0.045, 0.24], [0.06, 0.27], [0.055, 0.28], [0.035, 0.24]], 12), { p: [tx + 0.06, 0.68, tz + 0.02], uv: 3 });
  bk.add(mats.glaze, tube([[tx + 0.06 - 0.05, 0.25, tz + 0.02], [tx + 0.06 - 0.13, 0.22, tz + 0.02], [tx + 0.06 - 0.1, 0.1, tz + 0.02], [tx + 0.06 - 0.07, 0.07, tz + 0.02]].map(([x, y, z]) => [x, y + 0.68, z]), 0.012, 0.012, { seg: 6, radial: 4 }));
  bk.add(mats.glaze, lathe([[0.001, 0], [0.035, 0.002], [0.045, 0.07], [0.04, 0.075]], 10), { p: [tx - 0.14, 0.68, tz + 0.1] });
  bk.add(mats.gilt, lathe([[0.001, 0], [0.04, 0.01], [0.05, 0.08], [0.03, 0.14], [0.035, 0.17]], 10), { p: [tx - 0.08, 0.68, tz - 0.14] });
  for (let k = 0; k < 4; k++) bk.add(mats.leafGold, leafBlade(0.14, 0.06, { curl: 0.8, seg: 3, thick: 0.004 }), { p: [tx - 0.08, 0.84, tz - 0.14], r: [0, k * 1.6, 0.3] });
  bk.add(mats.elfwood, roundBox(1.1, 0.5, 0.48, 0.03), { p: [bx, 0.25, 0.32], uv: 1.2 });
  bk.add(mats.elfwood, roundBox(1.14, 0.06, 0.52, 0.025), { p: [bx, 0.52, 0.32], uv: 1.2 });
  for (const s of [-1, 1]) bk.add(mats.gilt, B(0.04, 0.52, 0.5), { p: [bx + s * 0.4, 0.27, 0.32] });
  bk.add(mats.rug, new THREE.PlaneGeometry(2.6, 1.6), { p: [-1.0, 0.012, 0.9], r: [-Math.PI / 2, 0, 0] });
  bk.build(g);

  // the door's leaf, hung on its hinge to swing
  const doorLeaf = new THREE.Group();
  doorLeaf.name = 'doorLeaf';
  const lk = parts();
  const outline = archOpening(door.a - 0.02, door.hs, door.rise - 0.02, 6, 0.35).map(([x, y]) => [x + door.a, y]);
  lk.add(mats.elfwood, ext(shapeOf(outline), 0.07), { p: [0, 0, -0.035], uv: 1.2 });
  for (const k of [0.35, 0.85]) lk.add(mats.gilt, B(0.03, door.hs - 0.3, 0.02), { p: [door.a * 2 * k, door.hs / 2, 0.04] });
  lk.add(mats.gilt, new THREE.TorusGeometry(0.06, 0.01, 4, 12), { p: [door.a * 2 - 0.15, 1.1, 0.05] });
  lk.build(doorLeaf);
  doorLeaf.position.set(-W / 2 - T / 2, 0, -door.x - door.a);
  doorLeaf.rotation.y = -Math.PI / 2;
  doorLeaf.userData.shut = -Math.PI / 2;
  g.add(doorLeaf);

  // shafts of sun through the windows, and where they fall on the floor
  const sk = parts();
  const dir = [-1, -0.68, 0.24];
  const y0 = 0.8;
  const y1 = 3.7;
  for (const w of wins) {
    const z0 = w.x - 0.48;
    const z1 = w.x + 0.48;
    const reach = y1 / -dir[1];
    const P = (y, z, t) => [W / 2 + dir[0] * t, y + dir[1] * t, z + dir[2] * t];
    const quad = (a, b, c, d) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      geo.setIndex([0, 1, 2, 1, 3, 2]);
      geo.computeVertexNormals();
      sk.add(mats.shaft, geo);
    };
    quad(P(y0, z0, 0), P(y1, z0, 0), P(y0, z0, reach), P(y1, z0, reach));
    quad(P(y0, z1, 0), P(y1, z1, 0), P(y0, z1, reach), P(y1, z1, reach));
    quad(P(y1, z0, 0), P(y1, z1, 0), P(y1, z0, reach), P(y1, z1, reach));
    quad(P(y0, z0, 0), P(y0, z1, 0), P(y0, z0, reach), P(y0, z1, reach));
    // the patch of sun on the floor
    const f = (y, z) => P(y, z, y / -dir[1]).map((v, i) => (i === 1 ? 0.01 : v));
    quad(f(y0, z0), f(y0, z1), f(y1, z0), f(y1, z1));
  }
  const shafts = sk.build(g, { shadow: false, receive: false });
  for (const m of shafts) m.renderOrder = 2;

  return {
    group: g,
    bed: V3(bx, top + 0.06, bz + 0.1),
    chair: V3(2.15, 0.48, -1.0),
    chairFace: Math.PI,
    door: V3(-W / 2 + 0.5, 0, -door.x),
    sun: V3(W / 2 - 0.5, 2.6, 0),
    doorLeaf,
    windows: wins.map((w) => V3(W / 2, w.y + 1.5, w.x)),
  };
}

// ── Bilbo's room ──

// A candle on a little gilt dish, its flame at the top (y + 0.2 · s).
function candleParts(bk, K, x, y, z, s = 1) {
  const { mats } = K;
  bk.add(mats.gilt, lathe([[0.001, 0], [0.05 * s, 0.004], [0.055 * s, 0.015], [0.02 * s, 0.02]], 10), { p: [x, y, z] });
  bk.add(mats.wax, cyl(0.016 * s, 0.018 * s, 0.17 * s, 8), { p: [x, y + 0.1 * s, z] });
  bk.add(mats.flame, lathe([[0.001, 0], [0.011 * s, 0.012 * s], [0.012 * s, 0.025 * s], [0.001, 0.06 * s]], 6), { p: [x, y + 0.19 * s, z] });
  return V3(x, y + 0.21 * s, z);
}

// Bilbo's room: an open pavilion of eight slender columns, 6 m across, its
// front (to +z) open, under an ogee dome of bronze-green leaf with a gilt
// finial; a low balustrade round the other seven sides; a carved screen at
// the back with his map hung on it. Inside, his writing desk with the book
// open on it, ink and quill, candles, papers and scrolls, his chair, a rug.
function pavilion(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'pavilion';
  const bk = parts();
  const R = 3.0;
  const y0 = 0.35;
  const colH = 3.0;
  const bandH = 0.9;
  const side = 2 * R * Math.sin(Math.PI / 8);
  const ap = R * Math.cos(Math.PI / 8);
  const corner = (k) => [R * Math.cos(Math.PI / 8 + (k * Math.PI) / 4), R * Math.sin(Math.PI / 8 + (k * Math.PI) / 4)];
  // the platform, a step to the front
  bk.add(mats.elfstone, new THREE.CylinderGeometry(R + 0.4, R + 0.5, y0, 8, 1, false, Math.PI / 8), { p: [0, y0 / 2, 0], uv: 0.6 });
  bk.add(mats.carve, new THREE.CylinderGeometry(R + 0.43, R + 0.43, 0.06, 8, 1, false, Math.PI / 8), { p: [0, y0 - 0.03, 0], uv: 1 });
  bk.add(mats.pave, new THREE.CircleGeometry(R + 0.36, 8, Math.PI / 8), { p: [0, y0 + 0.003, 0], r: [-Math.PI / 2, 0, 0], uv: 0.5 });
  bk.add(mats.elfstone, B(2.3, y0 / 2, 0.55), { p: [0, y0 / 4, (R + 0.45) * Math.cos(Math.PI / 8) + 0.27], uv: 0.6 });
  for (let k = 0; k < 8; k++) {
    const [x, z] = corner(k);
    column(bk, K, { x, y: y0, z, h: colH, r: 0.13 });
  }
  // the arches between the columns, the cornice over them
  for (let k = 0; k < 8; k++) {
    const pm = (k * Math.PI) / 4;
    bk.at([Math.cos(pm) * (ap - 0.11), y0 + colH, Math.sin(pm) * (ap - 0.11)], Math.PI / 2 - pm, () => {
      bk.add(mats.elfstone, ext(arcadeShape([-side / 2, side / 2], 0.24, bandH, { ratio: 1.5 }), 0.22), { p: [0, 0, -0.11], uv: 0.6 });
      const a = side / 2 - 0.24;
      const rise = bayRise(a, bandH, { ratio: 1.5 });
      bk.add(mats.carve, ext(shapeOf(archFrame(a, 0, rise, 0.09, 8, 0.35)), 0.04), { p: [0, 0, 0.11], uv: 1 });
      bk.add(mats.gilt, ext(shapeOf(archFrame(a, 0, rise, 0.025, 8, 0.35)), 0.05), { p: [0, 0, 0.11] });
      archFill(bk, mats.stoneFill, { y0: rise * 0.4, a: a * 0.62, rise: rise * 0.58 });
    });
  }
  const cy = y0 + colH + bandH;
  bk.add(mats.carve, new THREE.CylinderGeometry(R + 0.3, R + 0.18, 0.22, 8, 1, false, Math.PI / 8), { p: [0, cy + 0.11, 0], uv: 1 });
  bk.add(mats.gilt, new THREE.CylinderGeometry(R + 0.31, R + 0.31, 0.03, 8, 1, true, Math.PI / 8), { p: [0, cy + 0.17, 0] });
  bk.add(mats.carve, new THREE.CircleGeometry(R + 0.1, 8, Math.PI / 8), { p: [0, cy - 0.01, 0], r: [Math.PI / 2, 0, 0], uv: 0.5 });
  // a low drum the dome sits on
  bk.add(mats.frieze, scaleU(new THREE.CylinderGeometry(R + 0.06, R + 0.12, 0.9, 8, 1, true, Math.PI / 8), (8 * 2 * (R + 0.1) * Math.sin(Math.PI / 8)) / 1.4), { p: [0, cy + 0.65, 0] });
  roofOn(bk, K, { sides: 8, rot: Math.PI / 8, dx: 3.75, dz: 3.75, rise: 3.1, prof: (q) => Math.pow(Math.max(0, 1 - Math.pow(q, 0.85)), 0.62), lift: 0.3, tips: 0.4, rings: 14, around: 64 }, { p: [0, cy + 0.2, 0], finial: 1.3 });
  // a low balustrade round all but the front
  for (let k = 0; k < 8; k++) {
    if (k === 1) continue; // the side between corners 1 and 2 faces +z
    const a = corner(k);
    const b = corner(k + 1);
    const P = (t) => [mix(a[0], b[0], t), y0, mix(a[1], b[1], t)];
    balustrade(bk, K, [P(0.08), P(0.92)], { h: 0.85, posts: false });
  }

  // the screen at the back, and the map hung on it
  const bz = -ap + 0.12;
  bk.add(mats.elfwood, B(side + 0.2, 0.08, 0.08), { p: [0, y0 + 2.75, bz], uv: 1.5 });
  bk.add(mats.elfwood, B(side + 0.1, 0.06, 0.06), { p: [0, y0 + 1.0, bz], uv: 1.5 });
  for (const s of [-1, 1]) bk.add(mats.gilt, ball(0.045, 8, 6), { p: [s * (side / 2 + 0.1), y0 + 2.75, bz] });
  const mapGeo = new THREE.PlaneGeometry(1.5, 1.12, 8, 4);
  const mp = mapGeo.attributes.position;
  for (let k = 0; k < mp.count; k++) mp.setZ(k, Math.sin(mp.getX(k) * 4) * 0.012 + (mp.getY(k) < -0.4 ? (mp.getY(k) + 0.4) * -0.15 : 0));
  mapGeo.computeVertexNormals();
  bk.add(mats.map, mapGeo, { p: [0, y0 + 2.12, bz + 0.07] });
  bk.add(mats.elfwood, cylX(0.022, 1.62, 8), { p: [0, y0 + 2.69, bz + 0.07] });
  bk.add(mats.rope, tube([[-0.55, y0 + 2.69, bz + 0.07], [0, y0 + 2.8, bz + 0.03], [0.55, y0 + 2.69, bz + 0.07]], 0.006, 0.006, { seg: 6, radial: 3 }));

  // the desk, its back to +x, Bilbo's chair at its -x side
  const dx = 0.3;
  const dz = -1.0;
  const dy = y0 + 0.74;
  bk.add(mats.elfwood, roundBox(0.78, 0.05, 1.35, 0.015), { p: [dx, dy - 0.025, dz], uv: 1.5 });
  bk.add(mats.elfwood, roundBox(0.7, 0.12, 1.25, 0.015), { p: [dx, dy - 0.1, dz], uv: 1.5 });
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) bk.add(mats.elfwood, tube([[dx + sx * 0.33, dy - 0.12, dz + sz * 0.6], [dx + sx * 0.36, y0 + 0.35, dz + sz * 0.6], [dx + sx * 0.4, y0, dz + sz * 0.62]], 0.03, 0.022, { seg: 5, radial: 5 }), { uv: 2 });
  // a gallery along its far edge: a shelf on carved ends, pigeonholes
  bk.add(mats.elfwood, roundBox(0.2, 0.32, 1.3, 0.012), { p: [dx + 0.29, dy + 0.16, dz], uv: 1.5 });
  bk.add(mats.elfwood, roundBox(0.24, 0.03, 1.36, 0.01), { p: [dx + 0.29, dy + 0.33, dz], uv: 1.5 });
  for (let k = 0; k < 5; k++) bk.add(mats.inside, B(0.02, 0.12, 0.2), { p: [dx + 0.18, dy + 0.14, dz - 0.5 + k * 0.25] });
  // the book open in front of him, the Red Book's covers under its pages
  bk.add(mats.redLeather, roundBox(0.34, 0.02, 0.48, 0.008), { p: [dx - 0.1, dy + 0.01, dz], uv: 3 });
  const pages = new THREE.PlaneGeometry(0.46, 0.32, 12, 1);
  const pp = pages.attributes.position;
  for (let k = 0; k < pp.count; k++) {
    const u = pp.getX(k) / 0.23;
    pp.setZ(k, 0.028 * Math.pow(Math.abs(u), 0.6) * (1 - Math.abs(u) * 0.35));
  }
  pages.computeVertexNormals();
  bk.add(mats.book, pages, { p: [dx - 0.1, dy + 0.022, dz], r: [-Math.PI / 2, 0, -Math.PI / 2] });
  // ink and a quill, papers, scrolls, candles
  bk.add(mats.inkpot, lathe([[0.001, 0], [0.035, 0.002], [0.04, 0.03], [0.02, 0.05], [0.018, 0.06]], 8), { p: [dx + 0.08, dy, dz + 0.36] });
  bk.add(mats.quill, leafBlade(0.3, 0.035, { curl: 0.25, seg: 4, thick: 0.002 }), { p: [dx + 0.08, dy + 0.05, dz + 0.36], r: [0.35, 0.6, -0.45] });
  const r = rng(12);
  for (let k = 0; k < 6; k++) {
    const onDesk = k < 3;
    const px = onDesk ? dx + 0.02 + (r() - 0.5) * 0.3 : -0.4 + r() * 1.8;
    const pz = onDesk ? dz + (k - 1) * 0.42 + (r() - 0.5) * 0.08 : -2.0 + r() * 1.6;
    const py = onDesk ? dy + 0.003 + k * 0.001 : y0 + 0.004;
    bk.add(mats.notes, B(0.21, 0.002, 0.29), { p: [px, py, pz], r: [0, (r() - 0.5) * 1.2, 0] });
  }
  const scroll = (x, y, z, ry, rz = 0, len = 0.32) => {
    bk.add(mats.parchment, cylX(0.028, len, 10), { p: [x, y, z], r: [0, ry, rz] });
    for (const s of [-1, 1]) bk.add(mats.elfwood, cylX(0.012, 0.05, 6), { p: [x + Math.cos(ry) * s * (len / 2 + 0.02), y + Math.sin(rz) * s * (len / 2 + 0.02), z - Math.sin(ry) * s * (len / 2 + 0.02)], r: [0, ry, rz] });
  };
  scroll(dx + 0.18, dy + 0.03, dz - 0.45, 0.3);
  scroll(dx + 0.14, dy + 0.03, dz + 0.5, -0.4);
  scroll(dx + 0.14, dy + 0.085, dz + 0.48, -0.25);
  // a basket of scrolls on the floor
  const kx = -1.3;
  const kz = -1.8;
  bk.add(mats.wicker, lathe([[0.001, 0], [0.2, 0.01], [0.24, 0.15], [0.26, 0.32], [0.27, 0.34], [0.25, 0.34], [0.23, 0.17], [0.19, 0.03], [0.001, 0.03]], 12), { p: [kx, y0, kz], uv: 4 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    bk.add(mats.parchment, cyl(0.03, 0.03, 0.5, 8), { p: [kx + Math.cos(a) * 0.1, y0 + 0.28, kz + Math.sin(a) * 0.1], r: [Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18] });
  }
  const flames = [candleParts(bk, K, dx + 0.29, dy + 0.345, dz - 0.5), candleParts(bk, K, dx + 0.29, dy + 0.345, dz + 0.2, 0.9)];
  // a tall candlestick
  const sx = 1.25;
  const sz = -1.85;
  bk.add(mats.gilt, lathe([[0.16, 0], [0.16, 0.03], [0.06, 0.08], [0.025, 0.2], [0.02, 1.2], [0.04, 1.24], [0.07, 1.27], [0.02, 1.28]], 10), { p: [sx, y0, sz] });
  flames.push(candleParts(bk, K, sx, y0 + 1.27, sz, 1.4));
  // his chair, and a rug under it all
  bk.at([-0.45, y0, dz], 0, () => chairParts(bk, K, { back: 1.3, seatH: 0.5, w: 0.56, d: 0.48 }));
  bk.add(mats.rug, new THREE.PlaneGeometry(2.6, 1.7), { p: [0, y0 + 0.008, -0.9], r: [-Math.PI / 2, 0, Math.PI / 2] });
  bk.build(g);
  return { group: g, desk: V3(dx - 0.1, dy, dz), seat: V3(-0.45, y0 + 0.5, dz), floor: y0, flames };
}

// ── the hall of Narsil ──

// A woman robed in pale stone on a low plinth, facing +z, her veil
// falling down her back, holding out a tray across both forearms with a
// cloth of dark red velvet over it. Returns where the cloth's top is.
function statueParts(bk, K, { x = 0, y = 0, z = 0, tray = 1.7 } = {}) {
  const { mats } = K;
  const m = mats.marble;
  const ph = 0.3;
  bk.add(m, lathe([[0.62, 0], [0.62, 0.06], [0.55, 0.1], [0.52, ph - 0.06], [0.58, ph - 0.03], [0.6, ph]], 16), { p: [x, y, z], uv: 1 });
  bk.add(m, new THREE.CircleGeometry(0.6, 16), { p: [x, y + ph, z], r: [-Math.PI / 2, 0, 0], uv: 1 });
  const b = y + ph;
  // the robe: full at the hem, falling in folds, gathered at the waist,
  // the bodice above it
  const robe = lathe([[0.36, 0], [0.35, 0.1], [0.3, 0.45], [0.24, 0.85], [0.18, 1.12], [0.16, 1.22], [0.175, 1.3], [0.2, 1.46], [0.19, 1.58], [0.15, 1.66], [0.08, 1.72], [0.055, 1.78]], 28);
  const rp = robe.attributes.position;
  for (let k = 0; k < rp.count; k++) {
    const px = rp.getX(k);
    const pz = rp.getZ(k);
    const py = rp.getY(k);
    const a = Math.atan2(pz, px);
    const fold = 1 + Math.sin(a * 9 + Math.sin(a * 3) * 0.6) * 0.07 * Math.max(0, 1 - py / 1.15);
    const flat = py > 1.3 ? 0.72 : 0.82;
    rp.setXYZ(k, px * fold, py, pz * fold * flat + (py < 0.25 ? 0.05 * (1 - py / 0.25) : 0));
  }
  robe.computeVertexNormals();
  bk.add(m, robe, { p: [x, b, z], uv: 1.5 });
  bk.add(m, new THREE.TorusGeometry(0.165, 0.018, 5, 18), { p: [x, b + 1.22, z], r: [Math.PI / 2, 0, 0], s: [1, 0.8, 1] });
  // shoulders, neck, head, the veil over it and down her back
  bk.add(m, new THREE.SphereGeometry(0.2, 14, 8), { p: [x, b + 1.62, z - 0.01], s: [1.25, 0.42, 0.75] });
  bk.add(m, cyl(0.045, 0.05, 0.14, 8), { p: [x, b + 1.78, z + 0.005] });
  bk.add(m, new THREE.SphereGeometry(0.105, 14, 10), { p: [x, b + 1.93, z + 0.02], s: [0.88, 1.12, 0.98] });
  bk.add(m, lathe([[0.001, 2.07], [0.07, 2.055], [0.115, 2.0], [0.125, 1.92], [0.13, 1.84], [0.17, 1.76], [0.21, 1.68]], 16, Math.PI * 0.16, Math.PI * 1.68), { p: [x, b, z + 0.0], s: [1, 1, 0.92] });
  bk.add(m, lathe([[0.16, 1.74], [0.19, 1.55], [0.2, 1.38], [0.19, 1.24]], 10, Math.PI * 0.66, Math.PI * 0.68), { p: [x, b, z - 0.02], s: [0.95, 1, 0.75] });
  // arms: the upper arms down her sides, the forearms out under the tray,
  // wide sleeves hanging from them
  const ty = b + 1.06;
  const tz = z + 0.44;
  for (const s of [-1, 1]) {
    bk.add(m, tube([[x + s * 0.22, b + 1.62, z], [x + s * 0.26, b + 1.4, z + 0.01], [x + s * 0.25, b + 1.14, z + 0.06]], 0.047, 0.042, { seg: 5, radial: 7 }), { uv: 1.5 });
    bk.add(m, tube([[x + s * 0.25, b + 1.14, z + 0.06], [x + s * 0.25, ty - 0.07, z + 0.28], [x + s * 0.23, ty - 0.04, tz + 0.12]], 0.042, 0.035, { seg: 5, radial: 7 }), { uv: 1.5 });
    bk.add(m, lathe([[0.05, 0], [0.08, 0.1], [0.11, 0.24], [0.12, 0.36], [0.09, 0.39]], 10), { p: [x + s * 0.27, ty - 0.08, z + 0.2], r: [Math.PI, 0, 0], s: [0.7, 1, 1], uv: 1.5 });
  }
  // the tray and the cloth over it
  bk.add(m, roundBox(tray, 0.04, 0.56, 0.015), { p: [x, ty, tz], uv: 1 });
  bk.add(mats.velvet, drapeGeo(tray + 0.04, 0.6, 0.26, { folds: 6, depth: 0.03, nx: 30, nz: 10, seed: 5 }), { p: [x, ty + 0.025, tz] });
  bk.add(mats.gilt, B(tray + 0.06, 0.012, 0.012), { p: [x, ty + 0.02, tz + 0.315] });
  return V3(x, ty + 0.03, tz);
}

// The hall of Narsil: a long open gallery, 16 m along x and 5 deep, open to
// +z through a row of slender columns and pointed arches, a leaf-roof over
// it. On the solid back wall, in a carved and gilt frame, the painting of
// Isildur and Sauron (6 m × 3 m); before it a stone statue holding out the
// shards of Narsil on a cloth.
function colonnade(K, { withShards = false } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'colonnade';
  const bk = parts();
  const L = 16;
  const D = 5;
  const y0 = 0.15;
  const colTop = 3.75;
  const HT = 5.55;
  const T = 0.4;
  const fz = D / 2 - 0.3;
  bk.add(mats.elfstone, B(L + 0.6, y0, D + 0.9), { p: [0, y0 / 2, 0.2], uv: 0.5 });
  bk.add(mats.pave, B(L - 0.6, 0.02, D - 0.45), { p: [0, y0 + 0.01, 0.12], uv: 0.45 });
  bk.add(mats.elfstone, B(L, HT - y0, T), { p: [0, (HT + y0) / 2, -D / 2 + T / 2], uv: 0.5 });
  // the ends: solid, each with a tall arched screen of pierced stone
  for (const s of [-1, 1]) {
    const opening = { x: 0, y: 0.5, a: 0.85, hs: 2.0, rise: 1.15 };
    bk.at([s * L / 2, y0, 0], (s * Math.PI) / 2, () => {
      bk.add(mats.elfstone, ext(wallShape(D, HT - y0, [opening]), T), { p: [0, 0, -T], uv: 0.5 });
      archWindow(bk, K, { ...opening, pane: mats.stoneFill, depth: T / 2, frame: 0.13 });
    });
  }
  // the columns and the arcade over them
  const xs = [-L / 2 + 0.2];
  for (let k = 1; k < 7; k++) xs.push(-L / 2 + (k * L) / 7);
  xs.push(L / 2 - 0.2);
  for (const x of xs.slice(1, -1)) column(bk, K, { x, y: y0, z: fz, h: colTop - y0, r: 0.16 });
  const band = HT - colTop;
  bk.add(mats.elfstone, ext(arcadeShape(xs, 0.26, band), 0.46), { p: [0, colTop, fz - 0.23], uv: 0.5 });
  for (let i = 0; i < xs.length - 1; i++) {
    const a = (xs[i + 1] - xs[i] - 0.52) / 2;
    const cx = (xs[i] + xs[i + 1]) / 2;
    const rise = bayRise(a, band);
    bk.add(mats.carve, ext(shapeOf(archFrame(a, 0, rise, 0.12, 9, 0.35)), 0.05), { p: [cx, colTop, fz + 0.23], uv: 1 });
    bk.add(mats.gilt, ext(shapeOf(archFrame(a, 0, rise, 0.03, 9, 0.35)), 0.065), { p: [cx, colTop, fz + 0.23] });
    archFill(bk, mats.stoneFill, { x: cx, y0: colTop + rise * 0.5, a: a * 0.56, rise: rise * 0.5, z: fz });
  }
  // the ceiling on beams, frieze, cornice, the roof
  bk.add(mats.carve, B(L - 0.2, 0.2, D - 0.3), { p: [0, HT - 0.1, -0.02], uv: 0.5 });
  for (const x of xs.slice(1, -1)) bk.add(mats.elfwood, B(0.15, 0.22, D - 0.9), { p: [x, HT - 0.31, -0.25], uv: 1 });
  bk.add(mats.frieze, friezeGeo(L, 0.36), { p: [0, HT - 0.32, fz + 0.25] });
  bk.add(mats.frieze, friezeGeo(L, 0.36), { p: [0, HT - 0.32, -D / 2 - 0.025] });
  bk.add(mats.carve, roundBox(L + 0.5, 0.2, D + 0.4, 0.04), { p: [0, HT + 0.0, -0.05], uv: 1 });
  roofOn(bk, K, { ridge: 5.0, dx: 3.6, dz: 3.4, rise: 3.0, prof: (q) => Math.pow(1 - q, 1.4), lift: 0.25, tips: 0.5, n: 5, rings: 10, around: 64 }, { p: [0, HT + 0.1, -0.05], finial: 1.2 });

  // the painting in its frame, a carved crest over it
  const mw = 6;
  const mh = 3;
  const my = 2.75;
  const mz = -D / 2 + T;
  bk.add(mats.mural, new THREE.PlaneGeometry(mw, mh), { p: [0, my, mz + 0.012] });
  for (const s of [-1, 1]) {
    bk.add(mats.carve, roundBox(mw + 0.56, 0.26, 0.12, 0.03), { p: [0, my + s * (mh / 2 + 0.13), mz + 0.05], uv: 1 });
    bk.add(mats.carve, roundBox(0.26, mh + 0.04, 0.12, 0.03), { p: [s * (mw / 2 + 0.13), my, mz + 0.05], uv: 1 });
    bk.add(mats.gilt, B(mw + 0.04, 0.035, 0.03), { p: [0, my + s * (mh / 2 + 0.02), mz + 0.1] });
    bk.add(mats.gilt, B(0.035, mh + 0.04, 0.03), { p: [s * (mw / 2 + 0.02), my, mz + 0.1] });
    bk.add(mats.gilt, leafBlade(0.36, 0.14, { curl: 0.4, seg: 3, thick: 0.01 }), { p: [s * (mw / 2 + 0.13), my + mh / 2 + 0.26, mz + 0.06] });
  }
  const crest = { a: 1.4, rise: 0.75 };
  bk.add(mats.carve, ext(shapeOf(archFrame(crest.a, 0, crest.rise, 0.12, 9, 0.5)), 0.1), { p: [0, my + mh / 2 + 0.26, mz], uv: 1 });
  archFill(bk, mats.giltTracery, { y0: my + mh / 2 + 0.26, a: crest.a, rise: crest.rise, kick: 0.5, z: mz + 0.04 });
  bk.add(mats.gilt, leafBlade(0.5, 0.18, { curl: 0.2, seg: 3, thick: 0.01 }), { p: [0, my + mh / 2 + 0.26 + archTop(crest.a, crest.rise, 0.5) + 0.12, mz + 0.06] });
  bk.add(mats.carve, roundBox(mw + 0.8, 0.12, 0.3, 0.03), { p: [0, my - mh / 2 - 0.32, mz + 0.12], uv: 1 });

  // the statue, the shards on its cloth; candle stands either side
  const at = statueParts(bk, K, { x: 0, y: y0, z: -1.2 });
  const flames = [];
  for (const s of [-1, 1]) {
    const x = s * 1.7;
    const z = -1.0;
    bk.add(mats.gilt, lathe([[0.2, 0], [0.2, 0.04], [0.07, 0.1], [0.03, 0.3], [0.025, 1.55], [0.05, 1.6], [0.13, 1.66], [0.14, 1.7], [0.05, 1.7]], 10), { p: [x, y0, z] });
    for (let k = 0; k < 3; k++) flames.push(candleParts(bk, K, x + Math.cos((k / 3) * TAU) * 0.08, y0 + 1.7, z + Math.sin((k / 3) * TAU) * 0.08, 0.9));
  }
  const lamps = [];
  for (const x of [-4.6, 4.6]) {
    bk.add(mats.gilt, cyl(0.012, 0.012, 0.8, 4), { p: [x, HT - 0.62, 0.2] });
    lanternParts(bk, K, x, HT - 1.3, 0.2, 1.1);
    lamps.push(V3(x, HT - 1.3, 0.2));
  }
  bk.build(g);
  let set = null;
  if (withShards) {
    set = shards(K);
    set.group.position.copy(at);
    g.add(set.group);
  }
  return { group: g, mural: { center: V3(0, my, mz + 0.012), w: mw, h: mh }, shardsAt: at, shards: set, lamps, flames, footprint: { w: L, d: D } };
}

// The shards of Narsil as they lay in Rivendell, flat on their cloth: the
// hilt (a grip bound in leather and wire, the cross-guard's arms swept
// towards the blade, a long pommel) with a stump of broken blade, then
// five more pieces of the blade in a row, each broken jagged at both ends.
// Along +x from the pommel, about 1.4 m end to end if put together, the
// flat of the blade up, y = 0 the cloth. Each piece is its own mesh,
// centred on itself, so it can be lifted and moved.
function shards(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'shards';
  const r = rng(41);
  const blade = 1.12; // from the guard to the tip
  const halfW = (d) => mix(0.029, 0.017, d / blade) * (d > blade - 0.12 ? Math.max(0.08, (blade - d) / 0.12) : 1);
  // a piece of blade from d0 to d1 along it: a flat diamond in section,
  // thin at its edges with a ridge down the middle, broken jagged at
  // either end (each of its five lines along it stops at its own place)
  const piece = (d0, d1, jag0, jag1) => {
    const lines = [-1, -0.5, 0, 0.5, 1];
    const th = 0.0042;
    const steps = 4;
    const j0 = lines.map((_, i) => (jag0 ? (r() - 0.5) * 0.03 * (i % 2 ? 1.4 : 0.7) : 0));
    const j1 = lines.map((_, i) => (jag1 ? (r() - 0.5) * 0.03 * (i % 2 ? 1.4 : 0.7) : 0));
    const mid = (d0 + d1) / 2;
    const P = (li, k, top) => {
      const d = mix(d0 + j0[li], d1 + j1[li], k / steps);
      const h = th * (1 - Math.abs(lines[li])) + 0.0006;
      return [d - mid, th + 0.0006 + (top ? h : -h), halfW(d) * lines[li]];
    };
    const pos = [];
    const quad = (a0, b0, c0, d0_) => pos.push(...a0, ...b0, ...c0, ...b0, ...d0_, ...c0);
    for (let li = 0; li < 4; li++) {
      for (let k = 0; k < steps; k++) {
        quad(P(li, k, true), P(li + 1, k, true), P(li, k + 1, true), P(li + 1, k + 1, true));
        quad(P(li, k, false), P(li, k + 1, false), P(li + 1, k, false), P(li + 1, k + 1, false));
      }
      quad(P(li, 0, true), P(li, 0, false), P(li + 1, 0, true), P(li + 1, 0, false));
      quad(P(li, steps, true), P(li + 1, steps, true), P(li, steps, false), P(li + 1, steps, false));
    }
    for (let k = 0; k < steps; k++) {
      quad(P(0, k, true), P(0, k + 1, true), P(0, k, false), P(0, k + 1, false));
      quad(P(4, k, true), P(4, k, false), P(4, k + 1, true), P(4, k + 1, false));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const holder = new THREE.Mesh(geo, mats.blade);
    holder.castShadow = true;
    return { holder, mid };
  };
  const pieces = [];
  // the hilt: pommel, grip, guard, and the stump of blade, all one piece,
  // centred on its own middle
  const gx = 0.27; // the guard, from the pommel's end
  const ay = 0.019; // the hilt's axis above the cloth
  const hc = (gx + 0.19) / 2;
  const hiltPiece = new THREE.Group();
  hiltPiece.name = 'hilt';
  const hk = parts();
  hk.at([-hc, 0, 0], 0, () => {
    hk.add(mats.hiltSteel, lathe([[0.001, 0], [0.012, 0.006], [0.022, 0.02], [0.026, 0.04], [0.02, 0.06], [0.013, 0.07], [0.016, 0.075], [0.012, 0.08]], 10), { p: [0, ay, 0], r: [0, 0, -Math.PI / 2] });
    hk.add(mats.leather, lathe([[0.014, 0], [0.016, 0.02], [0.017, 0.09], [0.016, 0.16], [0.014, 0.175]], 10), { p: [0.078, ay, 0], r: [0, 0, -Math.PI / 2], uv: 8 });
    const wire = [];
    for (let k = 0; k <= 48; k++) {
      const t = k / 48;
      const a = t * TAU * 9;
      wire.push([0.085 + t * 0.16, ay + Math.cos(a) * 0.0175, Math.sin(a) * 0.0175]);
    }
    hk.add(mats.gilt, tube(wire, 0.0018, 0.0018, { seg: 96, radial: 3 }));
    hk.add(mats.hiltSteel, tube([[gx + 0.03, ay, -0.13], [gx + 0.004, ay, -0.08], [gx - 0.006, ay, 0], [gx + 0.004, ay, 0.08], [gx + 0.03, ay, 0.13]], 0.009, 0.009, { seg: 12, radial: 6 }));
    for (const s of [-1, 1]) hk.add(mats.hiltSteel, ball(0.012, 8, 6), { p: [gx + 0.03, ay, s * 0.13] });
    hk.add(mats.hiltSteel, roundBox(0.035, 0.03, 0.05, 0.008), { p: [gx, ay, 0] });
    hk.add(mats.gilt, B(0.012, 0.032, 0.02), { p: [gx, ay, 0] });
  });
  hk.build(hiltPiece);
  const stump = piece(0, 0.17, false, true);
  stump.holder.position.set(gx + 0.015 + stump.mid - hc, ay - 0.0048, 0);
  hiltPiece.add(stump.holder);
  hiltPiece.position.set(hc, 0, 0);
  g.add(hiltPiece);
  pieces.push(hiltPiece);
  // five more, laid after it with small gaps and a little askew
  const cuts = [0.17, 0.37, 0.56, 0.75, 0.93, blade];
  let x = gx + 0.015 + 0.17 + 0.045;
  for (let k = 0; k < 5; k++) {
    const p = piece(cuts[k], cuts[k + 1], true, k < 4);
    const len = cuts[k + 1] - cuts[k];
    p.holder.position.set(x + len / 2, 0, (r() - 0.5) * 0.02);
    p.holder.rotation.y = (r() - 0.5) * 0.08;
    p.holder.name = 'shard' + (k + 1);
    g.add(p.holder);
    pieces.push(p.holder);
    x += len + 0.04;
  }
  // centre the whole row on the origin
  const mid = x / 2;
  for (const p of pieces) p.position.x -= mid;
  return { group: g, pieces, length: x };
}

// ── the Council ──

// The Council's court, a round terrace 16 m across on a spur over the
// river, its paving top at y = 0 and its walls going down 3 m: the floor
// inlaid with a star and leaves, ten high-backed chairs in a ring facing
// the middle with a gap to +z where you walk in, the plinth for the Ring in
// the middle, a balustrade round the edge open to +z, and on the far side
// two tall slender columns with a pointed arch between, framing the view.
function court(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'court';
  const bk = parts();
  const R = 8.2;
  // the floor, the drum under it, a moulded edge
  const floor = new THREE.CircleGeometry(R, 72);
  bk.add(mats.court, floor, { r: [-Math.PI / 2, 0, 0] });
  bk.add(mats.elfstone, new THREE.CylinderGeometry(R, R + 0.25, 3, 56, 1, true), { p: [0, -1.5, 0], uv: 0.5 });
  bk.add(mats.carve, lathe([[R - 0.02, 0.02], [R + 0.16, 0.0], [R + 0.22, -0.08], [R + 0.16, -0.18], [R + 0.1, -0.22], [R + 0.12, -0.3], [R + 0.02, -0.34]], 56), { uv: 1 });
  bk.add(mats.gilt, new THREE.TorusGeometry(R + 0.205, 0.02, 4, 72), { p: [0, -0.1, 0], r: [Math.PI / 2, 0, 0] });
  bk.add(mats.frieze, scaleU(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 0.45, 56, 1, true), (TAU * R) / 1.8), { p: [0, -0.62, 0] });
  // the ten chairs, facing the middle, a gap to +z
  const seats = [];
  const open = 0.42; // the way in: ± this either side of +z
  const sr = 5.4;
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + open + 0.35 + (k / 9) * (TAU - 2 * open - 0.7);
    const x = Math.cos(a) * sr;
    const z = Math.sin(a) * sr;
    const face = Math.atan2(z, -x);
    seats.push({ x, z, face });
    bk.at([x, 0, z], face, () => chairParts(bk, K, { back: 2.15, seatH: 0.5, w: 0.66, d: 0.58, cushion: mats.moss }));
  }
  // the plinth for the Ring: a moulded drum, carved leaves, a gilt band
  const ph = 0.9;
  bk.add(mats.carve, lathe([[0.001, ph], [0.5, ph], [0.54, ph - 0.03], [0.5, ph - 0.08], [0.4, ph - 0.12], [0.36, ph - 0.2], [0.34, 0.3], [0.4, 0.22], [0.52, 0.16], [0.62, 0.1], [0.62, 0]], 24), { uv: 1 });
  bk.add(mats.gilt, new THREE.TorusGeometry(0.4, 0.02, 4, 24), { p: [0, ph - 0.12, 0], r: [Math.PI / 2, 0, 0] });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    bk.add(mats.carve, leafBlade(0.5, 0.2, { curl: 1.2, thick: 0.02 }), { p: [Math.cos(a) * 0.33, 0.24, Math.sin(a) * 0.33], r: [0, Math.PI / 2 - a, 0] });
  }
  // the balustrade round the edge, open to +z, newel posts with lanterns
  const br = 7.8;
  const rail = [];
  for (let k = 0; k <= 96; k++) {
    const a = Math.PI / 2 + open + (k / 96) * (TAU - 2 * open);
    rail.push([Math.cos(a) * br, 0, Math.sin(a) * br]);
  }
  balustrade(bk, K, rail, { h: 1.0, step: 2.6, rep: 0.95 });
  const lamps = [];
  for (const s of [-1, 1]) {
    const a = Math.PI / 2 + s * open;
    const x = Math.cos(a) * br;
    const z = Math.sin(a) * br;
    bk.add(mats.carve, lathe([[0.3, 0], [0.3, 0.15], [0.2, 0.25], [0.17, 1.3], [0.24, 1.38], [0.24, 1.46], [0.12, 1.5]], 12), { p: [x, 0, z], uv: 1 });
    bk.add(mats.gilt, tube([[x, 1.48, z], [x, 1.85, z], [x * 0.97, 2.05, z * 0.97 + 0.05], [x * 0.94, 2.0, z * 0.94 + 0.1]], 0.02, 0.016, { seg: 8, radial: 4 }));
    lanternParts(bk, K, x * 0.94, 1.78, z * 0.94 + 0.1, 0.8);
    lamps.push(V3(x * 0.94, 1.78, z * 0.94 + 0.1));
  }
  // the two tall columns on the far side and the arch between them
  const cr = R - 0.1;
  const spread = 0.24;
  const tops = [];
  for (const s of [-1, 1]) {
    const a = -Math.PI / 2 + s * spread;
    const x = Math.cos(a) * cr;
    const z = Math.sin(a) * cr;
    tops.push([x, z]);
    bk.add(mats.carve, roundBox(0.62, 0.3, 0.62, 0.03), { p: [x, 0.15, z], uv: 1 });
    column(bk, K, { x, y: 0.3, z, h: 7.0, r: 0.19, leaves: 8 });
  }
  const span = Math.hypot(tops[1][0] - tops[0][0], tops[1][1] - tops[0][1]);
  const mx = (tops[0][0] + tops[1][0]) / 2;
  const mz = (tops[0][1] + tops[1][1]) / 2;
  const a = span / 2 - 0.3;
  const rise = a * 1.6;
  bk.at([mx, 7.3, mz], 0, () => {
    bk.add(mats.carve, ext(shapeOf(archFrame(a, 0, rise, 0.22, 12, 0.6)), 0.3), { p: [0, 0, -0.15], uv: 1 });
    bk.add(mats.gilt, ext(shapeOf(archFrame(a, 0, rise, 0.04, 12, 0.6)), 0.34), { p: [0, 0, -0.17] });
    bk.add(mats.gilt, ext(shapeOf(archFrame(a + 0.22, 0, rise + 0.253, 0.03, 12, 0.6)), 0.34), { p: [0, 0, -0.17] });
    archFill(bk, mats.giltTracery, { y0: rise * 0.25, a: a * 0.86, rise: rise * 0.75, kick: 0.6, n: 10 });
    bk.add(mats.gilt, leafBlade(0.8, 0.26, { curl: 0.25, seg: 4, thick: 0.015 }), { p: [0, archTop(a, rise, 0.6) + 0.3, 0] });
    for (const s of [-1, 1]) {
      const curl = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        const ang = t * 4.2;
        const rr = 0.55 * (1 - t * 0.75);
        curl.push([s * (span / 2 + 0.15 + Math.sin(ang) * rr * 0.7), 0.1 + (1 - Math.cos(ang)) * rr * 0.8 - t * 0.2, 0]);
      }
      bk.add(mats.gilt, tube(curl, 0.025, 0.012, { seg: 24, radial: 4 }));
    }
  });
  bk.build(g);
  return { group: g, plinthTop: V3(0, ph, 0), seats, seatHeight: 0.5, radius: R, rail: { r: br, open }, lamps };
}

// ── the bridge ──

// A section ([[across, up], ...], a loop) swept along x through `xs`, lifted
// by yAt(x): a deck, a fascia, a rail that follows a humped bridge.
function sweepX(section, xs, yAt) {
  const pos = [];
  const idx = [];
  const m = section.length;
  for (let e = 0; e < m; e++) {
    const [az, ay] = section[e];
    const [bz, by] = section[(e + 1) % m];
    const base = pos.length / 3;
    for (const x of xs) {
      const y = yAt(x);
      pos.push(x, ay + y, az, x, by + y, bz);
    }
    for (let i = 0; i < xs.length - 1; i++) {
      const p = base + i * 2;
      idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
    }
  }
  for (const [x, first] of [[xs[0], true], [xs[xs.length - 1], false]]) {
    const base = pos.length / 3;
    const y = yAt(x);
    for (const [z, yy] of section) pos.push(x, yy + y, z);
    for (let i = 1; i < m - 1; i++) {
      if (first) idx.push(base, base + i, base + i + 1);
      else idx.push(base, base + i + 1, base + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g.toNonIndexed();
}

// The bridge over the gorge: a slender single arch along x from -len/2 to
// +len/2, its walkway rising as y = 1.3 · sin(π · (x/len + 0.5)) above the
// ends (y = 0), between railings of flowing tracery with a gilt-capped
// handrail and newel posts with lanterns at the ends. Beneath, the arch rib
// springs from the gorge's sides at y = -6.5, its spandrels open in
// tracery, onto stone abutments set into the rock at each end.
function bridge(K, len = 16) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'bridge';
  const bk = parts();
  const L = len / 2;
  const deck = (x) => (Math.abs(x) >= L ? 0 : 1.3 * Math.sin(Math.PI * (x / len + 0.5)));
  const wd = 2.6;
  const hw = wd / 2;
  const xs = [];
  const N = Math.max(24, Math.round(len * 2.5));
  for (let i = 0; i <= N; i++) xs.push(-L + (i / N) * len);
  // the deck: paving on a slab, a carved fascia either side, a gilt line
  bk.add(mats.pave, sweepX([[-hw + 0.1, -0.06], [hw - 0.1, -0.06], [hw - 0.1, 0], [-hw + 0.1, 0]], xs, deck), { uv: 0.5 });
  bk.add(mats.elfstone, sweepX([[-hw, -0.42], [hw, -0.42], [hw, -0.06], [-hw, -0.06]], xs, deck), { uv: 0.5 });
  for (const s of [-1, 1]) {
    const geo = sweepX(s > 0 ? [[hw, -0.44], [hw + 0.06, -0.44], [hw + 0.06, 0.06], [hw, 0.06]] : [[-hw - 0.06, -0.44], [-hw, -0.44], [-hw, 0.06], [-hw - 0.06, 0.06]], xs, deck);
    const p = geo.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let k = 0; k < p.count; k++) {
      uv[k * 2] = p.getX(k) / 2;
      uv[k * 2 + 1] = (p.getY(k) - deck(p.getX(k)) + 0.44) / 0.5;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    bk.add(mats.frieze, geo);
    bk.add(mats.gilt, sweepX(s > 0 ? [[hw + 0.06, -0.47], [hw + 0.09, -0.47], [hw + 0.09, -0.44], [hw + 0.06, -0.44]] : [[-hw - 0.09, -0.47], [-hw - 0.06, -0.47], [-hw - 0.06, -0.44], [-hw - 0.09, -0.44]], xs, deck));
  }
  // the railings: posts, tracery, a handrail that curls into a scroll at
  // each end over the newel post
  const lamps = [];
  for (const s of [-1, 1]) {
    const z = s * (hw - 0.06);
    const line = xs.filter((x) => Math.abs(x) <= L - 0.5).map((x) => [x, deck(x), z]);
    balustrade(bk, K, line, { h: 1.0, step: 2.0, rep: 0.95, ends: false });
    for (const e of [-1, 1]) {
      const x = e * (L - 0.25);
      const y = deck(x);
      bk.add(mats.carve, lathe([[0.22, 0], [0.22, 0.12], [0.15, 0.2], [0.13, 1.25], [0.18, 1.32], [0.18, 1.4], [0.1, 1.44]], 10), { p: [x, y, z], uv: 1 });
      const curl = [];
      for (let k = 0; k <= 14; k++) {
        const t = k / 14;
        const ang = t * 5;
        const rr = 0.24 * (1 - t * 0.7);
        curl.push([x - e * 0.3 + e * Math.sin(ang) * rr, y + 1.0 + 0.24 - Math.cos(ang) * rr + 0.0, z]);
      }
      bk.add(mats.carve, tube([[x - e * 0.7, deck(x - e * 0.7) + 1.0, z], ...curl], 0.05, 0.03, { seg: 20, radial: 5 }), { uv: 2 });
      bk.add(mats.gilt, tube([[x, y + 1.44, z], [x, y + 1.95, z], [x + e * 0.12, y + 2.2, z], [x + e * 0.26, y + 2.12, z]], 0.022, 0.016, { seg: 8, radial: 4 }));
      lanternParts(bk, K, x + e * 0.26, y + 1.86, z, 0.8);
      lamps.push(V3(x + e * 0.26, y + 1.86, z));
    }
  }
  // the arch beneath: a rib springing from the gorge's sides, its
  // spandrels pierced with tracery
  const spring = -6.5;
  const ai = L - 0.6;
  const ao = L + 0.4;
  const crownIn = 0.1;
  const crownOut = 1.3 - 0.42 - 0.02;
  const inner = (x) => spring + (crownIn - spring) * Math.sqrt(Math.max(0, 1 - (x / ai) ** 2));
  const outer = (x) => spring + (crownOut - spring) * Math.sqrt(Math.max(0, 1 - (x / ao) ** 2));
  const rib = [];
  const M = 40;
  for (let i = 0; i <= M; i++) {
    const x = -ao + (i / M) * 2 * ao;
    rib.push([x, Math.min(outer(x), deck(x) - 0.4)]);
  }
  for (let i = M; i >= 0; i--) {
    const x = -ai + (i / M) * 2 * ai;
    rib.push([x, inner(x)]);
  }
  const ribW = 1.5;
  bk.add(mats.elfstone, ext(shapeOf(rib), ribW), { p: [0, 0, -ribW / 2], uv: 0.5 });
  // a moulding round the arch's soffit edge, gilt-lined
  for (const s of [-1, 1]) {
    const band = [];
    for (let i = 0; i <= M; i++) {
      const x = -ai + (i / M) * 2 * ai;
      band.push([x, inner(x) - 0.02]);
    }
    for (let i = M; i >= 0; i--) {
      const x = -ai + (i / M) * 2 * ai;
      band.push([x * 0.985, inner(x) + 0.22]);
    }
    bk.add(mats.carve, ext(shapeOf(band), 0.06), { p: [0, 0, s * (ribW / 2) + (s > 0 ? 0 : -0.06)], uv: 1 });
    const gl = [];
    for (let i = 0; i <= M; i++) {
      const x = -ai + (i / M) * 2 * ai;
      gl.push([x, inner(x) + 0.23, s * (ribW / 2 + 0.035)]);
    }
    bk.add(mats.gilt, tube(gl, 0.018, 0.018, { seg: 60, radial: 3 }));
  }
  // the spandrels: tracery between the rib and the deck
  for (const e of [-1, 1]) {
    const pts = [];
    const x0 = e * 0.9;
    const x1 = e * (ao - 0.05);
    for (let i = 0; i <= 16; i++) {
      const x = mix(x0, x1, i / 16);
      pts.push([x, deck(x) - 0.44]);
    }
    for (let i = 16; i >= 0; i--) {
      const x = mix(x0, x1, i / 16);
      pts.push([x, Math.min(outer(x), deck(x) - 0.44)]);
    }
    const geo = new THREE.ShapeGeometry(shapeOf(e > 0 ? pts : pts.slice().reverse()));
    shapeUV(geo, 0, 0, 1.1, 1.1);
    for (const s of [-1, 1]) bk.add(mats.tracery, geo.clone(), { p: [0, 0, s * (ribW / 2 - 0.08)] });
  }
  // the abutments, set into the gorge's sides
  for (const e of [-1, 1]) {
    bk.add(mats.elfstone, B(2.6, 7.2, wd + 1.0), { p: [e * (L + 0.7), -3.6 - 0.02, 0], uv: 0.4 });
    bk.add(mats.carve, roundBox(2.8, 0.2, wd + 1.2, 0.03), { p: [e * (L + 0.7), -0.12, 0], uv: 1 });
    bk.add(mats.pave, B(2.5, 0.02, wd - 0.2), { p: [e * (L + 0.6), 0.0, 0], uv: 0.5 });
  }
  bk.build(g);
  return { group: g, deckY: deck, width: wd, lamps };
}

// ── the gate, lamps, the Ring, terraces ──

// The south gate: two tall carved posts of pale stone, 4.3 m apart inside,
// each an eight-sided shaft with carved panels and a leaf capital, a gilt
// leaf on top; between them a high pointed arch with gilt tracery in its
// head, and gilt tendrils curling off its shoulders. The way through runs
// along z, its middle at the origin.
function gate(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'gate';
  const bk = parts();
  const half = 2.16;
  const pr = 0.34;
  const px = half + pr;
  const postH = 5.4;
  for (const s of [-1, 1]) {
    const x = s * px;
    bk.add(mats.elfstone, roundBox(1.0, 0.5, 1.0, 0.04), { p: [x, 0.25, 0], uv: 0.6 });
    bk.add(mats.carve, roundBox(0.9, 0.12, 0.9, 0.03), { p: [x, 0.56, 0], uv: 1 });
    const sh = postH - 1.2;
    bk.add(mats.carve, new THREE.CylinderGeometry(pr * 0.92, pr * 1.06, sh, 8, 1, true, Math.PI / 8), { p: [x, 0.62 + sh / 2, 0], uv: 1 });
    for (const y of [0.62 + 0.1, 0.62 + sh - 0.04]) bk.add(mats.carve, new THREE.CylinderGeometry(pr * 1.12, pr * 1.12, 0.1, 8, 1, false, Math.PI / 8), { p: [x, y, 0], uv: 1 });
    // a gilt vine winding up it, with leaves
    for (const ph of [0, Math.PI]) {
      const vine = [];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        const a2 = ph + t * TAU * 2.2;
        const rr = mix(pr * 1.08, pr * 0.95, t) + 0.015;
        vine.push([x + Math.cos(a2) * rr, 0.75 + t * (sh - 0.25), Math.sin(a2) * rr]);
      }
      bk.add(mats.gilt, tube(vine, 0.016, 0.012, { seg: 60, radial: 4 }));
      for (let k = 4; k < 40; k += 6) {
        const [vx, vy, vz] = vine[k];
        const a2 = Math.atan2(vz, vx - x);
        bk.add(mats.gilt, leafBlade(0.16, 0.07, { curl: 1.0, seg: 3, thick: 0.006 }), { p: [vx, vy, vz], r: [0, Math.PI / 2 - a2, (k % 12 ? 1 : -1) * 0.7] });
      }
    }
    column(bk, K, { x, y: postH - 0.6, z: 0, h: 0.62, r: pr * 0.9, base: false, leaves: 8 });
    bk.add(mats.carve, roundBox(pr * 3.4, 0.14, pr * 3.4, 0.03), { p: [x, postH + 0.09, 0], uv: 1 });
    bk.add(mats.gilt, leafBlade(0.75, 0.26, { curl: 0.15, seg: 4, thick: 0.015 }), { p: [x, postH + 0.16, 0] });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + Math.PI / 4;
      bk.add(mats.gilt, leafBlade(0.4, 0.16, { curl: 1.3, seg: 4, thick: 0.01 }), { p: [x + Math.cos(a) * 0.06, postH + 0.16, Math.sin(a) * 0.06], r: [0, Math.PI / 2 - a, 0] });
    }
  }
  // the arch, springing from the inner faces of the capitals
  const spring = postH - 0.35;
  const a = half + 0.05;
  const rise = a * 1.25;
  bk.at([0, spring, 0], 0, () => {
    bk.add(mats.carve, ext(shapeOf(archFrame(a, 0, rise, 0.3, 14, 0.55)), 0.4), { p: [0, 0, -0.2], uv: 1 });
    for (const z of [-0.22, 0.2]) {
      bk.add(mats.gilt, ext(shapeOf(archFrame(a + 0.3, 0, rise + 0.345, 0.035, 14, 0.55)), 0.02), { p: [0, 0, z] });
      bk.add(mats.gilt, ext(shapeOf(archFrame(a, 0, rise, 0.035, 14, 0.55)), 0.02), { p: [0, 0, z] });
    }
    archFill(bk, mats.giltTracery, { y0: rise * 0.2, a: a * 0.94, rise: rise * 0.8, kick: 0.55, n: 12 });
    const top = archTop(a + 0.3, rise + 0.345, 0.55);
    bk.add(mats.gilt, leafBlade(0.9, 0.3, { curl: 0.1, seg: 4, thick: 0.015 }), { p: [0, top - 0.05, 0] });
    for (const s of [-1, 1]) {
      bk.add(mats.gilt, leafBlade(0.55, 0.2, { curl: 0.9, seg: 4, thick: 0.01 }), { p: [s * 0.08, top - 0.12, 0], r: [0, 0, -s * 0.6] });
      const curl = [];
      for (let k = 0; k <= 18; k++) {
        const t = k / 18;
        const ang = t * 4.6;
        const rr = 0.7 * (1 - t * 0.78);
        curl.push([s * (a + 0.5 + Math.sin(ang) * rr * 0.8), 0.2 + (1 - Math.cos(ang)) * rr - t * 0.3, 0]);
      }
      bk.add(mats.gilt, tube(curl, 0.03, 0.012, { seg: 26, radial: 4 }));
    }
  });
  bk.add(mats.pave, B(2 * half, 0.04, 1.2), { p: [0, 0.02, 0], uv: 0.6 });
  bk.build(g);
  return { group: g, width: 2 * half, posts: [V3(-px, 0, 0), V3(px, 0, 0)], postRadius: 0.5 };
}

// An elven lantern on a slender post about 2.6 m tall that curves over at
// the top like a stem bending under a flower, the lantern hanging from it.
function lamp(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'lamp';
  const bk = parts();
  bk.add(mats.carve, lathe([[0.2, 0], [0.2, 0.06], [0.14, 0.1], [0.1, 0.2], [0.06, 0.32], [0.045, 0.4]], 10), { uv: 1 });
  const stem = [[0, 0.35, 0], [0.01, 1.2, 0], [0.04, 2.1, 0], [0.16, 2.5, 0], [0.34, 2.6, 0], [0.46, 2.5, 0], [0.5, 2.38, 0]];
  bk.add(mats.gilt, tube(stem, 0.04, 0.018, { seg: 18, radial: 6 }));
  for (const s of [-1, 1]) bk.add(mats.gilt, leafBlade(0.32, 0.12, { curl: 1.2, seg: 3, thick: 0.008 }), { p: [0.02, 1.9, 0], r: [0, s * 1.2 + Math.PI / 2, 0] });
  bk.add(mats.gilt, leafBlade(0.24, 0.1, { curl: -1.0, seg: 3, thick: 0.008 }), { p: [0.04, 2.15, 0], r: [0, Math.PI / 2, 0] });
  lanternParts(bk, K, 0.5, 2.1, 0, 0.95);
  bk.build(g);
  return { group: g, light: V3(0.5, 2.1, 0) };
}

// The One Ring: a plain band of gold, 2.4 cm across, lying flat with its
// foot at y = 0, scaled up four times by default so it can be seen on the
// plinth (`scale`: 1 for its true size). glow(k), 0 to 1, brings up the
// fiery letters on it and a halo round it.
function ring(K, { scale = 4 } = {}) {
  const g = new THREE.Group();
  g.name = 'ring';
  const mat = new THREE.MeshStandardMaterial({ color: 0xf2c04a, metalness: 1, roughness: 0.14, envMap: K.tex.sky, envMapIntensity: 1.4, emissive: hot(0xff5a12, 4), emissiveMap: K.tex.inscription, emissiveIntensity: 0 });
  const prof = [[0.0101, 0.0003], [0.0106, 0], [0.0114, 0.0002], [0.0119, 0.001], [0.0121, 0.00225], [0.0119, 0.0035], [0.0114, 0.0043], [0.0106, 0.0045], [0.0101, 0.0042], [0.01, 0.00225], [0.0101, 0.0003]];
  const band = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 48);
  const mesh = new THREE.Mesh(band, mat);
  mesh.castShadow = true;
  g.add(mesh);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.tex.puff, color: hot(0xff7a28, 2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.07);
  halo.position.y = 0.003;
  g.add(halo);
  g.scale.setScalar(scale);
  return {
    group: g,
    material: mat,
    glow(k) {
      const t = clamp01(k);
      mat.emissiveIntensity = t;
      halo.material.opacity = t * 0.55;
      halo.scale.setScalar(0.05 + t * 0.04);
    },
  };
}

// A raised terrace of pale stone, w × d, its paved top at y = h (the
// origin at its foot's middle): a moulded plinth at the foot, coursed
// walls, a carved frieze and a cornice at the top, and a balustrade along
// its +z edge.
function terrace(K, w, d, h) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'terrace';
  const bk = parts();
  bk.add(mats.elfstone, B(w, h, d), { p: [0, h / 2, 0], uv: 0.45 });
  bk.add(mats.carve, roundBox(w + 0.2, 0.3, d + 0.2, 0.04), { p: [0, 0.15, 0], uv: 1 });
  const fh = Math.min(0.4, h * 0.2);
  if (h > 0.9) {
    for (const s of [-1, 1]) {
      bk.add(mats.frieze, friezeGeo(w, fh), { p: [0, h - 0.2 - fh / 2, s * (d / 2 + 0.025)] });
      bk.add(mats.frieze, friezeGeo(d, fh, 'z'), { p: [s * (w / 2 + 0.025), h - 0.2 - fh / 2, 0] });
    }
  }
  bk.add(mats.carve, roundBox(w + 0.36, 0.2, d + 0.36, 0.04), { p: [0, h - 0.105, 0], uv: 1 });
  bk.add(mats.gilt, B(w + 0.38, 0.025, d + 0.38), { p: [0, h - 0.175, 0] });
  bk.add(mats.pave, B(w + 0.2, 0.02, d + 0.2), { p: [0, h - 0.01, 0], uv: 0.45 });
  balustrade(bk, K, [[-w / 2 + 0.15, h, d / 2 + 0.02], [w / 2 - 0.15, h, d / 2 + 0.02]], { h: 0.95, step: 2.4 });
  bk.build(g);
  return { group: g, top: h };
}

export { house, drapeGeo, chairParts, bedroom, candleParts, pavilion, statueParts, colonnade, shards, court, sweepX, bridge, gate, lamp, ring, terrace };
export { shapeUV, bandUV, shapeOf, pathOf, ext, archCurve, archTop, archOpening, archFrame, arcadeShape, bayRise, wallShape, leafBlade, column, leafRoof, roofOn, ribbon, resample, balustrade, archWindow, archFill, lanternParts, scaleU, friezeGeo } from './parts';
export { tint, oneGeo, cliffGeo, AUTUMN, BIRCH, crownGeo, beechGeo, birchGeo, fallenLeavesGeo } from './valley';
export { elfstoneCanvas, blurField, fieldOf, carvingCanvas, traceryCanvas, archFillCanvas, glassCanvas, roofCanvas, rockCanvas, linenCanvas, skyCanvas, puffCanvas, shaftCanvas, poly, limb, ageCanvas, courtCanvas, muralCanvas, mapCanvas, bookCanvas, rugCanvas, inscriptionCanvas, notesCanvas } from './canvases';
