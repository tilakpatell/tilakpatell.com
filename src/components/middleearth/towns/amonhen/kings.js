// The great stone kings of old, fallen among the trees. Moved out of
// props.js as they were.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { ball, blob, lathe, parts, rng, roundBox, tf, tube } from '../../shire/build';
import { fernGeo } from './forest';
import { C, ext, shapeOf, sweep3, TAU, V3 } from './helpers';
import { boxCorners, chunkGeo, grassGeo, hexBlock, MOSS, mossGeo, paintHull, paintSmooth, placeCorners, stonePaint } from './stone';

// ── the kings of old ──

// Angles from `from` to `to`, closer together (`fine`) about `centre` and
// further apart (`coarse`) away from it: a head's rows and columns, so the
// face has room for its features without the back of the skull costing much.
export function spaced(from, to, fine, coarse, centre, width) {
  const out = [from];
  let a = from;
  while (a < to - 1e-4) {
    const k = Math.exp(-(((a - centre) / width) ** 2));
    a = Math.min(to, a + mix(coarse, fine, k));
    if (to - a < fine * 0.4) a = to;
    out.push(a);
  }
  return out;
}
export const gauss = (dx, dy, rx, ry) => Math.exp(-((dx / rx) ** 2 + (dy / ry) ** 2));

// A head, about 1 tall from the chin (y = -0.5) to the crown (+0.5), its
// face looking along +z: a ball shaped into skull and jaw, then the
// features pushed out and in over the face: brows, sockets and eyes, a
// nose, lips, chin, cheekbones, and a beard in carved locks. `F` sizes them;
// `snarl` opens the mouth. `fine` and `coarse` space the mesh's rows.
export function headGeo(F = {}, { fine = 0.045, coarse = 0.22 } = {}) {
  const f = { width: 0.36, depth: 0.44, jaw: 0.8, brow: 0.035, socket: 0.05, eye: 0.03, nose: 0.1, noseW: 0.034, noseFlat: 1, lips: 0.024, mouthW: 0.08, chin: 0.045, cheek: 0.03, beard: 0, beardLen: 0, locks: 26, snarl: 0, ...F };
  const thetas = spaced(-Math.PI, Math.PI, fine, coarse, 0, 0.95);
  const phis = spaced(-Math.PI / 2, Math.PI / 2, fine, coarse, -0.3, 0.8);
  const nu = thetas.length;
  const pos = [];
  const idx = [];
  for (const ph of phis) {
    for (const th of thetas) {
      const dx = Math.cos(ph) * Math.sin(th);
      const dy = Math.sin(ph);
      const dz = Math.cos(ph) * Math.cos(th);
      let X = dx * f.width;
      let Y = dy * 0.5;
      let Z = dz > 0 ? f.depth * Math.pow(dz, 0.72) : dz * f.depth * 1.06;
      // the jaw narrows under the cheekbones, and the back of the neck
      // comes in under the skull
      X *= mix(1, f.jaw, smooth(-0.04, -0.46, Y));
      if (dz < 0) Z *= mix(1, 0.68, smooth(-0.08, -0.46, Y));
      const front = smooth(0.12, 0.6, dz);
      const fx = X;
      const fy = Y;
      const ax = Math.abs(fx);
      let d = 0;
      d += f.brow * gauss(ax - 0.12, fy - 0.085, 0.1, 0.032) + f.brow * 0.6 * gauss(fx, fy - 0.07, 0.06, 0.03);
      d -= f.socket * gauss(ax - 0.115, fy - 0.022, 0.078, 0.046);
      d += f.eye * gauss(ax - 0.115, fy - 0.016, 0.046, 0.028);
      const nt = clamp01((0.065 - fy) / 0.19);
      d += f.nose * (0.28 + 0.72 * Math.pow(nt, 1.4)) * gauss(fx, 0, f.noseW * f.noseFlat * (0.8 + 0.7 * nt), 1) * smooth(0.08, 0.045, fy) * smooth(-0.165, -0.128, fy);
      d += f.nose * 0.36 * gauss(ax - 0.046 * f.noseFlat, fy + 0.127, 0.032 * f.noseFlat, 0.026);
      d += f.lips * gauss(fx, fy + 0.19, f.mouthW, 0.022);
      d -= f.lips * (0.9 + f.snarl * 2.5) * gauss(fx, fy + 0.214, f.mouthW * (1.05 + f.snarl * 0.2), 0.012 + f.snarl * 0.022);
      d += f.lips * 1.15 * gauss(fx, fy + 0.242 + f.snarl * 0.02, f.mouthW * 0.86, 0.022);
      d += f.chin * gauss(fx, fy + 0.34, 0.085, 0.065);
      d += f.cheek * gauss(ax - 0.17, fy + 0.03, 0.075, 0.055);
      d -= f.cheek * 0.5 * gauss(ax - 0.16, fy + 0.17, 0.065, 0.06);
      Z += d * front;
      if (f.beard) {
        // a beard: the lower face built out in locks, a moustache over the
        // lip, and the whole carried down below the chin
        const lipsK = gauss(fx, fy + 0.222, 0.085, 0.04);
        const m = smooth(-0.09, -0.21, Y) * smooth(-0.35, 0.05, dz) * (1 - lipsK * front);
        const lock = 1 + 0.28 * Math.sin(Math.atan2(X, Z) * f.locks + Y * 6) * smooth(-0.15, -0.3, Y);
        const push = f.beard * m * lock;
        const rr = Math.hypot(X, Z) || 1;
        X += (X / rr) * push;
        Z += (Z / rr) * push;
        Z += f.beard * 0.9 * (gauss(ax - 0.055, fy + 0.172, 0.055, 0.02) + 0.7 * gauss(ax - 0.1, fy + 0.205, 0.04, 0.03)) * front;
        const down = smooth(-0.28, -0.5, Y) * smooth(-0.25, 0.35, dz);
        Y -= f.beardLen * down;
        Z += f.beardLen * 0.35 * down;
      }
      pos.push(X, Y, Z);
    }
  }
  for (let j = 0; j < phis.length - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i;
      idx.push(a, a + 1, a + nu, a + 1, a + nu + 1, a + nu);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A crack scored across a head's face: points near the jagged line (in the
// face's x, y) pushed in. Returns how far into the crack each vertex is, to
// darken it once painted.
export function scoreCrack(geo, seed, { width = 0.016, depth = 0.025 } = {}) {
  const r = rng(seed);
  const line = [];
  let x = -0.36;
  let y = 0.18 + r() * 0.1;
  while (x < 0.38) {
    line.push([x, y]);
    x += 0.05 + r() * 0.05;
    y -= 0.03 + (r() - 0.35) * 0.08;
  }
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  const w = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) < 0.05) continue;
    const px = p.getX(i);
    const py = p.getY(i);
    let best = 9;
    for (let k = 0; k < line.length - 1; k++) {
      const [ax, ay] = line[k];
      const [bx, by] = line[k + 1];
      const t = clamp01(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2));
      best = Math.min(best, Math.hypot(px - ax - (bx - ax) * t, py - ay - (by - ay) * t));
    }
    const k = 1 - smooth(width * 0.3, width * 2.2, best);
    if (k <= 0) continue;
    w[i] = k;
    const s = depth * (1 - smooth(0, width * 1.6, best));
    p.setXYZ(i, px - nr.getX(i) * s, py - nr.getY(i) * s, p.getZ(i) - nr.getZ(i) * s);
  }
  geo.computeVertexNormals();
  return w;
}

// The crowned helm of the kings of Gondor, in a head's frame (headGeo): a
// tall peaked cap down over the temples and the nape, a band round its rim
// with a white star on the brow, and a seabird's wing swept up at each side.
export function helmGeos(seed = 1) {
  const out = [];
  const cap = lathe([[0.395, 0.12], [0.405, 0.2], [0.4, 0.3], [0.365, 0.42], [0.3, 0.56], [0.2, 0.7], [0.1, 0.83], [0.035, 0.92], [0.001, 0.95]], 44);
  const p = cap.attributes.position;
  const rim = [];
  const dropAt = (a) => 0.36 * smooth(0.5, 1.15, a) + 0.1 * smooth(1.6, 2.6, a);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i) * 1.2;
    const a = Math.abs(Math.atan2(x, z));
    const drop = dropAt(a);
    const ny = y - drop * (1 - smooth(0.12, 0.5, y));
    // a ridge along the top, front to back
    const ridge = 0.03 * gauss(x, 0, 0.05, 1) * smooth(0.2, 0.6, y);
    p.setXYZ(i, x, ny + ridge * 0.5, z * (1 + ridge * 2));
  }
  cap.computeVertexNormals();
  out.push(cap);
  // the band round its rim
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU;
    rim.push([Math.sin(a) * 0.41, 0.15 - dropAt(Math.abs(((a + Math.PI) % TAU) - Math.PI)), Math.cos(a) * 0.41 * 1.2]);
  }
  out.push(tube(rim, 0.032, 0.032, { seg: 72, radial: 5 }));
  out.push(tf(new THREE.OctahedronGeometry(0.06, 0), { p: [0, 0.2, 0.5], s: [0.9, 1.25, 0.6] }));
  // the wings, each a feathered blade lying along the side of the cap
  const wing = [[0.0, 0.0], [0.03, 0.14], [0.02, 0.3], [-0.04, 0.44], [-0.14, 0.58], [-0.28, 0.68], [-0.25, 0.56], [-0.34, 0.58], [-0.29, 0.46], [-0.37, 0.46], [-0.3, 0.34], [-0.36, 0.32], [-0.27, 0.22], [-0.3, 0.17], [-0.2, 0.1], [-0.18, 0.0]];
  for (const sd of [-1, 1]) {
    const geo = ext(shapeOf(wing), 0.03, 0.012).translate(0, 0, -0.015);
    // the shape's x runs back along the side, its y up
    geo.rotateY(sd * (-Math.PI / 2) + sd * 0.0);
    geo.rotateZ(sd * -0.12);
    if (sd < 0) geo.rotateY(Math.PI);
    out.push(tf(geo, { p: [sd * 0.43, 0.08, 0.12], r: [0, sd * 0.18, 0] }));
  }
  void seed;
  return out;
}

// A hand in its own frame: the wrist at the origin, the fingers up +y, the
// palm facing +z and the thumb to -x (a right hand; mirror x for a left),
// the palm about 1 long. `curl` closes it from 0 open to 1 a fist; `lost`
// lists fingers (0 the forefinger to 3 the little finger) broken off short.
export function handGeos({ curl = 0, spread = 0.1, lost = [], thumb = 0.5 } = {}) {
  const out = [];
  out.push(tf(roundBox(0.92, 1.0, 0.38, 0.14), { p: [0, 0.5, 0] }));
  const lens = [[0.48, 0.3, 0.24], [0.54, 0.34, 0.26], [0.5, 0.32, 0.24], [0.38, 0.24, 0.2]];
  const base = [-0.33, -0.11, 0.11, 0.33];
  lens.forEach((L, i) => {
    const pts = [[base[i] * 1.0, 0.96, 0]];
    let ang = (i - 1.5) * spread;
    let bend = 0;
    let x = base[i];
    let y = 0.96;
    let z = 0;
    const segs = lost.includes(i) ? 1 : 3;
    for (let s = 0; s < segs; s++) {
      bend += curl * (s === 0 ? 1.2 : 1.45);
      const l = L[s];
      x += Math.sin(ang) * l * Math.cos(bend);
      y += Math.cos(ang) * l * Math.cos(bend);
      z += l * Math.sin(bend);
      pts.push([x, y, z]);
      ang *= 0.6;
    }
    out.push(tube(pts, i === 3 ? 0.1 : 0.12, i === 3 ? 0.085 : 0.095, { seg: segs * 2, radial: 6 }));
    const end = pts[pts.length - 1];
    out.push(tf(ball(i === 3 ? 0.085 : 0.095, 6, 4), { p: end }));
  });
  // the thumb, from the heel of the palm out and up
  const tb = [[-0.36, 0.25, 0.08], [-0.6, 0.5, 0.15 + thumb * 0.15], [-0.66 + thumb * 0.2, 0.78, 0.2 + thumb * 0.3], [-0.6 + thumb * 0.35, 0.98, 0.25 + thumb * 0.45]];
  out.push(tube(tb, 0.16, 0.11, { seg: 6, radial: 6 }));
  out.push(tf(ball(0.11, 6, 4), { p: tb[3] }));
  return out;
}

// A robe as a lathe about y from rows [r, y] (the hem first): elliptical
// (x deeper or shallower than z by `depth`), falling in `folds` folds that
// deepen towards the hem, its hem a little uneven. `phi` limits it to an
// arc (a cloak behind); `inner` adds the inside face for an open one.
export function robeGeo(rows, { depth = 0.72, folds = 9, amp = 0.07, phi = [0, TAU], seg = 40, hem = 0.04, top = null, seed = 1, inner = false } = {}) {
  const n = makeNoise(seed);
  const y0 = rows[0][1];
  const y1 = top ?? rows[rows.length - 1][1];
  const geo = lathe(rows, seg, phi[0], phi[1]);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(x, z);
    const low = 1 - smooth(y0, y1, y);
    const fold = Math.sin(a * folds + Math.sin(a * 3 + seed) * 0.8 + n(a * 2, 1) * 2) * amp * (0.25 + low);
    const k = 1 + fold;
    const dy = low > 0.97 ? Math.sin(a * folds * 0.5 + seed) * hem + (n(a * 4, 3) - 0.5) * hem : 0;
    p.setXYZ(i, x * k * depth, y + dy, z * k);
  }
  geo.computeVertexNormals();
  if (!inner) return geo;
  const back = geo.clone();
  const bp = back.attributes.position;
  for (let i = 0; i < bp.count; i++) bp.setXYZ(i, bp.getX(i) * 0.96, bp.getY(i), bp.getZ(i) * 0.96);
  const ix = back.index.array;
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix[i + 1];
    ix[i + 1] = ix[i + 2];
    ix[i + 2] = t;
  }
  back.computeVertexNormals();
  return mergeGeometries([geo.toNonIndexed(), back.toNonIndexed()]);
}

// A frame for a part of a figure: placed at p, turned by r (Euler, or a
// quaternion), scaled by s.
export const frame = (p = [0, 0, 0], r = [0, 0, 0], s = 1) =>
  new THREE.Matrix4().compose(V3(...p), r.isQuaternion ? r : new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), typeof s === 'number' ? V3(s, s, s) : V3(...s));
// The turn that takes a hand's frame (fingers +y, palm +z) to fingers along
// `fing` and the palm facing `palm` (both roughly square to each other).
export function handTurn(fing, palm) {
  const y = V3(...fing).normalize();
  const z = V3(...palm);
  z.addScaledVector(y, -z.dot(y)).normalize();
  const x = V3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// A king's head in its helm, the face to +x: placed by `m` (its middle at
// the origin, about 1 tall from chin to crown before m scales it).
export function kingHead(add, m, { seed = 1, crack = false, fine = 0.045, coarse = 0.22 } = {}) {
  const turn = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  const head = headGeo({ beard: 0.055, beardLen: 0.14, nose: 0.11, brow: 0.04 }, { fine, coarse });
  const cw = crack ? scoreCrack(head, seed + 3) : null;
  add(head.applyMatrix4(turn).applyMatrix4(m), cw);
  for (const g of helmGeos(seed)) add(g.applyMatrix4(turn).applyMatrix4(m));
}

// The great statues of the kings of old in the woods of Amon Hen, pale
// stone streaked with rain, green with moss on everything that faces the
// sky, lichen over the rest, ferns at their feet. Each faces +x, his right
// hand to +z, standing on y = 0. `kind`:
// - 'head': a giant fallen head, about 4 m, lying on his cheek half sunk in
//   the earth: a crowned helm with its wing swept up, a stern bearded face,
//   a crack across it, moss over the upturned side.
// - 'seated': a broken king about 7 m tall on his throne, on a plinth: his
//   right hand on his knee, his left arm gone at the shoulder and lying on
//   the ground by the plinth, his head bowed, moss and ferns in his lap.
// - 'standing': a king about 8 m tall on his plinth, his left hand raised
//   palm out in warning (two of its fingers broken), his right on the
//   pommel of a long sword whose point rests between his feet; a long robe
//   and a cloak to the ground.
export function king(K, { kind = 'standing', seed = 1 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = `king-${kind}`;
  const bk = parts();
  const rand = rng(seed * 41 + kind.length);
  const paint = stonePaint(seed * 7 + 70, { moss: 1.25, lichen: 1.2, damp: 1.0, base: C(0xaaaba4), vary: 0.14, scale: 1.3 });
  // a part, already where it goes: painted (moss lands on what faces up),
  // darkened in its cracks
  const add = (geo, crack = null) => {
    if (!geo.attributes.normal) geo.computeVertexNormals();
    paintSmooth(geo, paint);
    if (crack) {
      const c = geo.attributes.color;
      for (let i = 0; i < c.count; i++) {
        const k = 1 - crack[i] * 0.78;
        c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
      }
    }
    bk.add(mats.statue, geo, { uv: 0.45 });
  };
  const addHull = (geo) => bk.add(mats.statue, paintHull(geo, [], paint), { uv: 0.45 });
  let sd = 300 + seed * 50;
  const moss = (x, y, z, r, h = 0.35) => bk.add(mats.moss, mossGeo(r, sd++, { h, detail: r > 0.4 ? 2 : 1 }), { p: [x, y, z], r: [0, rand() * TAU, 0], uv: 3 });
  const block = (P, o = {}) => bk.add(mats.statue, hexBlock(P, { seed: sd++, paint, chamfer: 0.08, chip: 0.5, ...o }), { uv: 0.45 });
  const tufts = [];
  const ferns = [];
  const plinth = (w, d, h1, h2) => {
    block(placeCorners(boxCorners(w, h1 + 0.3, d), { p: [0, (h1 - 0.3) / 2, 0] }), { flatBottom: true });
    block(placeCorners(boxCorners(w - 0.5, h2, d - 0.5), { p: [0, h1 + h2 / 2, 0] }));
    for (let i = 0; i < 18; i++) {
      const a = rand() * TAU;
      const rr = Math.max(w, d) * (0.55 + rand() * 0.2);
      tufts.push({ x: Math.cos(a) * rr, y: 0, z: Math.sin(a) * rr, h: 0.4 + rand() * 0.3, n: 9, s: 0.3 });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.5 + rand() * 0.6;
      ferns.push([Math.cos(a) * w * 0.62, 0, Math.sin(a) * d * 0.62, rand() * TAU, 1 + rand() * 0.4]);
    }
    return h1 + h2;
  };

  if (kind === 'bust') {
    kingHead(add, frame([0, 1.5, 0], [0, 0, 0], 1), { seed, crack: false, fine: 0.04, coarse: 0.2 });
  } else if (kind === 'head') {
    // about 2.6 m to the head's unit: 4 m from beard to the helm's peak
    const U = 2.6;
    const m = frame([0, 0.55, 0], [0.12, 0.25, 1.38], U);
    kingHead(add, m, { seed, crack: true, fine: 0.04, coarse: 0.2 });
    // the earth heaped round where it sank, and broken stone
    const ne = makeNoise(seed + 5);
    bk.add(mats.earth, blob(1, { detail: 3, amp: 0.25, freq: 2, seed: seed + 8 }), {
      p: [0.1, -0.05, 0.2],
      s: [2.4, 0.45, 2.1],
      color: (x, y, z, out) => out.setRGB(0.2, 0.15, 0.09).lerp(MOSS.mid, smooth(0.15, 0.3, y) * 0.8).multiplyScalar(0.6 + ne(x * 2, z * 2) * 0.6),
    });
    for (let i = 0; i < 7; i++) {
      const a = rand() * TAU;
      const rr = 2.4 + rand() * 1.4;
      const geo = chunkGeo(sd++, 0.25 + rand() * 0.35, 0.6);
      tf(geo, { p: [Math.cos(a) * rr, 0.08, Math.sin(a) * rr], r: [rand(), rand() * 3, rand()] });
      addHull(geo);
    }
    moss(0.2, 1.62, -0.6, 0.7, 0.4);
    moss(-0.9, 1.25, 0.6, 0.55, 0.4);
    moss(1.3, 0.55, 1.6, 0.45, 0.5);
    for (let i = 0; i < 26; i++) {
      const a = rand() * TAU;
      const rr = 1.9 + rand() * 1.2;
      tufts.push({ x: Math.cos(a) * rr * 1.1, y: 0, z: Math.sin(a) * rr, h: 0.35 + rand() * 0.3, n: 9, s: 0.3 });
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rand();
      ferns.push([Math.cos(a) * 2.6, 0, Math.sin(a) * 2.4, rand() * TAU, 1 + rand() * 0.5]);
    }
  } else if (kind === 'seated') {
    const U = 0.86;
    const top = plinth(3.9, 3.3, 0.5, 0.42);
    // the figure in U, from the plinth's top, under the pelvis
    const P = (x, y, z) => [x * U, top + y * U, z * U];
    const at = (o = {}) => frame(o.p ? P(...o.p) : P(0, 0, 0), o.r || [0, 0, 0], o.s ?? U);
    // the throne: a deep seat block and a high back, carved down its sides
    block(boxCorners(1, 1, 1).map((c) => V3(...P(c.x < 0 ? -1.55 : 0.55, c.y < 0 ? -0.2 : 2.05, c.z * 2.6))));
    const backShape = shapeOf([[-1.3, 0], [1.3, 0], [1.3, 4.6], [1.0, 5.3], [0.4, 5.6], [-0.4, 5.6], [-1.0, 5.3], [-1.3, 4.6]]);
    add(ext(backShape, 0.5, 0.06, 4).rotateY(-Math.PI / 2).scale(U, U, U).translate(-1.15 * U, top, 0));
    for (const s of [-1, 1]) add(tube([P(-1.2, 0.3, s * 1.32), P(-1.2, 3.8, s * 1.32)], 0.12 * U, 0.12 * U, { seg: 2, radial: 6 }));
    // the lap under the robe, and the robe falling from the knees
    const lapBump = (p, o, u, v) => (Math.sin(u * TAU * 3 + v * 2) * 0.04 + (u > 0.1 && u < 0.4 ? 0.06 : 0)) * U * smooth(0.2, 0.6, v);
    add(sweep3([P(-0.6, 2.35, 0), P(0.5, 2.38, 0), P(1.5, 2.4, 0), P(1.95, 2.3, 0)], [[0.62, 1.08], [0.58, 1.06], [0.52, 1.02], [0.45, 0.98]], { seg: 10, radial: 16, side: [0, 0, 1], sq: 2.6, bump: lapBump }));
    add(sweep3([P(1.95, 2.45, 0), P(2.08, 1.3, 0), P(2.18, 0.12, 0)], [[0.42, 1.0], [0.44, 1.06], [0.5, 1.14]], { seg: 10, radial: 16, side: [0, 0, 1], sq: 2.4, bump: (p, o, u) => Math.sin(u * TAU * 5) * 0.05 * U }));
    // the feet, out from under the hem
    for (const s of [-1, 1]) add(sweep3([P(2.1, 0.18, s * 0.5), P(2.5, 0.14, s * 0.55), P(2.85, 0.1, s * 0.58)], [[0.18, 0.24], [0.16, 0.24], [0.1, 0.2]], { seg: 5, radial: 8, side: [0, 0, 1] }));
    // the body, his chest and shoulders, a short mantle over them
    add(robeGeo([[0.9, 2.1], [0.84, 2.7], [0.88, 3.4], [0.98, 4.1], [0.95, 4.6], [0.7, 4.95], [0.3, 5.12], [0.001, 5.14]], { depth: 0.66, folds: 7, amp: 0.025, seed: 3 }).scale(U, U, U).translate(...P(-0.55, 0, 0)));
    add(robeGeo([[1.12, 3.95], [1.08, 4.4], [0.94, 4.85], [0.62, 5.06], [0.001, 5.1]], { depth: 0.7, folds: 11, amp: 0.05, seed: 4, phi: [Math.PI * 0.7, Math.PI * 1.6] }).scale(U, U, U).translate(...P(-0.55, 0, 0)));
    add(tube([P(-0.5, 4.95, 0), P(-0.42, 5.4, 0)], 0.36 * U, 0.33 * U, { seg: 2, radial: 10 }));
    for (const s of [-1, 1]) add(tf(blob(0.42, { detail: 2, amp: 0.05, seed: 9 + s }), { p: P(-0.52, 4.72, s * 1.0), s: [U, U * 0.9, U] }));
    // his right arm, the hand on his knee
    const S = P(-0.52, 4.65, 1.02);
    const E = P(-0.2, 3.25, 1.18);
    const Wr = P(1.1, 2.98, 0.8);
    add(tube([S, P(-0.4, 4.0, 1.14), E], 0.34 * U, 0.28 * U, { seg: 5, radial: 10 }));
    add(tube([E, P(0.45, 3.06, 1.04), Wr], 0.28 * U, 0.2 * U, { seg: 5, radial: 10 }));
    const hm = frame(Wr, handTurn([0.85, -0.5, -0.1], [0.4, 0.7, 0.1]).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.PI)), 0.62 * U);
    for (const hg of handGeos({ curl: 0.35, spread: 0.08, thumb: 0.2 })) add(hg.applyMatrix4(hm));
    // the left arm, gone: a broken stump at the shoulder
    add(tube([P(-0.52, 4.65, -1.02), P(-0.46, 4.2, -1.12), P(-0.42, 3.92, -1.16)], 0.34 * U, 0.31 * U, { seg: 3, radial: 10 }));
    addHull(tf(chunkGeo(sd++, 0.34 * U, 0.5, 14), { p: P(-0.42, 3.9, -1.16), r: [0.3, 0.2, 0.1] }));
    // his head, bowed a little, as if he looked down at the woods
    kingHead(add, at({ p: [-0.36, 5.95, 0], r: [0, 0, -0.2], s: U }), { seed: seed + 1, fine: 0.06, coarse: 0.26 });
    // the arm on the ground beside the plinth, its hand half open
    bk.at([2.6, 0, -3.0], 0.7, () => {
      const lie = (x, y, z) => [x * U, 0.32 + y * U, z * U];
      add(tube([lie(-0.3, 0, 0), lie(0.6, 0.02, 0.05), lie(1.4, -0.05, 0.1)], 0.3 * U, 0.2 * U, { seg: 5, radial: 10 }));
      const fm = frame(lie(1.4, -0.08, 0.12), handTurn([1, -0.1, 0.1], [0, 1, 0.2]), 0.62 * U);
      for (const hg of handGeos({ curl: 0.5, spread: 0.1, lost: [3] })) add(hg.applyMatrix4(fm));
      addHull(tf(chunkGeo(sd++, 0.3 * U, 0.6, 12), { p: lie(-0.35, 0, 0) }));
      moss(0.3 * U, 0.32 + 0.28 * U, 0, 0.28, 0.4);
      tufts.push({ x: 0, y: 0, z: 0.5, h: 0.4, n: 10, s: 0.4 });
    });
    // moss in his lap, on his shoulders and feet, a fern growing from it
    moss(...P(0.7, 2.98, 0.1), 0.62, 0.32);
    moss(...P(1.5, 2.9, -0.4), 0.42, 0.4);
    moss(...P(-0.1, 2.95, -0.6), 0.36, 0.4);
    moss(...P(-0.55, 5.02, -0.9), 0.32, 0.45);
    moss(...P(-0.55, 5.02, 0.85), 0.28, 0.45);
    for (const s of [-1, 1]) moss(...P(2.6, 0.24, s * 0.55), 0.22, 0.5);
    ferns.push([...P(0.95, 3.05, -0.25), 1.2, 0.55]);
    ferns.push([...P(-1.2, 5.6, 0.3), 2.2, 0.4]);
  } else {
    const U = 0.94;
    const top = plinth(3.3, 3.1, 0.5, 0.4);
    const P = (x, y, z) => [x * U, top + y * U, z * U];
    // the robe to his feet, the belt, his chest
    add(robeGeo([[1.02, 0.12], [1.0, 0.35], [0.92, 1.3], [0.84, 2.3], [0.78, 3.3], [0.74, 3.95], [0.72, 4.15], [0.001, 4.16]], { depth: 0.74, folds: 9, amp: 0.07, seed: 5, hem: 0.05, top: 4.0 }).scale(U, U, U).translate(...P(0, 0, 0)));
    add(lathe([[0.745, 3.98], [0.775, 4.02], [0.78, 4.22], [0.745, 4.26]], 28).scale(0.74 * U, U, U).translate(...P(0, 0, 0)));
    add(tf(new THREE.OctahedronGeometry(0.14, 0), { p: P(0.6, 4.12, 0), s: [0.5 * U, U, U] }));
    add(robeGeo([[0.73, 4.1], [0.76, 4.5], [0.86, 5.0], [0.93, 5.45], [0.9, 5.78], [0.68, 6.0], [0.32, 6.12], [0.001, 6.14]], { depth: 0.64, folds: 5, amp: 0.02, seed: 6 }).scale(U, U, U).translate(...P(0, 0, 0)));
    // the cloak from his shoulders to the ground behind him
    add(robeGeo([[1.32, 0.04], [1.22, 1.5], [1.1, 3.2], [1.02, 4.8], [0.98, 5.6], [0.84, 5.95], [0.5, 6.12]], { depth: 0.8, folds: 13, amp: 0.06, seed: 7, hem: 0.06, phi: [Math.PI * 0.9, Math.PI * 1.2], inner: true }).scale(U, U, U).translate(...P(-0.05, 0, 0)));
    for (const s of [-1, 1]) add(tf(blob(0.42, { detail: 2, amp: 0.05, seed: 19 + s }), { p: P(0, 5.72, s * 0.98), s: [U, U * 0.9, U] }));
    add(tube([P(0.02, 5.98, 0), P(0.06, 6.45, 0)], 0.34 * U, 0.31 * U, { seg: 2, radial: 10 }));
    // the feet under the hem
    for (const s of [-1, 1]) add(sweep3([P(0.45, 0.14, s * 0.4), P(0.85, 0.12, s * 0.44), P(1.12, 0.08, s * 0.46)], [[0.16, 0.24], [0.15, 0.24], [0.09, 0.19]], { seg: 5, radial: 8, side: [0, 0, 1] }));
    // his left arm raised, the palm out, the sleeve fallen back from it
    const LS = P(0.02, 5.7, -1.0);
    const LE = P(0.8, 5.3, -1.42);
    const LW = P(1.0, 6.5, -1.5);
    add(tube([LS, P(0.45, 5.5, -1.28), LE], 0.33 * U, 0.27 * U, { seg: 5, radial: 10 }));
    add(tube([LE, P(0.94, 5.95, -1.48), LW], 0.26 * U, 0.19 * U, { seg: 5, radial: 10 }));
    add(sweep3([P(0.98, 6.1, -1.48), P(0.85, 5.4, -1.45), P(0.7, 4.7, -1.4), P(0.6, 4.25, -1.38)], [[0.36, 0.3], [0.42, 0.3], [0.3, 0.22], [0.08, 0.08]], { seg: 10, radial: 12, side: [0, 0, 1] }));
    const lh = frame(P(1.02, 6.48, -1.5), handTurn([0.05, 1, 0.02], [1, 0, -0.15]).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), 0)), [-0.72 * U, 0.72 * U, 0.72 * U]);
    for (const hg of handGeos({ curl: 0.06, spread: 0.12, lost: [2, 3], thumb: 0.15 })) add(hg.applyMatrix4(lh));
    // his right hand on the pommel of his sword, its point between his feet
    const RS = P(0.02, 5.7, 1.0);
    const RE = P(0.28, 4.5, 1.2);
    const RW = P(0.98, 3.95, 0.85);
    add(tube([RS, P(0.1, 5.1, 1.14), RE], 0.33 * U, 0.27 * U, { seg: 5, radial: 10 }));
    add(tube([RE, P(0.62, 4.15, 1.05), RW], 0.26 * U, 0.2 * U, { seg: 5, radial: 10 }));
    const sx = 1.32;
    const sz = 0.66;
    add(tf(ball(0.2, 10, 8), { p: P(sx, 3.86, sz), s: U }));
    add(tube([P(sx, 3.7, sz), P(sx, 3.2, sz)], 0.1 * U, 0.12 * U, { seg: 2, radial: 8 }));
    add(tf(roundBox(0.24, 0.18, 1.5, 0.05), { p: P(sx, 3.1, sz), s: U }));
    add(ext(shapeOf([[-0.17, 0], [0.17, 0], [0.15, -2.6], [0, -2.95], [-0.15, -2.6]]), 0.07, 0.025, 2).translate(0, 0, -0.035).scale(U, U, U).rotateY(Math.PI / 2 - 0.15).translate(...P(sx, 3.02, sz)));
    const rh = frame(P(sx - 0.06, 3.92, sz + 0.06), handTurn([0.2, -0.15, -1], [0, -1, 0]), 0.6 * U);
    for (const hg of handGeos({ curl: 0.75, spread: 0.04, thumb: 0.6 })) add(hg.applyMatrix4(rh));
    kingHead(add, frame(P(0.08, 6.92, 0), [0, 0, 0.04], U), { seed: seed + 2, crack: true, fine: 0.06, coarse: 0.26 });
    // moss on his shoulders, his raised hand, his feet and the plinth
    moss(...P(-0.05, 6.06, -0.75), 0.34, 0.45);
    moss(...P(-0.1, 6.03, 0.8), 0.3, 0.45);
    moss(...P(1.0, 0.18, 0.42), 0.2, 0.5);
    moss(...P(-0.9, 0.05, -0.9), 0.4, 0.4);
    moss(...P(1.4, 0.0, -0.9), 0.36, 0.4);
  }
  bk.add(mats.grass, grassGeo(tufts, seed + 13));
  if (ferns.length) {
    const fg = fernGeo(seed + 4);
    ferns.forEach(([x, y, z, ry, s]) => bk.add(mats.fern, fg.clone(), { p: [x, y, z], r: [0, ry, 0], s }));
  }
  bk.build(g);
  return { group: g };
}
