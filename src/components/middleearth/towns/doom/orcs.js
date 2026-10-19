// The orcs (a rigged orc, the slave-driver with his whip, a column on the
// march in one geometry) and their camp. Moved out of props.js as they
// were; the orcs' hide and iron is the kit's material.

import * as THREE from 'three';
import { hot } from '../../../../lib/three/canvasTexture';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { parts, rng, tube } from '../../shire/build';
import { bone, C, facet, geoOf, glowSprite, hullRock, lump, noise3, oneGeo, rod, solid, spikeAt, sweep, TAU, tint, UP, V3 } from './helpers';
import { ASH } from './plain';

// ── the orcs ──

const ORC = {
  skin: [C(0x5e5a54), C(0x56544c), C(0x625a52), C(0x4e4c48)],
  blotch: C(0x2e2a26),
  green: C(0x50544a),
  scar: C(0x8a7e74),
  iron: C(0x1c1c1e),
  rust: C(0x3e2618),
  leather: C(0x2a2018),
  rag: C(0x2e2824),
  hair: C(0x0c0a09),
  tooth: C(0xb0a070),
  eye: C(0xd8a830),
  wood: C(0x2e2218),
  bone: C(0xb8ac90),
};
// Bones: [parent, position]. The figure faces +x, its right side +z.
const ORC_BONES = {
  hips: [null, [0, 0.76, 0]],
  legL: ['hips', [0, -0.02, -0.12]],
  legR: ['hips', [0, -0.02, 0.12]],
  shinL: ['legL', [0.05, -0.36, 0]],
  shinR: ['legR', [0.05, -0.36, 0]],
  body: ['hips', [0, 0.05, 0]],
  head: ['body', [0.1, 0.52, 0]],
  armL: ['body', [0.02, 0.43, -0.25]],
  armR: ['body', [0.02, 0.43, 0.25]],
  foreL: ['armL', [0, -0.3, 0]],
  foreR: ['armR', [0, -0.3, 0]],
  hand: ['foreR', [0, -0.3, 0]],
};
function orcRig(root) {
  const b = {};
  for (const [name, [parent, p]] of Object.entries(ORC_BONES)) b[name] = bone(name, parent ? b[parent] : root, p);
  return b;
}

// Mottled grey orc-hide: blotches, a sickly green here and there.
function orcSkin(n, base) {
  return (x, y, z, out) => {
    const m = noise3(n, x * 14, y * 14, z * 14);
    out.copy(base).multiplyScalar(0.75 + m * 0.5);
    out.lerp(ORC.blotch, smooth(0.55, 0.72, noise3(n, x * 6 + 3, y * 6, z * 6)) * 0.7);
    out.lerp(ORC.green, smooth(0.5, 0.7, noise3(n, x * 3 + 9, y * 3, z * 3)) * 0.4);
  };
}
// Black iron, rust bleeding from its edges.
function orcIron(n) {
  return (x, y, z, out) => {
    out.copy(ORC.iron).multiplyScalar(0.8 + noise3(n, x * 20, y * 20, z * 20) * 0.5);
    out.lerp(ORC.rust, smooth(0.58, 0.75, noise3(n, x * 9 + 5, y * 9, z * 9)) * 0.7);
  };
}

// The parts of an orc, each in its bone's frame: [bone, geo, colour, metal].
// `low` for the marching column: a few hundred triangles in all.
function orcParts(seed, { slaver = false, low = false, weapon = 'spear' } = {}) {
  const r = rng(seed * 31 + 7);
  const n = makeNoise(seed * 7 + 11);
  const out = [];
  const R = low ? 5 : 10;
  const S = low ? 2 : 6;
  const D = low ? 0 : 1;
  const W = slaver ? 1.15 : 1;
  const skin = orcSkin(n, ORC.skin[seed % ORC.skin.length]);
  const iron = orcIron(n);
  const put = (b, geo, colour, metal = 0) => out.push([b, geo, colour, metal]);
  const caps = low ? [false, false] : [true, true];
  // the legs: wrapped in rags and leather, bowed; iron on the shins
  for (const s of ['L', 'R']) {
    put(`leg${s}`, sweep([[0, 0.04, 0], [0.03, -0.18, 0], [0.05, -0.36, 0]], [[0.088 * W], [0.074 * W], [0.06 * W]], { seg: S, radial: R, caps }), ORC.leather);
    put(`shin${s}`, sweep([[0, 0, 0], [-0.01, -0.17, 0], [-0.03, -0.33, 0]], [[0.06 * W], [0.052 * W], [0.046 * W]], { seg: S, radial: R, caps }), skin);
    put(`shin${s}`, lump(0.075 * W, { p: [0.02, -0.36, 0], s: [1.75, 0.7, 1.0] }, { detail: D, amp: 0.06, seed: 3 }), ORC.leather);
    if (!low) {
      put(`shin${s}`, new THREE.CylinderGeometry(0.066 * W, 0.058 * W, 0.2, 8, 1, true, -Math.PI / 2 - 1.3, 2.6).translate(-0.012, -0.17, 0), iron, 1);
      put(`leg${s}`, new THREE.TorusGeometry(0.08 * W, 0.012, 3, 10).rotateX(Math.PI / 2).translate(0.02, -0.1, 0), ORC.leather);
      put(`leg${s}`, new THREE.TorusGeometry(0.068 * W, 0.012, 3, 10).rotateX(Math.PI / 2).translate(0.04, -0.27, 0), ORC.leather);
      for (const dz of [-0.035, 0, 0.035]) put(`shin${s}`, new THREE.ConeGeometry(0.012, 0.06, 4).rotateZ(-Math.PI / 2).translate(0.13 * W, -0.38, dz), ORC.hair);
    }
  }
  // the body, hunched, a hump on the back; iron over the chest; a skirt of
  // leather strips; a belt
  const rows = [[0.14, 0.17, 0.13], [0.16, 0.2, 0.15], [0.17, 0.24, 0.17], [0.11, 0.2, 0.12]].map((x) => x.map((v) => v * W));
  const chest = (x, y, z, o) => (x > 0.06 && y > 0.12 ? iron(x, y, z, o) : skin(x, y, z, o));
  put('body', sweep([[0, -0.02, 0], [0.02, 0.2, 0], [0.03, 0.38, 0], [0.0, 0.5, 0]], rows, { seg: low ? 3 : 8, radial: low ? 6 : 12, caps }), low ? chest : skin);
  put('body', lump(0.13 * W, { p: [-0.1, 0.38, 0], s: [1, 0.8, 1.4] }, { detail: D, amp: 0.08, seed: 5 }), skin);
  put('body', new THREE.CylinderGeometry(0.19 * W, 0.24 * W, 0.26, low ? 6 : 12, 1, true).translate(0, -0.12, 0), ORC.rag);
  if (!low) {
    const plate = sweep([[0.012, 0.1, 0], [0.025, 0.25, 0], [0.034, 0.4, 0], [0.01, 0.5, 0]], [[0.168, 0.212, 0.1], [0.18, 0.25, 0.1], [0.12, 0.215, 0.1], [0.12, 0.2, 0.1]].map((x) => x.map((v) => v * W)), { seg: 6, radial: 12, caps: [false, false] });
    const keep = plate.toNonIndexed();
    const pp = keep.attributes.position;
    const kept = [];
    for (let i = 0; i < pp.count; i += 3) {
      if ((pp.getX(i) + pp.getX(i + 1) + pp.getX(i + 2)) / 3 > 0.04) for (let k = 0; k < 3; k++) kept.push(pp.getX(i + k), pp.getY(i + k), pp.getZ(i + k));
    }
    put('body', facet(geoOf(kept, null)), iron, 1);
    for (let i = 0; i < 5; i++) put('body', new THREE.SphereGeometry(0.012, 4, 3).translate(0.19 * W, 0.18 + i * 0.06, (i % 2 ? 1 : -1) * 0.08), iron, 1);
    put('body', new THREE.TorusGeometry(0.205 * W, 0.022, 4, 14).rotateX(Math.PI / 2).scale(1, 1, 1.1).translate(0.01, 0.0, 0), ORC.leather);
    put('body', new THREE.BoxGeometry(0.05, 0.06, 0.08).translate(0.2 * W, 0, 0), iron, 1);
    // the skirt torn into strips
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      put('body', new THREE.BoxGeometry(0.012, 0.22 + r() * 0.08, 0.1).rotateY(-a).translate(Math.cos(a) * 0.235 * W, -0.2, Math.sin(a) * 0.235 * W), i % 2 ? ORC.leather : ORC.rag);
    }
    // the neck, thick, thrust forward
    put('body', rod([0.02, 0.44, 0], [0.12, 0.56, 0], 0.075 * W, 0.065 * W, 8), skin);
  } else {
    put('body', rod([0.02, 0.44, 0], [0.12, 0.56, 0], 0.075, 0.065, 4), skin);
  }
  // a spiked iron pauldron on the left shoulder (both, on the slaver)
  for (const sd of slaver ? [-1, 1] : [-1]) {
    put('body', new THREE.SphereGeometry(0.12 * W, low ? 5 : 9, low ? 2 : 4, 0, TAU, 0, Math.PI * 0.5).scale(1.1, 0.8, 1).rotateX(sd * 0.5).translate(0.0, 0.45, sd * 0.25 * W), iron, 1);
    if (!low) for (let i = 0; i < 3; i++) put('body', spikeAt(V3(-0.04 + i * 0.04, 0.52, sd * (0.27 + i * 0.01) * W), V3(-0.2, 1, sd * 0.4), 0.09 + i * 0.02, 0.016, 4), iron, 1);
  }
  if (slaver && !low) {
    // a harness of straps over his bare shoulders
    for (const sd of [-1, 1]) put('body', sweep([[0.17, 0.05, sd * -0.1], [0.2, 0.3, sd * 0.05], [0.1, 0.5, sd * 0.16], [-0.12, 0.42, sd * 0.12], [-0.16, 0.1, sd * -0.08]], [[0.012, 0.03]], { seg: 14, radial: 4 }), ORC.leather);
  }

  // the head: a big low skull, a heavy brow, a jaw like a trap and tusks
  // up out of it, a flat nose, ears like blades; small yellow eyes
  const hs = slaver ? 1.08 : 1;
  const hd = (geo) => geo.scale(hs, hs, hs);
  put('head', hd(lump(0.115, { p: [0.0, 0.07, 0], s: [1.15, 0.95, 0.95] }, { detail: low ? 0 : 2, amp: 0.06, seed: 7 })), skin);
  put('head', hd(lump(0.08, { p: [0.09, -0.03, 0], s: [0.95, 0.7, 1.05] }, { detail: D, amp: 0.05, seed: 8 })), skin);
  if (!low) {
    put('head', hd(lump(0.07, { p: [0.09, 0.09, 0], s: [0.55, 0.35, 1.3] }, { detail: 1, amp: 0.05, seed: 9 })), (x, y, z, o) => skin(x, y, z, o.copy(ORC.blotch)));
    put('head', hd(lump(0.085, { p: [0.11, -0.08, 0], s: [0.75, 0.42, 1.0] }, { detail: 1, amp: 0.05, seed: 10 })), skin);
    put('head', hd(lump(0.03, { p: [0.165, 0.025, 0], s: [0.7, 0.6, 1.0] }, { detail: 1, amp: 0.05, seed: 11 })), skin);
    for (const sd of [-1, 1]) {
      put('head', hd(new THREE.ConeGeometry(0.013, 0.06, 4).translate(0.17, -0.04, sd * 0.04).rotateZ(0)), ORC.tooth);
      put('head', hd(new THREE.SphereGeometry(0.013, 6, 4).translate(0.142, 0.05, sd * 0.042)), ORC.eye);
      put('head', hd(new THREE.ConeGeometry(0.035, 0.15, 4).scale(1, 1, 0.35).rotateX(sd * 1.25).rotateY(sd * 0.5).translate(-0.01, 0.07, sd * 0.11)), skin);
      put('head', hd(new THREE.SphereGeometry(0.006, 4, 3).translate(0.185, 0.02, sd * 0.012)), ORC.hair);
    }
    for (let i = 0; i < 4; i++) put('head', hd(new THREE.ConeGeometry(0.007, 0.022, 3).translate(0.165, -0.045, (i - 1.5) * 0.017)), ORC.tooth);
  } else {
    for (const sd of [-1, 1]) put('head', new THREE.ConeGeometry(0.035, 0.15, 3).scale(1, 1, 0.35).rotateX(sd * 1.25).translate(-0.01, 0.07, sd * 0.11), skin);
  }
  const helm = slaver ? 3 : low ? 1 : seed % 3;
  if (helm === 0) {
    // bare-headed: lank black hair down the back of the skull
    for (let i = 0; i < 7; i++) {
      const z = (i / 6 - 0.5) * 0.14;
      put('head', tube([[0.04, 0.17, z * 0.6], [-0.06, 0.15, z], [-0.13, 0.05, z * 1.2], [-0.15, -0.12 - r() * 0.08, z * 1.3]], 0.012, 0.004, { seg: 6, radial: 3 }), ORC.hair);
    }
  } else {
    put('head', hd(new THREE.SphereGeometry(0.128, low ? 6 : 12, low ? 2 : 5, 0, TAU, 0, Math.PI * 0.52).scale(1.12, 0.9, 1.02).translate(0.0, 0.09, 0)), iron, 1);
    if (!low) {
      put('head', hd(new THREE.BoxGeometry(0.02, 0.1, 0.022).translate(0.15, 0.06, 0)), iron, 1);
      put('head', hd(new THREE.TorusGeometry(0.13, 0.01, 3, 16).rotateX(Math.PI / 2).scale(1.12, 1, 1.02).translate(0, 0.09, 0)), iron, 1);
    }
    if (helm === 1) put('head', hd(spikeAt(V3(-0.01, 0.19, 0), V3(-0.25, 1, 0), 0.12, 0.022, 4)), iron, 1);
    if (helm === 2) {
      for (const sd of [-1, 1]) put('head', hd(new THREE.BoxGeometry(0.08, 0.1, 0.012).rotateY(sd * 0.25).translate(0.09, 0.02, sd * 0.12)), iron, 1);
      for (let i = 0; i < 3; i++) put('head', hd(spikeAt(V3(0.06 - i * 0.06, 0.19 - i * 0.012, 0), V3(-0.3, 1, 0), 0.06 + i * 0.015, 0.012, 3)), iron, 1);
    }
    if (helm === 3) {
      // the slave-driver's: horns swept back
      for (const sd of [-1, 1]) put('head', hd(tube([[0.02, 0.15, sd * 0.09], [-0.05, 0.25, sd * 0.15], [-0.17, 0.27, sd * 0.17], [-0.25, 0.2, sd * 0.16]], 0.026, 0.004, { seg: 10, radial: 6 })), C(0x2a241e));
    }
  }

  // the arms, long; leather bracers; clawed hands
  for (const s of ['L', 'R']) {
    put(`arm${s}`, sweep([[0, 0.02, 0], [0.005, -0.15, 0], [0, -0.3, 0]], [[0.068 * W], [0.058 * W], [0.05 * W]], { seg: S, radial: R, caps }), skin);
    put(`fore${s}`, sweep([[0, 0, 0], [0.004, -0.15, 0], [0, -0.3, 0]], [[0.05 * W], [0.046 * W], [0.04 * W]], { seg: S, radial: R, caps }), skin);
    if (!low) put(`fore${s}`, new THREE.CylinderGeometry(0.052 * W, 0.046 * W, 0.16, 8, 1, true).translate(0, -0.17, 0), ORC.leather);
    const hb = s === 'R' ? 'hand' : 'foreL';
    const hy = s === 'R' ? 0 : -0.3;
    put(hb, lump(0.045 * W, { p: [0.008, hy - 0.04, 0], s: [0.9, 1.2, 0.8] }, { detail: D, amp: 0.05, seed: 12 }), skin);
    if (!low) {
      for (let f = 0; f < 4; f++) {
        const z = (f - 1.5) * 0.017;
        put(hb, tube([[0.01, hy - 0.07, z], [0.03, hy - 0.11, z * 1.1], [0.015, hy - 0.15, z * 1.2]], 0.011, 0.004, { seg: 4, radial: 4 }), skin);
        put(hb, new THREE.ConeGeometry(0.005, 0.025, 3).rotateZ(Math.PI - 0.5).translate(0.008, hy - 0.16, z * 1.2), ORC.hair);
      }
    }
  }

  // what he carries, in his right fist
  if (weapon === 'spear') {
    put('hand', new THREE.CylinderGeometry(0.016, 0.016, 2.1, low ? 4 : 6).translate(0, 0.32, 0), ORC.wood);
    put('hand', new THREE.ConeGeometry(0.045, 0.32, low ? 4 : 4).scale(1, 1, 0.3).translate(0, 1.52, 0), iron, 1);
    if (!low) {
      for (const sd of [-1, 1]) put('hand', spikeAt(V3(0, 1.4, 0), V3(sd * 0.6, -1, 0), 0.08, 0.012, 3), iron, 1);
      put('hand', new THREE.CylinderGeometry(0.022, 0.022, 0.08, 6).translate(0, 1.36, 0), ORC.leather);
    }
  } else if (weapon === 'blade') {
    const sh = new THREE.Shape();
    sh.moveTo(-0.022, 0);
    sh.quadraticCurveTo(-0.04, 0.35, 0.03, 0.66);
    sh.lineTo(0.06, 0.6);
    sh.lineTo(0.05, 0.52);
    sh.quadraticCurveTo(0.055, 0.25, 0.03, 0);
    const blade = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }).translate(0, 0.06, -0.006);
    put('hand', blade, iron, 1);
    put('hand', new THREE.BoxGeometry(0.1, 0.025, 0.04).translate(0.005, 0.06, 0), iron, 1);
    put('hand', new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6).translate(0, -0.02, 0), ORC.leather);
  } else if (weapon === 'whip') {
    put('hand', new THREE.CylinderGeometry(0.02, 0.016, 0.34, 6).rotateZ(Math.PI / 2 + 0.25).translate(0.1, -0.06, 0), ORC.leather);
    put('hand', new THREE.SphereGeometry(0.025, 6, 4).translate(-0.06, -0.02, 0), iron, 1);
  }
  return out;
}

// The orcs' march and stance. The spear is carried upright; the slaver's
// whip arm swings up and back and lashes down (lash 0..1).
function orcPose(b, t, { marching = false, lash = 0, slaver = false, phase = 0 } = {}) {
  const w = marching ? 1 : 0;
  const ph = t * 6.8 + phase;
  const sw = Math.sin(ph) * w;
  const breathe = Math.sin(t * 1.9 + phase);
  b.legL.rotation.z = 0.12 + sw * 0.48;
  b.legR.rotation.z = 0.12 - sw * 0.48;
  b.shinL.rotation.z = -0.32 - Math.max(0, -Math.cos(ph)) * 0.6 * w;
  b.shinR.rotation.z = -0.32 - Math.max(0, Math.cos(ph)) * 0.6 * w;
  b.hips.position.y = 0.74 + (Math.abs(Math.cos(ph)) - 1) * 0.035 * w;
  b.hips.rotation.y = sw * 0.08;
  b.body.rotation.set(Math.sin(ph) * 0.04 * w, -sw * 0.12, -0.42 - 0.06 * w + breathe * 0.015);
  b.head.rotation.set(0, Math.sin(t * 0.6 + phase) * 0.35 * (1 - w), 0.38 + 0.05 * w);
  b.armL.rotation.set(-0.15, 0, -sw * 0.5 + 0.25);
  b.foreL.rotation.z = 0.35 + Math.max(0, sw) * 0.3;
  if (slaver) {
    const L = clamp01(lash);
    const up = smooth(0, 0.35, L);
    const down = smooth(0.35, 0.62, L);
    const back = smooth(0.62, 1, L);
    const a = mix(mix(mix(0.3 + sw * 0.4, 3.6, up), 0.75, down), 0.3 + sw * 0.4, back);
    b.armR.rotation.set(0.15 + 0.2 * up * (1 - down), 0, a);
    b.foreR.rotation.z = mix(mix(mix(0.4, 1.3, up), 0.15, down), 0.4, back);
    b.body.rotation.z += -0.18 * down * (1 - back) + 0.1 * up * (1 - down);
    b.hand.rotation.set(0, 0, mix(mix(0, -0.5, up), 0.4, down) * (1 - back));
  } else {
    b.armR.rotation.set(-0.1, 0, 0.55 + sw * 0.05);
    b.foreR.rotation.z = 1.05;
    const held = b.body.rotation.z + b.armR.rotation.z + b.foreR.rotation.z;
    b.hand.rotation.set(0.1, 0, -held + 0.08);
  }
}

// A Mordor orc, about 1.5 m, hunched and long in the arm: mottled grey
// skin, black iron on his chest, shoulder, shins and head, leather and
// rags; a barbed spear (or a jagged blade). The slaver (slaver: true) is
// bigger, 1.9 m, horned and harnessed, with a whip. Faces +x, on y = 0.
// animate(t, { marching, lash }), lash 0..1 cracking the whip.
export function orc(K, seed = 1, { slaver = false } = {}) {
  const mat = K.mats.orcFlesh;
  const g = new THREE.Group();
  g.name = slaver ? 'orcSlaver' : 'orc';
  const root = bone('root', g);
  const b = orcRig(root);
  const weapon = slaver ? 'whip' : seed % 4 === 3 ? 'blade' : 'spear';
  const byBone = new Map();
  for (const [name, geo, colour, metal] of orcParts(seed, { slaver, weapon })) {
    if (!byBone.has(name)) byBone.set(name, []);
    const gg = typeof colour === 'function' ? tint(geo, colour) : solid(geo, colour);
    const m = new Float32Array(gg.attributes.position.count).fill(metal);
    gg.setAttribute('metal', new THREE.BufferAttribute(m, 1));
    byBone.get(name).push(gg);
  }
  for (const [name, list] of byBone) {
    const mesh = new THREE.Mesh(oneGeo(list, ['metal']), mat);
    mesh.name = name;
    b[name].add(mesh);
  }
  const scale = slaver ? 1.9 / 1.5 : 1;
  root.scale.setScalar(scale * (slaver ? 1 : 0.96 + (seed % 5) * 0.02));
  const phase = seed * 1.7;
  let whip = null;
  if (slaver) {
    // the lash: a tapering cord rewritten each frame from the whip's handle
    const SEG = 22;
    const RAD = 5;
    const Wd = RAD + 1;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((SEG + 1) * Wd * 3);
    const idx = [];
    for (let k = 0; k < SEG; k++) for (let j = 0; j < RAD; j++) {
      const a = k * Wd + j;
      idx.push(a, a + Wd, a + 1, a + 1, a + Wd, a + Wd + 1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    geo.setIndex(idx);
    const lashMesh = new THREE.Mesh(geo, K.mats.lash);
    lashMesh.frustumCulled = false;
    lashMesh.name = 'lash';
    g.add(lashMesh);
    const tipFlash = glowSprite(K.tex.glow, hot(0xfff0d0, 2), 0.35, 0);
    g.add(tipFlash);
    const LEN = 3.2;
    const pts = Array.from({ length: SEG + 1 }, () => V3());
    const start = V3();
    const T = V3();
    const N = V3();
    const Bn = V3();
    const ref = V3(0, 0, 1);
    whip = (t, lash) => {
      const L = clamp01(lash);
      g.updateMatrixWorld(true);
      b.hand.localToWorld(start.set(0.26, -0.1, 0));
      g.worldToLocal(start);
      const up = smooth(0, 0.35, L);
      const strike = clamp01((L - 0.35) / 0.27);
      const back = smooth(0.62, 1, L);
      pts[0].copy(start);
      for (let k = 1; k <= SEG; k++) {
        const s = k / SEG;
        const rest = -0.35 - 1.25 * s;
        const wind = mix(rest, -1.5 - 0.4 * s, up) + TAU * (strike > 0 ? 1 : 0);
        const fwd = 1.42 - 0.1 * s;
        let beta;
        if (L < 0.35) beta = mix(rest, -1.5 - 0.4 * s, up);
        else if (L < 0.62) beta = mix(fwd, wind, smooth(strike * 1.25 - 0.18, strike * 1.25 + 0.04, s));
        else beta = mix(fwd + (0.25 + 0.6 * s) * smooth(0, 0.4, back) * -1, rest, smooth(0.3, 1, back));
        beta += Math.sin(t * 3 + s * 5) * 0.04;
        const step = LEN / SEG;
        pts[k].set(pts[k - 1].x + Math.sin(beta) * step, pts[k - 1].y - Math.cos(beta) * step, pts[k - 1].z + Math.sin(s * 3 + t) * 0.004);
        if (pts[k].y < 0.015) pts[k].y = 0.015;
      }
      for (let k = 0; k <= SEG; k++) {
        T.subVectors(pts[Math.min(SEG, k + 1)], pts[Math.max(0, k - 1)]).normalize();
        N.crossVectors(T, ref).normalize();
        Bn.crossVectors(T, N);
        const rr = mix(0.014, 0.003, k / SEG);
        for (let j = 0; j <= RAD; j++) {
          const th = (j / RAD) * TAU;
          const nx = N.x * Math.cos(th) + Bn.x * Math.sin(th);
          const ny = N.y * Math.cos(th) + Bn.y * Math.sin(th);
          const nz = N.z * Math.cos(th) + Bn.z * Math.sin(th);
          const i = (k * Wd + j) * 3;
          pos[i] = pts[k].x + nx * rr;
          pos[i + 1] = pts[k].y + ny * rr;
          pos[i + 2] = pts[k].z + nz * rr;
          geo.attributes.normal.array[i] = nx;
          geo.attributes.normal.array[i + 1] = ny;
          geo.attributes.normal.array[i + 2] = nz;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
      geo.computeBoundingSphere();
      const crack = Math.exp(-(((L - 0.6) / 0.025) ** 2));
      tipFlash.position.copy(pts[SEG]);
      tipFlash.material.opacity = crack;
      tipFlash.visible = crack > 0.02;
    };
  }
  const animate = (t, { marching = false, lash = 0 } = {}) => {
    orcPose(b, t, { marching, lash, slaver, phase });
    if (whip) whip(t, lash);
  };
  animate(0);
  return { group: g, bones: b, head: b.head, animate, height: slaver ? 1.9 : 1.5 };
}

// One orc mid-stride with his spear upright, as one geometry for a marching
// column (vertex colours, and `metal`), for mats.orc.
export function orcColumnGeo() {
  const root = new THREE.Group();
  const b = orcRig(root);
  orcPose(b, Math.PI / 2 / 6.8, { marching: true });
  root.updateMatrixWorld(true);
  const list = orcParts(5, { low: true, weapon: 'spear' }).map(([name, geo, colour, metal]) => {
    const gg = geo.applyMatrix4(b[name].matrixWorld);
    const out = typeof colour === 'function' ? tint(gg, colour) : solid(gg, colour);
    out.setAttribute('metal', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count).fill(metal), 1));
    return out;
  });
  return oneGeo(list, ['metal']);
}

// ── an orc camp ──

const CAMP = { hide: [C(0x4a3a2c), C(0x3a3028), C(0x58483a), C(0x2e2620)], pole: C(0x2a1e14), char: C(0x0e0b0a), iron: C(0x1e1d1e), rust: C(0x4a2a1a), bone: C(0xb4a88c), sack: C(0x4e4234) };

// A hide tent: spear-shaft poles leaning in to cross at the top, hides
// stretched over them sagging between, the hem ragged, a gap for a door.
function tentParts(bk, K, seed, R, H, at, turn) {
  const r = rng(seed);
  const n = makeNoise(seed);
  const poles = 5;
  const SEG = poles * 4;
  const RINGS = 6;
  const pos = [];
  const idx = [];
  const gap = [0.1, 0.9];
  for (let j = 0; j <= RINGS; j++) {
    const f = j / RINGS;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const a = mix(gap[1], TAU + gap[0], u);
      const sag = 1 - 0.1 * f * Math.sin((a * poles) / 2) ** 2;
      let y = H * (1 - f) - (f === 1 ? (n(i * 0.9, 3) - 0.3) * 0.25 : 0);
      y -= 0.08 * Math.sin(Math.PI * f) * Math.sin((a * poles) / 2) ** 2;
      const rr = R * f * sag + (f === 1 ? (n(i * 1.3, 5) - 0.5) * 0.1 : 0);
      pos.push(Math.cos(a) * rr, Math.max(0.02, y), Math.sin(a) * rr);
    }
  }
  const Wd = SEG + 1;
  for (let j = 0; j < RINGS; j++) for (let i = 0; i < SEG; i++) {
    const a = j * Wd + i;
    idx.push(a, a + 1, a + Wd, a + 1, a + Wd + 1, a + Wd);
  }
  const geo = geoOf(pos, idx);
  const base = CAMP.hide[seed % CAMP.hide.length];
  tint(geo, (x, y, z, o) => {
    o.copy(base).multiplyScalar(0.75 + noise3(n, x * 2, y * 2, z * 2) * 0.5);
    o.lerp(CAMP.hide[(seed + 1) % 4], smooth(0.55, 0.65, noise3(n, x * 0.9 + 4, y * 0.9, z * 0.9)) * 0.8);
    o.multiplyScalar(0.7 + 0.3 * smooth(0, H * 0.6, y));
  });
  bk.at(at, turn, () => {
    bk.add(K.mats.tentHide, geo, { uv: 0.6 });
    for (let k = 0; k < poles; k++) {
      const a = mix(gap[1], TAU + gap[0], (k + 0.5) / poles);
      const foot = V3(Math.cos(a) * R * 1.02, 0, Math.sin(a) * R * 1.02);
      const tip = V3(-Math.cos(a) * 0.25, H + 0.35 + r() * 0.2, -Math.sin(a) * 0.25);
      bk.add(K.mats.camp, solid(rod(foot, tip, 0.035, 0.03, 5), CAMP.pole));
      bk.add(K.mats.camp, solid(new THREE.ConeGeometry(0.04, 0.2, 4).translate(tip.x, tip.y + 0.1, tip.z), CAMP.iron));
    }
    bk.add(K.mats.camp, solid(new THREE.TorusGeometry(0.1, 0.025, 4, 8).rotateX(Math.PI / 2).translate(0, H + 0.02, 0), C(0x3a2a1a)));
  });
}

// An orc camp about 12 m across, its fire at the middle: three hide tents
// on spear poles, a fire pit ringed with stones, racks of spears, a cage,
// the banner of the Eye, and the refuse of orcs lying about. fire is where
// the flames are (a light goes there); update(t) flickers them.
export function camp(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'orcCamp';
  const bk = parts();
  const r = rng(3301);
  const n = makeNoise(3301);
  const rockT = (geo) => tint(geo, (x, y, z, o, nx, ny) => o.copy(ASH.base).multiplyScalar(0.8 + noise3(n, x * 3, y * 3, z * 3) * 0.6).lerp(ASH.ash, smooth(0.3, 0.8, ny) * 0.5));
  tentParts(bk, K, 1, 1.8, 2.5, [-3.6, 0, -2.4], 0.6);
  tentParts(bk, K, 2, 1.5, 2.2, [2.9, 0, -3.3], 2.4);
  tentParts(bk, K, 3, 1.3, 1.9, [-4.0, 0, 2.8], -1.0);

  // the fire pit: stones about it, charred wood and bones in it
  const fire = V3(0.2, 0.25, 0.3);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + r() * 0.3;
    bk.add(mats.rock, rockT(hullRock(3400 + i, [0.22 + r() * 0.1, 0.16 + r() * 0.08, 0.2], [fire.x + Math.cos(a) * 0.85, 0.1, fire.z + Math.sin(a) * 0.85], 9)), { uv: 1.5 });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    bk.add(mats.camp, solid(rod([fire.x + Math.cos(a) * 0.55, 0.05, fire.z + Math.sin(a) * 0.55], [fire.x - Math.cos(a) * 0.15, 0.22, fire.z - Math.sin(a) * 0.15], 0.06, 0.045, 5), CAMP.char));
  }
  bk.add(mats.camp, solid(new THREE.CylinderGeometry(0.75, 0.8, 0.06, 12).translate(fire.x, 0.02, fire.z), CAMP.char));
  // a spit over it, a haunch on it
  for (const s of [-1, 1]) bk.add(mats.camp, solid(rod([fire.x - 0.2, 0, fire.z + s * 0.95], [fire.x + 0.1, 1.05, fire.z + s * 0.95], 0.03, 0.025, 4), CAMP.pole));
  bk.add(mats.camp, solid(rod([fire.x, 0.98, fire.z - 1.05], [fire.x, 0.98, fire.z + 1.05], 0.02, 0.02, 4), CAMP.iron));
  bk.add(mats.camp, tint(lump(0.16, { p: [fire.x, 0.93, fire.z], s: [1, 0.8, 1.6] }, { detail: 1, amp: 0.15, seed: 4 }), (x, y, z, o) => o.copy(C(0x4a2416)).multiplyScalar(0.6 + noise3(n, x * 9, y * 9, z * 9) * 0.6)));

  // racks of spears: two crossed poles at either end, a bar, spears against it
  const rack = (at, turn, count) =>
    bk.at(at, turn, () => {
      for (const x of [-1, 1]) for (const s of [-1, 1]) bk.add(mats.camp, solid(rod([x, 0, s * 0.35], [x, 1.25, -s * 0.15], 0.03, 0.028, 4), CAMP.pole));
      bk.add(mats.camp, solid(rod([-1.1, 1.08, 0], [1.1, 1.08, 0], 0.03, 0.03, 4), CAMP.pole));
      for (let i = 0; i < count; i++) {
        const x = -0.85 + (i / (count - 1)) * 1.7;
        const foot = V3(x + (r() - 0.5) * 0.1, 0, 0.55);
        const top = V3(x + (r() - 0.5) * 0.25, 2.1, -0.32);
        bk.add(mats.camp, solid(rod(foot, top, 0.016, 0.016, 4), CAMP.pole));
        const d = top.clone().sub(foot).normalize();
        bk.add(mats.camp, solid(spikeAt(top, d, 0.28, 0.04, 4), CAMP.iron));
        if (i % 2) bk.add(mats.camp, solid(spikeAt(top.clone().addScaledVector(d, -0.08), V3(0.6, -1, 0.2), 0.08, 0.012, 3), CAMP.iron));
      }
    });
  rack([3.9, 0, 1.0], 1.4, 6);
  rack([0.6, 0, -5.0], 0.15, 5);

  // the cage, iron bars on a frame, a skull in the corner of it
  bk.at([4.0, 0, 4.0], -0.5, () => {
    const W = 0.8;
    const Hh = 1.8;
    const bar = (a, b, rr = 0.022) => bk.add(mats.camp, tint(rod(a, b, rr, rr, 4), (x, y, z, o) => o.copy(CAMP.iron).lerp(CAMP.rust, smooth(0.5, 0.7, noise3(n, x * 6, y * 6, z * 6)) * 0.7)));
    for (const x of [-W, W]) for (const z of [-W, W]) bar([x, 0, z], [x, Hh, z], 0.04);
    for (const y of [0.05, Hh]) {
      bar([-W, y, -W], [W, y, -W], 0.035);
      bar([-W, y, W], [W, y, W], 0.035);
      bar([-W, y, -W], [-W, y, W], 0.035);
      bar([W, y, -W], [W, y, W], 0.035);
    }
    for (let i = 1; i < 7; i++) {
      const f = -W + (i / 7) * 2 * W;
      bar([f, 0, -W], [f, Hh, -W]);
      bar([f, 0, W], [f + (i === 3 ? 0.06 : 0), Hh, W]);
      bar([-W, 0, f], [-W, Hh, f]);
      bar([W, 0, f], [W, Hh, f]);
      bar([f, Hh, -W], [f, Hh, W]);
    }
    bk.add(mats.camp, solid(lump(0.1, { p: [-0.5, 0.09, -0.5], s: [1.1, 0.95, 0.9] }, { detail: 1, amp: 0.06 }), CAMP.bone));
    for (const s of [-1, 1]) bk.add(mats.camp, solid(new THREE.SphereGeometry(0.025, 5, 4).translate(-0.42, 0.11, -0.5 + s * 0.035), CAMP.char));
  });

  // the banner of the Eye on its pole
  bk.add(mats.camp, solid(rod([-0.8, 0, -4.6], [-0.8, 3.6, -4.6], 0.04, 0.03, 5), CAMP.pole));
  bk.add(mats.camp, solid(rod([-1.3, 3.3, -4.6], [-0.3, 3.3, -4.6], 0.025, 0.025, 4), CAMP.pole));
  bk.add(mats.camp, solid(spikeAt(V3(-0.8, 3.6, -4.6), UP, 0.3, 0.05, 4), CAMP.iron));
  bk.add(mats.camp, solid(lump(0.1, { p: [-0.8, 3.92, -4.6], s: [1.1, 0.95, 0.9] }, { detail: 1, amp: 0.05 }), CAMP.bone));
  {
    const cloth = new THREE.PlaneGeometry(1.0, 1.9, 4, 8);
    const p = cloth.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 2.2 + p.getX(i) * 3) * 0.05 + p.getX(i) * p.getX(i) * 0.08);
    cloth.computeVertexNormals();
    bk.add(mats.banner, cloth, { p: [-0.8, 2.33, -4.55] });
  }

  // the refuse: bones, skulls, a broken barrel, sacks, a split shield,
  // a pot, scraps
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU;
    const d = 1.5 + r() * 4;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const len = 0.25 + r() * 0.3;
    const b = r() * TAU;
    const A = V3(x, 0.03, z);
    const Bp = V3(x + Math.cos(b) * len, 0.04, z + Math.sin(b) * len);
    bk.add(mats.camp, solid(rod(A, Bp, 0.022, 0.018, 5), CAMP.bone));
    bk.add(mats.camp, solid(lump(0.035, { p: A.toArray() }, { detail: 0 }), CAMP.bone));
    bk.add(mats.camp, solid(lump(0.035, { p: Bp.toArray() }, { detail: 0 }), CAMP.bone));
  }
  for (const [x, z] of [[1.9, 1.8], [-2.2, -0.2], [2.4, -1.2]]) {
    bk.add(mats.camp, solid(lump(0.1, { p: [x, 0.08, z], s: [1.1, 0.9, 0.9], r: [0, r() * TAU, 0.3] }, { detail: 1, amp: 0.06 }), CAMP.bone));
  }
  // the barrel, staved and burst
  bk.at([-1.8, 0, 4.2], 0.4, () => {
    for (let i = 0; i < 10; i++) {
      if (i === 3 || i === 4) continue;
      const a = (i / 10) * TAU;
      bk.add(mats.camp, solid(new THREE.BoxGeometry(0.03, 0.75 - (i % 3) * 0.12, 0.15).translate(0, 0.37 - (i % 3) * 0.06, 0).rotateY(-a).translate(Math.cos(a) * 0.27, 0, Math.sin(a) * 0.27), C(0x3a2a1c)));
    }
    bk.add(mats.camp, solid(new THREE.TorusGeometry(0.29, 0.015, 3, 12).rotateX(Math.PI / 2).translate(0, 0.15, 0), CAMP.iron));
  });
  for (let i = 0; i < 4; i++) bk.add(mats.camp, tint(lump(0.25, { p: [-2.7 + i * 0.45, 0.2, 4.8 - (i % 2) * 0.3], s: [1, 0.8, 0.9] }, { detail: 1, amp: 0.12, seed: i + 7 }), (x, y, z, o) => o.copy(CAMP.sack).multiplyScalar(0.7 + noise3(n, x * 5, y * 5, z * 5) * 0.5)));
  bk.add(mats.camp, solid(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 12, 1, false, 0, Math.PI * 1.5).rotateX(-1.3).translate(1.6, 0.12, 3.2), CAMP.iron));
  bk.add(mats.camp, solid(new THREE.LatheGeometry([[0.0, 0], [0.16, 0.02], [0.2, 0.15], [0.16, 0.3], [0.12, 0.32]].map(([a, b]) => new THREE.Vector2(a, b)), 8).translate(-1.1, 0, 1.3), C(0x2a2522)));
  // a few boulders the camp is set among
  for (const [x, z, s] of [[-5.6, -0.4, 0.9], [5.4, -1.8, 0.7], [-1.0, 5.6, 0.6], [5.6, 5.4, 0.5]]) bk.add(mats.rock, rockT(hullRock(3500 + x * 10, [s * 1.2, s * 0.8, s], [x, s * 0.35, z], 12)), { uv: 0.6 });
  bk.build(g, { shadow: false, receive: false });

  // the fire itself: an ember glow on the ground, flames on sprites
  const embers = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: K.tex.glow, color: hot(0xff5a18, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.position.set(fire.x, 0.07, fire.z);
  embers.renderOrder = 2;
  g.add(embers);
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.tex.flame, color: hot(0xffb060, 2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.center.set(0.5, 0.05);
    s.position.set(fire.x + (i - 1) * 0.18, 0.12, fire.z + ((i * 7) % 3 - 1) * 0.12);
    s.renderOrder = 6;
    g.add(s);
    flames.push(s);
  }
  const halo = glowSprite(K.tex.glow, hot(0xff6a20, 1.2), 3.2, 0.5, true);
  halo.position.set(fire.x, 0.7, fire.z);
  g.add(halo);
  const update = (t) => {
    flames.forEach((s, i) => {
      const f = 0.8 + 0.12 * Math.sin(t * 13 + i * 2.1) * Math.sin(t * 7.3 + i) + 0.08 * Math.sin(t * 29 + i * 5);
      s.scale.set(0.55 * (0.9 + f * 0.2) * (i === 1 ? 1.2 : 0.85), 1.25 * f * (i === 1 ? 1.15 : 0.8), 1);
      s.material.opacity = 0.75 + f * 0.25;
    });
    halo.material.opacity = 0.42 * (0.85 + 0.15 * Math.sin(t * 11));
  };
  update(0);
  return { group: g, fire: V3(fire.x, 0.5, fire.z), update };
}
