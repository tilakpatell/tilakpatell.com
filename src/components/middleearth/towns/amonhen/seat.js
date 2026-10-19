// The Seat of Seeing on its round paved platform, and the ruined stair up
// the hill. Moved out of props.js as they were.

import * as THREE from 'three';
import { mix } from '../../../../lib/paint';
import { cyl, lathe, parts, rng, tf, tube } from '../../shire/build';
import { C, ext, shapeOf, TAU, UP, V3 } from './helpers';
import { boxCorners, drumGeo, fallenLeavesGeo, grassGeo, hexBlock, mossGeo, paintSmooth, placeCorners, ringCorners, stonePaint } from './stone';

// ── the Seat of Seeing ──

// The White Tree in low relief on a flat face in the y-z plane (x = x0,
// facing +x), its trunk's foot at (y0, 0), `s` tall: a trunk, branches in
// pairs reaching up and out, a few roots, and seven stars over it.
export function whiteTree(bk, mat, x0, y0, s, paint) {
  const add = (geo) => bk.add(mat, paintSmooth(geo, paint), { uv: 1.2 });
  const at = (y, z) => [x0, y0 + y * s, z * s];
  const d = 0.03 * s;
  add(tube([at(0, 0), at(0.35, 0), at(0.7, 0)], 0.045 * s, 0.022 * s, { seg: 4, radial: 5 }).translate(-0.02 * s, 0, 0));
  for (const [y, len, rise] of [[0.28, 0.32, 0.22], [0.42, 0.27, 0.2], [0.55, 0.2, 0.17], [0.65, 0.12, 0.12]]) {
    for (const sd of [-1, 1]) {
      add(tube([at(y, 0), at(y + rise * 0.45, sd * len * 0.55), at(y + rise, sd * len)], 0.02 * s, 0.009 * s, { seg: 3, radial: 4 }).translate(-0.02 * s, 0, 0));
    }
  }
  for (const sd of [-1, 0, 1]) add(tube([at(0, 0), at(-0.03, sd * 0.08), at(-0.06, sd * 0.16)], 0.025 * s, 0.01 * s, { seg: 2, radial: 4 }).translate(-0.02 * s, 0, 0));
  for (let i = 0; i < 7; i++) {
    const a = mix(-0.95, 0.95, i / 6);
    const st = new THREE.OctahedronGeometry(0.045 * s, 0);
    tf(st, { p: [x0 - d * 0.3, y0 + (0.86 + Math.cos(a) * 0.12) * s, Math.sin(a) * 0.36 * s], s: [0.45, 1, 1] });
    add(st);
  }
}

// The Seat of Seeing, on the summit of Amon Hen: a round platform of pale
// paving 9 m across, raised a metre on a drum of big curved blocks under a
// coping, with worn steps up its east (+x) side between broken cheek walls.
// In its middle on a dais a great carved throne, 3 m tall, facing west (-x)
// with its back to the steps: a deep seat, wide arms that end in scrolls,
// a high pointed back with the White Tree and its seven stars carved on it,
// and a post at each back corner. Four fluted columns stood round the rim;
// three still stand, broken off at different heights, and the fourth lies
// in its drums across the paving, its capital rolled off the edge. Moss
// and lichen over everything, grass in the joints, leaves blown in.
export function seat(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'seatOfSeeing';
  const bk = parts();
  const rand = rng(31);
  const paint = stonePaint(11, { moss: 1.0, lichen: 1.0, damp: 1.0 });
  const R = 4.6;
  const TOP = 1.0;
  const tintOf = () => {
    const t = new THREE.Color(1, 1, 1);
    const k = rand();
    if (k < 0.3) t.setRGB(1.05, 1.02, 0.95);
    else if (k < 0.55) t.setRGB(0.93, 0.96, 1.0);
    else if (k < 0.65) t.setRGB(0.84, 0.84, 0.82);
    return t.multiplyScalar(0.93 + rand() * 0.14);
  };
  let seed = 1;
  const block = (P, o = {}) => bk.add(mats.ruin, hexBlock(P, { seed: seed++, paint, tint: tintOf(), ...o }), { uv: 0.42 });
  const tufts = [];
  const moss = (x, y, z, r, o = {}) => bk.add(mats.moss, mossGeo(r, seed++, o), { p: [x, y, z], r: [0, rand() * TAU, 0], uv: 3 });

  // the core under the paving, dark and mossy where a flag has gone
  bk.add(mats.ruin, paintSmooth(cyl(3.62, 3.62, TOP - 0.13, 24).translate(0, (TOP - 0.13) / 2, 0), stonePaint(12, { moss: 1.5, base: C(0x5a5a50) })), { uv: 0.5 });
  // the drum: two courses of curved blocks, breaking joint, and a footing
  const gap = 0.012;
  const courses = [[0, 0.46, 15, 0], [0.46, 0.86, 15, 0.5]];
  for (const [y0, y1, count, off] of courses) {
    for (let i = 0; i < count; i++) {
      const a0 = ((i + off) / count) * TAU + gap;
      const a1 = ((i + 1 + off) / count) * TAU - gap;
      const sag = rand() < 0.2 ? rand() * 0.05 : 0;
      block(ringCorners(a0, a1, y0 - (y0 ? 0 : 0.2), y1 - sag, R - 1.0, R - 0.12), { chamfer: 0.05, flatBottom: !y0 });
    }
  }
  // the coping, overhanging a little, and the paving within it
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * TAU + gap * 0.8;
    const a1 = ((i + 1) / 18) * TAU - gap * 0.8;
    const lift = (rand() - 0.5) * 0.03;
    block(ringCorners(a0, a1, 0.86, TOP + lift, 3.48, R), { chamfer: 0.04 });
  }
  const rings = [[1.6, 2.58, 10, 0.3], [2.58, 3.48, 15, 0.1]];
  for (const [r0, r1, count, off] of rings) {
    for (let i = 0; i < count; i++) {
      const a0 = ((i + off) / count) * TAU + 0.014;
      const a1 = ((i + 1 + off) / count) * TAU - 0.014;
      if (r0 > 2 && (i === 4 || i === 11)) {
        // a flag gone: moss and grass in the hole
        const am = (a0 + a1) / 2;
        const rm = (r0 + r1) / 2;
        moss(Math.cos(am) * rm, TOP - 0.13, Math.sin(am) * rm, 0.45, { h: 0.45 });
        tufts.push({ x: Math.cos(am) * rm, y: TOP - 0.12, z: Math.sin(am) * rm, h: 0.32, n: 9, s: 0.3 });
        continue;
      }
      const sink = rand() < 0.3 ? rand() * 0.04 : 0;
      block(ringCorners(a0, a1, 0.86, TOP - sink, r0 + 0.01, r1 - 0.01), { chamfer: 0.025, chip: 0.3 });
      if (rand() < 0.45) {
        const a = mix(a0, a1, rand() > 0.5 ? 0.02 : 0.98);
        tufts.push({ x: Math.cos(a) * mix(r0, r1, rand()), y: TOP - sink, z: Math.sin(a) * mix(r0, r1, rand()), h: 0.16, n: 4, s: 0.05 });
      }
    }
  }
  bk.add(mats.ruin, paintSmooth(cyl(1.62, 1.62, 0.14, 20).translate(0, TOP - 0.07, 0), paint), { uv: 0.42 });

  // the steps up the east side, worn hollow, three stones to a step, and
  // the cheek walls either side
  const TREAD = 0.44;
  for (let k = 1; k <= 4; k++) {
    const x0 = R - 0.25 + (k - 1) * TREAD;
    const x1 = R + k * TREAD - (k === 1 ? 0.2 : 0);
    const yTop = TOP - 0.2 * k;
    const cuts = [-1.25, -0.42 + (rand() - 0.5) * 0.3, 0.44 + (rand() - 0.5) * 0.3, 1.25];
    for (let s = 0; s < 3; s++) {
      const wear = 0.02 + rand() * 0.04;
      const P = boxCorners(1, 1, 1).map((c) => V3(c.x < 0 ? x0 : x1, c.y < 0 ? -0.15 : yTop - (c.x > 0 ? wear : 0), c.z < 0 ? cuts[s] + 0.01 : cuts[s + 1] - 0.01));
      block(P, { chamfer: 0.05, chip: 0.4, flatBottom: true });
    }
    tufts.push({ x: x1 + 0.03, y: yTop - 0.2, z: (rand() - 0.5) * 2.2, h: 0.22, n: 6, s: 0.1 });
  }
  for (const sz of [-1, 1]) {
    const z0 = sz * 1.27;
    const z1 = sz * 1.72;
    const pieces = [[R - 0.4, R + 0.55, 1.15, 1.05], [R + 0.55, R + 1.25, 0.92, 0.6], [R + 1.25, R + 1.95, sz > 0 ? 0.42 : 0.55, 0.32]];
    for (const [xa, xb, ya, yb] of pieces) {
      const P = boxCorners(1, 1, 1).map((c) => V3(c.x < 0 ? xa + 0.01 : xb - 0.01, c.y < 0 ? -0.1 : c.x < 0 ? ya : yb, c.z < 0 ? Math.min(z0, z1) : Math.max(z0, z1)));
      block(P, { chamfer: 0.05, chip: 0.5, flatBottom: true });
    }
    moss(R + 0.2, 1.13, sz * 1.5, 0.3);
  }

  // the throne, built facing +x and turned to face west
  bk.at([0, TOP, 0], Math.PI, () => {
    const tp = stonePaint(13, { moss: 0.9, lichen: 1.1, damp: 0.4, base: C(0xb2afa4) });
    const tb = (P, o = {}) => bk.add(mats.ruin, hexBlock(P, { seed: seed++, paint: tp, tint: tintOf(), ...o }), { uv: 0.42 });
    const box = (x0, x1, y0, y1, z0, z1, o) => tb(boxCorners(1, 1, 1).map((c) => V3(c.x < 0 ? x0 : x1, c.y < 0 ? y0 : y1, c.z < 0 ? z0 : z1)), o);
    // the dais and a step before it
    box(-1.45, 1.45, 0, 0.24, -1.4, 1.4, { chamfer: 0.04 });
    box(1.45, 1.95, 0, 0.12, -1.0, 1.0, { chamfer: 0.04, chip: 0.5 });
    // the seat, its front panelled
    box(-0.6, 0.55, 0.24, 0.78, -0.72, 0.72, { chamfer: 0.03 });
    box(0.55, 0.6, 0.32, 0.7, -0.6, -0.5, { chamfer: 0.01 });
    box(0.55, 0.6, 0.32, 0.7, 0.5, 0.6, { chamfer: 0.01 });
    box(0.55, 0.6, 0.32, 0.38, -0.5, 0.5, { chamfer: 0.01 });
    box(0.55, 0.6, 0.64, 0.7, -0.5, 0.5, { chamfer: 0.01 });
    // the arms, wide, capped, and ending in scrolls
    for (const sz of [-1, 1]) {
      box(-0.6, 0.5, 0.24, 1.28, sz * 0.72, sz * 1.22, { chamfer: 0.035 });
      box(-0.64, 0.56, 1.28, 1.38, sz * 0.68, sz * 1.27, { chamfer: 0.03 });
      const roll = cyl(0.2, 0.2, 0.52, 14).rotateX(Math.PI / 2).translate(0.56, 1.2, sz * 0.97);
      bk.add(mats.ruin, paintSmooth(roll, tp), { uv: 0.6 });
      // a spiral carved on its outer face
      const spiral = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * TAU * 1.6;
        const rr = 0.16 * (1 - i / 19);
        spiral.push([0.56 + Math.cos(a) * rr, 1.2 + Math.sin(a) * rr, sz * 1.235]);
      }
      bk.add(mats.ruin, paintSmooth(tube(spiral, 0.016, 0.012, { seg: 16, radial: 4 }), tp), { uv: 0.6 });
      moss(-0.05, 1.38, sz * 0.98, 0.24, { h: 0.4 });
    }
    // the back: a slab shaped like a pointed arch, its face panelled and
    // carved, and posts at its corners
    const hw = 1.18;
    const outline = [[-hw, 0.24], [hw, 0.24], [hw, 2.2]];
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      outline.push([hw * Math.cos((t * Math.PI) / 2) ** 0.8, 2.2 + 0.8 * Math.sin((t * Math.PI) / 2) ** 1.3]);
    }
    for (let i = 7; i >= 1; i--) {
      const t = i / 8;
      outline.push([-hw * Math.cos((t * Math.PI) / 2) ** 0.8, 2.2 + 0.8 * Math.sin((t * Math.PI) / 2) ** 1.3]);
    }
    outline.push([-hw, 2.2]);
    const back = ext(shapeOf(outline), 0.32, 0.03).rotateY(-Math.PI / 2).translate(-0.6, 0, 0);
    bk.add(mats.ruin, paintSmooth(back, tp), { uv: 0.42 });
    // a raised frame round its face
    const frame = [];
    for (const [z, y] of outline) frame.push([-0.585, y + (y < 0.3 ? 0.62 : y > 2.2 ? -0.16 : 0), z * 0.84]);
    frame.push(frame[0]);
    bk.add(mats.ruin, paintSmooth(tube(frame.filter((p) => p[1] > 0.8), 0.035, 0.035, { seg: 40, radial: 4 }), tp), { uv: 0.6 });
    whiteTree(bk, mats.ruin, -0.56, 0.98, 1.65, tp);
    for (const sz of [-1, 1]) {
      const top = sz > 0 ? 3.05 : 2.6;
      box(-0.82, -0.52, 0.24, top, sz * 1.16, sz * 1.42, { chamfer: 0.03, chip: sz < 0 ? 0.9 : 0.2 });
      if (sz > 0) bk.add(mats.ruin, paintSmooth(new THREE.ConeGeometry(0.21, 0.38, 4).rotateY(Math.PI / 4).translate(-0.67, top + 0.19, sz * 1.29), tp), { uv: 0.6 });
      else moss(-0.67, top, sz * 1.29, 0.18, { h: 0.5 });
    }
    moss(-0.55, 0.78, 0.4, 0.22, { h: 0.3 });
    moss(-0.75, 2.95, 0.2, 0.2, { h: 0.5 });
    // moss creeping over the dais's edge
    for (let i = 0; i < 5; i++) moss(mix(-1.3, 1.3, rand()), 0.24, (rand() > 0.5 ? 1 : -1) * mix(1.0, 1.35, rand()), 0.18 + rand() * 0.14);
  });

  // the columns round the rim: three broken off standing, one fallen
  const cp = stonePaint(17, { moss: 1.1, lichen: 1.2, damp: 0.8, base: C(0xb0ada2) });
  const CR = 0.34;
  const column = (a, h) => {
    const x = Math.cos(a) * 3.95;
    const z = Math.sin(a) * 3.95;
    const tq = new THREE.Quaternion().setFromAxisAngle(UP, -a);
    const corner = (dx, dy, dz) => V3(dx, dy, dz).applyQuaternion(tq).add(V3(x, 0, z));
    const P = boxCorners(1, 1, 1).map((c) => corner(c.x * 0.94, c.y < 0 ? 0.9 : TOP + 0.3, c.z * 0.94));
    block(P, { chamfer: 0.04 });
    bk.add(mats.ruin, paintSmooth(lathe([[0.001, 0], [0.43, 0], [0.43, 0.06], [0.4, 0.1], [0.42, 0.15], [0.37, 0.2], [0.35, 0.24]], 24).translate(x, TOP + 0.3, z), cp), { uv: 0.6 });
    let y = TOP + 0.54;
    let left = h;
    let dn = 0;
    while (left > 0.05) {
      const dh = Math.min(left, 0.9 + rand() * 0.25);
      const last = left - dh < 0.3;
      const geo = drumGeo(CR, last ? left : dh, { seed: seed++, broken: last ? 0.35 : 0, caps: [dn === 0, true] });
      geo.rotateY(rand() * 0.2).translate(x + (rand() - 0.5) * 0.02, y, z + (rand() - 0.5) * 0.02);
      bk.add(mats.ruin, paintSmooth(geo, cp));
      y += (last ? left : dh) + 0.006;
      left -= last ? left : dh;
      dn++;
    }
    moss(x, y - 0.25, z, 0.26, { h: 0.55 });
    return V3(x, y, z);
  };
  column(0.7, 3.4);
  column(2.35, 1.8);
  column(3.95, 2.7);
  // the fallen one: a stump, its drums lying across the flags and one on
  // the grass below, and its capital rolled off the edge
  const fa = 5.25;
  column(fa, 0.55);
  const dir = V3(Math.cos(fa + 2.25), 0, Math.sin(fa + 2.25));
  const from = V3(Math.cos(fa) * 3.95, 0, Math.sin(fa) * 3.95);
  [[0.85, TOP], [1.85, TOP], [3.3, TOP]].forEach(([d, base], i) => {
    const p = from.clone().addScaledVector(dir, d);
    const roll = (rand() - 0.5) * 0.5;
    const geo = drumGeo(CR, 0.88, { seed: seed++, broken: i === 2 ? 0.25 : 0 });
    geo.translate(0, -0.44, 0).rotateZ(Math.PI / 2).rotateY(-Math.atan2(dir.z, dir.x) + roll).translate(p.x, base + CR - 0.02, p.z);
    bk.add(mats.ruin, paintSmooth(geo, cp));
    tufts.push({ x: p.x, y: base, z: p.z + 0.35, h: 0.2, n: 5, s: 0.2 });
  });
  {
    const out = V3(Math.cos(fa + 0.5) * (R + 1.0), 0, Math.sin(fa + 0.5) * (R + 1.0));
    bk.at([out.x, 0, out.z], rand() * TAU, () => {
      const cap = lathe([[0.001, 0], [0.32, 0], [0.33, 0.05], [0.42, 0.15], [0.55, 0.24], [0.56, 0.28], [0.001, 0.28]], 20);
      tf(cap, { r: [0.4, 0, 0.35], p: [0, 0.08, 0] });
      bk.add(mats.ruin, paintSmooth(cap, cp), { uv: 0.6 });
      const ab = hexBlock(placeCorners(boxCorners(1.2, 0.22, 1.2), { p: [0.1, 0.32, 0.12], r: [0.4, 0.3, 0.35] }), { seed: seed++, paint: cp, chip: 0.6, chamfer: 0.05 });
      bk.add(mats.ruin, ab, { uv: 0.42 });
    });
    tufts.push({ x: out.x + 0.5, y: 0, z: out.z, h: 0.4, n: 10, s: 0.4 });
  }

  // grass round the foot of the drum, moss on its coping
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * TAU + rand() * 0.1;
    if (Math.abs(((a + Math.PI) % TAU) - Math.PI) < 0.32) continue;
    const rr = R + 0.05 + rand() * 0.6;
    tufts.push({ x: Math.cos(a) * rr, y: 0, z: Math.sin(a) * rr, h: 0.3 + rand() * 0.3, n: 8, s: 0.25 });
  }
  for (let i = 0; i < 14; i++) {
    const a = rand() * TAU;
    if (Math.abs(((a + Math.PI) % TAU) - Math.PI) < 0.35) continue;
    moss(Math.cos(a) * (R - 0.35), TOP - 0.01, Math.sin(a) * (R - 0.35), 0.2 + rand() * 0.3, { h: 0.3 });
  }
  bk.add(mats.grass, grassGeo(tufts, 7));
  for (let i = 0; i < 5; i++) {
    const a = rand() * TAU;
    const rr = 1.8 + rand() * 1.4;
    bk.add(mats.leaves, fallenLeavesGeo(40 + i, { count: 22, spread: 0.7 }), { p: [Math.cos(a) * rr, TOP, Math.sin(a) * rr] });
  }
  bk.build(g);
  return { group: g, sit: V3(0.12, TOP + 0.78, 0), stepsAt: V3(R + 4 * TREAD + 0.35, 0, 0), radius: R, top: TOP };
}

// ── the ruined stair ──

// An old stone stair laid up the hillside along +x, rising `rise` over
// `len`, `w` wide, its foot at the origin and its top at (len, rise, 0):
// the treads two or three stones across, worn, tilted, cracked, sunk, and
// here and there gone, grass and moss in the gaps; a low wall each side,
// broken down to a few courses and in places to nothing. Each step's stones
// go down well below it, so the stair can be set into a slope.
export function ruinStair(K, { len = 14, w = 2.4, rise = 6 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'ruinStair';
  const bk = parts();
  const rand = rng(Math.round(len * 13 + rise * 7 + w * 3));
  const paint = stonePaint(19, { moss: 1.1, damp: 0.6 });
  const n = Math.max(3, Math.round(rise / 0.21));
  const tread = len / n;
  const step = rise / n;
  const slope = (x) => (rise * x) / len;
  const tufts = [];
  let seed = 100;
  const tintOf = () => new THREE.Color(1, 1, 1).multiplyScalar(0.9 + rand() * 0.18);
  const block = (P, o = {}) => bk.add(mats.ruin, hexBlock(P, { seed: seed++, paint, tint: tintOf(), ...o }), { uv: 0.42 });
  const hw = w / 2;
  for (let i = 0; i < n; i++) {
    const x0 = i * tread;
    const x1 = (i + 1) * tread + 0.04;
    const top = (i + 1) * step;
    const bottom = top - step - 0.45;
    const count = rand() < 0.5 ? 2 : 3;
    const cuts = [-hw];
    for (let k = 1; k < count; k++) cuts.push(mix(-hw, hw, k / count) + (rand() - 0.5) * 0.3);
    cuts.push(hw);
    for (let k = 0; k < count; k++) {
      const z0 = cuts[k] + 0.015;
      const z1 = cuts[k + 1] - 0.015;
      const roll = rand();
      if (roll < 0.07 && i > 0 && i < n - 1) {
        // gone: the earth under it, grass and moss
        tufts.push({ x: (x0 + x1) / 2, y: top - step * 0.9, z: (z0 + z1) / 2, h: 0.3, n: 9, s: 0.25 });
        bk.add(mats.moss, mossGeo(0.32, seed++, { h: 0.4 }), { p: [(x0 + x1) / 2, top - step - 0.02, (z0 + z1) / 2], uv: 3 });
        continue;
      }
      const wear = 0.02 + rand() * 0.05;
      const sink = roll < 0.2 ? rand() * 0.06 : 0;
      const tilt = roll > 0.85 ? (rand() - 0.5) * 0.12 : 0;
      const P = boxCorners(1, 1, 1).map((c) => {
        const x = c.x < 0 ? x0 : x1;
        const z = c.z < 0 ? z0 : z1;
        const y = c.y < 0 ? bottom : top - sink - (c.x > 0 ? wear : 0) + tilt * (z - (z0 + z1) / 2);
        return V3(x, y, z);
      });
      block(P, { chamfer: 0.04 + rand() * 0.03, chip: 0.45, flatBottom: true });
      if (rand() < 0.35) tufts.push({ x: x1 - 0.02, y: top - step, z: mix(z0, z1, rand()), h: 0.2, n: 4, s: 0.06 });
    }
    if (rand() < 0.5) tufts.push({ x: x0 + 0.05, y: top, z: (rand() > 0.5 ? 1 : -1) * (hw - 0.08), h: 0.25, n: 6, s: 0.08 });
  }
  // the side walls: blocks along the slope, broken down unevenly
  for (const sz of [-1, 1]) {
    const z0 = sz * (hw + 0.02);
    const z1 = sz * (hw + 0.44);
    let x = -0.3;
    while (x < len + 0.2) {
      const l = 0.9 + rand() * 0.6;
      const xb = Math.min(len + 0.4, x + l);
      const kind = rand();
      if (kind < 0.12) {
        // a gap where the wall has gone, a stone fallen out of it
        const fp = placeCorners(boxCorners(0.6, 0.3, 0.42), { p: [(x + xb) / 2, slope((x + xb) / 2) + 0.05, z1 + sz * 0.35], r: [rand() * 0.4, rand(), 0.2] });
        block(fp, { chamfer: 0.05, chip: 0.6 });
        x = xb;
        continue;
      }
      const ha = kind < 0.4 ? 0.2 + rand() * 0.2 : 0.45 + rand() * 0.5;
      const hb = Math.max(0.12, ha + (rand() - 0.5) * 0.35);
      const ya = slope(x);
      const yb = slope(xb);
      const P = boxCorners(1, 1, 1).map((c) => {
        const xx = c.x < 0 ? x + 0.012 : xb - 0.012;
        const base = c.x < 0 ? ya : yb;
        const y = c.y < 0 ? base - 0.6 : base + (c.x < 0 ? ha : hb);
        return V3(xx, y, c.z < 0 ? Math.min(z0, z1) : Math.max(z0, z1));
      });
      block(P, { chamfer: 0.05, chip: 0.5 });
      if (rand() < 0.4) bk.add(mats.moss, mossGeo(0.22 + rand() * 0.1, seed++, { h: 0.4 }), { p: [(x + xb) / 2, (ya + yb) / 2 + (ha + hb) / 2, (z0 + z1) / 2], uv: 3 });
      if (rand() < 0.6) tufts.push({ x: xb, y: yb, z: z1 + sz * 0.05, h: 0.35, n: 8, s: 0.15 });
      x = xb;
    }
  }
  bk.add(mats.grass, grassGeo(tufts, 3));
  bk.build(g);
  return { group: g, top: V3(len, rise, 0), steps: n };
}
