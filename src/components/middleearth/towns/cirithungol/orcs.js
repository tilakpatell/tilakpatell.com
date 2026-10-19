// The orcs: the rig and its parts, a pose, the marching column, the
// dead. Moved out of props.js as they were.

import * as THREE from 'three';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { rng, tube } from '../../shire/build';
import { along, C, lump, noise3, oneGeo, skinParts, spikeAt, sweep, TAU, tint, V3 } from './helpers';

// ── the orcs ──

export const ORC = { skin: C(0x6a5d4c), dark: C(0x3a3028), pale: C(0x8e7e68), iron: C(0x1e1d1e), edge: C(0x403a36), leather: C(0x2e2219), cloth: C(0x2a221c), steel: C(0x625e5a), rust: C(0x5a3420), eye: C(0xd8a640), tooth: C(0xb8aa88), shaft: C(0x2c2016) };
const ORC_METAL = new Set(['iron', 'edge', 'steel']);
// Bones: [parent, position]. The figure faces +x, its right side +z.
const ORC_BONES = {
  root: [null, [0, 0, 0]],
  hips: ['root', [0, 0.78, 0]],
  legL: ['hips', [0, -0.04, -0.12]],
  legR: ['hips', [0, -0.04, 0.12]],
  shinL: ['legL', [0.03, -0.37, 0]],
  shinR: ['legR', [0.03, -0.37, 0]],
  body: ['hips', [0, 0.05, 0]],
  head: ['body', [0.17, 0.5, 0]],
  armL: ['body', [0.07, 0.43, -0.23]],
  armR: ['body', [0.07, 0.43, 0.23]],
  foreL: ['armL', [0, -0.27, 0]],
  foreR: ['armR', [0, -0.27, 0]],
  hand: ['foreR', [0.01, -0.28, 0]],
};
function orcRig(parent, make = () => new THREE.Group()) {
  const b = {};
  const list = [];
  for (const [name, [up, p]] of Object.entries(ORC_BONES)) {
    const o = make();
    o.name = name;
    o.position.set(...p);
    (up ? b[up] : parent).add(o);
    b[name] = o;
    list.push(o);
  }
  return { b, list };
}

// The parts of a Mordor orc, each in its bone's frame: [bone, kind, geo].
// `q` sets the detail: q.rad round, q.seg along, q.fine for the trim;
// q.spear arms him for the march, q.big makes him Shagrat.
function orcParts(seed, q) {
  const r = rng(seed * 37 + 11);
  const out = [];
  const put = (b, kind, geo) => out.push([b, kind, geo]);
  const R = q.rad;
  const k = q.big ? 1.2 : 1;
  const det = q.fine ? 1 : 0;
  const helm = r();
  // the hips: a belt, a kilt of leather strips with a ragged hem
  // (the smallest, for the column, goes without belt, nose and tusks)
  const tiny = R <= 4;
  if (!tiny) put('hips', 'leather', new THREE.CylinderGeometry(0.15 * k, 0.16 * k, 0.12, R).translate(0, 0.02, 0));
  {
    const kilt = new THREE.CylinderGeometry(0.16 * k, 0.23 * k, 0.32, R + (q.fine ? 4 : 0), 1, true);
    const p = kilt.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) - r() * 0.09);
    kilt.computeVertexNormals();
    put('hips', 'leather', kilt.translate(0, -0.13, 0));
  }
  if (q.fine) put('hips', 'iron', new THREE.TorusGeometry(0.158 * k, 0.018, 3, R + 2).rotateX(Math.PI / 2).translate(0, 0.06, 0));
  // the legs: thick thighs, bowed shins, iron-shod boots
  for (const s of ['L', 'R']) {
    put(`leg${s}`, 'cloth', sweep([[0, 0, 0], [0.02, -0.18, 0], [0.03, -0.37, 0]], [[0.08 * k], [0.072 * k], [0.056 * k]], { seg: q.seg, radial: R }));
    put(`shin${s}`, 'skin', sweep([[0, 0, 0], [-0.01, -0.19, 0], [-0.03, -0.35, 0]], [[0.056 * k], [0.05 * k], [0.04 * k]], { seg: q.seg, radial: R }));
    put(`shin${s}`, 'leather', lump(0.075 * k, { p: [0.03, -0.38, 0], s: [1.7, 0.6, 1.0] }, { detail: det, amp: 0.06, seed: seed + 3 }));
    if (q.fine) {
      put(`shin${s}`, 'iron', new THREE.SphereGeometry(0.06 * k, R, 3, 0, TAU, 0, Math.PI / 2).rotateZ(-Math.PI / 2).translate(0.035, -0.02, 0));
      put(`shin${s}`, 'leather', new THREE.CylinderGeometry(0.05 * k, 0.047 * k, 0.16, R, 1, true).translate(-0.02, -0.26, 0));
    }
  }
  // the body: a deep chest bent forward, a hump of a back
  put('body', 'skin', sweep([[0, 0, 0], [0.04, 0.2, 0], [0.12, 0.4, 0], [0.17, 0.5, 0]], [[0.13 * k, 0.15 * k, 0.13 * k], [0.16 * k, 0.19 * k, 0.16 * k], [0.15 * k, 0.21 * k, 0.19 * k], [0.07, 0.09, 0.08]], { seg: q.seg + 1, radial: R + 1 }));
  put('body', 'dark', lump(0.12 * k, { p: [0.0, 0.38, 0], s: [0.9, 0.85, 1.35] }, { detail: det, amp: 0.12, seed: seed + 9 }));
  // crude black armour: a breastplate, pauldrons, a back plate
  put('body', 'iron', new THREE.CylinderGeometry(0.2 * k, 0.175 * k, 0.32, R + 2, 1, true, Math.PI * 0.05, Math.PI * 0.9).rotateZ(-0.3).translate(0.06, 0.25, 0));
  for (const s of [-1, 1]) {
    const big = q.big || r() < 0.5;
    put('body', 'iron', new THREE.SphereGeometry(0.105 * k * (big ? 1.2 : 1), R, 3, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.75, 1).rotateX(-s * 0.4).translate(0.07, 0.45, s * 0.24 * k));
    if (q.fine && big) for (let i = 0; i < (q.big ? 3 : 1); i++) put('body', 'edge', spikeAt(V3(0.05 + i * 0.04, 0.5, s * 0.27 * k), V3(-0.3, 1, s * 0.6), 0.1 + (q.big ? 0.06 : 0), 0.018, 4));
  }
  if (q.fine) put('body', 'iron', new THREE.CylinderGeometry(0.2 * k, 0.2 * k, 0.26, R, 1, true, Math.PI * 1.15, Math.PI * 0.7).rotateZ(-0.35).translate(0.02, 0.3, 0));
  if (q.big && q.fine) for (let i = 0; i < 4; i++) put('body', 'edge', spikeAt(V3(-0.12 + i * 0.03, 0.22 + i * 0.08, 0), V3(-1, 0.6, 0), 0.12, 0.022, 4));
  // the head: a low skull, a heavy brow, an underslung jaw, tusks, small
  // yellow eyes, ragged ears; and the helm
  put('head', 'skin', lump(0.105 * k, { p: [0.02, 0.07, 0], s: [1.15, 0.92, 0.95] }, { detail: det + 1, amp: 0.1, seed: seed + 5 }));
  put('head', 'dark', lump(0.06 * k, { p: [0.1, 0.1, 0], s: [0.8, 0.45, 1.6] }, { detail: det, amp: 0.1, seed: seed + 6 }));
  put('head', 'skin', lump(0.072 * k, { p: [0.085, -0.02, 0], s: [0.95, 0.66, 1.12] }, { detail: det, amp: 0.1, seed: seed + 7 }));
  if (!tiny) put('head', 'dark', new THREE.ConeGeometry(0.03 * k, 0.07, 4).rotateZ(-Math.PI / 2 - 0.5).translate(0.14 * k, 0.05, 0));
  for (const s of [-1, 1]) {
    put('head', 'skin', along(new THREE.ConeGeometry(0.035, 0.13 * k, 3).scale(1, 1, 0.4).translate(0, 0.065 * k, 0), V3(-0.5, 0.35, s), V3(0.0, 0.08, s * 0.09 * k)));
    if (q.fine) put('head', 'eye', new THREE.SphereGeometry(0.017, 5, 4).translate(0.12 * k, 0.075, s * 0.042 * k));
    if (!tiny) put('head', 'tooth', new THREE.ConeGeometry(0.012 * k, 0.05 * k, 3).rotateZ(-0.2).translate(0.13 * k, 0.005, s * 0.035 * k));
  }
  if (helm < 0.85 || q.big) {
    put('head', 'iron', new THREE.SphereGeometry(0.128 * k, R + 1, q.fine ? 4 : 3, 0, TAU, 0, Math.PI * 0.5).scale(1.15, 0.85, 1.05).translate(0.015, 0.085, 0));
    put('head', 'iron', new THREE.BoxGeometry(0.03, 0.09, 0.022).translate(0.152 * k, 0.07, 0));
    if (q.fine && helm < 0.4) put('head', 'iron', new THREE.CylinderGeometry(0.155 * k, 0.16 * k, 0.02, R + 1).translate(0.02, 0.09, 0));
    if (q.fine && (helm > 0.55 || q.big)) for (let i = 0; i < 3; i++) put('head', 'edge', spikeAt(V3(0.06 - i * 0.06, 0.18 * k - i * 0.01, 0), V3(-0.3, 1, 0), 0.1 + (q.big ? 0.05 : 0), 0.02, 4));
    if (q.big) for (const s of [-1, 1]) put('head', 'edge', tube([[0, 0.12, s * 0.1], [-0.02, 0.22, s * 0.2], [-0.1, 0.3, s * 0.22]], 0.025, 0.004, { seg: 4, radial: 4 }));
  }
  // the arms: long, the hands big
  for (const s of ['L', 'R']) {
    put(`arm${s}`, 'skin', sweep([[0, 0, 0], [0, -0.14, 0], [0, -0.27, 0]], [[0.062 * k], [0.056 * k], [0.046 * k]], { seg: q.seg, radial: R }));
    put(`fore${s}`, 'skin', sweep([[0, 0, 0], [0.005, -0.13, 0], [0.01, -0.26, 0]], [[0.047 * k], [0.046 * k], [0.038 * k]], { seg: q.seg, radial: R }));
    put(`fore${s}`, 'skin', lump(0.048 * k, { p: [0.012, -0.29, 0], s: [1, 1.25, 0.75] }, { detail: det, amp: 0.15, seed: seed + 11 }));
    if (q.fine) put(`fore${s}`, 'iron', new THREE.CylinderGeometry(0.055 * k, 0.05 * k, 0.12, R, 1, true).translate(0.006, -0.16, 0));
  }
  // the weapon, in the hand's frame, along its +x: a spear for the march,
  // or a jagged blade
  if (q.spear) {
    put('hand', 'shaft', new THREE.CylinderGeometry(0.017, 0.017, 2.2, 4).rotateZ(-Math.PI / 2).translate(0.25, 0, 0));
    put('hand', 'steel', new THREE.ConeGeometry(0.05, 0.3, 4).scale(1, 1, 0.35).rotateZ(-Math.PI / 2).translate(1.5, 0, 0));
  } else {
    const L = q.big ? 0.95 : 0.66 + r() * 0.12;
    const wd = q.big ? 1.35 : 1;
    const sh = new THREE.Shape();
    sh.moveTo(0.02, 0.018 * wd);
    sh.quadraticCurveTo(L * 0.5, 0.05 * wd, L * 0.92, 0.07 * wd);
    sh.lineTo(L, 0.02 * wd);
    // a hooked point, then the edge back, notched and broken
    sh.lineTo(L * 0.86, -0.07 * wd);
    for (let i = 0; i < 5; i++) {
      const x = L * (0.78 - i * 0.14);
      sh.lineTo(x + L * 0.04, -(0.085 + r() * 0.02) * wd);
      sh.lineTo(x, -(0.055 + r() * 0.02) * wd);
    }
    sh.lineTo(0.02, -0.03 * wd);
    sh.closePath();
    put('hand', 'steel', new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -0.007));
    put('hand', 'leather', new THREE.CylinderGeometry(0.02, 0.02, 0.15, 5).rotateZ(-Math.PI / 2).translate(-0.06, 0, 0));
    put('hand', 'iron', new THREE.BoxGeometry(0.03, 0.1 * wd, 0.04).translate(0.02, -0.005, 0));
  }
  return out;
}

// The orcs' stance, march, run and brawl: `fighting` 0..1 crouches and
// hacks with the blade; `spear` carries a spear upright on the march.
export function orcPose(b, t, { running = false, fighting = 0, march = false, ph0 = 0, spear = false } = {}) {
  const w = running ? 1 : march ? 0.55 : 0;
  const f = clamp01(fighting);
  const ph = t * (running ? 10.5 : 6.4) + ph0;
  const sw = Math.sin(ph) * w;
  const idle = Math.sin(t * 1.9 + ph0);
  // the brawl: wind up, a fast hack down, recover
  const fp = t * 0.62 + ph0 * 0.3;
  const cyc = fp - Math.floor(fp);
  const raise = cyc < 0.5 ? smooth(0, 0.5, cyc) : cyc < 0.62 ? 1 - smooth(0.5, 0.62, cyc) : 0;
  const lunge = cyc > 0.5 && cyc < 0.85 ? Math.sin(((cyc - 0.5) / 0.35) * Math.PI) : 0;
  b.hips.position.set(lunge * 0.1 * f, 0.78 - 0.05 * w + Math.abs(Math.cos(ph)) * 0.05 * w - f * 0.1 + idle * 0.005, 0);
  b.hips.rotation.set(0, Math.sin(ph) * 0.12 * w + f * 0.3, 0);
  b.legL.rotation.set(0.04, 0, sw * 0.75 + f * 0.5 + 0.05 * (1 - w));
  b.legR.rotation.set(-0.04, 0, -sw * 0.75 - f * 0.3 - 0.05 * (1 - w));
  b.shinL.rotation.z = -Math.max(0, -Math.cos(ph)) * 1.1 * w - f * 0.6 - 0.12;
  b.shinR.rotation.z = -Math.max(0, Math.cos(ph)) * 1.1 * w - f * 0.35 - 0.12;
  b.body.rotation.set(0, -Math.sin(ph) * 0.18 * w + f * (raise * 0.45 - lunge * 0.5), -0.3 - 0.22 * w - f * (0.1 + lunge * 0.22) + idle * 0.02);
  b.head.rotation.set(0, Math.sin(t * 0.8 + ph0) * 0.3 * (1 - w) * (1 - f), 0.28 + 0.22 * w + f * 0.12);
  b.armL.rotation.set(-0.2, 0, -sw * 0.8 + f * 0.6 + 0.1);
  b.foreL.rotation.z = 0.5 + Math.max(0, -sw) * 0.6 + f * 0.7;
  if (spear) {
    b.armR.rotation.set(-0.12, 0, 0.25 + sw * 0.15);
    b.foreR.rotation.z = 1.25;
    b.hand.rotation.set(0.05, 0, Math.PI / 2 - (b.body.rotation.z + b.armR.rotation.z + b.foreR.rotation.z));
  } else {
    b.armR.rotation.set(0.15 - raise * 0.2 * f, 0, mix(0.35 + sw * 0.55, 2.8 * raise + 0.35 * lunge, f));
    b.foreR.rotation.z = mix(1.05 + Math.max(0, sw) * 0.3, 0.5 + raise * 1.0, f);
    b.hand.rotation.set(0, 0, mix(0.15, -0.4 + raise * 0.7 + lunge * 0.3, f));
  }
}

// Colour an orc's parts: mottled grey-brown skin, its iron, leather, rags.
function orcTone(kind, n) {
  const base = ORC[kind] ?? ORC.skin;
  return (x, y, z, out, nx, ny) => {
    const m = noise3(n, x * 9, y * 9, z * 9);
    if (kind === 'skin' || kind === 'dark') {
      out.copy(kind === 'dark' ? ORC.dark : ORC.skin).multiplyScalar(0.72 + m * 0.5);
      out.lerp(ORC.dark, smooth(0.55, 0.75, noise3(n, x * 4 + 3, y * 4, z * 4)) * 0.6);
      out.lerp(ORC.pale, clamp01(-ny) * 0.25);
    } else if (kind === 'iron' || kind === 'edge' || kind === 'steel') {
      out.copy(base).multiplyScalar(0.75 + m * 0.5).lerp(ORC.rust, smooth(0.55, 0.78, noise3(n, x * 7 + 5, y * 7, z * 7)) * (kind === 'steel' ? 0.6 : 0.4));
    } else out.copy(base).multiplyScalar(0.8 + m * 0.4);
  };
}

// A Mordor orc, about 1.5 m and hunched; `big` is Shagrat, near 1.9 m and
// heavier. Skinned on one skeleton: two meshes. Faces +x.
// animate(t, { running, fighting }).
export function orc(K, seed = 1, { big = false } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = big ? 'shagrat' : 'orc';
  const { b, list } = orcRig(g, () => new THREE.Bone());
  g.updateMatrixWorld(true);
  const n = makeNoise(seed * 13 + 5);
  const sk = skinParts(list);
  for (const [name, kind, geo] of orcParts(seed, { rad: 7, seg: 3, fine: true, big })) {
    tint(geo, orcTone(kind, n));
    sk.add(ORC_METAL.has(kind) || kind === 'leather' || kind === 'shaft' ? mats.orcGear : mats.orcSkin, b[name], geo);
  }
  const meshes = sk.build(g);
  const r = rng(seed * 5 + 1);
  const tall = big ? 1.28 : 1.0 + r() * 0.08;
  b.root.scale.setScalar(tall);
  const ph0 = r() * TAU;
  const animate = (t, { running = false, fighting = 0 } = {}) => orcPose(b, t, { running, fighting, ph0 });
  animate(0);
  return { group: g, bones: b, head: b.head, meshes, animate };
}

// One orc of the host on the march, his spear upright, as one
// vertex-coloured geometry for a column (an InstancedMesh, under 600
// triangles).
export function orcColumnGeo() {
  const root = new THREE.Group();
  const { b } = orcRig(root);
  orcPose(b, 0.25, { march: true, spear: true });
  root.updateMatrixWorld(true);
  const n = makeNoise(5);
  const list = orcParts(5, { rad: 4, seg: 2, fine: false, spear: true }).map(([name, kind, geo]) => tint(geo.applyMatrix4(b[name].matrixWorld), orcTone(kind, n)));
  return oneGeo(list);
}

// A dead orc sprawled on the flags, as one geometry (for the court).
export function deadOrcGeo(seed) {
  const r = rng(seed * 3 + 1);
  const root = new THREE.Group();
  const { b } = orcRig(root);
  const face = r() < 0.5;
  b.hips.position.set(0, 0.16, 0);
  b.hips.rotation.set(face ? Math.PI : 0, r() * TAU, face ? -Math.PI / 2 : Math.PI / 2, 'YXZ');
  b.body.rotation.set((r() - 0.5) * 0.4, 0, -0.2 + (r() - 0.5) * 0.3);
  b.head.rotation.set((r() - 0.5) * 1.2, (r() - 0.5) * 0.8, 0.4);
  b.legL.rotation.set(r() * 0.5, 0, (r() - 0.3) * 0.8);
  b.legR.rotation.set(-r() * 0.5, 0, (r() - 0.6) * 0.8);
  b.shinL.rotation.z = -r() * 0.9;
  b.shinR.rotation.z = -r() * 0.6;
  b.armL.rotation.set(-0.4 - r() * 1.6, 0, (r() - 0.5) * 1.4);
  b.armR.rotation.set(0.4 + r() * 1.6, 0, (r() - 0.5) * 1.4);
  b.foreL.rotation.z = r() * 1.2;
  b.foreR.rotation.z = r() * 1.2;
  root.updateMatrixWorld(true);
  const n = makeNoise(seed + 7);
  const list = orcParts(seed + 20, { rad: 5, seg: 2, fine: false, spear: false })
    .filter(([name]) => name !== 'hand' || r() < 0.3)
    .map(([name, kind, geo]) => tint(geo.applyMatrix4(b[name].matrixWorld), orcTone(kind, n)));
  return list;
}
