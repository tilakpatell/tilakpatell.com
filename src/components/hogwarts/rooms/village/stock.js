// What stands on a shop’s shelves (the design’s §4.9): Honeydukes’ jars of
// sweets and its boxes and tins, the pubs’ bottles. Laid along each shelf
// as data first (fill: pure, the same every visit), then drawn instanced, a
// draw a kind (the jars’ glass, what is in them and their lids are three),
// so a wall of four hundred jars is a handful of draws.
//
//   fill(slots, { seed, kinds, gap, tier }) → [{ kind, at: [x, y, z], ry, s, colour }]
//     slots: [{ at: [x, y, z] (the shelf’s middle, on its top), ry, w, h }] (rooms/parts/furniture.js’s bookcase)
//     kinds: [{ kind, w (m a thing takes), colours: [hex], tall: [min, max] }] (picked in turn by a seeded walk)
//   createStock(items, { tier }) → { group, count, dispose() }
//   SWEETS, BOTTLES: the kinds for a sweetshop and a bar

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { instanced } from '../kit';

export const SWEETS = [
  { kind: 'jar', w: 0.2, colours: ['#e8455a', '#f2b63c', '#7ac74f', '#53a7e8', '#c36be0', '#f07fb6', '#f4f0e6', '#ff8a3c'], tall: [0.9, 1.25] },
  { kind: 'box', w: 0.24, colours: ['#7a2a8a', '#2f5fb0', '#c2272d', '#e3a92b', '#2d8a5a', '#f1e4c8'], tall: [0.8, 1.6] },
  { kind: 'tin', w: 0.18, colours: ['#b0302a', '#2b5c3a', '#2a3f7a', '#c9a24a'], tall: [0.8, 1.1] },
  { kind: 'jar', w: 0.2, colours: ['#ffd7e8', '#ffe28a', '#b9f0d0', '#cfe0ff'], tall: [1, 1.3] },
];
export const BOTTLES = [
  { kind: 'bottle', w: 0.12, colours: ['#3b5a2a', '#5a3a1a', '#7a5a22', '#2a4a3a', '#6a2a1a', '#9a7a3a'], tall: [0.85, 1.2] },
  { kind: 'bottle', w: 0.12, colours: ['#3b5a2a', '#5a3a1a', '#2f3f5a'], tall: [1, 1.3] },
  { kind: 'tin', w: 0.16, colours: ['#6a5a42', '#3a3226'], tall: [0.6, 0.8] },
];

const SHARE = { low: 0.5, mid: 0.8, high: 1, ultra: 1 };

export function fill(slots, { seed = 1, kinds = SWEETS, gap = 0.03, tier = 'high' } = {}) {
  let s = (seed * 7919) % 2147483647 || 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const keep = SHARE[tier] ?? 1;
  const out = [];
  for (const slot of slots) {
    const c = Math.cos(slot.ry ?? 0);
    const sn = Math.sin(slot.ry ?? 0);
    let x = -slot.w / 2 + 0.04;
    // (a shelf’s run of one kind, then another: shops stock in runs)
    let kind = kinds[Math.floor(rnd() * kinds.length)];
    let run = 2 + Math.floor(rnd() * 5);
    while (x + kind.w <= slot.w / 2 - 0.02) {
      if (run-- <= 0) {
        kind = kinds[Math.floor(rnd() * kinds.length)];
        run = 2 + Math.floor(rnd() * 5);
      }
      const mid = x + kind.w / 2;
      const tall = kind.tall[0] + rnd() * (kind.tall[1] - kind.tall[0]);
      const colour = kind.colours[Math.floor(rnd() * kind.colours.length)];
      // (a few gaps where something has sold, fewer on a busy shelf)
      if (rnd() < keep && rnd() > 0.03) {
        // (the shelf’s own x, turned into the room: frame’s to(x, z) as in parts/furniture.js)
        const ox = mid * c;
        const oz = -mid * sn;
        out.push({ kind: kind.kind, at: [slot.at[0] + ox, slot.at[1], slot.at[2] + oz], ry: (slot.ry ?? 0) + (rnd() - 0.5) * 0.4, s: Math.min(tall, (slot.h ?? 0.4) / 0.32), colour });
      }
      x += kind.w + gap;
    }
  }
  return out;
}

// (one shape a kind, each standing on its foot)
function shapes() {
  const jar = new THREE.CylinderGeometry(0.095, 0.095, 0.28, 14, 1, true).translate(0, 0.14, 0);
  const sweets = new THREE.CylinderGeometry(0.086, 0.086, 0.2, 12).translate(0, 0.1, 0);
  const lid = new THREE.CylinderGeometry(0.075, 0.088, 0.04, 14).translate(0, 0.3, 0);
  const box = new THREE.BoxGeometry(0.22, 0.16, 0.17).translate(0, 0.08, 0);
  const tin = new THREE.CylinderGeometry(0.085, 0.085, 0.2, 16).translate(0, 0.1, 0);
  const bottle = new THREE.LatheGeometry(
    [
      [0, 0],
      [0.045, 0],
      [0.047, 0.012],
      [0.047, 0.17],
      [0.03, 0.21],
      [0.014, 0.24],
      [0.014, 0.3],
      [0.017, 0.305],
      [0, 0.305],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    10,
  );
  return { jar, sweets, lid, box, tin, bottle };
}

export function createStock(items, { tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'hogwarts:stock';
  const geo = shapes();
  const mats = {
    glass: new MeshStandardNodeMaterial({ color: new THREE.Color('#dfe8ee'), roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false }),
    sweets: new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.45 }),
    lid: new MeshStandardNodeMaterial({ color: new THREE.Color('#b8923e'), roughness: 0.35, metalness: 0.85 }),
    card: new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.7 }),
    tin: new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.6 }),
    bottle: new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.1 }),
  };
  const of = (kind) => items.filter((i) => i.kind === kind);
  const at = (list) => list.map((i) => ({ at: i.at, ry: i.ry, s: [1, i.s, 1] }));
  const colours = (list) => list.map((i) => i.colour);
  const made = [];
  const add = (geometry, material, list, opts = {}) => {
    if (!list.length) return;
    const m = instanced(geometry, material, at(list), opts);
    m.receiveShadow = tier !== 'low';
    group.add(m);
    made.push(m);
  };
  const jars = of('jar');
  add(geo.sweets, mats.sweets, jars, { colours: colours(jars) });
  add(geo.jar, mats.glass, jars);
  add(geo.lid, mats.lid, jars);
  const boxes = of('box');
  add(geo.box, mats.card, boxes, { colours: colours(boxes) });
  const tins = of('tin');
  add(geo.tin, mats.tin, tins, { colours: colours(tins) });
  const bottles = of('bottle');
  add(geo.bottle, mats.bottle, bottles, { colours: colours(bottles) });
  // (the glass after what is in it: it doesn’t write depth, so it mustn’t hide the sweets)
  for (const m of made) if (m.material === mats.glass) m.renderOrder = 2;
  return {
    group,
    count: items.length,
    dispose() {
      for (const m of made) m.dispose?.();
      for (const g of Object.values(geo)) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
      group.removeFromParent();
    },
  };
}
