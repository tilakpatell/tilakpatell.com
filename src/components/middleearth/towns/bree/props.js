// Bree, made in code: the kit the walkable town is built from. Tall houses
// for Big Folk, of stone below and oak and plaster above, each floor
// jettied out over the one under it, under steep roofs of slate or thatch;
// the Prancing Pony and its sign; the stockade of sharpened logs and its two
// gates, with the gatekeeper's hatch and his lodge; the stable, the well, the
// market stalls; the Nazgûl on foot, and Bill the pony.
//
// Built with the Shire's kit (../../shire/props.js): its materials, made a
// little darker and wetter for a rainy night, and its helpers. The same
// conventions: each builder's group stands on y = 0 at its origin, doors
// face +z, creatures face +x, and fixed parts are merged one mesh per
// material.

import * as THREE from 'three';
import { canvasTexture, hot } from '../../../../lib/three/stage3dNodes';
import { makeCanvas, mix } from '../../../../lib/paint';
import { STANCE, TROT, WALK, createStride, createTracker, ease, gaitOffsets, legSwing } from '../../creatures';
import { makeToyFigure } from '../../mapFigures';
import { LOOKS, compact } from '../../shire/people';
import { castFigure } from '../../cast3d';
import { B, ball, barrelParts, beam, benchParts, blob, createShireKit, cyl, cylX, cylZ, fillColor, gableGeo, lanternParts, lathe, parts, plankDoor, rng, roofGeo, roundBox, sector, squareWindow, tf, timberWall, tube, underRidge } from '../../shire/props';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// Big Folk: a ground floor tall enough for a man of 2.3, the floors over it
const H1 = 3.0;
const H2 = 2.6;

// ── the houses ──

// The door and its surround on a ground floor's face (its own frame: x
// along the wall, z out of it), with a step and a lantern on a bracket.
// Returns where the lantern hangs.
function doorway(bk, K, { x, w = 1.2, h = 2.4, paint, stone }) {
  const { mats } = K;
  plankDoor(bk, K, { x, w, h, paint });
  if (stone) {
    // an arch of dressed stones over it
    const n = 9;
    for (let i = 0; i < n; i++) {
      const s0 = (i / n) * Math.PI + 0.012;
      const s1 = ((i + 1) / n) * Math.PI - 0.012;
      bk.add(mats.dressed, sector(w / 2 + 0.02, w / 2 + (i === 4 ? 0.36 : 0.28), s0, s1, 0.1, 0.012), { p: [x, h - w / 2, -0.03], uv: 0.7, uvOff: i * 0.3 });
    }
  } else {
    beam(bk, mats.timber, x - w / 2 - 0.12, 0, x - w / 2 - 0.12, h + 0.15, 0.16);
    beam(bk, mats.timber, x + w / 2 + 0.12, 0, x + w / 2 + 0.12, h + 0.15, 0.16);
    beam(bk, mats.timber, x - w / 2 - 0.3, h + 0.15, x + w / 2 + 0.3, h + 0.15, 0.18);
  }
  bk.add(mats.dressed, roundBox(w + 0.5, 0.16, 0.6, 0.03), { p: [x, 0.08, 0.3], uv: 0.6 });
  const lx = x + w / 2 + 0.55;
  bk.add(mats.iron, tube([[lx, 2.75, 0], [lx, 2.82, 0.3], [lx + 0.02, 2.72, 0.42]], 0.02, 0.015, { seg: 4, radial: 4 }));
  lanternParts(bk, K, lx + 0.02, 2.45, 0.42, 1.25, 0.12);
  return V3(lx + 0.02, 2.45, 0.42);
}

// A roof and its gables over a box w × D at height `top`: the ridge along
// x (eaves to the street) or along z (the gable to the street).
function roofOver(bk, K, { w, D, top, ridge = 'x', thatch = false, seed = 1, steep = 0.66 }) {
  const { mats } = K;
  const mat = thatch ? mats.thatch : mats.slate;
  const t = thatch ? 0.36 : 0.18;
  const along = ridge === 'x';
  const span = (along ? D : w) + (thatch ? 1.0 : 0.8);
  const len = (along ? w : D) + (thatch ? 0.8 : 0.6);
  const rise = span * steep;
  const roofY = top - 0.1;
  bk.add(mat, roofGeo({ span, len, rise, t, thatch, seed }), { p: [0, roofY, 0], r: [0, along ? Math.PI / 2 : 0, 0] });
  if (thatch) bk.add(mats.thatch, along ? cylX(0.2, len + 0.1, 10) : cylZ(0.2, len + 0.1, 10), { p: [0, roofY + rise - 0.08, 0], uv: 1.3 });
  else bk.add(mats.ridge, new THREE.CylinderGeometry(0.12, 0.12, len, 8, 1, false, -Math.PI / 2, Math.PI), { r: along ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], p: [0, roofY + rise - 0.02, 0] });
  // the gables: plaster in an oak frame
  const half = (along ? D : w) / 2;
  const gRise = underRidge(span, rise, t, roofY - top);
  for (const s of [-1, 1]) {
    if (along) bk.add(mats.plaster, gableGeo(half, gRise, 0.22), { p: [s > 0 ? w / 2 - 0.22 : -w / 2, top, 0], r: [0, Math.PI / 2, 0], uv: 0.4 });
    else bk.add(mats.plaster, gableGeo(half, gRise, 0.22), { p: [0, top, s > 0 ? D / 2 - 0.22 : -D / 2], uv: 0.4 });
    const o = along ? [s * w / 2, top, s * D / 2] : [s > 0 ? -w / 2 : w / 2, top, s * D / 2];
    const ry = along ? s * Math.PI / 2 : s > 0 ? 0 : Math.PI;
    bk.at(o, ry, () => {
      const L = half * 2;
      beam(bk, mats.timber, 0.1, 0.06, half, gRise - 0.05, 0.15);
      beam(bk, mats.timber, L - 0.1, 0.06, half, gRise - 0.05, 0.15);
      beam(bk, mats.timber, half, 0.1, half, gRise - 0.2, 0.15);
      if (gRise > 2.2) {
        beam(bk, mats.timber, half * 0.45, gRise * 0.42, L - half * 0.45, gRise * 0.42, 0.13);
        squareWindow(bk, K, { x: half, y: gRise * 0.28, w: 0.62, h: 0.62, nx: 2, ny: 2 });
      }
    });
  }
  return { rise, roofY, span };
}

// A Bree house: w across the front, d deep, `floors` storeys.
function house(K, { w = 7, d = 7, floors = 2, roof = 'slate', stone = true, seed = 1, door = 0x5a3a24 } = {}) {
  const { mats } = K;
  const r = rng(seed * 13 + 1);
  const g = new THREE.Group();
  g.name = 'house';
  const bk = parts();
  const jet = 0.35;
  const top = H1 + (floors - 1) * H2;
  const Dt = d + 2 * jet * (floors - 1);
  // the ground floor, and its plinth
  bk.add(mats.stone, B(w + 0.2, 0.3, d + 0.2), { p: [0, 0.15, 0], uv: 0.5 });
  if (stone) bk.add(mats.stone, B(w, H1, d), { p: [0, H1 / 2, 0], uv: 0.45 });
  else {
    bk.add(mats.plaster, B(w, H1, d), { p: [0, H1 / 2, 0], uv: 0.4 });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bk.add(mats.timber, B(0.2, H1, 0.2), { p: [(x * (w - 0.1)) / 2, H1 / 2, (z * (d - 0.1)) / 2], uv: 1 });
  }
  // the floors over it, each oversailing the one under it front and back
  for (let i = 1; i < floors; i++) {
    const y0 = H1 + (i - 1) * H2;
    const D = d + 2 * jet * i;
    bk.add(mats.plaster, B(w, H2, D), { p: [0, y0 + H2 / 2, 0], uv: 0.4 });
    bk.add(mats.timber, B(w + 0.1, 0.22, D + 0.1), { p: [0, y0 + 0.06, 0], uv: 1 });
    // the joists' ends and brackets under the jetty
    for (const s of [-1, 1]) {
      for (let x = -w / 2 + 0.4; x <= w / 2 - 0.3; x += 0.75) bk.add(mats.timber, B(0.13, 0.13, jet + 0.06), { p: [x, y0 - 0.07, s * (D / 2 - jet / 2)] });
      for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) bk.add(mats.timber, tube([[x, y0 - 0.85, s * (D / 2 - jet - 0.02)], [x, y0 - 0.35, s * (D / 2 - jet + 0.1)], [x, y0 - 0.05, s * (D / 2 - 0.05)]], 0.07, 0.06, { seg: 4, radial: 5 }));
    }
    const nFront = w > 6.6 ? 3 : 2;
    const front = Array.from({ length: nFront }, (_, k) => ({ x: (w * (k + 0.5)) / nFront, w: 0.95, h: 1.05, panes: [2, 3] }));
    const faces = [
      [[-w / 2, y0, D / 2], 0, w, front],
      [[w / 2, y0, D / 2], Math.PI / 2, D, [{ x: D / 2, w: 0.85, h: 1.0 }]],
      [[w / 2, y0, -D / 2], Math.PI, w, [{ x: w * 0.3, w: 0.85, h: 1.0 }, { x: w * 0.7, w: 0.85, h: 1.0 }]],
      [[-w / 2, y0, -D / 2], -Math.PI / 2, D, [{ x: D / 2, w: 0.85, h: 1.0 }]],
    ];
    for (const [o, ry, len, wins] of faces) bk.at(o, ry, () => timberWall(bk, K, { len, h: H2, wins, braces: (seed + i) % 2 === 0 }));
  }
  // the front: the door, off-middle, windows either side
  const doorX = (r() - 0.5) * w * 0.3;
  let lamp = null;
  bk.at([0, 0.3, d / 2], 0, () => {
    lamp = doorway(bk, K, { x: doorX, paint: K.paint(door), stone });
    for (const x of [-w / 2 + 1.2, w / 2 - 1.2]) if (Math.abs(x - doorX) > 1.8) squareWindow(bk, K, { x, y: 1.45, w: 1.0, h: 1.2, nx: 3, ny: 3, sill: mats.dressed, lintel: stone ? mats.dressed : null });
  });
  for (const s of [-1, 1]) bk.at([s * w / 2, 0.3, s * d / 2], s * Math.PI / 2, () => squareWindow(bk, K, { x: d / 2, y: 1.45, w: 0.85, h: 1.05, nx: 2, ny: 3, sill: mats.dressed }));
  // the roof
  const ridge = seed % 3 === 0 ? 'z' : 'x';
  const { rise } = roofOver(bk, K, { w, D: Dt, top, ridge, thatch: roof === 'thatch', seed, steep: roof === 'thatch' ? 0.72 : 0.64 });
  // a stone chimney up one end, through the roof
  const cs = seed % 2 ? 1 : -1;
  const cx = cs * (w / 2 - 0.75);
  const cz = ridge === 'x' ? -0.7 : -Dt / 2 + 1.0;
  const ch = top + rise + 1.1;
  bk.add(mats.stone, B(0.8, ch - top + 0.6, 0.8), { p: [cx, top - 0.3 + (ch - top + 0.6) / 2, cz], uv: 0.45 });
  bk.add(mats.dressed, roundBox(0.98, 0.14, 0.98, 0.03), { p: [cx, ch + 0.32, cz], uv: 0.6 });
  for (const dx of [-0.18, 0.18]) bk.add(mats.clay, lathe([[0.13, 0], [0.1, 0.26], [0.13, 0.32], [0.09, 0.32], [0.08, 0.2]], 10), { p: [cx + dx, ch + 0.38, cz] });
  // a water butt or a pile of logs by a side wall
  if (r() < 0.6) bk.at([cs * -(w / 2 + 0.45), 0, d / 2 - 1.2], 0, () => barrelParts(bk, K, { h: 1.0, r: 0.38 }));
  bk.build(g);
  return { group: g, chimneyTop: V3(cx, ch + 0.7, cz), doorAt: V3(doorX, 0, d / 2 + 0.9), lamp: lamp?.clone().add(V3(0, 0.3, d / 2)) ?? null };
}

// ── the Prancing Pony ──

// The sign: a rearing white pony on a green board, and the inn's name.
function ponySignCanvas() {
  const c = makeCanvas(512, 400);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 400);
  grd.addColorStop(0, '#24452f');
  grd.addColorStop(1, '#16301f');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 400);
  // grain
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    const y = Math.random() * 400;
    g.moveTo(0, y);
    g.bezierCurveTo(170, y + 6, 340, y - 6, 512, y + 3);
    g.stroke();
  }
  g.strokeStyle = '#d9b14a';
  g.lineWidth = 10;
  g.strokeRect(14, 14, 484, 372);
  g.lineWidth = 3;
  g.strokeRect(30, 30, 452, 340);
  // the pony, rearing, facing left
  g.save();
  g.translate(262, 215);
  g.fillStyle = '#f4efe2';
  g.strokeStyle = '#f4efe2';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath(); // body, tipped up at the front
  g.ellipse(10, 18, 70, 34, -0.55, 0, TAU);
  g.fill();
  g.beginPath(); // neck and head
  g.moveTo(-34, -6);
  g.quadraticCurveTo(-50, -52, -40, -86);
  g.lineTo(-66, -96);
  g.quadraticCurveTo(-84, -98, -88, -84);
  g.lineTo(-62, -66);
  g.quadraticCurveTo(-52, -40, -10, -14);
  g.closePath();
  g.fill();
  g.beginPath(); // ears
  g.moveTo(-44, -88);
  g.lineTo(-40, -106);
  g.lineTo(-34, -88);
  g.fill();
  g.lineWidth = 13; // forelegs, raised and bent
  g.beginPath();
  g.moveTo(-30, 0);
  g.lineTo(-62, -12);
  g.lineTo(-74, 14);
  g.moveTo(-18, 12);
  g.lineTo(-46, 22);
  g.lineTo(-54, 50);
  g.stroke();
  g.lineWidth = 15; // hind legs, planted
  g.beginPath();
  g.moveTo(50, 40);
  g.lineTo(54, 86);
  g.lineTo(46, 128);
  g.moveTo(70, 26);
  g.lineTo(86, 78);
  g.lineTo(78, 124);
  g.stroke();
  g.lineWidth = 9; // tail
  g.beginPath();
  g.moveTo(74, 10);
  g.quadraticCurveTo(118, 10, 112, 70);
  g.stroke();
  g.fillStyle = '#c9a24a'; // the mane
  g.beginPath();
  g.moveTo(-40, -86);
  g.quadraticCurveTo(-22, -60, -20, -16);
  g.lineTo(-30, -14);
  g.quadraticCurveTo(-34, -56, -46, -82);
  g.fill();
  g.restore();
  g.fillStyle = '#e8c45a';
  g.textAlign = 'center';
  g.font = 'bold 40px Georgia, "Times New Roman", serif';
  g.fillText('THE PRANCING PONY', 256, 76);
  g.font = 'italic 24px Georgia, serif';
  g.fillText('B. Butterbur', 256, 362);
  return c;
}

// Three floors on the high street: a stone ground floor with the common
// room's big leaded windows, two jettied floors of oak and plaster, two
// gables to the street on a long slate roof, three chimneys, a porch over
// the door with lanterns either side, and the sign on an iron bracket.
function pony(K, { w = 15, d = 9 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'pony';
  const bk = parts();
  const h1 = 3.4;
  const h2 = 2.8;
  const jet = 0.4;
  const D1 = d + jet * 2;
  const D2 = d + jet * 4;
  const top = h1 + h2 * 2;
  bk.add(mats.ashlar, B(w + 0.3, 0.35, d + 0.3), { p: [0, 0.175, 0], uv: 0.45 });
  bk.add(mats.ashlar, B(w, h1, d), { p: [0, h1 / 2, 0], uv: 0.45 });
  for (const [i, D] of [[0, D1], [1, D2]]) {
    const y0 = h1 + i * h2;
    bk.add(mats.plaster, B(w, h2, D), { p: [0, y0 + h2 / 2, 0], uv: 0.4 });
    bk.add(mats.timber, B(w + 0.12, 0.24, D + 0.12), { p: [0, y0 + 0.06, 0], uv: 1 });
    for (const s of [-1, 1]) for (let x = -w / 2 + 0.4; x <= w / 2 - 0.3; x += 0.7) bk.add(mats.timber, B(0.14, 0.14, jet + 0.06), { p: [x, y0 - 0.07, s * (D / 2 - jet / 2)] });
    const front = [1.6, 3.9, 6.2, w - 6.2, w - 3.9, w - 1.6].map((x) => ({ x, w: 1.0, h: 1.15, panes: [2, 3] }));
    const faces = [
      [[-w / 2, y0, D / 2], 0, w, front],
      [[w / 2, y0, D / 2], Math.PI / 2, D, [{ x: D * 0.3, w: 0.9, h: 1.05 }, { x: D * 0.7, w: 0.9, h: 1.05 }]],
      [[w / 2, y0, -D / 2], Math.PI, w, [2.4, w / 2, w - 2.4].map((x) => ({ x, w: 0.95, h: 1.05 }))],
      [[-w / 2, y0, -D / 2], -Math.PI / 2, D, [{ x: D * 0.3, w: 0.9, h: 1.05 }, { x: D * 0.7, w: 0.9, h: 1.05 }]],
    ];
    for (const [o, ry, len, wins] of faces) bk.at(o, ry, () => timberWall(bk, K, { len, h: h2, wins }));
  }
  // the ground floor's front: the door under its porch, the common room's windows
  const lamps = [];
  bk.at([0, 0.35, d / 2], 0, () => {
    plankDoor(bk, K, { x: 0, w: 1.6, h: 2.7, paint: K.paint(0x2f4a36) });
    for (let i = 0; i < 11; i++) {
      const s0 = (i / 11) * Math.PI + 0.012;
      const s1 = ((i + 1) / 11) * Math.PI - 0.012;
      bk.add(mats.dressed, sector(0.82, i === 5 ? 1.2 : 1.1, s0, s1, 0.1, 0.012), { p: [0, 1.9, -0.03], uv: 0.7, uvOff: i * 0.3 });
    }
    for (const x of [-5.6, -3.1, 3.1, 5.6]) squareWindow(bk, K, { x, y: 1.55, w: 1.5, h: 1.6, nx: 4, ny: 4, sill: mats.dressed, lintel: mats.dressed });
    bk.add(mats.dressed, roundBox(2.6, 0.2, 0.9, 0.03), { p: [0, 0.1, 0.45], uv: 0.6 });
    for (const s of [-1, 1]) {
      bk.add(mats.iron, tube([[s * 1.35, 2.85, 0], [s * 1.38, 2.95, 0.3], [s * 1.38, 2.85, 0.45]], 0.022, 0.016, { seg: 4, radial: 4 }));
      lanternParts(bk, K, s * 1.38, 2.55, 0.45, 1.4, 0.14);
      lamps.push(V3(s * 1.38, 2.9, d / 2 + 0.45));
    }
  });
  // the porch roof on curved brackets
  bk.add(mats.slate, roundBox(3.2, 0.1, 1.3, 0.02), { p: [0, 3.55, d / 2 + 0.55], r: [0.3, 0, 0], uv: 1 });
  for (const s of [-1, 1]) bk.add(mats.timber, tube([[s * 1.45, 2.6, d / 2], [s * 1.45, 3.1, d / 2 + 0.35], [s * 1.45, 3.35, d / 2 + 1.0]], 0.07, 0.06, { seg: 5, radial: 5 }));
  // side and back windows on the ground floor
  for (const s of [-1, 1]) bk.at([s * w / 2, 0.35, s * d / 2], s * Math.PI / 2, () => squareWindow(bk, K, { x: d / 2, y: 1.55, w: 1.2, h: 1.4, nx: 3, ny: 4, sill: mats.dressed, lintel: mats.dressed }));
  bk.at([w / 2, 0.35, -d / 2], Math.PI, () => {
    plankDoor(bk, K, { x: 2.2, w: 1.1, h: 2.3, paint: mats.timber });
    squareWindow(bk, K, { x: w / 2, y: 1.55, w: 1.2, h: 1.4, nx: 3, ny: 4, sill: mats.dressed });
  });
  // the main roof, ridge along x, and two gables to the street
  const span = D2 + 1.0;
  const rise = 4.6;
  bk.add(mats.slate, roofGeo({ span, len: w + 0.8, rise, t: 0.2 }), { p: [0, top - 0.1, 0], r: [0, Math.PI / 2, 0] });
  bk.add(mats.ridge, new THREE.CylinderGeometry(0.13, 0.13, w + 0.8, 8, 1, false, -Math.PI / 2, Math.PI), { r: [0, 0, Math.PI / 2], p: [0, top - 0.1 + rise - 0.02, 0] });
  const gRise = underRidge(span, rise, 0.2, -0.1);
  for (const s of [-1, 1]) {
    bk.add(mats.plaster, gableGeo(D2 / 2, gRise, 0.22), { p: [s > 0 ? w / 2 - 0.22 : -w / 2, top, 0], r: [0, Math.PI / 2, 0], uv: 0.4 });
    bk.at([s * w / 2, top, s * D2 / 2], s * Math.PI / 2, () => {
      beam(bk, mats.timber, 0.1, 0.06, D2 / 2, gRise - 0.05, 0.15);
      beam(bk, mats.timber, D2 - 0.1, 0.06, D2 / 2, gRise - 0.05, 0.15);
      beam(bk, mats.timber, D2 / 2, 0.1, D2 / 2, gRise - 0.2, 0.15);
      squareWindow(bk, K, { x: D2 / 2, y: gRise * 0.35, w: 0.8, h: 0.8 });
    });
  }
  const cw = 2.3;
  const cRise = 3.0;
  for (const gx of [-3.9, 3.9]) {
    bk.add(mats.plaster, gableGeo(cw, cRise, 0.25), { p: [gx, top, D2 / 2 - 0.25], uv: 0.4 });
    bk.at([gx - cw, top, D2 / 2], 0, () => {
      beam(bk, mats.timber, 0.1, 0.06, cw, cRise - 0.05, 0.15);
      beam(bk, mats.timber, cw * 2 - 0.1, 0.06, cw, cRise - 0.05, 0.15);
      beam(bk, mats.timber, 0.5, 0.1, cw * 2 - 0.5, 0.1, 0.15);
      beam(bk, mats.timber, cw, 0.1, cw, cRise - 0.2, 0.15);
      squareWindow(bk, K, { x: cw - 0.6, y: 1.1, w: 0.7, h: 0.9, nx: 2, ny: 3 });
      squareWindow(bk, K, { x: cw + 0.6, y: 1.1, w: 0.7, h: 0.9, nx: 2, ny: 3 });
    });
    const cLen = D2 / 2 + 0.55 - 0.2;
    bk.add(mats.slate, roofGeo({ span: cw * 2 + 0.7, len: cLen, rise: cRise + 0.3, t: 0.18 }), { p: [gx, top - 0.12, 0.2 + cLen / 2] });
    bk.add(mats.ridge, new THREE.CylinderGeometry(0.11, 0.11, cLen, 8, 1, false, -Math.PI / 2, Math.PI), { r: [Math.PI / 2, 0, 0], p: [gx, top - 0.12 + cRise + 0.3 - 0.02, 0.2 + cLen / 2] });
  }
  // three chimneys
  const chimneyTops = [];
  for (const [x, z] of [[-w / 2 + 1.2, -1.4], [1.0, -1.8], [w / 2 - 1.2, -1.4]]) {
    const ch = top + rise + 1.0;
    bk.add(mats.ashlar, B(0.9, ch - top + 0.8, 0.9), { p: [x, top - 0.4 + (ch - top + 0.8) / 2, z], uv: 0.45 });
    bk.add(mats.dressed, roundBox(1.1, 0.15, 1.1, 0.03), { p: [x, ch + 0.42, z], uv: 0.6 });
    for (const dx of [-0.2, 0.2]) bk.add(mats.clay, lathe([[0.14, 0], [0.11, 0.28], [0.14, 0.34], [0.1, 0.34], [0.09, 0.22]], 10), { p: [x + dx, ch + 0.48, z] });
    chimneyTops.push(V3(x, ch + 0.84, z));
  }
  // barrels by the door, a bench under the windows
  bk.at([-4.4, 0, d / 2 + 0.55], 0, () => benchParts(bk, K, 1.8));
  bk.at([4.4, 0, d / 2 + 0.55], 0, () => benchParts(bk, K, 1.8));
  bk.build(g);

  // the sign, out from the wall on its bracket over the door's right
  const sign = new THREE.Group();
  sign.name = 'sign';
  sign.position.set(2.6, h1 + 0.9, D1 / 2);
  g.add(sign);
  const sk = parts();
  sk.add(mats.iron, B(1.9, 0.07, 0.07), { p: [0, 0.75, 0.95], r: [Math.PI / 2, 0, Math.PI / 2] });
  sk.add(mats.iron, tube([[0, 0, 0.05], [0, 0.4, 0.6], [0, 0.75, 1.5]], 0.025, 0.02, { seg: 6, radial: 4 }));
  for (const z of [0.95, 1.75]) sk.add(mats.iron, cyl(0.012, 0.012, 0.22, 4), { p: [0, 0.62, z] });
  sk.add(mats.timber, roundBox(0.08, 1.12, 1.4, 0.02), { p: [0, -0.06, 1.35], uv: 1.4 });
  sk.build(sign);
  const signMat = new THREE.MeshStandardMaterial({ map: canvasTexture(ponySignCanvas(), K.renderer, { wrap: false }), roughness: 0.7 });
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 1.04), signMat);
    face.position.set(s * 0.045, -0.06, 1.35);
    face.rotation.y = s * Math.PI / 2;
    sign.add(face);
  }
  return { group: g, chimneyTops, doorAt: V3(0, 0, d / 2 + 1.0), lamps, sign };
}

// ── the stockade and its gates ──

// Logs along wall segments [x0, z0, x1, z1] (../layout.js's STOCKADE),
// standing on the ground, sharpened, a little uneven, with two rails along
// the inside. Instanced: two draws for the whole ring.
function stockade(K, segs, height, { tall = 4.6, inside = [0, 0] } = {}) {
  // a log's shaft (scaled to its height) and its sharpened tip (not)
  const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1).translate(0, 0.5, 0);
  const tipGeo = new THREE.ConeGeometry(1, 0.75, 8).translate(0, 0.375, 0);
  const uv = shaftGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 4);
  const r = rng(77);
  const logs = [];
  const rails = [];
  for (const [x0, z0, x1, z1] of segs) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 0.44));
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * k;
      const z = z0 + (z1 - z0) * k;
      const rad = 0.2 + r() * 0.05;
      logs.push({ x, z, y: height(x, z) - 0.3, rad, h: tall - 0.7 + r() * 0.6, tilt: (r() - 0.5) * 0.06, turn: r() * TAU });
    }
    // the rails: on the town side of the logs
    const nx = -(z1 - z0) / len;
    const nz = (x1 - x0) / len;
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const toward = Math.sign((inside[0] - mx) * nx + (inside[1] - mz) * nz) || 1;
    for (const y of [1.2, 3.3]) rails.push({ x: mx + nx * toward * 0.32, z: mz + nz * toward * 0.32, y: height(mx, mz) + y, len: len + 0.1, turn: -Math.atan2(z1 - z0, x1 - x0) });
  }
  const g = new THREE.Group();
  g.name = 'stockade';
  const logMesh = new THREE.InstancedMesh(shaftGeo, K.mats.trunk, logs.length);
  const tipMesh = new THREE.InstancedMesh(tipGeo, K.mats.trunk, logs.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const up = V3();
  logs.forEach((l, i) => {
    e.set(l.tilt, l.turn, l.tilt * 0.5);
    q.setFromEuler(e);
    m.compose(V3(l.x, l.y, l.z), q, V3(l.rad, l.h, l.rad));
    logMesh.setMatrixAt(i, m);
    up.set(0, l.h, 0).applyQuaternion(q);
    m.compose(V3(l.x + up.x, l.y + up.y, l.z + up.z), q, V3(l.rad, 1, l.rad));
    tipMesh.setMatrixAt(i, m);
  });
  for (const mesh of [logMesh, tipMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
  }
  const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.22, 0.2), K.mats.timber, rails.length);
  rails.forEach((rl, i) => {
    q.setFromAxisAngle(V3(0, 1, 0), rl.turn);
    m.compose(V3(rl.x, rl.y, rl.z), q, V3(rl.len, 1, 1));
    railMesh.setMatrixAt(i, m);
  });
  railMesh.computeBoundingSphere();
  g.add(logMesh, tipMesh, railMesh);
  return { group: g };
}

// Harry's face in the hatch, lit by his lantern: hood, eyes, a big nose
function hatchFaceCanvas() {
  const c = makeCanvas(128, 112);
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(64, 60, 4, 64, 60, 80);
  bg.addColorStop(0, '#ffb45a');
  bg.addColorStop(0.5, '#a0501c');
  bg.addColorStop(1, '#1a0a04');
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 112);
  g.fillStyle = '#2a2420';
  g.beginPath();
  g.ellipse(64, 66, 54, 60, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8b888';
  g.beginPath();
  g.ellipse(64, 70, 36, 40, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6a4a30';
  g.beginPath();
  g.ellipse(64, 100, 34, 22, 0, 0, Math.PI);
  g.fill();
  g.fillStyle = '#1a1210';
  for (const x of [50, 78]) {
    g.beginPath();
    g.arc(x, 62, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#d89a6a';
  g.beginPath();
  g.ellipse(64, 76, 8, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#3a2418';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(40, 52);
  g.lineTo(56, 55);
  g.moveTo(88, 52);
  g.lineTo(72, 55);
  g.stroke();
  return c;
}

// A gate in the stockade, w wide: two big posts and a lintel with a little
// roof, two leaves of sharpened planks that swing in, a lantern under the
// lintel on the town side, and in the left leaf the gatekeeper's hatch.
// Its own +z is the town side. open(k): 0 shut … 1 open; smash(): broken in.
function gate(K, { w = 5.2, tall = 4.4 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'gate';
  const bk = parts();
  for (const s of [-1, 1]) {
    bk.add(mats.trunk, cyl(0.34, 0.38, 6.4, 10), { p: [s * (w / 2 + 0.12), 3.2 - 0.3, 0], uv: 1 });
    bk.add(mats.trunk, new THREE.ConeGeometry(0.36, 0.6, 10), { p: [s * (w / 2 + 0.12), 6.4, 0] });
  }
  bk.add(mats.timber, B(w + 1.4, 0.4, 0.5), { p: [0, 5.55, 0], uv: 1 });
  bk.add(mats.slate, roofGeo({ span: 1.6, len: w + 1.8, rise: 0.7, t: 0.1 }), { p: [0, 5.75, 0], r: [0, Math.PI / 2, 0] });
  bk.add(mats.iron, cyl(0.012, 0.012, 0.6, 3), { p: [0, 5.05, 0.6] });
  lanternParts(bk, K, 0, 4.6, 0.6, 1.4, 0);
  bk.add(mats.iron, B(0.06, 0.06, 0.7), { p: [0, 5.35, 0.3] });
  bk.build(g);

  // a leaf: planks with sharpened tops, two rails and a brace on the town
  // side, iron straps on the road side; hinged at its outer edge
  const leafW = w / 2 - 0.04;
  const makeLeaf = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (w / 2), 0, 0);
    g.add(pivot);
    const lk = parts();
    const n = Math.round(leafW / 0.26);
    const pw = leafW / n;
    for (let i = 0; i < n; i++) {
      const x = -side * (pw * (i + 0.5));
      const h = tall - 0.2 + ((i * 7) % 3) * 0.1;
      lk.add(mats.barnwood, B(pw - 0.02, h, 0.12), { p: [x, h / 2 + 0.05, 0], uv: 1.1 });
      lk.add(mats.barnwood, new THREE.ConeGeometry(pw * 0.55, 0.42, 4), { p: [x, h + 0.26, 0], r: [0, Math.PI / 4, 0], s: [1, 1, 0.4] });
    }
    for (const y of [0.7, tall - 0.7]) lk.add(mats.timber, B(leafW - 0.1, 0.22, 0.12), { p: [-side * leafW / 2, y, 0.12], uv: 1 });
    lk.add(mats.timber, B(Math.hypot(leafW - 0.3, tall - 1.6), 0.2, 0.1), { p: [-side * leafW / 2, tall / 2, 0.13], r: [0, 0, side * Math.atan2(tall - 1.6, leafW - 0.3)], uv: 1 });
    for (const y of [1.0, tall - 1.0]) lk.add(mats.iron, B(leafW * 0.7, 0.08, 0.03), { p: [-side * leafW * 0.35, y, -0.08] });
    lk.build(pivot);
    return pivot;
  };
  const left = makeLeaf(-1);
  const right = makeLeaf(1);
  // the hatch, at a man's eye height, in the left leaf: a little door with
  // a grille behind it, hinged on its left
  const hatch = new THREE.Group();
  hatch.name = 'hatch';
  hatch.position.set(leafW * 0.5 - 0.22, 1.85, -0.075);
  left.add(hatch);
  const hk = parts();
  hk.add(mats.timber, B(0.44, 0.38, 0.05), { p: [0.22, 0, 0], uv: 1.2 });
  hk.add(mats.iron, new THREE.TorusGeometry(0.03, 0.008, 4, 10), { p: [0.38, 0, -0.03] });
  hk.build(hatch);
  // the opening behind it, and Harry's face in it, lit by his lantern
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.36), new THREE.MeshBasicMaterial({ map: canvasTexture(hatchFaceCanvas(), K.renderer, { wrap: false }), color: hot(0xffffff, 1.1) }));
  hole.position.set(leafW * 0.5, 1.85, -0.07);
  hole.rotation.y = Math.PI;
  left.add(hole);

  let smashed = false;
  const open = (k) => {
    if (smashed) return;
    const a = (Math.PI / 2) * 0.92 * Math.max(0, Math.min(1, k));
    left.rotation.y = -a;
    right.rotation.y = a;
  };
  const peep = (k) => {
    hatch.rotation.y = 1.8 * Math.max(0, Math.min(1, k));
  };
  const smash = () => {
    smashed = true;
    left.rotation.set(0.08, -2.05, 0.22);
    left.position.y = -0.25;
    right.rotation.set(Math.PI / 2 - 0.1, 0.3, 0);
    right.position.set(w / 2 - 0.2, 0.15, 0.4);
  };
  return { group: g, leaves: [left, right], hatch, open, peep, smash, lamp: V3(0, 4.6, 0.6), hatchAt: V3(-w / 2 + leafW * 0.5, 1.85, -0.1) };
}

// ── the smaller places ──

// The gatekeeper's lodge: one stone room, a slate roof, a door to the road
// and a window on the gate.
function lodge(K, { w = 3.6, d = 3.6 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'lodge';
  const bk = parts();
  const h = 2.8;
  bk.add(mats.stone, B(w, h, d), { p: [0, h / 2, 0], uv: 0.45 });
  bk.add(mats.slate, roofGeo({ span: d + 0.7, len: w + 0.5, rise: 2.0, t: 0.16 }), { p: [0, h - 0.08, 0], r: [0, Math.PI / 2, 0] });
  const gRise = underRidge(d + 0.7, 2.0, 0.16, -0.08);
  for (const s of [-1, 1]) bk.add(mats.stone, gableGeo(d / 2, gRise, 0.2), { p: [s > 0 ? w / 2 - 0.2 : -w / 2, h, 0], r: [0, Math.PI / 2, 0], uv: 0.45 });
  bk.at([0, 0.05, d / 2], 0, () => {
    plankDoor(bk, K, { x: 0.5, w: 1.0, h: 2.2, paint: K.paint(0x4a3a2a) });
    squareWindow(bk, K, { x: -0.9, y: 1.5, w: 0.7, h: 0.8, nx: 2, ny: 2, sill: mats.dressed });
  });
  bk.at([-w / 2, 0.05, -d / 2], -Math.PI / 2, () => squareWindow(bk, K, { x: d / 2, y: 1.5, w: 0.8, h: 0.8, nx: 2, ny: 2, sill: mats.dressed }));
  bk.add(mats.stone, B(0.6, 2.4, 0.6), { p: [w / 2 - 0.5, h + 1.0, -0.6], uv: 0.45 });
  bk.at([-0.3, 0, d / 2 + 0.6], 0, () => benchParts(bk, K, 1.3));
  bk.build(g);
  return { group: g, chimneyTop: V3(w / 2 - 0.5, h + 2.3, -0.6), lamp: V3(0, 2.4, d / 2 + 0.3) };
}

// The Pony's stable: an open-fronted shed of planks under a thatch, three
// stalls with a manger and hay, a trough before it.
function stable(K, { w = 9, d = 4.5 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'stable';
  const bk = parts();
  const h = 3.0;
  bk.add(mats.barnwood, B(w, h, 0.16), { p: [0, h / 2, -d / 2 + 0.08], uv: 1 });
  for (const s of [-1, 1]) bk.add(mats.barnwood, B(0.16, h, d), { p: [s * (w / 2 - 0.08), h / 2, 0], uv: 1 });
  for (let i = 0; i <= 3; i++) {
    const x = -w / 2 + (w * i) / 3;
    bk.add(mats.timber, B(0.22, h + 0.2, 0.22), { p: [x, (h + 0.2) / 2, d / 2 - 0.12], uv: 1 });
    if (i > 0 && i < 3) bk.add(mats.barnwood, B(0.1, 1.5, d - 0.6), { p: [x, 0.75, -0.2], uv: 1 });
  }
  bk.add(mats.timber, B(w + 0.2, 0.26, 0.24), { p: [0, h + 0.1, d / 2 - 0.12], uv: 1 });
  bk.add(mats.thatch, roofGeo({ span: d + 1.2, len: w + 0.8, rise: 2.2, t: 0.32, thatch: true, seed: 9 }), { p: [0, h + 0.1, 0], r: [0, Math.PI / 2, 0] });
  bk.add(mats.thatch, cylX(0.18, w + 0.9, 10), { p: [0, h + 2.25, 0], uv: 1.3 });
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / 3;
    bk.add(mats.barnwood, B(1.4, 0.4, 0.5), { p: [x, 0.9, -d / 2 + 0.45], uv: 1 });
    bk.add(mats.sack, blob(0.42, { detail: 1, amp: 0.3, seed: 11 + i }), { p: [x - 0.9, 0.3, -d / 2 + 0.7], s: [1.4, 0.7, 1.0], uv: 1.5 });
  }
  bk.add(mats.barnwood, B(2.2, 0.55, 0.7), { p: [w / 2 - 1.6, 0.3, d / 2 + 0.7], uv: 1 });
  bk.build(g);
  return { group: g, stalls: [0, 1, 2].map((i) => V3(-w / 2 + (w * (i + 0.5)) / 3, 0, -0.2)) };
}

// The well on the market square: a round stone kerb, a little roof on two
// posts, the windlass and its bucket.
function well(K, { r: R = 1.0 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'well';
  const bk = parts();
  bk.add(mats.stone, lathe([[R - 0.22, 0], [R, 0], [R + 0.04, 0.82], [R - 0.04, 0.9], [R - 0.26, 0.9], [R - 0.22, 0.05]], 18), { uv: 0.8 });
  bk.add(mats.void, new THREE.CircleGeometry(R - 0.24, 18), { r: [-Math.PI / 2, 0, 0], p: [0, 0.4, 0] });
  for (const s of [-1, 1]) bk.add(mats.timber, B(0.16, 2.3, 0.16), { p: [s * (R - 0.05), 1.15, 0], uv: 1 });
  bk.add(mats.timber, cylX(0.09, R * 2 + 0.2, 8), { p: [0, 1.55, 0] });
  bk.add(mats.slate, roofGeo({ span: 1.7, len: R * 2 + 0.7, rise: 0.7, t: 0.1 }), { p: [0, 2.3, 0], r: [0, Math.PI / 2, 0] });
  bk.add(mats.rope, cyl(0.012, 0.012, 0.6, 4), { p: [0.15, 1.25, 0] });
  bk.add(mats.wood, lathe([[0.001, 0], [0.13, 0], [0.16, 0.25], [0.15, 0.27], [0.13, 0.03]], 10), { p: [0.15, 0.82, 0] });
  bk.add(mats.iron, new THREE.TorusGeometry(0.15, 0.008, 4, 12, Math.PI), { p: [0.15, 1.05, 0] });
  bk.build(g);
  return { group: g };
}

// A market stall, its front to +z: a trestle with crates of apples and
// cabbages, under a striped awning on four poles.
function stall(K, { w = 3.2, d = 1.8, cloth = 0xa8452e } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'stall';
  const bk = parts();
  bk.add(mats.wood, roundBox(w, 0.08, d * 0.7, 0.02), { p: [0, 0.9, 0.1], uv: 1.2 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    bk.add(mats.timber, B(0.1, sz > 0 ? 2.3 : 2.0, 0.1), { p: [(sx * (w - 0.1)) / 2, (sz > 0 ? 2.3 : 2.0) / 2, (sz * (d - 0.1)) / 2], uv: 1 });
    bk.add(mats.timber, B(0.08, 0.9, 0.08), { p: [sx * (w / 2 - 0.3), 0.45, sz * d * 0.25] });
  }
  // the awning, in stripes
  const stripes = 8;
  const c0 = new THREE.Color(cloth);
  const c1 = new THREE.Color(0xeae0c8);
  for (let i = 0; i < stripes; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / stripes;
    bk.add(mats.cloth, new THREE.PlaneGeometry(w / stripes + 0.01, d + 0.4), { p: [x, 2.18, 0], r: [-Math.PI / 2 + Math.atan2(0.3, d), 0, 0], color: i % 2 ? c1 : c0 });
    bk.add(mats.cloth, new THREE.PlaneGeometry(w / stripes + 0.01, 0.25), { p: [x, 2.22, d / 2 + 0.2], color: i % 2 ? c1 : c0 });
  }
  // crates of produce
  const r = rng(Math.round(cloth % 97));
  for (const [x, hue] of [[-w / 4, 0xb8282a], [w / 4, 0x6a9a3a], [0, 0xd08a2a]]) {
    bk.add(mats.wood, roundBox(0.7, 0.28, 0.5, 0.02), { p: [x, 1.08, 0.15], uv: 1.4 });
    for (let k = 0; k < 9; k++) bk.add(mats.food, ball(0.07, 7, 5), { p: [x - 0.24 + (k % 3) * 0.24, 1.26 + r() * 0.03, 0.0 + Math.floor(k / 3) * 0.15], color: hue });
  }
  bk.build(g);
  return { group: g };
}

// A stack of crates and a sack or two
function crates(K) {
  const { mats } = K;
  const g = new THREE.Group();
  const bk = parts();
  bk.add(mats.wood, roundBox(0.8, 0.6, 0.6, 0.03), { p: [0, 0.3, 0], uv: 1.4 });
  bk.add(mats.wood, roundBox(0.7, 0.55, 0.55, 0.03), { p: [0.1, 0.875, 0.02], r: [0, 0.3, 0], uv: 1.4 });
  bk.add(mats.wood, roundBox(0.6, 0.5, 0.5, 0.03), { p: [-0.7, 0.25, 0.2], r: [0, -0.4, 0], uv: 1.4 });
  bk.add(mats.sack, blob(0.26, { detail: 1, amp: 0.15, seed: 4 }), { p: [0.6, 0.3, 0.4], s: [1, 1.2, 0.85], uv: 1.5 });
  bk.build(g);
  return { group: g };
}
function barrels(K) {
  const g = new THREE.Group();
  const bk = parts();
  bk.at([0, 0, 0], 0, () => barrelParts(bk, K));
  bk.at([0.64, 0, 0.1], 0, () => barrelParts(bk, K));
  bk.at([0.32, 0.9, 0.05], 0.4, () => barrelParts(bk, K, { h: 0.8, r: 0.28 }));
  bk.build(g);
  return { group: g };
}

// ── who's about ──

// (The Nazgûl on foot are ../wraiths.js.)

// Bill the pony, facing +x: small, brown, a little thin, with his packs.
function billPony(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'bill';
  const coat = new THREE.Color(0x7a4e2c);
  const dark = new THREE.Color(0x3a2616);
  const bk = parts();
  const body = lathe([[0.001, -0.62], [0.16, -0.6], [0.26, -0.48], [0.31, -0.2], [0.31, 0.15], [0.29, 0.42], [0.18, 0.58], [0.001, 0.62]], 12);
  tf(body, { r: [0, 0, -Math.PI / 2], s: [1, 1, 0.82], p: [0, 0.9, 0] });
  fillColor(body, coat);
  bk.add(mats.beast, body);
  // the packs, either side, and a rolled blanket and a pan on top
  for (const s of [-1, 1]) bk.add(mats.sack, blob(0.2, { detail: 1, amp: 0.15, seed: 5 + s }), { p: [-0.05, 0.85, s * 0.3], s: [1.4, 1.1, 0.7], uv: 1.5 });
  bk.add(mats.cloth, cylZ(0.1, 0.6, 8), { p: [-0.15, 1.24, 0], color: 0x8a3a2a });
  bk.add(mats.iron, cyl(0.12, 0.1, 0.06, 10), { p: [0.15, 1.22, 0] });
  bk.build(g);
  const legs = [];
  for (const [x, z] of [[0.4, 0.13], [0.4, -0.13], [-0.42, 0.13], [-0.42, -0.13]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.82, z);
    g.add(hip);
    const lk = parts();
    lk.add(mats.beast, tube([[0, 0.05, 0], [x < 0 ? -0.05 : 0.02, -0.38, 0], [0.01, -0.74, 0]], 0.08, 0.04, { seg: 5, radial: 6 }), { color: coat });
    lk.add(mats.beast, cyl(0.05, 0.06, 0.08, 7), { p: [0.01, -0.78, 0], color: dark });
    lk.build(hip);
    legs.push(hip);
  }
  const neck = new THREE.Group();
  neck.position.set(0.5, 1.05, 0);
  g.add(neck);
  const nk = parts();
  nk.add(mats.beast, tube([[-0.05, -0.05, 0], [0.12, 0.25, 0], [0.22, 0.45, 0]], 0.17, 0.1, { seg: 5, radial: 7 }), { s: [1, 1, 0.75], color: coat });
  for (let i = 0; i < 6; i++) nk.add(mats.beast, new THREE.ConeGeometry(0.05, 0.22, 4), { p: [-0.06 + i * 0.05, 0.1 + i * 0.07, 0], r: [0, 0, 2.4], s: [1, 1, 0.4], color: dark });
  nk.build(neck);
  const head = new THREE.Group();
  head.position.set(0.24, 0.48, 0);
  neck.add(head);
  const hk = parts();
  hk.add(mats.beast, lathe([[0.001, 0], [0.09, 0.03], [0.1, 0.14], [0.08, 0.3], [0.06, 0.36], [0.001, 0.38]], 9), { s: [1, 1, 0.75], r: [0, 0, -2.3], color: coat });
  for (const s of [-1, 1]) {
    hk.add(mats.beast, new THREE.ConeGeometry(0.035, 0.12, 5), { p: [-0.03, 0.1, s * 0.05], r: [s * 0.3, 0, 0.3], color: coat });
    hk.add(mats.beast, ball(0.018, 6, 5), { p: [0.1, 0.02, s * 0.06], color: 0x111111 });
  }
  hk.build(head);
  const tail = new THREE.Group();
  tail.position.set(-0.62, 1.0, 0);
  g.add(tail);
  const tk = parts();
  tk.add(mats.beast, tube([[0, 0, 0], [-0.16, -0.12, 0], [-0.2, -0.5, 0]], 0.06, 0.02, { seg: 5, radial: 5 }), { color: dark });
  tk.build(tail);

  // How he moves (../../creatures.js): his legs from the ground he covers,
  // read from where the scene puts him, a pony's walk and a trot if he's
  // hurried; standing, his head drops to pick at the straw now and then, and
  // his tail swishes. `graze` (0…1) to say how much he's eating.
  const track = createTracker();
  const stride = createStride({ stride: 1.0, hz: 1.0, longest: 1.5, cadence: [1.2, 1.8], seed: 23 });
  const LEG = 0.8;
  const A = { graze: 0 };
  const animate = (t, { graze } = {}) => {
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const st = stride.step(m.dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const offs = gaitOffsets(st.run, WALK, TROT);
    const stance = mix(STANCE.walk, STANCE.trot, st.run);
    legs.forEach((hip, j) => {
      const { angle, lift } = legSwing(st.cycle + offs[j], stance, stance * st.stride, LEG);
      hip.rotation.z = angle * st.amount;
      hip.scale.y = 1 - 0.14 * lift * st.amount;
    });
    const eat = graze ?? (st.amount < 0.05 ? Math.max(0, Math.sin(t * 0.21 + 1)) : 0);
    A.graze = ease(A.graze, eat, m.dt, 1.5);
    const nod = Math.sin(st.phase * 2) * 0.05 * st.amount;
    neck.rotation.z = mix(-0.25 + Math.sin(t * 0.8) * 0.06 * (1 - st.amount) + nod, -0.85 + Math.sin(t * 2.2) * 0.05, A.graze);
    tail.rotation.y = Math.sin(t * 1.3) * 0.3 * (1 - st.amount * 0.6);
  };
  return { group: g, legs, neck, head, tail, animate };
}

// The people of Bree and the hobbits on the road, as toy figures; a
// carrot for the man with the carrot.
const BREE_LOOKS = {
  frodo: { ...LOOKS.frodo, pack: true },
  sam: { ...LOOKS.sam, pack: true },
  merry: LOOKS.merry,
  pippin: LOOKS.pippin,
  harry: { tall: 1.45, wide: 1.12, hair: 0x5a4a3a, beard: { color: 0x6a5a4a, len: 0.18 }, coat: 0x4a4636, shirt: 0xb8a888, cloak: 0x3a3a30, hat: 'hood', feet: 'boots', seed: 61 },
  butterbur: { tall: 1.38, wide: 1.5, hairStyle: 'bald', hair: 0x8a7a6a, coat: 0x8a5a3a, shirt: 0xf2e8d2, feet: 'boots', seed: 63 },
  strider: { tall: 1.58, wide: 1.05, hair: 0x2a1e14, hairStyle: 'long', beard: { color: 0x2a1e14, len: 0.12 }, coat: 0x3a3428, shirt: 0x5a5040, cloak: 0x2e3826, hat: 'hood', item: 'sword', feet: 'boots', seed: 65 },
  carrot: { tall: 1.42, wide: 1.1, hair: 0x6a4a2a, beard: { color: 0x5a3a20, len: 0.16 }, coat: 0x6a5a3a, shirt: 0xc8b890, feet: 'boots', seed: 67 },
  breelander: { tall: 1.4, robe: 0x7a4a4a, hairStyle: 'long', hair: 0x4a3020, shirt: 0xe8dcc0, seed: 69 },
  ferny: { tall: 1.43, wide: 0.95, skin: 0xd8b08a, hair: 0x2a2a20, hairStyle: 'long', beard: { color: 0x2a2a20, len: 0.1 }, coat: 0x3a3a2a, shirt: 0x7a7a5a, feet: 'boots', seed: 71 },
};
const FOLK = [0x5a4a6a, 0x6a3a2a, 0x3a5a4a, 0x7a6a3a, 0x4a4a5a, 0x8a5a3a];
const FOLK_HAIR = [0x3a2a1a, 0x6a4a2a, 0x8a7a6a, 0x2a1e14, 0xa08a6a];
// one of the Bree-landers: Big Folk, so long hair or none, and beards
const folkLook = (n) => ({
  tall: 1.35 + (n % 3) * 0.07,
  wide: 1 + (n % 2) * 0.25,
  hair: FOLK_HAIR[n % FOLK_HAIR.length],
  hairStyle: n % 4 === 1 ? 'bald' : 'long',
  coat: FOLK[n % FOLK.length],
  shirt: [0xd8ccb0, 0xb8a888, 0xe8dcc0][n % 3],
  beard: n % 3 !== 2 ? { color: FOLK_HAIR[(n + 1) % FOLK_HAIR.length], len: 0.14 + (n % 2) * 0.1 } : null,
  hat: n % 5 === 3 ? 'hood' : null,
  cloak: n % 5 === 3 ? FOLK[(n + 3) % FOLK.length] : null,
  feet: 'boots',
  seed: 80 + n,
  ...(n % 3 === 2 ? { robe: FOLK[(n + 2) % FOLK.length], beard: null } : {}),
});
export function makeFolk(id, { n = 0, look: over = null } = {}) {
  const look = over ?? BREE_LOOKS[id] ?? folkLook(n);
  const f = makeToyFigure(look);
  // a Ranger's or a Bree-lander's cloak has no elven brooch
  if (look.cloak) {
    const brooch = [];
    f.group.traverse((o) => {
      if (o.isMesh && o.material.isMeshBasicMaterial && o.geometry.parameters?.radius === 0.035) brooch.push(o);
    });
    for (const o of brooch) o.removeFromParent();
  }
  compact(f.group);
  f.group.name = id;
  f.top = f.baseY + 0.5 * (look.tall ?? 1) + 0.62;
  if (id === 'carrot') {
    const hand = f.arms[1];
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xe0782a, roughness: 0.6 }));
    c.position.set(0.06, -0.4, 0);
    c.rotation.z = Math.PI;
    // (held by its green end, the point out past the fingers: lib/three/held.js)
    c.userData.held = { kind: 'carrot' };
    const grip = new THREE.Object3D();
    grip.name = 'grip';
    grip.position.y = -0.07;
    c.add(grip);
    hand.add(c);
    f.carrot = c;
  }
  if (look.ring) {
    f.group.traverse((o) => {
      if (o.isMesh && o.geometry.type === 'TorusGeometry') f.ringMesh = o;
    });
  }
  // on the cast once its model's here (../../cast3d.js): whoever plays them,
  // a Bree-lander for the folk; the carrot to the cast's hand
  castFigure(f, id, look, { role: id === 'folk' ? 'folk' : 'cast', town: 'bree' });
  if (f.carrot) f.cast?.hold(f.carrot);
  return f;
}

// ── the kit ──

export function createBreeKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  // Bree on a wet night: darker oak, greyer plaster, wet slate, rain-dark thatch
  mats.timber.color.set(0x3a2818);
  mats.plaster.color.set(0xd2c4a6);
  mats.slate.color.set(0x8a92a0);
  mats.slate.roughness = 0.5;
  mats.thatch.color.set(0x8c7c5c);
  mats.stone.color.set(0xb8b0a4);
  mats.ashlar.color.set(0xc8beae);
  mats.trunk.color.set(0x8a7a66);
  mats.barnwood.color.set(0x6a5644);
  mats.window.emissive = hot(0xffa448, 2.8);
  return {
    ...kit,
    house: (o) => house(K, o),
    pony: () => pony(K),
    stockade: (segs, height, o) => stockade(K, segs, height, o),
    gate: (o) => gate(K, o),
    lodge: () => lodge(K),
    stable: () => stable(K),
    well: () => well(K),
    stall: (o) => stall(K, o),
    crates: () => crates(K),
    barrels: () => barrels(K),
    billPony: () => billPony(K),
  };
}
