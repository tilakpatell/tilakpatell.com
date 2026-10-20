// The people on the map, as big-headed toys: hobbits, wizards, men, elves
// and a dwarf from one builder, and Gollum and Treebeard on their own. Each
// faces +x, stands on y = 0, and is posed every frame by `pose` (walking,
// waving, talking, or just breathing and looking about).

import * as THREE from 'three';
import { hot } from '../../lib/three/stage3dNodes';
import { makeNoise } from '../../lib/paint';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const glow = (color, k) => new THREE.MeshBasicMaterial({ color: hot(color, k) });
function put(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const SKIN = 0xf1c9a0;
// where a hand closes on each toy's item, in the item's own space (as the
// builder below puts its parts): on the shaft, the haft, the hilt under the
// guard, the bow's middle, the horn's
const GRIPS = { staff: [0.04, 0, 0], 'white-staff': [0.04, 0, 0], bow: [-0.37, 0.1, 0], axe: [0.05, 0, 0], sword: [0.05, -0.05, 0], horn: [0.08, 0.02, 0] };

// One toy person. `tall` stretches the legs and body (1 is a hobbit), the
// head stays big. A `robe` hides the legs; `hat`, `beard`, `item` and the
// rest dress them.
export function makeToyFigure({
  tall = 1,
  wide = 1,
  skin = SKIN,
  hair = 0x3a2214,
  hairStyle = 'curly',
  beard = null,
  coat = 0x8a3a2a,
  shirt = 0xf2ead8,
  cloak = null,
  robe = null,
  hat = null,
  item = null,
  pack = false,
  ring = false,
  feet = 'hairy',
  aura = null,
  seed = 1,
} = {}) {
  const g = new THREE.Group();
  const skinM = mat(skin);
  const hairM = mat(hair, { roughness: 0.9 });
  const legLen = 0.34 * tall;
  const hipY = legLen + 0.08;
  const bodyH = 0.5 * tall;
  const legs = [];
  const arms = [];
  const body = new THREE.Group();
  body.position.y = hipY;
  g.add(body);

  // legs and feet (under a robe, only the feet show)
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0, hipY, s * 0.12 * wide);
    if (!robe) put(hip, new THREE.CylinderGeometry(0.075 * wide, 0.07 * wide, legLen, 8), mat(feet === 'hairy' ? 0x6b4a2b : 0x4a3a2e), 0, -legLen / 2, 0);
    const foot = put(hip, new THREE.SphereGeometry(0.12, 10, 8), feet === 'hairy' ? mat(0xd6a878) : mat(0x3a2a20), 0.06, -legLen - 0.02, 0);
    foot.scale.set(1.5, 0.55, 1);
    if (feet === 'hairy') put(hip, new THREE.SphereGeometry(0.05, 6, 5), hairM, 0, -legLen + 0.04, 0);
    g.add(hip);
    legs.push(hip);
  }

  // body
  if (robe) {
    put(body, new THREE.CylinderGeometry(0.17 * wide, 0.36 * wide, bodyH + hipY, 14), mat(robe), 0, (bodyH - hipY) / 2, 0);
  } else {
    put(body, new THREE.CylinderGeometry(0.18 * wide, 0.24 * wide, bodyH, 12), mat(shirt), 0, bodyH * 0.44, 0);
    put(body, new THREE.CylinderGeometry(0.19 * wide, 0.245 * wide, bodyH * 0.68, 12, 1, true), mat(coat, { side: THREE.DoubleSide }), 0, bodyH * 0.34, 0);
  }
  if (cloak) {
    const cape = put(body, new THREE.ConeGeometry(0.34 * wide, bodyH + hipY * 0.8, 14, 1, true, Math.PI * 0.55, Math.PI * 0.9), mat(cloak, { side: THREE.DoubleSide }), 0, (bodyH - hipY * 0.8) / 2 + 0.05, 0);
    cape.rotation.y = Math.PI;
    put(body, new THREE.SphereGeometry(0.035, 6, 5), glow(0x7fcf6a, 1.4), 0.17 * wide, bodyH * 0.88, 0); // the leaf brooch
  }
  if (ring) put(body, new THREE.TorusGeometry(0.045, 0.012, 6, 16), glow(0xffd76a, 2.2), 0.2 * wide, bodyH * 0.6, 0).rotation.y = Math.PI / 2;
  if (pack) {
    put(body, new THREE.BoxGeometry(0.26, 0.38, 0.36), mat(0x7a5a3a), -0.24, bodyH * 0.64, 0);
    put(body, new THREE.CylinderGeometry(0.12, 0.12, 0.03, 12), mat(0x3a3a3c, { metalness: 0.6, roughness: 0.4 }), -0.38, bodyH * 0.72, 0).rotation.z = Math.PI / 2;
    put(body, new THREE.CylinderGeometry(0.11, 0.11, 0.34, 10), mat(0x9a7a4a), -0.24, bodyH * 1.12, 0).rotation.x = Math.PI / 2;
  }

  // arms, from the shoulders; the right one (+z) holds the item
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(0, bodyH * 0.84, s * 0.22 * wide);
    const armLen = 0.3 * (0.8 + 0.2 * tall);
    put(sh, new THREE.CylinderGeometry(0.05, 0.045, armLen, 8), mat(robe || shirt), 0, -armLen / 2, 0);
    put(sh, new THREE.SphereGeometry(0.055, 8, 6), skinM, 0, -armLen - 0.02, 0);
    if (s === 1 && item) {
      // (what it is in a hand, and where the hand closes on it: for the cast,
      // lib/three/held.js; the bow's grip is its middle, the rest's their shaft)
      const hand = new THREE.Group();
      hand.position.set(0, -armLen - 0.02, 0);
      hand.userData.held = { kind: item };
      const grip = new THREE.Object3D();
      grip.name = 'grip';
      grip.position.set(...(GRIPS[item] ?? [0, 0, 0]));
      hand.add(grip);
      sh.add(hand);
      if (item === 'staff' || item === 'white-staff') {
        put(hand, new THREE.CylinderGeometry(0.025, 0.03, 1.5 * tall, 6), mat(item === 'staff' ? 0x5a3e24 : 0xe8e4da), 0.04, 0.3 * tall, 0);
        put(hand, new THREE.SphereGeometry(0.07, 8, 6), glow(item === 'staff' ? 0xcfe0ff : 0xffffff, 1.6), 0.04, 1.06 * tall, 0);
      } else if (item === 'bow') {
        const bow = put(hand, new THREE.TorusGeometry(0.42, 0.018, 5, 20, Math.PI), mat(0xb8915a), 0.05, 0.1, 0);
        bow.rotation.z = Math.PI / 2;
      } else if (item === 'axe') {
        put(hand, new THREE.CylinderGeometry(0.022, 0.022, 0.7, 6), mat(0x6b4a2b), 0.05, 0.15, 0);
        put(hand, new THREE.BoxGeometry(0.2, 0.18, 0.04), mat(0xb8bcc4, { metalness: 0.8, roughness: 0.3 }), 0.14, 0.42, 0);
      } else if (item === 'sword') {
        put(hand, new THREE.BoxGeometry(0.04, 0.8, 0.07), mat(0xd8dde6, { metalness: 0.9, roughness: 0.25 }), 0.05, 0.38, 0);
        put(hand, new THREE.BoxGeometry(0.05, 0.05, 0.22), mat(0xb8913a, { metalness: 0.6 }), 0.05, 0.0, 0);
      } else if (item === 'horn') {
        put(hand, new THREE.ConeGeometry(0.06, 0.32, 8), mat(0xe8d8b0), 0.08, 0.02, 0).rotation.z = -1.2;
      }
    }
    body.add(sh);
    arms.push(sh);
  }

  // the head: big, with hair, ears, eyes, and whatever is on it
  const head = new THREE.Group();
  head.position.y = bodyH + 0.3;
  body.add(head);
  put(head, new THREE.SphereGeometry(0.29, 18, 14), skinM);
  for (const s of [-1, 1]) {
    put(head, new THREE.SphereGeometry(0.035, 8, 6), mat(0x1b1410, { roughness: 0.3 }), 0.255, 0.03, s * 0.1);
    const ear = put(head, new THREE.ConeGeometry(0.06, hairStyle === 'long' ? 0.24 : 0.16, 6), skinM, -0.02, 0.06, s * 0.29);
    ear.rotation.x = s * 1.3;
  }
  const n = makeNoise(seed);
  if (hairStyle === 'curly') {
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const up = 0.15 + n(i, 1) * 0.8;
      const x = Math.cos(a) * Math.sqrt(1 - up * up) * 0.27 - 0.04;
      const z = Math.sin(a) * Math.sqrt(1 - up * up) * 0.29;
      if (x > 0.12 && up < 0.55) continue; // the face
      put(head, new THREE.SphereGeometry(0.085 + n(i, 3) * 0.04, 7, 6), hairM, x, up * 0.29 + 0.03, z);
    }
  } else if (hairStyle === 'long') {
    const cap = put(head, new THREE.SphereGeometry(0.305, 18, 12, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.62), hairM);
    cap.rotation.y = 0;
    put(head, new THREE.BoxGeometry(0.16, 0.5, 0.5), hairM, -0.2, -0.2, 0);
  }
  if (beard) {
    const b = put(head, new THREE.ConeGeometry(0.2, beard.len, 10), mat(beard.color, { roughness: 0.95 }), 0.17, -0.18 - beard.len / 2, 0);
    b.rotation.z = Math.PI;
    b.rotation.x = 0;
  }
  if (hat === 'wizard') {
    put(head, new THREE.CylinderGeometry(0.46, 0.46, 0.03, 20), mat(robe || 0x6a6a72), 0, 0.2, 0);
    const cone = put(head, new THREE.ConeGeometry(0.24, 0.72, 16), mat(robe || 0x6a6a72), -0.05, 0.56, 0);
    cone.rotation.z = 0.22;
  } else if (hat === 'crown') {
    put(head, new THREE.TorusGeometry(0.27, 0.025, 6, 24), glow(0xf6e6b0, 1.3), 0, 0.14, 0).rotation.x = Math.PI / 2;
  } else if (hat === 'helm') {
    put(head, new THREE.SphereGeometry(0.31, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8a8f98, { metalness: 0.8, roughness: 0.35 }), 0, 0.02, 0);
  } else if (hat === 'hood') {
    put(head, new THREE.SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(cloak || 0x4a5a3a), -0.04, 0.02, 0).rotation.z = 0.45;
  }
  let halo = null;
  if (aura) {
    halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.55 * tall, 20, 14),
      new THREE.MeshBasicMaterial({ color: hot(aura, 0.6), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    halo.position.y = hipY + bodyH * 0.6;
    g.add(halo);
  }
  return { group: g, body, head, legs, arms, robe: !!robe, halo, baseY: hipY };
}

// Gollum: crouched, thin, pale, all eyes.
export function makeGollum() {
  const g = new THREE.Group();
  const pale = mat(0xc9c2a8, { roughness: 0.55 });
  const body = new THREE.Group();
  body.position.y = 0.32;
  g.add(body);
  const torso = put(body, new THREE.SphereGeometry(0.2, 12, 10), pale, 0, 0.05, 0);
  torso.scale.set(1.2, 0.8, 0.9);
  const legs = [];
  const arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.28, s * 0.12);
    const leg = put(hip, new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6), pale, 0.08, -0.12, 0);
    leg.rotation.z = -0.8;
    put(hip, new THREE.SphereGeometry(0.06, 8, 6), pale, 0.1, -0.26, 0).scale.set(1.8, 0.5, 1);
    g.add(hip);
    legs.push(hip);
    const sh = new THREE.Group();
    sh.position.set(0.1, 0.08, s * 0.16);
    put(sh, new THREE.CylinderGeometry(0.025, 0.025, 0.36, 6), pale, 0, -0.18, 0);
    body.add(sh);
    arms.push(sh);
  }
  const head = new THREE.Group();
  head.position.set(0.18, 0.28, 0);
  body.add(head);
  put(head, new THREE.SphereGeometry(0.24, 16, 12), pale).scale.set(1, 0.9, 1.05);
  for (const s of [-1, 1]) {
    put(head, new THREE.SphereGeometry(0.09, 12, 10), mat(0xf4f0e0, { roughness: 0.2 }), 0.17, 0.05, s * 0.1);
    put(head, new THREE.SphereGeometry(0.05, 10, 8), mat(0x3a6aa8, { roughness: 0.15 }), 0.24, 0.05, s * 0.11);
    put(head, new THREE.ConeGeometry(0.06, 0.26, 6), pale, -0.02, 0.06, s * 0.26).rotation.x = s * 1.4;
  }
  for (let i = 0; i < 5; i++) put(head, new THREE.CylinderGeometry(0.004, 0.004, 0.16, 3), mat(0x4a4030), -0.05 + i * 0.03, 0.27, (i - 2) * 0.04);
  return { group: g, body, head, legs, arms, robe: false, halo: null, baseY: 0.32, crouch: true };
}

// Treebeard: an Ent, tall and slow, bark and leaves and a mossy beard.
export function makeTreebeard() {
  const g = new THREE.Group();
  const bark = mat(0x6a4e34, { roughness: 1, flatShading: true });
  const leaf = mat(0x4f7d36, { roughness: 0.9, flatShading: true });
  const body = new THREE.Group();
  body.position.y = 0;
  g.add(body);
  put(body, new THREE.CylinderGeometry(0.32, 0.46, 2.4, 9), bark, 0, 1.2, 0);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.3, s * 0.24);
    put(hip, new THREE.CylinderGeometry(0.14, 0.2, 0.6, 7), bark, 0, -0.1, 0);
    g.add(hip);
    legs.push(hip);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(0, 2.0, s * 0.36);
    const a = put(sh, new THREE.CylinderGeometry(0.07, 0.11, 1.1, 6), bark, 0, -0.5, s * 0.15);
    a.rotation.x = -s * 0.25;
    put(sh, new THREE.IcosahedronGeometry(0.2, 0), leaf, 0, -1.02, s * 0.3);
    body.add(sh);
    arms.push(sh);
  }
  const head = new THREE.Group();
  head.position.y = 2.55;
  body.add(head);
  put(head, new THREE.IcosahedronGeometry(0.62, 1), leaf, -0.1, 0.35, 0);
  put(head, new THREE.SphereGeometry(0.3, 12, 10), bark, 0.12, 0, 0);
  for (const s of [-1, 1]) put(head, new THREE.SphereGeometry(0.05, 8, 6), glow(0xffc96a, 1.6), 0.38, 0.06, s * 0.12);
  for (let i = 0; i < 5; i++) {
    const c = put(head, new THREE.ConeGeometry(0.06, 0.55, 5), mat(0x5c7a3a), 0.32, -0.36, (i - 2) * 0.07);
    c.rotation.z = Math.PI;
  }
  return { group: g, body, head, legs, arms, robe: false, halo: null, baseY: 0, slow: true };
}

// Poses one figure for this frame. `wave` (0..1) raises the right arm and
// waves it; `talk` bobs the head; moving swings the legs and arms. A figure
// on the cast (cast3d.js) only notes the wave and the talk: its feet go by
// the ground it really covers, and its body is drawn once a frame by
// tickCast; the toy is posed until its cast model's here.
export function pose(f, t, { moving = false, wave = 0, talk = 0, speed = 1 } = {}) {
  if (f.cast) {
    f.cast.pose({ wave, talk });
    if (f.cast.ready) return;
  }
  const k = f.slow ? 0.4 : 1;
  const sw = moving ? Math.sin(t * 13 * speed * k) : 0;
  if (!f.robe) {
    f.legs[0].rotation.z = sw * 0.75;
    f.legs[1].rotation.z = -sw * 0.75;
  }
  f.arms[0].rotation.z = -sw * 0.6;
  f.arms[1].rotation.z = sw * 0.6;
  if (wave > 0) {
    f.arms[1].rotation.x = -2.6 * wave;
    f.arms[1].rotation.z = Math.sin(t * 12) * 0.35 * wave;
  } else f.arms[1].rotation.x = 0;
  const bob = moving ? Math.abs(Math.cos(t * 13 * speed * k)) * 0.07 : Math.sin(t * 2 * k) * 0.012;
  f.body.position.y = f.baseY + bob + (f.crouch ? Math.sin(t * 3) * 0.02 : 0);
  if (f.crouch) f.body.rotation.z = -0.35 + Math.sin(t * 2.2) * 0.08;
  f.head.rotation.y = moving ? 0 : Math.sin(t * 0.7 * k) * 0.35;
  f.head.rotation.z = talk ? Math.sin(t * 9) * 0.08 * talk : 0;
  if (f.halo) f.halo.material.opacity = 0.08 + 0.04 * Math.sin(t * 1.5);
}
