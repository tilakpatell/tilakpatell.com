// What the detention level’s room builders share: the parts they draw
// props with, how a prop is put where rules/furnish.js says it stands, the
// lit digits of a cell’s number and the compactor’s stencil, the walls’
// closing, what a room reads off the frame it is drawn in, and the end
// every room comes to (merged a mesh a material, its reflection made once,
// all of it freed on leave). The parts are the kit’s own shapes
// (scene/kit.js: a part is { geo, mat }, mat a kit role or a material),
// made here as well so that a prop can be drawn, and measured, without a
// kit: the kit paints its maps on a canvas, and a test has none.
//
//   box(w, h, d, x, y, z, mat), plate(w, h, x, y, z, mat, face), cyl(r0, r1, h, x, y, z, mat, { sides, axis }),
//   beam(a, b, w, h, mat), at(x, y, z, turn) → Matrix4, place(parts, matrix) → parts
//   wedge(w, d, h0, h1, x, y, z, mat)   a block whose top slopes from h0 at its −z side to h1 at its +z side
//   slope(w, len, rise, x, y, z, mat)   a face len long leaning back, rising `rise` towards −z (a console’s)
//   turnOf(yaw) → the turn that faces a part drawn towards +z along yaw (0 faces −z)
//   onProp(prop, parts) → parts   drawn about the prop’s foot (x across, +z its front, y up), put where it stands
//   drawWith(table, prop) → parts   the prop drawn by its kind’s drawer in table ((prop) → local parts), put there
//   boundsOf(parts) → { x0, x1, y0, y1, z0, z1 }
//   resolve(parts, own) → parts   a part naming one of the room’s own materials gets it
//   digitRects(text, h) → { rects: [{ x0, x1, y0, y1 }], w }   seven-segment digits h tall, centred on x 0
//   stepClose(k, dt, on, { close, open }) → k   0 open to 1 shut: `close` seconds in, `open` back
//   flagsOf(ctx) → Set   the story’s flags, on the frame (ctx.flags) or its game (ctx.g.flags)
//   openOf(ctx, doorId) → 0..1   how open the game has a door
//   hazeMaterial({ color, strength, flat }) → a node material   light in the air (or on a floor, flat), added
//     to what is behind it, brightest at its uv’s v 1 and gone by v 0; uniforms uTime, uStrength
//   finish(kit, room, parts, { lamps, own, maps, extra, probeAt, renderer, update, dispose }) → the room

import * as THREE from 'three';
import { probeRoom } from '../../probe';

// ── parts ──

export const box = (w, h, d, x, y, z, mat) => ({ geo: new THREE.BoxGeometry(w, h, d).translate(x, y, z), mat });

// a flat face w × h centred on x, y, z: facing +z ('front'), −z ('back'), up or down (w along x, h along z)
export function plate(w, h, x, y, z, mat, face = 'front') {
  const g = new THREE.PlaneGeometry(w, h);
  if (face === 'up') g.rotateX(-Math.PI / 2);
  else if (face === 'down') g.rotateX(Math.PI / 2);
  else if (face === 'back') g.rotateY(Math.PI);
  return { geo: g.translate(x, y, z), mat };
}

// a round bar r0 across at its top (or +x, +z end) and r1 at the other, h long, upright or along x or z
export function cyl(r0, r1, h, x, y, z, mat, { sides = 12, axis = 'y' } = {}) {
  const g = new THREE.CylinderGeometry(r0, r1, h, sides);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  return { geo: g.translate(x, y, z), mat };
}

// a bar from a to b ({ x, y, z }), w across and h deep, kept as upright as it can be
export function beam(a, b, w, h, mat) {
  const dir = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = dir.length();
  dir.divideScalar(len || 1);
  const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const y = up.sub(dir.clone().multiplyScalar(up.dot(dir))).normalize();
  const m = new THREE.Matrix4().makeBasis(dir, y, new THREE.Vector3().crossVectors(dir, y)).setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return { geo: new THREE.BoxGeometry(len, h, w).applyMatrix4(m), mat };
}

export function wedge(w, d, h0, h1, x, y, z, mat) {
  const g = new THREE.BoxGeometry(w, 1, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0 ? h0 + ((h1 - h0) * (p.getZ(i) + d / 2)) / d : 0);
  g.computeVertexNormals();
  return { geo: g.translate(x, y, z), mat };
}

// a face w across and len along its slope, centred on x, y, z, leaning back
// (its far edge `rise` higher than its near one) and facing up and towards +z
export function slope(w, len, rise, x, y, z, mat) {
  const tilt = Math.asin(Math.max(-1, Math.min(1, rise / len)));
  return { geo: new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2 + tilt).translate(x, y, z), mat };
}

export const at = (x, y, z, turn = 0) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(turn));

export function place(parts, m) {
  for (const p of parts) p.geo.applyMatrix4(m);
  return parts;
}

// A part drawn facing +z faces yaw once turned by π − yaw (yaw 0 faces −z,
// a quarter turn faces +x; three.js turns +z towards +x).
export const turnOf = (yaw) => Math.PI - yaw;

export const onProp = (prop, parts) => place(parts, at(prop.x, prop.y, prop.z, turnOf(prop.yaw ?? 0)));

export function drawWith(table, prop) {
  const draw = table[prop.kind];
  return draw ? onProp(prop, draw(prop)) : [];
}

export function boundsOf(parts) {
  const b = new THREE.Box3();
  for (const p of parts) {
    p.geo.computeBoundingBox();
    b.union(p.geo.boundingBox);
  }
  return { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z };
}

export const resolve = (parts, own = {}) => parts.map((p) => (typeof p.mat === 'string' && own[p.mat] ? { geo: p.geo, mat: own[p.mat] } : p));

// ── lit digits ──

// which of a digit’s seven segments are lit: a top, b top right, c bottom
// right, d bottom, e bottom left, f top left, g middle (a dash is g alone)
const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
const WIDE = 0.55; // a digit’s width to its height
const STROKE = 0.14; // a segment’s thickness to the height
const SPACE = 0.25; // between digits, to the height

export function digitRects(text, h) {
  const chars = [...String(text ?? '')];
  if (!chars.length) return { rects: [], w: 0 };
  const [dw, t, gap] = [WIDE * h, STROKE * h, SPACE * h];
  const w = chars.length * dw + (chars.length - 1) * gap;
  const rects = [];
  chars.forEach((ch, i) => {
    const x = -w / 2 + i * (dw + gap);
    const seg = {
      a: [x, x + dw, h - t, h],
      b: [x + dw - t, x + dw, h / 2, h],
      c: [x + dw - t, x + dw, 0, h / 2],
      d: [x, x + dw, 0, t],
      e: [x, x + t, 0, h / 2],
      f: [x, x + t, h / 2, h],
      g: [x, x + dw, h / 2 - t / 2, h / 2 + t / 2],
    };
    for (const s of SEGMENTS[ch] ?? '') {
      const [x0, x1, y0, y1] = seg[s];
      rects.push({ x0, x1, y0, y1 });
    }
  });
  return { rects, w };
}

// ── the frame ──

export function stepClose(k, dt, on, { close = 40, open = 3 } = {}) {
  return on ? Math.min(1, k + dt / close) : Math.max(0, k - dt / open);
}

const NONE = new Set();

export function flagsOf(ctx) {
  const f = ctx?.flags ?? ctx?.g?.flags;
  if (f instanceof Set) return f;
  if (Array.isArray(f)) return new Set(f);
  return NONE;
}

export function openOf(ctx, id) {
  const v = ctx?.g?.doors?.[id]?.open;
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

// ── light in the air ──

// (TSL, the node renderer’s: ../../nodes/rooms.js; the GLSL it was is
// ../../glsl/rooms.js, for the parity check)
export { hazeMaterial } from '../../nodes/rooms';

// ── the end of every room ──

// The parts merged a mesh a material into the room’s group, with whatever
// moves on its own (`extra`: groups the room animates) beside them; the
// reflection made once from `probeAt` with the room’s lamps; and a dispose
// that frees the geometry, the room’s own materials and the maps it made
// (`maps`: only those, since an own material may wear the kit’s, which stay).
export function finish(kit, room, parts, { lamps, own = {}, maps = [], extra = [], probeAt, renderer = null, update, dispose } = {}) {
  const group = new THREE.Group();
  group.name = room.id;
  const built = kit.merge(resolve(parts, own));
  group.add(built, ...extra);
  const reflection = probeRoom(renderer, group, probeAt ?? { x: room.x, y: room.y + 1.4, z: room.z }, { lamps });
  return {
    group,
    lamps,
    reflection,
    update(t, dt, ctx) {
      kit.update(t);
      update?.(t, dt ?? 0, ctx);
    },
    dispose() {
      reflection.dispose();
      dispose?.();
      kit.free(group);
      for (const m of Object.values(own)) m.dispose();
      for (const t of maps) t.dispose();
      group.removeFromParent();
    },
  };
}
