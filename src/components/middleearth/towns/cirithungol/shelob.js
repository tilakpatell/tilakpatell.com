// Shelob. Moved out of props.js as she was.

import * as THREE from 'three';
import { clamp01, makeNoise, smooth } from '../../../../lib/paint';
import { createStride, createTracker, ease } from '../../creatures';
import { rng, tube } from '../../shire/build';
import { along, C, lump, noise3, oneGeo, skinParts, spikeAt, sweep, TAU, tint, V3 } from './helpers';

// ── Shelob ──

const SPIDER = { hide: C(0x1e150f), brown: C(0x3c2a1a), ochre: C(0x6a4a28), pale: C(0x7a705e), dark: C(0x070504), belly: C(0x2c2219), band: C(0x4e3a24) };
// Her legs, front to back: each hip in her body's frame, each foot at rest
// in hers; the left side is these with z turned over.
const SPIDER_LEGS = [
  { hip: [0.42, -0.02, 0.24], foot: [3.0, 0, 1.95] },
  { hip: [0.18, -0.04, 0.36], foot: [1.75, 0, 3.25] },
  { hip: [-0.08, -0.04, 0.37], foot: [-0.05, 0, 3.35] },
  { hip: [-0.32, -0.02, 0.28], foot: [-1.65, 0, 2.6] },
];
const LEG_A = 2.1;
const LEG_B = 1.9;
const LEG_C = 0.75;
const TARSUS = -1.25;

// Shelob: a spider the size of a cart, her body 4 m long and 1.8 m high at
// rest, eight jointed hairy legs spanning 7 m, knees high over her back; a
// great bulbous abdomen, black-brown and mottled, bristling, a sting at its
// tail; a cluster of glossy eyes over two great fanged mandibles. Faces +x.
// Skinned on one skeleton (three meshes); her feet are placed by reaching
// for the ground. animate(t, { rear, strike, hurt, recoil, light }), each
// 0..1: rear lifts her front, legs raised; strike lunges; hurt makes her
// sag, limp and shudder; recoil shrinks her back from a light, though not
// while she's walking off forwards (a hunt given up, home to her round);
// light is the phial on her, and she flinches from it however she's going.
// Her gait is read from where the scene puts her (../../creatures.js): her
// feet keep their hold on the ground at any pace, the stride lengthening as
// she hurries; `walking` is no longer needed. Each is eased, so she doesn't
// snap from one to the next.
export function shelob(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'shelob';
  const n = makeNoise(4021);
  const bones = [];
  const mk = (name, parent, p) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...p);
    if (parent) parent.add(b);
    bones.push(b);
    return b;
  };
  const root = mk('root', null, [0, 0, 0]);
  g.add(root);
  const BODY = V3(0.75, 0.9, 0);
  const body = mk('body', root, BODY.toArray());
  const head = mk('head', body, [0.6, 0.06, 0]);
  const fangs = [-1, 1].map((s) => mk(s < 0 ? 'fangL' : 'fangR', head, [0.27, -0.12, s * 0.12]));
  const palps = [-1, 1].map((s) => mk(s < 0 ? 'palpL' : 'palpR', head, [0.2, -0.06, s * 0.24]));
  const abdomen = mk('abdomen', body, [-0.55, 0.12, 0]);
  const sting = mk('sting', abdomen, [-2.3, 0.0, 0]);
  const legs = [];
  SPIDER_LEGS.forEach((L, i) => {
    for (const s of [-1, 1]) {
      const hip = V3(L.hip[0], L.hip[1], L.hip[2] * s);
      const femur = mk(`femur${i}${s < 0 ? 'L' : 'R'}`, body, hip.toArray());
      femur.rotation.order = 'YZX';
      const tibia = mk(`tibia${i}${s < 0 ? 'L' : 'R'}`, femur, [LEG_A, 0, 0]);
      const tarsus = mk(`tarsus${i}${s < 0 ? 'L' : 'R'}`, tibia, [LEG_B, 0, 0]);
      legs.push({ i, s, hip, femur, tibia, tarsus, rest: V3(L.foot[0], 0, L.foot[2] * s), phase: ((i + (s > 0 ? 1 : 0)) % 2) * 0.5 + i * 0.07 });
    }
  });
  g.updateMatrixWorld(true);
  const sk = skinParts(bones);
  const HIDE = mats.shelob;
  // her hide: black-brown, mottled ochre, darker beneath
  const hideTone = (bands = 0) => (x, y, z, out, nx, ny) => {
    const m = noise3(n, x * 2.2, y * 2.2, z * 2.2);
    out.copy(SPIDER.hide).multiplyScalar(0.75 + m * 0.5);
    out.lerp(SPIDER.brown, smooth(0.5, 0.7, noise3(n, x * 1.1 + 4, y * 1.1, z * 1.1)) * 0.7);
    out.lerp(SPIDER.dark, clamp01(-ny) * 0.5);
    if (bands) out.lerp(SPIDER.band, smooth(0.6, 0.9, Math.sin(x * bands) * 0.5 + 0.5) * 0.4);
  };
  // bristles: thin dark spikes out along a surface, pale at their tips
  const bristles = (b, geo, count, len, seed, { up = 0 } = {}) => {
    const p = geo.attributes.position;
    const nr = geo.attributes.normal;
    const br = rng(seed);
    const list = [];
    for (let k = 0; k < count; k++) {
      const v = Math.floor(br() * p.count);
      const at = V3().fromBufferAttribute(p, v);
      const dir = V3().fromBufferAttribute(nr, v).add(V3((br() - 0.5) * 0.8, up + (br() - 0.5) * 0.5, (br() - 0.5) * 0.8));
      const L = len * (0.5 + br());
      list.push(tint(along(new THREE.ConeGeometry(len * 0.06, L, 3, 1, true).translate(0, L / 2, 0), dir, at), (x, y, z, out) => out.copy(SPIDER.pale).multiplyScalar(0.55 + br() * 0.3)));
    }
    sk.add(HIDE, b, oneGeo(list));
  };
  // a lumpy, knobbled surface: pushed in and out along its normals
  const knobble = (geo, amp, freq) => {
    const p = geo.attributes.position;
    const nr = geo.attributes.normal;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k);
      const y = p.getY(k);
      const z = p.getZ(k);
      const d = (noise3(n, x * freq, y * freq, z * freq) - 0.5) * amp;
      p.setXYZ(k, x + nr.getX(k) * d, y + nr.getY(k) * d, z + nr.getZ(k) * d);
    }
    geo.computeVertexNormals();
    return geo;
  };

  // the abdomen: huge, bulbous, ridged and mottled, a pale mark on its back
  {
    const geo = knobble(sweep([[0.15, -0.02, 0], [-0.25, 0.08, 0], [-0.8, 0.2, 0], [-1.5, 0.22, 0], [-2.05, 0.1, 0], [-2.35, -0.02, 0]], [[0.24, 0.24, 0.22], [0.64, 0.68, 0.56], [0.86, 0.95, 0.74], [0.84, 0.9, 0.74], [0.52, 0.58, 0.47], [0.1, 0.12, 0.1]], { seg: 22, radial: 22 }), 0.12, 2.6);
    tint(geo, (x, y, z, out, nx, ny) => {
      hideTone()(x, y, z, out, nx, ny);
      // ridges round it, and a pale broken chevron down its back
      out.multiplyScalar(0.85 + 0.25 * Math.sin(x * 9 + noise3(n, x, y, z) * 3));
      const chev = smooth(0.82, 0.95, 1 - Math.abs(Math.abs(z) * 1.6 - ((-x * 1.3) % 0.9))) * smooth(0.5, 0.8, ny);
      out.lerp(SPIDER.ochre, chev * smooth(0.45, 0.6, noise3(n, x * 3, y * 3, z * 3)) * 0.8);
      out.lerp(SPIDER.belly, clamp01(-ny) * 0.4);
    });
    sk.add(HIDE, abdomen, geo);
    bristles(abdomen, geo, 110, 0.16, 11, { up: 0.3 });
    // spinnerets under the tail
    for (let k = 0; k < 3; k++) sk.add(HIDE, abdomen, tint(spikeAt(V3(-2.2, -0.14, (k - 1) * 0.06), V3(-0.5, -1, (k - 1) * 0.3), 0.14, 0.035, 5), (x, y, z, out) => out.copy(SPIDER.brown)));
  }
  // the sting: a hooked spike, glossy, curled under her tail
  sk.add(mats.fang, sting, tube([[0.05, 0, 0], [-0.22, -0.08, 0], [-0.32, -0.32, 0], [-0.22, -0.52, 0]], 0.075, 0.004, { seg: 10, radial: 6 }));
  // the body: a domed carapace, the legs' roots round it
  {
    const geo = knobble(lump(0.55, { s: [1.18, 0.58, 0.88] }, { detail: 3, amp: 0.05, seed: 7 }), 0.05, 4);
    tint(geo, (x, y, z, out, nx, ny) => {
      hideTone()(x, y, z, out, nx, ny);
      out.lerp(SPIDER.ochre, smooth(0.7, 0.95, ny) * smooth(0.2, 0.0, Math.abs(z)) * 0.5);
    });
    sk.add(HIDE, body, geo);
    sk.add(HIDE, body, tint(lump(0.3, { p: [-0.1, 0.24, 0], s: [1.6, 0.4, 0.6] }, { detail: 1, amp: 0.1 }), hideTone()));
    sk.add(HIDE, body, tint(lump(0.32, { p: [0.02, -0.2, 0], s: [1.2, 0.5, 0.9] }, { detail: 1, amp: 0.08 }), hideTone()));
    bristles(body, geo, 40, 0.12, 13, { up: 0.4 });
    // the waist to the abdomen
    sk.add(HIDE, body, tint(sweep([[-0.45, 0.04, 0], [-0.62, 0.1, 0], [-0.75, 0.16, 0]], [[0.2], [0.16], [0.2]], { seg: 3, radial: 8 }), hideTone()));
  }
  // the head: the eyes clustered on its brow, glossy, catching any light
  {
    const geo = knobble(lump(0.33, { p: [0.05, 0.02, 0], s: [1.05, 0.78, 0.98] }, { detail: 2, amp: 0.06, seed: 9 }), 0.04, 5);
    tint(geo, hideTone());
    sk.add(HIDE, head, geo);
    sk.add(HIDE, head, tint(lump(0.16, { p: [0.14, 0.18, 0], s: [1.2, 0.8, 1.3] }, { detail: 1, amp: 0.08 }), hideTone()));
    bristles(head, geo, 28, 0.09, 15, { up: 0.3 });
    const eye = (rad, p) => sk.add(mats.shelobEye, head, new THREE.SphereGeometry(rad, 10, 7).translate(...p));
    for (const s of [-1, 1]) {
      eye(0.07, [0.33, 0.13, s * 0.075]);
      eye(0.048, [0.26, 0.25, s * 0.105]);
      eye(0.042, [0.19, 0.2, s * 0.19]);
      eye(0.034, [0.07, 0.28, s * 0.075]);
    }
    eye(0.028, [0.36, 0.23, 0]);
  }
  // the mandibles: thick hairy bases hanging from the head, each ending in
  // a great curved fang
  fangs.forEach((f, i) => {
    const s = i ? 1 : -1;
    const base = tint(knobble(sweep([[0, 0.02, 0], [0.09, -0.16, s * 0.01], [0.11, -0.34, 0]], [[0.12, 0.11], [0.11, 0.1], [0.075, 0.07]], { seg: 6, radial: 9 }), 0.03, 6), hideTone());
    sk.add(HIDE, f, base);
    bristles(f, base, 16, 0.08, 20 + i, { up: -0.2 });
    sk.add(mats.fang, f, tube([[0.11, -0.33, 0], [0.12, -0.46, s * 0.02], [0.06, -0.56, -s * 0.02], [-0.04, -0.6, -s * 0.05]], 0.045, 0.004, { seg: 8, radial: 6 }));
  });
  // the palps: short feelers either side of the mandibles
  palps.forEach((p, i) => {
    const s = i ? 1 : -1;
    const geo = tint(sweep([[0, 0, 0], [0.18, -0.12, s * 0.06], [0.34, -0.1, s * 0.1], [0.44, -0.22, s * 0.12]], [[0.05], [0.045], [0.04], [0.025]], { seg: 6, radial: 6 }), hideTone(18));
    sk.add(HIDE, p, geo);
    bristles(p, geo, 10, 0.07, 30 + i);
  });
  // the legs: femur, tibia and tarsus, banded, bristling, a knob at each
  // joint, a dark claw at each foot
  for (const L of legs) {
    const seed = 50 + L.i * 2 + (L.s > 0 ? 1 : 0);
    const fem = tint(knobble(sweep([[0, 0, 0], [LEG_A * 0.5, 0.06, 0], [LEG_A, 0, 0]], [[0.16, 0.15], [0.135, 0.125], [0.1, 0.095]], { seg: 8, radial: 8 }), 0.03, 7), hideTone(6));
    sk.add(HIDE, L.femur, fem);
    sk.add(HIDE, L.femur, tint(lump(0.17, { p: [0.02, 0, 0] }, { detail: 1, amp: 0.1 }), hideTone()));
    sk.add(HIDE, L.femur, tint(lump(0.14, { p: [LEG_A, 0.02, 0], s: [1.2, 1, 1] }, { detail: 1, amp: 0.12 }), hideTone()));
    bristles(L.femur, fem, 26, 0.2, seed, { up: 0.5 });
    const tib = tint(knobble(sweep([[0, 0, 0], [LEG_B * 0.5, -0.04, 0], [LEG_B, 0, 0]], [[0.115, 0.105], [0.095, 0.09], [0.075, 0.07]], { seg: 8, radial: 7 }), 0.025, 8), hideTone(7));
    sk.add(HIDE, L.tibia, tib);
    sk.add(HIDE, L.tibia, tint(lump(0.09, { p: [LEG_B, 0, 0] }, { detail: 1, amp: 0.1 }), hideTone()));
    bristles(L.tibia, tib, 24, 0.17, seed + 100, { up: 0.3 });
    const tar = tint(sweep([[0, 0, 0], [LEG_C * 0.6, 0.0, 0], [LEG_C, 0, 0]], [[0.07], [0.052], [0.022]], { seg: 6, radial: 6 }), hideTone(10));
    sk.add(HIDE, L.tarsus, tar);
    bristles(L.tarsus, tar, 12, 0.1, seed + 200, { up: 0.2 });
    sk.add(mats.fang, L.tarsus, spikeAt(V3(LEG_C - 0.04, 0, 0), V3(1, -0.4, 0), 0.12, 0.016, 4));
  }
  const meshes = sk.build(g);

  // ── her motion
  const inv = new THREE.Matrix4();
  const foot = V3();
  const loc = V3();
  let last = null;
  const track = createTracker({ fastest: 20 });
  const stride = createStride({ stride: 1.1, hz: 1.3, longest: 1.7, stance: 0.6, cadence: [1.3, 2.0], seed: 4021 });
  const E = { rear: 0, strike: 0, hurt: 0, recoil: 0, light: 0 };
  const reach = (L, target) => {
    loc.copy(target).applyMatrix4(inv);
    const dx = loc.x - L.hip.x;
    const dz = loc.z - L.hip.z;
    const dh = Math.hypot(dx, dz);
    const dv = loc.y - L.hip.y;
    const yaw = Math.atan2(-dz, dx);
    const u = dh - LEG_C * Math.cos(TARSUS);
    const v = dv - LEG_C * Math.sin(TARSUS);
    const D = Math.max(0.3, Math.min(LEG_A + LEG_B - 0.01, Math.hypot(u, v)));
    const a1 = Math.atan2(v, u) + Math.acos(Math.max(-1, Math.min(1, (LEG_A * LEG_A + D * D - LEG_B * LEG_B) / (2 * LEG_A * D))));
    const a2 = -(Math.PI - Math.acos(Math.max(-1, Math.min(1, (LEG_A * LEG_A + LEG_B * LEG_B - D * D) / (2 * LEG_A * LEG_B)))));
    L.femur.rotation.set(0, yaw, a1);
    L.tibia.rotation.set(0, 0, a2);
    L.tarsus.rotation.set(0, 0, TARSUS - a1 - a2);
  };
  const animate = (t, { rear = 0, strike = 0, hurt = 0, recoil = 0, light = 0 } = {}) => {
    const dt = last == null ? 0 : Math.max(0, Math.min(0.1, t - last));
    last = t;
    // how she's really going, from where she's been put
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const gait = stride.step(dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const w = gait.amount;
    const phase = gait.cycle;
    // walking off forwards she isn't shrinking from anything; the phial
    // on her she is, whichever way she's going
    const forward = smooth(0.3, 1.0, m.fwd);
    E.light = ease(E.light, clamp01(light), dt, clamp01(light) > E.light ? 12 : 3);
    const rcWant = Math.max(clamp01(recoil) * (1 - forward), E.light * 0.85);
    E.recoil = ease(E.recoil, rcWant, dt, rcWant > E.recoil ? 10 : 3);
    E.rear = ease(E.rear, clamp01(rear), dt, 6);
    E.strike = ease(E.strike, clamp01(strike), dt, 14);
    E.hurt = ease(E.hurt, clamp01(hurt), dt, 6);
    const re = E.rear;
    const st = E.strike;
    const hu = Math.max(E.hurt, E.light * 0.35);
    const rc = E.recoil;
    const breathe = Math.sin(t * 1.3);
    const shud = hu * (Math.sin(t * 31) * 0.6 + Math.sin(t * 47) * 0.4);
    // the body
    body.position.set(BODY.x - re * 0.35 + st * 1.3 - rc * 0.85 + shud * 0.025, BODY.y + re * 0.5 - st * 0.18 - hu * 0.32 - rc * 0.32 + breathe * 0.015 + Math.abs(Math.sin(phase * TAU)) * 0.05 * w, 0);
    body.rotation.set(hu * 0.13 + shud * 0.02, rc * Math.sin(t * 4.1) * 0.06, re * 0.72 - st * 0.2 + rc * 0.22 + shud * 0.03 + Math.sin(phase * TAU * 2) * 0.02 * w);
    body.updateMatrix();
    inv.copy(body.matrix).invert();
    head.rotation.set(Math.sin(t * 0.7) * 0.05 * (1 - st), Math.sin(t * 0.53) * 0.12 * (1 - re) + rc * Math.sin(t * 6) * 0.15, -st * 0.15 + rc * 0.3 - hu * 0.15);
    abdomen.rotation.set(Math.sin(t * 0.8) * 0.03 + hu * 0.1, Math.sin(t * 0.6) * 0.06, -re * 0.55 + st * 0.18 + rc * 0.15 - hu * 0.2 + breathe * 0.015);
    abdomen.scale.setScalar(1 + breathe * 0.015);
    sting.rotation.z = st * 0.7 + re * 0.4 + Math.sin(t * 1.7) * 0.05;
    // the mandibles: working slowly; open as she rears, thrust in a strike
    const chew = Math.sin(t * 2.2) * 0.08 * (1 - hu);
    fangs.forEach((f, i) => {
      const s = i ? 1 : -1;
      f.rotation.set(s * (0.1 + re * 0.35 + st * 0.3 + chew), 0, re * 0.35 + st * 0.9 - hu * 0.25 + chew);
    });
    palps.forEach((p, i) => {
      const s = i ? 1 : -1;
      p.rotation.set(s * 0.1, s * (0.1 + Math.sin(t * 3 + i) * 0.15), Math.sin(t * 2.6 + i * 2) * 0.2 + re * 0.6 - hu * 0.3);
    });
    // the feet: a gait in two sets of four, and her poses
    for (const L of legs) {
      foot.copy(L.rest);
      if (w > 0.01) {
        // her feet held where they're put while they're down: they go back
        // under her as far as she goes forward
        const c = (phase + L.phase + 1) % 1;
        const S = gait.travel * w;
        if (c < 0.6) foot.x += S * (0.5 - c / 0.6);
        else {
          const k = (c - 0.6) / 0.4;
          foot.x += S * (k - 0.5);
          foot.y += Math.sin(Math.PI * k) * (0.2 + 0.25 * Math.min(1.3, gait.reach)) * w;
        }
      }
      const front = L.i === 0;
      const second = L.i === 1;
      if (front) {
        foot.x += -re * 0.7 + st * 1.9 - rc * 1.1;
        foot.y += re * (2.6 + Math.sin(t * 5 + L.s) * 0.3) + Math.sin(Math.PI * st) * 0.7 + rc * (1.5 + Math.sin(t * 7 + L.s) * 0.12);
        foot.z *= 1 - re * 0.25 - rc * 0.45;
      } else if (second) {
        foot.x += re * 0.2 + st * 1.0 - rc * 0.7;
        foot.y += re * (1.4 + Math.sin(t * 4 + L.s * 2) * 0.2) + rc * 0.6;
      } else {
        foot.x += st * 0.55 - rc * 0.5 - re * 0.2;
        foot.z *= 1 + re * 0.08;
      }
      // hurt: the left legs buckle in, all of them tremble
      if (L.s < 0) foot.z *= 1 - hu * 0.15;
      foot.y += Math.max(0, Math.sin(t * 17 + L.i * 1.3 + L.s)) * 0.1 * hu * (L.i < 2 ? 1 : 0.4);
      // and idle, a front foot tapping now and then
      if (front && w < 0.01 && re + st + rc < 0.01) foot.y += Math.pow(Math.max(0, Math.sin(t * 0.9 + L.s * 1.7)), 8) * 0.25;
      reach(L, foot);
    }
  };
  animate(0);
  return { group: g, body, head, abdomen, sting, legs, meshes, animate };
}
