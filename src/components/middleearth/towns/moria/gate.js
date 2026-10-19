// The West-gate (the Doors of Durin in ithildin on their cliff, the holly
// trees either side) and the Watcher’s arms. Moved out of props.js as they
// were; the ithildin’s glow and the ripples are the kit’s materials.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, paintPixels, smooth } from '../../../../lib/paint';
import { B, lathe, parts, rng, roundBox, tf, tube } from '../../shire/build';
import { ease } from '../../creatures';
import { _kc, _kd, along, chunkGeo, ext, lump, noise3, passageGeo, planarUV, rockTone, shapeOf, splitFaces, sweep3, TAU, tint, V3 } from './helpers';

// The lines of the Doors of Durin, in ithildin: white on black, for the
// doors' glow. The drawing covers the dressed face the doors are set in,
// 7 m wide and 10 m tall, the doors' foot at the middle of its bottom edge.
// Two pillars, each with a tree of the High-elves growing up it, under an
// arch lettered in the elves' script; the trees' boughs over the arch,
// crescent moons in them; within the arch the crown of Durin under seven
// stars, and his hammer and anvil; on the doors, the star of the house of
// Fëanor. A soft bloom round every line, for screens without bloom.
export const GATE = { w: 7, h: 10, a: 1.8, hs: 3.2, pillar: [2.0, 2.8], cap: 5.6, spring: 6.1 };
export function ithildinCanvas() {
  const k = 80;
  const W = GATE.w * k;
  const H = GATE.h * k;
  const lines = makeCanvas(W, H);
  const g = lines.getContext('2d');
  const X = (x) => (x + GATE.w / 2) * k;
  const Y = (y) => (GATE.h - y) * k;
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const lw = (m) => {
    g.lineWidth = m * k;
  };
  const path = (pts, close = false) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    if (close) g.closePath();
    g.stroke();
  };
  const arc = (cx, cy, r, a0, a1) => {
    g.beginPath();
    g.arc(X(cx), Y(cy), r * k, -a0, -a1, a1 > a0);
    g.stroke();
  };
  const curve = (pts) => {
    // a smooth line through points
    const cr = new THREE.CatmullRomCurve3(pts.map(([x, y]) => V3(x, y, 0)));
    path(cr.getPoints(pts.length * 10).map((p) => [p.x, p.y]));
  };
  const leaf = (x, y, ang, len, wid) => {
    g.save();
    g.translate(X(x), Y(y));
    g.rotate(-ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * k * 0.5, -wid * k, len * k, 0);
    g.quadraticCurveTo(len * k * 0.5, wid * k, 0, 0);
    g.stroke();
    g.restore();
  };
  const crescent = (x, y, r, ang) => {
    // a crescent moon, its horns turned towards `ang`
    g.save();
    g.translate(X(x), Y(y));
    g.rotate(-ang);
    g.beginPath();
    g.arc(0, 0, r * k, Math.PI * 0.32, Math.PI * 1.68, false);
    g.arc(r * k * 0.42, 0, r * k * 0.78, Math.PI * 1.55, Math.PI * 0.45, true);
    g.closePath();
    g.stroke();
    g.restore();
  };
  const star = (x, y, r, rays, inner = 0.35) => {
    g.beginPath();
    for (let i = 0; i <= rays * 2; i++) {
      const a = (i / (rays * 2)) * TAU + Math.PI / 2;
      const rr = i % 2 ? r * inner : r;
      const px = X(x + Math.cos(a) * rr);
      const py = Y(y + Math.sin(a) * rr);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.stroke();
  };
  const { a, hs, pillar, cap, spring } = GATE;

  // the doors' edge, just inside the stone
  lw(0.035);
  const da = a - 0.08;
  path([[-da, 0.05], [-da, hs]]);
  arc(0, hs, da, Math.PI, 0);
  path([[da, hs], [da, 0.05]]);
  lw(0.022);
  arc(0, hs, da - 0.12, Math.PI * 0.92, Math.PI * 0.08);

  // the pillars: base, shaft, capital; a tree up each
  const pc = (pillar[0] + pillar[1]) / 2;
  for (const s of [-1, 1]) {
    lw(0.035);
    const x0 = s * pillar[0];
    const x1 = s * pillar[1];
    path([[x0, 0.45], [x0, cap], [x1, cap], [x1, 0.45]]);
    path([[x0 - s * 0.1, 0.0], [x0 - s * 0.1, 0.45], [x1 + s * 0.1, 0.45], [x1 + s * 0.1, 0.0]]);
    path([[x0 - s * 0.15, cap], [x0 - s * 0.15, spring], [x1 + s * 0.15, spring], [x1 + s * 0.15, cap]], true);
    lw(0.02);
    path([[x0 - s * 0.15, cap + 0.17], [x1 + s * 0.15, cap + 0.17]]);
    crescent(s * pc, cap + 0.34, 0.11, Math.PI / 2);
    // the tree: a trunk winding up the shaft, its roots at the foot
    lw(0.028);
    for (const e of [-1, 1]) {
      const pts = [];
      for (let y = 0.5; y <= cap - 0.05; y += 0.25) pts.push([s * pc + e * 0.07 + Math.sin(y * 2.3 + e) * 0.06, y]);
      curve(pts);
    }
    for (const r of [-1, 0, 1]) curve([[s * pc + r * 0.06, 0.55], [s * pc + r * 0.18, 0.42], [s * pc + r * 0.28, 0.5]]);
    for (let y = 1.0; y < cap - 0.3; y += 0.55) {
      const x = s * pc + Math.sin(y * 2.3) * 0.06;
      leaf(x, y, Math.PI / 2 - 0.7, 0.22, 0.05);
      leaf(x, y + 0.2, Math.PI / 2 + 0.7, 0.22, 0.05);
    }
  }

  // the arch, lettered between two lines
  const R0 = pillar[0];
  const R1 = pillar[1];
  lw(0.035);
  arc(0, spring, R0, 0, Math.PI);
  arc(0, spring, R1, 0, Math.PI);
  lw(0.018);
  arc(0, spring, (R0 + R1) / 2, 0.06, Math.PI - 0.06);
  // the inscription, two lines in the elves' letters, round the arch
  const r = rng(808);
  for (const [rr, hh] of [[(R0 + R1) / 2 + 0.2, 0.26], [(R0 + R1) / 2 - 0.19, 0.24]]) {
    const span = Math.PI * 0.9;
    const count = Math.floor((span * rr) / (hh * 0.62));
    for (let i = 0; i < count; i++) {
      const ang = Math.PI - (Math.PI - span) / 2 - ((i + 0.5) / count) * span;
      if (r() < 0.12) continue; // a space between words
      g.save();
      g.translate(X(Math.cos(ang) * rr), Y(spring + Math.sin(ang) * rr));
      g.rotate(-(ang - Math.PI / 2));
      tengwa(g, r, hh * k);
      g.restore();
    }
  }

  // the boughs: from each capital over the arch and up the face, each
  // ending in a crescent moon, leaves along them
  lw(0.026);
  for (const s of [-1, 1]) {
    const bough = (pts, moon) => {
      curve(pts.map(([x, y]) => [s * x, y]));
      const [mx, my] = pts[pts.length - 1];
      crescent(s * mx, my + 0.16, 0.14, Math.PI / 2 - s * 0.4);
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, y] = pts[i];
        leaf(s * x, y, Math.PI / 2 + s * 0.9, 0.2, 0.045);
        leaf(s * x, y, Math.PI / 2 - s * 0.2, 0.18, 0.04);
      }
      return moon;
    };
    bough([[pc, spring], [2.95, 7.0], [2.75, 8.2], [2.0, 9.0], [1.15, 9.45]]);
    bough([[pc + 0.25, spring], [3.25, 7.2], [3.25, 8.6], [2.95, 9.4]]);
    bough([[pc - 0.1, spring + 0.1], [2.4, 8.1], [1.6, 8.75], [0.55, 9.05]]);
  }

  // within the arch: the anvil and hammer, the crown, the seven stars
  lw(0.026);
  path([[-0.42, 5.62], [0.28, 5.62], [0.5, 5.55], [0.28, 5.5], [0.14, 5.42], [0.14, 5.3], [0.26, 5.22], [-0.26, 5.22], [-0.14, 5.3], [-0.14, 5.42], [-0.3, 5.5], [-0.42, 5.62]]);
  path([[0.36, 5.72], [-0.08, 5.98]]);
  path([[-0.2, 5.84], [-0.04, 6.1], [0.04, 6.05], [-0.12, 5.79]], true);
  path([[-0.44, 6.2], [0.44, 6.2]]);
  path([[-0.44, 6.32], [0.44, 6.32]]);
  path([[-0.44, 6.32], [-0.38, 6.62], [-0.2, 6.42], [0, 6.72], [0.2, 6.42], [0.38, 6.62], [0.44, 6.32]]);
  for (const [x, y] of [[-0.38, 6.66], [0, 6.77], [0.38, 6.66]]) {
    g.beginPath();
    g.arc(X(x), Y(y), 0.035 * k, 0, TAU);
    g.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const ang = Math.PI * (0.16 + (i / 6) * 0.68);
    star(Math.cos(ang) * 1.18, 6.3 + Math.sin(ang) * 1.18, 0.1, 6, 0.38);
  }

  // the star on the doors: eight long rays and eight short, round a ring
  const sy = 2.75;
  lw(0.026);
  star(0, sy, 0.78, 8, 0.24);
  lw(0.02);
  star(0, sy, 0.46, 8, 0.4);
  arc(0, sy, 0.15, 0, TAU);
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * TAU + Math.PI / 2;
    const rr = i % 2 ? 0.46 : 0.78;
    path([[Math.cos(ang) * 0.15, sy + Math.sin(ang) * 0.15], [Math.cos(ang) * rr * 0.9, sy + Math.sin(ang) * rr * 0.9]]);
  }

  // the bloom
  const out = makeCanvas(W, H);
  const o = out.getContext('2d');
  o.fillStyle = '#000';
  o.fillRect(0, 0, W, H);
  o.filter = 'blur(6px)';
  o.globalAlpha = 0.22;
  o.drawImage(lines, 0, 0);
  o.filter = 'blur(1.5px)';
  o.globalAlpha = 0.5;
  o.drawImage(lines, 0, 0);
  o.filter = 'none';
  o.globalAlpha = 1;
  o.drawImage(lines, 0, 0);
  return out;
}

// One letter of the elves' script, `h` px tall, centred on the origin (y
// down): a stem rising or falling, one or two bows on it, now and then a
// mark above.
export function tengwa(g, r, h) {
  const w = h * 0.5;
  const kind = Math.floor(r() * 3);
  const top = kind === 1 ? -h * 0.55 : -h * 0.2;
  const bot = kind === 2 ? h * 0.55 : h * 0.2;
  const x0 = -w * 0.45;
  g.beginPath();
  g.moveTo(x0, top);
  g.lineTo(x0, bot);
  g.stroke();
  const bows = r() < 0.35 ? 2 : 1;
  for (let i = 0; i < bows; i++) {
    const bx = x0 + i * w * 0.42;
    g.beginPath();
    g.moveTo(bx, -h * 0.2);
    g.bezierCurveTo(bx + w * 0.55, -h * 0.24, bx + w * 0.55, h * 0.22, bx, h * 0.18);
    g.stroke();
  }
  if (r() < 0.5) {
    g.beginPath();
    if (r() < 0.5) g.arc(x0 + w * 0.3, -h * 0.42, h * 0.04, 0, TAU);
    else {
      g.moveTo(x0 + w * 0.1, -h * 0.36);
      g.lineTo(x0 + w * 0.45, -h * 0.5);
    }
    g.stroke();
  }
}

// ── the West-gate ──

// A holly tree, `h` tall: a grey trunk forking into boughs, and a dense
// crown, broad below and narrowing up, of glossy spined leaves (cards of
// sprigs over dark clumps). Added to `bk` at (x, z).
export function hollyParts(bk, K, x, z, h, seed) {
  const { mats } = K;
  const r = rng(seed);
  const n = makeNoise(seed);
  bk.at([x, 0, z], r() * TAU, () => {
    const lean = (r() - 0.5) * 0.3;
    const top = V3(lean * h * 0.12, h * 0.7, (r() - 0.5) * 0.3);
    bk.add(mats.hollyBark, tube([[0, -0.2, 0], [lean * 0.4, h * 0.3, 0.05], top.toArray()], 0.26, 0.1, { seg: 8, radial: 8, gnarl: 0.18, seed }), { uv: 1.2 });
    const clumps = [];
    const N = 22;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const y = h * mix(0.2, 0.97, Math.pow(t, 0.85));
      // broad low down, to a point at the top
      const rad = h * 0.27 * Math.pow(1 - t, 0.7) * (0.7 + r() * 0.45) + 0.2;
      const a = i * 2.4 + r() * 0.8;
      const c = V3(Math.cos(a) * rad * 0.7 + top.x * (y / h), y, Math.sin(a) * rad * 0.7 + top.z * (y / h));
      clumps.push({ c, rr: h * 0.1 * (1.2 - t * 0.55) + r() * 0.25 });
      const from = V3(top.x * (y / h) * 0.6, Math.min(y - 0.5, h * 0.68), 0);
      bk.add(mats.hollyBark, tube([from.toArray(), from.clone().lerp(c, 0.5).add(V3(0, 0.2, 0)).toArray(), c.toArray()], 0.06, 0.025, { seg: 4, radial: 5 }), { uv: 2 });
    }
    for (const { c, rr } of clumps) bk.add(mats.hollyDark, lump(rr * 0.72, { p: c.toArray(), s: [1, 0.85, 1] }, { detail: 1, amp: 0.25, seed: seed + c.y }));
    // the sprigs, facing out, each lit half as the crown's round mass and
    // half as itself, so the crown reads as one and still glints
    const mid = V3(top.x, h * 0.55, top.z);
    const nrm = V3();
    for (const { c, rr } of clumps) {
      const cards = 52;
      for (let i = 0; i < cards; i++) {
        const d = V3(r() - 0.5, r() - 0.3, r() - 0.5).normalize();
        const at = c.clone().addScaledVector(d, rr * (0.7 + r() * 0.4));
        const s = 0.36 + r() * 0.22;
        const card = new THREE.PlaneGeometry(s, s);
        card.lookAt(d.clone().add(V3((r() - 0.5) * 1.2, (r() - 0.2) * 1.2, (r() - 0.5) * 1.2)));
        card.rotateZ(r() * TAU);
        const own = V3().fromBufferAttribute(card.attributes.normal, 0);
        card.translate(at.x, at.y, at.z);
        const out = at.clone().sub(mid).normalize();
        nrm.copy(out).multiplyScalar(0.6).addScaledVector(own, 0.4).normalize();
        const nr = card.attributes.normal;
        for (let k = 0; k < nr.count; k++) nr.setXYZ(k, nrm.x, nrm.y, nrm.z);
        const tone = 0.8 + n(at.x * 2, at.y * 2 + at.z) * 0.4;
        bk.add(mats.holly, card, { color: _kc.setRGB(tone, tone * (0.96 + r() * 0.08), tone * 0.94).clone() });
      }
    }
  });
}

// The Doors of Durin in the cliff at the West-gate, at night. The cliff is
// 40 m across and 25 m high, its face on z = 0 looking to +z, falling back at
// its ends and along its top; the doors are 3.6 m wide and 5 m tall in a
// dressed face 7 m wide, between two carved pillars under an arch, and they
// swing inwards (each leaf hinged at its outer edge) on a dark passage. The
// ithildin glows when the moon finds it: setIthildin(k), 0..1. Two holly
// trees stand at the cliff's foot, either side. doorCentre is the middle of
// the doors' face.
export function westGate(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'westGate';
  const bk = parts();
  const n = makeNoise(41);
  const r = rng(43);
  const HW = GATE.w / 2;
  const PH = GATE.h;
  const away = (x, y) => Math.hypot(Math.max(0, Math.abs(x) - HW), Math.max(0, y - PH));
  // how far the face stands out from z = 0 at (x, y): great slow bulges,
  // buttresses of rock running up it split by deep fissures, ledges where
  // the beds lie, and a rough skin; flat round the doors, leaning back above
  // them, and falling away at the ends
  const reliefAt = (x, y) => {
    const q = fbm(n, x * 0.26 + 9, y * 0.03 + 2, { octaves: 3 });
    const fin = 1 - Math.abs(q * 2 - 1);
    const fissure = smooth(0.12, 0.0, Math.abs(q - 0.5)) * 1.1;
    const s = y * 0.4 + fbm(n, x * 0.07, y * 0.07, { octaves: 2 }) * 3;
    const ledge = smooth(0.72, 0.96, s - Math.floor(s)) * 0.45;
    const fine = (fbm(n, x * 0.8, y * 0.8, { octaves: 3 }) - 0.5) * 0.4;
    return fin * fin * 1.8 - fissure + ledge + fine;
  };
  const faceZ = (x, y) => {
    const f = smooth(0, 3.5, away(x, y));
    const big = (fbm(n, x * 0.04 + 3, y * 0.045, { octaves: 4 }) - 0.5) * 4.5;
    let z = f * (big + reliefAt(x, y));
    z -= Math.max(0, y - PH) * 0.06;
    const end = Math.max(0, Math.abs(x) - 12.5) / 7.5;
    z -= end * end * 7;
    return z;
  };
  const topAt = (x) => 24 + fbm(n, x * 0.09 + 50, 3.3, { octaves: 4 }) * 3 + (n(x * 0.6, 8.1) - 0.5) * 0.8 - Math.max(0, Math.abs(x) - 14) * 0.5;

  // ── the cliff: a grid half a metre square, its cells over the dressed
  // face left out, and its top falling back into the mountain
  const NX = 80;
  const NY = 48;
  const BACK = [[1.6, 0.5], [3.6, 0.9], [6.5, 0.7], [10, 0.2]];
  const rows = NY + 1 + BACK.length;
  const pos = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i <= NX; i++) {
      const x = -20 + (40 * i) / NX;
      let y;
      let z;
      if (j < NY) {
        y = j * 0.5;
        z = faceZ(x, y);
      } else if (j === NY) {
        y = topAt(x);
        z = faceZ(x, y);
      } else {
        const [dz, dy] = BACK[j - NY - 1];
        y = topAt(x) + dy + (n(x * 0.4, j) - 0.5) * 0.6;
        z = faceZ(x, topAt(x)) - dz;
      }
      pos.push(x + (j > NY ? (n(x, j * 3) - 0.5) * 0.3 : 0), y, z);
    }
  }
  const idx = [];
  const W1 = NX + 1;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < NX; i++) {
      const x = -20 + (40 * (i + 0.5)) / NX;
      const y = (j + 0.5) * 0.5;
      if (j < NY && Math.abs(x) < HW && y < PH) continue;
      const a = j * W1 + i;
      idx.push(a, a + 1, a + W1, a + 1, a + W1 + 1, a + W1);
    }
  }
  const cliff = new THREE.BufferGeometry();
  cliff.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cliff.setIndex(idx);
  cliff.computeVertexNormals();
  planarUV(cliff, 0, 0, 4, 4);
  tint(cliff, (x, y, z, out, nx, ny, nz) => {
    const f = smooth(0, 3.5, away(x, y));
    rockTone(n, x, y, z, { x: nx, y: ny, z: nz }, out, 1 - f, f * (reliefAt(x, y) - 0.6 + (fbm(n, x * 0.04 + 3, y * 0.045, { octaves: 4 }) - 0.5) * 1.2) * 0.5);
  });
  bk.add(mats.cliff, cliff);

  // ── the dressed face, in one piece with the doorway cut from its foot
  const { a, hs } = GATE;
  const opening = [[-a, 0], [-a, hs]];
  for (let i = 1; i < 24; i++) {
    const t = Math.PI - (i / 24) * Math.PI;
    opening.push([Math.cos(t) * a, hs + Math.sin(t) * a]);
  }
  opening.push([a, hs], [a, 0]);
  const face = new THREE.ShapeGeometry(shapeOf([[-HW, 0], ...opening, [HW, 0], [HW, PH], [-HW, PH]]), 24);
  planarUV(face, -HW, 0, GATE.w, PH);
  tint(face, (x, y, z, out) => rockTone(n, x, y, 0, { x: 0, y: 0, z: 1 }, out, 1));
  bk.add(mats.ithildin, face);

  // the pillars and the arch in low relief, the ithildin running over them
  const relief = (geo) => {
    planarUV(geo, -HW, 0, GATE.w, PH);
    tint(geo, (x, y, z, out) => rockTone(n, x, y, 0, { x: 0, y: 0, z: 1 }, out, 1));
    const [front, sides] = splitFaces(geo, (nr) => nr.z > 0.7);
    bk.add(mats.ithildin, front);
    bk.add(mats.gateStone, sides);
  };
  const [p0, p1] = GATE.pillar;
  for (const s of [-1, 1]) {
    const pc = (s * (p0 + p1)) / 2;
    relief(tf(B(p1 - p0, GATE.cap - 0.45, 0.12), { p: [pc, (GATE.cap + 0.45) / 2, 0.06] }));
    relief(tf(B(p1 - p0 + 0.2, 0.45, 0.2), { p: [pc, 0.225, 0.1] }));
    relief(tf(B(p1 - p0 + 0.3, GATE.spring - GATE.cap, 0.22), { p: [pc, (GATE.cap + GATE.spring) / 2, 0.11] }));
  }
  const archRing = new THREE.Shape();
  archRing.absarc(0, 0, p1, 0, Math.PI, false);
  archRing.absarc(0, 0, p0, Math.PI, 0, true);
  relief(tf(ext(archRing, 0.14), { p: [0, GATE.spring, 0] }));

  // a worn threshold before the doors, and the passage behind them going
  // into the dark
  bk.add(mats.gateStone, roundBox(GATE.w + 0.8, 0.14, 1.5, 0.04), { p: [0, 0.03, 0.72], uv: 0.5 });
  bk.add(mats.gateStone, roundBox(2 * a + 0.4, 0.1, 0.5, 0.03), { p: [0, 0.05, -0.1], uv: 0.5 });
  const DEEP = 14;
  bk.add(mats.deep, passageGeo(opening, -0.35, DEEP));
  bk.add(mats.void, new THREE.PlaneGeometry(2 * a, hs + a), { p: [0, (hs + a) / 2, -0.35 - DEEP] });

  // scree and fallen boulders along the cliff's foot, clear of the doors
  for (let i = 0; i < 26; i++) {
    let x = -19 + r() * 38;
    if (Math.abs(x) < HW + 1.2) x = Math.sign(x || 1) * (HW + 1.2 + r() * 3);
    const s = 0.25 + Math.pow(r(), 2) * 1.2;
    const geo = chunkGeo(500 + i, s, 0.55 + r() * 0.3);
    tf(geo, { p: [x, s * 0.2, faceZ(x, 0.5) + 0.3 + r() * 1.6], r: [r(), r() * TAU, r() * 0.5] });
    tint(geo, (px, py, pz, out, nx, ny, nz) => rockTone(n, px, py + 4, pz, { x: nx, y: ny, z: nz }, out, 0));
    bk.add(mats.cliff, geo, { uv: 0.4 });
  }

  // the holly trees
  hollyParts(bk, K, -6.4, 2.8, 9, 3);
  hollyParts(bk, K, 6.6, 3.0, 8.4, 8);
  bk.build(g);

  // ── the doors: each leaf in its own group at its hinge
  const leaves = [-1, 1].map((s) => {
    const pts = [[0, 0], [s * a, 0], [s * a, hs]];
    for (let i = 1; i <= 12; i++) {
      const t = s > 0 ? (i / 12) * (Math.PI / 2) : Math.PI - (i / 12) * (Math.PI / 2);
      pts.push([Math.cos(t) * a, hs + Math.sin(t) * a]);
    }
    if (s < 0) pts.reverse();
    const geo = ext(shapeOf(s < 0 ? [[0, 0], ...pts.filter((p) => !(p[0] === 0 && p[1] === 0))] : pts), 0.3);
    geo.translate(-s * 0.005, 0, -0.34);
    planarUV(geo, -HW, 0, GATE.w, PH);
    tint(geo, (x, y, z, out) => rockTone(n, x, y, 0, { x: 0, y: 0, z: 1 }, out, 1));
    const hinge = V3(s * a, 0, -0.19);
    geo.translate(-hinge.x, 0, -hinge.z);
    const leaf = new THREE.Group();
    leaf.name = s < 0 ? 'doorL' : 'doorR';
    leaf.position.copy(hinge);
    g.add(leaf);
    const lk = parts();
    const [front, rest] = splitFaces(geo, (nr) => nr.z > 0.7);
    lk.add(mats.ithildin, front);
    lk.add(mats.gateStone, rest);
    lk.build(leaf);
    return { leaf, s };
  });

  const open = (k) => {
    const t = clamp01(k);
    for (const { leaf, s } of leaves) leaf.rotation.y = -s * t * 1.62;
  };
  const setIthildin = (k) => {
    K.U.uIthil.value = clamp01(k);
  };
  open(0);
  return { group: g, doorCentre: V3(0, 2.5, -0.04), open, setIthildin, leaves: leaves.map((l) => l.leaf) };
}

// ── the Watcher in the Water ──

// The skin of the Watcher's arms, for the normal map: fine wrinkles
// ringing them, wandering, and warty bumps between. u runs round the arm,
// v along it.
export function tentacleCanvas(S = 256) {
  const n = makeNoise(61);
  const cells = makeCells(67);
  const field = new Float32Array(S * S);
  paintPixels(makeCanvas(S), (u, v, out, px, py) => {
    const w = fbm(n, u * 4, v * 4, { period: 4, octaves: 3 });
    const ring = Math.pow(0.5 + 0.5 * Math.sin((v * 18 + w * 2.5) * TAU), 3);
    const k = cells(u * 10, v * 10, 10);
    const wart = (1 - smooth(0.05, 0.32, k.f1)) * (k.id > 0.4 ? 1 : 0.3);
    field[py * S + px] = clamp01(0.5 + wart * 0.35 - ring * 0.3 + (n(u * 64, v * 64, 64) - 0.5) * 0.1);
    out[0] = out[1] = out[2] = 128;
  });
  return field;
}

// An arm of the Watcher, about 9.5 m from the root, rising out of the pool
// (y = 0 is the water's surface; the root is 2.5 m under it): thick and
// tapering to a whip of a tip, dark green-grey and wet, paler underneath
// where two rows of suckers run up it. A chain of bones bends it.
// update(t, k, strike): k (0..1) how far it has risen, curled and swaying
// when up; strike (0..1) brings it over and down along +x, to lie flat on
// the bank beyond the water, about 0.25 m up: rolling out from the root to
// the tip like a whip, the tip last. Its rising and sinking are eased, so
// it never jumps from one height to another.
export function tentacle(K, seed = 1) {
  const { mats } = K;
  const r = rng(seed * 13 + 3);
  const n = makeNoise(seed * 7 + 1);
  const L = 9.6 + r() * 1.4;
  const NB = 22;
  const SEG = L / (NB - 1);
  const DEPTH = 2.5;
  const radius = (s) => 0.03 + 0.64 * Math.pow(1 - s, 1.35) * (1 + 0.04 * Math.sin(s * 38));
  const g = new THREE.Group();
  g.name = 'tentacle';

  // the arm, straight up its local y, the sucker side to +x
  const ys = [];
  const rad = [];
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    ys.push([0, s * L, 0]);
    rad.push([radius(s) * 0.8, radius(s), radius(s) * 1.04]);
  }
  const arm = sweep3(ys, rad, { seg: 70, radial: 14, side: [0, 0, 1], sq: 2, caps: [true, true] });
  tint(arm, (x, y, z, out, nx) => {
    const s = y / L;
    const under = smooth(-0.1, 0.8, nx);
    const mottle = noise3(n, x * 3, y * 1.5, z * 3);
    const blotch = smooth(0.45, 0.62, noise3(n, x * 1.2 + 4, y * 0.7, z * 1.2));
    out.setRGB(0.075, 0.1, 0.075).multiplyScalar(0.6 + mottle * 0.8).lerp(_kd.setRGB(0.03, 0.04, 0.035), blotch * 0.6);
    out.lerp(_kd.setRGB(0.4, 0.36, 0.29), under * 0.85);
    out.lerp(_kd.setRGB(0.26, 0.27, 0.2), smooth(0.8, 1, s) * 0.4);
  });
  const geos = [arm];
  // the suckers: two staggered rows, big near the root and small to the tip
  const cup = (rs) => lathe([[0.001, -0.1 * rs], [0.5 * rs, -0.06 * rs], [0.7 * rs, 0.3 * rs], [1.0 * rs, 0.2 * rs], [1.04 * rs, -0.3 * rs]], 7);
  let sAt = 0.1;
  let row = 0;
  while (sAt < 0.92) {
    const rr = radius(sAt);
    const rs = rr * 0.34;
    const side = row % 2 ? 1 : -1;
    const ang = side * 0.42;
    const nrm = V3(Math.cos(ang) * 0.8, 0, Math.sin(ang)).normalize();
    const at = V3(nrm.x * rr * 0.86, sAt * L, nrm.z * rr * 1.0);
    const c = cup(rs);
    tint(c, (x, y, z, out) => {
      const d = Math.hypot(x, z) / rs;
      out.setRGB(0.5, 0.45, 0.4).lerp(_kd.setRGB(0.16, 0.12, 0.12), 1 - smooth(0.35, 0.6, d));
    });
    geos.push(along(c, nrm, at));
    sAt += (rs * 1.9) / L;
    row++;
  }
  const geo = mergeGeometries(geos.map((x) => {
    const y = x.index ? x.toNonIndexed() : x;
    if (!y.attributes.uv) y.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(y.attributes.position.count * 2), 2));
    return y;
  }));
  // each point bound to the two bones either side of it
  const P = geo.attributes.position;
  const si = new Uint16Array(P.count * 4);
  const sw = new Float32Array(P.count * 4);
  for (let i = 0; i < P.count; i++) {
    const f = clamp01(P.getY(i) / L) * (NB - 1) - 1e-4;
    const b = Math.max(0, Math.floor(f));
    const w = f - b;
    si[i * 4] = b;
    si[i * 4 + 1] = Math.min(NB - 1, b + 1);
    sw[i * 4] = 1 - w;
    sw[i * 4 + 1] = w;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const mesh = new THREE.SkinnedMesh(geo, mats.tentacle);
  mesh.name = 'arm';
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const bones = [];
  for (let i = 0; i < NB; i++) {
    const b = new THREE.Bone();
    b.position.y = i ? SEG : 0;
    if (i) bones[i - 1].add(b);
    bones.push(b);
  }
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  const rise = new THREE.Group();
  rise.name = 'rise';
  rise.add(mesh);
  g.add(rise);

  // rings spreading on the water where it comes up
  const ripple = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), K.mats.ripple.clone());
  ripple.position.y = 0.03;
  ripple.renderOrder = 2;
  g.add(ripple);

  // the strike: how the arm lies when slammed down (its direction at each
  // bone, from straight up, negative towards +x), and how high its root
  // must be for the flat of it to lie on the bank
  const strikeDir = (s) => {
    const l = s * L;
    if (l < 2.0) return mix(0, -0.55, l / 2.0);
    if (l < 4.0) return mix(-0.55, -2.35, smooth(0, 1, (l - 2.0) / 2.0));
    if (l < 5.4) return mix(-2.35, -1.57, smooth(0, 1, (l - 4.0) / 1.4));
    return -1.57 + smooth(0.85, 1, s) * 0.6;
  };
  let low = 0;
  {
    let y = 0;
    for (let i = 1; i < NB; i++) {
      y += SEG * Math.cos(strikeDir((i - 1) / (NB - 1)));
      if ((i * SEG) > 5.6 && (i * SEG) < L * 0.85) low = Math.max(low, y);
    }
  }
  const strikeRoot = 0.25 - low;
  const ph = r() * TAU;
  const curl = 3.3 + r() * 0.8;
  const lean = -0.25 - r() * 0.3;
  const E = { t: null, e: 0 };
  const update = (t, k = 1, strike = 0) => {
    K.U.uTime.value = t;
    const dt = E.t == null || t < E.t ? 1 : Math.min(0.1, t - E.t);
    E.t = t;
    const want = clamp01(k);
    E.e = dt >= 1 ? want : ease(E.e, want, dt, want > E.e ? 7 : 4);
    const e = E.e;
    const up = 1 - Math.pow(1 - e, 3);
    const sk = clamp01(strike);
    const st = smooth(0, 1, sk);
    g.visible = e > 0.001;
    rise.position.y = mix(mix(-L - DEPTH - 1, -DEPTH, up), strikeRoot, st);
    let prev = 0;
    let prevS = 0;
    for (let i = 0; i < NB; i++) {
      const s = i / (NB - 1);
      // standing: a lean towards the bank, the top curled over in a hook,
      // swaying in a wave that runs up it
      const wave = Math.sin(t * 1.3 + ph - s * 5.5) * (0.12 + 0.5 * s) + Math.sin(t * 2.3 + ph * 2 - s * 9) * 0.12 * s;
      const hook = curl * Math.pow(smooth(0.35, 1, s), 1.4) * mix(0.25, 1, smooth(0.4, 1, e));
      const stand = lean * Math.min(1, s * 3) + -hook + wave * 0.35 + (1 - e) * Math.sin(t * 5 + s * 12) * 0.3 * s;
      // the slam rolls out along it, root first
      const ss = smooth(0, 1, clamp01(sk * 1.35 - s * 0.35));
      const dir = mix(stand, strikeDir(s) + Math.sin(t * 6 + s * 10) * 0.04 * s * (1 - st * 0.5), ss);
      const bone = mesh.skeleton.bones[i];
      bone.rotation.z = i ? dir - prev : dir;
      const side = Math.sin(t * 0.9 + ph + s * 3) * 0.06 * s * (1 - st);
      bone.rotation.x = i ? side - prevS : side;
      prev = dir;
      prevS = side;
    }
    const rm = ripple.material;
    rm.uniforms.uTime.value = t + ph;
    rm.uniforms.uK.value = smooth(0, 0.3, e) * (1 - 0.5 * st);
  };
  update(0, 0, 0);
  return { group: g, update, mesh, length: L };
}
