// The flets that ring the mallorns’ trunks, the stairs that wind up to
// them, the elves’ lanterns, and the small growing things: ferns, fallen
// gold leaves, flowers. Moved out of props.js as they were.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mix, smooth } from '../../../../lib/paint';
import { ball, cyl, lathe, parts, rng, tube } from '../../shire/build';
import { C, geoOf, gridIdx, halo, leafBlade, polar, slab, TAU, V3 } from './helpers';
import { LEAF } from './mallorn';

// ── flets ──

// A slab in plan between radii r0(a) and r1(a), from angle a0 to a1 (a
// whole ring if that is a full turn), its top at y = 0 and `t` thick, its
// boards running round it (u along the arc, v across, in metres × uvK).
// `walls`: inner, outer and ends, each true, false, or [from, to] for part
// of an edge.
export function polarSlab(r0, r1, a0, a1, t, { rows = 2, step = 0.3, walls = {}, uvK = 0.8 } = {}) {
  const full = a1 - a0 >= TAU - 1e-6;
  const span = a1 - a0;
  const cols = Math.max(4, Math.ceil((span * r1((a0 + a1) / 2)) / step));
  const A = (j) => a0 + (span * j) / cols;
  const out = [];
  for (const [y, up] of [[0, true], [-t, false]]) {
    const pos = [];
    const uv = [];
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= cols; j++) {
        const a = A(j);
        const rho = mix(r0(a), r1(a), i / rows);
        pos.push(Math.cos(a) * rho, y, Math.sin(a) * rho);
        uv.push(a * mix(r0(a), r1(a), 0.5) * uvK, rho * uvK);
      }
    }
    out.push(geoOf(pos, gridIdx(rows, cols, !up), uv));
  }
  // an edge at radius rf(a) from angle w0 to w1, facing out or in
  const edge = (rf, w0, w1, outward) => {
    const n = Math.max(2, Math.ceil(((w1 - w0) * rf((w0 + w1) / 2)) / step));
    const pos = [];
    const uv = [];
    for (let i = 0; i <= 1; i++) {
      for (let j = 0; j <= n; j++) {
        const a = mix(w0, w1, j / n);
        const rho = rf(a);
        pos.push(Math.cos(a) * rho, i ? 0 : -t, Math.sin(a) * rho);
        uv.push(a * rho * uvK, (i ? 0 : -t) * uvK);
      }
    }
    out.push(geoOf(pos, gridIdx(1, n, outward), uv));
  };
  const range = (w) => (w === true ? [a0, a1] : w);
  const wi = walls.inner ?? true;
  const wo = walls.outer ?? true;
  if (wi) edge(r0, ...range(wi), false);
  if (wo) edge(r1, ...range(wo), true);
  if (!full && (walls.ends ?? true)) {
    for (const [a, first] of [[a0, true], [a1, false]]) {
      const p = [];
      const uv = [];
      for (const y of [-t, 0]) {
        for (const rho of [r0(a), r1(a)]) {
          p.push(Math.cos(a) * rho, y, Math.sin(a) * rho);
          uv.push(rho * uvK, y * uvK);
        }
      }
      out.push(geoOf(p, first ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2], uv));
    }
  }
  return mergeGeometries(out.map((g) => g.toNonIndexed()));
}

// A balustrade along a line of points ([x, y, z], y its foot): a rounded
// handrail and a foot rail, two rails between that wave up and down out of
// step so they cross at every post and between, and slender posts that
// bow a little, each with a curling leaf on top. `posts` are indices into
// the line (default: its ends).
export function flowingRail(bk, K, line, { h = 1.0, posts = null, waves = 1, rail = 0.042 } = {}) {
  const { mats } = K;
  const seg = Math.max(4, Math.ceil(line.length * 1.4));
  const at = (dy) => line.map(([x, y, z]) => [x, y + dy, z]);
  bk.add(mats.elfwood, tube(at(h), rail, rail, { seg, radial: 5, uvK: 1.2 }));
  bk.add(mats.elfwood, tube(at(0.1), rail * 0.7, rail * 0.7, { seg, radial: 3, uvK: 1.2 }));
  const P = posts ?? [0, line.length - 1];
  // the waving rails, a whole wave between each pair of posts
  for (const s of [-1, 1]) {
    const pts = [];
    for (let p = 0; p < P.length - 1; p++) {
      for (let i = P[p]; i < P[p + 1] + (p === P.length - 2 ? 1 : 0); i++) {
        const f = (i - P[p]) / Math.max(1, P[p + 1] - P[p]);
        const [x, y, z] = line[i];
        pts.push([x, y + h * 0.53 + s * h * 0.3 * Math.sin(f * TAU * waves), z]);
      }
    }
    if (pts.length > 2) bk.add(mats.elfwood, tube(pts, rail * 0.55, rail * 0.55, { seg: Math.max(4, Math.ceil(pts.length * 1.4)), radial: 3, uvK: 1.2 }));
  }
  for (const i of P) {
    const [x, y, z] = line[i];
    const q = line[Math.min(i + 1, line.length - 1)];
    const pp = line[Math.max(i - 1, 0)];
    const ry = -Math.atan2(q[2] - pp[2], q[0] - pp[0]);
    // which way is out: square to the line, in the ground plane
    const ox = Math.sin(ry + Math.PI);
    const oz = Math.cos(ry + Math.PI);
    bk.add(mats.elfwood, tube([[x, y, z], [x + ox * 0.035, y + h * 0.45, z + oz * 0.035], [x, y + h + 0.06, z]], 0.05, 0.034, { seg: 6, radial: 6 }));
    bk.add(mats.silver, leafBlade(0.24, 0.085, { curl: 0.9, seg: 3, thick: 0.008 }), { p: [x, y + h + 0.03, z], r: [0, ry + Math.PI, 0] });
  }
}

// An elven lantern hanging with its orb's middle at (x, y, z): a soft
// blue-white orb held in a cage of silver leaves (a calyx rising round it
// from beneath, a cap of leaves curling down over its shoulder, fine ribs
// between), a stem up to a ring to hang it by, and a drop beneath. `s`
// sizes it (1: the orb 0.24 across, the whole 0.74 tall). Returns where
// its ring hangs from.
export function lanternParts(bk, K, x, y, z, s = 1) {
  const { mats } = K;
  bk.add(mats.lamp, ball(0.12 * s, 12, 9), { p: [x, y, z] });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    const pts = [[0.015, -0.25], [0.08, -0.19], [0.14, -0.07], [0.145, 0.03], [0.12, 0.11], [0.05, 0.165]].map(([rr, hh]) => [x + Math.cos(a) * rr * s, y + hh * s, z + Math.sin(a) * rr * s]);
    bk.add(mats.silver, tube(pts, 0.006 * s, 0.005 * s, { seg: 8, radial: 3 }));
  }
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + TAU / 10;
    bk.add(mats.silver, leafBlade(0.2 * s, 0.075 * s, { curl: -1.2, seg: 3, thick: 0.005 * s }).rotateX(0.95), { p: [x + Math.cos(a) * 0.02 * s, y - 0.24 * s, z + Math.sin(a) * 0.02 * s], r: [0, Math.PI / 2 - a, 0] });
    bk.add(mats.silver, leafBlade(0.15 * s, 0.07 * s, { curl: 1.3, seg: 3, thick: 0.005 * s }).rotateX(Math.PI - 0.9), { p: [x + Math.cos(a) * 0.03 * s, y + 0.17 * s, z + Math.sin(a) * 0.03 * s], r: [0, Math.PI / 2 - a, 0] });
  }
  bk.add(mats.silver, lathe([[0.055, 0.15], [0.05, 0.18], [0.02, 0.215], [0.011, 0.24], [0.009, 0.42], [0.001, 0.425]].map(([rr, hh]) => [rr * s, hh * s]), 8), { p: [x, y, z] });
  bk.add(mats.silver, new THREE.TorusGeometry(0.03 * s, 0.007 * s, 3, 8), { p: [x, y + 0.45 * s, z] });
  bk.add(mats.silver, lathe([[0.001, -0.31], [0.014, -0.28], [0.018, -0.26], [0.009, -0.24], [0.001, -0.235]].map(([rr, hh]) => [rr * s, hh * s]), 6), { p: [x, y, z] });
  return y + 0.48 * s;
}

// A hanging elven lamp on its own, foot at y = 0: `light` is the orb's
// middle, `hook` where it hangs from.
export function lantern(K) {
  const g = new THREE.Group();
  g.name = 'lantern';
  const bk = parts();
  const y = 0.31;
  const top = lanternParts(bk, K, 0, y, 0, 1);
  bk.build(g, { shadow: false });
  halo(K, g, 0, y, 0, 1.3);
  return { group: g, light: V3(0, y, 0), hook: V3(0, top, 0) };
}

// A flet: a ring of white-grey elven woodwork round a trunk `trunkR` thick,
// out to `r`, its floor's top at y = 0. Its edge waves gently, rounded, a
// skirt of hanging leaf-points below it, and curving ribs from lower on the
// trunk hold it up. Near the trunk on its +x side the floor is left open
// for a stair arriving from below (a spiralStair of radius trunkR + 0.6
// arriving at angle 0, coming round from +z): the stairwell runs from
// a = 0 to `hatch`, with a guard rail round it open at a = 0, where you step
// off. A balustrade of flowing rails runs round the edge (with `gate`
// radians open at +x if wanted), and three tall posts curve out over the
// edge, each hung with a lantern.
export function flet(K, { r = 4.5, trunkR = 1.8, hatch = 1.15, gate = 0 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'flet';
  const bk = parts();
  const T = 0.22;
  const well = trunkR + 1.3;
  const edge = (a) => r * (1 + 0.026 * Math.sin(a * 5 + 0.6) + 0.013 * Math.sin(a * 11 + 2.1));
  const inner = () => trunkR + 0.02;
  // the floor: a band round the trunk with the stairwell left open in it,
  // and the ring outside it
  bk.add(mats.elfwood, polarSlab(inner, () => well, hatch, TAU, T, { walls: { outer: false } }));
  bk.add(mats.elfwood, polarSlab(() => well, edge, 0, TAU, T, { rows: 3, walls: { inner: [0, hatch] } }));
  // a rounded lip round the edge, and a collar round the trunk
  const lip = [];
  for (let i = 0; i < 72; i++) lip.push(V3(...polar((i / 72) * TAU, edge((i / 72) * TAU) + 0.01, -0.03)));
  bk.add(mats.elfwood, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip, true), 108, 0.075, 5, true));
  bk.add(mats.elfwood, new THREE.TorusGeometry(trunkR + 0.06, 0.08, 6, 48, TAU - hatch).rotateX(Math.PI / 2).rotateY(-hatch));
  // the skirt: hanging leaf-points under the edge, outside and in
  const nS = Math.round((TAU * r) / 0.95);
  for (const [off, outward] of [[0.015, true], [-0.04, false]]) {
    const M = nS * 8;
    const pos = [];
    const uv = [];
    for (let i = 0; i <= 1; i++) {
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const rho = edge(a) + off;
        const drop = 0.1 + 0.2 * Math.pow(Math.abs(Math.sin((a * nS) / 2)), 0.6);
        const y = i ? -T + 0.02 : -T - drop;
        pos.push(Math.cos(a) * rho, y, Math.sin(a) * rho);
        uv.push(a * rho * 0.8, y * 0.8);
      }
    }
    bk.add(mats.elfwood, geoOf(pos, gridIdx(1, M, outward), uv));
  }
  // ribs beneath, sweeping out from low on the trunk to the edge, like
  // the veins of a leaf; none where the stair comes up beneath the well
  const nRibs = 10;
  for (let i = 0; i < nRibs; i++) {
    const a = (i / nRibs) * TAU + 0.2;
    if (a > -0.15 && a < hatch + 0.45) continue;
    const e = edge(a);
    const pts = [polar(a, trunkR - 0.15, -3.2), polar(a, trunkR + 0.45, -1.55), polar(a, mix(trunkR, e, 0.62), -0.5), polar(a, e - 0.3, -T - 0.02)];
    bk.add(mats.elfwood, tube(pts, 0.17, 0.07, { seg: 10, radial: 5, uvK: 1.2 }));
  }
  // a ring beam under the floor, on the ribs
  const beam = [];
  for (let i = 0; i < 48; i++) beam.push(V3(...polar((i / 48) * TAU, mix(trunkR, r, 0.7), -T - 0.06)));
  bk.add(mats.elfwood, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beam, true), 64, 0.07, 4, true));
  // the balustrade round the edge
  const step = 0.08;
  const a0 = gate > 0 ? gate / 2 : 0;
  const a1 = gate > 0 ? TAU - gate / 2 : TAU;
  const nB = Math.max(3, Math.round(((a1 - a0) * r) / 1.75));
  const per = Math.max(2, Math.round((a1 - a0) / nB / step));
  const line = [];
  for (let i = 0; i <= nB * per; i++) {
    const a = mix(a0, a1, i / (nB * per));
    line.push(polar(a, edge(a) - 0.17, 0));
  }
  const posts = [];
  for (let k = 0; k <= nB; k++) posts.push(k * per);
  if (gate <= 0) {
    // closed: run the rail on past its start so the tubes meet smoothly
    line.push(line[1]);
  }
  flowingRail(bk, K, line, { posts });
  // the rail round the stairwell: along its outer edge, then in to the
  // trunk at its far end; open at a = 0
  const wl = [];
  const wr = well - 0.08;
  for (let a = 0.14; a < hatch - 0.06; a += 0.08) wl.push(polar(a, wr, 0));
  wl.push(polar(hatch - 0.06, wr, 0));
  for (let k = 1; k <= 4; k++) wl.push(polar(hatch - 0.06, mix(wr, trunkR + 0.14, k / 4), 0));
  flowingRail(bk, K, wl, { posts: [0, wl.length - 5, wl.length - 1], h: 0.95 });
  // three tall posts curving out over the edge, a lantern from each
  const lamps = [];
  const spots = [hatch + 1.1, hatch + 2.75, hatch + 4.25].map((a) => (gate > 0 ? Math.max(gate / 2 + 0.3, Math.min(TAU - gate / 2 - 0.3, a)) : a));
  for (const a of spots) {
    const e = edge(a) - 0.17;
    const pts = [polar(a, e, 0), polar(a, e + 0.02, 1.2), polar(a, e - 0.04, 2.3), polar(a, e + 0.3, 2.85), polar(a, e + 0.75, 2.9), polar(a, e + 0.98, 2.72)];
    bk.add(mats.elfwood, tube(pts, 0.06, 0.03, { seg: 18, radial: 6, uvK: 1.2 }));
    bk.add(mats.silver, leafBlade(0.32, 0.1, { curl: -0.8, seg: 3, thick: 0.008 }), { p: polar(a, e + 0.05, 2.35), r: [0, Math.PI / 2 - a, 0] });
    const [lx, , lz] = polar(a, e + 0.98, 0);
    const ly = 2.72 - 0.06 - 0.48;
    bk.add(mats.silver, cyl(0.006, 0.006, 0.06, 4), { p: [lx, 2.72 - 0.03, lz] });
    lanternParts(bk, K, lx, ly, lz, 1);
    halo(K, g, lx, ly, lz, 1.4);
    lamps.push(V3(lx, ly, lz));
  }
  bk.build(g);
  return { group: g, lamps, radius: r, landing: V3(trunkR + 0.6, 0, 0), well: { r0: trunkR, r1: well, a0: 0, a1: hatch }, edge };
}

// ── stairs ──

// A stair winding up round a trunk of radius r − 0.6: treads 1.2 m wide
// (r − 0.6 to r + 0.6, set a little into the trunk) hung from it on curving
// brackets, an outer string beneath their ends, and a thin handrail on the
// outside on slender balusters, curling at its foot. It starts at angle
// `start` on the ground (the point (cos a·r, 0, sin a·r)) and climbs `rise`
// in `turns` turns anticlockwise seen from above (as a turn about +y: the
// angle falls as it climbs), so it arrives at angle start − turns·2π.
// at(k), k from 0 to 1, is the treads' centre line, for a walker. Unless
// `lamps` is false, lanterns hang out from the handrail, three to a turn.
export function spiralStair(K, { r = 2.4, rise = 18, turns = 1.25, start = 0, lamps = true } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'spiralStair';
  const bk = parts();
  const span = turns * TAU;
  const angle = (k) => start - k * span;
  const at = (k, out = V3()) => out.set(Math.cos(angle(k)) * r, k * rise, Math.sin(angle(k)) * r);
  const steps = Math.max(4, Math.round(rise / 0.2));
  const da = (span / steps) * 0.58;
  const r0 = r - 0.75;
  const r1 = r + 0.6;
  for (let i = 1; i < steps; i++) {
    const k = i / steps;
    const a = angle(k);
    const y = k * rise;
    // a tread: a slice of a ring, its outer end rounded
    const s = new THREE.Shape();
    const n = 3;
    for (let j = 0; j <= n; j++) {
      const b = a - da + (2 * da * j) / n;
      if (j) s.lineTo(Math.cos(b) * r0, Math.sin(b) * r0);
      else s.moveTo(Math.cos(b) * r0, Math.sin(b) * r0);
    }
    const ro = r1 - 0.06;
    s.lineTo(Math.cos(a + da) * ro, Math.sin(a + da) * ro);
    s.quadraticCurveTo(Math.cos(a + da * 0.5) * (r1 + 0.05), Math.sin(a + da * 0.5) * (r1 + 0.05), Math.cos(a) * (r1 + 0.04), Math.sin(a) * (r1 + 0.04));
    s.quadraticCurveTo(Math.cos(a - da * 0.5) * (r1 + 0.05), Math.sin(a - da * 0.5) * (r1 + 0.05), Math.cos(a - da) * ro, Math.sin(a - da) * ro);
    bk.add(mats.elfwood, slab(s, 0.075).translate(0, y, 0), { uv: 0.9 });
    // a bracket under every third, from the trunk below out to the string
    if (i % 3 === 0) bk.add(mats.elfwood, tube([polar(a, r0 + 0.05, y - 1.1), polar(a, r - 0.3, y - 0.45), polar(a, r1 - 0.12, y - 0.16)], 0.07, 0.04, { seg: 6, radial: 5, uvK: 1.2 }));
  }
  // the outer string, the handrail and a mid rail, each a helix
  const helix = (rho, dy, k0 = 0, k1 = 1) => {
    const n = Math.max(8, Math.ceil(turns * 40));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const k = mix(k0, k1, i / n);
      pts.push(polar(angle(k), rho, k * rise + dy));
    }
    return pts;
  };
  const kIn = 0.6 / steps;
  bk.add(mats.elfwood, tube(helix(r1 - 0.1, -0.16, kIn, 1), 0.075, 0.075, { seg: Math.ceil(turns * 64), radial: 5, uvK: 1.2 }));
  const hr = r1 - 0.06;
  // the handrail, curling into a scroll at its foot
  const foot = [];
  const a0 = angle(kIn * 2);
  const y0 = kIn * 2 * rise + 0.95;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const b = a0 + (1 - t) * 0.8;
    const rr = hr + (1 - t) * 0.3 * Math.cos(t * 4.5);
    foot.push(polar(b, rr, mix(0.7, y0, smooth(0, 1, t))));
  }
  const rail = [...foot.slice(0, -1), ...helix(hr, 0.95, kIn * 2, 1)];
  bk.add(mats.elfwood, tube(rail, 0.042, 0.042, { seg: Math.ceil(turns * 80), radial: 5, uvK: 1.2 }));
  bk.add(mats.elfwood, tube(helix(hr, 0.45, kIn * 2, 1), 0.026, 0.026, { seg: Math.ceil(turns * 56), radial: 3, uvK: 1.2 }));
  // balusters on every other tread, bowing out a little
  for (let i = 2; i < steps; i += 2) {
    const k = i / steps;
    const a = angle(k);
    const y = k * rise;
    bk.add(mats.elfwood, tube([polar(a, hr, y - 0.02), polar(a, hr + 0.04, y + 0.45), polar(a, hr, y + 0.95)], 0.024, 0.02, { seg: 4, radial: 3, uvK: 1.2 }));
  }
  // lanterns hung out from the handrail, three to a turn
  const lights = [];
  if (lamps) {
    const nL = Math.max(1, Math.round(turns * 3));
    for (let i = 0; i < nL; i++) {
      const k = (i + 0.6) / (nL + 0.4);
      const a = angle(k);
      const y = k * rise + 0.95;
      bk.add(mats.elfwood, tube([polar(a, hr, y - 0.02), polar(a, hr + 0.2, y + 0.35), polar(a, hr + 0.5, y + 0.42), polar(a, hr + 0.62, y + 0.32)], 0.022, 0.014, { seg: 10, radial: 4, uvK: 1.2 }));
      const [lx, , lz] = polar(a, hr + 0.62, 0);
      const ly = y + 0.32 - 0.48 * 0.8;
      lanternParts(bk, K, lx, ly, lz, 0.8);
      halo(K, g, lx, ly, lz, 1.1);
      lights.push(V3(lx, ly, lz));
    }
  }
  bk.build(g);
  return { group: g, at, steps, start, end: angle(1), top: at(1), radius: r, lamps: lights };
}

// ── small growing things ──

// A fern for instancing, about a metre across: a dozen fronds arching up
// and out from the middle and drooping at their tips, each a stalk with
// leaflets either side that shorten towards its tip, pale green, dark at
// the heart, a few touched with gold. Each leaflet is wound both ways with
// its normal up, so it lights like the ground from either side on a
// single-sided material (double-sided, a leaflet seen from behind lit black).
export function fernGeo(seed = 1) {
  const r = rng(seed * 23 + 5);
  const pos = [];
  const col = [];
  const nor = [];
  const heart = C(0x34502a);
  const mid = C(0x7ea456);
  const tipC = C(0xc8e098);
  const gold = C(0xd8cc78);
  const c = new THREE.Color();
  const fronds = 16 + Math.floor(r() * 6);
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * TAU + r() * 0.4;
    const L = 0.45 + r() * 0.5;
    const up = 0.95 + r() * 0.4;
    const droop = 0.6 + r() * 0.3;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const goldish = r() < 0.22;
    const at = (s) => [dx * s * L * 0.92, L * (1.15 * s * Math.sin(up) - droop * s * s), dz * s * L * 0.92];
    const SEG = 16;
    for (let i = 0; i < SEG; i++) {
      const s0 = i / SEG;
      const s1 = (i + 1) / SEG;
      const p0 = at(s0);
      const p1 = at(s1);
      const len = L * 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, s0 * 0.85 + 0.15)), 0.7);
      c.copy(heart).lerp(mid, smooth(0, 0.4, s0)).lerp(goldish ? gold : tipC, smooth(0.45, 1, s0) * 0.8);
      for (const side of [-1, 1]) {
        const mx = (p0[0] + p1[0]) / 2;
        const my = (p0[1] + p1[1]) / 2;
        const mz = (p0[2] + p1[2]) / 2;
        const tip = [mx - dz * side * len + dx * len * 0.35, my - len * 0.3, mz + dx * side * len + dz * len * 0.35];
        for (const face of [[p0, p1, tip], [p0, tip, p1]]) {
          for (const v of face) {
            pos.push(...v);
            const k = v === tip ? 1.15 : 1;
            col.push(c.r * k, c.g * k, c.b * k);
            nor.push(dx * 0.25, 0.95, dz * 0.25);
          }
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// A scatter of fallen mallorn leaves for instancing on the ground: a
// hundred or so within about 2.5 m, thicker towards the middle, each a
// long pointed leaf folded along its midrib, in golds, a few silver-grey
// and a few gone brown.
export function goldLeavesGeo(seed = 1) {
  const r = rng(seed * 17 + 9);
  const pos = [];
  const col = [];
  const hues = [LEAF.gold, LEAF.gold, LEAF.deep, LEAF.deep, LEAF.inner, C(0xd8a840), C(0xe6c870), C(0xb88a30), C(0xd4d0b8)];
  const c = new THREE.Color();
  const count = 230 + Math.floor(r() * 40);
  for (let k = 0; k < count; k++) {
    const a = r() * TAU;
    const d = Math.pow(r(), 0.6) * 2.5;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const y = 0.006 + r() * 0.025;
    const len = 0.12 + r() * 0.09;
    const wid = len * (0.28 + r() * 0.1);
    const turn = r() * TAU;
    const fold = 0.006 + r() * 0.01;
    const tilt = (r() - 0.5) * 0.3;
    c.copy(hues[Math.floor(r() * hues.length)]).multiplyScalar(0.62 + r() * 0.3);
    const P = (u, v, lift) => {
      const lx = u * len;
      const lz = v * wid;
      return [x + Math.cos(turn) * lx - Math.sin(turn) * lz, y + lift + lx * tilt, z + Math.sin(turn) * lx + Math.cos(turn) * lz];
    };
    const base = P(-0.5, 0, 0);
    const tip = P(0.5, 0, 0.004);
    const l = P(-0.08, -0.5, 0);
    const rr = P(-0.08, 0.5, 0);
    const midP = P(0, 0, fold);
    for (const tri of [[base, midP, l], [midP, tip, l], [base, rr, midP], [midP, rr, tip]]) {
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

// Little star-flowers among the ferns, elanor gold and niphredil white:
// each a five-pointed star on a thin stalk, at the points given ([x, y, z],
// y the ground), all in one geometry.
export function flowersGeo(points, seed = 1) {
  const r = rng(seed * 3 + 1);
  const pos = [];
  const col = [];
  const nor = [];
  const gold = C(0xffd24a);
  const white = C(0xf4f6ff);
  const stalk = C(0x4a6a2a);
  for (const [x, y, z] of points) {
    const h = 0.1 + r() * 0.12;
    const rad = 0.035 + r() * 0.02;
    const c = r() < 0.55 ? gold : white;
    const tilt = (r() - 0.5) * 0.5;
    const turn = r() * TAU;
    const top = y + h;
    // the stalk, a thin blade
    pos.push(x - 0.005, y, z, x + 0.005, y, z, x, top, z);
    for (let k = 0; k < 3; k++) {
      col.push(stalk.r, stalk.g, stalk.b);
      nor.push(0, 0, 1);
    }
    for (let k = 0; k < 5; k++) {
      const a0 = turn + (k / 5) * TAU;
      const a1 = a0 + TAU / 10;
      const a2 = a0 - TAU / 10;
      const P = (a, rr) => [x + Math.cos(a) * rr, top + Math.cos(a) * rr * tilt, z + Math.sin(a) * rr];
      for (const v of [[x, top + 0.004, z], P(a2, rad * 0.4), P(a0, rad), [x, top + 0.004, z], P(a0, rad), P(a1, rad * 0.4)]) {
        pos.push(...v);
        col.push(c.r, c.g, c.b);
        nor.push(0, 1, 0);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
