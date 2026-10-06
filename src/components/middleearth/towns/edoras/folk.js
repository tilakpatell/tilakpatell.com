// Edoras's people and horses, made in code: Gimli (with his axe, or having
// given it up at the door), Legolas, Aragorn as Strider, Gandalf the White;
// Théoden bent under Saruman's spell and Théoden himself again; Gríma
// Wormtongue, Éowyn, Háma the doorward, the Riders of the guard and
// Wormtongue's men (who can be knocked down); the horses of the Rohirrim
// with their riders, Théoden on Snowmane, and the host of Rohan as one cheap
// mesh to be instanced by the thousand, with its banners; a tankard for the
// feast and a bunch of simbelmynë. ./scene.js places them; nothing is
// downloaded.
//
// The towns' conventions (../bree/props.js): metres; each builder's group
// stands on y = 0 at its origin; people and beasts face +x. The people are
// the map's toy figures (../../mapFigures.js), dressed for Rohan and packed
// as ../minastirith/folk.js packs them (a dozen draws or fewer each, all
// sharing four materials). The horses are Asfaloth (../weathertop/props.js)
// re-coated, saddled and ridden, and still run with that file's gallop().

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { makeToyFigure } from '../../mapFigures';
import { B, ball, cyl, fillColor, lathe as latheRaw, parts, rng, roundBox, tf, tube } from '../../shire/props';
import { createWeathertopKit, gallop } from '../weathertop/props';

const TAU = Math.PI * 2;
// a lathe, its profile always run upwards so its faces face out
const lathe = (pts, ...rest) => latheRaw(pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts, ...rest);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

// Rohan's colours
const MAIL = 0x80858e;
const STEEL = 0xaeb3ba;
const GOLD = 0xc9a24a;
const BRASS = 0xa8823a;
const LEATHER = 0x4e3420;
const DARK = 0x2a1c12;
const GREEN = 0x2e4a2a;

// ── packing a figure (as ../minastirith/folk.js does it) ──

// A figure's meshes, gathered by the kind of surface they are and merged,
// their colours baked into their vertices; the groups that move (body,
// head, legs, arms, and a leaning torso or a neck if it has them) stay, so
// ../../mapFigures.js `pose` still works.
const classOf = (m) => (m.isMeshBasicMaterial ? 'glow' : m.metalness > 0.4 ? 'metal' : m.side === THREE.DoubleSide ? 'cloth' : 'matte');
const KEEP = new Set(['position', 'normal', 'color']);
function baked(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (color != null) {
    if (color.isColor) fillColor(g, (x, y, z, out) => out.copy(color));
    else fillColor(g, color);
  } else if (!g.attributes.color) fillColor(g, 0xffffff);
  for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}
const _mm = new THREE.Matrix4();
function pack(f, M, extra = []) {
  const keep = [f.group, f.body, f.head, ...f.legs, ...f.arms, ...(f.torso ? [f.torso] : []), ...(f.neck ? [f.neck] : [])];
  const kept = new Set(keep);
  f.group.updateMatrixWorld(true);
  const inv = new Map(keep.map((k) => [k, k.matrixWorld.clone().invert()]));
  const bins = new Map();
  const bin = (a, cls) => {
    if (!bins.has(a)) bins.set(a, new Map());
    const m = bins.get(a);
    if (!m.has(cls)) m.set(cls, []);
    return m.get(cls);
  };
  const meshes = [];
  f.group.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  for (const m of meshes) {
    let a = m.parent;
    while (!kept.has(a)) a = a.parent;
    const geo = m.geometry.clone().applyMatrix4(_mm.multiplyMatrices(inv.get(a), m.matrixWorld));
    bin(a, classOf(m.material)).push(baked(geo, m.material.color));
    m.removeFromParent();
    m.geometry.dispose();
    m.material.dispose();
  }
  for (const e of extra) bin(e.group, e.cls).push(baked(e.geo, e.color));
  const empty = [];
  f.group.traverse((o) => {
    if (!kept.has(o) && !o.isMesh) empty.push(o);
  });
  for (const o of empty) o.removeFromParent();
  for (const [a, m] of bins) {
    for (const [cls, geos] of m) {
      const mesh = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], M[cls]);
      mesh.castShadow = true;
      a.add(mesh);
    }
  }
  return f;
}

// ── dressing a figure ──

// Where things are on a toy figure (../../mapFigures.js), by its look.
function dims(look) {
  const tall = look.tall ?? 1;
  const wide = look.wide ?? 1;
  const legLen = 0.34 * tall;
  const bodyH = 0.5 * tall;
  return { tall, wide, legLen, hipY: legLen + 0.08, bodyH, armLen: 0.3 * (0.8 + 0.2 * tall), shoulderY: bodyH * 0.84 };
}

// Hair on a toy's head (a ball 0.29 across, the face to +x): a cap over the
// crown to the brow, the sides and back past the ears, open at the face,
// and for long hair a fall down the back.
function hairdo(add, head, style, color, { len = 0.45, brow = 0.13, lank = 0 } = {}) {
  const r = 0.305;
  const th = Math.acos(brow / r);
  add(head, new THREE.SphereGeometry(r, 22, 7, 0, TAU, 0, th), color, 'cloth');
  const gap = style === 'short' ? 2.3 : 2.15;
  const low = style === 'short' ? 0.64 * Math.PI : 0.8 * Math.PI;
  add(head, new THREE.SphereGeometry(r, 22, 8, Math.PI + gap / 2, TAU - gap, th - 0.04, low - th + 0.04), color, 'cloth');
  if (style !== 'short') {
    const fall = new THREE.CylinderGeometry(0.25, 0.3, len, 16, 3, true, 1.5 * Math.PI - 1.35 - lank, 2.7 + lank * 2);
    const p = fall.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = (0.5 - y / len) * 0.5;
      p.setX(i, p.getX(i) * (1 - k * 0.5));
    }
    add(head, fall, color, 'cloth', { p: [-0.05, -0.12 - len / 2, 0] });
  }
}

// A beard over the jaw and chin and a moustache; short, or long down the chest.
function beardOn(add, head, { color, style = 'short', len = 0.12 }) {
  const wide = style === 'short' ? 2.0 : 2.4;
  add(head, new THREE.SphereGeometry(0.301, 18, 6, Math.PI - wide / 2, wide, (style === 'short' ? 0.67 : 0.63) * Math.PI, 0.3 * Math.PI), color, 'cloth');
  const droop = style === 'short' ? 0.022 : 0.05;
  for (const s of [-1, 1]) add(head, tube([[0.285, -0.07, 0], [0.276, -0.078, s * 0.055], [0.255, -0.08 - droop, s * 0.1]], 0.02, 0.011, { seg: 6, radial: 5 }), color, 'matte');
  if (style === 'short') add(head, ball(0.1, 10, 8), C(color).multiplyScalar(0.9), 'matte', { p: [0.19, -0.215 - len * 0.3, 0], s: [0.66, 0.5 + len * 1.6, 1.2] });
  else add(head, new THREE.ConeGeometry(0.19, len, 10), color, 'matte', { p: [0.19, -0.2 - len / 2, 0], r: [0, 0, Math.PI + 0.12], s: [0.6, 1, 1.15] });
}

// An old man's beard, long and thin and straggling, in strands.
function straggle(add, head, color, len = 0.55) {
  const n = makeNoise(3);
  const c = C(color);
  add(head, new THREE.SphereGeometry(0.301, 18, 6, Math.PI - 1.2, 2.4, 0.63 * Math.PI, 0.3 * Math.PI), color, 'cloth');
  for (const s of [-1, 1]) add(head, tube([[0.285, -0.07, 0], [0.276, -0.08, s * 0.055], [0.25, -0.14, s * 0.1], [0.23, -0.24, s * 0.11]], 0.018, 0.008, { seg: 6, radial: 5 }), color, 'matte');
  for (let i = 0; i < 11; i++) {
    const z = (i - 5) * 0.026;
    const L = len * (0.7 + n(i, 1) * 0.45) * (1 - Math.abs(z) * 1.6);
    const w = (n(i, 4) - 0.5) * 0.06;
    add(head, tube([[0.21, -0.16, z * 1.3], [0.24, -0.26, z * 1.1], [0.23 + w, -0.2 - L * 0.55, z * 0.9 + w], [0.2 + w, -0.2 - L, z * 0.7 + w * 1.5]], 0.034, 0.006, { seg: 8, radial: 5 }), c.clone().multiplyScalar(0.86 + n(i, 7) * 0.2), 'matte');
  }
}

// Brows over the eyes, and a nose.
function faceOn(add, head, { brows = null, stern = 0.15, skin, nose = 0.038, browK = 1 } = {}) {
  if (brows != null) {
    for (const s of [-1, 1]) add(head, roundBox(0.04 * browK, 0.03 * browK, 0.11 * browK, 0.008), brows, 'matte', { p: [0.255, 0.105, s * 0.1], r: [-s * stern, -s * 0.38, 0] });
  }
  if (nose) add(head, ball(nose, 8, 6), skin, 'matte', { p: [0.27 + nose * 0.35, -0.025, 0], s: [0.85, 1.2, 0.8] });
}

// A long garment from the shoulders: a lathe round the body down to `hem`
// leg-lengths below the hip; `grow` sizes it over what's under it.
function profileOf(d, { hem = 0.5, grow = 1, top = 0.985, flare = 0 }) {
  const { bodyH: bh, wide: w, legLen } = d;
  const pts = [[0.1, top * bh], [0.165, 0.962 * bh], [0.2, 0.9 * bh], [0.214, 0.7 * bh], [0.224, 0.5 * bh], [0.24, 0.3 * bh], [0.257, 0.1 * bh], [0.268, 0]];
  if (hem > 0.02) pts.push([0.285 + flare * 0.3, -Math.min(0.25, hem * 0.5) * legLen], [0.3 + flare, -hem * legLen]);
  return pts.map(([r, y]) => [r * w * grow, y]);
}
function radiusAt(prof, y) {
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, y0] = prof[i];
    const [r1, y1] = prof[i + 1];
    if (y <= y0 && y >= y1) return mix(r0, r1, (y0 - y) / (y0 - y1));
  }
  return prof[prof.length - 1][0];
}
function garment(add, T, d, { color, cls = 'matte', hem = 0.5, grow = 1, top = 0.985, flare = 0, trim = null, seg = 22 }) {
  const prof = profileOf(d, { hem, grow, top, flare });
  add(T, lathe(prof, seg), color, cls);
  if (trim != null) {
    const [rh, yh] = prof[prof.length - 1];
    add(T, new THREE.TorusGeometry(rh, 0.014, 4, 26), trim, 'metal', { p: [0, yh + 0.012, 0], r: [Math.PI / 2, 0, 0] });
    add(T, new THREE.TorusGeometry(prof[0][0] + 0.006, 0.013, 4, 18), trim, 'metal', { p: [0, prof[0][1] - 0.004, 0], r: [Math.PI / 2, 0, 0] });
  }
  return prof;
}
// a belt round a garment at `at` of the body's height, and its buckle
function beltOn(add, T, d, prof, { at = 0.12, color = DARK, buckle = GOLD, thick = 0.024, big = 1 } = {}) {
  const by = at * d.bodyH;
  const br = radiusAt(prof, by) + 0.008;
  add(T, new THREE.TorusGeometry(br, thick, 5, 26), color, 'matte', { p: [0, by, 0], r: [Math.PI / 2, 0, 0] });
  if (buckle != null) add(T, roundBox(0.03, 0.065 * big, 0.085 * big, 0.01), buckle, 'metal', { p: [br + 0.014, by, 0] });
}
// A cloak hung from the shoulders down the back: a curved sheet behind,
// clear of the arms, `hem` of the way to the ground; a clasp at the throat.
function cloakOn(add, T, d, { color, trim = null, hem = 0.82, clasp = GOLD }) {
  const { bodyH: bh, wide: w, hipY } = d;
  const prof = [[0.12 * w, 0.995 * bh], [0.22 * w, 0.96 * bh], [0.285 * w, 0.86 * bh], [0.3 * w, 0.66 * bh], [0.31 * w, 0.3 * bh], [0.33 * w, -0.1 * hipY], [0.36 * w, -0.5 * hipY], [0.385 * w, -hem * hipY]];
  const phi0 = Math.PI + 0.38;
  const len = Math.PI - 0.76;
  add(T, lathe(prof, 16, phi0, len), color, 'cloth');
  // over the shoulders, round to the throat
  add(T, lathe(prof.slice(0, 3), 18, 0.25, TAU - 0.5), color, 'cloth');
  if (trim != null) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = phi0 + (len * i) / 16;
      const [r, y] = prof[prof.length - 1];
      pts.push([Math.sin(a) * (r + 0.004), y + 0.01, Math.cos(a) * (r + 0.004)]);
    }
    add(T, tube(pts, 0.016, 0.016, { seg: 20, radial: 4 }), trim, 'matte');
  }
  if (clasp != null) for (const s of [-1, 1]) add(T, ball(0.035, 8, 6), clasp, 'metal', { p: [0.16 * w, 0.93 * bh, s * 0.13 * w], s: [0.6, 1, 1] });
}
// A heavy mantle over the shoulders (fur, for a king's winter or Gríma's black).
function mantleOn(add, T, d, color, { open = 1.3 } = {}) {
  const { bodyH: bh, wide: w } = d;
  add(T, lathe([[0.1 * w, 1.01 * bh], [0.2 * w, 0.99 * bh], [0.265 * w, 0.92 * bh], [0.29 * w, 0.8 * bh], [0.295 * w, 0.68 * bh], [0.28 * w, 0.64 * bh]], 22, Math.PI / 2 + open / 2, TAU - open), color, 'cloth');
  add(T, tf(tf(new THREE.TorusGeometry(0.17 * w, 0.055, 6, 20, TAU - open), { r: [Math.PI / 2, 0, 0] }), { r: [0, -open / 2, 0] }), color, 'matte', { p: [0, 0.99 * bh, 0] });
}
// Shoulder-plates.
function pauldronsOn(add, f, color, cls = 'metal') {
  for (const [i, s] of [[0, -1], [1, 1]]) add(f.arms[i], new THREE.SphereGeometry(0.1, 12, 6, 0, TAU, 0, Math.PI / 2), color, cls, { p: [0, 0.01, s * 0.015], r: [s * 0.35, 0, 0], s: [1.15, 0.85, 1.05] });
}
// Bracers on the forearms.
function bracersOn(add, f, d, color, band = null) {
  for (const arm of f.arms) {
    add(arm, cyl(0.062, 0.057, d.armLen * 0.42, 10), color, 'matte', { p: [0, -d.armLen * 0.74, 0] });
    if (band != null) add(arm, new THREE.TorusGeometry(0.062, 0.01, 4, 14), band, 'metal', { p: [0, -d.armLen * 0.56, 0], r: [Math.PI / 2, 0, 0] });
  }
}
// Boot-tops up the shins.
function bootsOn(add, f, d, color) {
  for (const leg of f.legs) add(leg, cyl(0.09 * d.wide, 0.083 * d.wide, d.legLen * 0.52, 9), color, 'matte', { p: [0.004, -d.legLen * 0.66, 0] });
}

// A spear in the right hand, its butt on the ground: a long leaf of a blade.
function spearIn(add, arm, d, len = 2.7) {
  const ground = -(d.hipY + d.shoulderY);
  const x = 0.05;
  add(arm, cyl(0.022, 0.026, len, 7), 0x4a3424, 'matte', { p: [x, ground + len / 2, 0] });
  add(arm, lathe([[0.001, 0], [0.042, 0.06], [0.052, 0.15], [0.036, 0.26], [0.001, 0.38]], 7), 0xe2e6ec, 'metal', { p: [x, ground + len, 0], s: [0.35, 1, 1] });
  add(arm, cyl(0.032, 0.03, 0.09, 7), GOLD, 'metal', { p: [x, ground + len - 0.02, 0] });
  add(arm, new THREE.ConeGeometry(0.026, 0.1, 6), 0x9aa0aa, 'metal', { p: [x, ground + 0.05, 0], r: [Math.PI, 0, 0] });
}
// A sword in its scabbard at the left hip, the hilt forward.
function swordAtHip(add, T, d, { hilt = 0x3a2a20, guard = 0xd8dce4 } = {}) {
  const z = -0.29 * d.wide;
  add(T, tube([[0.05, 0.06, z], [-0.1, -0.2, z - 0.02], [-0.28, -0.5, z - 0.03]], 0.032, 0.026, { seg: 8, radial: 6 }), 0x1e1c22, 'matte');
  add(T, ball(0.032, 6, 5), guard, 'metal', { p: [-0.29, -0.52, z - 0.03] });
  add(T, tube([[0.05, 0.06, z], [0.1, 0.15, z], [0.15, 0.24, z]], 0.02, 0.018, { seg: 4, radial: 5 }), hilt, 'matte');
  add(T, tube([[0.12, 0.0, z], [0.05, 0.06, z], [-0.02, 0.12, z]], 0.016, 0.016, { seg: 4, radial: 5 }), guard, 'metal');
  add(T, ball(0.03, 8, 6), guard, 'metal', { p: [0.16, 0.26, z] });
}
// A bow and a quiver on the back (Legolas's).
function bowOnBack(add, T, d) {
  const c = V3(-0.29 * d.wide, 0.5 * d.bodyH, 0);
  const u = V3(0, Math.cos(0.65), Math.sin(0.65));
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const s = mix(-0.6, 0.6, i / 8);
    pts.push(c.clone().addScaledVector(u, s).add(V3(-0.13 * (1 - (s / 0.6) ** 2) + 0.03 * Math.sin((s / 0.6) * Math.PI) ** 2, 0, 0)));
  }
  add(T, tube(pts, 0.018, 0.018, { seg: 16, radial: 5 }), 0xb08a58, 'matte');
  add(T, tube([pts[0], pts[8]], 0.005, 0.005, { seg: 1, radial: 3 }), 0xe8e4d8, 'matte');
  const q = V3(-0.27 * d.wide, 0.55 * d.bodyH, -0.04);
  add(T, cyl(0.075, 0.06, 0.52, 9), 0x6a4a30, 'matte', { p: [q.x, q.y, q.z], r: [0.55, 0, 0] });
  for (let i = 0; i < 5; i++) add(T, new THREE.ConeGeometry(0.025, 0.12, 4), i % 2 ? 0xe8e0cc : 0x9a3a2a, 'matte', { p: [q.x + (i - 2) * 0.012, q.y + 0.26 * Math.cos(0.55) + 0.05, q.z - 0.26 * Math.sin(0.55) - 0.04 + (i % 2) * 0.03], r: [0.55, 0, 0] });
}
// A cudgel in the right hand, hanging forward: knotted, studded.
function cudgelIn(add, arm, d, seed = 9) {
  const y = -d.armLen - 0.02;
  add(arm, tube([[0.0, y + 0.07, 0], [0.09, y - 0.18, 0], [0.19, y - 0.44, 0]], 0.028, 0.06, { seg: 6, radial: 7, gnarl: 0.3, seed }), 0x5e4028, 'matte');
  add(arm, ball(0.065, 8, 6), 0x523822, 'matte', { p: [0.2, y - 0.46, 0], s: [1, 1.2, 1] });
  const r = rng(seed);
  for (let i = 0; i < 6; i++) {
    const t = 0.55 + r() * 0.4;
    const a = r() * TAU;
    const at = V3(mix(0.0, 0.19, t), mix(y + 0.07, y - 0.44, t), 0).add(V3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05));
    add(arm, new THREE.ConeGeometry(0.014, 0.05, 4), 0x3a3836, 'metal', { p: [at.x, at.y, at.z], r: [Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4] });
  }
}
// The round shield of Rohan: green, a gilt rim and boss, a sunburst of gold
// rays; `r` across, made facing +y (turn it where it's wanted).
function shieldGeos(r = 0.34, { field = GREEN, rim = GOLD } = {}) {
  const face = cyl(r, r, 0.035, 28);
  const fc = C(field);
  const gc = C(rim);
  const dark = C(field).multiplyScalar(0.7);
  fillColor(face, (x, y, z, out) => {
    const rr = Math.hypot(x, z) / r;
    const a = Math.atan2(z, x);
    out.copy(fc);
    if (rr > 0.18 && rr < 0.8 && Math.cos(a * 8) > 0.72) out.lerp(gc, 0.85);
    if (rr > 0.86) out.copy(dark);
  });
  const rimG = tf(new THREE.TorusGeometry(r, 0.022, 5, 32), { r: [Math.PI / 2, 0, 0] });
  const boss = new THREE.SphereGeometry(r * 0.2, 12, 6, 0, TAU, 0, Math.PI / 2);
  tf(boss, { p: [0, 0.015, 0] });
  return { face, rim: rimG, boss };
}
function shieldOnBack(add, T, d, look, x) {
  const { face, rim, boss } = shieldGeos(0.34 * d.wide, { field: look.shield ?? GREEN });
  const o = { r: [0, 0, Math.PI / 2], p: [x, 0.52 * d.bodyH, 0] };
  add(T, tf(face, o), null, 'matte');
  add(T, tf(rim, o), GOLD, 'metal');
  add(T, tf(boss, { r: [0, 0, Math.PI / 2], p: [x - 0.02, 0.52 * d.bodyH, 0] }), GOLD, 'metal');
}

// The tall helm of the Riders on a toy's head: a high steel bowl with a
// gilt ridge over it, a gilt brow band, cheek-guards, a nasal and a flared
// neck-guard, and the long horse-hair crest falling from its top down the
// back. A king's has gold cheek-guards and a gold horse at its brow.
const ROHAN_BOWL = [[0.326, 0.02], [0.334, 0.12], [0.322, 0.25], [0.292, 0.37], [0.244, 0.48], [0.176, 0.57], [0.1, 0.63], [0.04, 0.66], [0.001, 0.665]];
function rohanHelm(add, head, { plume = 0xece6d6, king = false, seed = 1 } = {}) {
  const steel = king ? 0xc8ccd2 : STEEL;
  add(head, lathe(ROHAN_BOWL, 24), steel, 'metal');
  add(head, new THREE.TorusGeometry(0.332, 0.026, 6, 32), GOLD, 'metal', { r: [Math.PI / 2, 0, 0], p: [0, 0.07, 0] });
  add(head, new THREE.TorusGeometry(0.3, 0.012, 4, 30), GOLD, 'metal', { r: [Math.PI / 2, 0, 0], p: [0, 0.34, 0] });
  add(head, tube([[0.31, 0.12, 0], [0.27, 0.38, 0], [0.16, 0.58, 0], [0.0, 0.68, 0], [-0.16, 0.6, 0], [-0.28, 0.42, 0], [-0.34, 0.18, 0]], 0.032, 0.024, { seg: 16, radial: 5 }), GOLD, 'metal');
  for (const s of [-1, 1]) {
    const mid = s > 0 ? 0.3 : Math.PI - 0.3;
    add(head, new THREE.CylinderGeometry(0.338, 0.31, 0.32, 8, 1, true, mid - 0.42, 0.84), king ? GOLD : steel, 'metal', { p: [0, -0.1, 0] });
    // a gilt edge down the guard's front
    const a = mid + (s > 0 ? 0.42 : -0.42);
    add(head, tube([[Math.sin(a) * 0.336, 0.06, Math.cos(a) * 0.336], [Math.sin(a) * 0.322, -0.12, Math.cos(a) * 0.322], [Math.sin(a) * 0.312, -0.26, Math.cos(a) * 0.312]], 0.012, 0.012, { seg: 4, radial: 4 }), GOLD, 'metal');
  }
  add(head, new THREE.CylinderGeometry(0.33, 0.41, 0.26, 12, 1, true, 1.5 * Math.PI - 1.25, 2.5), steel, 'metal', { p: [0, -0.06, 0] });
  add(head, roundBox(0.03, 0.22, 0.05, 0.01), steel, 'metal', { p: [0.335, -0.02, 0] });
  if (king) {
    // a running horse in gold on the brow
    add(head, roundBox(0.06, 0.1, 0.16, 0.02), GOLD, 'metal', { p: [0.31, 0.2, 0], r: [0, 0, -0.35] });
    add(head, new THREE.ConeGeometry(0.035, 0.16, 6), GOLD, 'metal', { p: [0.26, 0.33, 0], r: [0, 0, -0.5] });
  }
  // the crest: horse-hair from the top, falling down the back
  const n = makeNoise(seed);
  const pc = C(plume);
  for (let i = 0; i < 9; i++) {
    const z = (i - 4) * 0.022;
    const sh = 0.85 + n(i, 3) * 0.25;
    const L = 0.95 + n(i, 5) * 0.2;
    const pts = [[0.02, 0.66, z * 0.4], [-0.16, 0.72, z * 0.8], [-0.34, 0.6, z * 1.3], [-0.44, 0.34, z * 1.7], [-0.46, 0.04 * L, z * 2], [-0.43, -0.22 * L, z * 2.2], [-0.4, -0.42 * L, z * 2.2]];
    add(head, tube(pts, 0.05, 0.016, { seg: 14, radial: 5 }), pc.clone().multiplyScalar(sh), 'matte');
  }
}
// A Dwarf's helm, Gimli's: a low rounded bowl of dark steel, its brow rim
// and ridge in brass, studded, and leather flaps down over the ears.
const DWARF_BOWL = [[0.33, 0.04], [0.338, 0.13], [0.325, 0.24], [0.29, 0.34], [0.232, 0.42], [0.158, 0.475], [0.08, 0.505], [0.001, 0.515]];
function dwarfHelm(add, head) {
  add(head, lathe(DWARF_BOWL, 24), 0x60646c, 'metal');
  add(head, new THREE.TorusGeometry(0.338, 0.034, 6, 32), BRASS, 'metal', { r: [Math.PI / 2, 0, 0], p: [0, 0.06, 0] });
  add(head, tube([[0.33, 0.1, 0], [0.28, 0.32, 0], [0.14, 0.48, 0], [-0.04, 0.53, 0], [-0.2, 0.46, 0], [-0.31, 0.3, 0], [-0.34, 0.1, 0]], 0.036, 0.03, { seg: 16, radial: 5 }), BRASS, 'metal');
  for (const s of [-1, 1]) add(head, tube([[0.0, 0.52, 0], [0.0, 0.42, s * 0.22], [0.0, 0.24, s * 0.31], [0.0, 0.08, s * 0.34]], 0.022, 0.022, { seg: 10, radial: 4 }), BRASS, 'metal');
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    add(head, ball(0.022, 6, 5), 0xd8b860, 'metal', { p: [Math.sin(a) * 0.37, 0.06, Math.cos(a) * 0.37] });
  }
  for (const s of [-1, 1]) {
    const mid = s > 0 ? 0.1 : Math.PI - 0.1;
    add(head, new THREE.CylinderGeometry(0.336, 0.325, 0.3, 7, 1, true, mid - 0.55, 1.1), 0x5a3a22, 'cloth', { p: [0, -0.1, 0] });
  }
  add(head, new THREE.CylinderGeometry(0.335, 0.36, 0.2, 10, 1, true, 1.5 * Math.PI - 1.0, 2.0), 0x60646c, 'metal', { p: [0, -0.05, 0] });
}
// Gimli's beard: a great red-brown mass from the cheeks to the belt, the
// moustache drooping over it, two long braids with silver clasps.
function dwarfBeard(add, head, color) {
  const c = C(color);
  const lo = c.clone().multiplyScalar(0.82);
  add(head, new THREE.SphereGeometry(0.303, 20, 7, Math.PI - 1.3, 2.6, 0.58 * Math.PI, 0.34 * Math.PI), color, 'cloth');
  const mass = ball(0.27, 16, 12);
  fillColor(mass, (x, y, z, out) => out.copy(c).lerp(lo, clamp01(-y * 1.8)));
  add(head, mass, null, 'matte', { p: [0.16, -0.36, 0], s: [0.62, 1.32, 1.18] });
  add(head, new THREE.ConeGeometry(0.2, 0.36, 12), lo, 'matte', { p: [0.2, -0.66, 0], r: [0, 0, Math.PI + 0.18], s: [0.55, 1, 1.15] });
  for (const s of [-1, 1]) {
    add(head, tube([[0.29, -0.06, 0], [0.285, -0.075, s * 0.06], [0.27, -0.11, s * 0.13], [0.25, -0.2, s * 0.16]], 0.032, 0.016, { seg: 8, radial: 6 }), color, 'matte');
    add(head, tube([[0.24, -0.42, s * 0.13], [0.27, -0.62, s * 0.13], [0.27, -0.84, s * 0.1]], 0.04, 0.026, { seg: 8, radial: 6 }), lo, 'matte');
    for (const y of [-0.58, -0.76]) add(head, cyl(0.034, 0.034, 0.05, 8), 0xc8ccd4, 'metal', { p: [0.27, y, s * 0.12] });
  }
}
// Gimli's axe, as he carries it in the films: a long haft and a broad,
// two-bladed head; made along +y (the haft), the blades out to ±z.
function axeGeos(len = 0.9) {
  const out = { wood: [], steel: [], brass: [] };
  out.wood.push(cyl(0.024, 0.027, len, 8).translate(0, len / 2, 0));
  out.brass.push(cyl(0.032, 0.032, 0.06, 8).translate(0, 0.03, 0));
  out.brass.push(cyl(0.03, 0.03, 0.05, 8).translate(0, len * 0.45, 0));
  // a bearded blade, its edge a long curve
  const blade = (big) => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.07 * big);
    s.quadraticCurveTo(0.1 * big, -0.08 * big, 0.2 * big, -0.2 * big);
    s.quadraticCurveTo(0.3 * big, -0.02 * big, 0.21 * big, 0.17 * big);
    s.quadraticCurveTo(0.12 * big, 0.08 * big, 0, 0.07 * big);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 8 });
    return g.translate(0, 0, -0.011);
  };
  for (const [s, big] of [[1, 1], [-1, 0.78]]) {
    const g = blade(big);
    tf(g, { r: [0, -Math.PI / 2, 0] });
    if (s < 0) tf(g, { r: [0, Math.PI, 0] });
    out.steel.push(g.translate(0, len - 0.12, 0));
  }
  out.brass.push(roundBox(0.07, 0.17, 0.08, 0.015).translate(0, len - 0.12, 0));
  out.steel.push(new THREE.ConeGeometry(0.03, 0.1, 6).translate(0, len + 0.02, 0));
  return out;
}

// A hood up over the head, and its cowl round the shoulders.
function hoodOn(add, head, T, d, color) {
  add(head, new THREE.SphereGeometry(0.36, 22, 10, Math.PI + 0.95, TAU - 1.9, 0, 0.76 * Math.PI), color, 'cloth', { p: [-0.03, 0.03, 0], s: [1.05, 1.05, 1] });
  add(head, new THREE.TorusGeometry(0.33, 0.03, 5, 18, 1.9), C(color).multiplyScalar(0.8), 'matte', { p: [0.0, 0.03, 0], r: [0, -Math.PI / 2, 0], s: [1, 1.05, 1] });
  add(head, new THREE.ConeGeometry(0.13, 0.3, 8), color, 'matte', { p: [-0.3, 0.24, 0], r: [0, 0, 1.2] });
  const { bodyH: bh, wide: w } = d;
  add(T, lathe([[0.11 * w, 1.04 * bh], [0.23 * w, 0.97 * bh], [0.3 * w, 0.84 * bh], [0.31 * w, 0.74 * bh]], 18), color, 'cloth');
}

// The toy's own long hair, its robe (a plain cone: ours has folds), its
// pointed ears on any but an Elf, and an elven brooch, where they aren't wanted.
function strip(f, look, d) {
  const drop = [];
  f.group.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.parameters ?? {};
    const type = o.geometry.type;
    if (look.hairdo && o.parent === f.head && ((type === 'SphereGeometry' && Math.abs(p.phiStart - Math.PI * 0.62) < 1e-6) || (type === 'BoxGeometry' && p.width === 0.16))) drop.push(o);
    if (o.material.isMeshBasicMaterial && p.radius === 0.035) drop.push(o);
    if (look.hairdo !== 'elf' && o.parent === f.head && type === 'ConeGeometry' && p.radius === 0.06) drop.push(o);
    if (look.robe && o.parent === f.body && type === 'CylinderGeometry' && Math.abs(p.height - (d.bodyH + d.hipY)) < 1e-6) drop.push(o);
  });
  for (const o of drop) {
    o.removeFromParent();
    o.geometry.dispose();
  }
}
// A robe to the ground from the shoulders, fitted to the waist, falling in
// folds that deepen to the hem; a belt or girdle at the waist.
function robeOn(add, T, d, { color, waist = 0.2, hem = 0.38, folds = 0.07, belt = null, buckle = null, at = 0.3 }) {
  const { bodyH: bh, wide: w, hipY } = d;
  const prof = [[0.1, 0.99 * bh], [0.165, 0.955 * bh], [0.2, 0.86 * bh], [0.205, 0.7 * bh], [waist, 0.42 * bh], [waist + 0.012, 0.22 * bh], [0.245, -0.1 * hipY], [0.3, -0.5 * hipY], [hem, -(hipY - 0.012)]].map(([r, y]) => [r * w, y]);
  const g = lathe(prof, 36);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + folds * Math.sin(Math.atan2(z, x) * 11) * clamp01((0.3 * bh - y) / (hipY + 0.3 * bh));
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  add(T, g, color, 'matte');
  if (belt != null) {
    const by = at * bh;
    add(T, new THREE.TorusGeometry(radiusAt(prof, by) + 0.008, 0.018, 5, 28), belt, buckle != null ? 'metal' : 'matte', { p: [0, by, 0], r: [Math.PI / 2, 0, 0] });
    if (buckle != null) add(T, roundBox(0.02, 0.05, 0.06, 0.01), buckle, 'metal', { p: [radiusAt(prof, by) + 0.026, by, 0] });
  }
  return prof;
}
// Round ears, for Men and Dwarves.
function earsOn(add, head, skin) {
  for (const s of [-1, 1]) add(head, ball(0.06, 10, 8), skin, 'matte', { p: [-0.015, 0.0, s * 0.282], s: [0.55, 1, 0.42] });
}

// One figure from a look: the toy, stripped, posed (a lean, a drooping
// head), dressed, and packed. `dress(add, f, d, T)` adds what's particular.
function figure(look, M, id, dress = null) {
  const d = dims(look);
  const toy = {
    tall: d.tall,
    wide: d.wide,
    skin: look.skin,
    hair: look.hair,
    hairStyle: look.hairdo === 'elf' ? 'long' : look.hairdo ? 'none' : (look.hairStyle ?? 'curly'),
    beard: null,
    coat: look.coat,
    shirt: look.shirt,
    robe: look.robe ?? null,
    item: look.item ?? null,
    feet: look.feet ?? 'boots',
    seed: look.seed ?? 1,
  };
  for (const k of Object.keys(toy)) if (toy[k] === undefined) delete toy[k];
  const f = makeToyFigure(toy);
  strip(f, look, d);
  const skin = look.skin ?? 0xf1c9a0;
  // the toy's legs as hose, its sleeves as mail
  if (look.hose) for (const leg of f.legs) for (const m of leg.children) if (m.isMesh && m.geometry.type === 'CylinderGeometry') m.material.color.set(look.hose);
  if (look.mailArms) {
    for (const arm of f.arms) {
      for (const m of arm.children) {
        if (m.isMesh && m.geometry.type === 'CylinderGeometry') {
          m.material.color.set(MAIL);
          m.material.metalness = 0.6;
        }
      }
    }
  }
  // eyes clouded (the king under the spell)
  if (look.eyes != null) for (const m of f.head.children) if (m.isMesh && m.geometry.parameters?.radius === 0.035) m.material.color.set(look.eyes);
  // a bent back: the body above the hips leans forward, the head droops
  if (look.lean || look.droop) {
    const torso = new THREE.Group();
    torso.rotation.z = -(look.lean ?? 0);
    for (const c of [...f.body.children]) torso.add(c);
    f.body.add(torso);
    f.torso = torso;
    const neck = new THREE.Group();
    neck.position.set(0.02, d.bodyH * 0.96, 0);
    neck.rotation.z = -(look.droop ?? 0);
    torso.add(neck);
    f.head.position.set(0.02, f.head.position.y - neck.position.y, 0);
    neck.add(f.head);
    f.neck = neck;
  }
  const T = f.torso ?? f.body;
  const extra = [];
  const add = (group, geo, color, cls = 'matte', o) => {
    if (o) tf(geo, o);
    extra.push({ group, geo, color, cls });
    return geo;
  };
  if (look.hairdo) hairdo(add, f.head, look.hairdo === 'elf' ? 'long' : look.hairdo, look.hair, look);
  if (look.beard) beardOn(add, f.head, look.beard);
  if (look.braids) for (const s of [-1, 1]) add(f.head, tube([[0.12, 0.2, s * 0.27], [0.1, 0.0, s * 0.3], [0.08, -0.25, s * 0.27]], 0.026, 0.018, { seg: 6, radial: 5 }), look.hair, 'matte');
  if (look.ears !== false && look.hairdo !== 'elf') earsOn(add, f.head, skin);
  faceOn(add, f.head, { brows: look.brows ?? null, stern: look.stern ?? -0.06, skin, nose: look.nose ?? (d.tall > 1.2 ? 0.038 : 0), browK: look.browK ?? 1 });
  dress?.(add, f, d, T);
  pack(f, M, extra);
  f.group.name = id;
  f.look = look;
  f.id = id;
  // the top of the head (and what's on it): for a label over it
  f.group.updateMatrixWorld(true);
  f.top = new THREE.Box3().setFromObject(f.head).max.y;
  return f;
}

// ── who's who ──

const LOOKS = {
  gimli: { tall: 0.95, wide: 1.38, skin: 0xe8b088, coat: 0x5a3420, shirt: MAIL, hose: 0x4a3626, mailArms: true, hairdo: 'long', hair: 0x7a2e14, ears: false, len: 0.34, brows: 0x7a2c12, browK: 1.35, stern: 0.3, nose: 0.062, seed: 11 },
  legolas: { tall: 1.52, skin: 0xf2d6bc, coat: 0x66704e, shirt: 0x7a6a50, hose: 0x4a4436, hairdo: 'elf', hair: 0xeed69a, len: 0.55, braids: true, brows: 0xc8b070, seed: 15 },
  aragorn: { tall: 1.57, wide: 1.05, skin: 0xe2b48c, coat: 0x3a3026, shirt: 0x4a4434, hose: 0x2a2620, hairdo: 'long', hair: 0x2a1e16, len: 0.36, beard: { color: 0x2a1e16, style: 'short', len: 0.05 }, brows: 0x2a1e16, stern: 0.16, seed: 7 },
  gandalf: { tall: 1.55, robe: 0xf3f1ec, shirt: 0xf3f1ec, hairdo: 'long', hair: 0xf2f0ec, len: 0.5, beard: { color: 0xf6f4f0, style: 'long', len: 0.6 }, brows: 0xf0eee8, stern: 0.05, item: 'white-staff', seed: 5 },
  theodenOld: { tall: 1.52, robe: 0x2e2620, shirt: 0x2e2620, skin: 0xb8b0a4, hairdo: 'long', hair: 0xe4e1da, len: 0.56, lank: 0.25,  brows: 0xd8d4cc, stern: -0.15, eyes: 0x8e9290, lean: 0.14, droop: 0.34, seed: 31 },
  theoden: { tall: 1.57, wide: 1.08, skin: 0xe6bc98, coat: GREEN, shirt: MAIL, hose: 0x3a2e22, mailArms: true, hairdo: 'long', hair: 0xa88444, len: 0.3, beard: { color: 0x9a7a40, style: 'short', len: 0.12 }, brows: 0x8a6a34, stern: 0.12, seed: 33 },
  grima: { tall: 1.48, wide: 0.9, robe: 0x141218, shirt: 0x141218, skin: 0xe2ddcf, hairdo: 'long', hair: 0x121010, len: 0.36, lank: 0.3, brows: 0x0e0c0c, stern: 0.38, lean: 0.2, droop: 0.2, seed: 35 },
  eowyn: { tall: 1.45, wide: 0.9, robe: 0xece8e0, shirt: 0xece8e0, skin: 0xf4dcc8, hairdo: 'long', hair: 0xe2bc70, len: 0.64, brows: 0xb89050, stern: -0.05, seed: 37 },
};
const FACES = [0xe8bc94, 0xf0c8a0, 0xdcac84, 0xf2d0b0, 0xe6b890];
const ROH_HAIR = [0xc8a060, 0x9a7040, 0xdcbc7a, 0x7a4a28, 0xb88850, 0x5a3a20];
const ROH_CLOAK = [0x2e4a2a, 0x3a4a2a, 0x24402a, 0x4a4a2e, 0x2a3a26];
const PLUMES = [0xf0ece0, 0xe0c890, 0x3a2a1e, 0xd8d0c0, 0xb0703a];
const TUNICS = [0x5a4028, 0x3e4a2c, 0x6a4a2a, 0x2e3a26];
// A Rider of the guard (Háma is one): mail, a leather jerkin, the helm with
// its crest, a green cloak, a spear and a round shield on the back.
function riderLook(n) {
  const k = Math.abs(n);
  return {
    tall: 1.54 + (k % 3) * 0.03,
    wide: 1.06 + (k % 2) * 0.06,
    skin: FACES[k % FACES.length],
    hair: ROH_HAIR[k % ROH_HAIR.length],
    hairdo: 'long',
    len: 0.36,
    beard: k % 3 === 2 ? null : { color: ROH_HAIR[(k + (k % 4 === 1 ? 1 : 0)) % ROH_HAIR.length], style: k % 3 === 1 ? 'long' : 'short', len: k % 3 === 1 ? 0.24 : 0.1 },
    brows: ROH_HAIR[k % ROH_HAIR.length],
    stern: 0.14,
    coat: TUNICS[k % TUNICS.length],
    shirt: MAIL,
    hose: 0x3a3026,
    mailArms: true,
    cloak: ROH_CLOAK[k % ROH_CLOAK.length],
    plume: PLUMES[k % PLUMES.length],
    shield: k % 2 === 0 ? GREEN : 0x5a2a1e,
    seed: 100 + k,
  };
}
const HENCH = [0x2a221a, 0x322a22, 0x241e1a, 0x3a3028];
// One of Wormtongue's men: dark leather, a hood (or not), a cudgel.
function henchLook(n) {
  return {
    tall: 1.48 + (n % 3) * 0.04,
    wide: 1.1 + (n % 2) * 0.12,
    skin: [0xd4a882, 0xc89a74, 0xdcb08c][n % 3],
    hair: [0x1e1814, 0x2e2218, 0x3a2a1c][n % 3],
    hairdo: n % 2 ? 'short' : null,
    hairStyle: 'none',
    beard: n % 3 === 1 ? null : { color: [0x1e1814, 0x2e2218, 0x3a2a1c][(n + 1) % 3], style: 'short', len: 0.06 + (n % 2) * 0.06 },
    brows: 0x1a1410,
    stern: 0.42,
    coat: HENCH[n % HENCH.length],
    shirt: 0x3a342c,
    hose: 0x2a241e,
    hood: n % 2 === 0 ? [0x5a4a38, 0x4e4636, 0x5e5040][n % 3] : null,
    cloak: n % 3 === 2 ? 0x221e1a : null,
    seed: 200 + n,
  };
}

// ── the horses ──

// The horse's barrel from tail to chest (../weathertop/props.js, Asfaloth's):
// x, the top line, the belly line, the half-width, its narrowing.
const HORSE = [
  [-1.0, 1.52, 1.4, 0.05, 1, 1],
  [-0.96, 1.62, 1.24, 0.15, 0.85, 0.8],
  [-0.86, 1.68, 1.12, 0.22, 0.85, 0.8],
  [-0.7, 1.71, 1.08, 0.255, 0.9, 0.8],
  [-0.5, 1.7, 1.07, 0.265, 0.85, 0.75],
  [-0.3, 1.66, 1.03, 0.275, 0.8, 0.8],
  [-0.1, 1.63, 0.99, 0.3, 0.8, 0.82],
  [0.1, 1.63, 0.97, 0.305, 0.78, 0.82],
  [0.3, 1.67, 0.98, 0.29, 0.7, 0.8],
  [0.5, 1.73, 1.02, 0.25, 0.5, 0.75],
  [0.66, 1.72, 1.07, 0.225, 0.5, 0.7],
  [0.8, 1.62, 1.12, 0.2, 0.6, 0.55],
  [0.9, 1.5, 1.16, 0.165, 0.7, 0.5],
  [0.97, 1.38, 1.22, 0.1, 0.8, 0.6],
  [1.0, 1.32, 1.26, 0.03, 1, 1],
];
function barrelAt(x, th, off = 0) {
  let i = 0;
  while (i < HORSE.length - 2 && HORSE[i + 1][0] < x) i++;
  const a = HORSE[i];
  const b = HORSE[i + 1];
  const t = clamp01((x - a[0]) / (b[0] - a[0]));
  const top = mix(a[1], b[1], t);
  const bot = mix(a[2], b[2], t);
  const w = mix(a[3], b[3], t);
  const sn = Math.sin(th);
  const cy = (top + bot) / 2;
  const h = (top - bot) / 2;
  const ww = w * (sn > 0 ? mix(1, mix(a[4], b[4], t), sn) : mix(1, mix(a[5], b[5], t), -sn));
  return V3(x, cy + sn * (h + off), Math.cos(th) * (ww + off));
}
// A patch of cloth or leather laid over the barrel between x0..x1 and
// round it th0..th1 (0 out to +z, π/2 on top), `off` proud of it, edged.
function barrelPatch(x0, x1, th0, th1, off, color, edge) {
  const I = 9;
  const J = 14;
  const pts = [];
  for (let i = 0; i <= I; i++) for (let j = 0; j <= J; j++) pts.push(barrelAt(mix(x0, x1, i / I), mix(th0, th1, j / J), off));
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const idx = [];
  for (let i = 0; i < I; i++) {
    for (let j = 0; j < J; j++) {
      const q = i * (J + 1) + j;
      idx.push(q, q + J + 1, q + 1, q + 1, q + J + 1, q + J + 2);
    }
  }
  g.setIndex(idx);
  const cl = new Float32Array(pts.length * 3);
  const g0 = C(color);
  const g1 = C(edge);
  pts.forEach((p, k) => {
    const i = Math.floor(k / (J + 1));
    const j = k % (J + 1);
    const e = i === 0 || i === I || j === 0 || j === J;
    const c = e ? g1 : g0;
    cl.set([c.r, c.g, c.b], k * 3);
  });
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  g.computeVertexNormals();
  return g;
}
// how Asfaloth's head hangs from the poll, and where the bit is in it
const HA = -1.05;
const BIT = [-1, 1].map((s) => V3(0.5, -0.045, s * 0.068).applyAxisAngle(V3(0, 0, 1), HA));

// The coats: bay, chestnut, grey, black, dun, dark bay (and Snowmane's white).
const COATS = [
  { coat: 0x5c2c12, points: 0x16100c, mane: 0x120e0c, hoof: 0x24201c },
  { coat: 0x8e4a1e, points: 0x6a3414, mane: 0x7a3a16, hoof: 0x3a3028 },
  { coat: 0x8e8c88, points: 0x4a4846, mane: 0xd0cec8, hoof: 0x3a3836 },
  { coat: 0x221c1a, points: 0x141010, mane: 0x0e0a08, hoof: 0x1a1816 },
  { coat: 0xae8a54, points: 0x221a12, mane: 0x18120e, hoof: 0x2a2420 },
  { coat: 0x4a2814, points: 0x100c0a, mane: 0x0c0a08, hoof: 0x1e1a18 },
];
const SNOW = { coat: 0xf6f6f4, points: 0xc8c8c6, mane: 0xf8f8f6, hoof: 0x5a585c };

// Hair in ribbons, each strand from its root, hanging along `hang` when
// still and streaming along `stream` in the wind (as Asfaloth's mane).
function ribbons(material, list, { segs = 6, colour = [C(0xffffff), C(0xffffff)], speed = 1 } = {}) {
  const n = list.length;
  const vpr = (segs + 1) * 2;
  const pos = new Float32Array(n * vpr * 3);
  const col = new Float32Array(n * vpr * 3);
  const nor = new Float32Array(n * vpr * 3);
  const idx = [];
  const c = new THREE.Color();
  list.forEach((s, i) => {
    for (let j = 0; j < segs; j++) {
      const a = i * vpr + j * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    for (let j = 0; j <= segs; j++) {
      c.copy(colour[0]).lerp(colour[1], j / segs).multiplyScalar(s.shade ?? 1);
      for (const e of [0, 1]) {
        col.set([c.r, c.g, c.b], (i * vpr + j * 2 + e) * 3);
        nor.set([s.normal.x, s.normal.y, s.normal.z], (i * vpr + j * 2 + e) * 3);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const p = V3();
  const dv = V3();
  const sv = V3();
  const flow = (t, k) => {
    list.forEach((s, i) => {
      p.copy(s.root);
      for (let j = 0; j <= segs; j++) {
        const u = j / segs;
        sv.copy(s.side).multiplyScalar((s.width * (1 - u * 0.75)) / 2);
        const o = (i * vpr + j * 2) * 3;
        pos[o] = p.x - sv.x;
        pos[o + 1] = p.y - sv.y;
        pos[o + 2] = p.z - sv.z;
        pos[o + 3] = p.x + sv.x;
        pos[o + 4] = p.y + sv.y;
        pos[o + 5] = p.z + sv.z;
        if (j === segs) break;
        dv.copy(s.hang).lerp(s.stream, clamp01(k * (0.45 + 0.75 * u)));
        const wave = Math.sin(t * (2.2 + 9 * k) * speed - u * 5.5 + s.phase) + 0.4 * Math.sin(t * (3.1 + 13 * k) * speed - u * 9 + s.phase * 2.3);
        dv.addScaledVector(s.flutter, wave * (0.05 + 0.32 * k) * (0.3 + u));
        dv.normalize();
        p.addScaledVector(dv, s.len / segs);
      }
    });
    geo.attributes.position.needsUpdate = true;
  };
  flow(0, 0);
  return { mesh, flow };
}

// A cloak from a rider's shoulders: a grid of cloth falling down the back
// and over the horse when still, streaming out behind in the wind.
function cloakSheet(material, { cols = 9, rows = 8, top = 0.6, half = 0.19, depth = 0.13, len = 0.95, color = 0xffffff, hem = 0xffffff, trim = null } = {}) {
  const N = (cols + 1) * (rows + 1);
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const idx = [];
  const c0 = C(color);
  const c1 = C(hem);
  const ct = trim != null ? C(trim) : null;
  const c = new THREE.Color();
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      c.copy(c0).lerp(c1, j / rows).multiplyScalar(0.92 + 0.08 * Math.cos((i / cols) * Math.PI * 3));
      if (ct && (j === rows || i === 0 || i === cols)) c.copy(ct);
      col.set([c.r, c.g, c.b], (j * (cols + 1) + i) * 3);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const flow = (t, k) => {
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        const a = mix(-1.45, 1.45, u);
        const sx = -0.03 - Math.cos(a) * depth;
        const sz = Math.sin(a) * half;
        let x = sx - v * len * 0.3 - v * v * len * 0.26;
        let y = top - v * len;
        let z = sz * (1 + v * 1.6);
        const wave = Math.sin(t * (3 + 10 * k) - v * 6 + u * 2.2) * 0.5 + Math.sin(t * (5 + 15 * k) - v * 10 + u * 4) * 0.25;
        x = mix(x, sx - v * len * 1.35, k);
        y = mix(y, top - v * len * 0.45 + wave * 0.14 * v * k * len, k);
        z = mix(z, sz * (1 + v * 1.5) + wave * 0.07 * v * k * len, k);
        y += Math.sin(t * 1.3 + u * 3) * 0.01 * v * (1 - k);
        pos.set([x, y, z], (j * (cols + 1) + i) * 3);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  flow(0, 0);
  return { mesh, flow };
}

// A Rider in the saddle, in the horse's proportions (not a toy's): legs
// astride in breeches and tall boots, mail and a leather jerkin, a belt,
// the left hand forward on the reins (a round shield on that arm), the
// right with a spear upright (or a banner, or nothing); the helm and its
// crest of horse-hair, streaming as he rides, and a cloak. Théoden (`king`)
// has a gilt helm, a green cloak bordered in gold, a sword at his hip, both
// hands on the reins. Sits at its origin, facing +x; `torso` is what the
// gallop leans.
function seatedRider(FM, W, o) {
  const g = new THREE.Group();
  g.name = 'rider';
  const { skin, hair, beard = null, tunic = 0x5a4028, cloak = GREEN, plume = 0xece6d6, king = false, spear = true, shield = true, seed = 1 } = o;
  const breeches = king ? 0x3a3024 : 0x3a3026;
  const boot = 0x2a1c12;
  const lk = parts();
  for (const s of [-1, 1]) {
    lk.add(FM.matte, tube([[0.0, 0.07, s * 0.1], [0.18, 0.0, s * 0.27], [0.32, -0.16, s * 0.34]], 0.088, 0.072, { seg: 6, radial: 8 }), { color: breeches });
    lk.add(FM.matte, tube([[0.32, -0.16, s * 0.34], [0.3, -0.36, s * 0.36], [0.24, -0.56, s * 0.35]], 0.07, 0.056, { seg: 5, radial: 8 }), { color: boot });
    lk.add(FM.matte, cyl(0.078, 0.07, 0.08, 9), { p: [0.315, -0.2, s * 0.345], r: [0, 0, -0.1], color: 0x3a2818 });
    lk.add(FM.matte, roundBox(0.21, 0.07, 0.085, 0.03), { p: [0.29, -0.6, s * 0.35], r: [0, 0, -0.32], color: boot });
  }
  lk.build(g);
  const pivot = new THREE.Group();
  pivot.name = 'torso';
  g.add(pivot);
  const torso = new THREE.Group();
  torso.rotation.z = 0.06;
  pivot.add(torso);
  const tk = parts();
  const mail = MAIL;
  // the mail coat to the thighs, split for riding, the jerkin over it
  tk.add(FM.metal, lathe([[0.001, 0.62], [0.13, 0.66], [0.2, 0.6], [0.205, 0.44], [0.19, 0.3], [0.2, 0.14], [0.22, 0.0], [0.26, -0.08], [0.28, -0.14]], 18), { s: [0.84, 1, 1.18], color: mail });
  const jerk = lathe([[0.15, 0.64], [0.21, 0.58], [0.214, 0.44], [0.2, 0.3], [0.208, 0.14], [0.226, 0.02], [0.24, -0.04]], 18);
  tk.add(FM.matte, jerk, { s: [0.85, 1, 1.2], color: tunic });
  if (king) {
    // the king's green, edged with gold
    tk.add(FM.metal, new THREE.TorusGeometry(0.235, 0.014, 4, 26), { p: [0, -0.04, 0], r: [Math.PI / 2, 0, 0], s: [0.85, 1.2, 1], color: GOLD });
    tk.add(FM.metal, tube([[0.14, 0.62, -0.08], [0.18, 0.4, -0.05], [0.18, 0.1, -0.03]], 0.012, 0.012, { seg: 6, radial: 4 }), { color: GOLD });
    tk.add(FM.metal, tube([[0.14, 0.62, 0.08], [0.18, 0.4, 0.05], [0.18, 0.1, 0.03]], 0.012, 0.012, { seg: 6, radial: 4 }), { color: GOLD });
  }
  tk.add(FM.matte, new THREE.TorusGeometry(0.205, 0.024, 5, 24), { p: [0, 0.2, 0], r: [Math.PI / 2, 0, 0], s: [0.86, 1.18, 1], color: DARK });
  tk.add(FM.metal, roundBox(0.03, 0.06, 0.07, 0.01), { p: [0.18, 0.2, 0], color: GOLD });
  // shoulder plates
  for (const s of [-1, 1]) tk.add(FM.metal, new THREE.SphereGeometry(0.1, 12, 6, 0, TAU, 0, Math.PI / 2), { p: [0.0, 0.6, s * 0.2], r: [s * 0.4, 0, 0], s: [1.1, 0.8, 1], color: king ? GOLD : STEEL });
  tk.add(FM.matte, cyl(0.048, 0.055, 0.12, 10), { p: [0.01, 0.73, 0], color: skin });
  // a mail collar from the helm to the shoulders
  tk.add(FM.metal, cyl(0.07, 0.15, 0.14, 14, true), { p: [0.0, 0.7, 0], s: [0.9, 1, 1.1], color: mail });
  // the left arm forward to the reins
  const handL = V3(0.45, 0.24, -0.1);
  tk.add(FM.metal, tube([[0.0, 0.6, -0.2], [0.08, 0.42, -0.26], [0.26, 0.3, -0.21], [0.42, 0.25, -0.12]], 0.064, 0.048, { seg: 8, radial: 8 }), { color: mail });
  tk.add(FM.matte, tube([[0.25, 0.305, -0.215], [0.41, 0.252, -0.125]], 0.06, 0.054, { seg: 3, radial: 8 }), { color: LEATHER });
  tk.add(FM.matte, ball(0.04, 8, 6), { p: [handL.x, handL.y, handL.z], s: [1.3, 0.9, 1], color: skin });
  // the right: on the spear, or the reins too
  const handR = king ? V3(0.45, 0.24, 0.1) : V3(0.24, 0.34, 0.34);
  if (king) {
    tk.add(FM.metal, tube([[0.0, 0.6, 0.2], [0.08, 0.42, 0.26], [0.26, 0.3, 0.21], [0.42, 0.25, 0.12]], 0.064, 0.048, { seg: 8, radial: 8 }), { color: mail });
    tk.add(FM.matte, tube([[0.25, 0.305, 0.215], [0.41, 0.252, 0.125]], 0.06, 0.054, { seg: 3, radial: 8 }), { color: LEATHER });
  } else {
    tk.add(FM.metal, tube([[0.0, 0.6, 0.2], [0.07, 0.42, 0.29], [0.21, 0.33, 0.33]], 0.064, 0.052, { seg: 6, radial: 8 }), { color: mail });
    tk.add(FM.matte, tube([[0.1, 0.39, 0.3], [0.21, 0.335, 0.33]], 0.06, 0.056, { seg: 2, radial: 8 }), { color: LEATHER });
  }
  tk.add(FM.matte, ball(0.042, 8, 6), { p: [handR.x, handR.y, handR.z + (king ? 0 : 0.01)], color: skin });
  if (spear === true) {
    tk.add(FM.matte, cyl(0.02, 0.022, 2.9, 7), { p: [0.26, 0.85, 0.35], color: 0x4a3424 });
    tk.add(FM.metal, lathe([[0.001, 0], [0.04, 0.06], [0.05, 0.15], [0.034, 0.26], [0.001, 0.38]], 7), { p: [0.26, 2.3, 0.35], s: [0.35, 1, 1], color: 0xe2e6ec });
    tk.add(FM.metal, cyl(0.03, 0.028, 0.08, 7), { p: [0.26, 2.29, 0.35], color: GOLD });
  }
  if (king) {
    // Herugrim at his left hip
    tk.add(FM.matte, tube([[0.12, 0.14, -0.26], [-0.1, -0.06, -0.3], [-0.42, -0.3, -0.31]], 0.03, 0.024, { seg: 8, radial: 6 }), { color: 0x2a201a });
    tk.add(FM.metal, tube([[0.22, 0.12, -0.26], [0.13, 0.14, -0.26]], 0.016, 0.016, { seg: 1, radial: 5 }), { color: GOLD });
    tk.add(FM.metal, tube([[0.17, 0.06, -0.26], [0.17, 0.22, -0.26]], 0.014, 0.014, { seg: 1, radial: 5 }), { color: GOLD });
    tk.add(FM.metal, ball(0.026, 8, 6), { p: [0.24, 0.12, -0.26], color: GOLD });
  }
  if (shield) {
    const sg = shieldGeos(0.3, { field: o.shieldField ?? GREEN });
    const so = { r: [Math.PI / 2, 0, 0], p: [0.3, 0.3, -0.31] };
    tk.add(FM.matte, tf(sg.face, so));
    tk.add(FM.metal, tf(sg.rim, so), { color: GOLD });
    tk.add(FM.metal, tf(sg.boss, { r: [-Math.PI / 2, 0, 0], p: [0.3, 0.3, -0.325] }), { color: GOLD });
  }
  tk.build(torso);
  // the head: in proportion, with the helm and its crest
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0.04, 0.88, 0);
  torso.add(head);
  const hk = parts();
  hk.add(FM.matte, ball(0.12, 18, 14), { s: [1, 1.1, 0.92], color: skin });
  hk.add(FM.matte, new THREE.ConeGeometry(0.024, 0.07, 6), { p: [0.13, -0.005, 0], r: [0, 0, -Math.PI / 2 - 0.25], color: skin });
  for (const s of [-1, 1]) {
    hk.add(FM.matte, ball(0.013, 8, 6), { p: [0.108, 0.03, s * 0.042], s: [0.7, 0.8, 1.1], color: 0x1a1410 });
    hk.add(FM.matte, roundBox(0.035, 0.022, 0.06, 0.008), { p: [0.112, 0.06, s * 0.046], r: [-s * 0.18, 0, 0.1], color: hair });
  }
  // hair at the nape, below the helm
  hk.add(FM.matte, new THREE.CylinderGeometry(0.115, 0.13, 0.2, 14, 1, false, 1.5 * Math.PI - 1.3, 2.6), { p: [-0.02, -0.12, 0], color: hair });
  if (beard) {
    hk.add(FM.matte, new THREE.SphereGeometry(0.125, 16, 6, Math.PI - 1.05, 2.1, 0.56 * Math.PI, 0.34 * Math.PI), { s: [1, 1.1, 0.94], color: beard });
    hk.add(FM.matte, ball(0.05, 10, 8), { p: [0.085, -0.115, 0], s: [0.8, king ? 1.3 : 1.7, 1.3], color: beard });
    for (const s of [-1, 1]) hk.add(FM.matte, tube([[0.122, -0.04, 0], [0.118, -0.05, s * 0.03], [0.1, -0.075, s * 0.05]], 0.011, 0.007, { seg: 4, radial: 5 }), { color: beard });
  }
  // the helm
  const k = 0.128 / 0.29;
  const hm = (geo, color, mat = FM.metal) => hk.add(mat, tf(geo, { s: k }), { color });
  const steel = king ? 0xc8ccd2 : STEEL;
  hm(lathe(ROHAN_BOWL, 22), steel);
  hm(tf(new THREE.TorusGeometry(0.332, 0.03, 6, 30), { r: [Math.PI / 2, 0, 0], p: [0, 0.07, 0] }), GOLD);
  hm(tube([[0.31, 0.12, 0], [0.27, 0.38, 0], [0.16, 0.58, 0], [0.0, 0.68, 0], [-0.16, 0.6, 0], [-0.28, 0.42, 0], [-0.34, 0.18, 0]], 0.036, 0.028, { seg: 14, radial: 5 }), GOLD);
  for (const s of [-1, 1]) {
    const mid = s > 0 ? 0.3 : Math.PI - 0.3;
    hm(tf(new THREE.CylinderGeometry(0.338, 0.31, 0.34, 8, 1, true, mid - 0.42, 0.84), { p: [0, -0.1, 0] }), king ? GOLD : steel);
  }
  hm(tf(new THREE.CylinderGeometry(0.33, 0.42, 0.26, 12, 1, true, 1.5 * Math.PI - 1.25, 2.5), { p: [0, -0.06, 0] }), steel);
  hm(tf(roundBox(0.03, 0.22, 0.05, 0.01), { p: [0.335, -0.02, 0] }), steel);
  if (king) {
    hm(tf(roundBox(0.06, 0.1, 0.16, 0.02), { p: [0.31, 0.2, 0], r: [0, 0, -0.35] }), GOLD);
    hm(tf(new THREE.ConeGeometry(0.035, 0.16, 6), { p: [0.26, 0.33, 0], r: [0, 0, -0.5] }), GOLD);
  }
  hk.build(head);
  // the crest, streaming as he rides
  const n = makeNoise(seed);
  const roots = [];
  for (let i = 0; i < 9; i++) {
    const z = (i - 4) * 0.009;
    roots.push({
      root: V3(-0.02, 0.29, z),
      hang: V3(-0.55, -1, z * 4).normalize(),
      stream: V3(-1, 0.05, z * 3).normalize(),
      flutter: V3(0, 0.8, 0.6).normalize(),
      side: V3(0, 0, 1),
      normal: V3(0, 1, 0),
      len: (king ? 0.6 : 0.46) + n(i, 3) * 0.1,
      width: 0.04,
      phase: i * 0.9,
      shade: 0.88 + n(i, 5) * 0.2,
    });
  }
  const pc = C(plume);
  const crest = ribbons(W.mats.hair, roots, { segs: 6, colour: [pc.clone().multiplyScalar(0.9), pc] });
  head.add(crest.mesh);
  // the cloak
  const cc = C(cloak);
  const cl = cloakSheet(FM.cloth, { top: 0.64, half: 0.22, depth: 0.15, len: 1.08, color: cc, hem: cc.clone().multiplyScalar(0.72), trim: king ? GOLD : null });
  torso.add(cl.mesh);
  return { group: g, torso: pivot, head, crest, cloak: cl, handL, handR, king };
}

// ── the host of Rohan, for instancing ──

// One mounted Rider, very cheap: a horse and its rider and his spear and
// shield in a few hundred flat-shaded triangles, all one mesh, its colours
// in its vertices. Each vertex carries aRig: x > 0.5 for a leg (x - 1 its
// place in the stride), y, z the leg's pivot, w what paints it per rider (1
// the coat, 2 the cloak and saddle-cloth, 3 mane, tail and points, 4 the
// crest) so the host isn't all one horse. The material gallops the legs and
// rocks the body by uniforms (uTime, uRide), each rider out of step with
// the next (hashed from where its instance stands).
const RIG_HEAD = /* glsl */ `
uniform float uTime;
uniform float uRide;
uniform vec3 uCoat[6];
uniform vec3 uMane[6];
uniform vec3 uCloak[5];
uniform vec3 uPlume[5];
attribute vec4 aRig;
float hostSeed() {
#ifdef USE_INSTANCING
  return fract(sin(dot(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), vec2(12.9898, 78.233))) * 43758.5453);
#else
  return 0.37;
#endif
}
vec2 hostTurn(vec2 p, vec2 c, float a) {
  vec2 q = p - c;
  float cs = cos(a);
  float sn = sin(a);
  return c + vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);
}
`;
const RIG_MOVE = /* glsl */ `
{
  float seed = hostSeed();
  float cyc = uTime * (1.5 + 0.75 * min(uRide, 1.7)) + seed * 7.0;
  float ride = smoothstep(0.0, 0.35, uRide);
  if (aRig.x > 0.5) {
    float off = aRig.x - 1.0;
    transformed.xy = hostTurn(transformed.xy, aRig.yz, ride * 0.62 * sin((cyc + off) * 6.2831853));
  }
  transformed.xy = hostTurn(transformed.xy, vec2(0.0, 1.3), ride * 0.07 * sin((cyc + 0.2) * 6.2831853));
  transformed.y += ride * (abs(sin((cyc + 0.1) * 3.14159265)) * 0.14 - 0.05);
}
`;
const RIG_PAINT = /* glsl */ `
{
  float seed = hostSeed();
  int p = int(aRig.w + 0.5);
  int c = int(fract(seed * 7.31) * 5.999);
  if (p == 1) vColor.xyz *= uCoat[c];
  else if (p == 3) vColor.xyz *= uMane[c];
  else if (p == 2) vColor.xyz *= uCloak[int(fract(seed * 3.71) * 4.999)];
  else if (p == 4) vColor.xyz *= uPlume[int(fract(seed * 11.3) * 4.999)];
}
`;
function hostMaterial(uniforms) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + RIG_HEAD)
      .replace('#include <color_vertex>', '#include <color_vertex>\n' + RIG_PAINT)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + RIG_MOVE);
  };
  m.customProgramCacheKey = () => 'edoras-host';
  return m;
}
// The banner's cloth waves (aRig.y how far out from the pole); with `bob`,
// it rocks and rises with its rider, as the host does.
function bannerMaterial(uniforms, bob) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + RIG_HEAD).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
{
  float u = aRig.y;
  float seed = hostSeed();
  float w = 0.35 + 0.65 * smoothstep(0.0, 0.6, uRide);
  transformed.z += sin(uTime * (3.2 + 2.5 * w) - u * 4.0 + seed * 6.0) * 0.16 * u * w;
  transformed.y += sin(uTime * 2.1 - u * 3.0 + seed * 3.0) * 0.05 * u * w;
  transformed.x += (cos(uTime * 3.0 - u * 4.0) * 0.04 - 0.03) * u * w;
}
${bob ? RIG_MOVE : ''}`,
    );
  };
  m.customProgramCacheKey = () => (bob ? 'edoras-banner-bob' : 'edoras-banner');
  return m;
}

// geometry for the host, a piece at a time, with its rig
function rigged(geo, color, rig = [0, 0, 0, 0]) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.computeVertexNormals();
  if (typeof color === 'function' || color != null) fillColor(g, color);
  const n = g.attributes.position.count;
  const r = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) r.set(rig, i * 4);
  g.setAttribute('aRig', new THREE.BufferAttribute(r, 4));
  return g;
}
// a cylinder from a to b (in the x-y plane), `seg` sided
function strut(a, b, r0, r1, seg = 4) {
  const A = V3(...a);
  const Bv = V3(...b);
  const D = Bv.clone().sub(A);
  const g = new THREE.CylinderGeometry(r1, r0, D.length(), seg, 1, false);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), D.normalize()));
  return g.translate((A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2);
}
const HAND = V3(0.16, 2.02, 0.34);
function hostGeo() {
  const L = [];
  const shade = (k) => (x, y, z, out) => out.setScalar(k * (y < 1.2 ? 0.82 : 1));
  // the horse: barrel, neck, head and ears, mane and tail
  L.push(rigged(new THREE.SphereGeometry(1, 8, 5).scale(0.94, 0.33, 0.27).translate(-0.02, 1.33, 0), shade(1), [0, 0, 0, 1]));
  L.push(rigged(strut([0.6, 1.45, 0], [1.0, 2.02, 0], 0.23, 0.12, 5), 0xffffff, [0, 0, 0, 1]));
  L.push(rigged(strut([1.0, 2.1, 0], [1.42, 1.68, 0], 0.115, 0.07, 5).scale(1, 1, 0.8), (x, y, z, out) => out.setScalar(x > 1.3 ? 0.55 : 1), [0, 0, 0, 1]));
  for (const s of [-1, 1]) L.push(rigged(new THREE.ConeGeometry(0.035, 0.15, 3).rotateZ(0.45).translate(0.97, 2.2, s * 0.05), 0xffffff, [0, 0, 0, 1]));
  L.push(rigged(strut([0.54, 1.66, 0], [0.99, 2.17, 0], 0.05, 0.035, 3), 0xffffff, [0, 0, 0, 3]));
  L.push(rigged(strut([-0.93, 1.5, 0], [-1.18, 0.72, 0], 0.07, 0.12, 4), 0xffffff, [0, 0, 0, 3]));
  // the legs, each swinging from its shoulder or hip; the hooves dark
  for (const [x, z, off] of [[0.62, 0.13, 0.0], [0.62, -0.13, 0.1], [-0.6, 0.14, 0.45], [-0.6, -0.14, 0.55]]) {
    const top = x > 0 ? 1.3 : 1.36;
    L.push(rigged(strut([x, top, z], [x + 0.02, 0.6, z], x > 0 ? 0.1 : 0.13, 0.06, 4), 0xffffff, [1 + off, x, top, 1]));
    L.push(rigged(strut([x + 0.02, 0.64, z], [x + 0.04, 0.0, z], 0.05, 0.062, 3), (px, py, pz, out) => out.setScalar(py < 0.2 ? 0.3 : 1), [1 + off, x, top, 3]));
  }
  // saddle-cloth and saddle
  L.push(rigged(new THREE.BoxGeometry(0.66, 0.36, 0.62).translate(-0.1, 1.5, 0), 0xc8c0a8, [0, 0, 0, 2]));
  L.push(rigged(new THREE.BoxGeometry(0.5, 0.08, 0.36).translate(-0.12, 1.69, 0), 0x3a2618));
  // the rider: legs astride, his mail and jerkin, arms, head and helm and crest
  for (const s of [-1, 1]) {
    L.push(rigged(strut([-0.12, 1.78, s * 0.12], [0.18, 1.6, s * 0.33], 0.08, 0.07, 3), 0x3a3026));
    L.push(rigged(strut([0.18, 1.6, s * 0.33], [0.12, 1.12, s * 0.34], 0.065, 0.055, 3), 0x24180e));
  }
  L.push(rigged(new THREE.CylinderGeometry(0.15, 0.19, 0.62, 6).scale(0.86, 1, 1.15).translate(-0.1, 2.08, 0), (x, y, z, out) => out.set(y > 2.3 ? MAIL : 0x5a4028)));
  L.push(rigged(new THREE.CylinderGeometry(0.21, 0.25, 0.16, 6, 1, true).scale(0.86, 1, 1.2).translate(-0.12, 1.78, 0), MAIL));
  L.push(rigged(strut([-0.12, 2.34, -0.18], [0.2, 2.0, -0.14], 0.05, 0.045, 3), MAIL));
  L.push(rigged(strut([-0.12, 2.34, 0.18], [0.14, 2.04, 0.32], 0.05, 0.045, 3), MAIL));
  L.push(rigged(new THREE.SphereGeometry(0.115, 6, 4).translate(-0.07, 2.56, 0), 0xe2b48c));
  L.push(rigged(new THREE.ConeGeometry(0.135, 0.24, 6).translate(-0.08, 2.72, 0), STEEL));
  L.push(rigged(strut([-0.08, 2.82, 0], [-0.42, 2.38, 0], 0.035, 0.07, 3), 0xffffff, [0, 0, 0, 4]));
  // the cloak, behind
  {
    const cl = new THREE.PlaneGeometry(0.46, 0.95, 1, 2);
    cl.rotateY(Math.PI / 2).rotateZ(-0.42).translate(-0.42, 1.95, 0);
    const p = cl.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (1 + (2.3 - p.getY(i)) * 0.6));
    L.push(rigged(cl, 0xc8c0a8, [0, 0, 0, 2]));
  }
  // spear, and shield on the left arm: green within a gilt rim, a gilt boss
  L.push(rigged(strut([HAND.x + 0.02, 0.95, HAND.z], [HAND.x + 0.06, 3.9, HAND.z], 0.02, 0.02, 3), 0x4a3424));
  L.push(rigged(new THREE.ConeGeometry(0.04, 0.32, 3).translate(HAND.x + 0.06, 4.05, HAND.z), 0xe2e6ec));
  L.push(rigged(new THREE.RingGeometry(0.235, 0.29, 8).translate(0.12, 1.95, -0.37), GOLD));
  L.push(rigged(new THREE.CircleGeometry(0.29, 8).translate(0.12, 1.95, -0.36), GREEN));
  L.push(rigged(new THREE.ConeGeometry(0.06, 0.07, 4).rotateX(-Math.PI / 2).translate(0.12, 1.95, -0.39), GOLD));
  const geo = mergeGeometries(L);
  geo.computeBoundingSphere();
  return geo;
}
// A banner of Rohan on its pole: green, a white horse running on it; the
// pole's grip at the origin (or at `at`).
function horseShape() {
  const pts = [[0.5, 0.1], [0.47, 0.17], [0.36, 0.3], [0.33, 0.38], [0.29, 0.33], [0.24, 0.31], [0.17, 0.27], [0.1, 0.2], [0.03, 0.12], [-0.18, 0.1], [-0.32, 0.13], [-0.42, 0.16], [-0.55, 0.27], [-0.59, 0.21], [-0.48, 0.1], [-0.4, 0.04], [-0.42, -0.05], [-0.52, -0.18], [-0.62, -0.3], [-0.57, -0.33], [-0.44, -0.2], [-0.34, -0.1], [-0.26, -0.16], [-0.18, -0.3], [-0.13, -0.29], [-0.18, -0.12], [-0.12, -0.07], [0.1, -0.06], [0.16, -0.14], [0.32, -0.2], [0.42, -0.16], [0.4, -0.12], [0.27, -0.1], [0.2, -0.04], [0.24, 0.02], [0.3, 0.08], [0.4, 0.03], [0.47, 0.02], [0.51, 0.06]];
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
}
function bannerGeo(at = V3()) {
  const L = [];
  const H = 3.6;
  L.push(rigged(new THREE.CylinderGeometry(0.025, 0.03, H, 5).translate(0, H / 2 - 1.0, 0), 0x4a3424));
  L.push(rigged(new THREE.ConeGeometry(0.05, 0.22, 5).translate(0, H - 1.0 + 0.1, 0), GOLD));
  L.push(rigged(new THREE.CylinderGeometry(0.02, 0.02, 1.25, 4).rotateZ(Math.PI / 2).translate(-0.6, H - 1.12, 0), 0x4a3424));
  // the cloth: hung from the cross-bar, swallow-tailed
  const W = 1.2;
  const Hc = 1.5;
  // the grid: even inside, with a row and a column just in from each edge
  // so the gilt border stays a border
  const US = [0, 0.04, 0.16, 0.3, 0.44, 0.58, 0.72, 0.86, 0.96, 1];
  const VS = [0, 0.035, 0.2, 0.38, 0.56, 0.74, 0.9, 0.965, 1];
  const cols = US.length - 1;
  const rows = VS.length - 1;
  const pos = [];
  const col = [];
  const rig = [];
  const idx = [];
  const g0 = C(0x2a5a2c);
  const g1 = C(0x1e4422);
  const gold = C(GOLD);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const u = US[i];
      const v = VS[j];
      let y = H - 1.14 - v * Hc;
      // the swallow-tail: the middle of the hem cut up
      y += Math.max(0, 0.35 - Math.abs(u - 0.5) * 1.4) * 0.9 * v * v;
      pos.push(-u * W - 0.02, y, 0);
      const c = g0.clone().lerp(g1, v);
      if (j === 0 || i === 0 || i === cols || j === rows) c.copy(gold);
      col.push(c.r, c.g, c.b);
      rig.push(0, Math.min(1, u * 0.7 + v * 0.5), 0, 0);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cloth.setIndex(idx);
  const cn = cloth.toNonIndexed();
  const ci = idx;
  const ccol = new Float32Array(ci.length * 3);
  const crig = new Float32Array(ci.length * 4);
  ci.forEach((k, i) => {
    ccol.set(col.slice(k * 3, k * 3 + 3), i * 3);
    crig.set(rig.slice(k * 4, k * 4 + 4), i * 4);
  });
  cn.setAttribute('color', new THREE.BufferAttribute(ccol, 3));
  cn.setAttribute('aRig', new THREE.BufferAttribute(crig, 4));
  cn.computeVertexNormals();
  L.push(cn);
  // the white horse, on both faces, a hair proud of the cloth
  for (const s of [-1, 1]) {
    const hg = new THREE.ShapeGeometry(horseShape(), 3);
    hg.scale(1.02, 1.02, 1);
    if (s < 0) hg.scale(1, 1, -1);
    hg.translate(-W * 0.5, H - 1.14 - Hc * 0.46, s * 0.012);
    const g = rigged(hg, 0xf4f2ea);
    const p = g.attributes.position;
    const r = g.attributes.aRig;
    for (let i = 0; i < p.count; i++) r.setY(i, Math.min(1, (-p.getX(i) / W) * 0.7 + ((H - 1.14 - p.getY(i)) / Hc) * 0.5));
    L.push(g);
  }
  const geo = mergeGeometries(L);
  geo.translate(at.x, at.y, at.z);
  geo.computeBoundingSphere();
  return geo;
}

// ── the feast, and the barrows ──

// A wooden tankard, foaming over: staves bound with iron, a handle on its
// -x side; its middle at the origin, upright.
function tankardGeo() {
  const L = [];
  const R = 0.075;
  const H = 0.19;
  const wood = C(0x8a5a30);
  const dark = C(0x5a3a1e);
  const body = lathe([[0.001, -H / 2], [R * 0.98, -H / 2], [R, -H / 2 + 0.01], [R * 0.93, H / 2 - 0.005], [R * 0.9, H / 2], [R * 0.8, H / 2 - 0.004]], 18);
  fillColor(body, (x, y, z, out) => {
    const a = Math.atan2(z, x);
    out.copy(wood).lerp(dark, (Math.cos(a * 9) * 0.5 + 0.5) ** 6 * 0.6 + smooth(0, 0.2, -y - H / 2 + 0.02) * 0.3);
  });
  L.push(baked(body));
  for (const y of [-H * 0.32, H * 0.3]) L.push(baked(tf(new THREE.TorusGeometry(R * (y > 0 ? 0.94 : 0.995) + 0.004, 0.007, 4, 22), { r: [Math.PI / 2, 0, 0], p: [0, y, 0] }), 0x3a3836));
  L.push(baked(tube([[-R * 0.9, H * 0.3, 0], [-R - 0.05, H * 0.28, 0], [-R - 0.058, 0, 0], [-R - 0.045, -H * 0.3, 0], [-R * 0.95, -H * 0.32, 0]], 0.012, 0.012, { seg: 10, radial: 5 }), dark));
  // the foam, heaped and running over
  const foam = new THREE.IcosahedronGeometry(1, 2);
  const n = makeNoise(4);
  const p = foam.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + (n(x * 3 + 2, z * 3 + y) - 0.5) * 0.35;
    p.setXYZ(i, x * R * 0.98 * k, H / 2 + Math.max(-0.3, y) * 0.045 * k, z * R * 0.98 * k);
  }
  foam.computeVertexNormals();
  L.push(baked(foam, (x, y, z, out) => out.setHex(0xf8f2e2).lerp(C(0xe8d8b0), smooth(H / 2 + 0.02, H / 2 - 0.01, y))));
  for (const a of [0.6, 2.4, 4.1]) L.push(baked(tf(new THREE.CapsuleGeometry(0.008, 0.022, 3, 6), { p: [Math.cos(a) * R * 0.95, H / 2 - 0.018, Math.sin(a) * R * 0.95] }), 0xf4ecd8));
  return mergeGeometries(L);
}
// A plate with bread and meat, for the table.
function plateGeo() {
  const L = [];
  L.push(baked(lathe([[0.001, 0], [0.13, 0], [0.155, 0.02], [0.16, 0.026], [0.14, 0.012], [0.001, 0.012]], 20), 0xa89070));
  L.push(baked(tf(ball(0.06, 10, 8), { p: [0.03, 0.04, 0.02], s: [1.3, 0.7, 1] }), 0xb8823e));
  L.push(baked(tf(ball(0.05, 10, 8), { p: [-0.05, 0.035, -0.03], s: [1.4, 0.6, 1] }), 0x7a3a22));
  L.push(baked(tf(cyl(0.008, 0.008, 0.12, 5), { p: [-0.05, 0.05, -0.03], r: [0, 0, 1.3] }), 0xe8e0d0));
  return mergeGeometries(L);
}
// A bunch of simbelmynë: little white bell-flowers, six-petalled, on thin
// green stems, a grass tie round them; the tie at the origin, the flowers
// up and out.
function flowerGeo() {
  const L = [];
  const r = rng(17);
  const stem = C(0x4a7a34);
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU;
    const out = 0.02 + r() * 0.06;
    const top = V3(Math.cos(a) * out, 0.14 + r() * 0.08, Math.sin(a) * out);
    L.push(baked(tube([[0, -0.08, 0], [0, 0.0, 0], [top.x * 0.6, top.y * 0.7, top.z * 0.6], top], 0.005, 0.004, { seg: 5, radial: 4 }), stem));
    // the bell: six white petals round a pale green heart, turned out and down a little
    const tilt = 0.5 + r() * 0.5;
    const m = new THREE.Matrix4().compose(top, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt)), V3(1, 1, 1));
    for (let k = 0; k < 6; k++) {
      const pa = (k / 6) * TAU + r();
      const petal = new THREE.SphereGeometry(0.018, 6, 4);
      petal.scale(1.6, 0.35, 0.8).translate(0.022, 0.006, 0);
      petal.rotateZ(0.5).rotateY(pa);
      L.push(baked(petal.applyMatrix4(m), 0xfbfbf8));
    }
    L.push(baked(ball(0.008, 6, 4).applyMatrix4(m), 0xd8e8a0));
    for (let k = 0; k < 2; k++) {
      const leaf = new THREE.ConeGeometry(0.008, 0.09, 3).scale(1, 1, 0.3);
      const la = a + (k ? 2 : -2);
      L.push(baked(tf(leaf, { p: [Math.cos(la) * 0.02, 0.02 + k * 0.03, Math.sin(la) * 0.02], r: [Math.sin(la) * 0.5, 0, -Math.cos(la) * 0.5] }), 0x5a8a3c));
    }
  }
  L.push(baked(tf(new THREE.TorusGeometry(0.022, 0.008, 4, 12), { r: [Math.PI / 2, 0, 0] }), 0x8a9a4a));
  return mergeGeometries(L);
}

// ── the kit ──

export function createEdorasFolk(renderer, { tier = 'high' } = {}) {
  const low = tier === 'low';
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const uniforms = {
    uTime: { value: 0 },
    uRide: { value: 0 },
    uCoat: { value: COATS.map((c) => C(c.coat)) },
    uMane: { value: COATS.map((c) => C(c.mane)) },
    uCloak: { value: ROH_CLOAK.map((c) => C(c).multiplyScalar(1.15)) },
    uPlume: { value: PLUMES.map((c) => C(c)) },
  };
  const mats = {
    // the people's four materials (and the riders', and the tack's)
    fig: M({ vertexColors: true, roughness: 0.8 }),
    figMetal: M({ vertexColors: true, roughness: 0.34, metalness: 0.6 }),
    figCloth: M({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide }),
    figGlow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    // the host and its banners
    host: hostMaterial(uniforms),
    banner: bannerMaterial(uniforms, true),
    flag: bannerMaterial(uniforms, false),
  };
  mats.host.userData.uniforms = uniforms;
  const FM = { matte: mats.fig, metal: mats.figMetal, cloth: mats.figCloth, glow: mats.figGlow };

  // the horses need Asfaloth's kit: made when the first is wanted
  let W = null;
  const wt = () => (W ??= createWeathertopKit(renderer));

  // ── people ──
  const person = (id, opts = {}) => {
    const n = opts.n ?? 0;
    if (id === 'gimli') {
      const axe = opts.axe ?? true;
      return figure(LOOKS.gimli, FM, axe ? 'gimli' : 'gimli-bare', (add, f, d, T) => {
        garment(add, T, d, { color: MAIL, cls: 'metal', hem: 0.66 });
        const jerk = garment(add, T, d, { color: 0x5a3420, hem: 0.3, grow: 1.05, top: 0.93 });
        // the jerkin's front laced, studded down its edges
        for (let i = 0; i < 5; i++) {
          const y = mix(0.82, 0.24, i / 4) * d.bodyH;
          for (const s of [-1, 1]) add(T, ball(0.014, 5, 4), 0xd0b060, 'metal', { p: [radiusAt(jerk, y) + 0.004, y, s * 0.05] });
        }
        beltOn(add, T, d, jerk, { at: 0.16, color: 0x2a1a10, thick: 0.034, big: 1.5 });
        add(T, roundBox(0.03, 0.09, 0.13, 0.012), BRASS, 'metal', { p: [radiusAt(jerk, 0.16 * d.bodyH) + 0.03, 0.16 * d.bodyH, 0] });
        pauldronsOn(add, f, 0x4a2c18, 'matte');
        for (const [i, s] of [[0, -1], [1, 1]]) for (let k = 0; k < 3; k++) add(f.arms[i], ball(0.014, 5, 4), 0xd0b060, 'metal', { p: [0.06 - k * 0.05, 0.06, s * 0.06] });
        bracersOn(add, f, d, 0x3e2414, BRASS);
        bootsOn(add, f, d, 0x3a2414);
        dwarfBeard(add, f.head, 0x8c3414);
        dwarfHelm(add, f.head);
        if (axe) {
          const ax = axeGeos(0.92);
          if (axe === 'hand') {
            const y = -d.armLen - 0.02;
            const o = { p: [0.05, y - 0.38, 0], r: [0, 0, 0] };
            for (const g of ax.wood) add(f.arms[1], tf(g, o), 0x6a4a2a, 'matte');
            for (const g of ax.steel) add(f.arms[1], tf(g, o), 0xc8ccd2, 'metal');
            for (const g of ax.brass) add(f.arms[1], tf(g, o), BRASS, 'metal');
          } else {
            // slung across his back, its head over his right shoulder
            const o = { r: [0.95, 0, 0], p: [-(0.27 * d.wide + 0.06), -0.06, -0.4] };
            for (const g of ax.wood) add(T, tf(g, o), 0x6a4a2a, 'matte');
            for (const g of ax.steel) add(T, tf(g, o), 0xc8ccd2, 'metal');
            for (const g of ax.brass) add(T, tf(g, o), BRASS, 'metal');
          }
        }
      });
    }
    if (id === 'legolas') {
      return figure(LOOKS.legolas, FM, id, (add, f, d, T) => {
        const prof = garment(add, T, d, { color: 0x5e6a48, hem: 0.42, grow: 1.0, top: 0.97 });
        beltOn(add, T, d, prof, { at: 0.16, color: 0x4a3a28, buckle: 0xc8ccd4 });
        add(T, tube([[0.18, 0.96 * d.bodyH, -0.1], [0.24, 0.6 * d.bodyH, 0.02], [0.24, 0.24 * d.bodyH, 0.1]], 0.014, 0.014, { seg: 6, radial: 4 }), 0x4a3a28, 'matte');
        bracersOn(add, f, d, 0x5a4630);
        bootsOn(add, f, d, 0x4a3a2a);
        bowOnBack(add, T, d);
        // two long knives at the back of his belt
        for (const s of [-1, 1]) add(T, roundBox(0.03, 0.24, 0.05, 0.01), 0x8a6a40, 'matte', { p: [-0.26 * d.wide, 0.06, s * 0.08], r: [s * 0.3, 0, 0] });
      });
    }
    if (id === 'aragorn') {
      return figure(LOOKS.aragorn, FM, id, (add, f, d, T) => {
        const prof = garment(add, T, d, { color: 0x3a3026, hem: 0.82, grow: 1.02, flare: 0.04 });
        add(T, tube([[0.17, 0.96 * d.bodyH, -0.12], [0.23, 0.6 * d.bodyH, -0.03], [0.26, 0.1 * d.bodyH, 0.0], [0.3, -0.5 * d.legLen, 0.01]], 0.014, 0.014, { seg: 8, radial: 4 }), 0x2a2018, 'matte');
        beltOn(add, T, d, prof, { at: 0.12, color: 0x241a12, buckle: 0x9a9ca0 });
        cloakOn(add, T, d, { color: 0x30382a, hem: 0.9, clasp: 0x9a9ca0 });
        bracersOn(add, f, d, 0x2a1e16);
        bootsOn(add, f, d, 0x2a2018);
        swordAtHip(add, T, d);
      });
    }
    if (id === 'gandalf') {
      return figure(LOOKS.gandalf, FM, id, (add, f, d, T) => {
        robeOn(add, T, d, { color: 0xf3f1ec, waist: 0.21, belt: 0xd8d6d0, at: 0.3 });
        cloakOn(add, T, d, { color: 0xe6e3dc, hem: 0.95, clasp: 0xd8dce4 });
      });
    }
    if (id === 'theoden') {
      if (!opts.freed) {
        return figure(LOOKS.theodenOld, FM, 'theoden-bent', (add, f, d, T) => {
          robeOn(add, T, d, { color: 0x2e2620, waist: 0.22, folds: 0.09 });
          straggle(add, f.head, 0xe0ddd6, 0.6);
          // thin hair combed back over his crown, lying on it
          for (let i = 0; i < 9; i++) {
            const z = (i - 4) * 0.05;
            const c = Math.sqrt(0.316 ** 2 - z * z);
            const pts = [-0.5, 0.0, 0.6, 1.2, 1.75].map((th) => [-Math.sin(th) * c, Math.cos(th) * c, z]);
            add(f.head, tube(pts, 0.018, 0.012, { seg: 10, radial: 4 }), i % 2 ? 0xcfcac2 : 0xd8d4cc, 'matte');
          }
          // lank locks fallen forward over his shoulders
          for (const z of [-1, 1]) for (let i = 0; i < 3; i++) add(f.head, tube([[0.02, 0.1, z * (0.27 + i * 0.012)], [0.08, -0.1, z * (0.31 + i * 0.01)], [0.1 + i * 0.02, -0.3, z * (0.28 - i * 0.02)], [0.09 + i * 0.03, -0.48 - i * 0.04, z * (0.24 - i * 0.03)]], 0.03, 0.01, { seg: 8, radial: 5 }), 0xd8d4cc, 'matte');
          mantleOn(add, T, d, 0x3e342c, { open: 1.7 });
          cloakOn(add, T, d, { color: 0x221a16, hem: 0.98, clasp: 0x8a7a50 });
        });
      }
      return figure(LOOKS.theoden, FM, 'theoden', (add, f, d, T) => {
        garment(add, T, d, { color: MAIL, cls: 'metal', hem: 0.62 });
        const tun = garment(add, T, d, { color: GREEN, hem: 0.52, grow: 1.05, top: 0.95, trim: GOLD });
        beltOn(add, T, d, tun, { at: 0.13, color: 0x2a1a10, buckle: GOLD, big: 1.2 });
        // a horse in gold on his breast
        add(T, roundBox(0.02, 0.1, 0.12, 0.01), GOLD, 'metal', { p: [radiusAt(tun, 0.62 * d.bodyH) + 0.006, 0.62 * d.bodyH, 0], r: [0, 0, -0.08] });
        cloakOn(add, T, d, { color: 0x24401f, trim: GOLD, hem: 0.92 });
        pauldronsOn(add, f, 0xc8ccd2);
        bracersOn(add, f, d, 0x3a2414, GOLD);
        bootsOn(add, f, d, 0x3a2414);
        swordAtHip(add, T, d, { hilt: 0x3a2414, guard: GOLD });
        // the circlet of the kings of the Mark
        add(f.head, new THREE.TorusGeometry(0.31, 0.02, 6, 32), GOLD, 'metal', { r: [Math.PI / 2, 0, 0], p: [0, 0.14, 0] });
        add(f.head, new THREE.OctahedronGeometry(0.035, 0), 0xe8f0d8, 'metal', { p: [0.31, 0.15, 0], s: [0.5, 1.2, 1] });
      });
    }
    if (id === 'grima') {
      return figure(LOOKS.grima, FM, id, (add, f, d, T) => {
        robeOn(add, T, d, { color: 0x16141a, waist: 0.19, folds: 0.08 });
        mantleOn(add, T, d, 0x221e22, { open: 1.0 });
        cloakOn(add, T, d, { color: 0x121014, hem: 1.0, clasp: 0x6a6a70 });
        // dark hollows under his eyes
        for (const s of [-1, 1]) add(f.head, roundBox(0.02, 0.022, 0.075, 0.008), 0x9a8890, 'matte', { p: [0.262, -0.008, s * 0.1], r: [0, -s * 0.38, 0] });
      });
    }
    if (id === 'eowyn') {
      return figure(LOOKS.eowyn, FM, id, (add, f, d, T) => {
        // a white gown fitted to the waist, a girdle of gold, its end hanging
        const prof = robeOn(add, T, d, { color: 0xeeeae2, waist: 0.17, hem: 0.36, folds: 0.06, belt: GOLD, buckle: GOLD, at: 0.36 });
        const r0 = radiusAt(prof, 0.36 * d.bodyH);
        add(T, tube([[r0 + 0.01, 0.36 * d.bodyH, 0.02], [r0 + 0.03, 0.0, 0.03], [radiusAt(prof, -0.4) + 0.012, -0.4, 0.04]], 0.01, 0.008, { seg: 6, radial: 4 }), GOLD, 'metal');
        add(T, new THREE.TorusGeometry(0.105 * d.wide, 0.012, 4, 20), 0xd8c8a0, 'matte', { p: [0, 0.985 * d.bodyH, 0], r: [Math.PI / 2, 0, 0] });
        // the long sleeves flaring at the wrist
        for (const arm of f.arms) add(arm, new THREE.CylinderGeometry(0.055, 0.1, 0.16, 12, 1, true), 0xeeeae2, 'cloth', { p: [0, -d.armLen + 0.05, 0] });
      });
    }
    if (id === 'hama' || id === 'rider') {
      const look = id === 'hama' ? { ...riderLook(4), skin: 0xe8bc94, hair: 0xc8a060, beard: { color: 0xb89050, style: 'short', len: 0.12 }, brows: 0xa88040, cloak: 0x2a3e26, plume: 0xf2eee4, tall: 1.58, wide: 1.1, seed: 41 } : riderLook(n);
      const helm = opts.helm ?? true;
      const spear = opts.spear ?? true;
      const shield = opts.shield ?? (n % 2 === 0 && id !== 'hama');
      return figure(look, FM, id === 'hama' ? 'hama' : `rider${n}`, (add, f, d, T) => {
        garment(add, T, d, { color: MAIL, cls: 'metal', hem: 0.6 });
        const jerk = garment(add, T, d, { color: look.coat, hem: 0.36, grow: 1.05, top: 0.94 });
        beltOn(add, T, d, jerk, { at: 0.14, color: 0x2a1a10, buckle: GOLD });
        if (id === 'hama') add(T, roundBox(0.02, 0.09, 0.1, 0.01), GOLD, 'metal', { p: [radiusAt(jerk, 0.6 * d.bodyH) + 0.006, 0.6 * d.bodyH, 0], r: [0, 0, -0.08] });
        pauldronsOn(add, f, STEEL);
        bracersOn(add, f, d, LEATHER, GOLD);
        bootsOn(add, f, d, 0x2e2016);
        cloakOn(add, T, d, { color: look.cloak, hem: 0.86, clasp: GOLD });
        if (helm) rohanHelm(add, f.head, { plume: look.plume, seed: look.seed });
        if (spear) spearIn(add, f.arms[1], d, 2.75);
        if (shield) shieldOnBack(add, T, d, look, -0.34 * d.wide - 0.04);
        swordAtHip(add, T, d, { hilt: 0x3a2414, guard: GOLD });
      });
    }
    if (id === 'henchman') {
      const look = henchLook(n);
      return figure(look, FM, `henchman${n}`, (add, f, d, T) => {
        const jerk = garment(add, T, d, { color: look.coat, hem: 0.45, grow: 1.02, top: 0.96 });
        beltOn(add, T, d, jerk, { at: 0.12, color: 0x1a120c, buckle: 0x5a5852 });
        add(T, tube([[0.2, 0.95 * d.bodyH, -0.13], [0.24, 0.55 * d.bodyH, 0.04], [0.25, 0.15 * d.bodyH, 0.16]], 0.016, 0.016, { seg: 6, radial: 4 }), 0x1a120c, 'matte');
        bracersOn(add, f, d, 0x1e1812);
        bootsOn(add, f, d, 0x1e1812);
        if (look.hood) hoodOn(add, f.head, T, d, look.hood);
        if (look.cloak) cloakOn(add, T, d, { color: look.cloak, hem: 0.7, clasp: null });
        cudgelIn(add, f.arms[1], d, 9 + n);
      });
    }
    // anyone else: a Rider without his helm, at ease
    return person('rider', { n: String(id).length, helm: false, spear: false });
  };

  // ── knocked down ──
  // Lying on his back where he stood, feet towards where he faced (k 0 up,
  // 1 down). Call it after the scene has stood and posed him this frame;
  // the next tick() undoes what it did to anything the stand doesn't reset.
  const knocked = new Set();
  const knock = (f, k = 1) => {
    const e = smooth(0, 1, clamp01(k));
    if (e <= 0) return;
    const ang = (Math.PI / 2 - 0.06) * e;
    f.group.rotation.z += ang;
    f.group.position.y += 0.17 * (f.look?.wide ?? 1) * e;
    f.body.position.y = f.baseY;
    for (const [i, s] of [[0, -1], [1, 1]]) {
      f.legs[i].rotation.z = 0.1 * e;
      f.legs[i].rotation.x = s * -0.22 * e;
      f.arms[i].rotation.x = s * -1.2 * e;
      f.arms[i].rotation.z = -0.3 * e;
    }
    f.head.rotation.z = 0.25 * e;
    f.head.rotation.x = 0.35 * e;
    if (f.blob) {
      // keep his shadow on the ground under him, drawn out long: where his
      // middle is now, put back through the turn the group was given
      const lift = 0.17 * (f.look?.wide ?? 1) * e;
      const h = (f.top ?? 1.9) * 0.5 * Math.sin(ang);
      const y = 0.03 - lift;
      f.blob.rotation.z = -ang;
      f.blob.position.set(-h * Math.cos(ang) + y * Math.sin(ang), h * Math.sin(ang) + y * Math.cos(ang), 0);
      f.blob.scale.set(1 + 1.5 * Math.sin(ang), 1, 1);
    }
    knocked.add(f);
  };
  const unknock = (f) => {
    for (const leg of f.legs) leg.rotation.x = 0;
    for (const arm of f.arms) arm.rotation.x = 0;
    f.head.rotation.x = 0;
    if (f.blob) {
      f.blob.rotation.set(0, 0, 0);
      f.blob.position.set(0, 0.03, 0);
      f.blob.scale.set(1, 1, 1);
    }
  };

  // ── horses ──

  // Asfaloth with no Arwen, no Frodo, no silver; re-coated, saddled and
  // bridled for Rohan, and ridden (or not).
  const mount = (coat, { rider = null, tack = 'rohan' } = {}) => {
    const K = wt();
    const a = K.asfaloth();
    const { mats: wm } = K;
    const drop = (o) => {
      o.removeFromParent();
      o.traverse((m) => m.geometry?.dispose());
    };
    drop(a.arwen.group);
    drop(a.frodo.group);
    for (const m of [...a.body.children]) if (m.isMesh && m.material === wm.cloth) drop(m);
    for (const m of [...a.horse.head.children]) if (m.isMesh && m.material === wm.silver) drop(m);
    for (const m of [...a.group.children]) if (m.isMesh && m.material === wm.silver) drop(m);
    // the coat: pale parts to the coat's colour, the greyed parts (lower
    // legs, muzzle) to its points, the hooves dark
    const cc = C(coat.coat);
    const cp = C(coat.points);
    const ch = C(coat.hoof);
    const cm = C(coat.mane);
    const c = new THREE.Color();
    const white = coat === SNOW;
    a.group.traverse((m) => {
      if (!m.isMesh) return;
      const col = m.geometry.attributes.color;
      if (!col) return;
      if (m.material === wm.coat) {
        for (let i = 0; i < col.count; i++) {
          c.fromBufferAttribute(col, i);
          const L = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
          if (L < 0.2) c.copy(ch);
          else {
            const t = smooth(0.5, 0.86, L);
            c.copy(cp).lerp(cc, t).multiplyScalar(0.94 + 0.08 * clamp01((L - 0.86) * 8));
          }
          col.setXYZ(i, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
      } else if (m.material === wm.silverHair) {
        for (let i = 0; i < col.count; i++) {
          c.fromBufferAttribute(col, i);
          const L = (c.r + c.g + c.b) / 3;
          c.copy(cm).multiplyScalar(0.75 + 0.3 * L);
          col.setXYZ(i, c.r, c.g, c.b);
        }
        col.needsUpdate = true;
        if (!white && coat.mane !== COATS[2].mane) m.material = wm.hair;
      }
    });
    if (white) {
      // Snowmane: white all over, a little lustre
      mats.snow ??= Object.assign(wm.coat.clone(), { roughness: 0.46, emissive: C(0x141518) });
      a.group.traverse((m) => {
        if (m.isMesh && m.material === wm.coat) m.material = mats.snow;
      });
    }
    // ── the tack ──
    const king = tack === 'king';
    const cloth = king ? 0x24401f : 0x2c4a2a;
    const edge = king ? GOLD : 0xb89a50;
    const bk = parts();
    // the saddle-cloth, green, edged, over his back and down his sides
    bk.add(FM.cloth, barrelPatch(-0.46, 0.24, 0.16, Math.PI - 0.16, 0.014, cloth, edge));
    // the saddle: its seat, the cantle behind and the pommel before, and a
    // leather flap down each side under the rider's leg
    const seatPts = [[-0.38, 1.78, 0], [-0.3, 1.71, 0], [-0.12, 1.68, 0], [0.06, 1.7, 0], [0.16, 1.79, 0]];
    bk.add(FM.matte, tube(seatPts, 0.1, 0.07, { seg: 10, radial: 10 }), { s: [1, 0.55, 1.65], p: [0, 0.78, 0], color: 0x3a2214 });
    bk.add(FM.matte, tube([[-0.34, 1.7, -0.17], [-0.4, 1.83, 0], [-0.34, 1.7, 0.17]], 0.035, 0.035, { seg: 8, radial: 6 }), { color: 0x4a2c18 });
    bk.add(FM.matte, tube([[0.13, 1.7, -0.14], [0.18, 1.83, 0], [0.13, 1.7, 0.14]], 0.035, 0.035, { seg: 8, radial: 6 }), { color: 0x4a2c18 });
    bk.add(FM.metal, ball(0.03, 8, 6), { p: [0.19, 1.85, 0], color: GOLD });
    bk.add(FM.cloth, barrelPatch(-0.3, 0.06, 0.4, 1.25, 0.026, 0x3e2618, 0x2a1a10));
    bk.add(FM.cloth, barrelPatch(-0.3, 0.06, Math.PI - 1.25, Math.PI - 0.4, 0.026, 0x3e2618, 0x2a1a10));
    // the girth and the breast-collar, a gilt boss on the chest
    {
      const ring = [];
      for (let k = 0; k <= 24; k++) ring.push(barrelAt(0.06, (k / 24) * TAU, 0.012));
      bk.add(FM.matte, tube(ring, 0.022, 0.022, { seg: 30, radial: 4 }), { color: 0x2a1a10 });
      const half = [barrelAt(0.42, 0.75, 0.03), barrelAt(0.62, 0.4, 0.025), barrelAt(0.8, 0.12, 0.022), barrelAt(0.92, -0.05, 0.02)];
      const front = V3(1.0, half[3].y - 0.02, 0);
      const pts = [...half.map((q) => q.clone().setZ(-q.z)), front, ...half.slice().reverse()];
      bk.add(FM.matte, tube(pts, 0.022, 0.022, { seg: 20, radial: 4 }), { color: 0x2a1a10 });
      bk.add(FM.metal, ball(0.048, 10, 8), { p: [front.x + 0.012, front.y, 0], s: [0.45, 1, 1], color: edge });
    }
    // the stirrups, under where the rider's feet are
    for (const s of [-1, 1]) {
      bk.add(FM.matte, tube([[-0.02, 1.64, s * 0.29], [0.06, 1.38, s * 0.33], [0.15, 1.16, s * 0.35]], 0.012, 0.012, { seg: 4, radial: 4 }), { color: 0x2a1a10 });
      bk.add(FM.metal, new THREE.TorusGeometry(0.05, 0.01, 4, 10, Math.PI), { p: [0.17, 1.14, s * 0.35], r: [Math.PI, 0, 0], color: 0x9aa0a8 });
      bk.add(FM.metal, B(0.09, 0.012, 0.05), { p: [0.17, 1.09, s * 0.35], color: 0x9aa0a8 });
    }
    bk.build(a.body);
    // the bridle, in leather and gilt, in the head's own (hanging) frame
    const hk = parts();
    hk.at([0, 0, 0], [0, 0, HA], () => {
      for (const s of [-1, 1]) {
        hk.add(FM.matte, tube([[-0.03, 0.07, s * 0.1], [0.2, 0.0, s * 0.098], [0.47, -0.035, s * 0.067]], 0.01, 0.01, { seg: 6, radial: 4 }), { color: 0x2a1a10 });
        hk.add(FM.metal, new THREE.TorusGeometry(0.022, 0.006, 5, 12), { p: [0.5, -0.045, s * 0.068], color: 0xb8bcc4 });
        hk.add(FM.metal, ball(0.018, 8, 5), { p: [0.02, 0.05, s * 0.106], s: [1.2, 1, 0.5], color: edge });
      }
      const strap = (x, ups, dns, wid, r = 0.009) => {
        const pts = [];
        for (let q = 0; q <= 16; q++) {
          const th = (q / 16) * TAU;
          const sn = Math.sin(th);
          pts.push(V3(x, sn * (sn > 0 ? ups : dns), Math.cos(th) * wid));
        }
        hk.add(FM.matte, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 20, r, 4, true), { color: 0x2a1a10 });
      };
      strap(0.42, 0.075, 0.085, 0.072);
      strap(-0.01, 0.11, 0.15, 0.11, 0.008);
      hk.add(FM.matte, tube([[0.045, 0.098, -0.09], [0.06, 0.114, 0], [0.045, 0.098, 0.09]], 0.01, 0.01, { seg: 6, radial: 4 }), { color: 0x2a1a10 });
      hk.add(FM.metal, ball(0.022, 8, 6), { p: [0.07, 0.115, 0], s: [1.2, 0.6, 1], color: edge });
    });
    hk.build(a.horse.head);
    // ── the rider ──
    const none = { group: new THREE.Group(), torso: new THREE.Group(), head: new THREE.Group() };
    let r = null;
    if (rider) {
      r = seatedRider(FM, K, rider);
      r.group.position.set(-0.12, 1.73, 0);
      a.body.add(r.group);
      if (rider.banner) {
        const b = new THREE.Mesh(flagGeo(), mats.flag);
        b.position.copy(r.handR).add(V3(0.02, 0, 0.01));
        b.frustumCulled = false;
        r.torso.children[0].add(b);
        r.banner = b;
      }
    }
    // what gallop() drives: Arwen's lean is now the rider's; Frodo is no one
    a.arwen = r ? { group: r.group, torso: r.torso, head: r.head } : none;
    a.frodo = { group: new THREE.Group(), head: new THREE.Group() };
    a.flow.hair = r ? r.crest : { flow() {} };
    a.flow.cloak = r ? r.cloak : { flow() {} };
    // the reins, from the bit to his hands, one mesh, drawn each frame
    const rg = new THREE.BufferGeometry();
    const rpos = new Float32Array(2 * 8 * 3);
    rg.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    rg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(16 * 3).fill(0.04), 3));
    const ri = [];
    for (let q = 0; q < 2; q++) {
      const o = q * 8;
      for (let e = 0; e < 4; e++) {
        const a0 = o + e;
        const a1 = o + ((e + 1) % 4);
        ri.push(a0, a1, a0 + 4, a1, a1 + 4, a0 + 4);
      }
    }
    rg.setIndex(ri);
    const reins = new THREE.Mesh(rg, FM.matte);
    reins.frustumCulled = false;
    reins.visible = !!r;
    a.group.add(reins);
    const _a = V3();
    const _b = V3();
    const _d = V3();
    const _u = V3();
    const _v = V3();
    const inv = new THREE.Matrix4();
    const handAt = r ? [r.handL, r.king ? r.handR : r.handL] : null;
    a.drawReins = () => {
      if (!r) return;
      a.group.updateMatrixWorld(true);
      inv.copy(a.group.matrixWorld).invert();
      for (let q = 0; q < 2; q++) {
        a.horse.head.localToWorld(_a.copy(BIT[q])).applyMatrix4(inv);
        r.torso.children[0].localToWorld(_b.copy(handAt[q]).add(V3(0.02, 0, q ? 0.02 : -0.02))).applyMatrix4(inv);
        _d.copy(_b).sub(_a).normalize();
        _u.set(0, 1, 0).cross(_d).normalize().multiplyScalar(0.007);
        _v.copy(_d).cross(_u).normalize().multiplyScalar(0.007);
        for (let e = 0; e < 4; e++) {
          const sx = e === 0 || e === 3 ? 1 : -1;
          const sy = e < 2 ? 1 : -1;
          for (const [end, P] of [[0, _a], [1, _b]]) {
            const k = (q * 8 + end * 4 + e) * 3;
            rpos[k] = P.x + _u.x * sx + _v.x * sy;
            rpos[k + 1] = P.y + _u.y * sx + _v.y * sy;
            rpos[k + 2] = P.z + _u.z * sx + _v.z * sy;
          }
        }
      }
      rg.attributes.position.needsUpdate = true;
      rg.computeVertexNormals();
    };
    a.rider = r;
    a.legs = [];
    gallop(a, 0, 0);
    return a;
  };
  let flagG = null;
  const flagGeo = () => (flagG ??= bannerGeo());
  let hostG = null;
  let hostBannerG = null;
  let tankardG = null;
  let plateG = null;
  let flowerG = null;

  return {
    mats,
    tick(t) {
      uniforms.uTime.value = t;
      for (const f of knocked) unknock(f);
      knocked.clear();
    },
    person,
    knock,
    gallop,
    // A Rider on his horse: coat by n (bay, chestnut, grey, black, dun,
    // dark bay), the rider varied by n too; { rider: false } for a horse
    // saddled and waiting, { banner: true } for a Rider with a banner.
    horse: ({ n = 0, rider = true, banner = false } = {}) => {
      const look = riderLook(n + 1);
      return mount(COATS[n % COATS.length], {
        rider: rider ? { skin: look.skin, hair: look.hair, beard: look.beard?.color ?? null, tunic: look.coat, cloak: look.cloak, plume: look.plume, spear: !banner, banner, shield: !banner, shieldField: look.shield, seed: look.seed } : null,
      });
    },
    // Théoden King on Snowmane
    theodenHorse: () => mount(SNOW, { tack: 'king', rider: { skin: 0xe6bc98, hair: 0xa88444, beard: 0xa8884c, tunic: GREEN, cloak: 0x24401f, plume: 0xf8f6f0, king: true, spear: false, shield: false, seed: 77 } }),
    // The host: { geometry, material } for an InstancedMesh (a few hundred
    // triangles a Rider), `count` a fair number of them, ride(speed) to set
    // them galloping (0 standing, 1 a full gallop), and `banner` { geometry,
    // material } for an InstancedMesh of banners to give the same matrices
    // as some of the Riders (it rides and bobs with them).
    host: () => {
      hostG ??= hostGeo();
      hostBannerG ??= bannerGeo(HAND);
      return {
        geometry: hostG,
        material: mats.host,
        count: low ? 600 : 1400,
        banner: { geometry: hostBannerG, material: mats.banner },
        ride(speed = 0) {
          uniforms.uRide.value = Math.max(0, Number(speed) || 0);
        },
      };
    },
    // a banner of Rohan on its pole, the pole's foot at the origin (for a
    // wall, a door, a hand); it waves
    banner: () => {
      const m = new THREE.Mesh(flagGeo(), mats.flag);
      m.geometry = m.geometry.clone().translate(0, 1.0, 0);
      m.name = 'banner';
      m.frustumCulled = false;
      return m;
    },
    tankard: () => {
      const m = new THREE.Mesh((tankardG ??= tankardGeo()), mats.fig);
      m.name = 'tankard';
      m.castShadow = true;
      return m;
    },
    plate: () => {
      const m = new THREE.Mesh((plateG ??= plateGeo()), mats.fig);
      m.name = 'plate';
      m.castShadow = true;
      return m;
    },
    flowerBunch: () => {
      const m = new THREE.Mesh((flowerG ??= flowerGeo()), mats.fig);
      m.name = 'simbelmyne';
      return m;
    },
  };
}
