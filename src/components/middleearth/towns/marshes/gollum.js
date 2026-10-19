// Gollum himself, his rig, his gaits and his climb. Moved out of props.js
// as he was.

import * as THREE from 'three';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { parts, rng, tube } from '../../shire/build';
import { createStride, footAt } from '../../creatures';
import { bone, C, lump, noise3, prof, rod, sweep, tint, UP, V3 } from './helpers';

// ── Gollum ──

const GOLLUM = { thigh: 0.3, shin: 0.31, arm: 0.27, fore: 0.26, foot: 0.05, wrist: 0.05 };
const GOLLUM_SKIN = { base: C(0xc2c0b0), green: C(0xa2a892), pale: C(0xdcd2c4), deep: C(0x72705e), lip: C(0xb09a90) };
const _q0 = new THREE.Quaternion();
const _qf = new THREE.Quaternion();
const _zf = V3(0, 0, 1);
const CLIMB_Q = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), -Math.PI / 2));
const CLIMB_AT = V3(0.5, 0.38, 0);
const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// Two bones from a root to a target in the x-y plane: the absolute angles
// of each (0 hanging straight down, positive swung forward to +x), the
// joint bent forward (`bend` 1, a knee) or back (-1, an elbow).
function reach2(rx, ry, tx, ty, L1, L2, bend) {
  let dx = tx - rx;
  let dy = ty - ry;
  const d0 = Math.hypot(dx, dy) || 1e-4;
  const max = (L1 + L2) * 0.995;
  const min = Math.abs(L1 - L2) + 0.03;
  const k = d0 > max ? max / d0 : d0 < min ? min / d0 : 1;
  dx *= k;
  dy *= k;
  const d = d0 * k;
  const a = Math.atan2(dx, -dy);
  const b = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const a1 = a + bend * b;
  const kx = rx + Math.sin(a1) * L1;
  const ky = ry - Math.cos(a1) * L1;
  return [a1, Math.atan2(rx + dx - kx, -(ry + dy - ky))];
}

// Gollum: about 1.2 m if he ever stood up, which he doesn't. Starved thin,
// pale grey-green and damp, his ribs and spine and every knuckle showing,
// a few lank strands of hair on a big skull, huge pale-blue eyes, big ears,
// a ragged loincloth, long fingers and toes. Faces +x.
// animate(t, { pose, speed, look, reach }): pose 'crouch' (on his heels),
// 'crawl' (all fours along +x), 'climb' (head first down a rock face, belly
// to it: the face is at his +x, so turned as the scene turns him it is at
// −z of the world, and he looks out), 'cower' (curled up), 'fall' (the
// Ring held high, toppling over backwards, legs kicking: falling, he tips
// back about his hips towards −x). His crawl and his climb go by the ground
// he covers (../../creatures.js), read from where the scene puts him, so
// his hands and feet hold where they're put however fast he scuttles; still,
// he doesn't paw the air. `speed` is no longer needed.
// The one Gollum: the Marshes' and Cirith Ungol's, Mount Doom's (with its
// kit's materials, ../doom/props.js) and the Rush thief's.
export function gollum(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'gollum';
  const rig = bone('rig', g);
  const n = makeNoise(611);
  const SKIN = mats.gollumSkin;
  const skin = (geo, { belly = 0, dark = 0, lip = 0 } = {}) =>
    tint(geo, (x, y, z, out, nx) => {
      const m = noise3(n, x * 16, y * 16, z * 16);
      const blot = smooth(0.42, 0.66, noise3(n, x * 5 + 5, y * 5, z * 5));
      out.copy(GOLLUM_SKIN.base).multiplyScalar(0.86 + m * 0.26).lerp(GOLLUM_SKIN.green, blot * 0.5);
      if (belly) out.lerp(GOLLUM_SKIN.pale, clamp01(belly * (0.2 + nx * 0.8)));
      if (lip) out.lerp(GOLLUM_SKIN.lip, lip);
      if (dark) out.lerp(GOLLUM_SKIN.deep, dark);
    });
  const build = (grp, fn) => {
    const bk = parts();
    fn(bk);
    bk.build(grp, { shadow: false, receive: false });
  };
  const sk = (bk, geo, o) => bk.add(SKIN, skin(geo, o));
  const knob = (bk, r, p, s = [1, 1, 1], o = {}, rot) => sk(bk, lump(r, { p, s, r: rot }, { detail: o.detail ?? 1, amp: o.amp ?? 0.08, seed: o.seed ?? 3 }), o);

  // ── the hips and the loincloth
  const hips = bone('hips', rig, [0, 0.3, 0]);
  build(hips, (bk) => {
    knob(bk, 0.1, [0, 0.02, 0], [0.95, 0.75, 1.2], { detail: 2 });
    for (const s of [-1, 1]) knob(bk, 0.026, [0.055, 0.05, s * 0.088], [1, 1, 1], { belly: 0.3 });
    // a filthy rag wound round the loins, torn at its hem, a flap before and behind
    const rag = new THREE.CylinderGeometry(0.098, 0.106, 0.085, 18, 2, true);
    const p = rag.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i);
      const a = Math.atan2(z, x);
      const tear = y < -0.04 ? (n(a * 4 + 3, 2) - 0.5) * 0.06 - Math.max(0, Math.sin(a * 5)) * 0.02 : 0;
      p.setXYZ(i, x, y + tear, z * 1.16);
    }
    rag.computeVertexNormals();
    const cloth = (geo) =>
      tint(geo, (x, y, z, out) => {
        out.setRGB(0.16, 0.12, 0.08).multiplyScalar(0.7 + noise3(n, x * 30, y * 30, z * 30) * 0.6);
      });
    bk.add(mats.loin, cloth(rag), { p: [0, -0.005, 0] });
    for (const s of [-1, 1]) {
      const flap = new THREE.PlaneGeometry(0.08, 0.075, 2, 3);
      const fp = flap.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const fy = fp.getY(i);
        fp.setXYZ(i, fp.getX(i) + (fy < -0.03 ? (n(i * 3.3, 1) - 0.5) * 0.025 : 0), fy + (fy < -0.03 ? (n(i * 1.7, 4) - 0.5) * 0.03 : 0), Math.abs(fp.getX(i)) * 0.5);
      }
      flap.computeVertexNormals();
      bk.add(mats.loin, cloth(flap), { p: [s * 0.098, -0.05, 0], r: [0, (s * Math.PI) / 2, s * -0.25] });
    }
    bk.add(mats.loin, cloth(new THREE.TorusGeometry(0.102, 0.007, 4, 22).scale(1, 1.16, 1).rotateX(Math.PI / 2)), { p: [0, 0.04, 0] });
  });

  // ── the legs: bony knees up by his ears, long splayed toes
  const legs = [-1, 1].map((s) => {
    const thigh = bone(s < 0 ? 'thighL' : 'thighR', hips, [0, -0.01, s * 0.068]);
    build(thigh, (bk) => {
      sk(bk, sweep([[0, 0.02, 0], [0.004, -0.15, 0], [0, -GOLLUM.thigh, 0]], [[0.046, 0.05], [0.033, 0.034], [0.026, 0.028]], { seg: 6, radial: 9 }));
      knob(bk, 0.03, [0.012, -GOLLUM.thigh, 0], [1.05, 1.15, 0.95], { dark: 0.1 });
    });
    const shin = bone('shin', thigh, [0, -GOLLUM.thigh, 0]);
    build(shin, (bk) => {
      sk(bk, sweep([[0, 0, 0], [-0.006, -0.16, 0], [0, -GOLLUM.shin, 0]], [[0.026, 0.026, 0.032], [0.022, 0.022, 0.026], [0.016, 0.018]], { seg: 6, radial: 8 }));
      knob(bk, 0.017, [0, -GOLLUM.shin, s * 0.012], [1, 1, 1], { dark: 0.1 });
      knob(bk, 0.017, [0, -GOLLUM.shin, -s * 0.012], [1, 1, 1], { dark: 0.1 });
    });
    const foot = bone('foot', shin, [0, -GOLLUM.shin, 0]);
    build(foot, (bk) => {
      knob(bk, 0.026, [-0.022, -0.026, 0], [1.1, 0.95, 0.9], { dark: 0.15 });
      sk(bk, sweep([[-0.03, -0.03, 0], [0.04, -0.034, 0], [0.098, -0.036, 0]], [[0.02, 0.026], [0.018, 0.034], [0.012, 0.038]], { seg: 5, radial: 8, side: [0, 0, 1] }), { dark: 0.05 });
      // five long toes, the big one inside
      const lens = [0.07, 0.078, 0.07, 0.062, 0.052];
      for (let t = 0; t < 5; t++) {
        const z0 = (-s * (t - 2) * 0.016) * 1.0;
        const L = lens[t];
        const r0 = t === 0 ? 0.0105 : 0.0078;
        sk(bk, sweep([[0.09, -0.036, z0], [0.09 + L * 0.5, -0.034, z0 * 1.35], [0.09 + L, -0.046, z0 * 1.6]], [[r0], [r0 * 0.85], [r0 * 0.7]], { seg: 4, radial: 5 }), { dark: 0.05 });
      }
    });
    return { thigh, shin, foot, s };
  });

  // ── the body: ribs and spine through the skin, a sunken belly
  const spine = bone('spine', hips, [-0.005, 0.045, 0]);
  const ROWS = [
    [0, 0.068, 0.088, 0.06],
    [0.26, 0.058, 0.078, 0.058],
    [0.5, 0.084, 0.1, 0.07],
    [0.77, 0.086, 0.112, 0.07],
    [1, 0.058, 0.1, 0.056],
  ];
  const TORSO = 0.35;
  build(spine, (bk) => {
    sk(bk, sweep([[0, 0, 0], [0.006, TORSO * 0.26, 0], [0.01, TORSO * 0.5, 0], [0.002, TORSO * 0.77, 0], [-0.008, TORSO, 0]], ROWS.map((r) => r.slice(1)), { seg: 12, radial: 14 }), { belly: 0.5 });
    // the ribs, each a ridge round from the spine to the breastbone
    for (let i = 0; i < 5; i++) {
      const y = 0.14 + i * 0.036;
      const [rf, rs, rb] = prof(ROWS, y / TORSO);
      for (const s of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 5; k++) {
          const f = 0.32 + (k / 5) * 2.35;
          pts.push([Math.cos(f) * ((f < Math.PI / 2 ? rf : rb) + 0.002), y - 0.04 * (1 - f / 2.7), s * Math.sin(f) * (rs + 0.002)]);
        }
        sk(bk, sweep(pts, [[0.0065]], { seg: 8, radial: 4, caps: [false, false] }), { belly: 0.3 });
      }
    }
    // the knobs of his spine, his shoulder blades, collarbones, breastbone
    for (let i = 0; i < 11; i++) {
      const y = 0.01 + i * 0.032;
      const [, , rb] = prof(ROWS, y / TORSO);
      knob(bk, 0.013, [-rb - 0.002, y, 0], [0.8, 0.9, 1.1], { dark: 0.05, detail: 0 });
    }
    for (const s of [-1, 1]) {
      knob(bk, 0.045, [-0.06, 0.27, s * 0.06], [0.32, 1, 0.75], { dark: 0.05 }, [0, 0, 0.2]);
      sk(bk, rod([0.066, 0.335, s * 0.012], [0.004, 0.345, s * 0.105], 0.009, 0.008, 5), { belly: 0.2 });
    }
    sk(bk, rod([0.08, 0.31, 0], [0.083, 0.2, 0], 0.01, 0.008, 5), { belly: 0.3 });
  });

  // ── the neck and the head: a big skull, huge eyes, great ears
  const neck = bone('neck', spine, [0.0, TORSO - 0.005, 0]);
  build(neck, (bk) => {
    sk(bk, sweep([[0, -0.01, 0], [0.008, 0.05, 0], [0.012, 0.1, 0]], [[0.034, 0.036], [0.03, 0.032], [0.032, 0.036]], { seg: 4, radial: 9 }), { belly: 0.2 });
    for (const s of [-1, 1]) sk(bk, rod([0.012, 0.0, s * 0.02], [0.0, 0.1, s * 0.03], 0.008, 0.006, 4));
  });
  const head = bone('head', neck, [0.014, 0.1, 0]);
  const eyes = [];
  build(head, (bk) => {
    knob(bk, 0.13, [-0.02, 0.095, 0], [1.02, 0.9, 0.9], { detail: 3, amp: 0.05, seed: 7 });
    knob(bk, 0.085, [0.062, 0.022, 0], [0.95, 0.82, 1.02], { detail: 2, amp: 0.05, seed: 8 });
    knob(bk, 0.05, [0.094, -0.03, 0], [1, 0.62, 1.15], { belly: 0.2, seed: 9 });
    knob(bk, 0.024, [0.13, -0.042, 0], [1, 0.8, 1.2], { belly: 0.3 });
    for (const s of [-1, 1]) {
      // the hooded brows over the eyes, the cheekbones and hollow cheeks
      knob(bk, 0.034, [0.1, 0.09, s * 0.05], [0.95, 0.55, 1.15], { dark: 0.08, seed: 10 + s }, [s * 0.15, 0, -0.2]);
      knob(bk, 0.028, [0.096, 0.03, s * 0.068], [1, 0.8, 1], { seed: 12 + s });
      knob(bk, 0.021, [0.112, 0.038, s * 0.052], [0.9, 0.5, 1.3], { dark: 0.12 });
      // the ears, big and thin, standing out and back
      knob(bk, 0.052, [-0.012, 0.07, s * 0.122], [0.55, 1, 0.18], { seed: 14 + s, lip: 0.2 }, [s * 0.45, s * -0.35, 0.35]);
      bk.add(mats.mouth, lump(0.03, { p: [-0.004, 0.068, s * 0.128], s: [0.45, 0.85, 0.12], r: [s * 0.45, s * -0.35, 0.35] }, { detail: 1 }));
    }
    // the nose: hardly any, two slits
    knob(bk, 0.015, [0.142, 0.036, 0], [1, 0.7, 1.25], { lip: 0.2 });
    for (const s of [-1, 1]) bk.add(mats.mouth, lump(0.004, { p: [0.153, 0.03, s * 0.008], s: [1, 0.6, 1.4] }, { detail: 0 }));
    // the mouth: a wide lipless slit, a few teeth left in it
    bk.add(mats.mouth, lump(0.05, { p: [0.128, -0.004, 0], s: [0.3, 0.12, 1.15] }, { detail: 1, amp: 0.04 }));
    knob(bk, 0.05, [0.126, 0.007, 0], [0.3, 0.11, 1.12], { lip: 0.5 });
    knob(bk, 0.046, [0.122, -0.015, 0], [0.3, 0.11, 1.08], { lip: 0.5 });
    for (const [z, l] of [[-0.022, 0.012], [0.006, 0.015], [0.03, 0.01]]) bk.add(mats.tooth, new THREE.ConeGeometry(0.0045, l, 4), { p: [0.142, -0.006, z], r: [Math.PI, 0, 0] });
    // a few lank strands of hair from the crown
    const hr = rng(41);
    const on = (dx, dy, dz) => {
      const d = V3(dx, dy, dz).normalize();
      return V3(-0.02 + d.x * 0.138, 0.095 + d.y * 0.122, d.z * 0.122);
    };
    for (let i = 0; i < 6; i++) {
      const z0 = (i / 5 - 0.5) * 0.75 + (hr() - 0.5) * 0.12;
      const f = 0.2 + hr() * 0.35;
      const pts = [on(f, 1, z0), on(-0.4, 0.8, z0 * 1.2), on(-1, 0.25, z0 * 1.3), on(-1, -0.25, z0 * 1.4), V3(-0.14 - hr() * 0.02, -0.06 - hr() * 0.07, z0 * 0.16 + (hr() - 0.5) * 0.03)];
      bk.add(mats.gollumHair, tube(pts, 0.0032, 0.0016, { seg: 10, radial: 3 }));
    }
  });
  // the eyes: each a ball with its lid, so he can blink
  for (const s of [-1, 1]) {
    const e = bone(s < 0 ? 'eyeL' : 'eyeR', head, [0.108, 0.064, s * 0.05]);
    e.rotation.y = -s * 0.22;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), mats.gollumEye);
    e.add(ball);
    const lid = new THREE.Mesh(skin(new THREE.SphereGeometry(0.0438, 12, 6, Math.PI * 0.1, Math.PI * 0.8, 0, Math.PI * 0.46), { dark: 0.1 }), SKIN);
    lid.rotation.z = -0.42;
    e.add(lid);
    eyes.push(e);
  }

  // ── the arms: thin as sticks, long knobbly fingers
  const arms = [-1, 1].map((s) => {
    const arm = bone(s < 0 ? 'armL' : 'armR', spine, [0, 0.3, s * 0.112]);
    build(arm, (bk) => {
      knob(bk, 0.034, [0, 0, 0], [1, 1, 1], { detail: 1 });
      sk(bk, sweep([[0, 0, 0], [0.003, -0.135, 0], [0, -GOLLUM.arm, 0]], [[0.026, 0.027], [0.021, 0.022], [0.019, 0.02]], { seg: 6, radial: 8 }));
      knob(bk, 0.021, [-0.008, -GOLLUM.arm, 0], [1, 1.1, 1], { dark: 0.1 });
    });
    const fore = bone('fore', arm, [0, -GOLLUM.arm, 0]);
    build(fore, (bk) => {
      sk(bk, sweep([[0, 0, 0], [0.003, -0.13, 0], [0, -GOLLUM.fore, 0]], [[0.022, 0.024], [0.019, 0.021], [0.013, 0.017]], { seg: 6, radial: 8 }));
      knob(bk, 0.014, [0, -GOLLUM.fore + 0.006, s * 0.008], [1, 1, 1], { dark: 0.1, detail: 0 });
    });
    const hand = bone('hand', fore, [0, -GOLLUM.fore, 0]);
    build(hand, (bk) => {
      knob(bk, 0.032, [0.004, -0.035, 0], [0.42, 1.05, 0.95], {});
      // four long fingers curling to the palm (−x), a thumb inside
      const fl = [0.1, 0.112, 0.106, 0.09];
      for (let f = 0; f < 4; f++) {
        const z = (f - 1.5) * 0.0145 * -s;
        const L = fl[f];
        const pts = [[0.002, -0.064, z], [-0.004, -0.064 - L * 0.36, z * 1.15], [-0.014, -0.064 - L * 0.72, z * 1.25], [-0.03, -0.064 - L, z * 1.3]];
        sk(bk, sweep(pts, [[0.0078], [0.0062], [0.007], [0.0048]], { seg: 6, radial: 5 }));
      }
      sk(bk, sweep([[-0.006, -0.025, -s * 0.024], [-0.022, -0.055, -s * 0.034], [-0.036, -0.08, -s * 0.032]], [[0.0085], [0.007], [0.005]], { seg: 4, radial: 5 }));
    });
    return { arm, fore, hand, s };
  });

  // ── the poses
  const P = {};
  const T = {};
  const KEYS = ['hx', 'hy', 'tilt', 'spine', 'neck', 'head', 'yaw', 'abd', 'out', 'f0x', 'f0y', 'f1x', 'f1y', 'h0x', 'h0y', 'h1x', 'h1y', 'hand', 'climb', 'twist', 'roll', 'fall', 'gait'];
  let last = null;
  // his scuttle: a stride from the ground he covers (up or down a rock face
  // as much as along the ground), each limb down a little over half of it,
  // a hand and the other side's foot together
  const stride = createStride({ stride: 0.44, hz: 1.35, longest: 1.6, stance: 0.55, cadence: [1.4, 2.6], seed: 5 });
  const moved = { x: 0, y: 0, z: 0, t: null, v: 0 };
  const LIMBS = [['f0', 0], ['f1', 0.5], ['h0', 0.5], ['h1', 0]];
  const Q = {};
  const legAt = (s) => [0, -0.01, s * 0.068];
  const armAt = [0, 0.3];
  const target = (t, pose, speed, look, reach) => {
    const breathe = Math.sin(t * 2.3);
    T.yaw = look;
    T.twist = 0;
    T.roll = 0;
    T.fall = 0;
    T.gait = 0;
    if (pose === 'fall') {
      // arms flung up, the hand with the Ring highest; arched back, legs kicking
      const k = Math.sin(t * 8.5);
      const k2 = Math.sin(t * 6.1 + 1);
      Object.assign(T, { hx: 0, hy: 0.46, tilt: 0, spine: 0.32 + k * 0.05, neck: -0.25, head: -0.1 + k2 * 0.1, abd: 0.3, out: 0.55, hand: 0.6, climb: 0, fall: 1 });
      T.f0x = 0.32 + k * 0.1;
      T.f0y = 0.3 + k * 0.08;
      T.f1x = 0.2 - k * 0.1;
      T.f1y = 0.14 - k * 0.06;
      T.h0x = -0.12 + k2 * 0.06;
      T.h0y = 1.16;
      T.h1x = 0.02 - k2 * 0.04;
      T.h1y = 1.26;
    } else if (pose === 'crawl' || pose === 'climb') {
      // the stance he crawls from; his stride's steps go on top (animate)
      const climb = pose === 'climb';
      Object.assign(T, {
        hx: -0.12,
        hy: (climb ? 0.17 : 0.35) + breathe * 0.004,
        tilt: 0,
        spine: (climb ? -1.6 : -1.36) + breathe * 0.02,
        neck: climb ? 0.95 : 0.72,
        head: (climb ? 1.15 : 0.72) + Math.sin(t * 1.3) * 0.05,
        abd: climb ? 1.0 : 0.42,
        out: climb ? 0.95 : 0.22,
        hand: climb ? 1.35 : 1.25,
        climb: climb ? 1 : 0,
        gait: 1,
      });
      T.f0x = -0.04;
      T.f0y = GOLLUM.foot;
      T.f1x = -0.04;
      T.f1y = GOLLUM.foot;
      T.h0x = climb ? 0.3 : 0.38;
      T.h0y = GOLLUM.wrist;
      T.h1x = climb ? 0.3 : 0.38;
      T.h1y = GOLLUM.wrist;
    } else if (pose === 'cower') {
      const shiver = Math.sin(t * 37) * 0.012 + Math.sin(t * 23) * 0.008;
      Object.assign(T, { hx: 0, hy: 0.21 + shiver * 0.3, tilt: 0, spine: -1.18 + shiver, neck: -0.15, head: -0.45 + shiver, abd: 0.18, out: -0.35, hand: 2.6, climb: 0, f0x: 0.12, f0y: GOLLUM.foot, f1x: 0.12, f1y: GOLLUM.foot, h0x: 0.38, h0y: 0.43, h1x: 0.4, h1y: 0.43 });
    } else {
      Object.assign(T, { hx: 0, hy: 0.25 + breathe * 0.004, tilt: 0, spine: -0.92 + breathe * 0.03, neck: 0.5, head: 0.5 + Math.sin(t * 0.9) * 0.06, abd: 0.34, out: -0.12, hand: 1.45, climb: 0, f0x: 0.16, f0y: GOLLUM.foot, f1x: 0.16, f1y: GOLLUM.foot, h0x: 0.35, h0y: GOLLUM.wrist + 0.01, h1x: 0.34, h1y: GOLLUM.wrist });
    }
    // reaching out with his right hand, craning after it
    if (reach > 0) {
      const sa = T.tilt + T.spine;
      const [sx0, sy0] = rot2(-0.005, 0.045, T.tilt);
      const [ax, ay] = rot2(armAt[0], armAt[1], sa);
      const shx = T.hx + sx0 + ax;
      const shy = T.hy + sy0 + ay;
      T.h1x = mix(T.h1x, shx + 0.52, reach);
      T.h1y = mix(T.h1y, shy + 0.06, reach);
      T.neck += 0.15 * reach;
      T.spine += 0.12 * reach;
    }
  };
  const animate = (t, { pose = 'crouch', speed = 0, look = 0, reach = 0 } = {}) => {
    target(t, pose, speed, look, clamp01(reach));
    const dt = last == null ? 1 : t - last;
    last = t;
    const f = dt < 0 || dt > 0.5 ? 1 : 1 - Math.exp(-dt * 9);
    for (const k of KEYS) P[k] = P[k] == null || f === 1 ? T[k] : P[k] + (T[k] - P[k]) * f;
    // how fast he's really going, along the ground or up and down the rock,
    // from where he's been put (a jump of the scene's is a jump, not a dash)
    const gp = g.position;
    if (moved.t != null && t > moved.t && t - moved.t < 1) {
      const span = t - moved.t;
      let raw = Math.hypot(gp.x - moved.x, gp.y - moved.y, gp.z - moved.z) / span / (g.scale.x || 1);
      if (raw > 12) raw = 0;
      moved.v += (raw - moved.v) * (1 - Math.exp(-Math.min(0.1, span) / 0.08));
    } else moved.v = 0;
    moved.x = gp.x;
    moved.y = gp.y;
    moved.z = gp.z;
    moved.t = t;
    const st = stride.step(dt > 0 && dt <= 0.5 ? dt : 0, moved.v);
    // his steps on top of the stance: each hand and foot back under him as
    // far as he goes on while it's down, then up and through
    for (const k of KEYS) Q[k] = P[k];
    const amt = st.amount * P.gait;
    if (amt > 0.001) {
      const lift = mix(0.065, 0.05, P.climb) * Math.min(1.3, 0.6 + 0.4 * st.reach);
      for (const [limb, off] of LIMBS) {
        const fo = footAt(st.cycle + off, 0.55);
        Q[limb + 'x'] += ((fo.x * st.travel) / 2) * amt;
        Q[limb + 'y'] += fo.lift * lift * amt;
      }
      const sway = Math.sin(st.phase);
      Q.twist += sway * 0.12 * amt;
      Q.roll += sway * 0.05 * amt;
      Q.hy += Math.sin(st.phase * 2) * 0.012 * amt;
    }
    // head first down the rock: the crawl turned so +x runs down and the
    // ground under him becomes the rock face at his +x
    rig.quaternion.copy(_q0).slerp(CLIMB_Q, Q.climb);
    rig.position.copy(CLIMB_AT).multiplyScalar(Q.climb);
    // toppling over backwards, about his hips
    if (Q.fall > 0.001) {
      rig.quaternion.multiply(_qf.setFromAxisAngle(_zf, 0.85 * Q.fall));
      rig.position.x += 0.18 * Q.fall;
      rig.position.y += 0.06 * Q.fall;
    }
    hips.position.set(Q.hx, Q.hy, 0);
    hips.rotation.set(Q.roll, 0, Q.tilt);
    spine.rotation.set(0, Q.twist, Q.spine);
    neck.rotation.set(0, -Q.twist * 0.6, Q.neck);
    head.rotation.set(0, Q.yaw, Q.head);
    const blink = t % 3.7 < 0.13 || (t + 1.1) % 7.9 < 0.1;
    for (const e of eyes) e.scale.y = blink ? 0.15 : 1;
    // the legs to their feet
    for (const L of legs) {
      const i = L.s < 0 ? 0 : 1;
      const [lx, ly] = rot2(legAt(L.s)[0], legAt(L.s)[1], Q.tilt);
      const rx = Q.hx + lx;
      const ry = Q.hy + ly;
      const c = Math.cos(Q.abd);
      const [a1, a2] = reach2(rx, ry, Q[`f${i}x`], ry + (Q[`f${i}y`] - ry) / c, GOLLUM.thigh, GOLLUM.shin, 1);
      L.thigh.rotation.set(-L.s * Q.abd, 0, a1 - Q.tilt);
      L.shin.rotation.set(0, 0, a2 - a1);
      L.foot.rotation.set(L.s * Q.abd * 0.8, 0, -a2);
    }
    // the arms to their hands
    const sa = Q.tilt + Q.spine;
    const [sx0, sy0] = rot2(-0.005, 0.045, Q.tilt);
    const [ax, ay] = rot2(armAt[0], armAt[1], sa);
    for (const A of arms) {
      const i = A.s < 0 ? 0 : 1;
      const rx = Q.hx + sx0 + ax;
      const ry = Q.hy + sy0 + ay;
      const out = i === 1 ? mix(Q.out, 0.05, clamp01(reach)) : Q.out;
      const c = Math.cos(out);
      const [a1, a2] = reach2(rx, ry, Q[`h${i}x`], ry + (Q[`h${i}y`] - ry) / c, GOLLUM.arm, GOLLUM.fore, -1);
      A.arm.rotation.set(-A.s * out, 0, a1 - sa);
      A.fore.rotation.set(0, 0, a2 - a1);
      const hand = i === 1 ? mix(Q.hand, a2 + 0.15, clamp01(reach)) : Q.hand;
      A.hand.rotation.set(0, 0, hand - a2);
    }
  };
  animate(0);
  return { group: g, head, rig, hips, spine, legs, arms, eyes, animate };
}
