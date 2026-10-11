// Hoth's props, built in code (props/index.js has what a builder returns):
// Echo Base's hangar cut into the glacier (X-wings and snowspeeders in it,
// a GR-75 transport loading outside, the tauntaun pen), the shield
// generator and the ion cannon (it fires), the trench line with its DF.9
// guns and E-Webs, the snowspeeders flying round and the walkers coming in
// off the horizon, the probe droid and what's left of the one that blew
// itself up, the wampa's cave with Luke's saber in the snow, the shelter
// Han built; the Rebel troopers in their snow gear, Vader. A kind with a
// model (catalog/ice.js) is drawn as the model instead.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { box, cyl, dome, mirror, part, place, ring, rod, rockGeometry } from '../kitCore';
import { bake, canvasTexture, loft, plateXZ, trap8, upright } from '../../../universe/trafficKit';
import { noise2 } from '../noise';
import { PROPS as GENERIC } from './generic';

const { PI, cos, sin } = Math;

// ── Colours ──
const ICE = '#d6e2ee';
const SNOW = '#f2f6fa';
const REBEL = '#d9d8d2';

// a colour hot enough to glow (and bloom)
const hot = (c, k = 2) => new THREE.Color(c).multiplyScalar(k);

// ── Helpers ──

// a material of the props' own, made once per kit: ice (a little glossy),
// snow (soft and matte)
const mat = (k, key, make) => (k[key] ??= k.own(make()));
export const iceMat = (k) => mat(k, '_ice', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.06 }));
const snowMat = (k) => mat(k, '_snow', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }));

// parts baked into one mesh with a material of the props' own; `shade`
// (x, y, z) → [r, g, b] multipliers tints it vertex by vertex (blue in the
// ice's depths, darker inside a cave)
export function meshOf(k, parts, material, { shadows = true, density = 0.18, shade = null } = {}) {
  const geo = bake(parts, density);
  if (shade) {
    const p = geo.attributes.position;
    const c = geo.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const [r, g, b] = shade(p.getX(i), p.getY(i), p.getZ(i));
      c.setXYZ(i, c.getX(i) * r, c.getY(i) * g, c.getZ(i) * b);
    }
  }
  const m = new THREE.Mesh(k.own(geo), material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

// a geometry made rough, as ice and rock are: each vertex pushed about by
// noise of where it is (so pieces that meet stay met), pinned at the base
export function roughen(g, { amp = 1.5, scale = 9, seed = 1, base = true, fine = 0.35 } = {}) {
  const p = g.attributes.position;
  const n = (a, b, s) => noise2(a / scale, b / scale, s) + noise2(a / (scale * 0.3), b / (scale * 0.3), s + 3) * fine;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = base ? Math.min(1, Math.max(0, y) / 4) : 1;
    p.setXYZ(i, x + n(y + z * 0.6, z - x * 0.4, seed) * amp * (0.5 + 0.5 * k), y + n(x + z * 0.5, x - y * 0.3, seed + 5) * amp * 0.5 * k, z + n(x - y * 0.5, y + x * 0.4, seed + 9) * amp * (0.5 + 0.5 * k));
  }
  g.computeVertexNormals();
  return g;
}
// a rough block, w × h × d, standing at `at` (its base's middle)
function roughBox(w, h, d, at, o = {}) {
  const seg = o.seg ?? 3;
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / seg)), Math.max(1, Math.round(h / seg)), Math.max(1, Math.round(d / seg)));
  g.translate(at[0], at[1] + h / 2, at[2]);
  return roughen(g, o);
}
// ice's own variation: bluer in streaks and lower down, whiter on top;
// `inside` (x, y, z) → true where it's a cave's or a hangar's inside
export const iceShade = (inside = null) => (x, y, z) => {
  const n = noise2(x / 9 + y / 14, z / 9 - y / 11, 5) * 0.5 + noise2(x / 3, z / 3 + y / 4, 6) * 0.2;
  const deep = Math.max(0, Math.min(1, 0.5 - n)) * 0.22 + (inside?.(x, y, z) ? 0.3 : 0);
  return [1 - deep * 1.4, 1 - deep * 0.8, 1 - deep * 0.25];
};

// a lumpy boulder of ice or rock, sx × sy × sz (faceted), or a heap of
// snow (`smooth`)
function blob(seed, at, s, o = {}) {
  const g = rockGeometry(seed, { sharp: o.sharp ?? 0.3, detail: o.detail ?? 2, flat: o.flat ?? 0.55 });
  return part(o.smooth ? smoothed(g) : g, { at, scale: s, rot: [0, o.yaw ?? 0, 0], color: o.color ?? SNOW, to: o.to ?? (o.smooth ? 'adobe' : 'rock') }); // (snow heaps take the plaster's soft trowelled grain, ice and rock the rock's)
}
// a faceted geometry's corners welded, so it shades smooth (snow, not ice)
function smoothed(g) {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const out = mergeVertices(g);
  g.dispose();
  out.computeVertexNormals();
  return out;
}

// a lofted mound along x (a berm, a drift): sections across it, wobbling
function berm(len, wb, wt, h, { z = 0, seed = 1, wob = 0.15, n = 8 } = {}) {
  const secs = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const end = Math.min(1, Math.min(f, 1 - f) * n * 0.6 + 0.35);
    const k = (1 + noise2(f * 4, seed, seed) * wob) * end;
    secs.push({ z: -len / 2 + f * len, pts: trap8(wb * (0.8 + 0.2 * end), wt * (0.6 + 0.4 * end), h * k, Math.min(h * k * 0.35, wt * 0.3), (h * k) / 2) });
  }
  return loft(secs).rotateY(PI / 2).translate(0, 0, z);
}

// (a lens on the probe droid's face, `a` round, `e` up)
function lens(list, a, e, glow) {
  const r = 0.44;
  const at = [sin(a) * cos(e) * r, sin(e) * r, cos(a) * cos(e) * r];
  list.push(part(new THREE.SphereGeometry(glow ? 0.055 : 0.07, 10, 8), { at, color: glow ? hot('#ff2a1a', 3) : '#0a0a0c', to: glow ? 'glow' : 'dark' }));
}

// a person of the galaxy's own (Vader, a Rebel trooper): built from parts,
// their legs and arms swinging as they walk (update's `move`, 0…1)
function humanoid(k, look) {
  const s = look.tall / 1.8;
  const object = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(s);
  object.add(inner);
  const body = look.body;
  const to = look.to ?? 'cloth';
  const parts = [
    part(box(0.42, 0.56, 0.24), { at: [0, 0.92, 0], color: body, to }),
    part(box(0.48, 0.18, 0.28), { at: [0, 1.36, 0], color: body, to }),
    part(box(0.44, 0.08, 0.27), { at: [0, 0.9, 0], color: look.belt ?? '#1a1a1c', to: 'metal' }),
    part(cyl(0.06, 0.06, 0.08, 10), { at: [0, 1.52, 0], color: look.neck ?? body, to }),
    ...look.head,
    ...(look.extra ?? []),
  ];
  if (look.robe) parts.push(part(new THREE.CylinderGeometry(0.24, look.robe[1] ?? 0.42, 0.9, 14, 1, true), { at: [0, 0.48, 0], color: look.robe[0], to: 'cloth' }));
  if (look.cape) parts.push(part(new THREE.CylinderGeometry(0.28, look.cape[1] ?? 0.55, 1.42, 14, 1, true, PI / 2, PI), { at: [0, 0.8, -0.04], color: look.cape[0], to: 'cloth' }));
  inner.add(k.build(parts, { name: look.name }));
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.92, 0);
    hip.add(k.build([part(box(0.15, 0.86, 0.18).translate(0, -0.86, 0), { color: look.legs ?? body, to }), part(box(0.17, 0.12, 0.27), { at: [0, -0.92, 0.03], color: look.boots ?? '#141416', to: 'metal' })], { name: 'leg' }));
    inner.add(hip);
    legs.push(hip);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.29, 1.42, 0);
    const list = [part(box(0.12, 0.6, 0.14).translate(0, -0.6, 0), { color: look.arms ?? body, to }), part(box(0.1, 0.12, 0.12), { at: [0, -0.72, 0.01], color: look.hands ?? '#141416', to: 'metal' })];
    if (side === 1 && look.held) list.push(...look.held);
    sh.add(k.build(list, { name: 'arm' }));
    inner.add(sh);
    arms.push({ sh, side });
  }
  let phase = k.rand() * 10;
  return {
    object,
    solids: [{ circle: [0, 0, 0.4] }],
    update(t, dt, move = 0) {
      phase += (dt ?? 0) * (2 + move * 6);
      const sw = sin(phase) * (0.06 + move * 0.5) * Math.min(1, move * 5 + 0.05);
      legs[0].rotation.x = sw;
      legs[1].rotation.x = -sw;
      for (const a of arms) a.sh.rotation.x = (a.side === 1 && look.held ? -0.45 : 0) - sw * 0.6 * a.side;
      inner.position.y = Math.abs(sin(phase)) * 0.03 * move;
    },
  };
}
export const PROPS = {
  // ── Hoth ──

  // Echo Base: the main hangar cut into the glacier, its blast doors slid
  // back, the light inside; you can walk in (its mouth faces +z: 40 m
  // across, 15 m high, 60 m deep; the ice 72 m back and 34 m up)
  echobase(k) {
    const object = new THREE.Group();
    const ice = [
      // (each flank in two: the hangar's wall, its inner face where it was,
      // and the jagged ice face beyond the frame)
      roughBox(8, 34, 72, [-24, 0, -36], { seed: 3, amp: 2 }),
      roughBox(8, 34, 72, [24, 0, -36], { seed: 3, amp: 2 }),
      roughBox(44, 34, 70, [-50, 0, -37], { seed: 4, amp: 3.4 }),
      roughBox(44, 34, 70, [50, 0, -37], { seed: 4, amp: 3.4 }),
      roughBox(40.2, 19, 72, [0, 15, -36], { seed: 3, amp: 2 }),
      roughBox(40.2, 15, 12, [0, 0, -66], { seed: 3, amp: 1.2 }),
      // the glacier running on either side
      roughBox(44, 26, 60, [-90, 0, -46], { seed: 5, amp: 2.6 }),
      roughBox(44, 26, 60, [90, 0, -46], { seed: 5, amp: 2.6 }),
    ].map((g) => part(g, { color: ICE }));
    // the blue of the deep ice, where it's been cut
    ice.push(part(roughBox(38, 1.4, 0.6, [0, 15.2, 0.8], { seed: 9, amp: 0.4, base: false }), { color: '#a2bfdc' }));

    object.add(meshOf(k, ice, iceMat(k), { shade: iceShade((x, y, z) => Math.abs(x) < 21.5 && y < 15.6 && z < 0.5 && z > -61) }));
    // snow lying on top of it all, and heaped at its foot
    const soft = { smooth: true, flat: 0.45, sharp: 0.3 };
    const snow = [blob(11, [0, 31, -36], [170, 18, 84], { ...soft, flat: 0.4 }), blob(12, [-92, 23, -46], [54, 16, 66], soft), blob(13, [92, 23, -46], [54, 16, 66], soft)];
    // the glacier's shoulders, heaped with snow, falling away to the plain
    for (const sx of [-1, 1]) {
      snow.push(blob(16 + sx, [sx * 124, -2, -40], [70, 40, 80], { ...soft, flat: 0.5 }));
      snow.push(blob(18 + sx, [sx * 166, -2, -30], [64, 22, 70], soft));
    }
    // crests along its top, so its skyline isn't a ruler's edge
    for (const [x, y, z, sx, sy, sz] of [
      [-48, 31, -22, 56, 22, 46],
      [36, 32, -50, 70, 26, 52],
      [-10, 33, -62, 60, 20, 40],
      [70, 27, -24, 40, 18, 40],
      [-98, 24, -30, 46, 20, 44],
      [128, 18, -48, 50, 16, 56],
      [-132, 16, -44, 52, 16, 56],
    ])
      snow.push(blob(50 + x, [x, y, z], [sx, sy, sz], { ...soft, flat: 0.75 }));
    // drifts banked up the face either side of the opening
    for (const sx of [-1, 1]) snow.push(blob(60 + sx, [sx * 46, -1, 3], [44, 30, 14], { ...soft, flat: 0.7 }));
    for (const [x, z, sz] of [
      [-76, 4, 14],
      [74, 3, 12],
      [-112, -12, 18],
      [114, -14, 16],
      [-34, 3, 6],
      [32, 3, 5],
    ])
      snow.push(blob(20 + x, [x, -0.5, z], [sz * 1.6, sz * 0.8, sz], soft));
    object.add(meshOf(k, snow.map((p) => ({ ...p, to: undefined })), snowMat(k)));

    const steel = '#8a929a';
    const dark = '#3c4248';
    const parts = [
      // the frame of its mouth, and the great doors slid back into the ice
      part(box(2.4, 16.6, 2.6), { at: [-21.2, 0, 0.2], color: steel, to: 'metal' }),
      part(box(2.4, 16.6, 2.6), { at: [21.2, 0, 0.2], color: steel, to: 'metal' }),
      part(box(44.8, 2.8, 2.8), { at: [0, 14.6, 0.2], color: steel, to: 'metal' }),
      part(box(3.6, 14.6, 1), { at: [-18.4, 0, 0.9], color: '#b4bcc4', to: 'paint' }),
      part(box(3.6, 14.6, 1), { at: [18.4, 0, 0.9], color: '#b4bcc4', to: 'paint' }),
      // the floor and its markings
      part(box(40, 0.12, 60), { at: [0, 0, -30], color: '#7c848c', to: 'metal' }),
      part(box(0.45, 0.13, 52), { at: [-10, 0, -28], color: '#c8a040', to: 'paint' }),
      part(box(0.45, 0.13, 52), { at: [10, 0, -28], color: '#c8a040', to: 'paint' }),
      part(box(14, 0.13, 0.55), { at: [0, 0, -2], color: '#c8a040', to: 'paint' }),
      // the back wall: the control room's windows, two doors
      part(box(40, 15, 0.8), { at: [0, 0, -59.6], color: '#9aa2aa', to: 'paint' }),
      part(box(18, 2.4, 0.2), { at: [0, 6, -59.15], color: hot('#9fd4ff', 1.5), to: 'glow' }),
      part(box(3.4, 4.4, 0.2), { at: [-12, 0, -59.15], color: '#1c2228', to: 'dark' }),
      part(box(3.4, 4.4, 0.2), { at: [12, 0, -59.15], color: '#1c2228', to: 'dark' }),
      part(box(4, 0.3, 0.2), { at: [-12, 4.6, -59.1], color: hot('#ffcf8a', 2), to: 'glow' }),
      part(box(4, 0.3, 0.2), { at: [12, 4.6, -59.1], color: hot('#ffcf8a', 2), to: 'glow' }),
      // a sign over the doors
      part(box(12, 1.6, 0.2), { at: [0, 15.2, 1.65], color: '#2a3036', to: 'dark' }),
    ];
    // hazard stripes up the doors' edges
    for (let i = 0; i < 10; i++) for (const x of [-16.55, 16.55]) parts.push(part(box(0.2, 0.7, 1.05), { at: [x, 0.5 + i * 1.4, 0.9], color: i % 2 ? '#d4a02a' : '#2a2a2a', to: 'paint' }));
    // the hangar's ribs and the lights in its roof
    for (let z = -6; z > -60; z -= 8) {
      parts.push(part(box(40, 0.9, 0.8), { at: [0, 13.9, z], color: dark, to: 'metal' }));
      for (const x of [-19.4, 19.4]) parts.push(part(box(0.8, 14, 0.8), { at: [x, 0, z], color: dark, to: 'metal' }));
      for (const x of [-13, 0, 13]) parts.push(part(box(3.4, 0.16, 0.6), { at: [x, 13.75, z + 0.8], color: hot('#e6f0ff', 2.4), to: 'glow' }));
    }
    for (let z = -10; z > -58; z -= 8) for (const x of [-18.9, 18.9]) parts.push(part(box(0.15, 0.4, 1.8), { at: [x, 3.6, z], color: hot('#ffcf8a', 2.2), to: 'glow' }));
    // fuel tanks along the left wall, a rack of crates on the right
    for (const z of [-18, -26]) parts.push(rod([-16.4, 1.2, z], [-16.4, 1.2, z - 6], 1.1, 1.1, { color: '#8e7a5a', to: 'paint' }, 16));
    for (let i = 0; i < 4; i++) parts.push(part(box(2.2, 1.6 + (i % 2) * 0.6, 2.2), { at: [16.6, 0, -40 - i * 2.6], color: i % 2 ? '#7a8088' : '#6a6458', to: 'paint' }));
    // beacons over the doors
    for (const x of [-19, 19]) parts.push(part(new THREE.SphereGeometry(0.45, 10, 8), { at: [x, 17.6, 1.4], color: hot('#ff5a3a', 3), to: 'glow' }));
    // sensor masts on the glacier's back
    for (const [x, z, h] of [
      [14, -30, 16],
      [-30, -44, 11],
    ]) {
      // (3 m up out of the crests' snow)
      parts.push(rod([x, 35, z], [x, 37 + h, z], 0.25, 0.12, { color: '#5a6066', to: 'metal' }));
      for (let i = 1; i < 4; i++) parts.push(rod([x - 1.6, 37 + (h * i) / 4, z], [x + 1.6, 37 + (h * i) / 4, z], 0.06, 0.06, { color: '#5a6066', to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.3, 8, 6), { at: [x, 37.2 + h, z], color: hot('#ff4a3a', 3), to: 'glow' }));
    }
    parts.push(part(dome(2.4, 1.0, 16), { at: [14, 43, -30], rot: [-0.6, 0.3, 0], color: '#9aa2aa', to: 'metal' }));
    object.add(k.build(parts, { name: 'echobase' }));
    return {
      object,
      solids: [
        { box: [-45, -36, 25, 36] },
        { box: [45, -36, 25, 36] },
        { box: [0, -65.5, 20.2, 6] },
        { box: [-90, -46, 22, 30] },
        { box: [90, -46, 22, 30] },
        { box: [-18.4, 0.9, 1.9, 0.6] },
        { box: [18.4, 0.9, 1.9, 0.6] },
        { circle: [-16.4, -24, 1.2] },
        { circle: [-16.4, -29, 1.2] },
        { box: [16.6, -44, 1.2, 5.4] },
        { circle: [-124, -40, 30] },
        { circle: [124, -40, 30] },
        { circle: [-166, -30, 26] },
        { circle: [166, -30, 26] },
      ],
    };
  },

  // Echo Base's shield generator (the catalogue's `shieldgen`; Endor's
  // generator has that name too, so Hoth asks for it by this one): a flared
  // tower under a great dish, its spike over the middle, the power units
  // round its foot (25 m)
  hothgenerator(k) {
    const grey = '#b4bac2';
    const dark = '#5c626a';
    const parts = [
      part(cyl(10.5, 10, 1.2, 40), { color: '#8a9098', to: 'stone' }),
      part(upright([[7.2, 1.2], [7.2, 2.4], [5.4, 3.6], [3.8, 7], [2.9, 13], [3.1, 16.4], [4.4, 18]], 28), { color: grey, to: 'paint' }),
      part(upright([[1.0, 17.4], [5.2, 18.4], [9.2, 20.4], [11.8, 22.3], [12.1, 22.8], [11.6, 22.95], [9.0, 21.2], [5.0, 19.2], [1.0, 18.2]], 40), { color: '#c8ced6', to: 'paint' }),
      part(cyl(0.9, 0.25, 5.6, 12), { at: [0, 18.2, 0], color: dark, to: 'metal' }),
      part(new THREE.SphereGeometry(0.42, 12, 8), { at: [0, 24, 0], color: hot('#a8dcff', 3), to: 'glow' }),
      part(ring(3.9, 0.35, 28), { at: [0, 7, 0], color: dark, to: 'metal' }),
      part(ring(3.1, 0.3, 28), { at: [0, 13.4, 0], color: dark, to: 'metal' }),
    ];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2;
      parts.push(part(box(0.45, 10.5, 2.2), { at: [cos(a) * 4.1, 2.8, sin(a) * 4.1], rot: [0, -a, 0], color: '#9aa0a8', to: 'metal' }));
      parts.push(rod([cos(a) * 3.0, 15.4, sin(a) * 3.0], [cos(a) * 9.6, 21.0, sin(a) * 9.6], 0.16, 0.12, { color: dark, to: 'metal' }));
    }
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * PI * 2;
      parts.push(part(new THREE.SphereGeometry(0.22, 8, 6), { at: [cos(a) * 11.9, 23.0, sin(a) * 11.9], color: hot(i % 2 ? '#ffd27a' : '#bfe4ff', 2.6), to: 'glow' }));
    }
    // the power units round it
    const solids = [{ circle: [0, 0, 7.6] }];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + 0.3;
      const x = cos(a) * 13;
      const z = sin(a) * 13;
      parts.push(part(box(3.4, 2.8, 4.6), { at: [x, 0, z], rot: [0, -a, 0], color: '#a2a8b0', to: 'paint' }));
      parts.push(part(box(3.0, 0.3, 0.12), { at: [x + cos(a) * 1.75, 1.9, z + sin(a) * 1.75], rot: [0, -a + PI / 2, 0], color: hot('#ffcf8a', 2), to: 'glow' }));
      parts.push(rod([x, 0.4, z], [cos(a) * 7, 0.6, sin(a) * 7], 0.18, 0.18, { color: '#2a2e32', to: 'dark' }));
      solids.push({ circle: [x, z, 2.6] });
    }
    return { object: k.build(parts, { name: 'shieldgen' }), solids };
  },

  // the v-150 Planet Defender, as The Empire Strikes Back has it: a great
  // weathered sphere sunk deep in the snow under an ice cliff, its plates'
  // seams round it, scuffed and scorched, the split in its top where the
  // emitter opens; it fires up and away (the transports' cover). Where the
  // Meshy model stands in (`v150`, catalog/made.js), this is only its shot
  // (`shell: false`), from its middle `centre` up, `tilt` above level, out
  // of the emitter `muzzle` metres off
  ioncannon(k, { shell = true, tilt = 0.75, centre = 8, muzzle = 16.5 } = {}) {
    const grey = '#c4c8cc';
    const seam = '#7e848a';
    const dark = '#3c4248';
    const R = 13;
    const d = [0, sin(tilt), cos(tilt)];
    const c = [0, centre, 0]; // (its middle: a third of it under the snow)
    const along = (s) => c.map((v, i) => v + d[i] * s);
    const parts = [part(new THREE.SphereGeometry(R, 48, 32), { at: c, color: grey, to: 'paint' })];
    // the plates' seams: rings of latitude, and meridians from the top
    for (const y of [-0.15, 0.25, 0.6, 0.85]) {
      const r = R * Math.sqrt(1 - y * y);
      parts.push(part(new THREE.TorusGeometry(r + 0.04, 0.09, 6, 64), { at: [c[0], c[1] + y * R, c[2]], rot: [PI / 2, 0, 0], color: seam, to: 'metal' }));
    }
    for (let i = 0; i < 6; i++) parts.push(part(new THREE.TorusGeometry(R + 0.04, 0.08, 6, 64, PI * 0.62), { at: c, rot: [0, (i / 6) * PI, PI / 2], color: seam, to: 'metal' }));
    // scuffs and scorch down its face (blaster fire, and its own exhaust)
    const rnd = k.rand;
    for (let i = 0; i < 14; i++) {
      const a = rnd() * PI * 2;
      const e = -0.1 + rnd() * 0.9;
      const n = [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
      const at = c.map((v, j) => v + n[j] * (R + 0.02));
      parts.push(part(new THREE.CircleGeometry(0.6 + rnd() * 1.6, 7).lookAt(new THREE.Vector3(...n)), { at, color: i % 3 ? '#8e9296' : '#4a4e52', to: 'paint' }));
    }
    // the emitter: the split in the top, its jaws open, the struts in it
    const top = along(R - 0.6);
    parts.push(part(box(6.4, 1.6, 9), { at: top, rot: [-tilt, 0, 0], color: dark, to: 'dark' }));
    for (const sx of [-1, 1]) {
      parts.push(rod(along(R - 1), [top[0] + sx * 1.6, top[1] + 3.8, top[2] + 2.2], 0.55, 0.35, { color: '#8a9096', to: 'metal' }, 8));
      parts.push(part(box(1.2, 4.2, 1.6), { at: [top[0] + sx * 2.6, top[1] - 0.6, top[2] - 0.4], rot: [0.5, 0, sx * 0.35], color: '#9aa0a6', to: 'metal' }));
    }
    parts.push(rod(along(R - 2), along(R + 3.4), 0.9, 0.7, { color: '#6a7076', to: 'metal' }, 12));
    // the snow heaped against it, drifted up its sides
    parts.push(part(new THREE.TorusGeometry(R * 0.95, 3.4, 8, 48), { at: [0, 0.6, 0], rot: [PI / 2, 0, 0], scale: [1, 1, 0.55], color: SNOW, to: 'stone' }));
    for (const [x, z, sx, sy, sz] of [[-10, 8, 9, 4, 7], [11, 6, 8, 3, 7], [3, -12, 10, 3.5, 6], [-12, -6, 7, 3, 6]]) parts.push(blob(70 + x, [x, -0.5, z], [sx, sy, sz], { smooth: true, flat: 0.45, sharp: 0.3 }));
    const object = shell ? k.build(parts, { name: 'ioncannon' }) : Object.assign(new THREE.Group(), { name: 'ioncannon' });
    // the shot: a bolt of red light, up and away (and a flash at the muzzle)
    const aim = new THREE.Group();
    aim.position.set(...c);
    aim.rotation.x = -tilt;
    object.add(aim);
    const boltMat = k.own(new THREE.MeshBasicMaterial({ color: hot('#ff6a4a', 5), toneMapped: false, fog: false }));
    const haloMat = k.own(new THREE.MeshBasicMaterial({ color: hot('#ff3a1a', 2), toneMapped: false, fog: false, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    const ball = k.own(new THREE.SphereGeometry(1, 16, 10));
    const bolt = new THREE.Group();
    const core = new THREE.Mesh(ball, boltMat);
    core.scale.set(1.6, 1.6, 7);
    const halo = new THREE.Mesh(ball, haloMat);
    halo.scale.set(4.2, 4.2, 12);
    bolt.add(core, halo);
    bolt.visible = false;
    aim.add(bolt);
    const flash = new THREE.Mesh(ball, haloMat);
    flash.position.z = muzzle;
    flash.visible = false;
    aim.add(flash);
    let shift = k.rand() * 5;
    let kick = false;
    return {
      object,
      solids: [{ circle: [0, 0, 13] }],
      // (a quest's `fire` signal: it fires now)
      signal(name) {
        if (name === 'fire') kick = true;
      },
      update(t) {
        if (kick) {
          shift = 11 - (t % 11);
          kick = false;
        }
        const age = (t + shift) % 11;
        bolt.visible = age < 3.2;
        bolt.position.z = muzzle + 1.5 + age * 650;
        flash.visible = age < 0.35;
        flash.scale.setScalar(4 + age * 22);
      },
    };
  },

  shieldgen(k) {
    return PROPS.hothgenerator(k);
  },

  // the v-150 itself, where its model (catalog/made.js) won't load: the
  // built sphere, without its shot (the ion cannon beside it fires)
  v150(k) {
    const { object, solids } = PROPS.ioncannon(k);
    return { object, solids };
  },

  // a Rebel DF.9 / trench gun: a squat round tower, its armoured top, a
  // long barrel (4 m)
  turret(k, { color = REBEL } = {}) {
    const dark = '#55595e';
    const top = loft([
      { z: -1.3, pts: trap8(2.3, 1.9, 1.4, 0.2, 0.7) },
      { z: 0.6, pts: trap8(2.3, 1.9, 1.4, 0.2, 0.7) },
      { z: 1.3, pts: trap8(2.0, 1.4, 0.9, 0.15, 0.5) },
    ]);
    const parts = [
      part(cyl(1.45, 1.35, 2.1, 20), { color, to: 'paint' }),
      part(cyl(1.5, 1.5, 0.25, 20), { color: dark, to: 'metal' }),
      part(cyl(1.1, 1.1, 0.35, 20), { at: [0, 2.1, 0], color: dark, to: 'metal' }),
      part(top, { at: [0, 2.4, 0], color, to: 'paint' }),
      part(box(1.2, 0.2, 0.1), { at: [0, 3.25, 1.12], rot: [-0.5, 0, 0], color: '#1a1e22', to: 'dark' }),
      rod([0, 2.95, 1.0], [0, 3.05, 3.2], 0.17, 0.14, { color: dark, to: 'metal' }, 12),
      rod([0, 3.04, 2.9], [0, 3.06, 3.35], 0.22, 0.22, { color: dark, to: 'metal' }, 12),
      rod([0.55, 3.6, -0.8], [0.55, 4.3, -0.8], 0.04, 0.03, { color: dark, to: 'metal' }),
    ];
    return { object: k.build(parts, { name: 'turret' }), solids: [{ circle: [0, 0, 1.5] }] };
  },

  // an E-Web heavy repeating blaster on its tripod, its generator beside
  // it on a cable (1.5 m)
  eweb(k) {
    const dark = '#2c2e32';
    const grey = '#5c6066';
    const parts = [part(box(0.24, 0.3, 1.0), { at: [0, 0.92, 0], color: dark, to: 'metal' }), rod([0, 1.07, 0.5], [0, 1.08, 1.45], 0.05, 0.045, { color: dark, to: 'metal' }), part(box(0.12, 0.12, 0.4), { at: [0, 1.24, -0.1], color: grey, to: 'metal' })];
    for (let i = 0; i < 6; i++) parts.push(rod([0, 1.07, 0.55 + i * 0.1], [0, 1.07, 0.6 + i * 0.1], 0.085, 0.085, { color: grey, to: 'metal' }));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + PI / 2;
      parts.push(rod([0, 0.92, 0], [cos(a) * 0.62, 0, sin(a) * 0.62 * -1], 0.03, 0.025, { color: dark, to: 'metal' }));
    }
    for (const x of [-0.14, 0.14]) parts.push(rod([0, 1.0, -0.5], [x, 0.95, -0.7], 0.02, 0.02, { color: grey, to: 'metal' }));
    // the generator and its cable
    parts.push(part(box(0.6, 0.45, 0.42), { at: [-0.95, 0, -0.55], color: '#6a6e74', to: 'paint' }));
    parts.push(part(box(0.3, 0.06, 0.06), { at: [-0.95, 0.36, -0.33], color: hot('#ff6a3a', 2), to: 'glow' }));
    parts.push(rod([-0.7, 0.2, -0.5], [-0.3, 0.05, -0.3], 0.025, 0.025, { color: '#1a1a1a', to: 'dark' }));
    parts.push(rod([-0.3, 0.05, -0.3], [0, 0.8, -0.3], 0.025, 0.025, { color: '#1a1a1a', to: 'dark' }));
    return { object: k.build(parts, { name: 'eweb' }), solids: [{ circle: [0, 0, 0.5] }, { circle: [-0.95, -0.55, 0.35], top: 0.45 }] };
  },

  // an Imperial probe droid: the black head with its lenses and antennae,
  // the arms hanging under it, slowly turning, slowly swaying (2.4 m; it
  // hovers: put it up with `y`)
  probe(k) {
    const black = '#1e2024';
    const object = new THREE.Group();
    const head = new THREE.Group();
    head.position.y = 1.75;
    const hp = [
      part(new THREE.SphereGeometry(0.46, 20, 14), { scale: [1, 0.92, 1], color: black, to: 'metal' }),
      part(cyl(0.36, 0.44, 0.22, 18), { at: [0, -0.48, 0], color: '#2c2f34', to: 'metal' }),
      part(cyl(0.2, 0.34, 0.18, 14), { at: [0, -0.6, 0], color: black, to: 'metal' }),
    ];
    // the lenses round its face, two of them glowing
    for (const [a, e, glow] of [
      [0, 0.1, true],
      [0.45, 0.25, false],
      [-0.45, 0.25, false],
      [0.3, -0.15, false],
      [-0.3, -0.15, true],
      [0, 0.42, false],
    ])
      lens(hp, a, e, glow);
    for (const [x, z, h] of [
      [0.12, -0.1, 0.9],
      [-0.16, 0.05, 0.65],
      [0.02, 0.18, 0.5],
    ])
      hp.push(rod([x, 0.35, z], [x * 1.4, 0.35 + h, z * 1.4], 0.018, 0.01, { color: '#3a3c40', to: 'metal' }));
    head.add(k.build(hp, { name: 'probe-head' }));
    object.add(head);
    // the arms
    const arms = new THREE.Group();
    arms.position.y = 1.15;
    const ap = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + 0.3;
      const r0 = 0.22;
      const mid = [cos(a) * 0.42, -0.45 - (i % 2) * 0.15, sin(a) * 0.42];
      const end = [cos(a) * 0.36, -1.0 - (i % 3) * 0.12, sin(a) * 0.36];
      ap.push(rod([cos(a) * r0, 0, sin(a) * r0], mid, 0.035, 0.03, { color: '#2a2c30', to: 'metal' }));
      ap.push(rod(mid, end, 0.028, 0.022, { color: '#3a3c40', to: 'metal' }));
      ap.push(part(new THREE.SphereGeometry(0.05, 6, 4), { at: mid, color: '#4a4c50', to: 'metal' }));
      ap.push(rod(end, [end[0] * 1.15, end[1] - 0.12, end[2] * 1.15], 0.02, 0.005, { color: '#5a5c60', to: 'metal' }));
    }
    arms.add(k.build(ap, { name: 'probe-arms' }));
    object.add(arms);
    return {
      object,
      solids: [{ circle: [0, 0, 0.5] }],
      update(t) {
        head.rotation.y = sin(t * 0.35) * 1.2;
        arms.rotation.x = sin(t * 0.9) * 0.08;
        arms.rotation.z = sin(t * 0.7 + 1) * 0.08;
      },
    };
  },

  // a T-47 airspeeder (a snowspeeder): the wedge of its hull, the canopy
  // over its two seats, the cannons either side of its nose, the split
  // flaps at the back, Rogue Group's orange (5.3 m)
  snowspeeder(k) {
    const white = '#dad9d3';
    const orange = '#d0612c';
    const dark = '#3c3e42';
    const secs = [
      { z: -2.65, pts: trap8(3.2, 2.7, 0.72, 0.12, 0.95) },
      { z: -1.3, pts: trap8(3.4, 2.9, 0.84, 0.14, 1.0) },
      { z: 0.9, pts: trap8(2.4, 1.9, 0.8, 0.12, 0.98) },
      { z: 1.4, pts: trap8(2.0, 1.6, 0.74, 0.12, 0.96) },
      { z: 1.75, pts: trap8(1.75, 1.35, 0.68, 0.1, 0.94) },
      { z: 2.15, pts: trap8(1.3, 0.95, 0.58, 0.1, 0.9) },
      { z: 2.65, pts: trap8(0.55, 0.35, 0.34, 0.06, 0.84) },
    ];
    const seg = (a, b, color) => part(loft(secs.slice(a, b + 1)), { color, to: 'paint' });
    const parts = [
      seg(0, 2, white),
      seg(2, 3, white),
      seg(3, 4, orange),
      seg(4, 5, white),
      seg(5, 6, orange),
      // the canopy and its frame
      part(loft([{ z: -0.9, pts: trap8(1.3, 0.9, 0.5, 0.14, 1.62) }, { z: 0.4, pts: trap8(1.3, 0.85, 0.52, 0.14, 1.64) }, { z: 1.2, pts: trap8(1.0, 0.4, 0.3, 0.06, 1.48) }]), { color: '#3a5a7a', to: 'glass' }),
      part(box(1.36, 0.08, 2.0), { at: [0, 1.36, 0.1], color: dark, to: 'metal' }),
      part(box(0.06, 0.55, 0.06), { at: [0, 1.36, 0.0], color: dark, to: 'metal' }),
    ];
    // the cannons, the engines' grilles, the flaps, the harpoon
    for (const s of [-1, 1]) {
      parts.push(part(box(0.3, 0.28, 1.0), { at: [s * 0.98, 0.8, 1.2], color: dark, to: 'metal' }));
      parts.push(rod([s * 0.98, 0.94, 1.6], [s * 0.98, 0.94, 3.15], 0.06, 0.05, { color: dark, to: 'metal' }));
      parts.push(part(box(0.7, 0.42, 0.06), { at: [s * 1.1, 0.75, -2.67], color: '#2a2c30', to: 'dark' }));
      parts.push(part(box(0.5, 0.16, 0.04), { at: [s * 1.1, 0.9, -2.7], color: hot('#ff9a5a', 1.6), to: 'glow' }));
      for (const f of [0, 1]) parts.push(part(box(0.06, 0.62, 0.8), { at: [s * (1.58 + f * 0.08), 0.68, -2.35], rot: [0, 0, s * (0.12 + f * 0.35)], color: f ? orange : white, to: 'paint' }));
      parts.push(rod([s * 1.1, 0.62, -1.6], [s * 1.1, 0, -1.6], 0.05, 0.05, { color: dark, to: 'metal' }));
      parts.push(part(box(0.3, 0.06, 0.4), { at: [s * 1.1, 0, -1.6], color: dark, to: 'metal' }));
    }
    parts.push(rod([0, 0.62, 1.8], [0, 0, 1.8], 0.05, 0.05, { color: dark, to: 'metal' }));
    parts.push(rod([0, 1.08, -2.5], [0, 1.1, -3.0], 0.09, 0.07, { color: dark, to: 'metal' }));
    parts.push(part(box(0.5, 0.06, 1.2), { at: [0.9, 1.0, -0.6], color: '#9a9c9e', to: 'paint' }));
    return { object: k.build(parts, { name: 'snowspeeder' }), solids: [{ box: [0, -0.3, 1.5, 2.4] }] };
  },

  // a stretch of trench: a bank of snow thrown up toward the
  // enemy, a lower one behind, plates and crates along it, `len` m long
  // across x, the front to +z
  snowtrench(k, { len = 24 } = {}) {
    const face = SNOW;
    const parts = [part(berm(len, 2.8, 1.0, 1.55, { z: 1.9, seed: Math.floor(k.rand() * 99) }), { color: face }), part(berm(len, 2.0, 0.8, 0.7, { z: -1.9, seed: Math.floor(k.rand() * 99) }), { color: face })];
    const object = new THREE.Group();
    object.add(meshOf(k, parts, snowMat(k), { density: 0.3 }));
    const bits = [];
    for (let x = -len / 2 + 2; x < len / 2 - 1; x += 2.6 + k.rand() * 2) bits.push(part(box(1.3, 1.25, 0.1), { at: [x, 0, 0.75], rot: [-0.25, (k.rand() - 0.5) * 0.2, 0], color: '#8a9096', to: 'metal' }));
    for (let i = 0; i < 3; i++) bits.push(part(box(0.8, 0.6, 0.6), { at: [(k.rand() - 0.5) * len * 0.8, 0, -0.6], rot: [0, k.rand(), 0], color: '#6a7078', to: 'paint' }));
    object.add(k.build(bits, { name: 'trench' }));
    return { object, solids: [{ box: [0, 2.1, len / 2, 1.0] }, { box: [0, -1.9, len / 2, 0.75], top: 0.7 }] };
  },

  // the wampa's cave: a hollow in a hummock of ice, icicles over its
  // mouth (to +z), and inside, the block of ice in the roof someone in a
  // snow parka hangs from (Luke: the site's `hungluke`, a model); his
  // lightsaber in the snow where it fell
  wampacave(k) {
    const object = new THREE.Group();
    const ice = [
      roughBox(9, 7, 18, [-7.5, 0, -8], { seed: 21, amp: 1.8, scale: 3, seg: 1.5 }),
      roughBox(9, 7, 18, [7.5, 0, -8], { seed: 21, amp: 1.8, scale: 3, seg: 1.5 }),
      roughBox(24, 5, 18, [0, 5.4, -8], { seed: 21, amp: 1.0, scale: 3, seg: 1.5 }),
      roughBox(24, 7, 5, [0, 0, -18.5], { seed: 21, amp: 1.8, scale: 3, seg: 1.5 }),
    ].map((g) => part(g, { color: '#b8cde2' }));
    // the floor of the cave: blue ice
    ice.push(part(box(6, 0.06, 16), { at: [0, 0.02, -8], color: '#9ab6d2' }));
    object.add(meshOf(k, ice, iceMat(k), { shade: iceShade((x, y, z) => Math.abs(x) < 3.8 && y < 5.8 && z < 0.6) }));
    // heaped with snow all round, so it's a hummock in the hillside
    const soft = { smooth: true, flat: 0.5, sharp: 0.6 };
    const snow = [
      blob(31, [0, 5.6, -11], [34, 16, 30], soft),
      blob(32, [-12.5, -0.5, -7], [16, 22, 22], soft),
      blob(33, [12.5, -0.5, -9], [16, 24, 24], soft),
      blob(34, [0, -0.5, -22], [34, 20, 14], soft),
      blob(35, [-19, -0.5, -12], [18, 14, 26], soft),
      blob(36, [19, -0.5, -14], [18, 16, 26], soft),
    ];
    object.add(meshOf(k, snow.map((p) => ({ ...p, to: undefined })), snowMat(k)));
    const icicles = [];
    for (let i = 0; i < 70; i++) {
      const inside = i > 25;
      const x = (k.rand() - 0.5) * (inside ? 5 : 6.2);
      const z = inside ? -2 - k.rand() * 14 : -0.4 + k.rand() * 0.8;
      const h = inside ? 0.6 + k.rand() * 2.0 : 0.4 + k.rand() * 1.6;
      const r = inside ? 0.12 + k.rand() * 0.18 : 0.08 + k.rand() * 0.1;
      // (none over Luke, hung at x 0, z -10)
      if (inside && Math.abs(x) < 0.6 && Math.abs(z + 10) < 1.5) continue;
      // (rooted in the roof, so the tips stay where they were)
      icicles.push(part(new THREE.ConeGeometry(r, h + 0.6, 6).rotateX(PI), { at: [x, 6.0 - (h + 0.6) / 2, z], color: '#dcecff', to: 'glass' }));
    }
    // the block of ice his ankles are frozen into
    const block = part(box(0.7, 0.5, 0.6), { at: [0, 4.9, -10], color: '#e6f0fa', to: 'stone' });
    object.add(k.build([...icicles, block], { name: 'wampacave' }));
    // the saber in the snow, lit, where it fell (a quest's `saber` signal
    // takes it away, or puts it back)
    const saberOf = k.build(
      [
        rod([1.6, 0.06, -6], [1.6, 0.1, -5.7], 0.03, 0.03, { color: '#a8acb2', to: 'metal' }),
        rod([1.6, 0.1, -5.7], [1.62, 0.25, -4.7], 0.028, 0.022, { color: hot('#6ab4ff', 3.2), to: 'glow' }),
        part(new THREE.CircleGeometry(0.7, 16).rotateX(-PI / 2), { at: [1.6, 0.06, -5.3], color: hot('#3a7aff', 0.5), to: 'glow' }),
      ],
      { name: 'saber', shadows: false },
    );
    object.add(saberOf);
    return {
      object,
      solids: [{ box: [-8, -8, 4.6, 9] }, { box: [8, -8, 4.6, 9] }, { box: [0, -19, 12, 2.6] }, { circle: [-13, -6, 6] }, { circle: [13, -8, 6] }, { circle: [-19, -12, 7] }, { circle: [19, -14, 7] }],
      signal(name, on) {
        if (name === 'saber') saberOf.visible = on;
      },
    };
  },

  // the shelter Han threw up the night he found Luke: a snowed-in dome
  // tent, a lamp at its door, a tauntaun lying dead beside it in the snow
  hanshelter(k) {
    const parts = [
      part(dome(2.4, 1.9, 20), { color: '#8e9488', to: 'cloth' }),
      part(new THREE.TorusGeometry(2.05, 0.09, 6, 24, PI), { at: [0, 0, 0], rot: [0, 0, 0], scale: [1, 0.86, 1], color: '#d0612c', to: 'cloth' }),
      part(new THREE.TorusGeometry(2.05, 0.09, 6, 24, PI), { at: [0, 0, 0], rot: [0, PI / 2, 0], scale: [1, 0.86, 1], color: '#d0612c', to: 'cloth' }),
      part(ring(2.4, 0.1, 24), { at: [0, 0.05, 0], color: '#5a5e58', to: 'metal' }),
      part(box(1.0, 1.2, 0.5), { at: [0, 0, 2.1], color: '#1e2024', to: 'dark' }),
      part(box(1.3, 1.45, 0.7), { at: [0, 0, 1.9], color: '#7a8076', to: 'cloth' }),
      part(box(0.18, 0.3, 0.18), { at: [1.0, 0, 2.6], color: '#4a4c50', to: 'metal' }),
      part(box(0.14, 0.14, 0.14), { at: [1.0, 0.3, 2.6], color: hot('#ffb060', 3.2), to: 'glow' }),
      rod([-1.6, 0, 2.8], [-1.6, 1.6, 2.8], 0.03, 0.03, { color: '#3a3c40', to: 'metal' }),
      part(box(0.06, 0.4, 0.3), { at: [-1.6, 1.25, 2.95], color: '#d0612c', to: 'cloth' }),
    ];
    const object = k.build(parts, { name: 'shelter' });
    object.add(meshOf(k, [blob(41, [-2.0, -0.2, -0.8], [3.4, 1.5, 4.2], { flat: 0.4, smooth: true }), blob(42, [2.4, -0.3, -2.2], [4, 1.1, 2.6], { smooth: true }), blob(43, [-0.2, -0.3, -2.8], [4.6, 1.3, 2.2], { smooth: true })].map((p) => ({ ...p, to: undefined })), snowMat(k)));
    return { object, solids: [{ circle: [0, 0, 2.4] }] };
  },

  // smoke going up from a burning wreck: soft puffs rising, spreading and
  // thinning as they drift downwind, the fire glowing under them
  wrecksmoke(k, { h = 16, r = 1.6, n = 14 } = {}) {
    const tex = mat(k, '_puff', () =>
      canvasTexture(64, (c, sz) => {
        const g = c.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.5)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, sz, sz);
      }),
    );
    const object = new THREE.Group();
    const low = new THREE.Color('#2c2c30');
    const high = new THREE.Color('#9a9ca2');
    const puffs = [];
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(k.own(new THREE.SpriteMaterial({ map: tex, color: low, transparent: true, depthWrite: false, rotation: i * 1.7 })));
      sp.userData.k = i / n;
      object.add(sp);
      puffs.push(sp);
    }
    const fire = new THREE.Sprite(k.own(new THREE.SpriteMaterial({ map: tex, color: hot('#ff7a2a', 2.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
    fire.position.y = r * 0.4;
    object.add(fire);
    const ph = k.rand() * 10;
    const tick = (t) => {
      for (const sp of puffs) {
        const f = (t * 0.06 + sp.userData.k + ph) % 1;
        const sc = r * (1.2 + f * 5);
        sp.position.set(f * f * h * 0.6 + sin(f * 6 + sp.userData.k * 9) * r, r * 0.5 + f * h, cos(f * 5 + sp.userData.k * 7) * r * 0.8);
        sp.scale.set(sc, sc, 1);
        sp.material.opacity = Math.min(1, f * 8) * (1 - f) * 0.75;
        sp.material.color.copy(low).lerp(high, f);
      }
      const fl = 1 + 0.25 * sin(t * 11 + ph) + 0.15 * sin(t * 23);
      fire.scale.set(r * 1.5 * fl, r * 1.1 * fl, 1);
    };
    tick(0);
    return { object, update: tick };
  },

  // what's left of a probe droid that blew itself up: the burnt shell of its
  // head, arms and plates thrown about, the scorch on the snow
  probewreck(k) {
    const object = new THREE.Group();
    const rim = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2 + k.rand() * 0.4;
      rim.push(blob(70 + i, [cos(a) * 7.5, -0.2, sin(a) * 7.5], [4 + k.rand() * 2, 1.1 + k.rand() * 0.6, 2.6], { smooth: true, yaw: -a + PI / 2 }));
    }
    object.add(meshOf(k, rim.map((p) => ({ ...p, to: undefined })), snowMat(k)));
    const parts = [
      part(new THREE.CircleGeometry(7.2, 28).rotateX(-PI / 2), { at: [0, 0.05, 0], scale: [1, 1, 0.85], color: '#8a929c', to: 'dark' }),
      part(new THREE.CircleGeometry(4.6, 24).rotateX(-PI / 2), { at: [0, 0.07, 0], scale: [1, 1, 0.8], color: '#3a3e44', to: 'dark' }),
      part(new THREE.CircleGeometry(2.2, 20).rotateX(-PI / 2), { at: [0.3, 0.09, 0.2], color: '#1a1c1e', to: 'dark' }),
      part(new THREE.SphereGeometry(0.46, 14, 10, 0, PI * 2, 0, PI * 0.55), { at: [0.4, -0.05, 0.2], rot: [0.5, 0, 2.2], color: '#2a2c30', to: 'metal' }),
    ];
    for (let i = 0; i < 9; i++) {
      const a = k.rand() * PI * 2;
      const d = 1.2 + k.rand() * 3.5;
      const at = [cos(a) * d, 0.05, sin(a) * d];
      parts.push(i % 2 ? rod(at, [at[0] + cos(a + 1) * 0.8, 0.12, at[2] + sin(a + 1) * 0.8], 0.03, 0.03, { color: '#3a3c40', to: 'metal' }) : part(box(0.3 + k.rand() * 0.3, 0.05, 0.25), { at, rot: [k.rand(), a, 0], color: '#2a2c30', to: 'metal' }));
    }
    object.add(k.build(parts, { name: 'probewreck', shadows: false }));
    return { object };
  },

  // Darth Vader (2.03 m): the helmet, the mask, the chest box, the cape
  vader(k) {
    const black = '#0e0e10';
    const head = [
      part(new THREE.SphereGeometry(0.15, 18, 12, 0, PI * 2, 0, PI / 2), { at: [0, 1.62, 0], scale: [1, 1.1, 1.08], color: black, to: 'metal' }),
      part(cyl(0.21, 0.15, 0.17, 18), { at: [0, 1.46, -0.01], color: black, to: 'metal' }),
      part(box(0.17, 0.17, 0.08), { at: [0, 1.46, 0.11], color: '#26282c', to: 'metal' }),
      part(new THREE.ConeGeometry(0.055, 0.1, 3).rotateX(PI), { at: [0, 1.5, 0.16], color: '#5a5e64', to: 'metal' }),
      part(box(0.05, 0.035, 0.03), { at: [-0.045, 1.6, 0.155], color: '#3a1010', to: 'glass' }),
      part(box(0.05, 0.035, 0.03), { at: [0.045, 1.6, 0.155], color: '#3a1010', to: 'glass' }),
    ];
    const extra = [
      part(box(0.17, 0.13, 0.04), { at: [0, 1.18, 0.13], color: '#5a5e64', to: 'metal' }),
      part(box(0.03, 0.03, 0.02), { at: [-0.04, 1.26, 0.155], color: hot('#ff3a2a', 3), to: 'glow' }),
      part(box(0.03, 0.03, 0.02), { at: [0.0, 1.26, 0.155], color: hot('#3aff6a', 3), to: 'glow' }),
      part(box(0.03, 0.03, 0.02), { at: [0.04, 1.26, 0.155], color: hot('#4a8aff', 3), to: 'glow' }),
      part(box(0.07, 0.05, 0.05), { at: [-0.1, 0.89, 0.13], color: '#a8acb2', to: 'metal' }),
      part(box(0.07, 0.05, 0.05), { at: [0.1, 0.89, 0.13], color: '#a8acb2', to: 'metal' }),
      part(box(0.5, 0.08, 0.3), { at: [0, 1.46, 0], color: black, to: 'cloth' }),
    ];
    return humanoid(k, { name: 'vader', tall: 2.03, body: '#141416', head, extra, robe: ['#101012', 0.4], cape: ['#08080a', 0.7] });
  },
  // a Rebel trooper of Echo Base (1.78 m): the snow parka with its ruff,
  // the white helmet with goggles, a pack, a blaster rifle
  hothtrooper(k) {
    const parka = '#d2cdc0';
    const head = [
      part(new THREE.SphereGeometry(0.11, 14, 10), { at: [0, 1.62, 0.01], color: '#d6a888', to: 'cloth' }),
      part(new THREE.SphereGeometry(0.135, 16, 10, 0, PI * 2, 0, PI * 0.55), { at: [0, 1.64, -0.01], scale: [1, 1, 1.08], color: '#e6e4de', to: 'paint' }),
      part(box(0.2, 0.06, 0.07), { at: [0, 1.635, 0.095], color: '#1a1c20', to: 'glass' }),
      part(box(0.16, 0.07, 0.05), { at: [0, 1.53, 0.1], color: '#b8b2a4', to: 'cloth' }),
      part(new THREE.TorusGeometry(0.14, 0.045, 6, 14), { at: [0, 1.5, 0], rot: [PI / 2, 0, 0], color: '#a8a294', to: 'cloth' }),
    ];
    const extra = [part(box(0.34, 0.44, 0.18), { at: [0, 0.98, -0.2], color: '#8a867a', to: 'cloth' }), part(box(0.46, 0.06, 0.29), { at: [0, 1.12, 0], color: '#6a6658', to: 'cloth' })];
    const held = [part(box(0.07, 0.1, 0.8), { at: [0, -0.68, 0.24], color: '#2a2a2c', to: 'metal' }), part(box(0.05, 0.14, 0.12), { at: [0, -0.78, 0.02], color: '#2a2a2c', to: 'metal' })];
    return humanoid(k, { name: 'hothtrooper', tall: 1.78, body: parka, legs: '#9a958a', boots: '#4a4440', hands: '#5a5248', head, extra, held, robe: [parka, 0.36] });
  },

  // a T-65 X-wing, parked: the long nose, the canopy, the astromech behind
  // it, the four wings open in their X with an engine at each root and a
  // cannon at each tip, landing gear down (12.5 m)
  parkedxwing(k, { stripe = '#b8382a' } = {}) {
    const white = '#dddcd6';
    const grey = '#a2a4a4';
    const dark = '#45474b';
    const Y = 2.1;
    const secs = [
      { z: -4.2, pts: trap8(1.5, 1.3, 1.45, 0.22, Y) },
      { z: -1.2, pts: trap8(1.65, 1.45, 1.6, 0.25, Y + 0.05) },
      { z: 1.2, pts: trap8(1.35, 1.05, 1.3, 0.2, Y) },
      { z: 3.5, pts: trap8(1.06, 0.79, 1.02, 0.16, Y - 0.08) },
      { z: 4.0, pts: trap8(1.02, 0.76, 0.97, 0.16, Y - 0.09) },
      { z: 8.3, pts: trap8(0.42, 0.3, 0.4, 0.06, Y - 0.3) },
    ];
    const seg = (a, b, color) => part(loft(secs.slice(a, b + 1)), { color, to: 'paint' });
    const parts = [
      seg(0, 2, white),
      seg(2, 3, white),
      seg(3, 4, stripe),
      seg(4, 5, white),
      part(loft([{ z: -0.5, pts: trap8(0.96, 0.6, 0.5, 0.14, Y + 0.92) }, { z: 1.0, pts: trap8(0.9, 0.5, 0.45, 0.12, Y + 0.85) }, { z: 2.5, pts: trap8(0.7, 0.2, 0.2, 0.05, Y + 0.66) }]), { color: '#2e4258', to: 'glass' }),
      part(new THREE.SphereGeometry(0.34, 14, 8, 0, PI * 2, 0, PI / 2), { at: [0, Y + 0.8, -1.6], color: '#c8ccd4', to: 'metal' }),
      part(cyl(0.34, 0.34, 0.1, 14), { at: [0, Y + 0.72, -1.6], color: '#2f62c9', to: 'paint' }),
      part(box(1.2, 0.3, 1.6), { at: [0, Y + 0.6, -3.2], color: grey, to: 'paint' }),
      // the landing gear
      rod([0, Y - 0.4, 5.2], [0, 0.1, 5.2], 0.07, 0.07, { color: dark, to: 'metal' }),
      part(box(0.3, 0.12, 0.5), { at: [0, 0, 5.2], color: dark, to: 'metal' }),
    ];
    for (const x of [-0.6, 0.6]) {
      parts.push(rod([x, Y - 0.6, -2.6], [x, 0.1, -2.6], 0.08, 0.08, { color: dark, to: 'metal' }));
      parts.push(part(box(0.3, 0.12, 0.6), { at: [x, 0, -2.6], color: dark, to: 'metal' }));
    }
    // a wing (the upper right one; the rest are it turned and mirrored)
    const wing = (up) => {
      const e = up ? 0.46 : -0.46;
      return place(
        [
          part(plateXZ([[0, -4.3], [5.0, -3.7], [5.0, -1.95], [0, -1.3]], 0.1), { color: white, to: 'paint' }),
          part(plateXZ([[3.5, -3.8], [4.6, -3.72], [4.6, -2.0], [3.5, -2.1]], 0.12), { color: stripe, to: 'paint' }),
          rod([1.05, e, -4.7], [1.05, e, -0.9], 0.43, 0.43, { color: grey, to: 'metal' }, 14),
          rod([1.05, e, -0.95], [1.05, e, -0.6], 0.47, 0.4, { color: dark, to: 'metal' }, 14),
          rod([1.05, e, -4.76], [1.05, e, -4.72], 0.33, 0.33, { color: hot('#ff6a4a', 2.4), to: 'glow' }, 14),
          rod([5.0, 0, -2.6], [5.0, 0, 0.3], 0.13, 0.1, { color: grey, to: 'metal' }),
          rod([5.0, 0, 0.3], [5.0, 0, 4.0], 0.05, 0.05, { color: dark, to: 'metal' }),
          rod([5.0, 0, 3.6], [5.0, 0, 4.15], 0.08, 0.08, { color: dark, to: 'metal' }),
        ],
        [0.7, Y, 0],
        [0, 0, up ? 0.2 : -0.2],
      );
    };
    const right = [...wing(true), ...wing(false)];
    parts.push(...right, ...mirror(right));
    return { object: k.build(parts, { name: 'parkedxwing' }), solids: [{ box: [0, 2.0, 0.9, 6.4] }, { box: [0, -2.8, 5.8, 1.6], top: 1.1 }] };
  },

  // a GR-75 medium transport, set down on the ice: the long clamshell hull
  // over its cargo pods, the command pod up on its back, the engines (90 m)
  gr75(k) {
    const hullC = '#c9c5bc';
    const dark = '#55575a';
    const arch = (w, h, t, y0, n = 7) => {
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push([(cos((i / n) * PI) * w) / 2, y0 + sin((i / n) * PI) * h]);
      for (let i = n; i >= 0; i--) pts.push([cos((i / n) * PI) * (w / 2 - t), y0 + sin((i / n) * PI) * (h - t)]);
      return pts;
    };
    const parts = [
      part(
        loft([
          { z: -45, pts: arch(14, 9, 1.0, 5.5) },
          { z: -41, pts: arch(22, 15, 1.4, 3) },
          { z: 30, pts: arch(22, 15, 1.4, 3) },
          { z: 39, pts: arch(18, 11.5, 1.2, 4) },
          { z: 45, pts: arch(8, 5.5, 1.0, 7) },
        ]),
        { color: hullC, to: 'paint' },
      ),
      part(new THREE.SphereGeometry(4, 18, 12), { at: [0, 19.6, -34], scale: [1.3, 0.75, 1.7], color: '#b8b4aa', to: 'paint' }),
      part(box(7.4, 0.5, 0.2), { at: [0, 20.2, -27.3], rot: [0.5, 0, 0], color: hot('#bfe0ff', 1.6), to: 'glow' }),
      part(box(3, 3, 6), { at: [0, 16.5, -34], color: dark, to: 'metal' }),
      part(box(19, 11, 6), { at: [0, 2.5, -48], color: dark, to: 'metal' }),
    ];
    // the cargo pods, slung under the hull
    for (let i = 0; i < 6; i++) parts.push(part(box(15, 9.5, 9.6), { at: [0, 2.6, -34 + i * 11], color: ['#a8a39a', '#8f8a80', '#b0a898'][i % 3], to: 'paint' }));
    for (const [x, y] of [
      [-4.6, 5.2],
      [4.6, 5.2],
      [-4.6, 10.4],
      [4.6, 10.4],
    ]) {
      parts.push(rod([x, y, -50.6], [x, y, -51.6], 2.1, 2.1, { color: dark, to: 'metal' }, 18));
      parts.push(rod([x, y, -51.62], [x, y, -51.7], 1.7, 1.7, { color: hot('#bfe0ff', 2.2), to: 'glow' }, 18));
    }
    for (const z of [-32, 0, 26])
      for (const x of [-1, 1]) {
        parts.push(rod([x * 9.6, 3.4, z], [x * 10.4, 0.2, z], 0.4, 0.35, { color: dark, to: 'metal' }));
        parts.push(part(box(1.8, 0.3, 2.4), { at: [x * 10.4, 0, z], color: dark, to: 'metal' }));
      }
    return { object: k.build(parts, { name: 'gr75' }), solids: [{ box: [0, -2, 11.5, 50] }] };
  },

  // snowspeeders flying: Rogue Group, a pair and a third, round and round
  // over the battlefield, banking, now and then a burst from their cannons
  // (r: how wide a circuit, h: how high over the ground where it's placed;
  // built: false, nothing built in code for them, each the snowspeeder's
  // model once it's in, by the placer's `wear`)
  speederflight(k, { r = 150, h = 34, speed = 0.11, n = 3, squash = 0.6, built = true } = {}) {
    const object = new THREE.Group();
    const boltMat = k.own(new THREE.MeshBasicMaterial({ color: hot('#ff3a2a', 4), toneMapped: false }));
    const boltGeo = k.own(new THREE.CapsuleGeometry(0.12, 2.4, 2, 6).rotateX(PI / 2));
    const flyers = [];
    for (let i = 0; i < n; i++) {
      const holder = new THREE.Group();
      if (built) holder.add(PROPS.snowspeeder(k).object);
      object.add(holder);
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.visible = false;
      object.add(bolt);
      flyers.push({ holder, bolt, lag: i === 1 ? 0.07 : i === 2 ? PI : 0, side: i === 1 ? 7 : 0, alt: h + i * 4, dir: i === 2 ? -1 : 1, fire: 2 + i * 1.3 });
    }
    const at = (a) => {
      const rr = r * (1 + 0.25 * sin(a * 2));
      return [cos(a) * rr, sin(a) * rr * squash];
    };
    const tick = (t) => {
      for (const f of flyers) {
        const a = (t * speed - f.lag) * f.dir + (f.dir < 0 ? PI : 0);
        const [x, z] = at(a);
        const [x2, z2] = at(a + 0.01 * f.dir);
        const yaw = Math.atan2(x2 - x, z2 - z);
        const side = [cos(yaw), -sin(yaw)];
        f.holder.position.set(x + side[0] * f.side, f.alt + sin(t * 0.7 + f.lag * 9) * 3, z + side[1] * f.side);
        f.holder.rotation.set(0, yaw, -0.45 * f.dir, 'YXZ');
        // a burst from the cannons, every few seconds
        const age = (t + f.fire) % 5;
        f.bolt.visible = age < 0.7;
        if (f.bolt.visible) {
          f.bolt.position.copy(f.holder.position).add(new THREE.Vector3(sin(yaw), -0.05, cos(yaw)).multiplyScalar(6 + age * 240));
          f.bolt.position.y += 0.9;
          f.bolt.rotation.set(0, yaw, 0);
        }
      }
    };
    tick(0);
    return {
      object,
      update: tick,
      wear: {
        url: '/models/galaxy/surface/snowspeeder.glb',
        on(model) {
          for (const f of flyers) {
            f.holder.clear();
            f.holder.add(f === flyers[0] ? model : model.clone());
          }
        },
      },
    };
  },

  // an AT-AT far out on the plain, walking its beat back and forth (`len`
  // m along its z), beyond where you can go
  atatfar(k, { len = 240, speed = 2.2 } = {}) {
    const w = GENERIC.atat(k);
    const holder = new THREE.Group();
    holder.add(w.object);
    const object = new THREE.Group();
    object.add(holder);
    const t0 = k.rand() * 400;
    return {
      object,
      update(t, dt) {
        const period = (2 * len) / speed;
        const u = (((t + t0) % period) + period) % period;
        const out = u < len / speed;
        holder.position.z = out ? u * speed - len / 2 : len / 2 - (u - len / speed) * speed;
        holder.rotation.y = out ? 0 : PI;
        w.update(t, dt, 1);
      },
    };
  },

  // a control post: a pedestal with its screens lit, a hood over it
  // against the snow (1.6 m; the screens face +z)
  hothconsole(k) {
    const parts = [
      part(box(1.1, 1.0, 0.7), { color: '#8a929a', to: 'paint' }),
      part(box(1.2, 0.12, 0.8), { at: [0, 1.0, 0], rot: [0.35, 0, 0], color: '#5a6066', to: 'metal' }),
      part(box(0.9, 0.04, 0.5), { at: [0, 1.08, 0.04], rot: [0.35, 0, 0], color: hot('#7fd0ff', 1.6), to: 'glow' }),
      part(box(0.12, 0.1, 0.08), { at: [-0.35, 0.82, 0.36], color: hot('#ff4a3a', 2.6), to: 'glow' }),
      part(box(0.12, 0.1, 0.08), { at: [-0.15, 0.82, 0.36], color: hot('#ffcf5a', 2.4), to: 'glow' }),
      rod([-0.55, 1.0, -0.3], [-0.55, 2.2, -0.3], 0.04, 0.04, { color: '#4a4e54', to: 'metal' }),
      rod([0.55, 1.0, -0.3], [0.55, 2.2, -0.3], 0.04, 0.04, { color: '#4a4e54', to: 'metal' }),
      part(box(1.5, 0.08, 1.1), { at: [0, 2.2, -0.05], rot: [-0.2, 0, 0], color: '#b4bcc4', to: 'paint' }),
      part(box(1.6, 0.14, 1.2), { at: [0, 2.3, -0.05], rot: [-0.2, 0, 0], color: SNOW, to: 'stone' }),
    ];
    return { object: k.build(parts, { name: 'console' }), solids: [{ box: [0, 0, 0.6, 0.4] }] };
  },

  // a pen for the tauntauns: a fence of posts and rails (a gate on the +z
  // side), a lean-to at the back heaped with snow, a trough
  tauntaunpen(k, { w = 18, d = 13 } = {}) {
    const pipe = '#7a8088'; // (Rebel pipe rails)
    const parts = [];
    const solids = [];
    const edge = (a, b, gate = false) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.ceil(len / 1.1);
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const x = a[0] + (b[0] - a[0]) * f;
        const z = a[1] + (b[1] - a[1]) * f;
        if (gate && Math.abs(x) < 1.8) continue;
        solids.push({ circle: [x, z, 0.3] });
        if (i % 2 === 0) parts.push(part(cyl(0.09, 0.08, 1.5, 6), { at: [x, 0, z], color: pipe, to: 'metal' }));
      }
      for (const y of [0.6, 1.2]) {
        if (gate) {
          parts.push(rod([a[0], y, a[1]], [-1.8, y, a[1]], 0.045, 0.045, { color: pipe, to: 'metal' }));
          parts.push(rod([1.8, y, a[1]], [b[0], y, b[1]], 0.045, 0.045, { color: pipe, to: 'metal' }));
        } else parts.push(rod([a[0], y, a[1]], [b[0], y, b[1]], 0.045, 0.045, { color: pipe, to: 'metal' }));
      }
    };
    const hw = w / 2;
    const hd = d / 2;
    edge([-hw, hd], [hw, hd], true);
    edge([hw, hd], [hw, -hd]);
    edge([hw, -hd], [-hw, -hd]);
    edge([-hw, -hd], [-hw, hd]);
    // the lean-to and its snow, the trough
    for (const x of [-hw + 1, hw - 1]) for (const z of [-hd + 0.6, -hd + 3.6]) parts.push(part(cyl(0.12, 0.1, z < -hd + 1 ? 3.2 : 2.4, 6), { at: [x, 0, z], color: pipe, to: 'metal' }));
    parts.push(part(box(w - 1, 0.18, 4.2), { at: [0, 2.6, -hd + 2.1], rot: [0.2, 0, 0], color: '#8a929a', to: 'paint' }));
    parts.push(part(box(w - 0.8, 0.3, 4.4), { at: [0, 2.8, -hd + 2.1], rot: [0.2, 0, 0], color: SNOW, to: 'stone' }));
    parts.push(part(box(4, 0.6, 0.9), { at: [3, 0, -hd + 2.5], color: '#5c626a', to: 'metal' }));
    parts.push(part(box(3.6, 0.1, 0.6), { at: [3, 0.55, -hd + 2.5], color: '#7a8a5a', to: 'leaf' }));
    return { object: k.build(parts, { name: 'pen' }), solids };
  },
};


export const SCATTER = {
  // a chunk of blue ice, broken off and lying in the snow
  iceblock(k, { seed = 3, color = '#c4daf0' } = {}) {
    const g = new THREE.IcosahedronGeometry(0.5, 0);
    const p = g.attributes.position;
    const r = (i) => noise2(i * 1.7, seed, seed);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const kk = 1 + r(Math.round((x * 7 + y * 13 + z * 19) * 10)) * 0.35;
      p.setXYZ(i, x * kk * 1.2, (y > 0 ? y * 1.1 : y * 0.3) * kk + 0.12, z * kk);
    }
    g.computeVertexNormals();
    return { parts: [{ geometry: k.geometry([part(g, { color, to: 'stone' })]), material: iceMat(k) }], radius: 0.5 };
  },
  // a drift of snow: a long low mound you walk through
  snowdrift(k, { color = SNOW } = {}) {
    const g = smoothed(rockGeometry(7, { sharp: 0.1, detail: 2, flat: 0.25 })).scale(3.2, 1, 1.4);
    return { parts: [{ geometry: k.geometry([part(g, { color, to: 'stone' })]), material: snowMat(k), shadow: false }], radius: null };
  },
  // a dark rock with snow on its top
  snowrock(k, { seed = 4, color = '#5e646e', snow = SNOW } = {}) {
    const g = rockGeometry(seed, { sharp: 0.55, detail: 1 });
    const cap = rockGeometry(seed, { sharp: 0.55, detail: 1 }).scale(1.04, 0.45, 1.04).translate(0, 0.24, 0);
    return { parts: [{ geometry: k.geometry([part(g, { color, to: 'rock' }), part(cap, { color: snow, to: 'rock' })]), material: k.mats.rock }], radius: 0.42 };
  },
};
