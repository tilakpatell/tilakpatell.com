// Bree, made in code: the kit the walkable town is built from. Tall houses
// for Big Folk, of stone below and oak and plaster above, each floor
// jettied out over the one under it, under steep roofs of slate or thatch;
// the Prancing Pony and its sign; the stockade of sharpened logs and its two
// gates, with the gatekeeper's hatch and his lodge; the stable, the well, the
// market stalls; the Nazgûl on foot, and Bill the pony.
//
// Built with the Shire's kit (../../shire/props.js): its materials, made a
// little darker and wetter for a rainy night, and its helpers. The same
// conventions: each builder's group stands on y = 0 at its origin, doors
// face +z, creatures face +x, and fixed parts are merged one mesh per
// material.
//
// The buildings themselves are in ./build.js (free of GLSL, for the Road);
// this file makes the kit they are given, and keeps the figures and Bill.

import * as THREE from 'three';
import { hot } from '../../../../lib/three/stage3dNodes';
import { mix } from '../../../../lib/paint';
import { STANCE, TROT, WALK, createStride, createTracker, ease, gaitOffsets, legSwing } from '../../creatures';
import { makeToyFigure } from '../../mapFigures';
import { LOOKS, compact } from '../../shire/people';
import { castFigure } from '../../cast3d';
import { ball, blob, createShireKit, cyl, cylZ, fillColor, lathe, parts, tf, tube } from '../../shire/props';
import { barrels, crates, gate, house, lodge, pony, stable, stall, stockade, well } from './build';

// ── who's about ──

// (The Nazgûl on foot are ../wraiths.js.)

// Bill the pony, facing +x: small, brown, a little thin, with his packs.
function billPony(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'bill';
  const coat = new THREE.Color(0x7a4e2c);
  const dark = new THREE.Color(0x3a2616);
  const bk = parts();
  const body = lathe([[0.001, -0.62], [0.16, -0.6], [0.26, -0.48], [0.31, -0.2], [0.31, 0.15], [0.29, 0.42], [0.18, 0.58], [0.001, 0.62]], 12);
  tf(body, { r: [0, 0, -Math.PI / 2], s: [1, 1, 0.82], p: [0, 0.9, 0] });
  fillColor(body, coat);
  bk.add(mats.beast, body);
  // the packs, either side, and a rolled blanket and a pan on top
  for (const s of [-1, 1]) bk.add(mats.sack, blob(0.2, { detail: 1, amp: 0.15, seed: 5 + s }), { p: [-0.05, 0.85, s * 0.3], s: [1.4, 1.1, 0.7], uv: 1.5 });
  bk.add(mats.cloth, cylZ(0.1, 0.6, 8), { p: [-0.15, 1.24, 0], color: 0x8a3a2a });
  bk.add(mats.iron, cyl(0.12, 0.1, 0.06, 10), { p: [0.15, 1.22, 0] });
  bk.build(g);
  const legs = [];
  for (const [x, z] of [[0.4, 0.13], [0.4, -0.13], [-0.42, 0.13], [-0.42, -0.13]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.82, z);
    g.add(hip);
    const lk = parts();
    lk.add(mats.beast, tube([[0, 0.05, 0], [x < 0 ? -0.05 : 0.02, -0.38, 0], [0.01, -0.74, 0]], 0.08, 0.04, { seg: 5, radial: 6 }), { color: coat });
    lk.add(mats.beast, cyl(0.05, 0.06, 0.08, 7), { p: [0.01, -0.78, 0], color: dark });
    lk.build(hip);
    legs.push(hip);
  }
  const neck = new THREE.Group();
  neck.position.set(0.5, 1.05, 0);
  g.add(neck);
  const nk = parts();
  nk.add(mats.beast, tube([[-0.05, -0.05, 0], [0.12, 0.25, 0], [0.22, 0.45, 0]], 0.17, 0.1, { seg: 5, radial: 7 }), { s: [1, 1, 0.75], color: coat });
  for (let i = 0; i < 6; i++) nk.add(mats.beast, new THREE.ConeGeometry(0.05, 0.22, 4), { p: [-0.06 + i * 0.05, 0.1 + i * 0.07, 0], r: [0, 0, 2.4], s: [1, 1, 0.4], color: dark });
  nk.build(neck);
  const head = new THREE.Group();
  head.position.set(0.24, 0.48, 0);
  neck.add(head);
  const hk = parts();
  hk.add(mats.beast, lathe([[0.001, 0], [0.09, 0.03], [0.1, 0.14], [0.08, 0.3], [0.06, 0.36], [0.001, 0.38]], 9), { s: [1, 1, 0.75], r: [0, 0, -2.3], color: coat });
  for (const s of [-1, 1]) {
    hk.add(mats.beast, new THREE.ConeGeometry(0.035, 0.12, 5), { p: [-0.03, 0.1, s * 0.05], r: [s * 0.3, 0, 0.3], color: coat });
    hk.add(mats.beast, ball(0.018, 6, 5), { p: [0.1, 0.02, s * 0.06], color: 0x111111 });
  }
  hk.build(head);
  const tail = new THREE.Group();
  tail.position.set(-0.62, 1.0, 0);
  g.add(tail);
  const tk = parts();
  tk.add(mats.beast, tube([[0, 0, 0], [-0.16, -0.12, 0], [-0.2, -0.5, 0]], 0.06, 0.02, { seg: 5, radial: 5 }), { color: dark });
  tk.build(tail);

  // How he moves (../../creatures.js): his legs from the ground he covers,
  // read from where the scene puts him, a pony's walk and a trot if he's
  // hurried; standing, his head drops to pick at the straw now and then, and
  // his tail swishes. `graze` (0…1) to say how much he's eating.
  const track = createTracker();
  const stride = createStride({ stride: 1.0, hz: 1.0, longest: 1.5, cadence: [1.2, 1.8], seed: 23 });
  const LEG = 0.8;
  const A = { graze: 0 };
  const animate = (t, { graze } = {}) => {
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const st = stride.step(m.dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const offs = gaitOffsets(st.run, WALK, TROT);
    const stance = mix(STANCE.walk, STANCE.trot, st.run);
    legs.forEach((hip, j) => {
      const { angle, lift } = legSwing(st.cycle + offs[j], stance, stance * st.stride, LEG);
      hip.rotation.z = angle * st.amount;
      hip.scale.y = 1 - 0.14 * lift * st.amount;
    });
    const eat = graze ?? (st.amount < 0.05 ? Math.max(0, Math.sin(t * 0.21 + 1)) : 0);
    A.graze = ease(A.graze, eat, m.dt, 1.5);
    const nod = Math.sin(st.phase * 2) * 0.05 * st.amount;
    neck.rotation.z = mix(-0.25 + Math.sin(t * 0.8) * 0.06 * (1 - st.amount) + nod, -0.85 + Math.sin(t * 2.2) * 0.05, A.graze);
    tail.rotation.y = Math.sin(t * 1.3) * 0.3 * (1 - st.amount * 0.6);
  };
  return { group: g, legs, neck, head, tail, animate };
}

// The people of Bree and the hobbits on the road, as toy figures; a
// carrot for the man with the carrot.
const BREE_LOOKS = {
  frodo: { ...LOOKS.frodo, pack: true },
  sam: { ...LOOKS.sam, pack: true },
  merry: LOOKS.merry,
  pippin: LOOKS.pippin,
  harry: { tall: 1.45, wide: 1.12, hair: 0x5a4a3a, beard: { color: 0x6a5a4a, len: 0.18 }, coat: 0x4a4636, shirt: 0xb8a888, cloak: 0x3a3a30, hat: 'hood', feet: 'boots', seed: 61 },
  butterbur: { tall: 1.38, wide: 1.5, hairStyle: 'bald', hair: 0x8a7a6a, coat: 0x8a5a3a, shirt: 0xf2e8d2, feet: 'boots', seed: 63 },
  strider: { tall: 1.58, wide: 1.05, hair: 0x2a1e14, hairStyle: 'long', beard: { color: 0x2a1e14, len: 0.12 }, coat: 0x3a3428, shirt: 0x5a5040, cloak: 0x2e3826, hat: 'hood', item: 'sword', feet: 'boots', seed: 65 },
  carrot: { tall: 1.42, wide: 1.1, hair: 0x6a4a2a, beard: { color: 0x5a3a20, len: 0.16 }, coat: 0x6a5a3a, shirt: 0xc8b890, feet: 'boots', seed: 67 },
  breelander: { tall: 1.4, robe: 0x7a4a4a, hairStyle: 'long', hair: 0x4a3020, shirt: 0xe8dcc0, seed: 69 },
  ferny: { tall: 1.43, wide: 0.95, skin: 0xd8b08a, hair: 0x2a2a20, hairStyle: 'long', beard: { color: 0x2a2a20, len: 0.1 }, coat: 0x3a3a2a, shirt: 0x7a7a5a, feet: 'boots', seed: 71 },
};
const FOLK = [0x5a4a6a, 0x6a3a2a, 0x3a5a4a, 0x7a6a3a, 0x4a4a5a, 0x8a5a3a];
const FOLK_HAIR = [0x3a2a1a, 0x6a4a2a, 0x8a7a6a, 0x2a1e14, 0xa08a6a];
// one of the Bree-landers: Big Folk, so long hair or none, and beards
const folkLook = (n) => ({
  tall: 1.35 + (n % 3) * 0.07,
  wide: 1 + (n % 2) * 0.25,
  hair: FOLK_HAIR[n % FOLK_HAIR.length],
  hairStyle: n % 4 === 1 ? 'bald' : 'long',
  coat: FOLK[n % FOLK.length],
  shirt: [0xd8ccb0, 0xb8a888, 0xe8dcc0][n % 3],
  beard: n % 3 !== 2 ? { color: FOLK_HAIR[(n + 1) % FOLK_HAIR.length], len: 0.14 + (n % 2) * 0.1 } : null,
  hat: n % 5 === 3 ? 'hood' : null,
  cloak: n % 5 === 3 ? FOLK[(n + 3) % FOLK.length] : null,
  feet: 'boots',
  seed: 80 + n,
  ...(n % 3 === 2 ? { robe: FOLK[(n + 2) % FOLK.length], beard: null } : {}),
});
export function makeFolk(id, { n = 0, look: over = null } = {}) {
  const look = over ?? BREE_LOOKS[id] ?? folkLook(n);
  const f = makeToyFigure(look);
  // a Ranger's or a Bree-lander's cloak has no elven brooch
  if (look.cloak) {
    const brooch = [];
    f.group.traverse((o) => {
      if (o.isMesh && o.material.isMeshBasicMaterial && o.geometry.parameters?.radius === 0.035) brooch.push(o);
    });
    for (const o of brooch) o.removeFromParent();
  }
  compact(f.group);
  f.group.name = id;
  f.top = f.baseY + 0.5 * (look.tall ?? 1) + 0.62;
  if (id === 'carrot') {
    const hand = f.arms[1];
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xe0782a, roughness: 0.6 }));
    c.position.set(0.06, -0.4, 0);
    c.rotation.z = Math.PI;
    // (held by its green end, the point out past the fingers: lib/three/held.js)
    c.userData.held = { kind: 'carrot' };
    const grip = new THREE.Object3D();
    grip.name = 'grip';
    grip.position.y = -0.07;
    c.add(grip);
    hand.add(c);
    f.carrot = c;
  }
  if (look.ring) {
    f.group.traverse((o) => {
      if (o.isMesh && o.geometry.type === 'TorusGeometry') f.ringMesh = o;
    });
  }
  // on the cast once its model's here (../../cast3d.js): whoever plays them,
  // a Bree-lander for the folk; the carrot to the cast's hand
  castFigure(f, id, look, { role: id === 'folk' ? 'folk' : 'cast', town: 'bree' });
  if (f.carrot) f.cast?.hold(f.carrot);
  return f;
}

// ── the kit ──

export function createBreeKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  // Bree on a wet night: darker oak, greyer plaster, wet slate, rain-dark thatch
  mats.timber.color.set(0x3a2818);
  mats.plaster.color.set(0xd2c4a6);
  mats.slate.color.set(0x8a92a0);
  mats.slate.roughness = 0.5;
  mats.thatch.color.set(0x8c7c5c);
  mats.stone.color.set(0xb8b0a4);
  mats.ashlar.color.set(0xc8beae);
  mats.trunk.color.set(0x8a7a66);
  mats.barnwood.color.set(0x6a5644);
  mats.window.emissive = hot(0xffa448, 2.8);
  return {
    ...kit,
    house: (o) => house(K, o),
    pony: () => pony(K),
    stockade: (segs, height, o) => stockade(K, segs, height, o),
    gate: (o) => gate(K, o),
    lodge: () => lodge(K),
    stable: () => stable(K),
    well: () => well(K),
    stall: (o) => stall(K, o),
    crates: () => crates(K),
    barrels: () => barrels(K),
    billPony: () => billPony(K),
  };
}
