// The camp on the lawn of Parth Galen, and the elven boats drawn up by the
// lake. Moved out of props.js as they were.

import * as THREE from 'three';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { ball, blob, cyl, cylX, lathe, parts, rng, roundBox, tf, tube } from '../../shire/build';
import { _kd, _zAxis, C, geoOf, gridIdx, TAU, V3 } from './helpers';
import { paintSmooth, stonePaint } from './stone';

// ── the camp at Parth Galen ──

// The Fellowship's camp on the lawn: a ring of stones round last night's
// cold ash, a few logs stood together over it ready to light and more laid
// by; the packs propped round about, each with its bedroll strapped on top,
// two more bedrolls rolled and tied and one spread out on the grass; and
// Sam's cooking pot at the ring's edge with a ladle in it.
export function camp(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'camp';
  const bk = parts();
  const rand = rng(43);
  const ne = makeNoise(44);
  const rockPaint = stonePaint(45, { moss: 0.5, lichen: 0.8, damp: 0.3, base: C(0x8a887e) });

  // the hearth: grey ash, gone cold, and a few black ends of charcoal
  bk.add(mats.earth, blob(0.52, { detail: 2, amp: 0.15, freq: 3, seed: 6 }), {
    s: [1, 0.07, 1],
    color: (x, y, z, out) => out.setRGB(0.34, 0.32, 0.3).lerp(_kd.setRGB(0.05, 0.045, 0.04), clamp01(ne(x * 8, z * 8) * 1.6 - 0.55)),
  });
  // the ring of stones, sooted on the inside
  const ring = 11;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * TAU + rand() * 0.2;
    const rr = 0.66 + rand() * 0.06;
    const geo = blob(0.15 + rand() * 0.05, { detail: 1, amp: 0.3, freq: 2.2, seed: 70 + i });
    tf(geo, { p: [Math.cos(a) * rr, 0.05, Math.sin(a) * rr], s: [1.25, 0.72, 1], r: [rand() * 0.3, -a, rand() * 0.3] });
    paintSmooth(geo, rockPaint);
    const c = geo.attributes.color;
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const soot = (1 - smooth(0.58, 0.74, Math.hypot(p.getX(k), p.getZ(k)))) * 0.75;
      c.setXYZ(k, mix(c.getX(k), 0.05, soot), mix(c.getY(k), 0.045, soot), mix(c.getZ(k), 0.04, soot));
    }
    bk.add(mats.rock, geo, { uv: 1.2 });
  }
  // a log: bark, and the pale wood of its sawn ends
  const endWood = (x, y, z, out) => out.setRGB(0.72, 0.6, 0.44).multiplyScalar(0.8 + ne(x * 40 + y * 30, z * 40) * 0.3);
  const log = (A, Bp, rad, seed) => {
    const a = V3(...A);
    const b = V3(...Bp);
    const mid = a.clone().lerp(b, 0.5).add(V3((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.03));
    bk.add(mats.trunk, tube([a, mid, b], rad, rad * 0.88, { seg: 4, radial: 7, gnarl: 0.15, seed, uvK: 1.6 }));
    for (const [p, q] of [[a, b], [b, a]]) {
      const end = new THREE.CircleGeometry(rad * 0.93, 8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_zAxis, p.clone().sub(q).normalize()));
      bk.add(mats.wood, end.translate(p.x, p.y, p.z), { color: endWood });
    }
  };
  // stood together over the ash, ready for the evening, and kindling under
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rand() * 0.3;
    log([Math.cos(a) * 0.38, 0.04, Math.sin(a) * 0.38], [Math.cos(a + 2.7) * 0.05, 0.6 + rand() * 0.08, Math.sin(a + 2.7) * 0.05], 0.03 + rand() * 0.014, 10 + i);
  }
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU;
    bk.add(mats.wood, cylX(0.008 + rand() * 0.006, 0.22 + rand() * 0.12, 4), { p: [Math.cos(a) * 0.12, 0.05 + rand() * 0.04, Math.sin(a) * 0.12], r: [rand(), a, rand() * 0.4], color: 0x6a5238 });
  }
  // more laid by the ring
  log([0.95, 0.075, 0.6], [1.55, 0.07, 1.0], 0.075, 20);
  log([0.86, 0.07, 0.82], [1.38, 0.065, 1.3], 0.068, 21);
  log([1.05, 0.2, 0.75], [1.5, 0.2, 1.2], 0.062, 22);

  // the packs, propped round about, leaning back from the fire, a bedroll
  // strapped on top of each
  const strap = 0x3a2a1c;
  const PACKS = [[2.0, 0.55, 0x6a5a3e, 0x5a6a4a], [2.3, 1.75, 0x5a4a34, 0x7a3a2a], [2.15, 3.05, 0x6e6248, 0x4a5a6a], [2.35, 4.35, 0x5c4c38, 0x8a7448], [1.95, 5.5, 0x665a44, 0x56604a]];
  PACKS.forEach(([rr, a, hue, roll], i) => {
    bk.at([Math.cos(a) * rr, 0, Math.sin(a) * rr], Math.PI - a, () => {
      bk.at([0, 0, 0], [0, 0, 0.22], () => {
        bk.add(mats.blanket, blob(0.26, { detail: 2, amp: 0.1, freq: 2.4, seed: 30 + i }), { p: [0, 0.3, 0], s: [0.58, 1.05, 0.82], color: hue, uv: 2 });
        bk.add(mats.blanket, blob(0.17, { detail: 1, amp: 0.1, freq: 3, seed: 40 + i }), { p: [0.07, 0.5, 0], s: [0.65, 0.32, 1.15], r: [0, 0, -0.5], color: C(hue).multiplyScalar(0.85), uv: 2 });
        bk.add(mats.blanket, cyl(0.1, 0.1, 0.56, 10), { p: [-0.02, 0.66, 0], r: [Math.PI / 2, 0, 0], color: roll, uv: 2 });
        for (const z of [-0.17, 0.17]) {
          bk.add(mats.wood, new THREE.TorusGeometry(0.104, 0.011, 4, 12), { p: [-0.02, 0.66, z], color: strap });
          bk.add(mats.wood, tube([[-0.13, 0.12, z * 0.8], [-0.17, 0.35, z * 0.8], [-0.13, 0.56, z * 0.8]], 0.012, 0.012, { seg: 4, radial: 4 }), { color: strap });
        }
      });
    });
  });
  // two bedrolls rolled and tied, and one spread out on the grass
  const spiral = (hue) => (x, y, z, out) => {
    const d = Math.hypot(x, y) / 0.11;
    out.copy(C(hue)).multiplyScalar(0.75 + 0.35 * (0.5 + 0.5 * Math.sin(d * 22)));
  };
  for (const [x, z, a, hue] of [[-1.7, 1.6, 0.6, 0x4e5a44], [-2.2, 0.9, 1.1, 0x6a4a3a]]) {
    bk.at([x, 0, z], a, () => {
      bk.add(mats.blanket, cyl(0.11, 0.11, 0.72, 12), { p: [0, 0.11, 0], r: [Math.PI / 2, 0, 0], color: hue, uv: 2 });
      for (const s of [-1, 1]) {
        bk.add(mats.blanket, new THREE.CircleGeometry(0.108, 12), { p: [0, 0.11, s * 0.361], r: [0, s > 0 ? 0 : Math.PI, 0], color: spiral(hue) });
        bk.add(mats.wood, new THREE.TorusGeometry(0.114, 0.01, 4, 12), { p: [0, 0.11, s * 0.2], color: strap });
      }
    });
  }
  {
    const nb = makeNoise(61);
    const l = 1.7;
    const w = 0.76;
    const sheet = new THREE.PlaneGeometry(l, w, 12, 6);
    const p = sheet.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / l + 0.5;
      const v = p.getY(i) / (w / 2);
      const fold = (nb(u * 6, v * 3) - 0.5) * 0.06;
      const sag = Math.abs(v) > 0.8 ? -(Math.abs(v) - 0.8) * 0.3 : 0;
      p.setZ(i, 0.03 + fold + sag + (u < 0.12 ? (0.12 - u) * 0.6 : 0));
    }
    sheet.computeVertexNormals();
    bk.at([-1.4, 0, -1.5], 2.2, () => {
      bk.add(mats.blanket, sheet, {
        r: [-Math.PI / 2, 0, 0],
        color: (x, y, z, out) => {
          const u = x / l + 0.5;
          const stripe = (u > 0.07 && u < 0.1) || (u > 0.9 && u < 0.93) ? 1 : 0;
          out.setRGB(0.36, 0.4, 0.3).multiplyScalar(0.85 + nb(x * 5, z * 5) * 0.3).lerp(_kd.setRGB(0.6, 0.55, 0.42), stripe * 0.6);
        },
        uv: 2,
      });
    });
  }
  // the pot at the ring's edge, its lid tipped against it, a ladle in it
  bk.at([0.62, 0, -0.98], 0.4, () => {
    bk.add(mats.iron, lathe([[0.001, 0], [0.13, 0.005], [0.155, 0.07], [0.15, 0.2], [0.162, 0.215], [0.146, 0.215], [0.135, 0.03], [0.001, 0.03]], 16));
    bk.add(mats.iron, new THREE.TorusGeometry(0.155, 0.006, 4, 16, Math.PI), { p: [0, 0.215, 0], r: [0, 0, 0.6] });
    bk.add(mats.iron, lathe([[0.001, 0.03], [0.07, 0.025], [0.15, 0.008], [0.152, 0]], 16), { p: [0.24, 0.155, 0.05], r: [0, 0, 1.25] });
    bk.add(mats.iron, ball(0.018, 6, 4), { p: [0.28, 0.17, 0.05] });
    bk.add(mats.wood, tube([[-0.04, 0.05, 0.02], [-0.06, 0.2, 0.03], [-0.09, 0.4, 0.04]], 0.012, 0.01, { seg: 3, radial: 4 }), { color: 0x7a5a3a });
    bk.add(mats.wood, ball(0.035, 6, 4), { p: [-0.035, 0.05, 0.02], s: [1, 0.5, 1], color: 0x7a5a3a });
  });
  bk.build(g);
  return { group: g, fire: V3(0, 0.15, 0) };
}

// ── the boats ──

// An elven boat of Lórien, as Lórien's own: 6 m long and 1.2 m in the
// beam, grey-white and slender as a leaf, its hull sweeping up at either
// end, the prow rising into a swan's neck and head, the stern into an
// upswept tip; silver inlaid under the gunwale and in a folded wing on
// either bow, small decks at either end, ribs and floorboards inside, and
// two thwarts, each with a leaf-bladed paddle laid on the boards by it.
// Faces +x, its keel at y = 0. Its seats are where a sitting figure's
// origin goes (a toy hobbit's hips sit 0.42 above it, so it sits on the
// thwart), bow first; the paddles are groups (shaft along their own y,
// blade at -y, the origin mid-shaft) to take up.
export function boat(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'boat';
  const bk = parts();
  const HL = 3;
  const beam = (t) => 0.6 * Math.pow(Math.max(0, 1 - t * t), 0.62) * (1 - 0.05 * t);
  const keel = (t) => 0.02 + 0.22 * Math.pow(Math.abs(t), 3);
  const sheer = (t) => 0.47 + 0.3 * Math.pow(Math.abs(t), 4) + (t > 0 ? 0.14 * Math.pow(t, 8) : 0);
  // a point on the hull: t along it (-1 the stern, +1 the bow), f round it
  // (-1 the port gunwale, 0 the keel, +1 starboard), `inset` in from outside
  const hull = (t, f, inset = 0) => {
    const w = Math.max(0, beam(t) - inset);
    const yk = keel(t) + inset;
    const ys = sheer(t);
    const s = Math.sin((f * Math.PI) / 2);
    const c = 1 - Math.cos((f * Math.PI) / 2);
    return [t * HL, yk + (ys - yk) * Math.pow(c, 1.3), w * s];
  };
  const NT = 40;
  const NF = 14;
  const ts = [];
  for (let i = 0; i <= NT; i++) ts.push(Math.sin(((i / NT) * 2 - 1) * (Math.PI / 2)));
  const skin = (inset, outside) => {
    const pos = [];
    const uv = [];
    for (const t of ts) {
      for (let j = 0; j <= NF; j++) {
        const f = (j / NF) * 2 - 1;
        pos.push(...hull(t, f, inset));
        uv.push(t * HL * 0.9, f * 1.1);
      }
    }
    return geoOf(pos, gridIdx(NT, NF, outside), uv);
  };
  bk.add(mats.boat, skin(0, true));
  bk.add(mats.boat, skin(0.03, false));
  // the gunwale, round both sides and through both ends
  const gun = [];
  for (let i = 1; i < NT; i++) gun.push(V3(...hull(ts[i], 1, 0.015)).setY(sheer(ts[i]) + 0.012));
  gun.push(V3(HL, sheer(1) + 0.012, 0));
  for (let i = NT - 1; i > 0; i--) gun.push(V3(...hull(ts[i], -1, 0.015)).setY(sheer(ts[i]) + 0.012));
  gun.push(V3(-HL, sheer(-1) + 0.012, 0));
  bk.add(mats.boat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gun, true), 140, 0.03, 5, true));
  // small decks over either end, a line of silver down each
  for (const [t0, t1] of [[0.74, 0.995], [-0.995, -0.78]]) {
    const pos = [];
    const uv = [];
    const NR = 10;
    const NC = 5;
    for (let i = 0; i <= NR; i++) {
      const t = mix(t0, t1, i / NR);
      const w = Math.max(0.002, beam(t) - 0.012);
      for (let j = 0; j <= NC; j++) {
        const z = mix(-w, w, j / NC);
        pos.push(t * HL, sheer(t) - 0.015 + 0.03 * (1 - (z / w) ** 2), z);
        uv.push(t * HL * 0.9, z * 0.9);
      }
    }
    bk.add(mats.boat, geoOf(pos, gridIdx(NR, NC, t1 < t0), uv));
    const mid = [];
    for (let i = 0; i <= 6; i++) {
      const t = mix(t0, t1, i / 6);
      mid.push([t * HL, sheer(t) + 0.016, 0]);
    }
    bk.add(mats.silver, tube(mid, 0.008, 0.005, { seg: 8, radial: 3 }));
  }
  // the swan's neck and head at the prow, an upswept tip at the stern
  const neck = [[3.0, 0.8, 0], [3.13, 1.04, 0], [3.21, 1.34, 0], [3.15, 1.62, 0], [3.02, 1.82, 0], [2.97, 1.97, 0], [3.03, 2.09, 0], [3.15, 2.13, 0]];
  bk.add(mats.boat, tube(neck, 0.085, 0.045, { seg: 24, radial: 8, uvK: 1 }));
  bk.add(mats.boat, ball(0.07, 12, 8), { p: [3.18, 2.12, 0], s: [1.45, 0.9, 0.85] });
  bk.add(mats.silver, new THREE.ConeGeometry(0.028, 0.15, 6), { p: [3.32, 2.08, 0], r: [0, 0, -Math.PI / 2 - 0.35] });
  for (const s of [-1, 1]) bk.add(mats.silver, ball(0.011, 6, 4), { p: [3.2, 2.14, s * 0.052] });
  bk.add(mats.boat, tube([[-2.98, 0.76, 0], [-3.13, 0.9, 0], [-3.23, 1.06, 0], [-3.27, 1.2, 0], [-3.23, 1.3, 0]], 0.06, 0.016, { seg: 12, radial: 6, uvK: 1 }));
  // silver inlaid along her: a line under the gunwale, and on either bow a
  // folded wing, its feathers fanning back from the shoulder
  const dP = (t, f) => {
    const e = 1e-3;
    const a = V3(...hull(t + e, f)).sub(V3(...hull(t - e, f)));
    const b = V3(...hull(t, f + e)).sub(V3(...hull(t, f - e)));
    return a.cross(b).normalize();
  };
  const onHull = (t, f, side) => {
    const nrm = dP(t, f);
    if (nrm.z * side < 0) nrm.negate();
    return V3(...hull(t, f)).addScaledVector(nrm, 0.009);
  };
  for (const side of [-1, 1]) {
    const line = [];
    for (let i = 0; i <= 24; i++) line.push(onHull(mix(-0.9, 0.93, i / 24), side * 0.88, side));
    bk.add(mats.silver, tube(line, 0.009, 0.009, { seg: 36, radial: 3 }));
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const t = mix(0.86, 0.38 - k * 0.07, u);
        const f = side * (mix(0.8, 0.74 - k * 0.12, u) - Math.sin(u * Math.PI) * 0.03 * (k + 1));
        pts.push(onHull(t, f, side));
      }
      bk.add(mats.silver, tube(pts, 0.012, 0.005, { seg: 12, radial: 3 }));
    }
  }
  // floorboards, above the water she draws
  const FY = 0.2;
  const fpos = [];
  const fuv = [];
  const NFR = 18;
  for (let i = 0; i <= NFR; i++) {
    const t = mix(-0.74, 0.74, i / NFR);
    const yk = keel(t) + 0.03;
    const ys = sheer(t);
    const c = Math.pow(clamp01((FY - yk) / (ys - yk)), 1 / 1.3);
    const f = (Math.acos(1 - c) * 2) / Math.PI;
    const w = Math.max(0.02, (beam(t) - 0.035) * Math.sin((f * Math.PI) / 2));
    for (let j = 0; j <= 4; j++) {
      const z = mix(-w, w, j / 4);
      fpos.push(t * HL, FY, z);
      fuv.push(t * HL * 0.9, z * 1.6);
    }
  }
  bk.add(mats.boat, geoOf(fpos, gridIdx(NFR, 4), fuv));
  // ribs inside
  for (const t of [-0.62, -0.38, -0.14, 0.1, 0.33, 0.56]) {
    const pts = [];
    for (let j = 0; j <= 8; j++) pts.push(hull(t, mix(-0.9, 0.9, j / 8), 0.04));
    bk.add(mats.boat, tube(pts, 0.017, 0.017, { seg: 10, radial: 3 }));
  }
  // the thwarts; a sitter's origin 0.4 under each top
  const seats = [];
  for (const x of [0.99, -1.14]) {
    const w = beam(x / HL) - 0.05;
    bk.add(mats.boat, roundBox(0.25, 0.036, 2 * w, 0.012), { p: [x, 0.38, 0], uv: 1 });
    seats.push(V3(x - 0.06, 0.0, 0));
  }
  bk.build(g);
  // the paddles, laid in: shaft along their own y, a leaf blade at -y
  const paddle = () => {
    const pg = new THREE.Group();
    pg.name = 'paddle';
    const pk = parts();
    pk.add(mats.boat, cyl(0.019, 0.022, 1.32, 6), { p: [0, 0.18, 0], uv: 2 });
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0);
    leaf.quadraticCurveTo(0.11, -0.12, 0.08, -0.32);
    leaf.quadraticCurveTo(0.03, -0.46, 0, -0.52);
    leaf.quadraticCurveTo(-0.03, -0.46, -0.08, -0.32);
    leaf.quadraticCurveTo(-0.11, -0.12, 0, 0);
    pk.add(mats.boat, new THREE.ExtrudeGeometry(leaf, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 5 }), { p: [0, -0.46, -0.007], uv: 3 });
    pk.add(mats.boat, roundBox(0.13, 0.04, 0.045, 0.015), { p: [0, 0.85, 0] });
    pk.add(mats.silver, cyl(0.026, 0.026, 0.05, 8), { p: [0, -0.46, 0] });
    pk.add(mats.silver, new THREE.ConeGeometry(0.03, 0.14, 4), { p: [0, -0.6, 0.012], s: [1, 1, 0.2], r: [0, 0, Math.PI] });
    pk.build(pg);
    return pg;
  };
  const pa = paddle();
  pa.position.set(0.9, FY + 0.03, 0.2);
  pa.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
  const pb = paddle();
  pb.position.set(-1.0, FY + 0.03, -0.2);
  pb.rotation.set(Math.PI / 2, Math.PI, -Math.PI / 2);
  g.add(pa, pb);
  return { group: g, seats, paddles: [pa, pb], length: 2 * HL, beam: 1.2 };
}
