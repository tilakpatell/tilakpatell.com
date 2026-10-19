// A grey boat of the Galadhrim with a swan’s neck at its prow. Moved out
// of props.js as it was.

import * as THREE from 'three';
import { clamp01, mix } from '../../../../lib/paint';
import { ball, cyl, parts, roundBox, tube } from '../../shire/build';
import { geoOf, gridIdx, leafBlade, V3 } from './helpers';

// ── the boat ──

// An elven boat, 6 m long and 1.2 m in the beam, grey-white and slender as
// a leaf: its hull sweeps up at either end, the prow rising into a swan's
// neck and head, the stern into an upswept tip; silver inlaid under the
// gunwale and in a folded wing on either bow, small decks at either end,
// ribs and floorboards inside (the boards above the water she draws), and
// two thwarts, each with a leaf-bladed paddle laid on the boards by it. Faces +x,
// its keel at y = 0; it floats with about 0.16 m under the water. Its
// seats are where a sitter's seat goes (bow first); the paddles are groups
// (shaft along their own y, blade at −y, the origin mid-shaft) to take up.
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
  const NT = 44;
  const NF = 16;
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
  bk.add(mats.boat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gun, true), 180, 0.03, 6, true));
  // small decks over either end
  for (const [t0, t1] of [[0.74, 0.995], [-0.995, -0.78]]) {
    const pos = [];
    const uv = [];
    const NR = 12;
    const NC = 6;
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
  bk.add(mats.boat, tube(neck, 0.085, 0.045, { seg: 28, radial: 8, uvK: 1 }));
  bk.add(mats.boat, ball(0.07, 12, 8), { p: [3.18, 2.12, 0], s: [1.45, 0.9, 0.85] });
  bk.add(mats.silver, new THREE.ConeGeometry(0.028, 0.15, 6), { p: [3.32, 2.08, 0], r: [0, 0, -Math.PI / 2 - 0.35] });
  for (const s of [-1, 1]) bk.add(mats.silver, ball(0.011, 6, 4), { p: [3.2, 2.14, s * 0.052] });
  bk.add(mats.boat, tube([[-2.98, 0.76, 0], [-3.13, 0.9, 0], [-3.23, 1.06, 0], [-3.27, 1.2, 0], [-3.23, 1.3, 0]], 0.06, 0.016, { seg: 12, radial: 6, uvK: 1 }));
  // silver inlaid along her: a line under the gunwale, and on either bow
  // a folded wing, its feathers fanning back from the shoulder
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
    bk.add(mats.silver, tube(line, 0.009, 0.009, { seg: 40, radial: 3 }));
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const t = mix(0.86, 0.38 - k * 0.07, u);
        const f = side * (mix(0.8, 0.74 - k * 0.12, u) - Math.sin(u * Math.PI) * 0.03 * (k + 1));
        pts.push(onHull(t, f, side));
      }
      bk.add(mats.silver, tube(pts, 0.012, 0.005, { seg: 14, radial: 3 }));
    }
  }
  // floorboards, above the water she draws
  const FY = 0.2;
  const fpos = [];
  const fuv = [];
  const NFR = 20;
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
    bk.add(mats.boat, tube(pts, 0.017, 0.017, { seg: 12, radial: 3 }));
  }
  // the thwarts
  const seatX = [0.99, -1.14];
  const seats = [];
  for (const x of seatX) {
    const w = beam(x / HL) - 0.05;
    bk.add(mats.boat, roundBox(0.25, 0.036, 2 * w, 0.012), { p: [x, 0.38, 0], uv: 1 });
    seats.push(V3(x, 0.4, 0));
  }
  bk.build(g);
  // the paddles, laid in: shaft along their own y, blade at -y
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
    pk.add(mats.silver, leafBlade(0.14, 0.05, { curl: 0, seg: 2, thick: 0.004 }), { p: [0, -0.62, 0.012], r: [0, 0, Math.PI] });
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
  return { group: g, seats, paddles: [pa, pb], length: 2 * HL, beam: 1.2, waterline: 0.16 };
}
