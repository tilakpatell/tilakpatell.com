// The Argonath on the Anduin, the river’s wet rocks and its cliffs, and a
// little white fountain. Moved out of props.js as they were.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, fbm, makeNoise, mix, smooth } from '../../../../lib/paint';
import { blob, boxUV, cyl, lathe, parts, rng, roundBox, tf, tube } from '../../shire/build';
import { C, geoOf, gridIdx, leafBlade, loftRound, noise3, paintGeo, polar, TAU, UP, V3 } from './helpers';

// ── the Argonath ──

// The colours the kings have weathered to: grey-green stone, darker
// streaks where water has run down it for an age, cracks, moss on what
// faces up, lichen in drifts, and dark and slimed at the river's edge.
export function kingPaint(seed) {
  const n = makeNoise(seed);
  const base = C(0x8e938a);
  const green = C(0x76826c);
  const dark = C(0x3a4236);
  const moss = C(0x56602e);
  const lichen = C(0xb8b68e);
  const pale = C(0xc6c8be);
  const slime = C(0x2a3020);
  return (p, nrm, out) => {
    const v = noise3(n, p.x * 0.05, p.y * 0.05, p.z * 0.05);
    out.copy(base).lerp(green, smooth(0.35, 0.68, v));
    const st = n(p.x * 0.3 + p.z * 0.3 + 11, p.y * 0.012 + 3);
    out.lerp(dark, smooth(0.6, 0.85, st) * 0.5);
    const cr = 1 - Math.abs(noise3(n, p.x * 0.035 + 9, p.y * 0.035, p.z * 0.035 + 4) * 2 - 1);
    out.multiplyScalar(1 - smooth(0.94, 0.99, cr) * 0.55);
    const up = clamp01((nrm.y - 0.35) / 0.5);
    out.lerp(moss, up * smooth(0.3, 0.6, noise3(n, p.x * 0.12, p.y * 0.12 + 5, p.z * 0.12)) * 0.85);
    const l = smooth(0.6, 0.72, noise3(n, p.x * 0.09 + 3, p.y * 0.09, p.z * 0.09 + 7));
    out.lerp(nrm.y > 0.2 ? lichen : pale, l * 0.5);
    if (nrm.y < -0.3) out.multiplyScalar(0.72);
    out.lerp(slime, clamp01(1 - (p.y + 1.5) / 4.5) * 0.7);
  };
}

// The stone king, one of the pair, on his pedestal: built here at full
// size, facing +z, his pedestal's foot sunk below the river (y = 0 the
// water) and its top 26 m up, the king 65 m more to his raised hand. A long robe falling in
// heavy folds, a cloak behind, a belt; a stern bearded face under a helm
// with cheek-guards, a crown of points round it and wings rising at its
// sides; his left arm raised, the palm out in warning, his right hand
// gripping the haft of a great axe whose foot rests by his feet.
export function kingParts(bk, K, rocks) {
  const { mats } = K;
  const U = 8;
  const BASE = 26;
  const n = makeNoise(93);
  const paintFn = kingPaint(91);
  const eyes = [V3(0.105, 6.915, 0.3), V3(-0.105, 6.915, 0.3)].map((e) => e.multiplyScalar(U).add(V3(0, BASE, 0)));
  const paint = (p, nrm, out) => {
    paintFn(p, nrm, out);
    for (const e of eyes) out.multiplyScalar(mix(0.3, 1, smooth(0.25, 0.75, p.distanceTo(e))));
  };
  let seed = 400;
  const put = (geo, o = {}) => {
    tf(geo, o);
    geo.scale(U, U, U).translate(0, BASE, 0);
    bk.add(mats.kingStone, paintGeo(geo, paint), { uv: 0.09 });
  };
  const limb = (pts, r0, r1, seg = 10, radial = 12) => put(tube(pts, r0, r1, { seg, radial, gnarl: 0.02, seed: seed++ }));
  const lump = (rad, o, detail = 2, amp = 0.06) => put(blob(rad, { detail, amp, freq: 1.4, seed: seed++ }), o);
  // the robe and the cloak behind it, from the hem to the neck
  const KEYS = [
    [0.0, 1.02, 0.9, 1.22],
    [0.5, 0.95, 0.8, 1.14],
    [1.0, 0.9, 0.72, 1.06],
    [1.6, 0.86, 0.64, 1.0],
    [2.2, 0.83, 0.6, 0.94],
    [2.8, 0.81, 0.57, 0.88],
    [3.4, 0.79, 0.54, 0.82],
    [4.0, 0.78, 0.53, 0.76],
    [4.3, 0.8, 0.55, 0.72],
    [4.6, 0.86, 0.6, 0.68],
    [5.0, 0.95, 0.65, 0.66],
    [5.4, 1.06, 0.66, 0.64],
    [5.7, 1.12, 0.6, 0.6],
    [5.9, 1.04, 0.5, 0.54],
    [6.05, 0.82, 0.42, 0.46],
    [6.15, 0.52, 0.33, 0.37],
    [6.22, 0.25, 0.25, 0.27],
  ];
  const key = (y) => {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] < y) i++;
    const [y0, ...a] = KEYS[i];
    const [y1, ...b] = KEYS[i + 1];
    const t = clamp01((y - y0) / (y1 - y0));
    return a.map((v, k) => mix(v, b[k], t));
  };
  const ys = [];
  for (let y = 0; y < 4.0; y += 0.25) ys.push(y);
  for (let y = 4.0; y < 6.2; y += 0.12) ys.push(y);
  ys.push(6.22);
  const folds = (a, y) => {
    const s = Math.sin(a);
    const skirt = 1 - smooth(2.6, 4.3, y);
    const back = smooth(0.0, -0.7, s) * (1 - smooth(5.3, 6.0, y));
    const k = Math.max(skirt * mix(1, 0.45, y / 4.3), back * 0.9);
    const f = 0.5 + 0.5 * Math.cos(a * 13 + Math.sin(a * 3) * 1.3 + y * 0.05);
    // a tabard hangs straight down the front from the belt
    const front = Math.abs(a - Math.PI / 2) < 0.3 ? 1 : 0;
    const tab = front * (1 - smooth(4.2, 4.35, y)) * 0.06;
    return k * 0.12 * (Math.pow(f, 1.8) - 0.3) * (1 - front * 0.8) + tab;
  };
  put(loftRound(ys.map((y) => [y, ...key(y), y < 4.4 ? 2.3 : 2.7]), { radial: 80, push: folds }));
  // his feet under the hem, the belt, the shoulders' plates
  for (const s of [-1, 1]) lump(0.2, { p: [s * 0.32, 0.08, 0.84], s: [0.9, 0.55, 1.35] });
  put(new THREE.TorusGeometry(1, 0.06, 6, 56).rotateX(Math.PI / 2).scale(0.78, 1, 0.63).translate(0, 4.3, -0.09));
  put(roundBox(0.22, 0.17, 0.08, 0.03), { p: [0, 4.3, 0.56] });
  for (const s of [-1, 1]) {
    lump(0.4, { p: [s * 1.0, 5.74, 0.0], s: [1.1, 0.72, 1.05] });
    lump(0.37, { p: [s * 1.08, 5.54, 0.0], s: [1.05, 0.6, 1.0] });
  }
  // the left arm, raised, the palm out
  const S1 = [1.06, 5.62, 0.02];
  const E1 = [1.66, 6.15, 0.3];
  const W1 = [1.72, 7.22, 0.5];
  limb([S1, [1.4, 5.84, 0.12], E1], 0.36, 0.3);
  lump(0.29, { p: E1 });
  limb([E1, [1.7, 6.7, 0.42], W1], 0.25, 0.19);
  const dir = V3(...W1).sub(V3(...E1)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
  const right = V3(1, 0, 0).applyQuaternion(q);
  const fwd = V3(0, 0, 1).applyQuaternion(q);
  const E = new THREE.Euler().setFromQuaternion(q);
  // the sleeve, fallen back down the raised forearm
  const bellAt = V3(...W1).addScaledVector(dir, -0.12);
  put(lathe([[0.19, 0], [0.24, -0.18], [0.33, -0.4], [0.38, -0.5], [0.35, -0.53], [0.3, -0.42], [0.21, -0.2], [0.17, 0.02]], 16), { p: bellAt.toArray(), r: [E.x, E.y, E.z] });
  const palm = V3(...W1).addScaledVector(dir, 0.24).addScaledVector(fwd, 0.02);
  put(roundBox(0.36, 0.4, 0.13, 0.05), { p: palm.toArray(), r: [E.x, E.y, E.z] });
  [0.4, 0.46, 0.44, 0.35].forEach((L, f) => {
    const b = palm.clone().addScaledVector(dir, 0.18).addScaledVector(right, (f - 1.5) * 0.085);
    const m = b.clone().addScaledVector(dir, L * 0.5).addScaledVector(right, (f - 1.5) * 0.012);
    const t = b.clone().addScaledVector(dir, L).addScaledVector(right, (f - 1.5) * 0.03).addScaledVector(fwd, -0.02);
    limb([b.toArray(), m.toArray(), t.toArray()], 0.054, 0.042, 4, 6);
  });
  const tb = palm.clone().addScaledVector(right, -0.16).addScaledVector(dir, -0.08).addScaledVector(fwd, 0.02);
  limb([tb.toArray(), tb.clone().addScaledVector(right, -0.12).addScaledVector(dir, 0.1).addScaledVector(fwd, 0.03).toArray(), tb.clone().addScaledVector(right, -0.19).addScaledVector(dir, 0.24).addScaledVector(fwd, 0.04).toArray()], 0.065, 0.048, 4, 6);
  // the right arm, down, the hand gripping the axe's haft
  const S2 = [-1.06, 5.62, 0.02];
  const E2 = [-1.28, 4.62, 0.16];
  const W2 = [-1.24, 3.98, 0.64];
  limb([S2, [-1.21, 5.12, 0.08], E2], 0.36, 0.31);
  lump(0.29, { p: E2 });
  limb([E2, [-1.28, 4.3, 0.42], W2], 0.26, 0.2);
  const d2 = V3(...W2).sub(V3(...E2)).normalize();
  const e2 = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d2));
  put(lathe([[0.2, 0.06], [0.26, -0.06], [0.3, -0.2], [0.27, -0.22], [0.22, -0.1], [0.18, 0.05]], 14), { p: V3(...W2).addScaledVector(d2, -0.12).toArray(), r: [e2.x, e2.y, e2.z] });
  const HX = -1.3;
  const HZ = 0.9;
  lump(0.2, { p: [HX + 0.02, 3.84, HZ - 0.03], s: [1.05, 1.25, 0.95] });
  for (let f = 0; f < 4; f++) put(new THREE.TorusGeometry(0.11, 0.04, 5, 10, Math.PI * 1.2).rotateX(Math.PI / 2), { p: [HX, 3.98 - f * 0.085, HZ], r: [0, -Math.PI * 0.1, 0] });
  lump(0.07, { p: [HX - 0.02, 4.06, HZ + 0.08], s: [1, 0.8, 1.3] });
  // the axe: the haft, a socket, a crescent blade facing out, a back spike
  // and a point
  put(cyl(0.07, 0.08, 6.7, 10), { p: [HX, 3.45, HZ] });
  put(cyl(0.11, 0.1, 0.12, 10), { p: [HX, 0.06, HZ] });
  put(cyl(0.12, 0.12, 0.62, 10), { p: [HX, 6.24, HZ] });
  const axe = new THREE.Shape();
  axe.moveTo(0.06, 0.2);
  axe.lineTo(-0.2, 0.25);
  axe.quadraticCurveTo(-0.46, 0.33, -0.78, 0.58);
  axe.quadraticCurveTo(-0.6, 0.02, -0.8, -0.52);
  axe.quadraticCurveTo(-0.46, -0.24, -0.2, -0.19);
  axe.lineTo(0.06, -0.16);
  axe.lineTo(0.13, -0.07);
  axe.lineTo(0.44, 0.0);
  axe.lineTo(0.13, 0.07);
  axe.lineTo(0.06, 0.2);
  put(new THREE.ExtrudeGeometry(axe, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 6 }).translate(0, 0, -0.035).scale(1.35, 1.35, 1.2), { p: [HX, 6.24, HZ] });
  put(new THREE.ConeGeometry(0.09, 0.46, 8), { p: [HX, 6.78, HZ] });
  // the neck, the head, the face
  put(cyl(0.2, 0.23, 0.44, 14), { p: [0, 6.32, 0.02] });
  lump(0.3, { p: [0, 6.86, 0.04], s: [0.92, 1.18, 1.02] }, 3, 0.03);
  put(roundBox(0.44, 0.075, 0.12, 0.03), { p: [0, 6.975, 0.27] });
  put(new THREE.ConeGeometry(0.058, 0.2, 4), { p: [0, 6.86, 0.33], r: [-0.22, Math.PI / 4, 0], s: [1, 1, 0.75] });
  for (const s of [-1, 1]) lump(0.06, { p: [s * 0.13, 6.84, 0.28], s: [1.2, 0.8, 0.8] }, 1, 0.05);
  lump(0.22, { p: [0, 6.36, 0.2], s: [1.15, 1.62, 0.75] }, 2, 0.12);
  put(tube([[-0.16, 6.68, 0.25], [-0.06, 6.745, 0.31], [0.06, 6.745, 0.31], [0.16, 6.68, 0.25]], 0.036, 0.03, { seg: 8, radial: 5 }));
  // the helm: a dome, a brim, cheek-guards, a guard down the back of the neck
  put(lathe([[0.335, 0.08], [0.35, 0.16], [0.335, 0.26], [0.28, 0.36], [0.19, 0.44], [0.08, 0.49], [0.001, 0.5]], 28), { p: [0, 6.86, 0.03] });
  put(new THREE.TorusGeometry(0.345, 0.034, 6, 32).rotateX(Math.PI / 2), { p: [0, 6.95, 0.03] });
  for (const s of [-1, 1]) put(roundBox(0.06, 0.36, 0.3, 0.025), { p: [s * 0.315, 6.79, 0.07], r: [0, 0, s * 0.1] });
  put(lathe([[0.345, 0.08], [0.36, -0.05], [0.39, -0.2], [0.42, -0.3], [0.4, -0.31], [0.36, -0.2], [0.33, -0.05], [0.325, 0.08]], 12, Math.PI / 2, Math.PI), { p: [0, 6.86, 0.03] });
  // the crown: a band of points round the helm, the tallest in front, and
  // a wing rising at either side
  put(cyl(0.36, 0.355, 0.1, 28, true), { p: [0, 7.02, 0.03] });
  for (let k = 0; k < 9; k++) {
    const a = Math.PI / 2 + (k - 4) * 0.62;
    const h = k === 4 ? 0.42 : k % 2 ? 0.16 : 0.25;
    const [px, , pz] = polar(a, 0.355, 0);
    put(new THREE.ConeGeometry(0.055, h, 5), { p: [px, 7.06 + h / 2, pz + 0.03] });
  }
  const wing = new THREE.Shape();
  wing.moveTo(0.08, 0);
  wing.quadraticCurveTo(0.16, 0.22, 0.1, 0.46);
  wing.quadraticCurveTo(0.06, 0.62, -0.06, 0.78);
  wing.lineTo(-0.04, 0.6);
  wing.lineTo(-0.12, 0.62);
  wing.lineTo(-0.08, 0.44);
  wing.lineTo(-0.17, 0.44);
  wing.lineTo(-0.1, 0.27);
  wing.lineTo(-0.18, 0.24);
  wing.quadraticCurveTo(-0.08, 0.1, -0.08, 0);
  wing.lineTo(0.08, 0);
  for (const s of [-1, 1]) {
    const geo = new THREE.ExtrudeGeometry(wing, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 5 });
    geo.translate(0, 0, -0.022).scale(0.85, 0.8, 1).rotateZ(-0.55).rotateY(Math.PI / 2).rotateZ(s * -0.12);
    put(geo, { p: [s * 0.37, 6.98, -0.06] });
  }
  // the pedestal: rough rock out of the river, dressed above, with a
  // projecting band and a cornice under the king's feet
  const PK = [
    [-8, 16.5, 17, 18.5, 4.0],
    [-3, 15.2, 15.4, 16.6, 4.4],
    [2, 14.0, 14.0, 15.0, 4.8],
    [7, 13.0, 13.0, 14.0, 5.2],
    [12, 12.2, 12.2, 13.2, 5.6],
    [17, 11.6, 11.6, 12.5, 6],
    [21.8, 11.3, 11.3, 12.2, 6],
    [21.8, 12.0, 12.0, 12.9, 6],
    [22.8, 12.0, 12.0, 12.9, 6],
    [22.8, 11.4, 11.4, 12.3, 6],
    [24.6, 11.4, 11.4, 12.3, 6],
    [24.6, 12.1, 12.1, 13.0, 6],
    [25.3, 12.2, 12.2, 13.1, 6],
    [25.3, 10.0, 10.0, 11.0, 6],
    [26.0, 10.0, 10.0, 11.0, 6],
  ];
  const rings = [];
  for (let i = 0; i < PK.length; i++) {
    rings.push(PK[i]);
    // more rings up the rough part, for its lumps
    if (i < 6) for (let k = 1; k < 4; k++) rings.push(PK[i].map((v, j) => mix(v, PK[i + 1][j], k / 4)));
  }
  const rough = (a, y, x, z) => {
    const k = y < 21.5 ? mix(1.0, 0.25, smooth(-6, 21.5, y)) : 0.04;
    const strata = Math.sin(y * 1.1 + n(Math.cos(a) * 2, y * 0.2) * 3) * 0.45;
    const cols = (1 - Math.abs(n(Math.cos(a) * 9 + 3, Math.sin(a) * 9 + y * 0.03) * 2 - 1)) * 0.9;
    return ((noise3(n, x * 0.12, y * 0.1, z * 0.12) - 0.5) * 3.2 + strata + cols) * k;
  };
  const ped = loftRound(rings, { radial: 56, push: rough });
  bk.add(mats.kingStone, paintGeo(ped, paint), { uv: 0.09 });
  // boulders fallen round its foot (none on the river side, +x)
  const r = rng(17);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.35 + (i / 9) * Math.PI * 1.3 + r() * 0.2;
    const s = 3 + r() * 3.5;
    const geo = rocks[i % rocks.length].clone();
    bk.add(mats.kingStone, geo, { p: polar(a, 16.5 + r() * 2.5, -0.6 + r() * 0.6), r: [r() * 0.4, r() * TAU, r() * 0.4], s, uv: 0.09 });
  }
}

// The Argonath: the Pillars of the Kings, two stone kings on pedestals
// rising out of the river either side of it, 91 m from the water to their
// raised hands. The river runs along z, its middle on x = 0; `gap` is its width
// between the pedestals' feet at the water (y = 0). They face +z,
// upstream; the king at -x raises his left hand, the one at +x (the same
// carving mirrored) his right, both on the river side, and both hold their
// axes on the outer.
export function argonath(K, rocks) {
  const g = new THREE.Group();
  g.name = 'argonath';
  const bk = parts();
  kingParts(bk, K, rocks);
  const a = new THREE.Group();
  a.name = 'king';
  bk.build(a);
  const b = new THREE.Group();
  b.name = 'king';
  for (const m of a.children) b.add(m.clone());
  const GAP = 60;
  const x0 = GAP / 2 + 14.5;
  a.position.x = -x0;
  b.position.x = x0;
  b.scale.x = -1;
  g.add(a, b);
  return { group: g, gap: GAP, kings: [a, b], at: [-x0, x0], height: 91, pedestal: { top: 26, halfWidth: 14.5 } };
}

// ── the river ──

// A wet boulder for the rapids, for instancing, about 1.5 m long: a
// water-worn lump, rounded, a few softened breaks; black-wet and slimed
// low down, grey and lichened on top. Stands about y = -0.4 to 0.55.
export function riverRockGeo(seed = 1) {
  const r = rng(seed * 13 + 7);
  const n = makeNoise(seed + 30);
  let g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  const planes = [];
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU;
    const b = Math.acos(r() * 1.5 - 0.5);
    planes.push({ n: V3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), d: 0.6 + r() * 0.18 });
  }
  const sx = 0.75 * (0.95 + r() * 0.3);
  const sy = 0.75 * (0.55 + r() * 0.2);
  const sz = 0.75 * (0.7 + r() * 0.25);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (fbm(n, v.x * 1.1 + v.z * 0.6 + 4, v.y * 1.1 - v.z * 0.4, { octaves: 3 }) - 0.5) * 0.55);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, (pl.d - d) * 0.85);
    }
    v.set(v.x * sx, v.y * sy, v.z * sz);
    if (v.y < -0.4) v.y = -0.4 + (v.y + 0.4) * 0.2;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g = g.toNonIndexed();
  const grey = C(0x7c7f78);
  const pale = C(0xa2a49a);
  const wet = C(0x2c302c);
  const algae = C(0x3e4a26);
  const lichen = C(0xb2b088);
  paintGeo(g, (q, nrm, out) => {
    out.copy(grey).lerp(pale, smooth(0.35, 0.7, noise3(n, q.x * 2, q.y * 2, q.z * 2)));
    out.multiplyScalar(0.85 + noise3(n, q.x * 7 + 5, q.y * 7, q.z * 7) * 0.3);
    out.lerp(lichen, smooth(0.66, 0.74, noise3(n, q.x * 4 + 3, q.y * 4, q.z * 4)) * 0.5 * clamp01(nrm.y + 0.3));
    out.lerp(algae, (1 - smooth(-0.05, 0.12, q.y)) * 0.6);
    out.lerp(wet, (1 - smooth(-0.3, 0.05, q.y)) * 0.75);
  });
  boxUV(g, 0.3);
  g.computeBoundingSphere();
  return g;
}

// A tall rocky riverbank for instancing, about 30 m wide (x) and 25 m
// high, its face to +z, its foot sunk under the water at y = 0 and its top
// going back 8 m: dark grey-green rock in columns between vertical joints,
// stepped back at ledges, leaning back as it rises, bulging and falling
// back in bays; streaked with rust and old water, moss on the ledges and
// grass on top. Its ends curl back so neighbours run on into one wall.
export function riverCliffGeo(seed = 1) {
  const r = rng(seed * 37 + 11);
  const n = makeNoise(seed * 5 + 3);
  const W = 30;
  const H = 25;
  const ledges = [];
  for (let y = 3 + r() * 3; y < H - 3; y += 4 + r() * 4) ledges.push([y, 0.5 + r() * 1.0]);
  const face = (x, y) => {
    const big = (fbm(n, x * 0.06 + 1, y * 0.05, { octaves: 3 }) - 0.5) * 5.5;
    const jr = 1 - Math.abs(fbm(n, x * 0.28 + 7, y * 0.025 + 2, { octaves: 2 }) * 2 - 1);
    const cols = (smooth(0.5, 1, jr) - 0.4) * 1.8;
    let steps = 0;
    for (const [ly, k] of ledges) steps -= k * smooth(-0.2, 0.2, y - ly - (n(x * 0.09 + ly, 5.5) - 0.5) * 4);
    const fine = (fbm(n, x * 0.5 + 5, y * 0.4, { octaves: 2 }) - 0.5) * 0.8;
    const ends = -smooth(W / 2 - 4, W / 2 + 2, Math.abs(x)) * 7;
    return [big + cols + steps + fine - y * 0.08 + ends, cols];
  };
  const NX = 48;
  const xs = [];
  for (let i = 0; i <= NX; i++) xs.push(-W / 2 - 2 + (i / NX) * (W + 4));
  const yset = new Set([-2.5, -1]);
  for (let y = 0.4; y < H; y += 1.15) yset.add(+y.toFixed(2));
  for (const [ly] of ledges) {
    yset.add(+(ly - 0.25).toFixed(2));
    yset.add(+(ly + 0.25).toFixed(2));
  }
  yset.add(H);
  const ysR = [...yset].sort((p, q) => p - q);
  const pos = [];
  const dep = [];
  ysR.forEach((y, j) => {
    for (const [i, x0] of xs.entries()) {
      const x = x0 + (j % 2 && i > 0 && i < NX ? 0.15 : 0);
      const [z, cols] = face(x, y);
      const yy = j === ysR.length - 1 ? y + (fbm(n, x * 0.08, 4.4, { octaves: 3 }) - 0.5) * 7 : y + (n(x * 0.07 + 3, 9.1) - 0.5) * 2.4 * clamp01(y / 2.5) * clamp01((H - y) / 2.5);
      pos.push(x, yy, z);
      dep.push(cols);
    }
  });
  // the top, going back from the edge, lumpy and grassy
  const tops = [1.2, 3.5, 8];
  for (const back of tops) {
    for (const x of xs) {
      const [z] = face(x, H);
      pos.push(x, H + (fbm(n, x * 0.08, 4.4, { octaves: 3 }) - 0.5) * 7 + 0.4 + n(x * 0.2 + back, 7.7) * 1.1 - back * 0.1, Math.min(z, 0) - back);
      dep.push(0);
    }
  }
  const rowsN = ysR.length + tops.length;
  let geo = geoOf(pos, gridIdx(rowsN - 1, NX));
  const depth = new Float32Array(pos.length / 3);
  dep.forEach((d, i) => (depth[i] = d));
  const idx = geo.index.array;
  geo = geo.toNonIndexed();
  const dv = new Float32Array(idx.length);
  for (let i = 0; i < idx.length; i++) dv[i] = depth[idx[i]];
  // faceted, the facets' edges softened a little
  const flat = geo.clone();
  flat.deleteAttribute('normal');
  flat.computeVertexNormals();
  const sn = geo.attributes.normal;
  const fnm = flat.attributes.normal;
  for (let k = 0; k < sn.count; k++) {
    const nx = sn.getX(k) * 0.4 + fnm.getX(k) * 0.6;
    const ny = sn.getY(k) * 0.4 + fnm.getY(k) * 0.6;
    const nz = sn.getZ(k) * 0.4 + fnm.getZ(k) * 0.6;
    const l = Math.hypot(nx, ny, nz) || 1;
    sn.setXYZ(k, nx / l, ny / l, nz / l);
  }
  const grey = C(0x7a7e76);
  const pale = C(0xa4a69c);
  const rust = C(0x8a6a48);
  const stain = C(0x3a3e36);
  const moss = C(0x4a5a26);
  const grass = C(0x667634);
  const slime = C(0x262c1e);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k);
    const y = p.getY(k);
    const z = p.getZ(k);
    const ny = fnm.getY(Math.floor(k / 3) * 3);
    c.copy(grey).lerp(pale, smooth(0.38, 0.68, fbm(n, x * 0.12 + 3, y * 0.08, { octaves: 3 })));
    c.lerp(rust, smooth(0.58, 0.85, fbm(n, x * 0.2 + 11, y * 0.015 + 2, { octaves: 2 })) * 0.45);
    c.lerp(stain, smooth(0.64, 0.82, n(x * 0.8 + 21, y * 0.02 + 4)) * 0.5);
    c.multiplyScalar(0.88 + smooth(-0.6, 0.6, dv[k]) * 0.18);
    if (ny < -0.2) c.multiplyScalar(0.6);
    const m = smooth(0.35, 0.7, ny) * (0.55 + 0.45 * smooth(0.35, 0.6, n(x * 0.5, z * 0.5 + y)));
    c.lerp(y > H - 4 ? grass : moss, m * 0.65);
    c.lerp(slime, (1 - smooth(-0.5, 1.6, y)) * 0.7);
    col[k * 3] = c.r;
    col[k * 3 + 1] = c.g;
    col[k * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  boxUV(geo, 0.12);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

// ── the fountain ──

// A small white stone fountain for a flet's court, 1.7 m across and a
// metre high: a round basin with carved leaves hanging under its lip, a
// slender stem holding a shallow bowl that brims over in a thin falling
// sheet, a bud at the top. update(t) runs its water.
export function fountain(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'fountain';
  const bk = parts();
  bk.add(mats.paleStone, lathe([[0.001, 0], [0.7, 0], [0.74, 0.03], [0.72, 0.08], [0.76, 0.3], [0.82, 0.42], [0.84, 0.46], [0.8, 0.48], [0.75, 0.47], [0.72, 0.42], [0.68, 0.2], [0.001, 0.17]], 40), { uv: 1.2 });
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU;
    bk.add(mats.paleStone, leafBlade(0.2, 0.08, { curl: -0.7, seg: 3, thick: 0.01 }).rotateX(Math.PI), { p: polar(a, 0.83, 0.43), r: [0, Math.PI / 2 - a, 0], uv: 2 });
  }
  bk.add(mats.paleStone, lathe([[0.16, 0.17], [0.12, 0.25], [0.085, 0.45], [0.08, 0.62], [0.1, 0.7], [0.14, 0.74]], 16), { uv: 1.6 });
  bk.add(mats.paleStone, lathe([[0.1, 0.72], [0.22, 0.76], [0.32, 0.82], [0.35, 0.86], [0.33, 0.87], [0.3, 0.84], [0.2, 0.8], [0.001, 0.79]], 28), { uv: 1.6 });
  bk.add(mats.paleStone, lathe([[0.001, 0.8], [0.06, 0.82], [0.07, 0.88], [0.05, 0.95], [0.02, 1.0], [0.001, 1.01]], 12), { uv: 2 });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    bk.add(mats.paleStone, leafBlade(0.16, 0.06, { curl: 0.9, seg: 3, thick: 0.008 }), { p: polar(a, 0.04, 0.82), r: [0, Math.PI / 2 - a, 0], uv: 2 });
  }
  bk.build(g);
  const lower = new THREE.Mesh(new THREE.CircleGeometry(0.73, 40).rotateX(-Math.PI / 2), mats.water);
  lower.position.y = 0.4;
  const upper = new THREE.Mesh(new THREE.CircleGeometry(0.31, 24).rotateX(-Math.PI / 2), mats.water);
  upper.position.y = 0.845;
  const sheet = new THREE.Mesh(new THREE.CylinderGeometry(0.352, 0.5, 0.45, 32, 1, true), mats.fall);
  sheet.position.y = 0.625;
  for (const m of [lower, upper, sheet]) {
    m.renderOrder = 2;
    g.add(m);
  }
  return {
    group: g,
    water: V3(0, 0.4, 0),
    radius: 0.84,
    update(t) {
      K.water.uTime.value = t;
    },
  };
}
