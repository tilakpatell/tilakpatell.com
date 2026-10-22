// What lies between Hogsmeade’s houses (in a browser): the High Street’s
// setts between kerbs, the flagged pavements, the lane down to the Hog’s
// Head, the land round it all (fields and yards, the road running on to
// the station, the valley’s sides, the Shack’s hill) under the same snow,
// the lamps on their posts, the stone arch with the village’s name over the
// way in from the station, barrels and crates by the doors, and the fence
// along the foot of the Shack’s hill that nobody climbs. Into the buckets.
//
//   buildStreet(bk, M, { tier }) → { lamps: [[x, y, z]] the lanterns’ middles }

import * as THREE from 'three';
import { SHACK, VILLAGE } from '../../rules/hogsmeade';
import { EDGE, HERE, S, SITES, lamps, streetFrame, terrainAt } from './layout';
import { cellOf } from './lettering';

const [UX, UZ] = HERE.axis;
// a flat strip of the street’s frame: along a0…a1, across c0…c1, at height y,
// its uvs in metres along and across the street (so the courses run across it)
function strip(a0, a1, c0, c1, y, { scale = 2 } = {}) {
  const g = new THREE.BufferGeometry();
  const corners = [
    [a0, c0],
    [a1, c0],
    [a1, c1],
    [a0, c1],
  ];
  const pos = [];
  const uv = [];
  for (const [a, c] of corners) {
    const [x, z] = S(a, c);
    pos.push(x, y, z);
    uv.push(c / scale, a / scale);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // (wound so it faces up: across × along points up in this frame)
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

// a box in the street’s frame: its middle at (along, across), turned with the street
const streetYaw = Math.atan2(UX, UZ);
function sbox(F, mat, along, across, y, w, h, d, opts = {}) {
  const [x, z] = S(along, across);
  F.box(mat, x, y, z, w, h, d, { ry: streetYaw + (opts.ry ?? 0), tint: opts.tint ?? null });
}

// the land: a grid round the village, its height terrainAt, its colour the
// season’s grass going to mud by the street and on the road to the station
function land(F, M, { size = 760, cell = 5 } = {}) {
  const n = Math.round(size / cell);
  const g = new THREE.PlaneGeometry(size, size, n, n);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const grass = new THREE.Color('#6b7344');
  const heather = new THREE.Color('#6e5a52');
  const mud = new THREE.Color('#5b4b3b');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainAt(x, z);
    pos.setY(i, y - 0.04);
    const f = streetFrame([x, z]);
    const k = 0.5 + 0.5 * Math.sin(x * 0.07 + Math.sin(z * 0.05) * 2) * Math.cos(z * 0.06);
    c.copy(grass).lerp(heather, Math.min(1, Math.max(0, (y - 6) / 30)) * 0.7 + k * 0.15);
    // (worn to mud where people walk: the yards, the road down to the station)
    const nearStreet = Math.max(0, 1 - Math.max(0, Math.abs(f.across) - 8) / 10) * (f.along > EDGE.a0 - 70 && f.along < EDGE.a1 + 6 ? 1 : 0);
    const road = f.along < EDGE.a0 + 4 ? Math.max(0, 1 - Math.abs(f.across) / 4.5) : 0;
    c.lerp(mud, Math.min(1, nearStreet * 0.55 + road * 0.9));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  F.add(M.ground, g);
}

// the far hills all round: a ring of them, higher toward the north, rock
// showing through the heather on their steep sides
function hills(F, M) {
  const segs = 120;
  const rows = 6;
  const pos = [];
  const col = [];
  const idx = [];
  const rock = new THREE.Color('#5a5650');
  const moor = new THREE.Color('#4e4a3c');
  const c = new THREE.Color();
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const rad = 520 + t * 900;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      // (the ridge line: several waves round the ring, peaks to the north, −z)
      const north = Math.max(0, -Math.sin(a));
      const wave = Math.sin(a * 5 + 1.2) * 0.5 + Math.sin(a * 11 + 0.3) * 0.3 + Math.sin(a * 23) * 0.15;
      const peak = 90 + north * 160 + wave * 70;
      const prof = Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * (1 - Math.max(0, t - 0.7) * 1.4);
      pos.push(x, Math.max(0, peak * prof) + 4, z);
      c.copy(moor).lerp(rock, Math.min(1, prof * 0.6 + (wave + 1) * 0.15));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let r = 0; r < rows; r++)
    for (let s = 0; s < segs; s++) {
      const a = r * (segs + 1) + s;
      const b = a + segs + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (make the ring face in, toward the village)
  const n = g.attributes.normal;
  if (n.getY(segs + 2) < 0) {
    g.setIndex(idx.map((_, i) => idx[i - (i % 3) + (2 - (i % 3))]));
    g.computeVertexNormals();
  }
  F.add(M.rock, g);
}

function barrel(F, M, at, y = 0) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(0.27 + Math.sin(t * Math.PI) * 0.05, t * 0.86));
  }
  const g = new THREE.LatheGeometry(pts, 12);
  F.add(M.timber, g, { at: [at[0], y, at[1]], tint: '#8a6a4a' });
  for (const h of [0.12, 0.74]) F.add(M.iron, new THREE.CylinderGeometry(0.31, 0.31, 0.05, 12, 1, true), { at: [at[0], y + h, at[1]] });
  F.add(M.timber, new THREE.CylinderGeometry(0.26, 0.26, 0.02, 12), { at: [at[0], y + 0.86, at[1]] });
}

export function buildStreet(bk, M, { tier = 'high' } = {}) {
  const F = bk.frame();
  const half = HERE.width / 2;
  // the carriageway’s setts between the kerbs, the flagged pavements to the fronts
  const kerb = half - 2.2;
  F.add(M.setts, strip(EDGE.a0 - 4, EDGE.a1, -kerb, kerb, 0.0));
  for (const s of [-1, 1]) {
    F.add(M.flags, strip(EDGE.a0 + 6, EDGE.a1 - 2, s > 0 ? kerb + 0.18 : -half - 1.2, s > 0 ? half + 1.2 : -kerb - 0.18, 0.1));
    // (the kerb: a run of long stones the length of the street)
    for (let a = EDGE.a0 + 6; a < EDGE.a1 - 2; a += 1.6) sbox(F, M.stone, a + 0.8, s * (kerb + 0.09), -0.05, 0.2, 0.17, 1.56, { tint: '#9c968c' });
  }
  // the lane down to the Hog’s Head, cobbled and narrow
  const hh = SITES.find((b) => b.id === 'hogshead');
  F.add(M.setts, strip(hh.along - 3, hh.along + 3, -(half + (hh.lane ?? 0)) + 0.2, -half - 1.2, 0.0));
  land(F, M, { cell: tier === 'low' ? 10 : 5 });
  hills(F, M);

  // the lamps: an iron post on a stone foot, a lantern of four panes under a little roof
  const lit = [];
  for (const l of lamps()) {
    const [x, z] = l.at;
    F.box(M.stone, x, 0.05, z, 0.42, 0.3, 0.42, { tint: '#8c867c' });
    F.cyl(M.iron, x, 0.3, z, 0.055, 0.075, 2.9, { seg: 8 });
    F.box(M.iron, x, 3.15, z, 0.36, 0.05, 0.36);
    F.box(M.lamp, x, 3.2, z, 0.26, 0.42, 0.26);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F.box(M.iron, x + dx * 0.14, 3.2, z + dz * 0.14, 0.03, 0.42, 0.03);
    F.add(M.iron, new THREE.ConeGeometry(0.28, 0.26, 4).rotateY(Math.PI / 4).translate(0, 0.13, 0), { at: [x, 3.62, z] });
    F.cyl(M.iron, x, 3.86, z, 0.03, 0.03, 0.12, { seg: 6 });
    F.add(M.pool, new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), { at: [x, 0.16, z] });
    lit.push([x, 3.4, z]);
  }

  // the arch over the way in from the station: two stone piers, an oak beam, the name hung under it
  for (const s of [-1, 1]) {
    sbox(F, M.stone, -76, s * 5.4, -0.1, 0.95, 3.9, 0.95, { tint: '#8e877a' });
    sbox(F, M.stone, -76, s * 5.4, 3.8, 1.15, 0.22, 1.15, { tint: '#a29a8a' });
    const [x, z] = S(-76, s * 5.4);
    F.add(M.stone, new THREE.ConeGeometry(0.62, 0.7, 4).rotateY(Math.PI / 4), { at: [x, 4.37, z], ry: streetYaw, tint: '#8e877a' });
  }
  // (a box’s width lies across the street in its frame)
  sbox(F, M.timber, -76, 0, 4.1, 12.2, 0.34, 0.36);
  for (const s of [-1, 1]) {
    // (the beam’s ends braced to the piers)
    const [x0, z0] = S(-76, s * 4.9);
    const [x1, z1] = S(-76, s * 3.6);
    const g = new THREE.BoxGeometry(0.16, Math.hypot(x1 - x0, z1 - z0, 0.9), 0.16);
    g.translate(0, Math.hypot(x1 - x0, z1 - z0, 0.9) / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x1 - x0, 0.9, z1 - z0).normalize()));
    F.add(M.timber, g, { at: [x0, 3.2, z0] });
  }
  const c = cellOf('arch');
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(3.6, 1.2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? c.u1 : c.u0, uv.getY(i) ? c.v1 : c.v0);
    const [x, z] = S(-76 + s * 0.04, 0);
    // (facing down the road on one side, up the street on the other)
    F.add(M.signs, g, { at: [x, 3.25, z], ry: Math.atan2(-s * UX, -s * UZ) });
  }
  // (the rod the board hangs from, and its two chains)
  sbox(F, M.iron, -76, 0, 3.92, 3.8, 0.06, 0.06);
  for (const s of [-1, 1]) sbox(F, M.iron, -76, s * 1.6, 3.82, 0.03, 0.12, 0.03);

  // barrels and crates by the inn doors and the sweetshop’s
  for (const id of ['broomsticks', 'hogshead', 'honeydukes', 'post']) {
    const b = SITES.find((x) => x.id === id);
    const right = [b.out[1], -b.out[0]];
    const at = (k, o = 1.1) => [b.door[0] + right[0] * k + b.out[0] * o, b.door[1] + right[1] * k + b.out[1] * o];
    barrel(F, M, at(-2.4, 0.6));
    if (id !== 'post') barrel(F, M, at(-3.0, 0.75));
    const [cx, cz] = at(2.6, 0.7);
    F.box(M.paint, cx, 0.1, cz, 0.7, 0.6, 0.6, { ry: b.yaw + 0.2, tint: '#7a5a3a' });
    F.box(M.paint, cx + 0.05, 0.7, cz, 0.55, 0.45, 0.5, { ry: b.yaw - 0.15, tint: '#8a6a44' });
  }

  // the fence along the hill’s foot: posts every two metres, two rails, a few leaning
  const [f0, f1] = SHACK.fence.map((p) => [p[0] - VILLAGE.at[0], p[1] - VILLAGE.at[1]]);
  const flen = Math.hypot(f1[0] - f0[0], f1[1] - f0[1]);
  const fy = Math.atan2(f1[0] - f0[0], f1[1] - f0[1]);
  const n = Math.ceil(flen / 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = f0[0] + (f1[0] - f0[0]) * t;
    const z = f0[1] + (f1[1] - f0[1]) * t;
    const lean = Math.sin(i * 2.3) * 0.12;
    F.box(M.shackwood, x, terrainAt(x, z) - 0.3, z, 0.14, 1.75, 0.14, { rx: lean, ry: fy, tint: '#7a7266' });
  }
  for (const h of [0.6, 1.15]) {
    const [mx, mz] = [(f0[0] + f1[0]) / 2, (f0[1] + f1[1]) / 2];
    F.box(M.shackwood, mx, terrainAt(mx, mz) + h, mz, 0.06, 0.12, flen, { ry: fy, tint: '#7a7266' });
  }
  return { lamps: lit };
}
