// The Easterlings, one by one and as a marching column, and Sam’s elven
// cloak. Moved out of props.js as they were.

import * as THREE from 'three';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { boxUV, parts, rng } from '../../shire/build';
import { bone, C, lump, noise3, oneGeo, solid, spikeAt, sweep, TAU, tint, V3 } from './helpers';
import { _kc2 } from './marsh';

// ── the Easterlings ──

const EAST = { lacquer: C(0x8c1c14), maroon: C(0x4c100c), gold: C(0xd0a038), black: C(0x16120f), cloth: C(0x30201a), steel: C(0xb4b8bc), shaft: C(0x2a140e), tassel: C(0xa01810) };
const EAST_METAL = new Set(['gold', 'steel']);
// Bones: [parent, position]. The figure faces +x, its right side +z.
const EAST_BONES = {
  hips: [null, [0, 1.0, 0]],
  legL: ['hips', [0, -0.03, -0.13]],
  legR: ['hips', [0, -0.03, 0.13]],
  shinL: ['legL', [0, -0.47, 0]],
  shinR: ['legR', [0, -0.47, 0]],
  body: ['hips', [0, 0.04, 0]],
  head: ['body', [0, 0.76, 0]],
  armL: ['body', [0, 0.62, -0.31]],
  armR: ['body', [0, 0.62, 0.31]],
  foreL: ['armL', [0, -0.35, 0]],
  foreR: ['armR', [0, -0.35, 0]],
  spear: ['foreR', [0, -0.36, 0]],
};
function eastRig(root) {
  const b = {};
  for (const [name, [parent, p]] of Object.entries(EAST_BONES)) b[name] = bone(name, parent ? b[parent] : root, p);
  return b;
}

// The parts of an Easterling, each in its bone's frame: [bone, kind, geo].
// `q` sets the detail: q.rad round, q.seg along, q.fine for the trim.
function eastParts(seed, q) {
  const r = rng(seed * 31 + 7);
  const out = [];
  const put = (b, kind, geo) => out.push([b, kind, geo]);
  const R = q.rad;
  const helm = r() < 0.5 ? 'lacquer' : 'black';
  // the hips: a skirt of lacquered lames in tiers, a belt
  put('hips', 'cloth', new THREE.CylinderGeometry(0.19, 0.2, 0.2, R).translate(0, -0.02, 0));
  const tiers = q.fine ? 3 : 2;
  for (let i = 0; i < tiers; i++) {
    const y = -0.07 - i * (q.fine ? 0.13 : 0.19);
    const rt = 0.22 + i * 0.025;
    const rb = 0.27 + i * 0.03;
    const h = q.fine ? 0.17 : 0.22;
    for (const side of [0, Math.PI]) {
      put('hips', i % 2 ? 'maroon' : 'lacquer', new THREE.CylinderGeometry(rt, rb, h, R, 1, !q.fine, side + 0.45, Math.PI - 0.9).translate(0, y, 0));
      if (q.fine) put('hips', 'gold', new THREE.TorusGeometry(rb, 0.011, 3, R, Math.PI - 0.9).rotateX(Math.PI / 2).rotateY(-(side + 0.45) + Math.PI / 2 - (Math.PI - 0.9)).translate(0, y - h / 2, 0));
    }
  }
  put('hips', 'gold', new THREE.CylinderGeometry(0.205, 0.205, 0.06, R).translate(0, 0.07, 0));
  // an apron of cloth before and behind, between the legs
  if (q.fine) for (const s of [-1, 1]) put('hips', 'maroon', new THREE.BoxGeometry(0.03, 0.42, 0.2).translate(s * 0.215, -0.2, 0).rotateZ(s * -0.08));
  // the legs
  for (const s of ['L', 'R']) {
    put(`leg${s}`, 'cloth', sweep([[0, 0, 0], [0, -0.47, 0]], [[0.1], [0.08]], { seg: q.seg, radial: R }));
    put(`leg${s}`, 'lacquer', lump(0.07, { p: [0.05, -0.46, 0], s: [0.8, 1, 1] }, { detail: q.fine ? 1 : 0, amp: 0.05 }));
    put(`shin${s}`, 'lacquer', sweep([[0, -0.02, 0], [0, -0.36, 0]], [[0.088], [0.07]], { seg: q.seg, radial: R }));
    if (q.fine) put(`shin${s}`, 'gold', new THREE.TorusGeometry(0.088, 0.01, 4, R).rotateX(Math.PI / 2).translate(0, -0.03, 0));
    put(`shin${s}`, 'black', new THREE.CylinderGeometry(0.075, 0.08, 0.1, R).translate(0, -0.41, 0));
    put(`shin${s}`, 'black', lump(0.08, { p: [0.065, -0.47, 0], s: [1.7, 0.55, 0.95] }, { detail: q.fine ? 1 : 0, amp: 0.04 }));
  }
  // the body: a lacquered cuirass edged in gold, a sun on its breast
  const rows = [[0.17, 0.2], [0.19, 0.24], [0.21, 0.28], [0.15, 0.25]];
  put('body', 'lacquer', sweep([[0, 0, 0], [0.01, 0.25, 0], [0.012, 0.5, 0], [0, 0.72, 0]], rows, { seg: q.fine ? 8 : 3, radial: R + 2 }));
  if (q.fine) {
    for (const [y, rf, rs] of [[0.16, 0.185, 0.235], [0.4, 0.21, 0.275]]) put('body', 'gold', new THREE.TorusGeometry(1, 0.012, 4, R * 2).scale(rf + 0.006, rs + 0.006, 1).rotateX(Math.PI / 2).translate(0.01, y, 0));
  }
  put('body', 'gold', new THREE.CylinderGeometry(0.075, 0.075, 0.025, q.fine ? 12 : 6).rotateZ(Math.PI / 2).translate(0.225, 0.52, 0));
  if (q.fine) for (let i = 0; i < 8; i++) put('body', 'gold', spikeAt(V3(0.23, 0.52, 0), V3(0, Math.cos((i / 8) * TAU), Math.sin((i / 8) * TAU)), 0.12, 0.018, 3));
  put('body', 'maroon', new THREE.CylinderGeometry(0.1, 0.14, 0.1, R).translate(0, 0.74, 0));
  // pauldrons: stacked shells over the shoulders
  for (const s of [-1, 1]) {
    const n = q.fine ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const geo = new THREE.SphereGeometry(0.16 - i * 0.012, R, q.fine ? 4 : 2, 0, TAU, 0, Math.PI * 0.5).scale(1.15, 0.65, 1).rotateX(-s * (0.35 + i * 0.15)).translate(0, 0.66 - i * 0.07, s * (0.3 + i * 0.03));
      put('body', i % 2 ? 'maroon' : 'lacquer', geo);
      if (q.fine) put('body', 'gold', new THREE.TorusGeometry(0.16 - i * 0.012, 0.009, 3, R).scale(1.15, 1, 1).rotateX(Math.PI / 2 - s * (0.35 + i * 0.15)).translate(0, 0.66 - i * 0.07, s * (0.3 + i * 0.03)));
    }
  }
  // the head: a helm with a spike and a crest, a neck guard of lames, and
  // the gold mask with its scowl
  put('head', 'black', new THREE.SphereGeometry(0.16, R, Math.max(3, R - 3)).translate(0, 0.13, 0));
  put('head', helm, new THREE.SphereGeometry(0.2, R + 2, q.fine ? 6 : 3, 0, TAU, 0, Math.PI * 0.55).scale(1, 1.08, 0.95).translate(-0.01, 0.17, 0));
  put('head', 'maroon', new THREE.CylinderGeometry(0.2, 0.27, 0.17, R * 2, 1, !q.fine, Math.PI / 2 + 1.0, TAU - 2.0).translate(-0.01, 0.07, 0));
  if (q.fine) put('head', 'gold', new THREE.TorusGeometry(0.205, 0.016, 4, 14, Math.PI).rotateY(0).translate(-0.01, 0.17, 0).scale(1, 1.05, 1));
  put('head', 'gold', new THREE.ConeGeometry(0.03, 0.16, q.fine ? 6 : 4).translate(-0.01, 0.46, 0));
  put('head', 'gold', lump(0.155, { p: [0.15, 0.12, 0], s: [0.36, 0.95, 0.84] }, { detail: q.fine ? 2 : 0, amp: 0.02 }));
  if (q.fine) {
    for (const s of [-1, 1]) {
      put('head', 'black', new THREE.BoxGeometry(0.03, 0.022, 0.07).rotateX(s * 0.3).translate(0.198, 0.152, s * 0.055));
      put('head', 'gold', new THREE.BoxGeometry(0.03, 0.026, 0.11).rotateX(-s * 0.32).translate(0.208, 0.188, s * 0.05));
    }
    put('head', 'gold', new THREE.ConeGeometry(0.022, 0.08, 4).rotateZ(-Math.PI / 2 - 0.3).translate(0.215, 0.105, 0));
    put('head', 'black', new THREE.BoxGeometry(0.02, 0.016, 0.08).translate(0.198, 0.05, 0));
  } else {
    put('head', 'black', new THREE.BoxGeometry(0.02, 0.03, 0.15).translate(0.205, 0.15, 0));
  }
  // the arms
  for (const s of ['L', 'R']) {
    put(`arm${s}`, 'maroon', sweep([[0, 0, 0], [0, -0.35, 0]], [[0.075], [0.066]], { seg: q.seg, radial: R }));
    put(`fore${s}`, 'lacquer', sweep([[0, -0.02, 0], [0, -0.3, 0]], [[0.072], [0.06]], { seg: q.seg, radial: R }));
    if (q.fine) put(`fore${s}`, 'gold', new THREE.TorusGeometry(0.072, 0.009, 3, R).rotateX(Math.PI / 2).translate(0, -0.03, 0));
    put(`fore${s}`, 'black', lump(0.062, { p: [0, -0.35, 0], s: [1, 1.1, 0.9] }, { detail: q.fine ? 1 : 0, amp: 0.04 }));
  }
  // the spear: a long dark shaft, a red tassel and gold collar, a leaf blade
  put('spear', 'shaft', new THREE.CylinderGeometry(0.022, 0.022, 3.1, q.fine ? 6 : 4).translate(0, 0.65, 0));
  put('spear', 'gold', new THREE.CylinderGeometry(0.032, 0.03, 0.09, q.fine ? 8 : 4).translate(0, 2.22, 0));
  put('spear', 'tassel', new THREE.ConeGeometry(0.07, 0.2, q.fine ? 8 : 4).rotateX(Math.PI).translate(0, 2.1, 0));
  put('spear', 'steel', new THREE.LatheGeometry([[0, 0], [0.05, 0.08], [0.042, 0.26], [0, 0.46]].map(([x, y]) => new THREE.Vector2(x, y)), 4).scale(1, 1, 0.3).translate(0, 2.26, 0));
  if (q.fine) put('spear', 'steel', new THREE.ConeGeometry(0.025, 0.12, 4).rotateX(Math.PI).translate(0, -0.95, 0));
  return out;
}

// The Easterlings' march and stance: legs striding, the free arm swinging,
// the spear carried upright on the right; `alert` levels it at you.
function eastPose(b, t, { marching = false, alert = 0 } = {}) {
  const w = marching ? 1 : 0;
  const a = clamp01(alert);
  const ph = t * 6.2;
  const sw = Math.sin(ph) * w;
  b.legL.rotation.z = sw * 0.42 + a * 0.3;
  b.legR.rotation.z = -sw * 0.42 - a * 0.18;
  b.shinL.rotation.z = -Math.max(0, -Math.cos(ph)) * 0.55 * w - a * 0.4;
  b.shinR.rotation.z = -Math.max(0, Math.cos(ph)) * 0.55 * w - a * 0.15;
  b.hips.position.y = 1.0 + (Math.abs(Math.cos(ph)) - 1) * 0.04 * w - a * 0.1;
  b.body.rotation.set(0, sw * 0.08, -0.05 * w - a * 0.2 + Math.sin(t * 1.7) * 0.012);
  b.head.rotation.set(0, Math.sin(t * 0.5) * 0.25 * (1 - w) * (1 - a), a * 0.15);
  b.armL.rotation.set(0.08, 0, -sw * 0.45 * (1 - a) + a * 0.85);
  b.foreL.rotation.z = 0.25 + a * 0.75;
  b.armR.rotation.set(-0.12, 0, mix(0.2, 1.05, a));
  b.foreR.rotation.z = mix(1.2, 0.35, a);
  const held = b.body.rotation.z + b.armR.rotation.z + b.foreR.rotation.z;
  b.spear.rotation.set(0.12 * (1 - a), 0, mix(-held + 0.06, -Math.PI / 2 - held - 0.12, a));
}

// An Easterling soldier, 2.3 m with the spike on his helm: red lacquered
// lames edged in gold, a masked helm with a gold face, a long spear. Faces
// +x. animate(t, { marching, alert }).
export function easterling(K, seed = 1) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'easterling';
  const b = eastRig(g);
  const byBone = new Map();
  for (const [name, kind, geo] of eastParts(seed, { rad: 10, seg: 6, fine: true })) {
    if (!byBone.has(name)) byBone.set(name, parts());
    const metal = EAST_METAL.has(kind);
    byBone.get(name).add(metal ? mats.eastMetal : mats.lacquer, solid(geo, EAST[kind]));
  }
  for (const [name, bk] of byBone) bk.build(b[name], { shadow: false, receive: false });
  const animate = (t, o = {}) => eastPose(b, t, o);
  animate(0);
  return { group: g, bones: b, head: b.head, animate };
}

// One Easterling mid-stride with his spear upright, as one vertex-coloured
// geometry for a marching column (under 800 triangles).
export function columnGeo() {
  const root = new THREE.Group();
  const b = eastRig(root);
  eastPose(b, Math.PI / 2 / 6.2, { marching: true });
  root.updateMatrixWorld(true);
  const list = eastParts(5, { rad: 5, seg: 2, fine: false }).map(([name, kind, geo]) => solid(geo.applyMatrix4(b[name].matrixWorld), EAST[kind]));
  return oneGeo(list);
}

// Sam's elven cloak thrown over a crouching hobbit: a lumpy drape about a
// metre long and a metre high, grey and mottled like the rocks, folds
// running down it, its hem flared on the ground. Faces +x.
export function elvenCloak(K) {
  const n = makeNoise(57);
  const geo = new THREE.SphereGeometry(1, 30, 16, 0, TAU, 0, Math.PI * 0.6);
  const p = geo.attributes.position;
  const bottom = Math.cos(Math.PI * 0.6);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const f = 1 - (y - bottom) / (1 - bottom);
    const fold = 1 + 0.07 * Math.sin(a * 7 + noise3(n, x, y, z) * 4) * f;
    const k = (1 + (noise3(n, x * 1.6 + 2, y * 1.6, z * 1.6) - 0.5) * 0.35) * fold * (1 + f * f * 0.25);
    // the hood over his head at the front, his pack making a hump behind
    const headBump = Math.exp(-((x - 0.5) ** 2 + (z * 1.2) ** 2 + (y - 0.75) ** 2) / 0.08) * 0.15;
    const pack = Math.exp(-((x + 0.45) ** 2 + (z * 1.1) ** 2 + (y - 0.6) ** 2) / 0.12) * 0.12;
    p.setXYZ(i, x * 0.52 * k, (y - bottom) / (1 - bottom) * (1.02 + headBump + pack) * (1 + (k - 1) * 0.3), z * 0.43 * k);
  }
  geo.computeVertexNormals();
  const g2 = geo.toNonIndexed();
  boxUV(g2, 1.2);
  g2.computeVertexNormals();
  tint(g2, (x, y, z, out) => {
    const v = noise3(n, x * 5, y * 5, z * 5);
    const a = Math.atan2(z, x);
    out.setRGB(0.3, 0.31, 0.29).multiplyScalar(0.7 + v * 0.6);
    out.lerp(_kc2.setRGB(0.36, 0.37, 0.3), smooth(0.6, 0.7, noise3(n, x * 9 + 3, y * 9, z * 9)) * 0.6);
    out.multiplyScalar(0.85 + 0.15 * Math.sin(a * 7 + noise3(n, x, y, z) * 4));
  });
  const group = new THREE.Group();
  group.name = 'elvenCloak';
  const mesh = new THREE.Mesh(g2, K.mats.cloak);
  group.add(mesh);
  return { group, mesh };
}
