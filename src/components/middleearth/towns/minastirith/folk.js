// Minas Tirith's people and engines, made in code: Shadowfax with Gandalf
// the White and Pippin up; the folk of the story (Pippin in his travelling
// clothes or the black and silver of the Tower, Gandalf, Denethor,
// Beregond, the King and the rest of the Fellowship); the Guards of the
// Citadel; the city's trebuchets and the siege-towers of Mordor; what's in
// the way on the road up; the stones and the fire thrown, the fell beasts
// and the host. ./scene.js places them; nothing is downloaded.
//
// The towns' conventions (../bree/props.js): metres; each builder's group
// stands on y = 0 at its origin; people and beasts face +x. The people are
// the map's toy figures (../../mapFigures.js), dressed for Gondor and packed
// so each is a dozen draws or fewer, all sharing four materials.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../../../../lib/three/stage3dNodes';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { makeToyFigure } from '../../mapFigures';
import { LOOKS } from '../../shire/people';
import { castFigure } from '../../cast3d';
import { B, ball, barrelParts, blob, boxUV, cyl, cylZ, fillColor, lathe, parts, rng, roundBox, tf, tube } from '../../shire/props';
import { createWeathertopKit, gallop } from '../weathertop/props';
import { createMarshesKit } from '../marshes/props';
import { createDoomKit } from '../doom/props';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);
const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;

// Gondor's colours
const BLACK = 0x18181c;
const MAIL = 0x7e838c;
const SILVER = 0xd6dae2;
const WHITE = 0xf3f1ec;
const HELM = 0xc9ced8;

// ── packing a figure ──

// A figure's meshes, gathered by the kind of surface they are and merged,
// their colours baked into their vertices; the groups that move (body,
// head, legs, arms) stay, so ../../mapFigures.js `pose` still works.
const classOf = (m) => (m.isMeshBasicMaterial ? 'glow' : m.metalness > 0.4 ? 'metal' : m.side === THREE.DoubleSide ? 'cloth' : 'matte');
const KEEP = new Set(['position', 'normal', 'color']);
function baked(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (color != null) {
    if (color.isColor) fillColor(g, (x, y, z, out) => out.copy(color));
    else fillColor(g, color);
  }
  for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}
const _mm = new THREE.Matrix4();
function pack(f, M, extra = []) {
  const keep = [f.group, f.body, f.head, ...f.legs, ...f.arms];
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
  // the groups left empty (the hands)
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

// Hair, on a toy's head (a ball 0.29 across, the face to +x): a cap over
// the crown to the brow, the sides and back down past the ears, open at
// the face, and for long hair a fall down the back to the shoulders.
function hairdo(add, head, style, color, { len = 0.45, brow = 0.13 } = {}) {
  const r = 0.305;
  const th = Math.acos(brow / r);
  add(head, new THREE.SphereGeometry(r, 22, 7, 0, TAU, 0, th), color, 'cloth');
  const gap = style === 'short' ? 2.3 : 2.15;
  const low = style === 'short' ? 0.64 * Math.PI : 0.8 * Math.PI;
  add(head, new THREE.SphereGeometry(r, 22, 8, Math.PI + gap / 2, TAU - gap, th - 0.04, low - th + 0.04), color, 'cloth');
  if (style !== 'short') {
    // the fall: behind the neck and down the back, past the shoulders
    const fall = new THREE.CylinderGeometry(0.25, 0.3, len, 16, 3, true, 1.5 * Math.PI - 1.35, 2.7);
    const p = fall.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = (0.5 - y / len) * 0.5;
      p.setX(i, p.getX(i) * (1 - k * 0.5));
    }
    add(head, fall, color, 'cloth', { p: [-0.05, -0.12 - len / 2, 0] });
  }
}

// A beard over the jaw and chin, a moustache; long, or a dwarf's, down the chest.
function beardOn(add, head, { color, style = 'short', len = 0.12 }) {
  const big = style === 'dwarf' ? 1.3 : 1;
  const wide = style === 'short' ? 2.0 : 2.4;
  add(head, new THREE.SphereGeometry(0.301, 18, 6, Math.PI - wide / 2, wide, (style === 'short' ? 0.67 : 0.63) * Math.PI, 0.3 * Math.PI), color, 'cloth');
  // the moustache, drooping either side of the mouth
  const droop = style === 'short' ? 0.022 : 0.05;
  for (const s of [-1, 1]) add(head, tube([[0.285, -0.07, 0], [0.276, -0.078, s * 0.055 * big], [0.255, -0.08 - droop * big, s * 0.1 * big]], 0.02 * big, 0.011 * big, { seg: 6, radial: 5 }), color, 'matte');
  if (style === 'short') {
    add(head, ball(0.1, 10, 8), color, 'matte', { p: [0.2, -0.235 - len * 0.4, 0], s: [0.62, 0.55 + len * 2, 1.15] });
  } else {
    if (style === 'dwarf') add(head, ball(0.27, 14, 10), color, 'matte', { p: [0.17, -0.34, 0], s: [0.62, 1.15 + len * 0.4, 1.12] });
    else add(head, new THREE.ConeGeometry(0.19, len, 10), color, 'matte', { p: [0.19, -0.2 - len / 2, 0], r: [0, 0, Math.PI + 0.12], s: [0.6, 1, 1.15] });
    if (style === 'dwarf') {
      // braids either side, with silver clasps
      for (const s of [-1, 1]) {
        add(head, tube([[0.22, -0.3, s * 0.14], [0.27, -0.55, s * 0.15], [0.27, -0.78, s * 0.12]], 0.035, 0.024, { seg: 6, radial: 5 }), color, 'matte');
        add(head, cyl(0.032, 0.032, 0.05, 6), 0xc8ccd4, 'metal', { p: [0.27, -0.74, s * 0.12] });
      }
    }
  }
}

// Brows over the eyes, and a nose.
function faceOn(add, head, { brows = null, stern = 0.15, skin, nose = true } = {}) {
  if (brows != null) {
    for (const s of [-1, 1]) add(head, B(0.035, 0.028, 0.1), brows, 'matte', { p: [0.255, 0.105, s * 0.1], r: [-s * stern, -s * 0.38, 0] });
  }
  if (nose) add(head, ball(0.038, 8, 6), skin, 'matte', { p: [0.283, -0.025, 0], s: [0.85, 1.2, 0.8] });
}

// A feather, lying along +x in the x-y plane, a little thick.
function featherGeo(len, wid, depth = 0.012) {
  const s = new THREE.Shape();
  s.moveTo(0, -wid * 0.25);
  s.quadraticCurveTo(len * 0.45, -wid * 0.8, len, 0);
  s.quadraticCurveTo(len * 0.5, wid * 0.55, 0, wid * 0.25);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, -depth / 2);
}
// A sea-bird's wing, as the Guard wear them on their helms: feathers fanned
// up and back from the root, splayed out from the head on `side`; white,
// greying at the tips. Coloured, so its colour is kept when it's packed.
const _tip = C(0xa8adb6);
function wingGeos(side, { n = 5, len = 0.36, spread = [1.72, 2.8], splay = 0.32 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0;
    const L = len * mix(1, 0.5, u);
    const geo = featherGeo(L, L * 0.27);
    fillColor(geo, (x, y, z, o) => o.setHex(0xf8f8f6).lerp(_tip, smooth(0.5, 1, x / L) * 0.5 * (0.5 + u)));
    tf(geo, { r: [0, 0, mix(spread[0], spread[1], u)] });
    tf(geo, { r: [0, side * splay, 0] });
    out.push(geo);
  }
  return out;
}

// The tall helm of the Guards of the Citadel, on a toy's head: a high
// silver bowl, a ridge over it front to back, a brow band, cheek-guards and
// a neck-guard, and the white wings of a sea-bird at either side. `k` sizes
// it; `at`, `r` move it off the head (a helm carried).
const BOWL = [[0.322, 0.085], [0.33, 0.16], [0.318, 0.27], [0.286, 0.37], [0.236, 0.46], [0.172, 0.54], [0.1, 0.6], [0.04, 0.635], [0.001, 0.645]];
function helmOn(add, g, { k = 1, wings = 1, cheeks = true, at = [0, 0, 0], r = [0, 0, 0] } = {}) {
  const put = (geo, color, cls) => add(g, tf(tf(geo, { s: k }), { p: at, r }), color, cls);
  put(lathe(BOWL.map(([a, b]) => [a, b]), 22), HELM, 'metal');
  put(tf(new THREE.TorusGeometry(0.327, 0.021, 6, 30), { r: [Math.PI / 2, 0, 0], p: [0, 0.09, 0] }), 0xe4e8ee, 'metal');
  put(tube([[0.31, 0.24, 0], [0.24, 0.47, 0], [0.1, 0.62, 0], [-0.08, 0.64, 0], [-0.24, 0.5, 0], [-0.32, 0.26, 0]], 0.03, 0.02, { seg: 14, radial: 5 }), 0xe4e8ee, 'metal');
  put(tf(new THREE.ConeGeometry(0.035, 0.14, 6), { p: [0.0, 0.7, 0] }), 0xe4e8ee, 'metal');
  if (cheeks) {
    for (const s of [-1, 1]) {
      const mid = s > 0 ? 0.32 : Math.PI - 0.32;
      put(tf(new THREE.CylinderGeometry(0.334, 0.3, 0.26, 7, 1, true, mid - 0.36, 0.72), { p: [0, -0.045, 0] }), HELM, 'metal');
    }
  }
  put(tf(new THREE.CylinderGeometry(0.328, 0.37, 0.22, 10, 1, true, 1.5 * Math.PI - 1.2, 2.4), { p: [0, -0.02, 0] }), HELM, 'metal');
  if (wings > 0) {
    for (const s of [-1, 1]) for (const geo of wingGeos(s, { len: 0.46 * wings, splay: 0.42 })) put(tf(geo, { p: [-0.03, 0.29, s * 0.32] }), null, 'matte');
  }
}

// The crown of Gondor: tall, helm-shaped, white and silver, with the wings
// of sea-birds at its sides, gems on its brow and one on its top.
const CROWN = [[0.318, 0.06], [0.322, 0.17], [0.308, 0.3], [0.282, 0.44], [0.24, 0.58], [0.186, 0.71], [0.126, 0.82], [0.066, 0.9], [0.001, 0.95]];
function crownOn(add, head) {
  add(head, lathe(CROWN.map(([a, b]) => [a, b]), 26), 0xf4f5f8, 'matte');
  add(head, new THREE.TorusGeometry(0.331, 0.03, 6, 32), 0xf4f6fa, 'metal', { r: [Math.PI / 2, 0, 0], p: [0, 0.085, 0] });
  for (let j = 0; j < 8; j++) {
    const a = (j / 8) * TAU + TAU / 16;
    add(head, tube(CROWN.slice(1, 8).map(([rr, y]) => [Math.cos(a) * (rr + 0.006), y, Math.sin(a) * (rr + 0.006)]), 0.013, 0.009, { seg: 10, radial: 4 }), 0xd8dde6, 'metal');
  }
  for (let i = -3; i <= 3; i++) {
    const a = i * 0.3;
    add(head, ball(0.024, 8, 6), hot(0xe8f2ff, 1.4), 'glow', { p: [Math.cos(a) * 0.358, 0.088, Math.sin(a) * 0.358] });
  }
  add(head, ball(0.04, 10, 8), hot(0xf4fbff, 1.8), 'glow', { p: [0.322, 0.2, 0], s: [0.6, 1.25, 1] });
  add(head, ball(0.036, 10, 8), hot(0xf4fbff, 1.8), 'glow', { p: [0, 0.96, 0] });
  for (const s of [-1, 1]) for (const geo of wingGeos(s, { n: 7, len: 0.62, spread: [1.4, 2.7], splay: 0.36 })) add(head, geo, null, 'matte', { p: [-0.02, 0.26, s * 0.318] });
}

// The White Tree as it's worked on a breast: a trunk on its roots,
// branches arching up and out, blossom at their tips; for the King the
// seven stars over it, and a crown. Unit high, its foot at the origin, in
// the y-z plane.
function treeEmblem({ king = false } = {}) {
  const geos = [];
  const t = (pts, r0, r1) => geos.push(tube(pts.map(([y, z]) => [0, y, z]), r0, r1, { seg: 8, radial: 4 }));
  t([[0, 0], [0.3, 0], [0.58, 0]], 0.05, 0.032);
  t([[0.55, 0], [0.85, 0], [1.12, 0]], 0.03, 0.012);
  const tips = [[1.12, 0]];
  for (const s of [-1, 1]) {
    t([[0.08, 0], [0.02, s * 0.12], [0, s * 0.22]], 0.032, 0.014);
    t([[0.5, 0], [0.62, s * 0.22], [0.74, s * 0.4], [0.68, s * 0.52]], 0.03, 0.013);
    t([[0.52, 0], [0.7, s * 0.15], [0.9, s * 0.27], [0.98, s * 0.32]], 0.028, 0.012);
    t([[0.54, 0], [0.76, s * 0.06], [1.0, s * 0.11], [1.08, s * 0.14]], 0.026, 0.011);
    tips.push([0.68, s * 0.52], [0.98, s * 0.32], [1.08, s * 0.14]);
  }
  for (const [y, z] of tips) geos.push(tf(ball(0.045, 6, 5), { p: [0, y, z] }));
  if (king) {
    // the seven stars, in an arch over it, and the crown between
    for (let i = 0; i < 7; i++) {
      const a = mix(0.35, Math.PI - 0.35, i / 6);
      geos.push(tf(new THREE.OctahedronGeometry(0.06, 0), { p: [0, 0.98 + Math.sin(a) * 0.48, Math.cos(a) * 0.62], r: [Math.PI / 4, 0, 0] }));
    }
    geos.push(tf(B(0.04, 0.06, 0.26), { p: [0, 1.28, 0] }));
    for (const z of [-0.11, 0, 0.11]) geos.push(tf(new THREE.ConeGeometry(0.035, 0.12, 4), { p: [0, 1.36 + (z === 0 ? 0.03 : 0), z] }));
  }
  return geos;
}

// A surcoat over the body, from the neck to below the hips: black, edged
// silver, belted, the White Tree on its breast.
function surcoatProfile(d, hem) {
  const { bodyH: bh, wide: w, legLen } = d;
  return [[0.1, 0.985 * bh], [0.165, 0.962 * bh], [0.2, 0.9 * bh], [0.214, 0.7 * bh], [0.224, 0.5 * bh], [0.24, 0.3 * bh], [0.257, 0.1 * bh], [0.268, 0], [0.285, -0.25 * legLen], [0.3, -hem * legLen]].map(([r, y]) => [r * w, y]);
}
function radiusAt(prof, y) {
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, y0] = prof[i];
    const [r1, y1] = prof[i + 1];
    if (y <= y0 && y >= y1) return mix(r0, r1, (y0 - y) / (y0 - y1));
  }
  return prof[prof.length - 1][0];
}
function surcoatOn(add, f, d, { color = BLACK, trim = SILVER, hem = 0.5, tree = null, belt = 0x2a2018 } = {}) {
  const { bodyH: bh, wide: w } = d;
  const prof = surcoatProfile(d, hem);
  add(f.body, lathe(prof, 22), color, 'cloth');
  const [rh, yh] = prof[prof.length - 1];
  add(f.body, new THREE.TorusGeometry(rh, 0.012, 4, 26), trim, 'matte', { p: [0, yh + 0.012, 0], r: [Math.PI / 2, 0, 0] });
  add(f.body, new THREE.TorusGeometry(prof[0][0] + 0.006, 0.011, 4, 18), trim, 'matte', { p: [0, prof[0][1] - 0.004, 0], r: [Math.PI / 2, 0, 0] });
  const by = 0.12 * bh;
  const br = radiusAt(prof, by) + 0.008;
  add(f.body, new THREE.TorusGeometry(br, 0.024, 5, 26), belt, 'matte', { p: [0, by, 0], r: [Math.PI / 2, 0, 0] });
  add(f.body, roundBox(0.03, 0.06, 0.08, 0.008), trim, 'metal', { p: [br + 0.012, by, 0] });
  if (tree) {
    const king = tree === 'king';
    const y0 = 0.27 * bh;
    const h = (king ? 0.27 : 0.3) * bh;
    const yt = y0 + h * 1.1;
    const lean = Math.atan2(radiusAt(prof, y0) - radiusAt(prof, yt), yt - y0);
    for (const geo of treeEmblem({ king })) add(f.body, tf(geo, { s: [0.45 * h, h, h] }), 0xf2f2f4, 'matte', { p: [radiusAt(prof, y0) + 0.004, y0, 0], r: [0, 0, lean] });
  }
  // the arms a little out from it
  for (const [i, s] of [[0, -1], [1, 1]]) f.arms[i].position.z = s * (0.22 * w + 0.035);
  return prof;
}

// A spear in the right hand, its butt on the ground: a long leaf of a blade.
function spearIn(add, arm, d, len = 2.6) {
  const ground = -(d.hipY + d.shoulderY);
  const x = 0.05;
  add(arm, cyl(0.022, 0.026, len, 7), 0x3e2c20, 'matte', { p: [x, ground + len / 2, 0] });
  add(arm, lathe([[0.001, 0], [0.042, 0.06], [0.052, 0.15], [0.036, 0.26], [0.001, 0.38]], 7), 0xe2e6ec, 'metal', { p: [x, ground + len, 0], s: [0.35, 1, 1] });
  add(arm, cyl(0.032, 0.03, 0.08, 7), 0xb8bec8, 'metal', { p: [x, ground + len - 0.02, 0] });
  add(arm, new THREE.ConeGeometry(0.026, 0.1, 6), 0x9aa0aa, 'metal', { p: [x, ground + 0.05, 0], r: [Math.PI, 0, 0] });
}

// Andúril in its scabbard at the left hip, the hilt forward.
function swordAtHip(add, body, d) {
  const z = -0.29 * d.wide;
  add(body, tube([[0.05, 0.06, z], [-0.1, -0.2, z - 0.02], [-0.28, -0.5, z - 0.03]], 0.032, 0.026, { seg: 8, radial: 6 }), 0x1e1c22, 'matte');
  add(body, ball(0.032, 6, 5), 0xc8ccd4, 'metal', { p: [-0.29, -0.52, z - 0.03] });
  add(body, tube([[0.05, 0.06, z], [0.1, 0.15, z], [0.15, 0.24, z]], 0.02, 0.018, { seg: 4, radial: 5 }), 0x3a2a20, 'matte');
  add(body, tube([[0.12, 0.0, z], [0.05, 0.06, z], [-0.02, 0.12, z]], 0.016, 0.016, { seg: 4, radial: 5 }), 0xd8dce4, 'metal');
  add(body, ball(0.03, 8, 6), 0xd8dce4, 'metal', { p: [0.16, 0.26, z] });
}

// A bow and a quiver on the back (Legolas's).
function bowOnBack(add, body, d) {
  const c = V3(-0.29 * d.wide, 0.5 * d.bodyH, 0);
  const u = V3(0, Math.cos(0.65), Math.sin(0.65));
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const s = mix(-0.6, 0.6, i / 8);
    pts.push(c.clone().addScaledVector(u, s).add(V3(-0.13 * (1 - (s / 0.6) ** 2) + 0.03 * Math.sin((s / 0.6) * Math.PI) ** 2, 0, 0)));
  }
  add(body, tube(pts, 0.018, 0.018, { seg: 16, radial: 5 }), 0xb08a58, 'matte');
  add(body, tube([pts[0], pts[8]], 0.005, 0.005, { seg: 1, radial: 3 }), 0xe8e4d8, 'matte');
  const q = V3(-0.27 * d.wide, 0.55 * d.bodyH, -0.04);
  add(body, cyl(0.075, 0.06, 0.52, 9), 0x6a4a30, 'matte', { p: [q.x, q.y, q.z], r: [0.55, 0, 0] });
  for (let i = 0; i < 5; i++) add(body, new THREE.ConeGeometry(0.025, 0.12, 4), i % 2 ? 0xe8e0cc : 0x9a3a2a, 'matte', { p: [q.x + (i - 2) * 0.012, q.y + 0.26 * Math.cos(0.55) + 0.05, q.z - 0.26 * Math.sin(0.55) - 0.04 + (i % 2) * 0.03], r: [0.55, 0, 0] });
}

// A heavy mantle over the shoulders (the Steward's), and his chain.
function mantleOn(add, body, d, color) {
  const { bodyH: bh, wide: w } = d;
  add(body, lathe([[0.1 * w, 1.0 * bh], [0.19 * w, 0.975 * bh], [0.245 * w, 0.9 * bh], [0.265 * w, 0.78 * bh], [0.27 * w, 0.66 * bh], [0.262 * w, 0.64 * bh]], 22), color, 'cloth');
}
function chainOn(add, body, d) {
  const { bodyH: bh, wide: w } = d;
  const pts = [[0.14, 0.99, -0.17], [0.25, 0.86, -0.1], [0.3, 0.76, 0], [0.25, 0.86, 0.1], [0.14, 0.99, 0.17]].map(([x, y, z]) => [x * w, y * bh, z * w]);
  add(body, tube(pts, 0.012, 0.012, { seg: 16, radial: 4 }), 0xd8dce4, 'metal');
  add(body, ball(0.035, 8, 6), 0xe4e8ee, 'metal', { p: [0.3 * w + 0.01, 0.74 * bh, 0], s: [0.5, 1.2, 1] });
}

// A basket on the arm, with greens and apples in it.
function basketIn(add, arm, d) {
  const y = -d.armLen - 0.1;
  add(arm, cyl(0.15, 0.12, 0.16, 12, true), 0xa8804a, 'cloth', { p: [0.05, y, -0.05] });
  add(arm, new THREE.TorusGeometry(0.15, 0.012, 4, 14, Math.PI), 0x8a6a3a, 'matte', { p: [0.05, y + 0.08, -0.05] });
  const r = rng(5);
  for (let i = 0; i < 5; i++) add(arm, ball(0.05, 7, 5), i % 2 ? 0x9a2a22 : 0x6a8a3a, 'matte', { p: [0.05 + (r() - 0.5) * 0.16, y + 0.07, -0.05 + (r() - 0.5) * 0.16] });
}

// The toy's own long hair and an elven brooch where they aren't wanted.
function strip(f, look) {
  const drop = [];
  f.group.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.parameters ?? {};
    if (look.hairdo && o.parent === f.head && ((o.geometry.type === 'SphereGeometry' && Math.abs(p.phiStart - Math.PI * 0.62) < 1e-6) || (o.geometry.type === 'BoxGeometry' && p.width === 0.16))) drop.push(o);
    if (look.cloak && !look.brooch && o.material.isMeshBasicMaterial && p.radius === 0.035) drop.push(o);
  });
  for (const o of drop) {
    o.removeFromParent();
    o.geometry.dispose();
  }
}

// One figure from a look: the toy, stripped, dressed, packed.
function figure(look, M, id = 'folk') {
  const d = dims(look);
  const toy = {
    tall: d.tall,
    wide: d.wide,
    skin: look.skin,
    hair: look.hair,
    hairStyle: look.hairdo === 'elf' ? 'long' : look.hairdo ? 'none' : look.hairStyle ?? 'curly',
    beard: null,
    coat: look.coat,
    shirt: look.shirt,
    cloak: look.cloak ?? null,
    robe: look.robe ?? null,
    hat: look.hat ?? null,
    item: look.item ?? null,
    ring: false,
    feet: look.feet ?? 'hairy',
    seed: look.seed ?? 1,
  };
  for (const k of Object.keys(toy)) if (toy[k] === undefined) delete toy[k];
  const f = makeToyFigure(toy);
  strip(f, look);
  // the toy's cape hangs off its side: turn it round to the back
  for (const m of f.body.children) if (m.isMesh && m.geometry.type === 'ConeGeometry' && m.geometry.parameters.openEnded) m.rotation.y = Math.PI / 2;
  const extra = [];
  const add = (group, geo, color, cls = 'matte', o) => {
    if (o) tf(geo, o);
    extra.push({ group, geo, color, cls });
    return geo;
  };
  const skin = look.skin ?? 0xf1c9a0;
  if (look.hose) {
    for (const leg of f.legs) for (const m of leg.children) if (m.isMesh && m.geometry.type === 'CylinderGeometry') m.material.color.set(look.hose);
  }
  if (look.greaves) for (const leg of f.legs) add(leg, cyl(0.088 * d.wide, 0.08 * d.wide, d.legLen * 0.5, 9), look.greaves, 'matte', { p: [0.004, -d.legLen * 0.64, 0] });
  if (look.hairdo) hairdo(add, f.head, look.hairdo === 'elf' ? 'long' : look.hairdo, look.hair, look);
  if (look.beard) beardOn(add, f.head, look.beard);
  if (look.braids) for (const s of [-1, 1]) add(f.head, tube([[0.12, 0.2, s * 0.27], [0.1, 0.0, s * 0.3], [0.08, -0.25, s * 0.27]], 0.026, 0.018, { seg: 6, radial: 5 }), look.hair, 'matte');
  faceOn(add, f.head, { brows: look.brows ?? null, stern: look.stern ?? -0.06, skin, nose: d.tall > 1.2 });
  if (look.surcoat) surcoatOn(add, f, d, look.surcoat);
  if (look.mantle) mantleOn(add, f.body, d, look.mantle);
  if (look.chain) chainOn(add, f.body, d);
  if (look.pauldrons) for (const [i, s] of [[0, -1], [1, 1]]) add(f.arms[i], new THREE.SphereGeometry(0.1, 12, 6, 0, TAU, 0, Math.PI / 2), look.pauldrons, 'metal', { p: [0, 0.01, s * 0.015], r: [s * 0.35, 0, 0], s: [1.1, 0.8, 1] });
  if (look.helm) helmOn(add, f.head, { wings: look.helm === 'page' ? 0.72 : 1, cheeks: look.helm !== 'page' });
  if (look.crown) crownOn(add, f.head);
  if (look.spear) spearIn(add, f.arms[1], d);
  if (look.sword === 'hip') swordAtHip(add, f.body, d);
  if (look.bow === 'back') bowOnBack(add, f.body, d);
  if (look.carryHelm) helmOn(add, f.arms[0], { k: 0.62, wings: 0.9, at: [0.06, -d.armLen - 0.13, -0.1], r: [0.2, 0, -0.5] });
  if (look.basket) basketIn(add, f.arms[0], d);
  if (look.shawl) add(f.body, lathe([[0.09 * d.wide, 0.99 * d.bodyH], [0.2 * d.wide, 0.94 * d.bodyH], [0.25 * d.wide, 0.8 * d.bodyH], [0.27 * d.wide, 0.6 * d.bodyH]], 18), look.shawl, 'cloth');
  pack(f, M, extra);
  f.group.name = id;
  f.look = look;
  // the top of the head (and what's on it), not a spear's point: for a label over it
  f.top = new THREE.Box3().setFromObject(f.head).max.y;
  // on the cast once its model's here (../../cast3d.js): Gandalf the White,
  // the Citadel's guards, the city's folk as the Bree man in their colours
  castFigure(f, id === 'gandalf' ? 'gandalfwhite' : id, look, { town: 'minastirith', role: /^(guard|townsfolk)\d/.test(id) ? 'folk' : 'cast' });
  return f;
}

// ── who's who ──

const FACES = [0xf0c8a0, 0xe6b890, 0xdcac84, 0xf2d0b0, 0xe8c09c];
const DARK = [0x2a1e16, 0x3a2a1c, 0x1e1814, 0x4a3420, 0x2e2622];
// A Guard of the Citadel: a tall man, black surcoat over mail with the White
// Tree on it, the winged helm, a spear, a black cloak.
function guardLook(n) {
  return {
    tall: 1.53 + (n % 3) * 0.035,
    wide: 1.04 + (n % 2) * 0.06,
    skin: FACES[n % FACES.length],
    hair: DARK[n % DARK.length],
    hairdo: 'short',
    beard: n % 3 === 1 ? { color: DARK[(n + 2) % DARK.length], style: 'short', len: 0.06 } : null,
    brows: DARK[n % DARK.length],
    stern: 0.12,
    coat: BLACK,
    shirt: MAIL,
    cloak: 0x121215,
    hose: 0x232328,
    greaves: 0x4a4e56,
    feet: 'boots',
    surcoat: { tree: 'guard', hem: 0.58 },
    pauldrons: 0xb4bac4,
    helm: 'guard',
    spear: true,
    seed: 100 + n,
  };
}
// The folk of the city: pale greys, blues and creams.
const TOWN = [0xbcc1c8, 0x8a98ac, 0xdcd3be, 0x6c7c92, 0xcac4b6, 0x9da6b2, 0xe6e0d0];
const TOWN_HAIR = [0x2e2219, 0x4a3626, 0x6a5a4a, 0x1e1814, 0x8a7a68, 0xa09888];
function townLook(n) {
  const base = { skin: FACES[n % FACES.length], hair: TOWN_HAIR[n % TOWN_HAIR.length], brows: TOWN_HAIR[n % TOWN_HAIR.length], feet: 'boots', seed: 200 + n };
  if (n % 2 === 1) return { ...base, tall: 1.38 + (n % 3) * 0.03, robe: TOWN[n % TOWN.length], shirt: TOWN[(n + 2) % TOWN.length], hairdo: 'long', len: 0.42, shawl: TOWN[(n + 4) % TOWN.length], basket: n % 4 === 1 };
  return {
    ...base,
    tall: 1.44 + (n % 3) * 0.04,
    wide: 1 + (n % 4 === 2 ? 0.15 : 0),
    coat: TOWN[n % TOWN.length],
    shirt: TOWN[(n + 2) % TOWN.length],
    hose: 0x4a4a52,
    hairdo: 'short',
    beard: n % 3 === 0 ? { color: TOWN_HAIR[(n + 1) % TOWN_HAIR.length], style: 'short', len: 0.08 } : null,
    cloak: n % 4 === 2 ? TOWN[(n + 3) % TOWN.length] : null,
  };
}

const PEOPLE = {
  // in his travelling clothes and elven cloak
  pippin: { ...LOOKS.pippin, coat: 0x5a6a34, cloak: 0x66704f, brooch: true },
  // in the black and silver of the Tower, made for some page long ago
  pippinGuard: { hair: 0x6a4020, coat: BLACK, shirt: MAIL, feet: 'hairy', surcoat: { tree: 'guard', hem: 0.62 }, seed: 23 },
  gandalf: { tall: 1.55, robe: WHITE, cloak: 0xdcdad3, hairdo: 'long', hair: 0xf2f0ec, len: 0.5, beard: { color: 0xf6f4f0, style: 'long', len: 0.6 }, brows: 0xf0eee8, stern: 0.05, item: 'white-staff', feet: 'boots', seed: 5 },
  denethor: { tall: 1.62, robe: 0x2c2c32, cloak: 0x141417, skin: 0xe4c6a8, hairdo: 'long', hair: 0x5a5856, len: 0.38, beard: { color: 0x4a4846, style: 'short', len: 0.1 }, brows: 0x3a3836, stern: 0.32, mantle: 0x3c3c44, chain: true, feet: 'boots', seed: 41 },
  beregond: { ...guardLook(4), skin: 0xe8bc94, hair: 0x5a3a22, beard: { color: 0x5a3a22, style: 'short', len: 0.06 }, brows: 0x4a3020, helm: null, carryHelm: true, seed: 43 },
  aragorn: { tall: 1.57, wide: 1.05, coat: BLACK, shirt: 0x2a2a30, cloak: 0x131317, hose: 0x1e1e22, hairdo: 'long', hair: 0x2a1e16, len: 0.4, beard: { color: 0x2a1e16, style: 'short', len: 0.05 }, brows: 0x2a1e16, feet: 'boots', surcoat: { tree: 'king', hem: 0.8 }, crown: true, sword: 'hip', seed: 7 },
  legolas: { tall: 1.52, skin: 0xf2d6bc, coat: 0x66704e, shirt: 0x7a6a50, hose: 0x4a4436, hairdo: 'elf', hair: 0xfaf3d6, len: 0.55, braids: true, brows: 0xd8c890, feet: 'boots', bow: 'back', seed: 15 },
  gimli: { tall: 0.95, wide: 1.35, coat: 0x6a3a22, shirt: 0x8a8f98, hat: 'helm', hairdo: 'long', hair: 0x9a3a1a, len: 0.3, beard: { color: 0xa8441c, style: 'dwarf', len: 0.6 }, brows: 0x8a3216, item: 'axe', feet: 'boots', seed: 11 },
  frodo: { ...LOOKS.frodo, ring: false, coat: 0x3a4e66, seed: 1 },
  sam: { ...LOOKS.sam, coat: 0x8a6a34, seed: 2 },
  merry: { ...LOOKS.merry, coat: 0x3e5a3a, seed: 21 },
};

// ── Shadowfax ──

// Hair in ribbons, as Asfaloth's mane is made (../weathertop/props.js):
// each strand from its root, hanging along `hang` when still and streaming
// along `stream` in the wind, rippling across `flutter`. flow(t, k).
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

// A cloak from the shoulders (in a torso's frame, `top` the shoulders'
// height, `half` their half-width): a grid of cloth falling down the back
// and over the horse when still, streaming out behind in the wind. flow(t, k).
function cloakSheet(material, { cols = 9, rows = 8, top = 0.6, half = 0.19, depth = 0.13, len = 0.95, color = 0xffffff, hem = 0xffffff } = {}) {
  const N = (cols + 1) * (rows + 1);
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const idx = [];
  const c0 = C(color);
  const c1 = C(hem);
  const c = new THREE.Color();
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      c.copy(c0).lerp(c1, j / rows).multiplyScalar(0.92 + 0.08 * Math.cos((i / cols) * Math.PI * 3));
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

// Gandalf the White riding, in the horse's proportions (not a toy's): his
// white robe falling over the horse's flanks, his long white hair and beard
// streaming, a pale cloak, the white staff upright in his right hand and his
// left arm round Pippin. Sits at its origin, facing +x. `torso` is what the
// gallop leans; the body inside it sits a little more upright than Arwen.
function seatedGandalf(W, glow) {
  const { mats } = W;
  const g = new THREE.Group();
  g.name = 'gandalf';
  const robe = C(0xf2f0eb);
  const shade = C(0xcfccc4);
  const skin = 0xe8c8b0;
  const robeCol = (x, y, z, out) => out.copy(robe).lerp(shade, clamp01(-y * 1.3) * 0.5);
  const bk = parts();
  // the robe over his legs and the horse's sides, his boots below it
  const skirt = lathe([[0.16, 0.16], [0.2, 0.06], [0.28, -0.1], [0.36, -0.34], [0.4, -0.56], [0.39, -0.6]], 36);
  {
    // folds, deepening down it
    const p = skirt.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = 1 + 0.07 * Math.sin(Math.atan2(z, x) * 11) * clamp01((0.1 - y) * 1.6);
      p.setXYZ(i, x * k, y, z * k);
    }
    skirt.computeVertexNormals();
  }
  bk.add(mats.beast, skirt, { s: [0.95, 1, 1.04], color: robeCol });
  for (const s of [-1, 1]) {
    bk.add(mats.beast, tube([[0.3, -0.36, s * 0.35], [0.29, -0.52, s * 0.36], [0.25, -0.66, s * 0.355]], 0.06, 0.052, { seg: 5, radial: 8 }), { color: shade });
    bk.add(mats.beast, tube([[0.26, -0.6, s * 0.355], [0.24, -0.72, s * 0.355]], 0.056, 0.052, { seg: 3, radial: 8 }), { color: 0x6a5e52 });
    bk.add(mats.beast, roundBox(0.2, 0.07, 0.09, 0.03), { p: [0.29, -0.75, s * 0.355], r: [0, 0, -0.2], color: 0x5a5046 });
  }
  bk.build(g);
  const pivot = new THREE.Group();
  pivot.name = 'torso';
  g.add(pivot);
  const torso = new THREE.Group();
  torso.rotation.z = 0.12;
  pivot.add(torso);
  const tk = parts();
  tk.add(mats.beast, lathe([[0.001, -0.02], [0.19, 0.0], [0.2, 0.14], [0.18, 0.3], [0.195, 0.44], [0.215, 0.54], [0.2, 0.62], [0.12, 0.69], [0.06, 0.73], [0.001, 0.74]], 18), { s: [0.82, 1, 1.15], color: robe });
  tk.add(mats.beast, new THREE.TorusGeometry(0.196, 0.016, 5, 22), { r: [Math.PI / 2, 0, 0], p: [0, 0.24, 0], s: [0.84, 1.17, 1], color: 0xdedacf });
  tk.add(mats.beast, cyl(0.045, 0.05, 0.12, 10), { p: [0.01, 0.75, 0], color: skin });
  // the left arm round Pippin to the mane; the right holding the staff
  tk.add(mats.beast, tube([[0.0, 0.6, -0.19], [0.1, 0.42, -0.26], [0.3, 0.3, -0.21], [0.5, 0.25, -0.11]], 0.068, 0.05, { seg: 8, radial: 8 }), { color: robe });
  tk.add(mats.beast, ball(0.04, 8, 6), { p: [0.53, 0.24, -0.09], s: [1.3, 0.9, 1], color: skin });
  tk.add(mats.beast, tube([[0.0, 0.6, 0.19], [0.07, 0.42, 0.28], [0.21, 0.33, 0.33]], 0.068, 0.054, { seg: 6, radial: 8 }), { color: robe });
  tk.add(mats.beast, ball(0.042, 8, 6), { p: [0.24, 0.33, 0.35], color: skin });
  tk.add(mats.beast, tube([[0.17, -0.5, 0.37], [0.24, 0.3, 0.355], [0.3, 1.12, 0.34], [0.32, 1.3, 0.34]], 0.024, 0.02, { seg: 10, radial: 6 }), { color: 0xeae6dc });
  tk.add(mats.beast, tube([[0.32, 1.3, 0.34], [0.38, 1.38, 0.34], [0.34, 1.46, 0.34], [0.27, 1.42, 0.34], [0.29, 1.35, 0.34]], 0.026, 0.018, { seg: 10, radial: 6 }), { color: 0xeae6dc });
  tk.build(torso);
  // a white glow caught in the head of the staff
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), glow);
  orb.position.set(0.32, 1.39, 0.34);
  torso.add(orb);
  // the head: white hair and beard, bushy brows
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0.04, 0.88, 0);
  torso.add(head);
  const hk = parts();
  const hair = 0xf4f2ee;
  hk.add(mats.beast, ball(0.122, 18, 14), { s: [1, 1.1, 0.92], color: skin });
  hk.add(mats.beast, new THREE.ConeGeometry(0.024, 0.07, 6), { p: [0.13, -0.005, 0], r: [0, 0, -Math.PI / 2 - 0.25], color: skin });
  for (const s of [-1, 1]) {
    hk.add(mats.eye, ball(0.013, 8, 6), { p: [0.108, 0.03, s * 0.042], s: [0.7, 0.8, 1.1] });
    hk.add(mats.beast, roundBox(0.035, 0.026, 0.065, 0.008), { p: [0.112, 0.062, s * 0.047], r: [-s * 0.15, 0, 0.1], color: hair });
  }
  hk.add(mats.beast, new THREE.SphereGeometry(0.129, 18, 6, 0, TAU, 0, 0.3 * Math.PI), { s: [1, 1.1, 0.95], color: hair });
  hk.add(mats.beast, new THREE.SphereGeometry(0.128, 18, 8, Math.PI + 0.95, TAU - 1.9, 0.28 * Math.PI, 0.5 * Math.PI), { s: [1, 1.1, 0.95], color: hair });
  hk.add(mats.beast, new THREE.SphereGeometry(0.126, 16, 6, Math.PI - 1.2, 2.4, 0.56 * Math.PI, 0.38 * Math.PI), { s: [1, 1.1, 0.92], color: hair });
  hk.add(mats.beast, new THREE.ConeGeometry(0.08, 0.42, 10), { p: [0.085, -0.3, 0], r: [0, 0, Math.PI + 0.1], s: [0.62, 1, 1], color: hair });
  hk.add(mats.beast, new THREE.TorusGeometry(0.036, 0.013, 5, 10, Math.PI), { p: [0.118, -0.045, 0], r: [0, Math.PI / 2, 0], color: hair });
  hk.build(head);
  const n = makeNoise(29);
  const hairRoots = [];
  for (let i = 0; i < 13; i++) {
    const a = mix(-1.75, 1.75, i / 12);
    hairRoots.push({
      root: V3(-0.06 - Math.cos(a) * 0.075, 0.03 - Math.abs(a) * 0.035, Math.sin(a) * 0.115),
      hang: V3(-0.3, -1, Math.sin(a) * 0.2).normalize(),
      stream: V3(-1, -0.1, Math.sin(a) * 0.3).normalize(),
      flutter: V3(0, 0.75, 0.65).normalize(),
      side: V3(-Math.sin(a) * 0.3, 0, Math.cos(a)).normalize(),
      normal: V3(-Math.cos(a), 0.2, Math.sin(a)).normalize(),
      len: 0.36 + n(i, 3) * 0.1,
      width: 0.075,
      phase: i * 0.8,
      shade: 0.9 + n(i, 5) * 0.12,
    });
  }
  const hairR = ribbons(mats.hair, hairRoots, { segs: 6, colour: [C(0xe6e4de), C(0xfafaf8)] });
  head.add(hairR.mesh);
  const beardRoots = [];
  for (let i = 0; i < 7; i++) {
    const z = mix(-0.065, 0.065, i / 6);
    beardRoots.push({
      root: V3(0.09, -0.11, z),
      hang: V3(0.12, -1, z * 1.5).normalize(),
      stream: V3(-0.75, -0.65, z * 3).normalize(),
      flutter: V3(0, 0.3, 1).normalize(),
      side: V3(0, 0, 1),
      normal: V3(1, 0.2, 0).normalize(),
      len: 0.3 + n(i, 9) * 0.1,
      width: 0.05,
      phase: i * 1.1,
      shade: 0.92 + n(i, 11) * 0.1,
    });
  }
  const beard = ribbons(mats.hair, beardRoots, { segs: 5, colour: [C(0xeceae4), C(0xfafaf8)] });
  head.add(beard.mesh);
  // a pale cloak stays pale underneath, where only the ground lights it
  mats.whiteCloak ??= Object.assign(mats.cloth.clone(), { emissive: C(0x34332f) });
  const cloak = cloakSheet(mats.whiteCloak, { top: 0.66, half: 0.21, depth: 0.15, len: 1.1, color: 0xe2e0da, hem: 0xc4c2bc });
  torso.add(cloak.mesh);
  return { group: g, torso: pivot, head, hair: hairR, beard, cloak };
}

// Pippin riding in front of him, wide awake: a hobbit in the same
// proportions, his shirt and green jacket and breeches, bare hairy feet,
// curly brown hair, the elven cloak with its leaf brooch, both hands in
// the mane. `head` is a pivot (the gallop rolls it; he doesn't loll).
function seatedPippin(W, leaf) {
  const { mats } = W;
  const g = new THREE.Group();
  g.name = 'pippin';
  const skin = 0xeccaa8;
  const jacket = 0x4e5a30;
  const bk = parts();
  for (const s of [-1, 1]) {
    bk.add(mats.beast, tube([[0.0, 0.05, s * 0.07], [0.12, 0.02, s * 0.21], [0.2, -0.04, s * 0.27]], 0.064, 0.052, { seg: 5, radial: 8 }), { color: 0x5a4a34 });
    bk.add(mats.beast, tube([[0.2, -0.04, s * 0.27], [0.2, -0.18, s * 0.285], [0.17, -0.3, s * 0.285]], 0.046, 0.04, { seg: 4, radial: 7 }), { color: 0xe0b896 });
    bk.add(mats.beast, ball(0.062, 10, 8), { p: [0.21, -0.34, s * 0.285], s: [1.7, 0.65, 1.05], color: 0xd6a878 });
    bk.add(mats.hair, blob(0.046, { detail: 1, amp: 0.3, freq: 6, seed: 5 + s }), { p: [0.2, -0.3, s * 0.285], s: [1.3, 0.7, 1.1], color: 0x6a4020 });
  }
  bk.build(g);
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.rotation.z = -0.1;
  g.add(torso);
  const tk = parts();
  tk.add(mats.beast, lathe([[0.001, 0], [0.12, 0.0], [0.13, 0.1], [0.12, 0.24], [0.118, 0.34], [0.07, 0.4], [0.001, 0.42]], 14), { s: [0.82, 1, 1], color: 0xeee6d6 });
  tk.add(mats.beast, lathe([[0.126, 0.0], [0.136, 0.1], [0.128, 0.24], [0.122, 0.34]], 14, Math.PI * 0.62, Math.PI * 1.76), { s: [0.84, 1, 1.02], color: jacket });
  tk.add(mats.beast, cyl(0.035, 0.04, 0.08, 8), { p: [0, 0.44, 0], color: skin });
  for (const s of [-1, 1]) {
    tk.add(mats.beast, tube([[0.0, 0.36, s * 0.13], [0.1, 0.25, s * 0.16], [0.24, 0.17, s * 0.1], [0.3, 0.16, s * 0.07]], 0.037, 0.03, { seg: 7, radial: 7 }), { color: jacket });
    tk.add(mats.beast, ball(0.032, 7, 6), { p: [0.32, 0.155, s * 0.065], s: [1.2, 0.9, 1], color: skin });
  }
  // the hood bunched at his neck, and the leaf brooch
  tk.add(mats.cloth, new THREE.TorusGeometry(0.09, 0.04, 7, 14, Math.PI * 1.25), { p: [-0.02, 0.38, 0], r: [Math.PI / 2, 0, Math.PI / 2 + Math.PI * 0.125], s: [1, 1.15, 0.8], color: 0x66704f });
  tk.build(torso);
  const brooch = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), leaf);
  brooch.scale.set(0.6, 1.3, 1);
  brooch.position.set(0.1, 0.37, 0);
  torso.add(brooch);
  const pivot = new THREE.Group();
  pivot.position.set(0.02, 0.55, 0);
  torso.add(pivot);
  const head = new THREE.Group();
  head.name = 'head';
  head.rotation.x = -0.35;
  pivot.add(head);
  const hk = parts();
  hk.add(mats.beast, ball(0.105, 16, 12), { s: [1, 1.07, 0.93], color: skin });
  for (const s of [-1, 1]) {
    hk.add(mats.eye, ball(0.012, 8, 6), { p: [0.094, 0.018, s * 0.036], s: [0.7, 1, 1] });
    hk.add(mats.beast, new THREE.ConeGeometry(0.018, 0.05, 5), { p: [-0.005, 0.02, s * 0.097], r: [s * -1.2, 0, 0.4], s: [1, 1, 0.5], color: skin });
  }
  hk.add(mats.beast, ball(0.017, 6, 5), { p: [0.104, -0.012, 0], color: 0xe0b498 });
  const r = rng(23);
  for (let i = 0; i < 32; i++) {
    const a = r() * TAU;
    const up = 0.05 + r() * 0.95;
    const x = Math.cos(a) * Math.sqrt(1 - up * up);
    const z = Math.sin(a) * Math.sqrt(1 - up * up);
    if (x > 0.45 && up < 0.6) continue;
    hk.add(mats.hair, ball(0.032 + r() * 0.014, 5, 4), { p: [x * 0.1 - 0.01, up * 0.1 + 0.015, z * 0.1], color: r() < 0.5 ? 0x6a4020 : 0x7a4c28 });
  }
  hk.build(head);
  const cloak = cloakSheet(mats.cloth, { top: 0.4, half: 0.12, depth: 0.09, len: 0.55, color: 0x6a7452, hem: 0x5a6446 });
  torso.add(cloak.mesh);
  return { group: g, torso, head: pivot, cloak };
}

// Shadowfax: Asfaloth (../weathertop/props.js) made silver-white all over,
// with no saddle-cloth, no bridle, no reins; Gandalf behind, Pippin in front.
// Still runs with that file's gallop(a, t, speed).
function shadowfax(W, glow, leaf) {
  const a = W.asfaloth();
  const { mats } = W;
  const drop = (o) => {
    o.removeFromParent();
    o.traverse((m) => m.geometry?.dispose());
  };
  drop(a.arwen.group);
  drop(a.frodo.group);
  for (const m of [...a.body.children]) if (m.isMesh && m.material === mats.cloth) drop(m);
  for (const m of [...a.horse.head.children]) if (m.isMesh && m.material === mats.silver) drop(m);
  for (const m of [...a.group.children]) if (m.isMesh && m.material === mats.silver) drop(m);
  // silver-white, his hooves grey
  const coat = mats.coat.clone();
  coat.roughness = 0.44;
  coat.emissive = C(0x15171b);
  const sw = C(0xf6f7fa);
  const hoof = C(0x58565c);
  const c = new THREE.Color();
  a.group.traverse((m) => {
    if (!m.isMesh) return;
    const col = m.geometry.attributes.color;
    if (m.material === mats.coat) {
      m.material = coat;
      for (let i = 0; i < col.count; i++) {
        c.fromBufferAttribute(col, i);
        const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
        if (lum < 0.2) c.copy(hoof);
        else c.lerp(sw, 0.6);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    } else if (m.material === mats.silverHair && col) {
      for (let i = 0; i < col.count; i++) {
        c.fromBufferAttribute(col, i).lerp(sw, 0.45);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    }
  });
  const gandalf = seatedGandalf(W, glow);
  gandalf.group.position.set(-0.2, 1.69, 0);
  a.body.add(gandalf.group);
  const pippin = seatedPippin(W, leaf);
  pippin.group.position.set(0.3, 1.71, 0);
  a.body.add(pippin.group);
  // what gallop() drives: Arwen's lean is now Gandalf's, Frodo's Pippin's
  a.arwen = { group: gandalf.group, torso: gandalf.torso, head: gandalf.head };
  a.frodo = { group: pippin.group, torso: pippin.torso, head: pippin.head };
  a.flow.hair = {
    flow: (t, k) => {
      gandalf.hair.flow(t, k);
      gandalf.beard.flow(t, k);
    },
  };
  a.flow.cloak = {
    flow: (t, k) => {
      gandalf.cloak.flow(t, k);
      pippin.cloak.flow(t, k);
    },
  };
  a.drawReins = () => {};
  a.gandalf = gandalf;
  a.pippin = pippin;
  a.riders = { gandalf: gandalf.group, pippin: pippin.group };
  a.group.name = 'shadowfax';
  gallop(a, 0, 0);
  return a;
}

// ── the engines ──

// A squared timber from a to b, `t` thick, into a parts list.
const _q = new THREE.Quaternion();
const _y = V3(0, 1, 0);
function timber(bk, mat, a, b, t, { uv = 0.5, d = 0.9 } = {}) {
  const A = V3(...a);
  const D = V3(...b).sub(A);
  const len = D.length();
  const geo = new THREE.BoxGeometry(t, len, t * d);
  _q.setFromUnitVectors(_y, D.normalize());
  geo.applyMatrix4(new THREE.Matrix4().compose(A.add(V3(...b)).multiplyScalar(0.5), _q, V3(1, 1, 1)));
  bk.add(mat, geo, { uv });
}

// A dressed block of the city's white stone, about a metre: squared, its
// edges worn and chipped, a moulding cut along one face.
function stoneGeo(seed = 3, size = 1) {
  const n = makeNoise(seed);
  const g = new THREE.BoxGeometry(1, 0.64, 0.76, 8, 10, 6);
  const p = g.attributes.position;
  const v = V3();
  const half = V3(0.5, 0.32, 0.38);
  const bev = 0.05;
  const inner = half.clone().subScalar(bev);
  const cl = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // the moulding: a roll and two fillets along the +x face
    if (v.x > 0.49) {
      const yy = v.y / 0.32;
      v.x -= 0.035 * smooth(0.15, 0.3, Math.abs(yy - 0.15)) * (1 - smooth(0.55, 0.65, Math.abs(yy - 0.15))) + 0.02 * smooth(0.7, 0.8, yy);
    }
    cl.copy(v).clamp(inner.clone().negate(), inner);
    const out = v.clone().sub(cl);
    if (out.lengthSq() > 1e-8) v.copy(cl).add(out.normalize().multiplyScalar(bev));
    // chips: bites out of edges and corners
    const edge = smooth(0.06, 0.0, Math.min(half.x - Math.abs(v.x), half.y - Math.abs(v.y)) + Math.min(half.y - Math.abs(v.y), half.z - Math.abs(v.z)) * 0.5);
    const dent = smooth(0.55, 0.8, noise3(n, v.x * 5, v.y * 5, v.z * 5)) * 0.07 * edge;
    v.multiplyScalar(1 - dent);
    p.setXYZ(i, v.x * size, v.y * size, v.z * size);
  }
  let geo = g.toNonIndexed();
  geo.computeVertexNormals();
  geo = boxUV(geo, 1.2 / size);
  const base = C(0xebe7de);
  const grime = C(0xa69e90);
  const fresh = C(0xfbf9f4);
  fillColor(geo, (x, y, z, out) => {
    const m = noise3(n, x * 4 / size, y * 4 / size, z * 4 / size);
    out.copy(base).multiplyScalar(0.92 + m * 0.12);
    out.lerp(grime, smooth(0.55, 0.75, noise3(n, x * 1.5 + 7, y * 2, z * 1.5)) * 0.35);
    const r = Math.max(Math.abs(x) / 0.5, Math.abs(y) / 0.32, Math.abs(z) / 0.38) / size;
    out.lerp(fresh, smooth(0.97, 0.9, r) * 0.25);
  });
  return geo;
}

// One of the city's trebuchets, about 12 m with its arm up: a frame of great
// timbers on two sills, the arm on its axle between two A-frames, the
// counterweight box full of stones hanging from its short end, the sling
// from the long one, and a winch with two spoked wheels at the back. It
// throws towards +x. set(k): 0 cocked (the long arm down at the back, the
// sling laid along the trough under it, loaded), 1 thrown (the arm up
// forward, the sling empty); the stone leaves the sling at `release`.
const AXLE = 6.6;
const LONG = 8.6;
const SHORT = 2.4;
const PHI0 = (220 / 180) * Math.PI;
const PHI1 = (68 / 180) * Math.PI;
const SLING = 3.4;
const RELEASE = 0.8;
function trebuchet(MS) {
  const { mats } = MS;
  const W = mats.engineWood;
  const I = mats.iron;
  const g = new THREE.Group();
  g.name = 'trebuchet';
  const bk = parts();
  // the sills and the ties across them
  for (const s of [-1, 1]) {
    timber(bk, W, [-4.6, 0.25, s * 1.55], [4.6, 0.25, s * 1.55], 0.5);
    for (const x of [-4.4, -2.9, 0, 2.9, 4.4]) bk.add(I, B(0.08, 0.54, 0.56), { p: [x, 0.25, s * 1.55] });
  }
  for (const x of [-4.2, -1.6, 1.6, 4.2]) timber(bk, W, [x, 0.3, -1.85], [x, 0.3, 1.85], 0.42);
  // the trough the sling lies in when cocked
  for (const s of [-1, 1]) timber(bk, W, [-4.3, 0.55, s * 0.42], [-0.9, 0.55, s * 0.42], 0.16);
  timber(bk, W, [-4.3, 0.45, 0], [-0.9, 0.45, 0], 0.12, { d: 6 });
  // the A-frames and their posts, a tie across each, the bearing blocks
  for (const s of [-1, 1]) {
    const z = s * 1.35;
    for (const e of [-1, 1]) timber(bk, W, [e * 2.9, 0.5, z], [e * 0.3, AXLE - 0.15, z], 0.42);
    timber(bk, W, [0, 0.5, z], [0, AXLE - 0.3, z], 0.4);
    timber(bk, W, [-1.65, 3.1, z], [1.65, 3.1, z], 0.34);
    timber(bk, W, [-0.9, 1.0, z], [0.9, 1.0, z], 0.3);
    bk.add(W, roundBox(0.9, 0.62, 0.56, 0.05), { p: [0, AXLE, z], uv: 0.5 });
    bk.add(I, B(0.95, 0.07, 0.6), { p: [0, AXLE + 0.2, z] });
    bk.add(I, B(0.95, 0.07, 0.6), { p: [0, AXLE - 0.2, z] });
    // the props that take the throw, and the ones behind
    timber(bk, W, [4.4, 0.5, s * 1.55], [1.15, 4.6, z], 0.34);
    timber(bk, W, [-4.4, 0.5, s * 1.55], [-1.15, 4.6, z], 0.3);
    // bolt heads along the sills
    for (let x = -4.2; x <= 4.2; x += 0.7) bk.add(I, cyl(0.045, 0.045, 0.06, 6), { p: [x, 0.42, s * 1.81], r: [Math.PI / 2, 0, 0] });
  }
  // the winch at the back: an axle on two stocks, a drum of rope, two wheels
  const WX = -3.9;
  const WY = 1.4;
  for (const s of [-1, 1]) timber(bk, W, [WX, 0.5, s * 1.55], [WX, WY + 0.2, s * 1.55], 0.32);
  bk.add(W, cylZ(0.17, 4.5, 10), { p: [WX, WY, 0], uv: 0.6 });
  bk.add(mats.rope, cylZ(0.32, 0.9, 14), { p: [WX, WY, 0] });
  for (const s of [-1, 1]) {
    const z = s * 2.08;
    bk.add(W, tf(new THREE.TorusGeometry(1.0, 0.07, 6, 28), { p: [WX, WY, z] }), { uv: 0.8 });
    bk.add(I, tf(new THREE.TorusGeometry(1.06, 0.022, 4, 28), { p: [WX, WY, z] }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      bk.add(W, B(0.09, 1.95, 0.08), { p: [WX, WY, z], r: [0, 0, a], uv: 0.8 });
      bk.add(W, cylZ(0.035, 0.38, 6), { p: [WX + Math.cos(a + TAU / 16) * 1.0, WY + Math.sin(a + TAU / 16) * 1.0, z + s * 0.16] });
    }
    bk.add(I, cylZ(0.22, 0.24, 10), { p: [WX, WY, z] });
  }
  bk.build(g);

  // the arm, on its axle
  const arm = new THREE.Group();
  arm.name = 'arm';
  arm.position.set(0, AXLE, 0);
  g.add(arm);
  const ak = parts();
  const beam = new THREE.BoxGeometry(LONG + SHORT + 0.3, 1, 1, 14, 1, 1).translate((LONG - SHORT - 0.3) / 2, 0, 0);
  const thick = (x) => (x > 0 ? mix(0.62, 0.26, Math.pow(x / LONG, 0.85)) : mix(0.62, 0.5, -x / SHORT));
  {
    const p = beam.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const t = thick(x);
      p.setXYZ(i, x, p.getY(i) * t, p.getZ(i) * t * 0.82);
    }
    beam.computeVertexNormals();
  }
  ak.add(W, beam, { uv: 0.5 });
  for (const x of [-2.0, -1.0, 0.9, 2.5, 4.2, 5.9, 7.4]) {
    const t = thick(x) + 0.05;
    ak.add(I, B(0.09, t, t * 0.82), { p: [x, 0, 0] });
  }
  // cheeks either side at the hub, the axle through them
  for (const s of [-1, 1]) ak.add(W, roundBox(1.5, 1.1, 0.14, 0.04), { p: [0, 0, s * 0.33], uv: 0.6 });
  ak.add(W, cylZ(0.22, 2.9, 12), { uv: 0.6 });
  for (const s of [-1, 1]) ak.add(I, cylZ(0.28, 0.12, 12), { p: [0, 0, s * 1.46] });
  // the prong at the tip, the pin at the short end
  ak.add(I, tf(new THREE.ConeGeometry(0.06, 0.5, 6), { r: [0, 0, -Math.PI / 2], p: [LONG + 0.2, 0.0, 0] }));
  ak.add(I, new THREE.TorusGeometry(0.1, 0.025, 5, 10), { p: [LONG - 0.1, -0.16, 0] });
  ak.add(I, cylZ(0.08, 1.5, 8), { p: [-SHORT, 0, 0] });
  ak.build(arm);

  // the counterweight, hanging plumb from the pin
  const cw = new THREE.Group();
  cw.name = 'counterweight';
  cw.position.set(-SHORT, 0, 0);
  arm.add(cw);
  const ck = parts();
  for (const s of [-1, 1]) ck.add(I, B(0.12, 1.25, 0.07), { p: [0, -0.58, s * 0.62] });
  const BW = 1.9;
  const BH = 1.6;
  const BD = 1.7;
  const by = -1.2 - BH / 2;
  ck.add(W, B(BW, 0.14, BD), { p: [0, by - BH / 2 + 0.07, 0], uv: 0.6 });
  for (const s of [-1, 1]) {
    ck.add(W, B(BW, BH, 0.12), { p: [0, by, s * (BD / 2 - 0.06)], uv: 0.6 });
    ck.add(W, B(0.12, BH, BD), { p: [s * (BW / 2 - 0.06), by, 0], uv: 0.6 });
    ck.add(W, B(BW + 0.06, 0.16, 0.16), { p: [0, -1.2, s * (BD / 2)], uv: 0.6 });
  }
  for (const y of [by - BH * 0.3, by + BH * 0.3]) ck.add(I, B(BW + 0.05, 0.07, BD + 0.05), { p: [0, y, 0] });
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) ck.add(I, B(0.08, BH + 0.02, 0.08), { p: [x * (BW / 2 + 0.01), by, z * (BD / 2 + 0.01)] });
  const r = rng(77);
  for (let i = 0; i < 9; i++) ck.add(mats.masonry, blob(0.32 + r() * 0.14, { detail: 1, amp: 0.25, seed: 70 + i }), { p: [(r() - 0.5) * 1.1, -1.25 + r() * 0.25, (r() - 0.5) * 1.0], color: 0xd8d2c6 });
  ck.build(cw);

  // the sling, from the tip: two ropes to a leather pouch, the stone in it
  const sling = new THREE.Group();
  sling.name = 'sling';
  sling.position.set(LONG, 0, 0);
  arm.add(sling);
  const sk = parts();
  for (const s of [-1, 1]) sk.add(mats.rope, tube([[0, 0, 0], [SLING * 0.5, -0.04, s * 0.2], [SLING - 0.3, -0.05, s * 0.34]], 0.03, 0.03, { seg: 6, radial: 5 }));
  sk.add(mats.pouch, new THREE.SphereGeometry(0.46, 12, 6, 0, TAU, Math.PI * 0.5, Math.PI * 0.5), { p: [SLING, 0.12, 0], s: [1.05, 0.6, 0.9] });
  sk.build(sling);
  const stone = new THREE.Mesh(MS.stoneGeo(), mats.masonry);
  stone.name = 'stone';
  stone.scale.setScalar(0.72);
  stone.position.set(SLING, 0.18, 0);
  stone.castShadow = true;
  sling.add(stone);

  // the rope that holds it cocked, from the winch to the tip
  const trip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1).translate(0, 0.5, 0), mats.rope);
  g.add(trip);
  const from = V3(WX + 0.2, WY + 0.3, 0);
  const tip = V3();
  const rel = (k) => (k <= RELEASE ? mix(2.29, -0.2, smooth(0.04, RELEASE, k)) : mix(-0.2, -1.05, smooth(RELEASE, 1, k)));
  const set = (k = 0) => {
    const kk = clamp01(k);
    const e = 0.5 - 0.5 * Math.cos(Math.PI * kk);
    const phi = mix(PHI0, PHI1, e);
    arm.rotation.z = phi;
    // the weight lags as it drops, and swings after
    cw.rotation.z = -phi - 0.35 * Math.sin(Math.PI * Math.min(1, kk * 1.15)) * (1 - kk * 0.4);
    sling.rotation.z = rel(kk);
    stone.visible = kk < RELEASE;
    trip.visible = kk < 0.03;
    if (trip.visible) {
      tip.set(Math.cos(phi) * (LONG - 0.4), AXLE + Math.sin(phi) * (LONG - 0.4), 0);
      const d = tip.clone().sub(from);
      trip.position.copy(from);
      trip.scale.set(1, d.length(), 1);
      trip.quaternion.setFromUnitVectors(_y, d.normalize());
    }
  };
  set(0);
  // where the stone is, in the world, now (to throw one from)
  const stoneAt = (out = V3()) => {
    stone.updateWorldMatrix(true, false);
    return stone.getWorldPosition(out);
  };
  return { group: g, arm, set, stone, stoneAt, release: RELEASE };
}

// A siege-tower of Mordor, 18 m high on six great wheels: black timber,
// raw hides hung over its sides, iron spikes out of its front, a parapet of
// sharpened stakes round the top and the drawbridge on the front of the top
// storey, drawn up. Its front faces -x (towards the city). set(fall):
// 0 standing, 1 down: it goes over backwards, rolling a little, its top
// breaking away and the drawbridge swinging loose.
const TH = 18;
const TB0 = 7;
const TB1 = 5.2;
function siegeTower(MS, seed = 1) {
  const { mats } = MS;
  const W = mats.towerWood;
  const I = mats.towerIron;
  const Hd = mats.hide;
  const g = new THREE.Group();
  g.name = 'siegeTower';
  // it falls about its back edge
  const tilt = new THREE.Group();
  tilt.position.set(TB0 / 2, 0, 0);
  g.add(tilt);
  const body = new THREE.Group();
  body.position.set(-TB0 / 2, 0, 0);
  tilt.add(body);
  const Y0 = 1.9;
  const BREAK = 13;
  const hs = (y) => mix(TB0 / 2 - 0.35, TB1 / 2, clamp01((y - Y0) / (TH - 1.6 - Y0)));
  const n = makeNoise(41 + seed);
  const r = rng(41 + seed);
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const LEVELS = [Y0, 5.6, 9.3, BREAK, 16.4];

  // hides over a face between two heights: sagging, ragged at the hem,
  // narrower than the face so the posts show
  const tones = [C(0x7a5a3e), C(0x6a4c34), C(0x8a6a48), C(0x5a4230)];
  const blotch = C(0x22180f);
  const hideGeo = (sx, sz, y0, y1) => {
    const cols = 6;
    const rows = 5;
    const pos = [];
    const idx = [];
    const h0 = hs(y0) - 0.08;
    const h1 = hs(y1) - 0.08;
    const seedK = r() * 10;
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      const half = mix(h1, h0, v);
      for (let i = 0; i <= cols; i++) {
        const u = i / cols - 0.5;
        const rag = j === rows ? (n(i * 2.3 + seedK, 7) - 0.25) * 1.3 : 0;
        const y = mix(y1 - 0.25, y0 + 0.35, v) - rag;
        const sag = Math.sin((i / cols) * Math.PI) * (0.22 + 0.2 * v) + (n(i * 1.7 + seedK, j * 1.3) - 0.5) * 0.18;
        const along = u * 2 * (half - 0.42) + (j === rows ? (n(i + seedK, 3) - 0.5) * 0.2 : 0);
        const out = half + sag;
        if (sx) pos.push(sx * out, y, along);
        else pos.push(along, y, sz * out);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const base = tones[Math.floor(r() * tones.length)];
    fillColor(geo, (x, y, z, out) => {
      out.copy(base).multiplyScalar(0.75 + noise3(n, x * 0.9, y * 0.9, z * 0.9) * 0.5);
      out.lerp(blotch, smooth(0.58, 0.72, noise3(n, x * 1.6 + 5, y * 1.6, z * 1.6)) * 0.7);
    });
    return geo;
  };
  // lashings at a hide's top corners
  const lash = (bk, sx, sz, y) => {
    const h = hs(y) - 0.3;
    for (const e of [-1, 1]) {
      const at = sx ? [sx * (h + 0.2), y - 0.3, e * h] : [e * h, y - 0.3, sz * (h + 0.2)];
      bk.add(mats.rope, cyl(0.05, 0.05, 0.5, 5), { p: at, r: [sx ? 0 : 0.6 * e, 0, sx ? 0.6 * e : 0] });
    }
  };

  // a storey's frame: corner posts, girders round, braces across each face
  const frame = (bk, y0, y1, { front = true } = {}) => {
    for (const [cx, cz] of corners) timber(bk, W, [cx * hs(y0), y0, cz * hs(y0)], [cx * hs(y1), y1 + 0.2, cz * hs(y1)], 0.5);
    const h = hs(y1);
    for (const s of [-1, 1]) {
      timber(bk, W, [-h - 0.55, y1, s * h], [h + 0.55, y1, s * h], 0.38);
      timber(bk, W, [s * h, y1, -h - 0.55], [s * h, y1, h + 0.55], 0.38);
    }
    const faces = [[1, 0], [0, 1], [0, -1], ...(front ? [[-1, 0]] : [])];
    for (const [fx, fz] of faces) {
      const p = (y, side) => (fx ? [fx * hs(y), y, side * hs(y)] : [side * hs(y), y, fz * hs(y)]);
      timber(bk, W, p(y0 + 0.2, -1), p(y1 - 0.2, 1), 0.24);
      timber(bk, W, p(y0 + 0.2, 1), p(y1 - 0.2, -1), 0.24);
    }
  };
  const spikes = (bk, y, k = 8) => {
    const h = hs(y);
    for (let i = 0; i < k; i++) {
      const z = mix(-h + 0.3, h - 0.3, i / (k - 1));
      const L = 1.2 + r() * 0.7;
      bk.add(I, tf(new THREE.ConeGeometry(0.09, L, 5), { r: [(r() - 0.5) * 0.3, 0, Math.PI / 2 + 0.25 + (r() - 0.5) * 0.25], p: [-h - 0.35 - L * 0.45, y + (r() - 0.5) * 0.3 - L * 0.1, z] }));
    }
  };
  // a plate of iron on the front, riveted
  const plate = (bk, y0, y1) => {
    const h0 = hs(y0);
    const h1 = hs(y1);
    const hh = (h0 + h1) / 2;
    const ym = (y0 + y1) / 2;
    const lean = Math.atan2(h0 - h1, y1 - y0);
    bk.add(I, B(0.1, y1 - y0 - 0.5, hh * 1.5), { p: [-hh - 0.32, ym, 0], r: [0, 0, -lean] });
    for (let i = 0; i < 6; i++) for (const e of [-1, 1]) bk.add(I, ball(0.07, 5, 4), { p: [-hh - 0.39, mix(y0 + 0.5, y1 - 0.5, i / 5), e * hh * 0.7] });
  };

  const lk = parts();
  // the chassis on its axles, and the wheels
  for (const s of [-1, 1]) timber(lk, W, [-TB0 / 2 - 0.3, 1.45, s * (TB0 / 2 - 0.35)], [TB0 / 2 + 0.3, 1.45, s * (TB0 / 2 - 0.35)], 0.7);
  for (const x of [-2.4, 0, 2.4]) {
    timber(lk, W, [x, 1.15, -TB0 / 2 - 0.5], [x, 1.15, TB0 / 2 + 0.5], 0.36);
    for (const s of [-1, 1]) {
      const z = s * (TB0 / 2 + 0.22);
      lk.add(W, tf(new THREE.CylinderGeometry(1.12, 1.12, 0.38, 18), { r: [Math.PI / 2, 0, 0], p: [x, 1.15, z] }), { uv: 0.6 });
      lk.add(I, tf(new THREE.TorusGeometry(1.12, 0.06, 4, 22), { p: [x, 1.15, z] }));
      lk.add(I, tf(new THREE.CylinderGeometry(0.28, 0.32, 0.5, 8), { r: [Math.PI / 2, 0, 0], p: [x, 1.15, z + s * 0.08] }));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        lk.add(I, tf(new THREE.ConeGeometry(0.05, 0.16, 4), { r: [s * Math.PI / 2, 0, 0], p: [x + Math.cos(a) * 0.75, 1.15 + Math.sin(a) * 0.75, z + s * 0.23] }));
      }
    }
  }
  timber(lk, W, [-TB0 / 2 - 0.3, 1.45, 0], [TB0 / 2 + 0.3, 1.45, 0], 0.5);
  for (let k = 0; k < 3; k++) frame(lk, LEVELS[k], LEVELS[k + 1]);
  // the hides on the lower storeys (the back of the bottom one open, for
  // the ladder), and a plate of iron and spikes on its front
  for (let k = 0; k < 3; k++) {
    const y0 = LEVELS[k];
    const y1 = LEVELS[k + 1];
    for (const s of [-1, 1]) {
      if (k === 1 && s === (seed % 2 ? 1 : -1)) continue;
      lk.add(Hd, hideGeo(0, s, y0, y1));
      lash(lk, 0, s, y1);
    }
    if (k === 0) lk.add(Hd, hideGeo(-1, 0, y0, y1));
    else plate(lk, y0, y1);
    if (k > 0) lk.add(Hd, hideGeo(1, 0, y0, y1));
    spikes(lk, y1 - 0.6);
    if (k === 0) spikes(lk, y0 + 1.6, 6);
  }
  // the ladder up the inside of the back
  for (const s of [-1, 1]) timber(lk, W, [hs(Y0) - 0.6, Y0, s * 0.45], [hs(BREAK) - 0.6, BREAK, s * 0.45], 0.12);
  for (let y = Y0 + 0.5; y < BREAK; y += 0.55) {
    const x = mix(hs(Y0) - 0.6, hs(BREAK) - 0.6, (y - Y0) / (BREAK - Y0));
    lk.add(W, cylZ(0.05, 0.95, 5), { p: [x, y, 0], uv: 0.6 });
  }
  lk.build(body);

  // the top storey, which breaks away as it falls
  const upper = new THREE.Group();
  upper.name = 'top';
  upper.position.set(hs(BREAK), BREAK, 0);
  body.add(upper);
  const top = new THREE.Group();
  top.position.set(-hs(BREAK), -BREAK, 0);
  upper.add(top);
  const uk = parts();
  frame(uk, BREAK, LEVELS[4], { front: false });
  for (const s of [-1, 1]) uk.add(Hd, hideGeo(0, s, BREAK, LEVELS[4]));
  uk.add(Hd, hideGeo(1, 0, BREAK, LEVELS[4]));
  // the fighting floor and the stakes round it
  const ft = hs(LEVELS[4]);
  uk.add(W, B(ft * 2 + 0.3, 0.2, ft * 2 + 0.3), { p: [0, LEVELS[4] + 0.1, 0], uv: 0.5 });
  for (let i = 0; i < 32; i++) {
    const side = Math.floor(i / 8);
    const u = ((i % 8) + 0.5) / 8 - 0.5;
    const L = ft * 2 * u;
    const at = [[L, ft + 0.05], [ft + 0.05, L], [L, -ft - 0.05], [-ft - 0.05, L]][side];
    const [x, z] = side % 2 ? [at[0], at[1]] : [at[0], at[1]];
    const h = 1.4 + r() * 0.5;
    const lean = (r() - 0.5) * 0.12;
    uk.add(W, cyl(0.085, 0.1, h, 6), { p: [x, LEVELS[4] + h / 2, z], r: [lean, 0, lean], uv: 0.8 });
    uk.add(W, new THREE.ConeGeometry(0.085, 0.3, 6), { p: [x, LEVELS[4] + h + 0.15, z], r: [lean, 0, lean], uv: 0.8 });
  }
  timber(uk, W, [-ft, LEVELS[4] + 1.0, -ft], [-ft, LEVELS[4] + 1.0, ft], 0.16);
  timber(uk, W, [ft, LEVELS[4] + 1.0, -ft], [ft, LEVELS[4] + 1.0, ft], 0.16);
  // the posts either side of the door, and a ragged black banner
  for (const s of [-1, 1]) timber(uk, W, [-hs(BREAK), BREAK, s * 1.95], [-hs(LEVELS[4]), LEVELS[4] + 0.6, s * 1.95], 0.3);
  timber(uk, W, [ft - 0.4, LEVELS[4], ft - 0.4], [ft - 0.4, TH + 3.2, ft - 0.4], 0.14);
  {
    const geo = new THREE.PlaneGeometry(1.6, 2.2, 4, 5);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setXYZ(i, x + 0.8, y - (y < -1 ? (n(x * 5, 3) - 0.3) * 0.6 : 0), Math.sin(x * 2.2) * 0.12);
    }
    geo.computeVertexNormals();
    fillColor(geo, (x, y, z, out) => out.setHex(0x161212).lerp(C(0x5a1a10), smooth(0.25, 0.05, Math.hypot(x - 0.8, y - 0.2)) * 0.9));
    uk.add(Hd, geo, { p: [ft - 0.4, TH + 1.9, ft - 0.4], r: [0, -Math.PI / 4, 0] });
  }
  uk.build(top);

  // the drawbridge, hinged at its foot on the front of the top storey;
  // rotation.z 0 drawn up, π/2 let down towards the city
  const bridge = new THREE.Group();
  bridge.name = 'bridge';
  bridge.position.set(-hs(BREAK) - 0.25, BREAK + 0.1, 0);
  top.add(bridge);
  const bkb = parts();
  const BL = LEVELS[4] - BREAK + 1.2;
  bkb.add(W, B(0.24, BL, 3.6), { p: [-0.12, BL / 2, 0], uv: 0.5 });
  for (const y of [0.4, BL / 2, BL - 0.4]) bkb.add(W, B(0.18, 0.26, 3.8), { p: [-0.3, y, 0], uv: 0.5 });
  for (const s of [-1, 1]) bkb.add(W, B(0.18, BL, 0.26), { p: [-0.3, BL / 2, s * 1.7], uv: 0.5 });
  for (let i = 0; i < 9; i++) bkb.add(I, new THREE.ConeGeometry(0.07, 0.5, 4), { p: [-0.12, BL + 0.22, -1.6 + i * 0.4] });
  bkb.add(I, cylZ(0.1, 3.8, 8), { p: [0.05, 0.05, 0] });
  bkb.build(bridge);

  const set = (fall = 0) => {
    const f = clamp01(fall);
    const e = f * f;
    tilt.rotation.set(0.24 * e * (seed % 2 ? 1 : -1), 0, -1.42 * e);
    tilt.position.y = -0.35 * smooth(0.75, 1, f);
    upper.rotation.z = -0.62 * smooth(0.3, 1, f);
    upper.position.x = hs(BREAK) + 1.4 * smooth(0.4, 1, f);
    bridge.rotation.z = 1.35 * smooth(0.05, 0.55, f) + Math.sin(f * 14) * 0.08 * f * (1 - f);
  };
  set(0);
  return { group: g, set, bridge, top: upper };
}

// ── in the way, on the road up ──

// A Gondorian hand-cart, its shafts down on the road: two wheels, a bed of
// planks, sacks, a barrel, a basket of greens and apples, a crate.
function cart(MS) {
  const { mats, K } = MS;
  const g = new THREE.Group();
  g.name = 'cart';
  const bk = parts();
  const bedY = 0.78;
  for (const s of [-1, 1]) {
    const z = s * 0.62;
    bk.add(mats.wood, tf(new THREE.TorusGeometry(0.4, 0.05, 6, 22), { p: [-0.1, 0.45, z] }), { uv: 1.4 });
    bk.add(mats.iron, tf(new THREE.TorusGeometry(0.44, 0.022, 4, 22), { p: [-0.1, 0.45, z] }));
    for (let i = 0; i < 8; i++) bk.add(mats.wood, B(0.04, 0.8, 0.04), { p: [-0.1, 0.45, z], r: [0, 0, (i / 8) * Math.PI], uv: 1.4 });
    bk.add(mats.wood, cylZ(0.08, 0.2, 10), { p: [-0.1, 0.45, z] });
  }
  bk.add(mats.iron, cylZ(0.03, 1.4, 6), { p: [-0.1, 0.45, 0] });
  bk.add(mats.timber, B(1.6, 0.1, 0.12), { p: [0.05, 0.6, 0.35], uv: 1.2 });
  bk.add(mats.timber, B(1.6, 0.1, 0.12), { p: [0.05, 0.6, -0.35], uv: 1.2 });
  // the bed tips forward a little, onto its shafts
  bk.at([0, 0, 0], [0, 0, -0.05], () => {
    bk.add(mats.wood, roundBox(1.6, 0.07, 1.0, 0.02), { p: [0.05, bedY - 0.1, 0], uv: 1.2 });
    for (const s of [-1, 1]) {
      bk.add(mats.wood, roundBox(1.6, 0.26, 0.05, 0.015), { p: [0.05, bedY + 0.05, s * 0.5], uv: 1.2 });
      for (const x of [-0.65, 0.05, 0.75]) bk.add(mats.timber, B(0.06, 0.38, 0.06), { p: [x, bedY + 0.06, s * 0.53], uv: 1.2 });
    }
    bk.add(mats.wood, roundBox(0.05, 0.26, 1.0, 0.015), { p: [-0.74, bedY + 0.05, 0], uv: 1.2 });
    for (const s of [-1, 1]) bk.add(mats.wood, tube([[0.8, bedY - 0.12, s * 0.36], [1.1, 0.35, s * 0.36], [1.25, 0.06, s * 0.34]], 0.04, 0.034, { seg: 6, radial: 6 }));
    // the load
    const r = rng(9);
    for (const [x, z, ry] of [[-0.45, 0.22, 0.3], [-0.45, -0.24, -0.2], [-0.05, -0.25, 0.1]]) bk.add(mats.sack, blob(0.22, { detail: 2, amp: 0.12, seed: 11 + Math.round(x * 10) }), { p: [x, bedY + 0.16, z], s: [1.3, 0.85, 0.95], r: [0, ry, 0] });
    bk.add(mats.sack, blob(0.2, { detail: 2, amp: 0.12, seed: 19 }), { p: [-0.42, bedY + 0.42, 0], s: [1.3, 0.8, 1], r: [0.2, 0.4, 0] });
    bk.at([0.32, bedY - 0.06, 0.22], 0, () => barrelParts(bk, K, { h: 0.55, r: 0.2 }));
    bk.add(mats.wood, roundBox(0.38, 0.32, 0.38, 0.015), { p: [0.4, bedY + 0.1, -0.22], r: [0, 0.2, 0], uv: 1.6 });
    bk.add(mats.food, cyl(0.2, 0.16, 0.2, 12, true), { p: [0.02, bedY + 0.06, 0.18], color: 0xa8804a });
    for (let i = 0; i < 7; i++) {
      const a = r() * TAU;
      const d = r() * 0.12;
      const green = i < 3;
      bk.add(mats.food, green ? blob(0.08, { detail: 1, amp: 0.2, seed: i }) : ball(0.05, 8, 6), { p: [0.02 + Math.cos(a) * d, bedY + 0.17 + r() * 0.04, 0.18 + Math.sin(a) * d], color: green ? 0x6a9a3a : 0xb0302a });
    }
  });
  bk.build(g);
  return g;
}

// Barrels: three standing, one on its side, a lid off.
function barrels(MS) {
  const { mats, K } = MS;
  const g = new THREE.Group();
  g.name = 'barrels';
  const bk = parts();
  for (const [x, z, h, rr] of [[-0.3, -0.35, 0.95, 0.32], [0.35, -0.3, 0.85, 0.29], [-0.15, 0.32, 0.9, 0.31]]) bk.at([x, 0, z], x, () => barrelParts(bk, K, { h, r: rr }));
  bk.at([0.45, 0.3, 0.45], [Math.PI / 2, 0.6, 0], () => barrelParts(bk, K, { h: 0.85, r: 0.29 }));
  bk.add(mats.wood, cyl(0.24, 0.24, 0.04, 12), { p: [0.75, 0.02, -0.05], uv: 1.6 });
  bk.build(g);
  return g;
}

// Crates, stacked, a sack against them.
function crates(MS) {
  const { mats } = MS;
  const g = new THREE.Group();
  g.name = 'crates';
  const bk = parts();
  const crate = (x, y, z, s, ry) =>
    bk.at([x, y, z], ry, () => {
      bk.add(mats.wood, roundBox(s, s, s, 0.01), { p: [0, s / 2, 0], uv: 1.6 });
      const e = s / 2;
      for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        bk.add(mats.timber, B(0.06, s + 0.01, 0.06), { p: [a * e, e, b * e] });
        bk.add(mats.timber, B(s + 0.01, 0.06, 0.06), { p: [0, e + a * e, b * e] });
        bk.add(mats.timber, B(0.06, 0.06, s + 0.01), { p: [b * e, e + a * e, 0] });
      }
      bk.add(mats.timber, B(0.05, s * 1.3, 0.06), { p: [0, e, e + 0.02], r: [0, 0, 0.78] });
    });
  crate(-0.35, 0, -0.3, 0.7, 0.1);
  crate(0.4, 0, -0.25, 0.62, -0.25);
  crate(-0.05, 0.7, -0.28, 0.55, 0.4);
  crate(0.1, 0, 0.45, 0.5, 0.7);
  bk.add(mats.sack, blob(0.25, { detail: 2, amp: 0.12, seed: 5 }), { p: [-0.6, 0.22, 0.38], s: [1, 0.9, 1.2] });
  bk.build(g);
  return g;
}

// A few hens, pecking; userData.hens to move them, peck(t) to peck.
function hens(MS) {
  const { mats } = MS;
  const g = new THREE.Group();
  g.name = 'hens';
  const r = rng(31);
  const list = [];
  const n = makeNoise(31);
  const spots = [[0.1, 0.0, 0.3], [-0.55, 0.35, 2.2], [0.5, -0.45, -1.2], [-0.3, -0.5, 1.0], [0.65, 0.4, -2.6]];
  spots.forEach(([x, z, face], i) => {
    const hen = new THREE.Group();
    hen.position.set(x, 0, z);
    hen.rotation.y = face;
    const bk = parts();
    const brown = i % 3 !== 1;
    const coat = brown ? C(0x9a5a2a) : C(0xf0ece2);
    const dark = brown ? C(0x5a3014) : C(0xc8c0b0);
    const col = (px, py, pz, out) => out.copy(coat).multiplyScalar(0.85 + n(px * 20 + i, py * 20 + pz * 9) * 0.3).lerp(dark, smooth(0.3, 0.1, py) * 0.5);
    bk.add(mats.hen, ball(0.15, 12, 9), { p: [0, 0.27, 0], s: [1.3, 1, 0.9], color: col });
    bk.add(mats.hen, ball(0.1, 10, 8), { p: [0.13, 0.3, 0], s: [1.1, 1.1, 0.9], color: col });
    bk.add(mats.hen, tf(new THREE.ConeGeometry(0.11, 0.24, 8), { r: [0, 0, 0.85], p: [-0.18, 0.38, 0], s: [1, 1, 0.45] }), { color: brown ? C(0x2a1a10) : coat });
    bk.add(mats.hen, ball(0.07, 10, 8), { p: [0.2, 0.44, 0], color: col });
    bk.add(mats.hen, new THREE.ConeGeometry(0.022, 0.06, 5), { p: [0.28, 0.43, 0], r: [0, 0, -Math.PI / 2], color: 0xe8b830 });
    for (let k = 0; k < 3; k++) bk.add(mats.hen, ball(0.022, 6, 5), { p: [0.19 + k * 0.025, 0.51 - Math.abs(k - 1) * 0.008, 0], color: 0xc81e1e });
    bk.add(mats.hen, ball(0.02, 6, 5), { p: [0.25, 0.38, 0], s: [0.6, 1.4, 0.6], color: 0xc81e1e });
    for (const s of [-1, 1]) {
      bk.add(mats.hen, ball(0.012, 5, 4), { p: [0.255, 0.455, s * 0.04], color: 0x101010 });
      bk.add(mats.hen, cyl(0.012, 0.012, 0.16, 5), { p: [0.02, 0.09, s * 0.05], color: 0xe0a830 });
      bk.add(mats.hen, B(0.1, 0.012, 0.03), { p: [0.05, 0.01, s * 0.05], color: 0xe0a830 });
    }
    bk.build(hen);
    hen.userData.phase = r() * TAU;
    g.add(hen);
    list.push(hen);
  });
  g.userData.hens = list;
  g.userData.peck = (t) => {
    for (const h of list) {
      const p = Math.max(0, Math.sin(t * 3 + h.userData.phase));
      h.rotation.z = -0.45 * p * p * p;
    }
  };
  return g;
}

// ── the kit ──

export function createMinasFolk(renderer, { tier = 'high' } = {}) {
  const W = createWeathertopKit(renderer);
  const low = tier === 'low';
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const mats = {
    ...W.mats,
    // the people's four materials
    fig: M({ vertexColors: true, roughness: 0.8 }),
    figMetal: M({ vertexColors: true, roughness: 0.32, metalness: 0.55 }),
    figCloth: M({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide }),
    figGlow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    // the engines and what's thrown
    engineWood: M({ map: W.K.tex.planks, normalMap: W.K.tex.planksN, color: 0x8e7a62, roughness: 0.9 }),
    towerWood: M({ map: W.K.tex.planks, normalMap: W.K.tex.planksN, color: 0x56463a, roughness: 0.92 }),
    towerIron: M({ color: 0x3a3632, roughness: 0.45, metalness: 0.55 }),
    hide: M({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }),
    masonry: M({ map: W.K.tex.plaster, normalMap: W.K.tex.stoneN, normalScale: new THREE.Vector2(0.35, 0.35), vertexColors: true, roughness: 0.82 }),
    fire: new THREE.MeshBasicMaterial({ vertexColors: true }),
    hen: M({ vertexColors: true, roughness: 0.85 }),
    pouch: M({ color: 0x7a5636, roughness: 0.75, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ color: hot(0xf2f8ff, 1.6) }),
    leaf: new THREE.MeshBasicMaterial({ color: hot(0x8fdf7a, 1.5) }),
  };
  const FM = { matte: mats.fig, metal: mats.figMetal, cloth: mats.figCloth, glow: mats.figGlow };
  let stoneG = null;
  const MS = {
    mats,
    K: { ...W.K, mats },
    stoneGeo: () => (stoneG ??= stoneGeo(3)),
  };

  // the fire thrown: a lump of burning pitch, white-hot in its folds
  let fireG = null;
  const fireGeo = () => {
    if (fireG) return fireG;
    const n = makeNoise(13);
    fireG = blob(0.7, { detail: low ? 1 : 2, amp: 0.32, freq: 2.2, seed: 13 });
    const core = C(0xffd27a).multiplyScalar(2.6);
    const flame = C(0xff6a12).multiplyScalar(1.7);
    const crust = C(0x2a0c04);
    fillColor(fireG, (x, y, z, out) => {
      const m = noise3(n, x * 2.6, y * 2.6, z * 2.6);
      out.copy(flame).lerp(core, smooth(0.5, 0.72, m));
      // dark pitch in plates, glowing in the cracks between
      const c = noise3(n, x * 4.5 + 3, y * 4.5, z * 4.5);
      out.lerp(crust, smooth(0.5, 0.62, c) * 0.85);
    });
    return fireG;
  };

  const sea = new Map();
  const lazy = (key, fn) => {
    if (!sea.has(key)) sea.set(key, fn());
    return sea.get(key);
  };
  const marshes = () => lazy('marshes', () => createMarshesKit(renderer));
  const doom = () => lazy('doom', () => createDoomKit(renderer));

  const person = (id, { livery = false, helm = false } = {}) => {
    let look = id === 'pippin' && livery ? PEOPLE.pippinGuard : PEOPLE[id];
    if (!look) look = townLook(String(id).length);
    if (id === 'pippin' && livery && helm) look = { ...look, helm: 'page' };
    return figure(look, FM, id);
  };
  const guard = (n = 0) => figure(guardLook(n), FM, `guard${n}`);
  const townsfolk = (n = 0) => figure(townLook(n), FM, `townsfolk${n}`);

  const obstacle = (kind) => {
    if (kind === 'cart') return cart(MS);
    if (kind === 'barrels') return barrels(MS);
    if (kind === 'crates') return crates(MS);
    if (kind === 'hens') return hens(MS);
    // a couple of the city's folk, standing talking in the road
    const g = new THREE.Group();
    g.name = 'folk';
    const seed = Math.floor(Math.random() * 6) * 2;
    const a = townsfolk(seed);
    const b = townsfolk(seed + 1);
    a.group.position.set(0.05, 0, -0.42);
    a.group.rotation.y = -0.9;
    b.group.position.set(-0.05, 0, 0.42);
    b.group.rotation.y = 0.9;
    g.add(a.group, b.group);
    g.userData.figures = [a, b];
    return g;
  };

  return {
    mats,
    // the thrown fire flickers (all of it together: one material)
    tick(t) {
      mats.fire.color.setScalar(1 + 0.16 * Math.sin(t * 23) + 0.1 * Math.sin(t * 37 + 1));
    },
    shadowfax: () => shadowfax(W, mats.glow, mats.leaf),
    gallop,
    person,
    guard,
    townsfolk,
    trebuchet: () => trebuchet(MS),
    siegeTower: (seed = 1) => siegeTower(MS, seed),
    obstacle,
    stone: () => {
      const m = new THREE.Mesh(MS.stoneGeo(), mats.masonry);
      m.name = 'stone';
      m.castShadow = true;
      return m;
    },
    fireball: () => {
      const m = new THREE.Mesh(fireGeo(), mats.fire);
      m.name = 'fireball';
      return m;
    },
    fellBeast: () => marshes().fellBeast(),
    host: () => ({ geometry: doom().orcColumn(), material: doom().mats.orc }),
  };
}
