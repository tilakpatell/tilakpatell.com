// What makes a shaft aboard the first Death Star look bottomless, shared
// by the tractor beam’s shaft and the core shaft’s chasm. A room’s own
// walls stop at its floor and its ceiling; a shaft’s go on, storey on
// storey of grey panels with a band at each storey’s head, a light strip
// along every few, far under the ledge and over it. The station has no
// fog to swallow them (the house look runs without it), so the dark comes
// from layers of black haze across the shaft, each letting most of what
// lies past it through: thin near the ledge, together almost black far
// down. The glow (the tractor beam’s power far below) is drawn after the
// haze and added to it, so the dark never dims the light, only what the
// light falls on. A ledge is a slab with its cut face showing and a thin
// light along each lip that drops into the void, and nothing else: the
// Empire builds no rails.
//
//   deepWalls(kit, layout, room, { below, above, storey, band, every, seed }) → parts   the room’s walls
//     continued `below` metres under its lowest floor and `above` over its ceiling, in storeys,
//     every `every`-th storey’s band lit
//   hazeOf(rect, layers, { hole }) → Mesh   black layers across rect ({ x0, x1, z0, z1 }) at layers.ys,
//     each layers.opacity, with a round hole ({ x, z, r }) where something stands through them
//   glowMaterial({ color, base, fall, strength, rim, axis, radius, top, soft }) → a node material   added
//     light that thins out `fall` metres a time (e) above `base` and is gone by `top` (from `soft` under
//     it); rim: softened where its surface is seen edge-on (a haze), else as bright face-on as edge-on (a
//     glowing surface); radius: fading out to that far from the axis; uniforms.uTime runs bands up it
//   glowDiscs(stack, material) → Mesh   flat glowing discs ({ x, z, r, ys }) seen through from above
//   slab(kit, floor, { thick, top }) → parts   a floor as a slab: its walked face and its body
//   lips(kit, edges, { thick, light }) → parts   along each open edge (plan.js openEdges) a lit strip
//     under the lip

import * as THREE from 'three';
import { panelLayout, roomWalls } from '../../kit';

// (the glow is TSL, the node renderer’s: ../../nodes/rooms.js; the GLSL it
// was is ../../glsl/rooms.js, for the parity check)
export { glowMaterial } from '../../nodes/rooms';

// a deep wall’s look: tall plain bays, deep ribs, a band at each storey’s head
const DEEP = { bay: 2.4, rib: 0.34, ribDepth: 0.22, kick: 0, band: 0.5, tall: 1.9, lights: false };

export function deepWalls(kit, layout, room, { below = 0, above = 0, storey = 4, every = 2, seed = 1 } = {}) {
  const parts = [];
  const lo = Math.min(room.y, ...room.floors.map((f) => f.y));
  const hi = room.y + room.h;
  const stretches = [
    // storeys counted from the floor down, and from the ceiling up, so the bands line up wall to wall
    ...Array.from({ length: Math.ceil(below / storey) }, (_, k) => ({ y: lo - (k + 1) * storey, k })),
    ...Array.from({ length: Math.ceil(above / storey) }, (_, k) => ({ y: hi + k * storey, k })),
  ];
  roomWalls(layout, room.id).forEach((run, i) => {
    const lay = panelLayout(run.len, storey, DEEP);
    for (const { y, k } of stretches) {
      const local = kit.panelWall(run.len, storey, { ...DEEP, seed: seed * 53 + i * 7 + k });
      if (k % every === 0) {
        // the light along the band, a length in each bay, so the ribs stand over it
        for (const b of lay.bays) {
          const w = b.x1 - b.x0 - DEEP.rib - 0.3;
          if (w > 0.3) local.push(kit.box(w, 0.1, 0.03, (b.x0 + b.x1) / 2, storey - DEEP.band / 2, 0.105, 'strip'));
        }
      }
      parts.push(...kit.place(local, kit.at(run.x0, y, run.z0, run.angle)));
    }
  });
  return parts;
}

export function hazeOf(rect, { ys, opacity }, { hole = null } = {}) {
  const shape = new THREE.Shape();
  // (a Shape lies in x, y: its y is turned to −z below, so the rect is drawn with its z flipped)
  shape.moveTo(rect.x0, -rect.z1);
  shape.lineTo(rect.x1, -rect.z1);
  shape.lineTo(rect.x1, -rect.z0);
  shape.lineTo(rect.x0, -rect.z0);
  shape.closePath();
  if (hole) shape.holes.push(new THREE.Path().absarc(hole.x, -hole.z, hole.r, 0, Math.PI * 2, true));
  const one = new THREE.ShapeGeometry(shape, 24).rotateX(-Math.PI / 2);
  const geo = new THREE.BufferGeometry();
  const src = one.index ? one.toNonIndexed() : one;
  const per = src.attributes.position.array;
  const pos = new Float32Array(per.length * ys.length);
  ys.forEach((y, k) => {
    for (let i = 0; i < per.length; i += 3) pos.set([per[i], y, per[i + 2]], k * per.length + i);
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  one.dispose();
  if (src !== one) src.dispose();
  // black over what lies past, so their order never matters: one mesh for them all
  const material = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'shaft-haze';
  mesh.renderOrder = 1;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

export function glowDiscs({ x, z, r, ys }, material) {
  const one = new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2);
  const geos = ys.map((y) => one.clone().translate(x, y, z));
  const geo = geos.length ? mergeAll(geos) : new THREE.BufferGeometry();
  one.dispose();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'shaft-glow-discs';
  mesh.renderOrder = 2;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

function mergeAll(geos) {
  const count = geos.reduce((n, g) => n + g.index.count, 0);
  const verts = geos.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const index = new Uint32Array(count);
  let v = 0;
  let k = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, v * 3);
    nor.set(g.attributes.normal.array, v * 3);
    for (const i of g.index.array) index[k++] = i + v;
    v += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

export function slab(kit, f, { thick = 0.35, top = 'floor' } = {}) {
  const [w, d, x, z] = [f.x1 - f.x0, f.z1 - f.z0, (f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2];
  return [kit.plate(w, d, x, f.y, z, top, 'up'), kit.box(w, thick, d, x, f.y - thick / 2 - 0.004, z, 'trim')];
}

// (the strip sits under the lip, on the cut face, so it lights the edge
// to a body looking down without glaring up at it)
export function lips(kit, edges, { thick = 0.35, light = 'strip' } = {}) {
  const parts = [];
  for (const e of edges) {
    const len = Math.hypot(e.b.x - e.a.x, e.b.z - e.a.z);
    if (len < 0.1) continue;
    const out = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, east: { x: 1, z: 0 } }[e.side];
    const [cx, cz] = [(e.a.x + e.b.x) / 2 + out.x * 0.012, (e.a.z + e.b.z) / 2 + out.z * 0.012];
    const [w, d] = out.x ? [0.02, len - 0.1] : [len - 0.1, 0.02];
    parts.push(kit.box(w, 0.05, d, cx, e.y - Math.min(0.1, thick / 3), cz, light));
  }
  return parts;
}
