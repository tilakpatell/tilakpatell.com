// Those who come: the cave troll, with his chain and club, and the
// goblins. Moved out of props.js as they were.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, paintPixels, smooth } from '../../../../lib/paint';
import { ball, lathe, parts, rng } from '../../shire/build';
import { createShot, createStride, createTracker, ease, footAt, legRig } from '../../creatures';
import { _kd, along, lump, noise3, rod, sweep3, TAU, tint, UP, V3 } from './helpers';

// ── the cave troll ──

// A troll's hide, for laying on from three sides: red its height (warts of
// all sizes, folds and wrinkles, pores), green mottling, blue dark freckles
// and the grime in its creases.
export function wartCanvas(S = 256) {
  const n = makeNoise(171);
  const cells = makeCells(173);
  const fine = makeCells(177);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, px, py) => {
    const k = cells(u * 5, v * 5, 5);
    const wart = Math.pow(1 - smooth(0.0, 0.34 + k.id * 0.18, k.f1), 1.5) * (k.id > 0.45 ? 1 : 0.2);
    const f = fine(u * 16, v * 16, 16);
    const small = (1 - smooth(0.0, 0.28, f.f1)) * (f.id > 0.55 ? 1 : 0);
    const fold = 1 - Math.abs(fbm(n, u * 4, v * 4, { period: 4, octaves: 4 }) * 2 - 1);
    const wrinkle = Math.pow(1 - Math.abs(fbm(n, u * 10 + 3, v * 10, { period: 10, octaves: 2 }) * 2 - 1), 6);
    const pore = n(u * 64, v * 64, 64);
    field[py * S + px] = clamp01(0.42 + wart * 0.4 + small * 0.14 - Math.pow(fold, 8) * 0.3 - wrinkle * 0.16 + (pore - 0.5) * 0.06);
    out[0] = field[py * S + px] * 255;
    out[1] = fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 3 }) * 255;
    out[2] = clamp01(smooth(0.74, 0.86, n(u * 20 + 5, v * 20, 20)) * 0.5 + Math.pow(fold, 8) * 0.45 + wrinkle * 0.25 - wart * 0.2) * 255;
  });
  return { c, field };
}

// A chain of iron links along points, every other one turned square; the
// last one broken open if asked. Added to `bk`.
export function chainParts(bk, mat, pts, { r = 0.07, wire = 0.022, broken = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V3(...p))));
  const len = curve.getLength();
  const step = r * 2.3;
  const count = Math.max(2, Math.floor(len / step));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const at = curve.getPointAt(t);
    const d = curve.getTangentAt(t);
    const last = broken && i === count - 1;
    const link = new THREE.TorusGeometry(r, wire, 5, 10, last ? TAU * 0.72 : TAU).scale(1, 1.45, 1);
    link.rotateY(i % 2 ? Math.PI / 2 : 0);
    bk.add(mat, along(link, d, at));
  }
}

// The cave troll, about 4.5 m tall, facing +x: grey-green and warty, hunched
// over a heavy belly, short bowed legs, long arms to huge hands, a small head
// thrust forward with an underbite and tusks; a broken chain hanging from an
// iron collar at its neck and a shackle on its left wrist; a huge spiked
// club in its right hand, resting on the ground ahead. Each part in its own
// group, pivoted at its joint: body (at the hips), head, arms [l, r] at the
// shoulders (each with .fore and .hand), legs [l, r] at the hips (each with
// .shin), club. animate(t, { swing, roar, reach }): swing 0..1 lifts the
// club overhead (to 0.5) and brings it down on the ground ahead along +x;
// left at 0 with `reach` (metres to whoever it's after) it swings on its
// own, started so the club comes down as it gets to them, and not again for
// a moment after. roar (0 or 1: it's hunting) roars once as it takes up the
// hunt, chest out and arms wide, then snarls while it hunts. Its walk is
// read from where the scene puts it (../../creatures.js), heavy and
// lengthening as it lumbers into a run; `walking` is no longer needed.
export function caveTroll(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'caveTroll';
  const n = makeNoise(181);
  const r = rng(181);
  // the skin's colour: grey-green, mottled, paler on the belly and under
  // the jaw, darker on the back and down in the creases and undersides
  const skin = (geo, { belly = 0, dark = 0 } = {}) => tint(geo, (x, y, z, out, nx, ny) => {
    const m = noise3(n, x * 1.4, y * 1.4, z * 1.4);
    const blot = smooth(0.45, 0.65, noise3(n, x * 0.6 + 7, y * 0.6, z * 0.6));
    out.setRGB(0.3, 0.35, 0.28).multiplyScalar(0.78 + m * 0.4).lerp(_kd.setRGB(0.2, 0.24, 0.17), blot * 0.6);
    out.lerp(_kd.setRGB(0.44, 0.44, 0.36), clamp01(belly * (0.3 + nx * 0.7)));
    out.multiplyScalar((0.62 + 0.38 * smooth(-0.8, 0.4, ny)) * (1 - dark));
  });
  const part = (bk, geo, o) => bk.add(mats.trollSkin, skin(geo, o));
  const blobAt = (rad, p, s = [1, 1, 1], detail = 2, seed = 0, rot = [0, 0, 0]) => lump(rad, { p, s, r: rot }, { detail, amp: 0.1, freq: 1.4, seed: 190 + seed });
  const group = (name, parent, p) => {
    const o = new THREE.Group();
    o.name = name;
    o.position.set(...p);
    parent.add(o);
    return o;
  };

  // ── the hips, the loincloth, and the legs
  const HIPS = [-0.1, 1.85, 0];
  const hips = group('hips', g, HIPS);
  {
    const bk = parts();
    part(bk, blobAt(0.72, [0, 0.02, 0], [0.95, 0.78, 1.28], 3, 1));
    // a hide wrapped round the loins, belted with rope, torn at its hem
    const rag = new THREE.CylinderGeometry(0.98, 1.08, 0.8, 22, 4, true);
    const p = rag.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i);
      const a = Math.atan2(z, x);
      const low = y < -0.3;
      const tear = low ? (n(a * 3 + 5, 2) - 0.5) * 0.5 - Math.max(0, Math.cos(a * 3)) * 0.2 : 0;
      const k = 1 + 0.05 * Math.sin(a * 9) * (0.5 - y);
      p.setXYZ(i, x * k * 0.95, y + tear, z * k * 1.12);
    }
    rag.computeVertexNormals();
    bk.add(mats.hideCloth, rag, { p: [0.05, -0.12, 0] });
    bk.add(mats.rope, new THREE.TorusGeometry(1, 0.05, 5, 26).scale(0.96, 1.16, 1).rotateX(Math.PI / 2), { p: [0.05, 0.24, 0] });
    bk.build(hips);
  }
  const legs = [-1, 1].map((s) => {
    const leg = group(s < 0 ? 'legL' : 'legR', hips, [0.02, -0.12, s * 0.58]);
    const bk = parts();
    part(bk, sweep3([[0, 0.05, 0], [0.18, -0.42, s * 0.05], [0.3, -0.82, s * 0.07]], [[0.48, 0.5], [0.46, 0.47], [0.34, 0.35]], { seg: 9, radial: 14 }));
    bk.build(leg);
    const shin = group('shin', leg, [0.3, -0.84, s * 0.07]);
    const sk = parts();
    part(sk, blobAt(0.32, [0.03, 0, 0], [1, 0.9, 1], 2, 2 + s));
    part(sk, sweep3([[0, 0, 0], [-0.07, -0.38, 0], [-0.09, -0.66, 0]], [[0.33, 0.34], [0.32, 0.33], [0.25, 0.27]], { seg: 8, radial: 14 }));
    part(sk, blobAt(0.28, [-0.17, -0.22, 0], [0.8, 1.2, 0.9], 2, 4 + s));
    // the foot: broad and flat, four stubby toes, thick yellow nails
    part(sk, blobAt(0.42, [0.18, -0.79, 0], [1.18, 0.38, 0.78], 2, 6 + s));
    for (let t = 0; t < 4; t++) {
      const tz = (t - 1.5) * 0.15 + s * 0.02;
      part(sk, blobAt(0.11, [0.62 - Math.abs(t - 1.5) * 0.05, -0.83, tz], [1.35, 0.8, 1], 1, 8 + t));
      sk.add(mats.nail, blobAt(0.055, [0.74 - Math.abs(t - 1.5) * 0.05, -0.81, tz], [0.9, 0.6, 1.1], 1, 12 + t));
    }
    sk.build(shin);
    leg.shin = shin;
    return leg;
  });

  // ── the body: a heavy belly, a chest, a hump of a back, all hunched forward
  const body = group('body', hips, [0, 0.1, 0]);
  {
    const bk = parts();
    part(bk, sweep3([[0.05, -0.15, 0], [0.15, 0.5, 0], [0.24, 1.12, 0], [0.42, 1.62, 0], [0.62, 1.88, 0]], [[0.72, 0.88, 0.68], [0.86, 1.02, 0.72], [0.9, 1.1, 0.78], [0.72, 1.02, 0.68], [0.45, 0.6, 0.45]], { seg: 16, radial: 20 }), { belly: 0.6 });
    part(bk, blobAt(0.96, [0.44, 0.34, 0], [0.98, 0.92, 1.06], 3, 20), { belly: 1 });
    part(bk, blobAt(0.18, [1.36, 0.42, 0], [0.4, 0.5, 0.4], 1, 21), { belly: 1, dark: 0.25 });
    for (const s of [-1, 1]) {
      part(bk, blobAt(0.42, [0.64, 1.24, s * 0.42], [0.55, 0.75, 1.0], 2, 22 + s), { belly: 0.5 });
      part(bk, blobAt(0.52, [0.3, 1.74, s * 0.62], [1, 0.9, 1], 2, 24 + s));
      // the love handles sagging over the belt
      part(bk, blobAt(0.4, [0.0, 0.2, s * 0.85], [1.1, 0.8, 0.7], 2, 26 + s));
    }
    part(bk, blobAt(0.76, [-0.16, 1.44, 0], [0.82, 0.85, 1.25], 2, 28), { dark: 0.08 });
    // the neck, thick and short, thrust forward
    part(bk, sweep3([[0.5, 1.72, 0], [0.82, 1.92, 0], [1.06, 2.0, 0]], [[0.44, 0.52], [0.38, 0.44], [0.3, 0.34]], { seg: 6, radial: 14 }));
    // the iron collar, and its chain hanging over the chest and belly
    bk.add(mats.forged, along(new THREE.TorusGeometry(0.43, 0.07, 6, 18).rotateX(Math.PI / 2).scale(1, 1, 1.12), V3(0.4, 0.92, 0), V3(0.82, 1.9, 0)));
    bk.add(mats.forged, along(new THREE.TorusGeometry(0.1, 0.03, 5, 10), V3(1, 0, 0), V3(1.08, 1.78, 0)));
    chainParts(bk, mats.forged, [[1.1, 1.7, 0.02], [1.28, 1.28, 0.05], [1.44, 0.86, 0.02], [1.45, 0.5, -0.05]], { r: 0.075, wire: 0.024 });
    bk.build(body);
  }

  // ── the head: small, low, thrust forward, a heavy brow, a broad flat nose,
  // little eyes, a jaw slung under it with tusks
  const head = group('head', body, [1.08, 2.02, 0]);
  const jaw = group('jaw', head, [0.08, -0.06, 0]);
  {
    const bk = parts();
    part(bk, blobAt(0.36, [0.0, 0.22, 0], [1.15, 0.78, 0.95], 2, 30));
    part(bk, sweep3([[0.28, 0.28, -0.29], [0.4, 0.3, 0], [0.28, 0.28, 0.29]], [[0.1, 0.1], [0.13, 0.12], [0.1, 0.1]], { seg: 6, radial: 8, side: [0, 1, 0] }), { dark: 0.05 });
    part(bk, blobAt(0.3, [0.28, 0.05, 0], [0.92, 0.9, 1.12], 2, 31));
    part(bk, blobAt(0.13, [0.53, 0.11, 0], [0.75, 0.72, 1.35], 2, 32), { dark: 0.05 });
    for (const s of [-1, 1]) {
      bk.add(mats.void, ball(0.032, 6, 4), { p: [0.6, 0.06, s * 0.07] });
      part(bk, blobAt(0.17, [0.33, 0.0, s * 0.21], [1, 0.9, 0.9], 1, 33 + s));
      part(bk, blobAt(0.13, [-0.06, 0.15, s * 0.33], [0.5, 1.0, 0.35], 1, 35 + s), { dark: 0.15 });
      // the eyes, small, deep under the brow, wet
      part(bk, blobAt(0.07, [0.4, 0.19, s * 0.13], [0.8, 0.7, 1], 1, 37 + s), { dark: 0.4 });
      bk.add(mats.trollEye, ball(0.042, 8, 6), { p: [0.44, 0.19, s * 0.13] });
      // the upper teeth, small and broken
      bk.add(mats.tooth, new THREE.ConeGeometry(0.022, 0.07, 5), { p: [0.5, -0.04, s * 0.06], r: [Math.PI, 0, 0] });
      bk.add(mats.tooth, new THREE.ConeGeometry(0.02, 0.06, 5), { p: [0.47, -0.04, s * 0.13], r: [Math.PI, 0, 0] });
    }
    bk.build(head);
    const jk = parts();
    part(jk, blobAt(0.34, [0.28, -0.15, 0], [1.15, 0.6, 1.3], 2, 40), { belly: 0.6 });
    part(jk, blobAt(0.19, [0.56, -0.12, 0], [1, 0.95, 1.25], 1, 41), { belly: 0.4 });
    part(jk, sweep3([[0.56, -0.02, -0.22], [0.64, 0.0, 0], [0.56, -0.02, 0.22]], [[0.06, 0.06], [0.075, 0.075], [0.06, 0.06]], { seg: 6, radial: 6, side: [0, 1, 0] }));
    jk.add(mats.mouth, blobAt(0.22, [0.34, -0.04, 0], [1.0, 0.42, 0.95], 1, 42));
    for (const s of [-1, 1]) {
      jk.add(mats.tooth, new THREE.ConeGeometry(0.045, 0.26, 6), { p: [0.58, 0.09, s * 0.16], r: [s * 0.12, 0, -0.2] });
      jk.add(mats.tooth, new THREE.ConeGeometry(0.024, 0.08, 5), { p: [0.62, 0.03, s * 0.06] });
    }
    jk.build(jaw);
  }
  head.jaw = jaw;

  // ── the arms: long, the knuckles hanging to the knees; huge hands
  const arms = [-1, 1].map((s) => {
    const arm = group(s < 0 ? 'armL' : 'armR', body, [0.3, 1.6, s * 1.0]);
    const bk = parts();
    part(bk, blobAt(0.46, [0.02, 0.06, s * 0.05], [1, 1, 1], 2, 50 + s));
    part(bk, sweep3([[0, 0, 0], [0.09, -0.55, s * 0.1], [0.18, -1.05, s * 0.18]], [[0.36, 0.38], [0.39, 0.36], [0.28, 0.3]], { seg: 9, radial: 14 }));
    bk.build(arm);
    const fore = group('fore', arm, [0.18, -1.05, s * 0.18]);
    const fk = parts();
    part(fk, blobAt(0.3, [0, 0, 0], [1, 1, 1], 1, 52 + s));
    part(fk, sweep3([[0, 0, 0], [0.1, -0.5, 0], [0.18, -0.98, 0]], [[0.3, 0.32], [0.35, 0.37], [0.24, 0.27]], { seg: 9, radial: 14 }));
    if (s < 0) {
      // the shackle on his left wrist, and its broken chain
      fk.add(mats.forged, along(lathe([[0.3, -0.12], [0.32, -0.1], [0.32, 0.1], [0.3, 0.12]], 16), V3(0.08, -0.48, 0), V3(0.16, -0.82, 0)));
      fk.add(mats.forged, ball(0.05, 6, 4), { p: [0.2, -0.82, s * 0.31] });
      chainParts(fk, mats.forged, [[0.2, -0.86, s * 0.33], [0.24, -1.2, s * 0.36], [0.14, -1.6, s * 0.34], [0.06, -1.9, s * 0.3]], { r: 0.06, wire: 0.02 });
    }
    fk.build(fore);
    const hand = group('hand', fore, [0.18, -0.98, 0]);
    const hk = parts();
    part(hk, blobAt(0.32, [0.04, -0.2, 0], [0.75, 1.0, 1.0], 2, 54 + s));
    const grip = s > 0;
    // the fingers: thick, knuckled, curled round the club's haft (right) or
    // half-closed (left)
    for (let f = 0; f < 4; f++) {
      const z = (f - 1.5) * 0.13;
      const a0 = V3(0.08, -0.42, z);
      const pts = grip
        ? [a0, V3(0.27, -0.5, z), V3(0.3, -0.66, z * 1.05), V3(0.15, -0.7, z)]
        : [a0, V3(0.14, -0.62, z), V3(0.24, -0.78, z * 1.05), V3(0.34, -0.84, z * 1.1)];
      part(hk, sweep3(pts, [[0.085, 0.085], [0.08, 0.08], [0.07, 0.07], [0.06, 0.06]], { seg: 6, radial: 8 }));
      const tip = pts[3];
      hk.add(mats.nail, lump(0.045, { p: [tip.x + 0.02, tip.y, tip.z], s: [1, 0.6, 1] }, { detail: 1, amp: 0.1 }));
    }
    const th = grip ? [V3(0.1, -0.22, s * 0.22), V3(0.24, -0.38, s * 0.2), V3(0.3, -0.5, s * 0.08)] : [V3(0.1, -0.22, s * 0.22), V3(0.22, -0.42, s * 0.24), V3(0.32, -0.52, s * 0.18)];
    part(hk, sweep3(th, [[0.1, 0.1], [0.09, 0.09], [0.07, 0.07]], { seg: 5, radial: 8 }));
    hk.build(hand);
    arm.fore = fore;
    fore.hand = hand;
    arm.hand = hand;
    return arm;
  });

  // ── the club: a gnarled trunk, banded with iron and driven through with
  // spikes, its haft wrapped where he holds it
  const club = new THREE.Group();
  club.name = 'club';
  club.position.set(0.22, -0.58, 0);
  club.quaternion.setFromUnitVectors(UP, V3(0.95, -0.3, 0.06).normalize());
  arms[1].hand.add(club);
  {
    const ck = parts();
    const shaft = sweep3([[0, -0.38, 0], [0, 0.4, 0], [0.02, 1.1, 0.01], [0, 1.8, 0], [0.01, 2.5, 0]], [[0.075, 0.075], [0.085, 0.085], [0.16, 0.16], [0.27, 0.27], [0.3, 0.3]], { seg: 14, radial: 10, bump: (p) => (fbm(n, p.y * 4, Math.atan2(p.z, p.x) * 2, { octaves: 2 }) - 0.5) * 0.05 });
    ck.add(mats.clubWood, shaft);
    ck.add(mats.clubWood, lump(0.4, { p: [0, 2.38, 0], s: [1, 1.3, 1] }, { detail: 2, amp: 0.18, seed: 7 }), { uv: 1.5 });
    ck.add(mats.leatherOld, sweep3([[0, -0.3, 0], [0, 0.35, 0]], [[0.09, 0.09], [0.095, 0.095]], { seg: 4, radial: 10 }));
    for (const y of [1.5, 2.05]) ck.add(mats.forged, new THREE.TorusGeometry(y > 2 ? 0.37 : 0.24, 0.04, 5, 16).rotateX(Math.PI / 2), { p: [0, y, 0] });
    for (let i = 0; i < 18; i++) {
      const y = 1.7 + (i / 18) * 0.95;
      const a = i * 2.4 + r() * 0.5;
      const rr = y > 2.1 ? 0.42 : 0.3;
      const d = V3(Math.cos(a), (r() - 0.3) * 0.5, Math.sin(a)).normalize();
      ck.add(mats.forged, along(new THREE.ConeGeometry(0.045, 0.3, 5).translate(0, 0.15, 0), d, V3(d.x * rr * 0.85, y, d.z * rr * 0.85)));
    }
    ck.add(mats.forged, along(new THREE.ConeGeometry(0.06, 0.34, 5).translate(0, 0.17, 0), V3(0, 1, 0), V3(0, 2.86, 0)));
    ck.build(club);
  }

  const rest = {
    hips: hips.position.clone(),
  };
  const track = createTracker({ fastest: 25 });
  const gait = createStride({ stride: 2.8, hz: 0.5, longest: 1.25, stance: 0.58, cadence: [0.6, 1.1], seed: 31 });
  // each leg on its rig: the knee where the shin hangs from the thigh, the
  // sole under the shin
  const RIG = legRig({ knee: [0.3, -0.84], foot: [0.42, -0.95] });
  const roared = createShot(1.8);
  const blow = createShot(1.1);
  const E = { last: null, hunt: 0, was: 0, cool: 0 };
  const animate = (t, { swing = 0, roar = 0, reach = Infinity } = {}) => {
    K.U.uTime.value = t;
    const dt = E.last == null ? 0 : Math.max(0, Math.min(0.1, t - E.last));
    E.last = t;
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const st = gait.step(dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const w = st.amount;
    const ph = st.phase;
    // the near leg's swing (+ forward), for the body's roll and the arms
    const wave = Math.cos(ph);
    // the club: as told, or its own blow, started to land as it reaches you
    E.cool = Math.max(0, E.cool - dt);
    if (!(swing > 0) && !blow.active && E.cool <= 0 && reach < 1.5 + m.speed * 0.5) {
      blow.fire();
      E.cool = 1.8;
    }
    const own = blow.step(dt);
    const sw = swing > 0 ? clamp01(swing) : Math.max(0, own);
    const up = smooth(0, 0.45, sw) * (1 - smooth(0.55, 0.78, sw));
    const down = smooth(0.55, 0.78, sw) * (1 - smooth(0.92, 1, sw) * 0.3);
    // the roar, once, as it takes up the hunt; a snarl while it hunts
    const r0 = clamp01(roar);
    if (r0 > 0.5 && E.was <= 0.5) roared.fire();
    E.was = r0;
    E.hunt = ease(E.hunt, r0, dt, 3);
    const rk = roared.step(dt);
    const ro = Math.max(rk < 0 ? 0 : smooth(0, 0.15, rk) * (1 - smooth(0.7, 1, rk)), E.hunt * 0.22);
    const breathe = Math.sin(t * 1.6) * 0.02;
    // the legs: heavy strides, each foot held where it comes down, the knee
    // bending as it comes through
    // each foot held where it comes down, its knee taking up the rest; the
    // stride under the hips, lower the longer it is; its roll with the
    // stride in its body, above them
    const cx = RIG.home[0] * (1 - w);
    const lower = RIG.sink(st.travel * w, cx) * (0.8 + 0.2 * Math.cos(2 * ph - 0.58 * Math.PI * 2));
    legs.forEach((leg, i) => {
      const f = footAt(st.cycle + (i ? 0.5 : 0), 0.58);
      const [th, sh] = RIG.reach(cx + ((f.x * st.travel) / 2) * w, RIG.home[1] + lower + down * 0.22 + f.lift * 0.32 * w);
      leg.rotation.z = th - down * 0.2 * (i ? 1 : -0.4);
      leg.rotation.x = (i ? 1 : -1) * 0.05;
      leg.shin.rotation.z = sh - down * 0.25;
    });
    hips.position.y = rest.hips.y - lower - down * 0.22;
    hips.rotation.x = 0;
    hips.rotation.y = 0;
    // the body: rolling with the stride, rearing up with the club, then
    // throwing its weight down behind the blow; chest out to roar
    body.rotation.y = -wave * 0.02 * w + up * 0.15 - down * 0.1;
    body.rotation.z = -0.05 * w + up * 0.32 - down * 0.45 + ro * 0.22 + breathe;
    body.rotation.x = wave * 0.1 * w;
    head.rotation.z = -up * 0.2 + down * 0.25 + ro * 0.55 + Math.sin(t * 0.7) * 0.04;
    head.rotation.y = Math.sin(t * 0.45) * 0.15 * (1 - ro);
    jaw.rotation.z = -0.06 - ro * 0.55 - down * 0.15 + Math.sin(t * 9) * 0.03 * ro;
    // the left arm swings and hangs; out wide when he roars
    const [L, R] = arms;
    L.rotation.z = -wave * 0.32 * w + ro * 0.5 + up * 0.25;
    L.rotation.x = -0.08 - ro * 0.55;
    L.fore.rotation.z = 0.2 + ro * 0.5 + Math.max(0, -wave) * 0.25 * w;
    // the club arm: up over his head and back, then down along +x
    const swingAng = mix(mix(wave * 0.3 * w, 3.35, up), 1.1, down);
    R.rotation.z = swingAng + ro * 0.3 * (1 - up);
    R.rotation.x = 0.12 + up * 0.35 - down * 0.1 + ro * 0.4;
    R.fore.rotation.z = 0.25 + up * 0.9 * (1 - down) - down * 0.2;
    R.hand.rotation.z = mix(mix(0, 0.4, up), -0.62, down);
  };
  animate(0);
  g.updateMatrixWorld(true);
  club.userData.head = V3(0, 2.4, 0);
  return { group: g, body, head, arms, legs, club, hips, animate };
}

// ── the goblins ──

// A Moria goblin, about 1.4 m tall, facing +x: hunched and long-armed, its
// skin a sickly grey-green, big pale eyes in a flat face, bat's ears, a
// ragged kilt and scraps of dark armour, a crude curved blade in its right
// hand. Light, for they come in swarms: all of it one skinned mesh a
// material (skin, gear, eyes), each part bound whole to its bone, so a
// goblin is three draw calls. The seed varies its size, its hunch, its
// colour, its helm and its blade. animate(t, { running }).
export function goblin(K, seed = 1) {
  const { mats } = K;
  const r = rng(seed * 31 + 7);
  const n = makeNoise(seed * 17 + 5);
  const g = new THREE.Group();
  g.name = 'goblin';
  const tall = 0.92 + r() * 0.16;
  const hunch = 0.85 + r() * 0.3;
  const hue = (r() - 0.5) * 0.06;
  const helm = r() < 0.6;
  const pauldron = r() < 0.5 ? -1 : 1;
  const bladeLen = 0.55 + r() * 0.2;

  // the bones, in the pose it is built in
  const bones = [];
  const bone = (parent, p) => {
    const b = new THREE.Bone();
    b.position.set(...p);
    if (parent) parent.add(b);
    bones.push(b);
    return b;
  };
  const HIP = [0, 0.62, 0];
  const root = bone(null, [0, 0, 0]);
  const hips = bone(root, HIP);
  const body = bone(hips, [0, 0.04, 0]);
  const head = bone(body, [0.27 * hunch, 0.44, 0]);
  const arm = [-1, 1].map((s) => bone(body, [0.13 * hunch, 0.36, s * 0.18]));
  const fore = arm.map((a, i) => bone(a, [0.03, -0.24, (i ? 1 : -1) * 0.03]));
  const thigh = [-1, 1].map((s) => bone(hips, [0, -0.02, s * 0.09]));
  const shin = thigh.map((th) => bone(th, [0.07, -0.29, 0]));
  g.add(root);
  root.updateMatrixWorld(true);
  const at = (b) => b.getWorldPosition(V3());

  // its parts, each bound whole to one bone and laid where that bone is
  const lists = new Map();
  const add = (mat, b, geo, colour) => {
    const gg = geo.index ? geo.toNonIndexed() : geo;
    if (!gg.attributes.normal) gg.computeVertexNormals();
    for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
    tint(gg, colour);
    const count = gg.attributes.position.count;
    const si = new Uint16Array(count * 4);
    const sw = new Float32Array(count * 4);
    const bi = bones.indexOf(b);
    for (let i = 0; i < count; i++) {
      si[i * 4] = bi;
      sw[i * 4] = 1;
    }
    gg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    gg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    if (!lists.has(mat)) lists.set(mat, []);
    lists.get(mat).push(gg);
  };
  // the skin: grey-green, mottled, paler beneath, darker on the back
  const skinTone = (x, y, z, out, nx, ny) => {
    const m = noise3(n, x * 9, y * 9, z * 9);
    out.setRGB(0.3 + hue, 0.34, 0.26 - hue).multiplyScalar(0.78 + m * 0.42);
    out.lerp(_kd.setRGB(0.44, 0.45, 0.36), clamp01(nx * 0.5 + 0.1) * 0.35);
    out.multiplyScalar(0.7 + 0.3 * smooth(-0.8, 0.5, ny));
  };
  const skin = (b, geo) => add(mats.goblinSkin, b, geo, skinTone);
  const iron = (x, y, z, out) => out.setRGB(0.13, 0.125, 0.13).multiplyScalar(0.7 + noise3(n, x * 14, y * 14, z * 14) * 0.6).lerp(_kd.setRGB(0.22, 0.12, 0.06), smooth(0.55, 0.75, noise3(n, x * 6 + 3, y * 6, z * 6)) * 0.7);
  const rag = (x, y, z, out) => out.setRGB(0.11, 0.09, 0.075).multiplyScalar(0.7 + noise3(n, x * 10, y * 10, z * 10) * 0.6);
  const leather = (x, y, z, out) => out.setRGB(0.17, 0.11, 0.07).multiplyScalar(0.75 + noise3(n, x * 12, y * 12, z * 12) * 0.5);
  const gear = (b, geo, tone) => add(mats.goblinGear, b, geo, tone);
  const knob = (rad, o, detail = 1, amp = 0.12) => lump(rad, o, { detail, amp, freq: 1.8, seed: seed * 5 + bones.length });

  // the body: a narrow chest bent forward over a pot belly, a hump of a back
  const H = at(hips);
  const N = at(head);
  skin(body, sweep3([[H.x, H.y - 0.06, 0], [H.x + 0.06 * hunch, H.y + 0.18, 0], [N.x - 0.12, N.y - 0.1, 0], [N.x - 0.04, N.y - 0.02, 0]], [[0.15, 0.16, 0.14], [0.16, 0.18, 0.15], [0.13, 0.19, 0.16], [0.06, 0.07, 0.07]], { seg: 8, radial: 10 }));
  skin(body, knob(0.11, { p: [H.x - 0.08, N.y - 0.18, 0], s: [0.9, 1, 1.4] }));
  // the head: a low skull, a flat snout, a jaw thrust out, long bat's ears
  skin(head, knob(0.11, { p: [N.x + 0.03, N.y + 0.06, 0], s: [1.25, 0.9, 1] }));
  skin(head, knob(0.075, { p: [N.x + 0.1, N.y - 0.03, 0], s: [1.1, 0.75, 1.2] }));
  skin(head, new THREE.ConeGeometry(0.03, 0.08, 4).rotateZ(-Math.PI / 2).translate(N.x + 0.17, N.y + 0.04, 0));
  for (const s of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.045, 0.2 + r() * 0.06, 4).scale(1, 1, 0.3).translate(0, 0.1, 0);
    skin(head, along(ear, V3(-0.6, 0.45, s * 0.7), V3(N.x - 0.01, N.y + 0.08, s * 0.08)));
    // the eyes: big, pale, and glinting in the dark
    add(mats.goblinEye, head, ball(0.034, 6, 5).scale(0.9, 1, 1).translate(N.x + 0.115, N.y + 0.06, s * 0.055), (x, y, z, out) => out.setRGB(1, 1, 1).multiplyScalar(x > N.x + 0.14 && Math.abs(Math.abs(z) - 0.055) < 0.015 ? 0.15 : 1));
    // the fangs, up out of the jaw
    gear(head, new THREE.ConeGeometry(0.012, 0.045, 3).translate(N.x + 0.155, N.y - 0.01, s * 0.03), (x, y, z, out) => out.setRGB(0.55, 0.5, 0.36));
  }
  if (helm) gear(head, new THREE.SphereGeometry(0.125, 8, 3, 0, TAU, 0, Math.PI * 0.45).scale(1.2, 0.85, 1.05).translate(N.x + 0.02, N.y + 0.07, 0), iron);
  // the armour: a plate or two on the chest, a pauldron, a belt and a
  // ragged kilt
  gear(body, new THREE.CylinderGeometry(0.17, 0.165, 0.2, 7, 1, true, -Math.PI * 0.4, Math.PI * 0.8).rotateY(Math.PI / 2).rotateZ(-0.55 * hunch).translate(H.x + 0.13 * hunch, H.y + 0.27, 0), iron);
  const sh = at(arm[pauldron > 0 ? 1 : 0]);
  gear(body, new THREE.SphereGeometry(0.1, 7, 3, 0, TAU, 0, Math.PI * 0.5).scale(1.1, 0.8, 1).rotateX(pauldron * 0.5).translate(sh.x, sh.y + 0.03, sh.z + pauldron * 0.02), iron);
  gear(hips, new THREE.TorusGeometry(0.155, 0.022, 3, 10).rotateX(Math.PI / 2).scale(1, 1, 1.1).translate(H.x + 0.01, H.y + 0.02, 0), leather);
  {
    const kilt = new THREE.CylinderGeometry(0.15, 0.2, 0.24, 11, 2, true);
    const p = kilt.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -0.1) p.setY(i, y - 0.03 - r() * 0.07);
    }
    kilt.computeVertexNormals();
    gear(hips, kilt.scale(1, 1, 1.12).translate(H.x + 0.01, H.y - 0.1, 0), rag);
  }
  // the arms: thin, long, the hands big
  arm.forEach((a, i) => {
    const s = i ? 1 : -1;
    const A = at(a);
    const E = at(fore[i]);
    const W = E.clone().add(V3(0.03, -0.23, s * 0.01));
    skin(a, sweep3([A, A.clone().lerp(E, 0.5), E], [[0.045, 0.05], [0.042, 0.045], [0.034, 0.036]], { seg: 3, radial: 6 }));
    skin(fore[i], sweep3([E, E.clone().lerp(W, 0.5), W], [[0.034, 0.036], [0.036, 0.038], [0.028, 0.03]], { seg: 3, radial: 6 }));
    skin(fore[i], knob(0.045, { p: [W.x + 0.02, W.y - 0.04, W.z], s: [1, 1.3, 0.75] }, 0, 0.2));
    gear(fore[i], new THREE.CylinderGeometry(0.044, 0.04, 0.11, 6, 1, true).translate(E.x + 0.02, E.y - 0.14, E.z), leather);
    if (i === 1) {
      // the blade: a crude curved cleaver, ground on its outer edge, and
      // a hilt bound in leather
      const hand = V3(W.x + 0.03, W.y - 0.06, W.z);
      gear(fore[i], rod(hand.clone().add(V3(-0.02, 0.06, 0)), hand.clone().add(V3(0.02, -0.08, 0)), 0.018, 0.018, 5), leather);
      gear(fore[i], new THREE.BoxGeometry(0.03, 0.02, 0.11).translate(hand.x, hand.y - 0.085, hand.z), iron);
      const L = bladeLen;
      const pts = [0, 0.3, 0.65, 1].map((k) => hand.clone().add(V3(0.02 + k * k * L * 0.4, -0.09 - k * L, 0)));
      gear(fore[i], sweep3(pts, [[0.012, 0.035], [0.012, 0.045], [0.01, 0.05], [0.004, 0.012]], { seg: 6, radial: 4, side: [0, 0, 1], sq: 1.4 }), (x, y, z, out) => out.setRGB(0.42, 0.42, 0.4).multiplyScalar(0.7 + noise3(n, x * 20, y * 20, z * 20) * 0.5).lerp(_kd.setRGB(0.25, 0.14, 0.08), smooth(0.5, 0.7, noise3(n, x * 8, y * 8 + 3, z * 8)) * 0.8));
    }
  });
  // the legs: bowed, thin shanks, long splayed feet
  thigh.forEach((th, i) => {
    const s = i ? 1 : -1;
    const A = at(th);
    const Kn = at(shin[i]);
    const F = Kn.clone().add(V3(-0.05, -0.27, s * 0.01));
    skin(th, sweep3([A, A.clone().lerp(Kn, 0.5).add(V3(0, 0, s * 0.015)), Kn], [[0.06, 0.065], [0.055, 0.06], [0.042, 0.045]], { seg: 3, radial: 6 }));
    skin(shin[i], sweep3([Kn, Kn.clone().lerp(F, 0.5), F], [[0.042, 0.045], [0.04, 0.042], [0.03, 0.032]], { seg: 3, radial: 6 }));
    skin(shin[i], knob(0.06, { p: [F.x + 0.06, 0.035, F.z], s: [1.6, 0.55, 0.85] }, 1, 0.15));
    gear(shin[i], new THREE.CylinderGeometry(0.05, 0.045, 0.1, 6, 1, true).translate(Kn.x - 0.02, Kn.y - 0.13, Kn.z), rag);
  });

  // one skinned mesh a material, on the one skeleton; welded, so fewer
  // corners to move
  const skeleton = new THREE.Skeleton(bones);
  const meshes = [];
  for (const [mat, geos] of lists) {
    const geo = mergeVertices(mergeGeometries(geos));
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.castShadow = true;
    g.add(mesh);
    mesh.bind(skeleton);
    meshes.push(mesh);
  }
  // its size, once bound, from its feet
  root.scale.setScalar(tall);

  const ph0 = r() * TAU;
  const rest = hips.position.clone();
  const animate = (t, { running = false } = {}) => {
    const w = running ? 1 : 0;
    const ph = t * (running ? 10 : 0) + ph0;
    const idle = Math.sin(t * 1.7 + ph0);
    // a scuttling run, low and leaning; or a crouch, swaying, the blade up
    hips.position.y = rest.y - 0.05 * w + Math.abs(Math.sin(ph)) * 0.05 * w + idle * 0.008 * (1 - w);
    hips.rotation.y = Math.sin(ph) * 0.15 * w;
    body.rotation.z = -0.28 * w - 0.1 + idle * 0.03 * (1 - w);
    body.rotation.y = -Math.sin(ph) * 0.2 * w;
    head.rotation.z = 0.32 * w + 0.12 + Math.sin(t * 2.3 + ph0) * 0.05;
    head.rotation.y = Math.sin(t * 0.9 + ph0) * 0.35 * (1 - w);
    thigh.forEach((th, i) => {
      const p = ph + (i ? Math.PI : 0);
      th.rotation.z = Math.sin(p) * 0.75 * w + (0.25 - (i ? 0.1 : -0.1)) * (1 - w);
      shin[i].rotation.z = -(0.25 + Math.max(0, Math.sin(p + 1.4)) * 1.1) * w - 0.45 * (1 - w);
    });
    arm.forEach((a, i) => {
      const s = i ? 1 : -1;
      const p = ph + (i ? 0 : Math.PI);
      a.rotation.z = Math.sin(p) * 0.7 * w + (i ? 0.9 + Math.sin(t * 3 + ph0) * 0.1 : 0.3) * (1 - w) + (i ? 0.5 : 0) * w;
      a.rotation.x = -s * 0.15;
      fore[i].rotation.z = 0.5 + Math.max(0, Math.sin(p)) * 0.5 * w + (i ? 0.6 : 0) * (1 - w);
    });
  };
  animate(0);
  return { group: g, animate, meshes, head, hips };
}
