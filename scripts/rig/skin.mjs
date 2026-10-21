// A figure that came without a skeleton put on the site's shared one:
// Meshy's 24 bones (the names, the parents and the turns at rest of
// src/lib/three/meshyRig.fixture.js, which are Luke's), placed where the
// figure's own joints are, and the mesh bound to them with Blender's
// automatic (heat) weights. So lib/three/rig.js finds every bone by name,
// and every clip in lib/three/clipLibrary.js plays on it through
// forFigure, retargeted by the hips' height as it is for Meshy's figures.
//
//   node scripts/rig/skin.mjs IN.glb OUT.glb [--height 1.45] [--turn 0|90|180|-90|auto]
//     [--proxy auto|always|never] [--keep DIR]
//
// IN is a static humanoid standing up (what scripts/gen3d makes, stood up by
// upright.mjs), facing +z or turned there by --turn; OUT has the skeleton
// under an `Armature` node scaled to metres, its bones in centimetres, as
// Luke's file has it (public/models/galaxy/crew/luke.glb), the feet on
// y = 0, `--height` metres from the soles to the crown (else as it came).
//
// How the joints are found (estimate): the figure is cut into thin
// slices, crown to sole, and read the way autorig.js's joints() reads a
// robot, as shares of the height, but by the shape where the shape says:
// the feet are what's lowest each side, the legs part at the crotch (when a
// robe lets them be seen), the neck is the narrowest place under the head,
// and the hands are what reaches furthest out each side along an A-pose.
// Where the shape says nothing (a robe to the floor), the shares of a
// big-headed figure stand in. The bones are then turned the way Luke's
// are, each swung only as far as it takes to point down the figure's own
// limb (fit), so a clip made on Luke turns each part of this figure as it
// turns Luke's.
//
// The pure half (the bone table, the joints from a point cloud, the bones
// fitted to them, Blender's job) is tested in skin.test.mjs; Blender's half
// is skin.py, run headless the way scripts/gen3d/bake.mjs runs bake.py.
//
//   estimate(points, opts) → joints (metres, the figure's frame)
//   fit(joints) → [{ name, parent, head, tail, deform, local: { t, q } }]
//   job(bones, opts) → what skin.py is told
//   assemble(doc, bones) → the GLB Blender wrote, its skeleton made the site's
//   skin(input, out, opts) → { joints, bones, report }

import { Document } from '@gltf-transform/core';
import { dequantize } from '@gltf-transform/functions';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { MESHY_BONES } from '../../src/lib/three/meshyRig.fixture.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CM = 100; // the bones' units to the metre (the armature is scaled by 1/CM)

// ── the bone table ──

// [name, parent, offset (cm), turn at rest], as Luke's file has them
export const BONES = MESHY_BONES.map(([name, parent, at, turn = [0, 0, 0, 1]]) => ({ name, parent, at, turn }));
export const NAMES = BONES.map((b) => b.name);
// the bones nothing should move by weight: markers at the crown and the face
export const MARKERS = new Set(['head_end', 'headfront']);

// Each bone's place and turn in the armature at rest (cm), parent before child.
export function rest(table = BONES) {
  const out = {};
  for (const b of table) {
    const q = new THREE.Quaternion(...b.turn).normalize();
    const p = new THREE.Vector3(...b.at);
    if (b.parent) {
      const up = out[b.parent];
      p.applyQuaternion(up.q).add(up.p);
      q.premultiply(up.q);
    }
    out[b.name] = { p, q };
  }
  return out;
}

// ── the joints, from the shape ──

const median = (a) => {
  if (!a.length) return 0;
  const s = Float64Array.from(a).sort();
  return s[Math.floor(s.length / 2)];
};

// the runs of `xs` (sorted) with no gap wider than `gap` between them, each
// of `least` points or more (a stray point is no part of the body)
function runs(xs, gap, least = 3) {
  if (!xs.length) return [];
  const out = [];
  let from = 0;
  for (let i = 1; i <= xs.length; i++)
    if (i === xs.length || xs[i] - xs[i - 1] > gap) {
      if (i - from >= least) out.push([xs[from], xs[i - 1]]);
      from = i;
    }
  return out;
}

// the shares of a big-headed figure (the Middle-earth cast's, Frodo's
// file: the hips a third of the way up, the neck three fifths), for where
// the shape can't say; `shoulder` is the torso's half-width, `hand` how
// far out and how high the hands are, `ankle` how high
export const SHARES = { neck: 0.6, hips: 0.33, shoulder: 0.11, hand: 0.4, ankle: 0.06 };

// points: a flat [x, y, z, …] array (metres), the figure standing on its
// lowest point and facing +z, +x its left. opts.slices: how finely it's
// cut; opts.shares: SHARES overridden (a share given is taken over the
// shape's say; crotch: null for none). → { H, ground, centre, crotch, hips,
// spine: [Spine02, Spine01, Spine], chest, neckBase, neck, head, top, face,
// L: { clavicle, shoulder, elbow, wrist, tip, hip, knee, ankle, ball, toe },
// R: {…}, found: { crotch, neck, arms } }, each joint [x, y, z] in metres
export function estimate(points, { slices = 80, shares = {} } = {}) {
  const share = { ...SHARES, ...shares };
  const n = Math.floor(points.length / 3);
  if (n < 50) throw new Error(`too few points to read a figure from (${n})`);
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = points[i * 3 + 1];
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const H = y1 - y0;
  const at = (k) => y0 + H * k;
  const kOf = (y) => Math.min(slices - 1, Math.max(0, Math.floor(((y - y0) / H) * slices)));
  const rows = Array.from({ length: slices }, () => []);
  for (let i = 0; i < n; i++) rows[kOf(points[i * 3 + 1])].push(i);
  const X = (i) => points[i * 3];
  const Y = (i) => points[i * 3 + 1];
  const Z = (i) => points[i * 3 + 2];
  const between = (lo, hi) => rows.slice(kOf(lo), kOf(hi) + 1).flat();
  // each slice's runs along x, and which is the body's (the one over the
  // middle); the middle itself the median of the body's middles between the
  // legs' tops and the shoulders (a scarf hung to one side doesn't move it)
  const gap = 0.025 * H;
  const sorted = rows.map((r) => r.map(X).sort((a, b) => a - b));
  const slice = (k, c) => {
    const rs = runs(sorted[k], gap);
    const body = rs.find(([a, b]) => a <= c && c <= b) ?? null;
    return { rs, body, w: body ? body[1] - body[0] : 0 };
  };
  let cx = median(between(at(0.3), at(0.55)).map(X));
  const middles = [];
  for (let k = kOf(at(0.3)); k <= kOf(at(0.55)); k++) {
    const { body } = slice(k, cx);
    if (body) middles.push((body[0] + body[1]) / 2);
  }
  if (middles.length) cx = median(middles);
  const cz = median(between(at(0.3), at(0.55)).map(Z));
  const cuts = rows.map((_, k) => slice(k, cx));
  const parted = (k) => cuts[k].rs.some(([, b]) => b < cx) && cuts[k].rs.some(([a]) => a > cx) && !cuts[k].body;

  // the crotch: going up from the soles, where the legs (a run each side of
  // the middle, none over it) become one; only where they're seen for a
  // good way (a robe to the shins shows the shoes alone)
  let crotch = null;
  if ('crotch' in shares) crotch = shares.crotch === null ? null : at(shares.crotch);
  else {
    // (a slice with nothing in it goes by, and so does a short stretch
    // where something runs round both legs: a robe's hem, open in front)
    let top = 0;
    let shut = 0;
    for (let k = 1; k < slices * 0.5; k++) {
      if (parted(k)) {
        top = k + 1;
        shut = 0;
      } else if (cuts[k].rs.length && ++shut > 0.04 * slices) break;
    }
    if (top / slices >= 0.15) crotch = at(top / slices);
  }

  // the head: the widest the body gets high up, and the neck under it, where
  // the body is narrowest before it widens to the shoulders, in slices the
  // arms aren't in; without a narrowing (a beard, a high collar, the head
  // straight on the shoulders) a ball as deep as the head is wide is taken
  // to end at the chin
  let headK = kOf(at(0.92));
  for (let k = headK; k >= kOf(at(0.6)); k--) if (cuts[k].w > cuts[headK].w) headK = k;
  let neckY = null;
  if ('neck' in shares) neckY = at(shares.neck);
  else {
    let best = null;
    for (let k = headK - 1; k >= kOf(at(0.45)); k--) {
      if (cuts[k].rs.length !== 1) {
        if (best != null) break; // (the arms come in: past the neck)
        continue;
      }
      if (best == null || cuts[k].w < cuts[best].w) best = k;
      else if (cuts[k].w > cuts[best].w * 1.3) break;
    }
    if (best != null && cuts[best].w < cuts[headK].w * 0.75) neckY = at((best + 0.5) / slices);
  }
  const found = { neck: neckY != null && !('neck' in shares) };
  if (neckY == null) {
    const r = cuts[headK].w / 2;
    neckY = Math.min(at(0.78), Math.max(at(0.45), at((headK + 0.5) / slices) - 0.85 * r));
  }
  const neckBase = neckY - 0.03 * H;
  const headY = neckY + 0.035 * H;
  const chestY = neckBase - 0.045 * H;

  // the hips: a little over the crotch, else the share
  const hipsY = 'hips' in shares ? at(shares.hips) : crotch != null ? Math.min(crotch + 0.07 * H, chestY - 0.1 * H) : at(share.hips);

  // the shoulders: at the neck's foot the body is as wide as the tops of the
  // shoulders and no wider (an A-pose's arms go down and out from under
  // there; a slice lower down runs along an arm held near level), each
  // joint a little in from that edge
  const shoulderY = chestY + 0.02 * H;
  const top = cuts[kOf(neckBase)].body;
  const torso = 'shoulder' in shares ? share.shoulder * H : top ? Math.min(0.16 * H, Math.max(0.07 * H, 0.85 * Math.max(top[1] - cx, cx - top[0]))) : share.shoulder * H;

  // the feet: what's lowest on each side; where that's a hem at the floor
  // (longer heel to toe than a foot is), the feet under it as a figure's are
  const low = between(y0, at(0.03));
  const foot = (s) => {
    const mine = low.filter((i) => Math.sign(X(i) - cx) === s && s * (X(i) - cx) < 0.2 * H);
    const zs = mine.map(Z).sort((a, b) => a - b);
    // (the 5th and 95th of each, so a stray point doesn't make a long foot)
    const [zLo, zHi] = zs.length ? [zs[Math.floor(zs.length * 0.05)], zs[Math.floor(zs.length * 0.95)]] : [0, Infinity];
    if (zHi - zLo > 0.16 * H) return { x: cx + s * 0.07 * H, zLo: cz - 0.03 * H, zHi: cz + 0.08 * H };
    return { x: median(mine.map(X)), zLo, zHi };
  };

  // each side: the arm read as a line through what's out beyond the torso
  // (the A-pose holds it there), the hand its furthest point, the shoulder
  // where the line comes in to the torso's edge
  const upper = between(hipsY - 0.05 * H, neckY);
  const arms = {};
  const side = (s) => {
    const f = foot(s);
    const out = upper.filter((i) => s * (X(i) - cx) > torso * 1.4);
    let tip;
    arms[s] = out.length >= 20;
    if (arms[s]) {
      let far = -Infinity;
      for (const i of out)
        if (s * (X(i) - cx) > far) {
          far = s * (X(i) - cx);
          tip = [X(i), Y(i), Z(i)];
        }
    } else tip = [cx + s * share.hand * H, at(share.hand), cz];
    const shoulder = [cx + s * torso, shoulderY, cz];
    const clavicle = [cx + s * Math.min(torso * 0.2, 0.03 * H), shoulder[1], cz];
    const span = Math.hypot(tip[0] - shoulder[0], tip[1] - shoulder[1], tip[2] - shoulder[2]);
    const handLen = Math.min(0.06 * H, span * 0.25);
    const k = 1 - handLen / Math.max(span, 1e-6);
    const wrist = shoulder.map((v, j) => v + (tip[j] - v) * k);
    const lineMid = shoulder.map((v, j) => (v + wrist[j]) / 2);
    const elbow = centreNear(points, upper, lineMid, shoulder, wrist, 0.35 * span) ?? lineMid;
    // the legs: from the hip, over the foot, down to the ankle
    const ankle = [f.x, at(share.ankle), f.zLo + (f.zHi - f.zLo) * 0.3];
    const hip = [cx + (f.x - cx) * 0.85, hipsY - 0.035 * H, cz];
    const knee = [(hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2, (hip[2] + ankle[2]) / 2 + 0.015 * H];
    const ball = [f.x, y0 + 0.015 * H, f.zLo + (f.zHi - f.zLo) * 0.72];
    const toe = [f.x, y0 + 0.015 * H, f.zHi];
    return { clavicle, shoulder, elbow, wrist, tip, hip, knee, ankle, ball, toe };
  };
  const L = side(1);
  const R = side(-1);
  const spine = [1, 2, 3].map((j) => [cx, hipsY + ((chestY - hipsY) * j) / 3, cz]);
  // the face: the front of the head a little over the head joint
  const near = between(headY, headY + 0.08 * H).filter((i) => Math.abs(X(i) - cx) < 0.06 * H);
  const front = near.length ? Math.max(...near.map(Z)) : cz + 0.1 * H;
  return {
    H,
    ground: y0,
    centre: [cx, cz],
    crotch,
    hips: [cx, hipsY, cz],
    spine,
    chest: spine[2],
    neckBase: [cx, neckBase, cz],
    neck: [cx, neckY, cz],
    head: [cx, headY, cz],
    top: [cx, y1, cz],
    face: [cx, headY + 0.005 * H, front],
    L,
    R,
    found: { crotch: crotch != null, neck: found.neck, arms: Boolean(arms[1] && arms[-1]) },
  };
}

// the middle of the arm near `at`: the points within `r` of it, nearer the
// shoulder–wrist line than `r`; null when there are too few to say
function centreNear(points, idx, at, a, b, r) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
  const sum = [0, 0, 0];
  let m = 0;
  for (const i of idx) {
    const p = [points[i * 3], points[i * 3 + 1], points[i * 3 + 2]];
    const d = Math.hypot(p[0] - at[0], p[1] - at[1], p[2] - at[2]);
    if (d > r) continue;
    const t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / len2;
    if (t < 0.3 || t > 0.7) continue;
    const off = Math.hypot(p[0] - (a[0] + ab[0] * t), p[1] - (a[1] + ab[1] * t), p[2] - (a[2] + ab[2] * t));
    if (off > r * 0.6) continue;
    sum[0] += p[0];
    sum[1] += p[1];
    sum[2] += p[2];
    m++;
  }
  return m >= 8 ? sum.map((v) => v / m) : null;
}

// ── the bones, fitted to the joints ──

// where each bone's own point is, from the joints (metres)
export function places(J) {
  const out = { Hips: J.hips, Spine02: J.spine[0], Spine01: J.spine[1], Spine: J.spine[2], neck: J.neckBase, Head: J.head, head_end: J.top, headfront: J.face };
  for (const [s, side] of [
    ['Left', J.L],
    ['Right', J.R],
  ]) {
    Object.assign(out, {
      [`${s}Shoulder`]: side.clavicle,
      [`${s}Arm`]: side.shoulder,
      [`${s}ForeArm`]: side.elbow,
      [`${s}Hand`]: side.wrist,
      [`${s}UpLeg`]: side.hip,
      [`${s}Leg`]: side.knee,
      [`${s}Foot`]: side.ankle,
      [`${s}ToeBase`]: side.ball,
    });
  }
  return out;
}

// the point each bone points at: its child down the chain, or the tip of
// what it ends in (the hand's fingertips, the toe's end); none for a marker
export function aims(J) {
  const chain = { Hips: 'Spine02', Spine02: 'Spine01', Spine01: 'Spine', Spine: 'neck', neck: 'Head', Head: 'head_end' };
  for (const s of ['Left', 'Right']) Object.assign(chain, { [`${s}Shoulder`]: `${s}Arm`, [`${s}Arm`]: `${s}ForeArm`, [`${s}ForeArm`]: `${s}Hand`, [`${s}UpLeg`]: `${s}Leg`, [`${s}Leg`]: `${s}Foot`, [`${s}Foot`]: `${s}ToeBase` });
  const at = places(J);
  const out = {};
  for (const name of NAMES) {
    if (chain[name]) out[name] = at[chain[name]];
    else if (name === 'LeftHand') out[name] = J.L.tip;
    else if (name === 'RightHand') out[name] = J.R.tip;
    else if (name === 'LeftToeBase') out[name] = J.L.toe;
    else if (name === 'RightToeBase') out[name] = J.R.toe;
    else out[name] = null;
  }
  return out;
}

const vec = (a) => new THREE.Vector3(...a);
const Y = new THREE.Vector3(0, 1, 0);

// The skeleton for a figure with these joints: each bone at its place,
// turned as Luke's is at rest and then swung (no twist) to point where this
// figure's limb points. → [{ name, parent, head, tail (metres, the figure's
// frame), deform, world: { p, q }, local: { t (cm), q } }] in the table's order.
export function fit(J, { table = BONES } = {}) {
  const luke = rest(table);
  const at = places(J);
  const aim = aims(J);
  const world = {};
  const out = [];
  for (const b of table) {
    const p = vec(at[b.name]).multiplyScalar(CM);
    let q;
    const to = aim[b.name] && vec(aim[b.name]).multiplyScalar(CM).sub(p);
    if (to && to.lengthSq() > 1e-8) {
      const from = Y.clone().applyQuaternion(luke[b.name].q);
      q = new THREE.Quaternion().setFromUnitVectors(from, to.normalize()).multiply(luke[b.name].q);
    } else if (b.parent) {
      // a marker, or a bone with nowhere to point: its turn on its parent as Luke's is
      q = world[b.parent].q.clone().multiply(new THREE.Quaternion(...b.turn).normalize());
    } else q = luke[b.name].q.clone();
    world[b.name] = { p, q };
    const up = b.parent ? world[b.parent] : null;
    const inv = up ? up.q.clone().invert() : new THREE.Quaternion();
    const t = up ? p.clone().sub(up.p).applyQuaternion(inv) : p.clone();
    const lq = up ? inv.multiply(q) : q.clone();
    // the tail: where it points, or (a marker) a short way along its +y, for Blender, which wants a length
    const tail = aim[b.name] ?? p.clone().add(Y.clone().applyQuaternion(q).multiplyScalar(0.03 * (J.H * CM))).divideScalar(CM).toArray();
    out.push({ name: b.name, parent: b.parent, head: at[b.name], tail, deform: !MARKERS.has(b.name), world: { p: p.toArray(), q: q.toArray() }, local: { t: t.toArray(), q: lq.normalize().toArray() } });
  }
  return out;
}

// What skin.py is told: the bones (head and tail in the glTF's metres, the
// Head's tail at the crown so the whole head is its), and how to weight.
export function job(bones, { proxy = 'auto', proxyAt = 0.005, voxel } = {}) {
  const H = Math.max(...bones.map((b) => b.head[1])) - Math.min(...bones.map((b) => b.head[1]));
  return {
    bones: bones.map((b) => {
      // (Blender drops a bone with no length)
      const len = Math.hypot(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]);
      const tail = len > 1e-4 ? b.tail : [b.head[0], b.head[1] + 0.02, b.head[2]];
      return { name: b.name, parent: b.parent, head: b.head, tail, deform: b.deform };
    }),
    proxy,
    proxyAt,
    // (a voxel a hundred and fiftieth of the height: fine enough for fingers, coarse enough to close a scarf's gaps)
    voxel: voxel ?? Math.max(0.004, H / 150),
  };
}

// ── facing ──

// Which way a standing figure faces, as the turn about +y (degrees: 0, 90,
// 180 or −90) that brings it to face +z: its arms span x (the wider way
// across the chest's height), and its toes stick out ahead of its shins.
export function facing(points) {
  const n = Math.floor(points.length / 3);
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    y0 = Math.min(y0, points[i * 3 + 1]);
    y1 = Math.max(y1, points[i * 3 + 1]);
  }
  const H = y1 - y0;
  const pick = (lo, hi) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const h = (points[i * 3 + 1] - y0) / H;
      if (h >= lo && h < hi) out.push(i);
    }
    return out;
  };
  const spread = (idx, k) => {
    const v = idx.map((i) => points[i * 3 + k]).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length * 0.98)] - v[Math.floor(v.length * 0.02)] : 0;
  };
  const arms = pick(0.3, 0.6);
  const acrossX = spread(arms, 0) >= spread(arms, 2);
  // ahead: the feet's mean along the facing axis against the shins'
  const k = acrossX ? 2 : 0;
  const mean = (idx) => idx.reduce((s, i) => s + points[i * 3 + k], 0) / Math.max(1, idx.length);
  const ahead = mean(pick(0, 0.04)) - mean(pick(0.1, 0.18));
  if (acrossX) return ahead >= 0 ? 0 : 180;
  return ahead >= 0 ? -90 : 90; // (toes toward +x: a quarter turn clockwise seen from above)
}

// ── reading and writing GLBs ──

// Every vertex of every mesh, where it's drawn (metres), as one flat array.
// With `samples`, that many more points strewn over the triangles by area
// as well (the same ones every time): a mesh decimated for the web has big
// triangles and few vertices, and a thin slice through it can miss them.
export function pointsOf(doc, { samples = 0 } = {}) {
  const out = [];
  const tris = [];
  const e = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const first = out.length / 3;
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, e);
        const [x, y, z] = e;
        out.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      }
      const idx = prim.getIndices()?.getArray();
      const count = idx ? idx.length : pos.getCount();
      for (let t = 0; t + 2 < count; t += 3) tris.push(first + (idx ? idx[t] : t), first + (idx ? idx[t + 1] : t + 1), first + (idx ? idx[t + 2] : t + 2));
    }
  }
  if (samples > 0 && tris.length) {
    const P = (i, j) => out[i * 3 + j];
    const areas = new Float64Array(tris.length / 3);
    let total = 0;
    for (let t = 0; t < areas.length; t++) {
      const [a, b, c] = [tris[t * 3], tris[t * 3 + 1], tris[t * 3 + 2]];
      const u = [0, 1, 2].map((j) => P(b, j) - P(a, j));
      const v = [0, 1, 2].map((j) => P(c, j) - P(a, j));
      total += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
      areas[t] = total;
    }
    // (a fixed sequence, so a figure reads the same every run)
    let seed = 0x9e3779b9;
    const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let k = 0; k < samples; k++) {
      const r = rand() * total;
      let lo = 0;
      let hi = areas.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (areas[mid] < r) lo = mid + 1;
        else hi = mid;
      }
      const [a, b, c] = [tris[lo * 3], tris[lo * 3 + 1], tris[lo * 3 + 2]];
      let [u, v] = [rand(), rand()];
      if (u + v > 1) [u, v] = [1 - u, 1 - v];
      for (let j = 0; j < 3; j++) out.push(P(a, j) + (P(b, j) - P(a, j)) * u + (P(c, j) - P(a, j)) * v);
    }
  }
  return Float32Array.from(out);
}

// Every mesh's vertices turned about +y, set on the ground (its lowest at 0),
// centred over the origin in x and z and scaled to `height` metres when
// given; the nodes' own transforms baked in. In place.
export async function stand(doc, { turn = 0, height = null } = {}) {
  await doc.transform(dequantize());
  const root = doc.getRoot();
  const a = (turn * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const pts = pointsOf(doc);
  let [y0, y1, x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < pts.length; i += 3) {
    const x = c * pts[i] + s * pts[i + 2];
    const z = -s * pts[i] + c * pts[i + 2];
    [x0, x1, z0, z1] = [Math.min(x0, x), Math.max(x1, x), Math.min(z0, z), Math.max(z1, z)];
    [y0, y1] = [Math.min(y0, pts[i + 1]), Math.max(y1, pts[i + 1])];
  }
  const k = height ? height / (y1 - y0) : 1;
  const [ox, oz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  const e = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      for (const sem of ['POSITION', 'NORMAL']) {
        const acc = prim.getAttribute(sem);
        if (!acc) continue;
        const arr = new Float32Array(acc.getCount() * 3);
        for (let i = 0; i < acc.getCount(); i++) {
          acc.getElement(i, e);
          const w = sem === 'POSITION' ? 1 : 0;
          let [x, y, z] = [m[0] * e[0] + m[4] * e[1] + m[8] * e[2] + m[12] * w, m[1] * e[0] + m[5] * e[1] + m[9] * e[2] + m[13] * w, m[2] * e[0] + m[6] * e[1] + m[10] * e[2] + m[14] * w];
          [x, z] = [c * x + s * z, -s * x + c * z];
          if (sem === 'POSITION') [x, y, z] = [(x - ox) * k, (y - y0) * k, (z - oz) * k];
          else {
            const l = Math.hypot(x, y, z) || 1;
            [x, y, z] = [x / l, y / l, z / l];
          }
          arr.set([x, y, z], i * 3);
        }
        // (a fresh accessor: a shared one would be turned twice)
        prim.setAttribute(sem, doc.createAccessor().setType('VEC3').setArray(arr).setBuffer(acc.getBuffer() ?? root.listBuffers()[0]));
      }
      // (tangents would point the old way: the normal map is read without them)
      if (prim.getAttribute('TANGENT')) prim.setAttribute('TANGENT', null);
    }
  }
  // the meshes' nodes put at rest, their transforms now in the vertices
  for (const node of root.listNodes()) {
    if (!node.getMesh()) continue;
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    const scene = root.listScenes()[0];
    for (const p of root.listNodes()) if (p.listChildren().includes(node)) p.removeChild(node);
    if (!scene.listChildren().includes(node)) scene.addChild(node);
  }
  return doc;
}

// The GLB Blender wrote (its mesh, its material, its weights by Blender's
// bone names), its skeleton replaced by the site's: an `Armature` node
// scaled to metres holding the mesh and the bones (cm), the bones in the
// table's order, each at its fitted place and turn, the inverse bind
// matrices from them, and the weights' joints renumbered to that order.
// In place; returns the doc.
export function assemble(doc, bones) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const meshes = root.listNodes().filter((n) => n.getMesh());
  if (!meshes.length) throw new Error('no mesh in what Blender wrote');
  const skins = root.listSkins();
  const order = NAMES;
  const index = new Map(order.map((n, i) => [n, i]));
  // each mesh's joints: Blender's numbering (its skin's joints by name) to the table's
  for (const node of meshes) {
    const skin = node.getSkin() ?? skins[0];
    if (!skin) throw new Error('what Blender wrote has no skin');
    const theirs = skin.listJoints().map((j) => j.getName());
    const map = theirs.map((name) => {
      if (!index.has(name)) throw new Error(`Blender's skeleton has a bone the table doesn't: ${name}`);
      return index.get(name);
    });
    for (const prim of node.getMesh().listPrimitives()) {
      const joints = prim.getAttribute('JOINTS_0');
      if (!joints) throw new Error('a primitive with no weights');
      const arr = joints.getArray();
      const next = new Uint8Array(arr.length);
      for (let i = 0; i < arr.length; i++) next[i] = map[arr[i]];
      joints.setArray(next);
    }
  }
  // Blender's nodes (its armature and bones) gone; the meshes kept
  const keep = new Set(meshes);
  for (const n of root.listNodes()) if (!keep.has(n)) n.dispose();
  for (const s of root.listSkins()) s.dispose();
  for (const a of root.listAnimations()) a.dispose();
  const armature = doc.createNode('Armature').setScale([1 / CM, 1 / CM, 1 / CM]);
  for (const c of scene.listChildren()) scene.removeChild(c);
  scene.addChild(armature);
  // (the mesh's node first, as Luke's is, then the bones)
  meshes.forEach((node, i) => {
    for (const p of node.listParents()) if (p.propertyType === 'Node') p.removeChild(node);
    node.setName(i ? `char${i + 1}` : 'char1').setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    armature.addChild(node);
  });
  const nodes = {};
  for (const b of bones) {
    const node = doc.createNode(b.name).setTranslation(b.local.t).setRotation(b.local.q);
    (b.parent ? nodes[b.parent] : armature).addChild(node);
    nodes[b.name] = node;
  }
  // the inverse bind matrices: each bone's world at rest (armature scale and all), inverted
  const ibm = new Float32Array(order.length * 16);
  const m = new THREE.Matrix4();
  const S = new THREE.Matrix4().makeScale(1 / CM, 1 / CM, 1 / CM);
  bones.forEach((b, i) => {
    m.compose(vec(b.world.p), new THREE.Quaternion(...b.world.q), new THREE.Vector3(1, 1, 1));
    m.premultiply(S).invert();
    ibm.set(m.elements, i * 16);
  });
  const buffer = root.listBuffers()[0] ?? doc.createBuffer();
  const skin = doc
    .createSkin('skin')
    .setInverseBindMatrices(doc.createAccessor('ibm').setType('MAT4').setArray(ibm).setBuffer(buffer))
    .setSkeleton(nodes.Hips);
  for (const name of order) skin.addJoint(nodes[name]);
  for (const node of meshes) node.setSkin(skin);
  return doc;
}

// ── Blender ──

// The command line for one skinning, given where Blender is (bake.mjs's
// blender(): Windows, or Linux in WSL), so it's testable without one.
export async function command(input, jobFile, out, { where } = {}) {
  const gen3d = await import('../gen3d/bake.mjs');
  const { wslPath, WSL } = await import('../gen3d/generate.mjs');
  where ??= gen3d.blender();
  if (!where) return null;
  const args = ['--background', '--python', join(HERE, 'skin.py'), '--', input, jobFile, out];
  if (where.kind === 'windows') return /\.mjs$/i.test(where.exe) ? [process.execPath, where.exe, ...args] : [where.exe, ...args];
  const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const run = `export LD_LIBRARY_PATH=~/miniforge3/envs/x11libs/lib:$LD_LIBRARY_PATH; ${q(where.exe)} ${args.map((a) => q(/^[A-Za-z]:[\\/]/.test(a) ? wslPath(a) : a)).join(' ')}`;
  return ['wsl.exe', '-d', WSL.distro, '-e', 'bash', '-lc', run];
}

async function nodeIO() {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

// A static figure in, the same figure on the site's skeleton out.
// opts: height (metres, crown to sole), turn (degrees about +y, or 'auto'),
// proxy ('auto' | 'always' | 'never'), shares (SHARES overridden, for a
// figure whose shape misleads), keep (a folder to leave the job and Blender's
// GLB in, for looking at). → { joints, bones, turn, report }
export async function skin(input, out, { height = null, turn = 0, proxy = 'auto', shares, keep, log = console.log } = {}) {
  const io = await nodeIO();
  const doc = await io.read(input);
  if (turn === 'auto') turn = facing(pointsOf(await stand(doc), { samples: 30000 }));
  await stand(doc, { turn, height });
  // (plain for Blender: its importer reads no meshopt)
  for (const ext of doc.getRoot().listExtensionsUsed()) if (/meshopt|quantization/i.test(ext.extensionName)) ext.dispose();
  const joints = estimate(pointsOf(doc, { samples: 60000 }), { shares });
  const bones = fit(joints);
  const dir = keep ? resolve(keep) : mkdtempSync(join(tmpdir(), 'skin-'));
  mkdirSync(dir, { recursive: true });
  const plain = join(dir, 'figure.glb');
  const jobFile = join(dir, 'job.json');
  const weighted = join(dir, 'weighted.glb');
  await io.write(plain, doc);
  writeFileSync(jobFile, JSON.stringify(job(bones, { proxy }), null, 1));
  const cmd = await command(plain, jobFile, weighted);
  if (!cmd) throw new Error('Blender is not set up here: see scripts/gen3d/README.md (Blender, for bake.mjs)');
  const { live } = await import('../desktop/lib.mjs');
  await live(cmd[0], cmd.slice(1), { name: 'blender', minutes: Number(process.env.RIG_BLENDER_MINUTES ?? 10) });
  if (!existsSync(weighted)) throw new Error(`Blender made no ${weighted}`);
  const report = existsSync(`${weighted}.json`) ? JSON.parse(readFileSync(`${weighted}.json`, 'utf8')) : null;
  const got = await io.read(weighted);
  assemble(got, bones);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  await io.write(out, got);
  log?.(`${out}: ${bones.length} bones, ${joints.found.crotch ? 'legs parted' : 'legs under a robe'}, ${joints.found.neck ? 'neck found' : 'neck by share'}${report ? `, ${(report.bare * 100).toFixed(1)}% bare after heat${report.proxied ? ' (weighted on a closed proxy)' : ''}` : ''}`);
  if (!keep) rmSync(dir, { recursive: true, force: true });
  return { joints, bones, turn, report };
}

// (a Document of the gltf-transform kind, so a test can make one without reading a file)
export const newDoc = () => new Document();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : d;
  };
  const height = flag('height');
  const turn = flag('turn', '0');
  const opts = { height: height ? Number(height) : null, turn: turn === 'auto' ? 'auto' : Number(turn), proxy: flag('proxy', 'auto'), keep: flag('keep') };
  const [input, out] = args;
  if (!input || !out) throw new Error('usage: node scripts/rig/skin.mjs IN.glb OUT.glb [--height M] [--turn 0|90|180|-90|auto] [--proxy auto|always|never] [--keep DIR]');
  const r = await skin(resolve(input), resolve(out), opts);
  console.log(`turned ${r.turn}°; hips ${(r.joints.hips[1]).toFixed(3)} m of ${r.joints.H.toFixed(3)} m`);
}
