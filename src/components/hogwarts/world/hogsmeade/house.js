// One of Hogsmeade’s houses, built (./plan.js says the numbers): a stone
// ground floor on its plinth with the shop’s bay windows full of goods,
// the door in its painted surround and its step, the fascia lettered with
// the shop’s name; a jettied upper floor of plaster in an oak frame, posts
// and braces and casements of leaded glass; a steep slate roof with barge
// boards at its gables, dormers, a cross gable to the street on the big
// ones, and stone chimneys with their pots; the sign hung off an iron
// bracket over the pavement. Everything above the ground floor bent by the
// house’s lean: leant over, the ridge sagging and tipped. The Shack is the
// same house left to rot: all weathered boards, its windows boarded up.
// Into the village’s buckets (./buckets.js), in the house’s own frame
// (x along the front, z out of it, y up from its ground).
//
//   buildHouse(bk, M, site, plan) → { smoke: [[x, y, z]] the chimney tops in the set, sign }
//     M: ./materials.js’s mats; site: ./layout.js’s

import * as THREE from 'three';
import { metricUv } from './buckets';
import { cellOf, fasciaRow } from './lettering';

const _v = new THREE.Vector3();

// a quad facing +z, w × h, its uvs a rectangle of an atlas
function quad(w, h, [u0, v0, u1, v1]) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
  return g;
}

// a flat quad lying on the ground (a pool of light), uvs 0…1
const pool = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);

// a roof slab: its top through the ridge line, `L` metres down the slope at
// pitch `a`, `len` along the ridge; ry turns which way it falls (0: toward +z)
function slab(F, mat, { len, L, a, at, ry = 0, t = 0.16, tint = null }) {
  const g = new THREE.BoxGeometry(len, t, L);
  g.translate(0, -t / 2, L / 2);
  metricUv(g, { scale: 2 });
  g.rotateX(a);
  F.add(mat, g, { at, ry, tint });
}

// a triangle of wall in the zy plane (a gable end), thickness along x
function gableGeo(z0, z1, y0, apexZ, apexY, t = 0.2) {
  const s = new THREE.Shape();
  s.moveTo(z0, y0);
  s.lineTo(z1, y0);
  s.lineTo(apexZ, apexY);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  // (the shape in x-y made to stand in z-y: its x is the house’s z)
  g.rotateY(-Math.PI / 2);
  metricUv(g, { scale: 2 });
  return g;
}

// a beam between two points (y up), square in section
function beam(F, mat, a, b, s = 0.16, tint = null) {
  const d = _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const g = new THREE.BoxGeometry(s, len, s * 0.8);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  g.applyQuaternion(q);
  F.add(mat, g, { at: a, tint });
}

// a casement: its oak frame, the leaded glass (lit or not) and a sill
function casement(F, M, { x, y, w, h, z, lit, tint, boarded = false }) {
  F.box(M.timber, x, y - 0.08, z, w + 0.18, 0.08, 0.14);
  F.box(M.timber, x, y + h, z, w + 0.18, 0.09, 0.14);
  for (const s of [-1, 1]) F.box(M.timber, x + (s * (w + 0.09)) / 2, y, z, 0.09, h, 0.14);
  F.box(M.timber, x, y, z, 0.05, h, 0.1);
  F.box(M.paint, x, y - 0.14, z + 0.05, w + 0.3, 0.06, 0.24, { tint });
  if (!boarded) {
    F.add(lit ? M.glassLit : M.glassDark, quad(w, h, [0, 0, 1, 1]), { at: [x, y + h / 2, z + 0.02] });
    return;
  }
  // (boarded: planks nailed across, not quite level, one gone, and a brace over them)
  const n = Math.max(3, Math.round(h / 0.24));
  for (let i = 0; i < n; i++) if (i !== 2) F.box(M.shackwood, x + Math.sin(i * 2.1) * 0.05, y + (h * i) / n, z + 0.07, w + 0.3, h / n - 0.03, 0.04, { rz: Math.sin(i * 1.7 + x) * 0.06, tint: i % 2 ? '#6a6254' : '#7e7464' });
  F.box(M.shackwood, x, y + h * 0.1, z + 0.11, 0.14, Math.hypot(w, h) * 0.95, 0.04, { rz: Math.atan2(w, h), tint: '#5c5448' });
}

// what the years have done to the Shack: a porch falling in over the door,
// a lean-to down one end, shutters hanging off, slates gone from the roof
function ruin(F, U, M, p) {
  const { w, d } = p;
  const front = d / 2;
  // the porch: two posts (one leaning), a roof of boards sagging off them
  for (const s of [-1, 1]) F.box(M.shackwood, s * 1.4, 0, front + 1.6, 0.16, 2.7, 0.16, { rz: s > 0 ? 0.12 : 0, tint: '#6a6254' });
  F.box(M.shackwood, 0, 2.62, front + 0.9, 3.4, 0.1, 1.7, { rx: 0.22, rz: 0.06, tint: '#5e564a' });
  F.box(M.shackwood, 0, 0.1, front + 0.9, 3.0, 0.12, 1.6, { rz: -0.03, tint: '#5a5246' });
  // the lean-to down the far end, its roof one slope
  const lx = w / 2 + 1.6;
  F.box(M.shackwood, lx, 0, -0.4, 3.2, 2.6, d * 0.7, { tint: '#6e6658' });
  const lt = new THREE.BoxGeometry(3.8, 0.12, d * 0.8);
  lt.rotateZ(-0.38);
  F.add(M.slate, metricUv(lt, { scale: 2 }), { at: [lx, 3.1, -0.4] });
  // shutters hanging off their hinges either side of two casements
  for (const c of p.casements.slice(0, 2)) U.box(M.shackwood, c.x - c.w / 2 - 0.35, c.y - 0.3, front + p.overhang + 0.12, 0.5, c.h + 0.2, 0.05, { rz: 0.35, tint: '#4e5a4a' });
  // the holes in the roof where slates have gone: the dark under them
  for (const [x, k] of [[-w * 0.22, 0.35], [w * 0.18, 0.6], [w * 0.3, 0.25]]) {
    const zc = p.overhang / 2;
    const run = (d + p.overhang) / 2 + 0.1;
    const a = Math.atan2(p.ridge - p.eaves - 0.12, run);
    const z = zc + run * k;
    U.box(M.iron, x, p.ridge - Math.tan(a) * run * k - 0.02, z, 1.1, 0.06, 0.9, { rx: a });
  }
}

export function buildHouse(bk, M, site, p) {
  const { w, d } = p;
  const base = new THREE.Matrix4().compose(new THREE.Vector3(site.at[0], site.ground ?? 0, site.at[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), site.yaw), new THREE.Vector3(1, 1, 1));
  const F = bk.frame(base);
  const tone = p.tone;
  const wood = p.shack ? M.shackwood : null;
  const walls = wood ?? M.stone;
  const front = d / 2;
  const jet = front + p.overhang; // the upper floor’s face
  // (everything above the ground floor is bent: leant over, the ridge sagging and tipped)
  const bend = (g) => {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      if (y <= p.ground + 0.01) continue;
      const up = y - p.ground;
      const roof = Math.min(1.2, Math.max(0, (y - p.eaves + 0.3) / (p.ridge - p.eaves)));
      const q = Math.min(1, Math.abs(x) / (w / 2 + 0.5));
      pos.setX(i, x + up * p.shear * 0.18);
      pos.setY(i, y - p.sag * (1 - q * q) * roof + x * p.tilt * 0.1 * roof);
    }
    pos.needsUpdate = true;
  };
  const U = bk.frame(base, { deform: bend });

  // ── the ground floor ──
  F.box(walls, 0, -0.3, 0, w + 0.24, 0.62, d + 0.24, { tint: tone.stone });
  F.box(walls, 0, 0, 0, w, p.ground, d, { tint: tone.stone });
  // the corners dressed in bigger stones, a band under the jetty
  if (!p.shack) {
    const quoin = new THREE.Color(tone.stone).lerp(new THREE.Color('#c8c0b0'), 0.25);
    for (const sx of [-1, 1]) for (let y = 0.3, k = 0; y < p.ground - 0.3; y += 0.62, k++) F.box(M.stone, sx * (w / 2 - (k % 2 ? 0.16 : 0.22)), y, front - 0.2, k % 2 ? 0.36 : 0.48, 0.3, 0.44, { tint: quoin });
  }
  // the door: its surround, the leaf (two on a pub), panels, ring, step and a fanlight
  const D = p.door;
  F.box(M.paint, 0, 0, front, D.w + 0.42, D.h + 0.36, 0.1, { tint: tone.paint });
  const leafTint = new THREE.Color(tone.paint).multiplyScalar(0.7);
  const leaves = D.double ? [-1, 1] : [0];
  for (const s of leaves) {
    const lw = D.double ? D.w / 2 - 0.03 : D.w;
    const lx = D.double ? (s * D.w) / 4 : 0;
    F.box(p.shack ? M.shackwood : M.paint, lx, 0, front + 0.06, lw, D.h - 0.42, 0.06, { tint: leafTint });
    for (const py of [0.35, 1.05]) F.box(M.paint, lx, py, front + 0.1, lw * 0.7, 0.55, 0.03, { tint: tone.paint });
    F.cyl(M.iron, lx + (s || 1) * lw * 0.3, 1.0, front + 0.12, 0.05, 0.05, 0.02, { seg: 8, rx: Math.PI / 2 });
  }
  // (a fanlight over the door, lit from the shop; the Shack’s is boarded)
  if (!p.shack) {
    const c = cellOf(site.id);
    F.add(M.goods, quad(D.w, 0.32, [c.u0 + 0.05, c.v1 - 0.2, c.u1 - 0.05, c.v1 - 0.1]), { at: [0, D.h - 0.22, front + 0.07] });
  }
  F.box(M.stone, 0, -0.02, front + 0.32, D.w + 0.5, 0.18, 0.5, { tint: '#9a9284' });
  if (p.shack) for (const s of [-1, 1]) F.box(M.shackwood, 0, D.h * 0.5, front + 0.14, D.w + 0.5, 0.18, 0.05, { rz: s * 0.55 });

  // the shop’s bays: a stone riser, the painted frame, the glass full of goods, mullions, a little roof
  const cell = cellOf(site.id);
  const bayH = Math.min(2.0, p.ground - 1.3);
  const sill = 0.6;
  for (const b of p.bays) {
    const out = 0.48;
    const z1 = front + out;
    F.box(M.stone, b.x, 0, front + out / 2, b.w + 0.1, sill, out, { tint: tone.stone });
    F.box(M.paint, b.x, sill, front + out / 2, b.w + 0.16, 0.1, out + 0.08, { tint: tone.paint });
    F.box(M.paint, b.x, sill + bayH, front + out / 2, b.w + 0.24, 0.2, out + 0.16, { tint: tone.paint });
    for (const s of [-1, 1]) F.box(M.paint, b.x + (s * b.w) / 2, sill, z1, 0.1, bayH, 0.1, { tint: tone.paint });
    const gw = b.w - 0.1;
    const span = (b.x + b.w / 2) / w + 0.5;
    const u0 = cell.u0 + (cell.u1 - cell.u0) * Math.max(0, span - b.w / w);
    const u1 = cell.u0 + (cell.u1 - cell.u0) * Math.min(1, span);
    F.add(M.goods, quad(gw, bayH, [u0, cell.v0, u1, cell.v1]), { at: [b.x, sill + bayH / 2 + 0.05, z1 - 0.02] });
    for (const s of [-1, 1]) F.add(M.goods, quad(out, bayH, [cell.u0, cell.v0, cell.u0 + 0.05, cell.v1]), { at: [b.x + (s * b.w) / 2, sill + bayH / 2 + 0.05, front + out / 2], ry: s * (Math.PI / 2) });
    // (the glazing bars: uprights every half metre or so, and a transom)
    const n = Math.max(2, Math.round(gw / 0.55));
    for (let i = 1; i < n; i++) F.box(M.paint, b.x - gw / 2 + (gw * i) / n, sill + 0.05, z1, 0.05, bayH, 0.05, { tint: tone.paint });
    F.box(M.paint, b.x, sill + bayH * 0.74, z1, gw, 0.05, 0.05, { tint: tone.paint });
    slab(F, M.slate, { len: b.w + 0.3, L: (out + 0.25) / Math.cos(0.5), a: 0.5, at: [b.x, sill + bayH + 0.38, front] });
    // the window’s light thrown out across the pavement at night
    F.add(M.pool, pool(b.w + 2.2, 3.2), { at: [b.x, 0.14, front + 1.5] });
  }
  if (!p.shack) F.add(M.pool, pool(D.w + 1.4, 2.2), { at: [0, 0.15, front + 1.0] });
  for (const s of p.small) casement(F, M, { x: s.x, y: 1.0, w: 0.9, h: 1.2, z: front, lit: true, tint: tone.paint });
  // the fascia over the shop front, lettered, and its cornice
  if (!p.shack) {
    const fr = fasciaRow(site.id);
    const fw = w - 0.5;
    F.box(M.paint, 0, p.ground - 0.72, front + 0.02, fw + 0.16, 0.56, 0.12, { tint: tone.paint });
    F.add(M.fascia, quad(fw, 0.44, [0, fr.v0, 1, fr.v1]), { at: [0, p.ground - 0.44, front + 0.09] });
    F.box(M.paint, 0, p.ground - 0.16, front + 0.06, fw + 0.36, 0.1, 0.24, { tint: tone.paint });
  }

  // ── the upper floor: plaster in an oak frame, jettied out over the street ──
  const upper = p.shack ? M.shackwood : M.plaster;
  const depth = d + p.overhang;
  const zc = p.overhang / 2;
  U.box(upper, 0, p.ground, zc, w, p.upper, depth, { tint: p.shack ? '#7a6e5e' : tone.plaster });
  // the jetty’s joist ends and the sill beam
  if (!p.shack) for (let x = -w / 2 + 0.25; x < w / 2; x += 0.55) U.box(M.timber, x, p.ground - 0.2, front + p.overhang / 2 - 0.05, 0.14, 0.2, p.overhang + 0.1);
  U.box(M.timber, 0, p.ground - 0.02, jet + 0.03, w + 0.1, 0.22, 0.12);
  U.box(M.timber, 0, p.eaves - 0.24, jet + 0.03, w + 0.1, 0.22, 0.12);
  // the posts, flanking each casement, and braces in the panels between
  const posts = new Set([-w / 2 + 0.08, w / 2 - 0.08]);
  for (const c of p.casements) {
    posts.add(c.x - c.w / 2 - 0.2);
    posts.add(c.x + c.w / 2 + 0.2);
  }
  const xs = [...posts].sort((a, b) => a - b);
  const top = p.eaves - 0.24;
  for (const x of xs) U.box(M.timber, x, p.ground + 0.2, jet + 0.03, 0.16, top - p.ground - 0.2, 0.1);
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    const inWindow = p.casements.some((c) => c.x > a && c.x < b);
    if (inWindow || b - a < 0.6) continue;
    const up = (i % 2 ? 1 : -1) > 0;
    beam(U, M.timber, [up ? a : b, p.ground + 0.2, jet + 0.03], [up ? b : a, top, jet + 0.03], 0.13);
  }
  // (a rail under the casements, between the posts)
  U.box(M.timber, 0, p.ground + 0.62, jet + 0.03, w, 0.12, 0.08);
  for (const c of p.casements) casement(U, M, { x: c.x, y: c.y, w: c.w, h: c.h, z: jet + 0.04, lit: c.lit, tint: tone.paint, boarded: p.shack });
  // the end walls’ framing and a window in each, and corner posts at the back
  for (const sd of p.sides) {
    const x = sd.side * (w / 2 + 0.04);
    U.add(M.timber, new THREE.BoxGeometry(0.1, top - p.ground, 0.16).translate(0, (top - p.ground) / 2, 0), { at: [x, p.ground, zc] });
    U.add(sd.lit ? M.glassLit : M.glassDark, quad(0.8, 1.0, [0, 0, 1, 1]), { at: [x + sd.side * 0.02, sd.y + 0.5, zc - depth * 0.2], ry: (sd.side * Math.PI) / 2 });
    U.add(M.timber, new THREE.BoxGeometry(0.08, 1.15, 0.95).translate(0, 0.5, 0), { at: [x, sd.y - 0.05, zc - depth * 0.2] });
    beam(U, M.timber, [x, p.ground + 0.2, -d / 2 + 0.1], [x, top, zc - depth * 0.2 - 0.6], 0.13);
  }
  for (const sx of [-1, 1]) U.box(M.timber, sx * (w / 2 - 0.08), p.ground, -d / 2 - 0.03, 0.16, top - p.ground, 0.1);

  // ── the roof ──
  const ridge = p.ridge;
  const len = w + 0.7;
  // (through the ridge over the middle of the upper floor, and just over the walls’ tops)
  const run = depth / 2 + 0.1;
  const a = Math.atan2(ridge - p.eaves - 0.12, run);
  const L = (run + 0.55) / Math.cos(a);
  slab(U, M.slate, { len, L, a, at: [0, ridge, zc], ry: 0 });
  slab(U, M.slate, { len, L, a, at: [0, ridge, zc], ry: Math.PI });
  // the ridge tiles, the barge boards at the gables, the gable ends
  U.box(M.slate, 0, ridge - 0.05, zc, len + 0.04, 0.16, 0.3, { tint: '#8a8a8a' });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.07, 0.3, L);
      g.translate(0, -0.12, L / 2);
      g.rotateX(a);
      U.add(M.timber, g, { at: [(sx * len) / 2, ridge + 0.02, zc], ry: sz > 0 ? 0 : Math.PI });
    }
    const gy = p.eaves - 0.02;
    const gz = run - 0.02;
    U.add(upper, gableGeo(zc - gz, zc + gz, gy, zc, ridge - 0.12, 0.18), { at: [(sx * (w - 0.18)) / 2, 0, 0], tint: p.shack ? '#7a6e5e' : tone.plaster });
    // (the gable’s king post and collar, proud of the plaster)
    const ex = sx * (w / 2 + 0.02);
    U.box(M.timber, ex, gy, zc, 0.1, ridge - gy - 0.3, 0.16);
    U.box(M.timber, ex, gy + (ridge - gy) * 0.45, zc, 0.1, 0.14, run * 1.0);
  }
  // a cross gable to the street over the middle of the front, with its own big window
  if (p.gable) {
    const gw = p.gable.w;
    const gr = p.eaves + (gw / 2 + 0.3) * Math.tan(a);
    const zf = jet;
    const zb = zc - 0.5;
    const glen = zf - zb + 0.5;
    const gl = (gw / 2 + 0.45) / Math.cos(a);
    for (const s of [-1, 1]) slab(U, M.slate, { len: glen, L: gl, a, at: [0, gr, zb + glen / 2], ry: (s * Math.PI) / 2 });
    U.box(M.slate, 0, gr - 0.05, zb + glen / 2, 0.3, 0.16, glen + 0.04, { tint: '#8a8a8a' });
    // its gable wall, plaster in a frame, a window of three lights
    const s = new THREE.Shape();
    s.moveTo(-gw / 2, 0);
    s.lineTo(gw / 2, 0);
    s.lineTo(0, gr - p.eaves - 0.1);
    s.closePath();
    const tri = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false });
    metricUv(tri, { scale: 2 });
    U.add(M.plaster, tri, { at: [0, p.eaves - 0.02, zf - 0.18], tint: tone.plaster });
    for (const sx of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.07, 0.3, gl);
      g.translate(0, -0.12, gl / 2);
      g.rotateX(a);
      U.add(M.timber, g, { at: [0, gr + 0.02, zf + 0.12], ry: (sx * Math.PI) / 2 });
    }
    casement(U, M, { x: 0, y: p.eaves + 0.2, w: Math.min(1.8, gw * 0.35), h: Math.min(1.3, (gr - p.eaves) * 0.45), z: zf + 0.04, lit: true, tint: tone.paint });
  }
  // dormers on the front slope: a box with a window and a little gable roof
  for (const dm of p.dormers) {
    const zf = zc + run * 0.55;
    const yb = ridge - Math.tan(a) * (zf - zc);
    const dh = 1.25;
    U.box(upper, dm.x, yb - 0.3, zf - 0.9, dm.w, dh + 0.3, 1.8, { tint: p.shack ? '#7a6e5e' : tone.plaster });
    casement(U, M, { x: dm.x, y: yb + 0.12, w: dm.w * 0.55, h: dh * 0.6, z: zf, lit: true, tint: tone.paint });
    const dl = (dm.w / 2 + 0.2) / Math.cos(0.75);
    for (const s of [-1, 1]) slab(U, M.slate, { len: 2.2, L: dl, a: 0.75, at: [dm.x, yb + dh + Math.tan(0.75) * (dm.w / 2 + 0.2) - 0.1, zf - 0.9], ry: (s * Math.PI) / 2, t: 0.12 });
  }
  // the chimneys: stone stacks up through the roof, a cap, two pots
  const smoke = [];
  for (const c of p.chimneys) {
    const y0 = p.eaves - 0.6;
    const top = p.shack ? c.top - 0.9 : c.top;
    U.box(p.shack ? M.stone : M.stone, c.x, y0, c.z, 0.95, top - y0, 0.85, { tint: tone.stone });
    U.box(M.stone, c.x, top, c.z, 1.12, 0.14, 1.02, { tint: '#a29a8a' });
    if (!p.shack) {
      for (const s of [-1, 1]) U.cyl(M.pot, c.x + s * 0.2, top + 0.14, c.z, 0.11, 0.14, 0.42, { seg: 8 });
      _v.set(c.x + p.shear * (top - p.ground) * 0.18, top + 0.7, c.z).applyMatrix4(base);
      smoke.push([_v.x, _v.y, _v.z]);
    }
  }

  // ── the sign: an iron bracket off the wall over the pavement, the board hung from it ──
  let sign = null;
  if (site.sign) {
    const sx = p.sign.x;
    const sy = p.sign.y;
    F.box(M.iron, sx, sy + 0.95, front + 0.68, 0.06, 0.06, 1.36);
    beam(F, M.iron, [sx, sy + 0.25, front + 0.02], [sx, sy + 0.95, front + 1.0], 0.05);
    F.cyl(M.iron, sx, sy + 0.8, front + 0.98, 0.012, 0.012, 0.15, { seg: 4 });
    F.cyl(M.iron, sx, sy + 0.8, front + 0.42, 0.012, 0.012, 0.15, { seg: 4 });
    F.box(M.paint, sx, sy + 0.08, front + 0.7, 0.07, 0.72, 1.32, { tint: '#2a1d12' });
    const c = cellOf(site.id);
    // (both faces read the right way round from their own side)
    for (const s of [-1, 1]) F.add(M.signs, quad(1.2, 0.6, [c.u0, c.v0, c.u1, c.v1]), { at: [sx + s * 0.04, sy + 0.44, front + 0.7], ry: (s * Math.PI) / 2 });
    sign = _v.set(sx, sy + 0.44, front + 0.7).applyMatrix4(base).toArray();
  }
  if (p.shack) ruin(F, U, M, p);
  return { smoke, sign };
}
