// The dwarf-work and the halls: the carved bands, the pillars, the
// Dwarrowdelf, the fork of three passages, the broken stairs, fallen stone
// and Gandalf’s staff-light. Moved out of props.js as they were.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../../../../lib/three/canvasTexture';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { B, boxUV, parts, rng, roundBox, tf } from '../../shire/build';
import { abyssTone, hexHull } from './bridge';
import { BANDS } from './canvases';
import { _kd, blockGeo, chunkGeo, dwarfDoor, ext, frameGeo, noise3, passageGeo, shapeOf, TAU, tint, V3 } from './helpers';

// ── dwarf-work: octagons, bands ──

// A square `half` either side of the middle with its corners cut back by
// `ch`: eight points (x, z), round anticlockwise seen from below.
export function octagon(half, ch) {
  const a = half;
  const b = half - ch;
  return [[a, -b], [a, b], [b, a], [-b, a], [-a, b], [-a, -b], [-b, -a], [b, -a]];
}

// A post of octagonal rings [{ y, half, ch }] one above the next: each of
// its eight faces smooth up its length and sharp at its corners; capped
// top and bottom if asked. Rings at one height with different sizes make
// a ledge.
export function octLoft(rings, { top = false, bottom = false } = {}) {
  const R = rings.map(({ y, half, ch }) => octagon(half, ch).map(([x, z]) => [x, y, z]));
  const geos = [];
  for (let e = 0; e < 8; e++) {
    const pos = [];
    const idx = [];
    for (let k = 0; k < R.length; k++) pos.push(...R[k][e], ...R[k][(e + 1) % 8]);
    for (let k = 0; k < R.length - 1; k++) {
      const i = k * 2;
      idx.push(i, i + 3, i + 1, i, i + 2, i + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    geos.push(g.toNonIndexed());
  }
  const cap = (ring, up) => {
    const pos = [];
    const y = ring[0][1];
    for (let e = 0; e < 8; e++) {
      const p0 = ring[e];
      const p1 = ring[(e + 1) % 8];
      if (up) pos.push(0, y, 0, ...p1, ...p0);
      else pos.push(0, y, 0, ...p0, ...p1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    geos.push(g);
  };
  if (top) cap(R[R.length - 1], true);
  if (bottom) cap(R[0], false);
  return mergeGeometries(geos);
}

// The texture rows of one kind of carving (BANDS), kept clear of the next.
export const bandV = (kind) => [1 - (kind + 1) / BANDS + 0.003, 1 - kind / BANDS - 0.003];

// A carved band round an octagonal post: a ring `proud` of it from y0, h
// tall, its faces carrying `kind` of carving (reading left to right as you
// face it), its top and foot plain.
export function octBand(half, ch, y0, h, kind, proud = 0.04) {
  const [v0, v1] = bandV(kind);
  const outer = octagon(half + proud, ch + proud * 0.4).reverse();
  const inner = octagon(half, ch).reverse();
  const pos = [];
  const uv = [];
  const rep = h * 4;
  let u = 0;
  for (let e = 0; e < 8; e++) {
    const [ax, az] = outer[e];
    const [bx, bz] = outer[(e + 1) % 8];
    const len = Math.hypot(bx - ax, bz - az);
    const u0 = u / rep;
    const u1 = (u + len) / rep;
    u += len;
    // the face
    pos.push(ax, y0, az, bx, y0, bz, bx, y0 + h, bz, ax, y0, az, bx, y0 + h, bz, ax, y0 + h, az);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    // its top and foot, back to the post
    const [cx, cz] = inner[e];
    const [dx, dz] = inner[(e + 1) % 8];
    pos.push(ax, y0 + h, az, bx, y0 + h, bz, dx, y0 + h, dz, ax, y0 + h, az, dx, y0 + h, dz, cx, y0 + h, cz);
    pos.push(ax, y0, az, dx, y0, dz, bx, y0, bz, ax, y0, az, cx, y0, cz, dx, y0, dz);
    for (let i = 0; i < 12; i++) uv.push(u0, v1 - 0.002);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A straight carved band w wide, h tall and d deep, its middle at the
// origin and its face to +z: `kind` of carving along it (or up it, if
// `upright`), its other faces plain.
export function bandBox(w, h, d, kind, { upright = false } = {}) {
  const [v0, v1] = bandV(kind);
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const p = g.attributes.position;
  const nr = g.attributes.normal;
  const uv = g.attributes.uv;
  const across = upright ? w : h;
  for (let i = 0; i < p.count; i++) {
    if (nr.getZ(i) > 0.5) {
      const x = p.getX(i);
      const y = p.getY(i);
      if (upright) uv.setXY(i, (y + h / 2) / (across * 4), mix(v0, v1, (x + w / 2) / w));
      else uv.setXY(i, (x + w / 2) / (across * 4), mix(v0, v1, (y + h / 2) / h));
    } else uv.setXY(i, 0.1, v1 - 0.002);
  }
  return g;
}

// One great pillar of the Dwarrowdelf, its foot at the origin: a stepped
// plinth, a polished octagonal shaft 2.6 m across with carved bands low and
// high and long sunk panels on its faces, a moulded capital, then flaring
// in two steps and a long curve to meet its neighbours `step` away, `top`
// up. Returns its stone and its carving, for merging.
export function pillarGeos(step = 9, top = 30) {
  const stone = [];
  const carve = [];
  const H = 1.3;
  const CH = 0.24;
  const shaftTop = top - 8.4;
  stone.push(octLoft([{ y: 0, half: 1.95, ch: 0.45 }, { y: 0.42, half: 1.95, ch: 0.45 }], { top: true }));
  stone.push(octLoft([{ y: 0.42, half: 1.68, ch: 0.38 }, { y: 0.8, half: 1.68, ch: 0.38 }], { top: true }));
  stone.push(octLoft([{ y: 0.8, half: 1.5, ch: 0.3 }, { y: 1.0, half: 1.5, ch: 0.3 }, { y: 1.16, half: 1.36, ch: 0.26 }], { top: true }));
  stone.push(octLoft([{ y: 1.16, half: H, ch: CH }, { y: shaftTop, half: H, ch: CH }]));
  carve.push(octBand(H, CH, 2.2, 0.9, 2, 0.05));
  carve.push(octBand(H, CH, 3.28, 0.34, 0, 0.035));
  carve.push(octBand(H, CH, shaftTop - 1.7, 0.6, 3, 0.05));
  carve.push(octBand(H, CH, shaftTop - 0.95, 0.3, 1, 0.035));
  // the long sunk panels: a fillet round each of the four broad faces
  const b = H - CH;
  const y0 = 4.3;
  const y1 = shaftTop - 2.4;
  for (let f = 0; f < 4; f++) {
    for (const [w, h, x, y] of [[0.07, y1 - y0, -b + 0.18, (y0 + y1) / 2], [0.07, y1 - y0, b - 0.18, (y0 + y1) / 2], [2 * b - 0.29, 0.07, 0, y0], [2 * b - 0.29, 0.07, 0, y1]]) {
      stone.push(B(w, h, 0.05).translate(x, y, H + 0.012).rotateY((f * Math.PI) / 2));
    }
  }
  // the capital: a moulded collar, then the flare: two corbelled steps and
  // a long curve out to the vault
  stone.push(octLoft([
    { y: shaftTop, half: H, ch: CH },
    { y: shaftTop + 0.14, half: H + 0.12, ch: CH + 0.04 },
    { y: shaftTop + 0.45, half: H + 0.12, ch: CH + 0.04 },
    { y: shaftTop + 0.55, half: H, ch: CH },
  ]));
  const fy = shaftTop + 0.55;
  const flare = (t) => H + (step / 2 - H) * Math.pow(t, 2.3);
  const rings = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = mix(fy, top, t);
    const hh = flare(t);
    const chh = CH + (hh - H) * 0.32;
    if (i === 4 || i === 8) rings.push({ y, half: hh - 0.16, ch: chh - 0.05 }, { y: y + 0.002, half: hh + 0.04, ch: chh + 0.01 });
    else rings.push({ y, half: hh, ch: chh });
  }
  stone.push(octLoft(rings));
  return { stone, carve };
}

// ── the Dwarrowdelf ──

// A section of the great hall of Dwarrowdelf, `w` (along x) by `d`, its
// floor at y = 0 and its roof `top` up, lost in the dark: a grid of the
// great pillars `step` apart standing on a floor of big slabs, banded
// along the lines between them. pillars: [{ x, z, w }] (w across, for
// colliders). lightFrom(k, at): Gandalf risking a little more light — a
// cold glow from the staff (at the camera, or `at` in the world) catching
// the pillars' polish, reaching further and higher as k goes 0 → 1.
export function hall(K, { w = 60, d = 40, step = 9, top = 30 } = {}) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'dwarrowdelf';
  const bk = parts();
  const n = makeNoise(91);
  const nx = Math.floor(w / step / 2);
  const nz = Math.floor(d / step / 2);
  const pillars = [];
  const { stone, carve } = pillarGeos(step, top);
  const one = mergeGeometries(stone.map((x) => {
    const y = x.index ? x.toNonIndexed() : x;
    for (const k of Object.keys(y.attributes)) if (k !== 'position' && k !== 'normal') y.deleteAttribute(k);
    return y;
  }));
  const oneCarve = mergeGeometries(carve);
  for (let i = -nx; i <= nx; i++) {
    for (let j = -nz; j <= nz; j++) {
      const x = i * step;
      const z = j * step;
      pillars.push({ x, z, w: 2.6 });
      const tone = 0.85 + n(i * 3.1, j * 2.7) * 0.3;
      const green = n(i * 1.7 + 9, j * 1.3) - 0.5;
      const geo = one.clone().translate(x, 0, z);
      tint(geo, (px, py, pz, out) => {
        const v = noise3(n, px * 0.4, py * 0.15, pz * 0.4);
        out.setRGB(tone * (0.95 - green * 0.06), tone * (0.98 + green * 0.05), tone).multiplyScalar(0.8 + v * 0.4);
        // grime at the foot, where hands and feet have been
        out.multiplyScalar(mix(0.7, 1, smooth(0, 1.6, py)));
      });
      bk.add(mats.hallStone, geo, { uv: 0.22 });
      bk.add(mats.hallCarve, oneCarve.clone().translate(x, 0, z));
    }
  }
  // the floor: one bay of its pattern between each four pillars
  const floor = new THREE.PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2);
  {
    const p = floor.attributes.position;
    const uv = floor.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + nx * step) / step, (p.getZ(i) + nz * step) / step);
  }
  bk.add(mats.hallFloor, floor);
  // the roof, far up in the dark
  const roof = new THREE.PlaneGeometry(w + step, d + step).rotateX(Math.PI / 2).translate(0, top + 0.01, 0);
  bk.add(mats.hallStone, tint(roof, (x, y, z, out) => out.setRGB(0.25, 0.27, 0.26)), { uv: 0.1 });
  bk.build(g);

  const lightFrom = (k, at = null) => {
    U.uReveal.value = clamp01(k);
    if (at) {
      U.uRevealAt.value.copy(at);
      U.uRevealCam.value = 0;
    } else U.uRevealCam.value = 1;
  };
  return { group: g, pillars, lightFrom, step, top };
}

// ── the fork ──

// Where the way divides: three dark passages side by side, each 3 m wide
// and 5 m tall with the dwarves' angled heads, in a carved surround 14.8 m
// wide at the top of three steps (the landing is 0.8 up). Stepped frames
// round each doorway, runes over them, chevroned pilasters between, a
// frieze and a stepped cornice over all. Its face is on z = 0, looking to
// +z; ways are the three thresholds.
export function fork(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'fork';
  const bk = parts();
  const XS = [-4.8, 0, 4.8];
  const A = 1.5;
  const HS = 4.0;
  const TOP = 5.0;
  const Y0 = 0.8;
  const HW = 7.4;
  const HT = 11;
  const D = 1.2;
  const BACK = 9;
  const door = dwarfDoor(A, HS, TOP);
  // the steps, and the platform the passages run back on
  for (const [y, z1] of [[0.8, 1.0], [0.6, 1.45], [0.4, 1.9], [0.2, 2.35]]) {
    bk.add(mats.basalt, roundBox(2 * HW + 0.6, y, z1, 0.03), { p: [0, y / 2, z1 / 2], uv: 0.4, color: 0x9a9a96 });
  }
  bk.add(mats.basalt, B(2 * HW, Y0, BACK), { p: [0, Y0 / 2, -BACK / 2], uv: 0.3, color: 0x8a8a86 });
  // the wall, the three doorways cut up into it
  const outline = [[-HW, Y0]];
  for (const x of XS) for (const [px, py] of door) outline.push([x + px, Y0 + py]);
  outline.push([HW, Y0], [HW, HT], [-HW, HT]);
  bk.add(mats.ashlar, ext(shapeOf(outline), D), { p: [0, 0, -D], uv: 0.34, color: 0xb0b0ac });
  for (const x of XS) {
    const o = door.map(([px, py]) => [px, py]);
    // two stepped frames, the inner proud of the outer
    bk.add(mats.basalt, frameGeo(o, 0.34, 0.26), { p: [x, Y0, 0], uv: 0.5, color: 0xd0d4d0 });
    bk.add(mats.basalt, frameGeo(o, 0.24, 0.14, 0.34), { p: [x, Y0, 0], uv: 0.5, color: 0xa8aca8 });
    // runes over the doorway, and a stepped crest over that
    bk.add(mats.carve, bandBox(3.6, 0.55, 0.2, 2), { p: [x, Y0 + TOP + 0.95, 0.1] });
    for (let k = 0; k < 3; k++) bk.add(mats.basalt, B(2.6 - k * 0.8, 0.28, 0.16), { p: [x, Y0 + TOP + 1.38 + k * 0.28, 0.08], uv: 0.5, color: 0xc0c4c0 });
    // the passage
    bk.add(mats.deep, passageGeo(o.map(([px, py]) => [x + px, Y0 + py]), -D + 0.001, BACK - D));
    bk.add(mats.void, new THREE.PlaneGeometry(2 * A, TOP), { p: [x, Y0 + TOP / 2, -BACK + 0.01] });
  }
  // pilasters between the doorways and at the ends, chevrons up them
  for (const x of [-HW + 0.32, -2.4, 2.4, HW - 0.32]) {
    bk.add(mats.carve, bandBox(0.56, 7.1, 0.22, 0, { upright: true }), { p: [x, Y0 + 3.55, 0.11] });
    bk.add(mats.basalt, B(0.76, 0.3, 0.32), { p: [x, Y0 + 0.15, 0.16], uv: 0.5, color: 0xb8bcb8 });
  }
  // the frieze and the cornice over all
  bk.add(mats.basalt, B(2 * HW, 0.3, 0.26), { p: [0, Y0 + 7.25, 0.13], uv: 0.5, color: 0xc0c4c0 });
  bk.add(mats.carve, bandBox(2 * HW, 0.8, 0.2, 3), { p: [0, Y0 + 7.8, 0.1] });
  for (let k = 0; k < 3; k++) bk.add(mats.basalt, B(2 * HW + 0.3 + k * 0.3, 0.26, 0.3 + k * 0.18), { p: [0, Y0 + 8.33 + k * 0.26, 0.15 + k * 0.09], uv: 0.5, color: 0xc8ccc8 });
  bk.build(g);
  return { group: g, ways: XS.map((x) => V3(x, Y0, 0)), landing: Y0 };
}

// A steep narrow stair of the dwarves, 3 m wide, without rails, going down
// along -x from its head 12 m up (at x = 14.4) to its foot at the origin:
// forty worn steps on a sloping slab, one slender pier under its upper half
// going down into the abyss. About two-thirds of the way down a piece has
// fallen away: gap { x0, x1 } is the hole, along x, its edges broken.
export function stairs(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'stairs';
  const bk = parts();
  const n = makeNoise(161);
  const r = rng(163);
  const N = 40;
  const RISE = 0.3;
  const TREAD = 0.36;
  const W = 1.5;
  const RUN = N * TREAD;
  const soffit = (x) => x * (RISE / TREAD) - 1.7;
  const gap = { x0: 11 * TREAD, x1: 16 * TREAD };
  const tone = abyssTone(n);
  for (let i = 0; i < N; i++) {
    const x0 = i * TREAD;
    const x1 = (i + 1) * TREAD;
    if (x0 >= gap.x0 - 1e-6 && x1 <= gap.x1 + 1e-6) continue;
    const yt = (i + 1) * RISE;
    const P = [];
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let ii = 0; ii < 2; ii++) {
      const x = ii ? x1 : x0;
      P.push(V3(x, j ? yt : soffit(x), (k - 0.5) * 2 * W));
    }
    // the steps either side of the break: broken off ragged
    const before = Math.abs(x1 - gap.x0) < 1e-6;
    const after = Math.abs(x0 - gap.x1) < 1e-6;
    if (before || after) {
      for (const c of [0, 1, 2, 3, 4, 5, 6, 7]) {
        const atEdge = before ? c & 1 : !(c & 1);
        if (!atEdge) continue;
        P[c].x += (before ? -1 : 1) * (0.05 + r() * 0.25);
        P[c].y -= c & 2 ? r() * 0.18 : -r() * 0.4;
      }
    }
    const geo = hexHull(P, 300 + i, 0.035, before || after ? 0.8 : 0.25);
    bk.add(mats.abyss, tint(geo, tone), { uv: 0.6 });
  }
  // shards hanging at the break, and stones fallen on the steps below it
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? gap.x1 + 0.1 : gap.x0 - 0.1;
    const s = 0.12 + r() * 0.18;
    const geo = chunkGeo(330 + i, s, 0.7);
    const x = side + (r() - 0.5) * 0.3;
    tf(geo, { p: [x, soffit(x) + 0.3 + r() * 1.2, (r() - 0.5) * 2.4], r: [r(), r() * 3, r()] });
    bk.add(mats.abyss, tint(geo, tone), { uv: 1 });
  }
  for (let i = 0; i < 5; i++) {
    const k = Math.floor(r() * 9);
    const x = (k + 0.5) * TREAD;
    const s = 0.08 + r() * 0.12;
    const geo = chunkGeo(340 + i, s, 0.6);
    tf(geo, { p: [x, (k + 1) * RISE + s * 0.3, (r() - 0.5) * 2.2], r: [r(), r() * 3, 0] });
    bk.add(mats.abyss, tint(geo, tone), { uv: 1 });
  }
  // the pier under its upper half, tapering away into the deep
  const px = RUN * 0.74;
  const top = soffit(px) + 0.2;
  const pier = [];
  for (let k = 0; k <= 10; k++) {
    const y = mix(top, -60, Math.pow(k / 10, 1.3));
    const w = mix(1.3, 0.6, k / 10);
    pier.push({ y, half: w, ch: w * 0.3 });
  }
  const pg = octLoft(pier.reverse()).translate(px, 0, 0);
  pg.scale(1, 1, 1);
  bk.add(mats.abyss, tint(pg, tone), { uv: 0.4 });
  bk.build(g);
  return { group: g, gap, run: RUN, rise: N * RISE, width: 2 * W };
}

// ── fallen stone ──

// A pile of fallen rock about 3 m across, one geometry coloured at its
// corners for instancing: a few big broken lumps, squared blocks from the
// dwarves' masonry among them, and smaller stones heaped round and between.
export function rubbleGeo(seed = 1) {
  const r = rng(seed * 19 + 1);
  const n = makeNoise(seed * 3 + 2);
  const geos = [];
  const heap = (d) => 0.75 * Math.pow(Math.max(0, 1 - d / 1.6), 1.4);
  const put = (geo, x, z, lift, tone) => {
    geo.rotateY(r() * TAU).rotateX((r() - 0.5) * 0.6).rotateZ((r() - 0.5) * 0.6);
    geo.translate(x, heap(Math.hypot(x, z)) + lift, z);
    boxUV(geo, 0.5);
    tint(geo, (px, py, pz, out, nx, ny) => {
      const v = noise3(n, px * 2.5, py * 2.5, pz * 2.5);
      out.setRGB(tone, tone, tone * 1.02).multiplyScalar(0.75 + v * 0.45);
      // dust settled on the tops, grime low down
      out.lerp(_kd.setRGB(0.95, 0.93, 0.88), clamp01(ny) * 0.18);
      out.multiplyScalar(mix(0.55, 1, smooth(0, 0.5, py)));
    });
    geos.push(geo);
  };
  for (let i = 0; i < 3; i++) {
    const a = r() * TAU;
    const d = 0.2 + r() * 0.5;
    put(chunkGeo(seed * 7 + i, 0.55 + r() * 0.3, 0.6, 12), Math.cos(a) * d, Math.sin(a) * d, -0.15, 0.8 + r() * 0.2);
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * TAU;
    const d = 0.4 + r() * 0.8;
    put(blockGeo(0.5 + r() * 0.4, 0.35 + r() * 0.15, 0.4 + r() * 0.2, seed * 11 + i, 0.05), Math.cos(a) * d, Math.sin(a) * d, -0.05, 0.95 + r() * 0.15);
  }
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 1.55;
    const s = mix(0.1, 0.32, r()) * (1.2 - d * 0.35);
    put(chunkGeo(seed * 13 + i + 20, s, 0.55, 8), Math.cos(a) * d, Math.sin(a) * d, s * 0.1, 0.7 + r() * 0.3);
  }
  const g = mergeGeometries(geos);
  g.computeBoundingSphere();
  return g;
}

// ── Gandalf's staff ──

// The staff-light: a soft white glow with a hot core, for the tip of the
// staff. set(k): 0 out, 1 bright; it grows as it brightens.
export function staffLight(K) {
  const halo = new THREE.SpriteMaterial({ map: K.tex.glow, color: hot(0xdfe9ff, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const core = new THREE.SpriteMaterial({ map: K.tex.glow, color: hot(0xffffff, 3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(halo);
  sprite.name = 'staffLight';
  const inner = new THREE.Sprite(core);
  inner.scale.setScalar(0.32);
  sprite.add(inner);
  sprite.renderOrder = 5;
  inner.renderOrder = 5;
  const set = (k) => {
    const t = clamp01(k);
    sprite.visible = t > 0.001;
    sprite.scale.setScalar(mix(0.25, 2.4, t));
    halo.opacity = mix(0.3, 0.85, t);
    core.opacity = mix(0.6, 1, t);
    core.color.copy(hot(0xffffff, mix(1.5, 4, t)));
  };
  set(0.6);
  return { sprite, set };
}
