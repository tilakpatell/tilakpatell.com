// The Uruk-hai and Lurtz, and the Horn of Gondor. Moved out of props.js as
// they were; their skin’s shader is the kit’s.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, makeNoise, smooth } from '../../../../lib/paint';
import { B, ball, cyl, lathe, parts, rng, tf, tube } from '../../shire/build';
import { _kc, _nv, _pv, C, ext, keepTris, ringAt, rod, shapeOf, sweep3, TAU, tint, UP, V3 } from './helpers';

// ── the Uruk-hai ──

// Where a point falls on the war-paint sheet: square q (0 a face, 1 Lurtz's
// face, 2 a shield, 3 bare), (u, v) 0..1 within it.
export const sheet = (q, u, v) => [(q % 2) * 0.5 + 0.5 * Math.min(0.97, Math.max(0.03, u)), (q < 2 ? 0.5 : 0) + 0.5 * Math.min(0.97, Math.max(0.03, v))];
export const BARE = sheet(3, 0.5, 0.5);

// One rigid part of a figure: its pieces merged into one geometry for the
// Uruk-hai's material, each coloured in its vertices (a colour, or
// fn(x, y, z, out, nx, ny, nz)), lit a little from above and mottled, with
// how much of it is iron and, where `paint` says (test(centre, normal) for
// a triangle, map(x, y, z) for its corners), its place on the war-paint
// sheet. `m` moves a piece after it is coloured.
export function figPart(seed = 1) {
  const list = [];
  const n = makeNoise(seed);
  const c = V3();
  const nr = V3();
  const api = {
    add(geo, colour, { p, r, s, m = null, metal = 0, flat = false, paint = null, grain = 0.07 } = {}) {
      tf(geo, { p, r, s });
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (flat || !g.attributes.normal) g.computeVertexNormals();
      const P = g.attributes.position;
      const N = g.attributes.normal;
      const count = P.count;
      const col = new Float32Array(count * 3);
      const puv = new Float32Array(count * 2);
      const fixed = typeof colour === 'function' ? null : C(colour);
      for (let i = 0; i < count; i++) {
        const x = P.getX(i);
        const y = P.getY(i);
        const z = P.getZ(i);
        const ny = N.getY(i);
        if (fixed) _kc.copy(fixed);
        else colour(x, y, z, _kc, N.getX(i), ny, N.getZ(i));
        _kc.multiplyScalar((0.8 + 0.2 * (ny * 0.5 + 0.5)) * (1 - grain + n(x * 11 + z * 7, y * 11) * grain * 2));
        col[i * 3] = _kc.r;
        col[i * 3 + 1] = _kc.g;
        col[i * 3 + 2] = _kc.b;
      }
      for (let i = 0; i < count; i += 3) {
        let on = false;
        if (paint) {
          c.set(0, 0, 0);
          nr.set(0, 0, 0);
          for (let k = 0; k < 3; k++) {
            c.add(_pv.fromBufferAttribute(P, i + k));
            nr.add(_nv.fromBufferAttribute(N, i + k));
          }
          on = paint.test(c.multiplyScalar(1 / 3), nr.normalize());
        }
        for (let k = 0; k < 3; k++) {
          const [u, v] = on ? paint.map(P.getX(i + k), P.getY(i + k), P.getZ(i + k)) : BARE;
          puv[(i + k) * 2] = u;
          puv[(i + k) * 2 + 1] = v;
        }
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', P);
      out.setAttribute('normal', N);
      out.setAttribute('color', new THREE.BufferAttribute(col, 3));
      out.setAttribute('metal', new THREE.BufferAttribute(new Float32Array(count).fill(metal), 1));
      out.setAttribute('puv', new THREE.BufferAttribute(puv, 2));
      if (m) out.applyMatrix4(m);
      list.push(out);
      return api;
    },
    build(material, name) {
      const geo = mergeGeometries(list);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = name;
      list.length = 0;
      return mesh;
    },
  };
  return api;
}

export const URUK = {
  skin: [C(0x4c4238), C(0x403b36), C(0x55483c), C(0x4a403a)],
  lurtz: C(0x655e55),
  iron: C(0x232326),
  leather: C(0x2e241c),
  strap: C(0x3c2e22),
  hair: C(0x0d0b0a),
  steel: C(0x5a5d63),
  tooth: C(0xc4b48a),
  eye: C(0x4a3a14),
  shield: C(0x141313),
  wood: C(0x2a2018),
};
export const mat4 = (p, r = [0, 0, 0]) => new THREE.Matrix4().compose(V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V3(1, 1, 1));

// A heavy Uruk blade, up its own y from the grip: broad and single-edged,
// the edge bellied, the back curving away to a clipped point; a bar guard,
// a bound grip, an iron pommel.
export function urukBlade(bk, m) {
  const pts = [[-0.026, 0.15], [-0.034, 0.45], [-0.046, 0.72], [-0.07, 0.92], [-0.03, 1.0], [0.052, 0.9], [0.078, 0.62], [0.064, 0.34], [0.046, 0.15]];
  const shape = shapeOf(pts.map(([x, y]) => [x - 0.08 * ((y - 0.15) / 0.85) ** 2, y]));
  bk.add(ext(shape, 0.016, 0, 1), URUK.steel, { p: [0, 0, -0.008], m, metal: 1, flat: true, grain: 0.15 });
  bk.add(B(0.2, 0.034, 0.05), URUK.iron, { p: [0.005, 0.135, 0], m, metal: 1 });
  bk.add(cyl(0.021, 0.023, 0.22, 6), URUK.strap, { p: [0, 0.015, 0], m });
  bk.add(ball(0.032, 6, 4), URUK.iron, { p: [0, -0.1, 0], m, metal: 1, flat: true });
}

// The round black shield of the Uruk-hai, its face towards its own +x:
// domed boards painted black with the White Hand on them, an iron rim.
export function urukShield(bk, m) {
  const R = 0.39;
  const face = { test: (c, nrm) => nrm.x > 0.3, map: (x, y, z) => sheet(2, 0.5 - z / (2.1 * R), 0.5 + y / (2.1 * R)) };
  bk.add(lathe([[R - 0.015, 0], [0.3, 0.03], [0.16, 0.052], [0.001, 0.06]], 20), URUK.shield, { r: [0, 0, -Math.PI / 2], m, paint: face, grain: 0.12 });
  bk.add(new THREE.TorusGeometry(R - 0.008, 0.022, 4, 20), URUK.iron, { r: [0, Math.PI / 2, 0], m, metal: 1, flat: true });
  bk.add(new THREE.CircleGeometry(R - 0.01, 16), URUK.wood, { p: [-0.02, 0, 0], r: [0, -Math.PI / 2, 0], m });
}

// Lurtz's bow: long and black, its grip bound, held upright with its belly
// to +x; the string behind.
export function urukBow(bk, m) {
  const limb = (sd) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * sd;
      pts.push([0.12 * (1 - t * t) - 0.06 * Math.pow(Math.abs(t), 6), t * 0.74, 0]);
    }
    return pts;
  };
  for (const sd of [-1, 1]) bk.add(tube(limb(sd), 0.03, 0.012, { seg: 10, radial: 5 }), URUK.shield, { m, metal: 0.3, grain: 0.1 });
  bk.add(cyl(0.03, 0.03, 0.15, 6), URUK.strap, { p: [0.12, 0, 0], m });
  bk.add(tube([[-0.06, -0.74, 0], [-0.02, 0, 0], [-0.06, 0.74, 0]], 0.004, 0.004, { seg: 2, radial: 3 }), C(0x8a8478), { m, grain: 0 });
}

// A Uruk-hai, about 2.1 m: bigger and broader than any Man of the toy
// world, hunched, long in the arm, dark brownish-grey (Lurtz paler, and
// scarred), long black hair, the White Hand smeared across his face; black
// iron on his chest, shoulders, knees, shins and forearms; a heavy curved
// blade in his right hand, and on his left arm the round black shield with
// the Hand on it (Lurtz, a black bow). Faces +x, on y = 0. One mesh for
// each part that moves (the legs, the body, the head, the arms, the blade
// arm's forearm), all of one material.
export function uruk(K, seed = 1, { lurtz = false } = {}) {
  const mat = K.mats.uruk;
  const r = rng(seed * 13 + 5);
  const skinC = lurtz ? URUK.lurtz.clone() : URUK.skin[seed % URUK.skin.length].clone().multiplyScalar(0.92 + r() * 0.16);
  const skin = (x, y, z, out) => out.copy(skinC);
  const g = new THREE.Group();
  g.name = lurtz ? 'lurtz' : 'urukhai';
  const HIP = 1.0;

  // the legs, from the hips: leather breeches, iron knees and greaves,
  // the shins bound, heavy boots
  const legs = [-1, 1].map((sd) => {
    const leg = new THREE.Group();
    leg.position.set(0, HIP, sd * 0.17);
    const bk = figPart(seed * 5 + sd);
    bk.add(rod([0, 0.06, 0], [0.05, -0.47, 0], 0.14, 0.105, 8), URUK.leather);
    bk.add(ball(0.08, 7, 5), URUK.iron, { p: [0.085, -0.47, 0], s: [0.75, 1, 1.05], metal: 1, flat: true });
    bk.add(rod([0.05, -0.47, 0], [0, -0.86, 0], 0.1, 0.08, 7), skin);
    bk.add(new THREE.CylinderGeometry(0.112, 0.094, 0.34, 7, 1, true, Math.PI / 2 - 1.5, 3.0), URUK.iron, { p: [0.03, -0.68, 0], r: [0, 0, -0.12], metal: 1, flat: true });
    bk.add(cyl(0.096, 0.102, 0.09, 7), URUK.strap, { p: [0, -0.86, 0] });
    bk.add(ball(0.1, 8, 6), URUK.leather, { p: [0.07, -0.93, 0], s: [1.7, 0.72, 1.05] });
    leg.add(bk.build(mat, 'leg'));
    g.add(leg);
    return leg;
  });

  // the body, hunched: a barrel of a chest under a black breastplate, a
  // belt and a skirt of leather and iron strips, a bull's neck
  const torso = new THREE.Group();
  torso.position.y = HIP;
  g.add(torso);
  const tb = figPart(seed * 5 + 7);
  tb.add(sweep3([[0, -0.15, 0], [0.01, 0.14, 0], [0.04, 0.4, 0], [0.05, 0.6, 0]], [[0.17, 0.25, 0.16], [0.2, 0.27, 0.18], [0.24, 0.35, 0.21], [0.15, 0.32, 0.17]], { seg: 8, radial: 12, sq: 2.3 }), skin);
  const plate = sweep3([[0.01, -0.03, 0], [0.02, 0.18, 0], [0.045, 0.42, 0], [0.05, 0.57, 0]], [[0.215, 0.285, 0.19], [0.235, 0.3, 0.2], [0.275, 0.375, 0.23], [0.19, 0.345, 0.19]], { seg: 6, radial: 14, sq: 2.3, caps: [false, false] });
  tb.add(keepTris(plate, (c) => c.x > 0), URUK.iron, { metal: 1, flat: true });
  tb.add(new THREE.CylinderGeometry(0.29, 0.28, 0.09, 14, 1, true), URUK.strap, { p: [0.01, 0, 0], s: [0.78, 1, 1] });
  tb.add(B(0.04, 0.09, 0.1), URUK.iron, { p: [0.235, 0, 0], metal: 1 });
  for (let i = 0; i < 7; i++) {
    const a = -1.7 + (i / 6) * 3.4;
    const front = Math.abs(a) < 1;
    tb.add(B(0.025, 0.36, 0.15), front ? URUK.iron : URUK.leather, { p: [0.01 + Math.cos(a) * 0.215, -0.22, Math.sin(a) * 0.29], r: [0, -a, 0.16], metal: front ? 1 : 0, flat: true });
  }
  tb.add(B(0.025, 0.4, 0.34), URUK.leather, { p: [-0.18, -0.22, 0], r: [0, Math.PI, 0.16], flat: true });
  tb.add(rod([0.03, 0.48, 0], [0.13, 0.72, 0], 0.13, 0.1, 8), skin);
  for (const sd of [-1, 1]) tb.add(ball(0.13, 8, 6), skin, { p: [0, 0.56, sd * 0.19], s: [0.95, 0.62, 1.15] });
  if (lurtz) {
    // a quiver over his right shoulder, black-fletched arrows in it
    const qm = mat4([-0.24, 0.3, 0.06], [0.4, 0, 0.15]);
    tb.add(cyl(0.07, 0.06, 0.62, 7), URUK.leather, { m: qm });
    for (let i = 0; i < 5; i++) tb.add(new THREE.ConeGeometry(0.022, 0.12, 3), URUK.hair, { p: [(i % 2) * 0.04 - 0.02, 0.36 + (i % 3) * 0.03, (i - 2) * 0.022], m: qm });
  }
  torso.add(tb.build(mat, 'body'));

  // the head: a heavy brow, a broad flat nose, a jaw like a trap and two
  // fangs up out of it; small eyes; long black hair down the back and in
  // two locks over the shoulders. The Hand's paint is planed onto the face.
  const head = new THREE.Group();
  head.position.set(0.15, 0.83, 0);
  head.scale.setScalar(1.12);
  torso.add(head);
  const hb = figPart(seed * 5 + 11);
  const q = lurtz ? 1 : 0;
  const face = { test: (c, nrm) => nrm.x > 0.15 && c.x > 0.03, map: (x, y, z) => sheet(q, 0.5 + z / 0.44, 0.5 + (y + 0.02) / 0.48) };
  hb.add(ball(0.2, 14, 10), skin, { s: [1, 1.08, 0.92], paint: face });
  hb.add(ball(0.1, 8, 5), skin, { p: [0.15, 0.065, 0], s: [0.55, 0.3, 1.7], paint: face });
  hb.add(ball(0.06, 6, 4), skin, { p: [0.195, -0.035, 0], s: [0.85, 0.85, 1.35], paint: face });
  hb.add(B(0.2, 0.14, 0.27), skin, { p: [0.09, -0.15, 0], flat: true, paint: face });
  for (const sd of [-1, 1]) {
    hb.add(ball(0.02, 6, 4), URUK.eye, { p: [0.172, 0.014, sd * 0.068], grain: 0 });
    hb.add(new THREE.ConeGeometry(0.017, 0.065, 4), URUK.tooth, { p: [0.19, -0.11, sd * 0.075], grain: 0 });
    hb.add(new THREE.ConeGeometry(0.045, 0.13, 4), skin, { p: [-0.01, 0.03, sd * 0.19], r: [sd * 1.2, 0, 0.9] });
  }
  hb.add(new THREE.SphereGeometry(0.212, 12, 7, -2.05, 4.1, 0, 1.95), URUK.hair, { s: [1.02, 1.09, 0.95], p: [-0.005, 0.005, 0], grain: 0.2 });
  const hn = makeNoise(seed + 40);
  hb.add(sweep3([[-0.06, 0.15, 0], [-0.19, 0, 0], [-0.27, -0.3, 0], [-0.31, -0.64, 0]], [[0.1, 0.18, 0.1], [0.1, 0.21, 0.09], [0.08, 0.23, 0.07], [0.04, 0.2, 0.03]], { seg: 7, radial: 10, bump: (p, o, u, v) => (hn(u * 12, v * 3) - 0.5) * 0.06 * (0.3 + v) }), URUK.hair, { grain: 0.25 });
  for (const sd of [-1, 1]) hb.add(tube([[0, 0.03, sd * 0.19], [0.03, -0.22, sd * 0.235], [0.06, -0.48, sd * 0.25]], 0.05, 0.02, { seg: 5, radial: 5 }), URUK.hair, { grain: 0.25 });
  head.add(hb.build(mat, 'head'));

  // the arms, from the shoulders: bare and long, iron on the shoulders in
  // two lames and on the forearms
  const armAt = (sd) => {
    const sh = new THREE.Group();
    sh.position.set(0.03, 0.55, sd * 0.42);
    torso.add(sh);
    const ab = figPart(seed * 5 + 20 + sd);
    ab.add(rod([0, 0.05, 0], [0.02, -0.36, sd * 0.03], 0.11, 0.088, 8), skin);
    ab.add(new THREE.SphereGeometry(0.155, 9, 4, 0, TAU, 0, 1.2), URUK.iron, { p: [-0.005, 0.03, sd * 0.03], s: [1.05, 0.85, 1], r: [sd * 0.4, 0, 0], metal: 1, flat: true });
    ab.add(new THREE.SphereGeometry(0.168, 9, 1, 0, TAU, 1.05, 0.45), URUK.iron, { p: [-0.005, 0.0, sd * 0.05], s: [1.05, 0.9, 1], r: [sd * 0.45, 0, 0], metal: 1, flat: true });
    return { sh, ab };
  };
  const forearm = (bk, m) => {
    bk.add(rod([0, 0, 0], [0, -0.34, 0], 0.088, 0.07, 7), skin, { m });
    bk.add(new THREE.CylinderGeometry(0.092, 0.08, 0.2, 7, 1, true), URUK.iron, { p: [0, -0.2, 0], m, metal: 1, flat: true });
    bk.add(ball(0.078, 7, 5), skin, { p: [0.01, -0.4, 0], s: [1.1, 1, 0.9], m });
  };
  // the right: the blade arm, bending at the elbow
  const R = armAt(1);
  R.sh.add(R.ab.build(mat, 'arm'));
  const elbow = new THREE.Group();
  elbow.position.set(0.02, -0.36, 0.03);
  R.sh.add(elbow);
  const fb = figPart(seed * 5 + 30);
  forearm(fb, null);
  urukBlade(fb, mat4([0.01, -0.4, 0], [0, 0, -2.54]));
  elbow.add(fb.build(mat, 'forearm'));
  // the left, bent and held out: the shield, or Lurtz's bow
  const L = armAt(-1);
  forearm(L.ab, mat4([0.02, -0.36, -0.03], [0, 0, lurtz ? 0.55 : 0.95]));
  if (lurtz) urukBow(L.ab, mat4([0.24, -0.71, -0.05]));
  else {
    const sm = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), V3(0.45, 0.05, -0.89).normalize())).setPosition(0.17, -0.47, -0.17);
    urukShield(L.ab, sm);
  }
  L.sh.add(L.ab.build(mat, 'arm'));

  // running, the blade swung (0 carried, about half up behind the head, 1
  // brought down in a chop), the head turned to look
  const animate = (t, { running = false, swing = 0, look = 0 } = {}) => {
    const ph = t * 9.5;
    const sw = running ? Math.sin(ph) : 0;
    legs[0].rotation.set(0.05, 0, sw * 0.75);
    legs[1].rotation.set(-0.05, 0, -sw * 0.75);
    torso.position.y = HIP + (running ? Math.abs(Math.cos(ph)) * 0.09 - 0.05 : Math.sin(t * 1.7) * 0.012);
    const raise = smooth(0, 0.55, swing);
    const strike = smooth(0.55, 1, swing);
    torso.rotation.set(0, -0.28 * raise + 0.42 * strike, -(running ? 0.3 : 0.1) - strike * 0.15 + Math.sin(t * 1.7) * 0.012);
    L.sh.rotation.set(0, 0, -sw * 0.55 + (running ? 0.15 : 0.05));
    R.sh.rotation.set(-0.08 - 0.35 * raise * (1 - strike), 0, sw * 0.5 + 0.08 + raise * 3.2 - strike * 2.7);
    elbow.rotation.z = 0.35 + raise * 0.9 - strike * 1.15;
    // the head kept up as the body leans, and looking about
    head.rotation.set(0, look + (running ? 0 : Math.sin(t * 0.6 + seed) * 0.12), -torso.rotation.z * 0.6);
  };
  animate(0);
  return { group: g, animate, head, torso, legs, arms: [L.sh, R.sh], top: 2.1 };
}

// ── the Horn of Gondor ──

// Boromir's horn: a great curved ox-horn, cream-white, honey towards the
// mouthpiece, with a fine grain along it; bound in silver, a broad band at
// the bell and its rim, rings at the middle and the throat, a silver
// mouthpiece; a leather baldric cord from throat to bell. About half a
// metre round its curve, lying on its side with the bell to +x.
export function horn(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'horn';
  const bk = parts();
  const n = makeNoise(77);
  const rad = (s) => 0.011 + 0.045 * Math.pow(s, 1.6) + 0.008 * smooth(0.9, 1, s);
  const ang = (s) => -1.25 + s * 2.5;
  const at = (s) => V3(0.2 * Math.sin(ang(s)), rad(s) + 0.002, 0.2 * Math.cos(ang(s)) - 0.12 + 0.03 * s);
  const N = 8;
  const pts = [];
  const radii = [];
  for (let i = 0; i <= N; i++) {
    pts.push(at(i / N));
    radii.push([rad(i / N), rad(i / N)]);
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const body = sweep3(pts, radii, { seg: 28, radial: 14, caps: [true, false] });
  const cream = C(0xece2c8);
  const honey = C(0xa8804a);
  tint(body, (x, y, z, out) => {
    const s = clamp01((Math.asin(Math.max(-1, Math.min(1, x / 0.2))) + 1.25) / 2.5);
    out.copy(honey).lerp(cream, smooth(0.02, 0.6, s));
    out.multiplyScalar(0.9 + (n(s * 3, (y + z) * 40) - 0.5) * 0.18);
  });
  bk.add(mats.horn, body);
  // the dark of the bell
  const dir = curve.getTangentAt(1);
  bk.add(mats.horn, ringAt(curve, 1, new THREE.CircleGeometry(rad(1) * 0.92, 14)).translate(-dir.x * 0.004, -dir.y * 0.004, -dir.z * 0.004), { color: 0x2a2016 });
  // silver: the bell's band and rim, rings at the middle and the throat
  bk.add(mats.silver, ringAt(curve, 0.955, new THREE.CylinderGeometry(rad(0.97) + 0.004, rad(0.94) + 0.004, 0.045, 18, 1, true).rotateX(Math.PI / 2)));
  bk.add(mats.silver, ringAt(curve, 1, new THREE.TorusGeometry(rad(1) + 0.002, 0.005, 5, 18)).translate(dir.x * 0.002, 0, dir.z * 0.002));
  for (const s of [0.48, 0.52, 0.12]) bk.add(mats.silver, ringAt(curve, s, new THREE.TorusGeometry(rad(s) + 0.002, 0.0045, 5, 14)));
  // the mouthpiece
  const m0 = curve.getPointAt(0);
  const d0 = curve.getTangentAt(0).negate();
  const mouth = lathe([[0.001, 0], [0.012, 0], [0.008, 0.02], [0.007, 0.045], [0.012, 0.055], [0.006, 0.058], [0.001, 0.058]], 10);
  mouth.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d0)).translate(m0.x - d0.x * 0.01, m0.y, m0.z - d0.z * 0.01);
  bk.add(mats.silver, mouth);
  // the cord, lying in a loose loop inside the curve
  const a = at(0.12);
  const b = at(0.955);
  bk.add(mats.wood, tube([[a.x, 0.006, a.z], [-0.08, 0.005, -0.02], [0.02, 0.005, -0.08], [0.12, 0.005, -0.03], [b.x, 0.01, b.z]], 0.004, 0.004, { seg: 18, radial: 4 }), { color: 0x4a3020 });
  bk.build(g);
  return { group: g };
}
