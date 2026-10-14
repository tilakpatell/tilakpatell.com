// Docking Bay 327 as A New Hope has it, and the two rooms the bay draws
// round itself. The bay: a glossy black deck with light rows sunk in it
// running out to the mouth, grey walls in tall deep-ribbed bays with the
// white light grids along their foot, a coffered ceiling of light strips,
// gantries along the walls and a bridge across, the stair up to Docking
// Control (its windows glowing above the deck), the magnetic field across
// the mouth as a faint blue shimmer with stars beyond, and the Falcon on her
// gear with her ramp down onto the steps the layout gives it, held by
// mooring clamps. The field (kind 'field') is the strip of space past the
// mouth: the bay draws it, so its own builder draws nothing. The Falcon’s
// smuggling hold (kind 'ship') is walked inside, so it has a builder too.
//
//   FALCON: { url, length }   the model and the length she is drawn at
//   buildHangar(kit, room, layout, { renderer }) → { group, lamps, update(t), dispose() }
//   buildField() → { group, lamps: [], dispose() }   (empty)
//   buildShip(kit, room, layout, { renderer }) → { group, lamps, dispose() }

import * as THREE from 'three';
import { loadGltf } from '../../../../../lib/three/gltf';
import { seeded } from '../../../../../lib/seeded';
import { sharpen } from '../../../../../lib/three/textures';
import { starSprite } from '../../../plating';
import { flights, roomWalls, solidRects, windowsOf } from '../kit';
import { probeRoom } from '../probe';
import { bayField, starPoints } from '../nodes/rooms';

export const FALCON = { url: '/models/universe/falcon.glb', length: 34.75 };

const COOL = 0xdfe8ff;
const GANTRY = { y: 12, depth: 2.4, bridge: 18 };
const area = (f) => (f.x1 - f.x0) * (f.z1 - f.z0);
const otherSide = (door, id) => (door.a === id ? door.b : door.a);

// ── the deck, the ceiling, the gantries ──

// The deck, and light rows sunk in it every 12 m out to the mouth, broken
// in 3 m runs and kept off the stairs and the ramp.
function deckOf(kit, deck, room, raised) {
  const parts = [kit.plate(deck.x1 - deck.x0, deck.z1 - deck.z0, (deck.x0 + deck.x1) / 2, deck.y, (deck.z0 + deck.z1) / 2, 'floor', 'up')];
  const clear = (x, z0, z1) => !raised.some((f) => x > f.x0 - 0.4 && x < f.x1 + 0.4 && z1 > f.z0 - 0.4 && z0 < f.z1 + 0.4);
  for (let x = room.x - 24; x <= room.x + 24; x += 12) {
    if (x < deck.x0 + 2 || x > deck.x1 - 2) continue;
    for (let z = deck.z0 + 4; z + 3 <= deck.z1 - 1.5; z += 4) {
      if (!clear(x, z, z + 3)) continue;
      parts.push(kit.box(0.36, 0.01, 3, x, deck.y + 0.003, z + 1.5, 'black'));
      parts.push(kit.plate(0.14, 3, x, deck.y + 0.009, z + 1.5, 'strip', 'up'));
    }
  }
  return parts;
}

// Deep beams every 8 m both ways, and a light strip down each coffer.
function ceilingOf(kit, room) {
  const { box: b } = room;
  const y = room.y + room.h;
  const [step, depth, wide] = [8, 1.4, 0.9];
  const parts = [kit.plate(b.x1 - b.x0, b.z1 - b.z0, room.x, y, room.z, 'ceiling', 'down')];
  for (let x = b.x0 + step; x < b.x1 - 0.1; x += step) parts.push(kit.box(wide, depth, b.z1 - b.z0, x, y - depth / 2, room.z, 'trim'));
  for (let z = b.z0 + step; z < b.z1 - 0.1; z += step) parts.push(kit.box(b.x1 - b.x0, depth * 0.7, wide, room.x, y - depth * 0.35, z, 'trim'));
  for (let x = b.x0 + step / 2; x < b.x1; x += step) for (let z = b.z0 + step / 2; z < b.z1; z += step) parts.push(kit.plate(0.35, step - 2.2, x, y - 0.02, z, 'strip', 'down'));
  return parts;
}

// A rail along a run from a to b at height y: posts every `every` metres, top and mid rails.
function railing(kit, a, b, y, every = 2) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.round(len / every));
  const parts = [];
  for (let i = 0; i <= n; i++) parts.push(kit.box(0.06, 1.05, 0.06, a.x + ((b.x - a.x) * i) / n, y + 0.525, a.z + ((b.z - a.z) * i) / n, 'rail'));
  for (const h of [0.55, 1.05]) parts.push(kit.beam({ x: a.x, y: y + h, z: a.z }, { x: b.x, y: y + h, z: b.z }, 0.06, 0.06, 'rail'));
  return parts;
}

// A grated walkway over x0..x1 × z0..z1 at height y: edge beams, a rail on
// each open side, braces back to the wall every 6 m, downlights under it.
function walkway(kit, { x0, x1, z0, z1 }, y, open, wall) {
  const parts = [kit.plate(x1 - x0, z1 - z0, (x0 + x1) / 2, y, (z0 + z1) / 2, 'grate', 'up')];
  const alongX = x1 - x0 > z1 - z0;
  const edges = alongX
    ? { north: [{ x: x0, z: z0 }, { x: x1, z: z0 }], south: [{ x: x0, z: z1 }, { x: x1, z: z1 }] }
    : { west: [{ x: x0, z: z0 }, { x: x0, z: z1 }], east: [{ x: x1, z: z0 }, { x: x1, z: z1 }] };
  for (const [side, [a, b]] of Object.entries(edges)) {
    parts.push(kit.beam({ ...a, y: y - 0.15 }, { ...b, y: y - 0.15 }, 0.15, 0.3, 'trim'));
    if (open.includes(side)) parts.push(...railing(kit, a, b, y));
  }
  const len = alongX ? x1 - x0 : z1 - z0;
  for (let s = 2; s < len; s += 6) {
    const p = alongX ? { x: x0 + s, z: wall === 'north' ? z0 : z1 } : { x: wall === 'west' ? x0 : x1, z: z0 + s };
    const q = alongX ? { x: p.x, z: wall === 'north' ? z1 : z0 } : { x: wall === 'west' ? x1 : x0, z: p.z };
    if (wall) parts.push(kit.beam({ ...p, y: y - 2 }, { ...q, y: y - 0.3 }, 0.14, 0.2, 'trim'));
  }
  for (let s = 1; s < len; s += 4) {
    const c = alongX ? { x: x0 + s, z: (z0 + z1) / 2 } : { x: (x0 + x1) / 2, z: z0 + s };
    parts.push(kit.box(alongX ? 0.5 : 0.2, 0.04, alongX ? 0.2 : 0.5, c.x, y - 0.32, c.z, 'strip'));
  }
  return parts;
}

// Walkways along the side walls and the north wall, and a bridge across
// the bay with a truss under it.
function gantriesOf(kit, room) {
  const b = room.box;
  const [y, d] = [room.y + GANTRY.y, GANTRY.depth];
  const parts = [
    ...walkway(kit, { x0: b.x0, x1: b.x0 + d, z0: b.z0 + d, z1: b.z1 - 0.5 }, y, ['east'], 'west'),
    ...walkway(kit, { x0: b.x1 - d, x1: b.x1, z0: b.z0 + d, z1: b.z1 - 0.5 }, y, ['west'], 'east'),
    ...walkway(kit, { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z0 + d }, y, ['south'], 'north'),
  ];
  const [by, bz] = [room.y + GANTRY.bridge, room.z - 8];
  parts.push(...walkway(kit, { x0: b.x0, x1: b.x1, z0: bz - 1, z1: bz + 1 }, by, ['north', 'south'], null));
  for (const z of [bz - 0.9, bz + 0.9]) {
    parts.push(kit.beam({ x: b.x0, y: by - 1.4, z }, { x: b.x1, y: by - 1.4, z }, 0.18, 0.18, 'trim'));
    for (let x = b.x0, k = 0; x < b.x1 - 0.1; x += 4, k++) parts.push(kit.beam({ x, y: k % 2 ? by - 1.4 : by - 0.3, z }, { x: x + 4, y: k % 2 ? by - 0.3 : by - 1.4, z }, 0.1, 0.12, 'trim'));
  }
  return parts;
}

// ── the stair, its landing and the ramp ──

// A stair’s steps (the footprint most of its floors share) with treads,
// risers, stringers and rails on its open sides; its landings as slabs on
// posts, railed where they neither meet a wall nor the stair.
function stairOf(kit, floors, room, deckY) {
  const key = (f) => `${(f.x1 - f.x0).toFixed(2)}×${(f.z1 - f.z0).toFixed(2)}`;
  const counts = new Map();
  for (const f of floors) counts.set(key(f), (counts.get(key(f)) ?? 0) + 1);
  const [stepKey, many] = [...counts].sort((p, q) => q[1] - p[1])[0];
  const steps = many > 1 ? floors.filter((f) => key(f) === stepKey).sort((p, q) => p.y - q.y) : [];
  const landings = floors.filter((f) => !steps.includes(f));
  const b = room.box;
  const near = (u, v) => Math.abs(u - v) < 0.05;
  const parts = [];
  if (steps.length) {
    const [first, last] = [steps[0], steps.at(-1)];
    const alongX = Math.abs((last.x0 + last.x1) / 2 - (first.x0 + first.x1) / 2) > Math.abs((last.z0 + last.z1) / 2 - (first.z0 + first.z1) / 2);
    const rising = alongX ? Math.sign(last.x0 - first.x0) : Math.sign(last.z0 - first.z0);
    let below = deckY;
    for (const f of steps) {
      const [cx, cz, w, d] = [(f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2, f.x1 - f.x0, f.z1 - f.z0];
      parts.push(kit.box(w, 0.06, d, cx, f.y - 0.03, cz, 'trim'));
      const rise = f.y - below;
      if (alongX) parts.push(kit.box(0.03, rise, d, rising > 0 ? f.x0 : f.x1, f.y - rise / 2, cz, 'black'));
      else parts.push(kit.box(w, rise, 0.03, cx, f.y - rise / 2, rising > 0 ? f.z0 : f.z1, 'black'));
      below = f.y;
    }
    const start = alongX ? (rising > 0 ? first.x0 : first.x1) : rising > 0 ? first.z0 : first.z1;
    const end = alongX ? (rising > 0 ? last.x1 : last.x0) : rising > 0 ? last.z1 : last.z0;
    const sides = alongX ? [first.z0, first.z1] : [first.x0, first.x1];
    for (const s of sides) {
      const onWall = alongX ? near(s, b.z0) || near(s, b.z1) : near(s, b.x0) || near(s, b.x1);
      const pt = (t, y) => (alongX ? { x: t, y, z: s } : { x: s, y, z: t });
      parts.push(kit.beam(pt(start, deckY - 0.2), pt(end, last.y - 0.25), 0.1, 0.45, 'trim'));
      if (onWall) continue;
      for (let i = 0; i < steps.length; i += 4) {
        const f = steps[i];
        const c = pt(alongX ? (f.x0 + f.x1) / 2 : (f.z0 + f.z1) / 2, f.y);
        parts.push(kit.box(0.06, 1, 0.06, c.x, f.y + 0.5, c.z, 'rail'));
      }
      for (const h of [0.5, 1]) parts.push(kit.beam(pt(start, deckY + h), pt(end, last.y + h), 0.06, 0.06, 'rail'));
    }
  }
  for (const f of landings) {
    const [cx, cz] = [(f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2];
    parts.push(kit.box(f.x1 - f.x0, 0.3, f.z1 - f.z0, cx, f.y - 0.15, cz, 'trim'));
    parts.push(kit.plate(f.x1 - f.x0, f.z1 - f.z0, cx, f.y + 0.002, cz, 'floor', 'up'));
    const met = (g) => g !== f && Math.abs(g.y - f.y) < 0.41;
    const edges = [
      { a: { x: f.x0, z: f.z0 }, b: { x: f.x1, z: f.z0 }, wall: near(f.z0, b.z0), stair: floors.some((g) => met(g) && near(g.z1, f.z0)) },
      { a: { x: f.x0, z: f.z1 }, b: { x: f.x1, z: f.z1 }, wall: near(f.z1, b.z1), stair: floors.some((g) => met(g) && near(g.z0, f.z1)) },
      { a: { x: f.x0, z: f.z0 }, b: { x: f.x0, z: f.z1 }, wall: near(f.x0, b.x0), stair: floors.some((g) => met(g) && near(g.x1, f.x0)) },
      { a: { x: f.x1, z: f.z0 }, b: { x: f.x1, z: f.z1 }, wall: near(f.x1, b.x1), stair: floors.some((g) => met(g) && near(g.x0, f.x1)) },
    ];
    for (const e of edges) if (!e.wall && !e.stair) parts.push(...railing(kit, e.a, e.b, f.y, 1.5));
    // posts under its corners, but not against a wall (it is bolted there)
    for (const x of [f.x0 + 0.2, f.x1 - 0.2]) {
      for (const z of [f.z0 + 0.2, f.z1 - 0.2]) {
        if (x - b.x0 > 0.5 && b.x1 - x > 0.5 && z - b.z0 > 0.5 && b.z1 - z > 0.5) parts.push(kit.post(0.16, x, deckY, f.y - 0.3, z, 'trim'));
      }
    }
  }
  return parts;
}

// Whether a flight runs down from a doorway: the Falcon’s ramp from her hatch.
const fromDoor = (floors, door) =>
  floors.some((f) => (door.axis === 'x' ? Math.abs(f.z0 - door.z) < 0.05 || Math.abs(f.z1 - door.z) < 0.05 : Math.abs(f.x0 - door.x) < 0.05 || Math.abs(f.x1 - door.x) < 0.05) && Math.abs(f.y - door.y) < 0.41);

// The Falcon’s ramp: one sloped plate from the hatch’s sill to the deck,
// passing within a step of every tread the walker stands on, ribbed, with
// skirts lit along their edge and two rams up into the hull.
function rampOf(kit, floors, hatch, deckY) {
  const alongZ = hatch.axis === 'x';
  const across = floors.flatMap((f) => (alongZ ? [f.x0, f.x1] : [f.z0, f.z1]));
  const along = floors.flatMap((f) => (alongZ ? [f.z0, f.z1] : [f.x0, f.x1]));
  const [c, w] = [(Math.min(...across) + Math.max(...across)) / 2, Math.max(...across) - Math.min(...across)];
  const mid = along.reduce((s, v) => s + v, 0) / along.length;
  const from = alongZ ? hatch.z : hatch.x;
  const to = mid > from ? Math.max(...along) : Math.min(...along);
  const pt = (t, y, s = 0) => (alongZ ? { x: c + s, y, z: t } : { x: t, y, z: c + s });
  const lerp = (k, s = 0, dy = 0) => pt(from + (to - from) * k, hatch.y + (deckY + 0.02 - hatch.y) * k + dy, s);
  const parts = [kit.beam(lerp(0, 0, -0.06), lerp(1, 0, -0.06), w, 0.12, 'trim')];
  const len = Math.abs(to - from);
  for (let t = 0.3; t < len - 0.1; t += 0.4) parts.push(kit.beam(lerp(t / len, -w / 2 + 0.1, 0.015), lerp(t / len, w / 2 - 0.1, 0.015), 0.05, 0.03, 'black'));
  for (const s of [-w / 2, w / 2]) {
    parts.push(kit.beam(lerp(0, s, 0.1), lerp(1, s, 0.1), 0.08, 0.32, 'trim'));
    for (let t = 0.5; t < len; t += 0.8) {
      const p = lerp(t / len, s * 0.94, 0.24);
      parts.push(kit.box(0.08, 0.04, 0.08, p.x, p.y, p.z, 'strip'));
    }
    const low = lerp(0.4, s * 0.75, -0.2);
    parts.push(kit.beam(low, pt(from + Math.sign(from - to) * 0.4, hatch.y + 1, s * 0.75), 0.12, 0.12, 'rail'));
  }
  return parts;
}

// ── the mouth ──

// The deck’s lip and the station’s face falling away under the mouth, seen
// over the edge; lights along the lip.
function mouthOf(kit, mouth, room) {
  const out = mouth.axis === 'x' ? Math.sign(mouth.z - room.z) : Math.sign(mouth.x - room.x);
  const turn = mouth.axis === 'x' ? (out > 0 ? 0 : Math.PI) : out > 0 ? Math.PI / 2 : -Math.PI / 2;
  const local = [kit.box(mouth.w + 2.4, 1.6, 0.4, 0, -0.8, 0.2, 'trim'), kit.plate(160, 120, 0, -61.6, 0.4, 'wall')];
  for (let x = -mouth.w / 2 + 1; x < mouth.w / 2; x += 2) local.push(kit.box(0.9, 0.04, 0.12, x, 0.02, -0.35, 'strip'));
  return kit.place(local, kit.at(mouth.x, mouth.y, mouth.z, turn));
}

// Slow ripples climbing a faint blue sheet, brighter at its rim where the
// emitters hold it; added over what lies beyond, never hiding the stars
// (../nodes/rooms.js’s bayField).
function fieldOf(mouth, turn) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mouth.w, mouth.h), bayField());
  mesh.position.set(mouth.x, mouth.y + mouth.h / 2, mouth.z);
  mesh.rotation.y = turn;
  mesh.renderOrder = 2;
  mesh.name = 'magnetic-field';
  return mesh;
}

// The stars beyond the mouth, until the windows' views come: a sphere of
// soft points far out round the bay, a few tinted.
function starsOf(renderer, room, small) {
  const rand = seeded(1977);
  const n = small ? 1200 : 2600;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u) * 380;
    pos.set([room.x + Math.cos(a) * r, room.y + room.h / 2 + u * 380, room.z + Math.sin(a) * r], i * 3);
    const k = 0.25 + rand() ** 3 * 0.9;
    const tint = rand();
    col.set(tint < 0.12 ? [k, k * 0.86, k * 0.7] : tint < 0.24 ? [k * 0.8, k * 0.88, k] : [k, k, k], i * 3);
  }
  const sprite = sharpen(new THREE.CanvasTexture(starSprite(32)), { renderer, color: true });
  // (each a quad the size a point was: ../nodes/rooms.js’s starPoints)
  const points = starPoints(pos, col, sprite, { size: 2.2 });
  points.frustumCulled = false;
  points.name = 'stars';
  return {
    points,
    dispose() {
      points.geometry.dispose();
      points.material.dispose();
      sprite.dispose();
    },
  };
}

// ── the Falcon ──

// The ship’s frame at a spot: forward along its yaw (0 faces −z), right a quarter turn on.
const frameOf = (spot) => ({
  at: (r, f) => ({ x: spot.x + Math.cos(spot.yaw) * r + Math.sin(spot.yaw) * f, z: spot.z + Math.sin(spot.yaw) * r - Math.cos(spot.yaw) * f }),
});

// Mooring clamps on the deck round her, arms reaching up under the hull’s rim.
function clampsOf(kit, spot, deckY) {
  const { at } = frameOf(spot);
  const parts = [];
  for (const [r, f] of [[-15.2, 3], [15.2, 3], [-11, -11.5], [11, -11.5]]) {
    const p = at(r, f);
    const local = [
      kit.box(1.8, 0.5, 2.2, 0, 0.25, 0, 'trim'),
      kit.box(0.6, 2.2, 0.6, 0, 1.6, -0.5, 'trim'),
      kit.beam({ x: 0, y: 2.5, z: -0.5 }, { x: 0, y: 3.1, z: 1.6 }, 0.3, 0.3, 'rail'),
      kit.box(0.5, 0.5, 0.3, 0, 3.1, 1.75, 'black'),
      kit.box(0.2, 0.08, 0.2, 0, 2.75, -0.5, 'red'),
    ];
    parts.push(...kit.place(local, kit.at(p.x, deckY, p.z, Math.atan2(spot.x - p.x, spot.z - p.z))));
  }
  return parts;
}

// where her five legs stand, in her frame (right, forward): clear of the ramp and the hold
const LEGS = [[-4.5, 8], [4.5, 8], [-8.5, -2], [8.5, -2], [0, -9.5]];

// The Falcon, loaded and scaled to her length, nose along the spot’s yaw,
// lifted on her gear until her belly sits just under the hold’s floor at
// the hatch (read off the hull by a ray), with her own copies of the hull’s
// material (one-sided, so it can’t show through the hold’s floor) to take
// the bay’s reflection, and her legs built down to the deck.
async function dockFalcon(kit, spot, hold, hatch, deckY, renderer) {
  const got = await loadGltf(FALCON.url, { renderer, fresh: true });
  if (!got) return null;
  const model = got.scene;
  const mats = new Map();
  model.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    if (!mats.has(o.material)) {
      const m = o.material.clone();
      m.side = THREE.FrontSide;
      m.userData.reflect = true;
      mats.set(o.material, m);
    }
    o.material = mats.get(o.material);
  });
  // (she comes nose to +x: a quarter turn puts it to +z)
  const turn = new THREE.Group();
  turn.rotation.y = -Math.PI / 2;
  turn.add(model);
  turn.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(turn).getSize(new THREE.Vector3());
  turn.scale.setScalar(FALCON.length / size.z);
  turn.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turn);
  const centre = box.getCenter(new THREE.Vector3());
  turn.position.set(-centre.x, -box.min.y, -centre.z);
  const holder = new THREE.Group();
  holder.name = 'falcon';
  holder.add(turn);
  holder.rotation.y = Math.PI - spot.yaw;
  holder.position.set(spot.x, deckY, spot.z);
  holder.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const belly = (x, z) => {
    ray.set(new THREE.Vector3(x, deckY - 1, z), new THREE.Vector3(0, 1, 0));
    const hit = ray.intersectObject(model, true)[0];
    return hit ? hit.point.y - holder.position.y : null;
  };
  let lift = 0.45;
  if (hold && hatch) {
    const k = 0.5 / Math.max(1e-6, Math.hypot(hold.x - hatch.x, hold.z - hatch.z));
    const under = belly(hatch.x + (hold.x - hatch.x) * k, hatch.z + (hold.z - hatch.z) * k);
    if (under !== null) lift = Math.min(1.4, Math.max(0.2, hatch.y - 0.12 - deckY - under));
  }
  holder.position.y = deckY + lift;
  holder.updateMatrixWorld(true);
  const { at } = frameOf(spot);
  const parts = [];
  for (const [r, f] of LEGS) {
    const p = at(r, f);
    const top = belly(p.x, p.z);
    if (top === null) continue;
    const y1 = holder.position.y + top + 0.25;
    parts.push(kit.box(1.1, 0.12, 1.4, p.x, deckY + 0.06, p.z, 'trim'));
    parts.push(kit.post(0.15, p.x, deckY + 0.1, y1, p.z, 'rail'));
    parts.push(kit.post(0.26, p.x, deckY + (y1 - deckY) * 0.45, y1, p.z, 'trim'));
    parts.push(kit.beam({ x: p.x + 0.45, y: deckY + 0.12, z: p.z }, { x: p.x + 0.2, y: deckY + (y1 - deckY) * 0.6, z: p.z }, 0.08, 0.08, 'black'));
  }
  const gear = kit.merge(parts);
  gear.name = 'falcon-gear';
  return {
    holder,
    gear,
    dispose() {
      kit.free(gear);
      for (const m of mats.values()) m.dispose();
    },
  };
}

// ── the bay ──

export function buildHangar(kit, room, layout, { renderer = null } = {}) {
  const b = room.box;
  const top = room.y + room.h;
  const doors = room.doors.map((id) => layout.doors.get(id)).filter(Boolean);
  const hatch = doors.find((d) => layout.rooms.get(otherSide(d, room.id))?.inside === room.id);
  const hold = hatch ? layout.rooms.get(otherSide(hatch, room.id)) : null;
  const mouth = doors.find((d) => d.kind === 'arch' && layout.rooms.get(otherSide(d, room.id))?.kind === 'field');
  const spot = layout.station.spots?.falcon?.room === room.id ? layout.station.spots.falcon : null;
  const windows = [...layout.rooms.values()].filter((r) => r.kind === 'control').flatMap((r) => windowsOf(r, layout));
  const deck = room.floors.reduce((a, f) => (area(f) > area(a) ? f : a));
  const raised = room.floors.filter((f) => f !== deck);

  const parts = kit.shell(room, layout, { floor: false, ceiling: false, openings: windows, bay: 4, rib: 0.7, ribDepth: 0.55, tall: 2.4, lights: true, seed: 327 });
  parts.push(...deckOf(kit, deck, room, raised), ...ceilingOf(kit, room), ...gantriesOf(kit, room));
  for (const f of flights(room)) parts.push(...(hatch && fromDoor(f, hatch) ? rampOf(kit, f, hatch, deck.y) : stairOf(kit, f, room, deck.y)));
  // the office’s glass, a hand’s breadth into the bay (the office hangs its own on its side)
  for (const w of windows) {
    const g = new THREE.PlaneGeometry(Math.hypot(w.x1 - w.x0, w.z1 - w.z0), w.y1 - w.y0);
    const n = roomWalls(layout, room.id).find((r) => Math.abs(r.n.x * w.x0 + r.n.z * w.z0 - r.off) < 0.05)?.n ?? { x: 0, z: 0 };
    g.rotateY(Math.atan2(-(w.z1 - w.z0), w.x1 - w.x0)).translate((w.x0 + w.x1) / 2 + n.x * 0.03, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2 + n.z * 0.03);
    parts.push({ geo: g, mat: 'glass' });
  }
  if (mouth) parts.push(...mouthOf(kit, mouth, room));
  if (spot) parts.push(...clampsOf(kit, spot, deck.y));

  const built = kit.merge(parts);
  const group = new THREE.Group();
  group.name = room.id;
  group.add(built);
  const turn = mouth ? (mouth.axis === 'x' ? 0 : Math.PI / 2) : 0;
  const field = mouth ? fieldOf(mouth, turn) : null;
  if (field) group.add(field);
  const stars = starsOf(renderer, room, kit.small);
  group.add(stars.points);

  const inward = mouth ? (mouth.axis === 'x' ? { x: 0, z: -Math.sign(mouth.z - room.z) } : { x: -Math.sign(mouth.x - room.x), z: 0 }) : { x: 0, z: 0 };
  const lamps = [
    { x: spot?.x ?? room.x, y: top - 4, z: spot?.z ?? room.z, color: COOL, intensity: 900, distance: 60 },
    { x: b.x1 - 14, y: top - 6, z: room.z + 10, color: COOL, intensity: 650, distance: 50 },
    { x: b.x1 - 14, y: room.y + 10, z: b.z0 + 4, color: 0xe8efff, intensity: 180, distance: 24 },
    ...(mouth ? [{ x: mouth.x + inward.x * 6, y: mouth.y + mouth.h * 0.7, z: mouth.z + inward.z * 6, color: 0x9fc4ff, intensity: 320, distance: 40 }] : []),
  ];
  // (the probe stands clear of where the Falcon is, east of the bay’s middle)
  const at = { x: room.x + (b.x1 - b.x0) * 0.25, y: deck.y + 2.5, z: room.z + (b.z1 - b.z0) * 0.1 };
  let reflection = probeRoom(renderer, group, at, { lamps });
  let ship = null;
  let gone = false;
  if (spot) {
    dockFalcon(kit, spot, hold, hatch, deck.y, renderer)
      .then((s) => {
        if (!s) return;
        if (gone) return s.dispose();
        ship = s;
        group.add(s.holder, s.gear);
        // the deck mirrors her once she’s in
        reflection.dispose();
        reflection = probeRoom(renderer, group, at, { lamps });
      })
      .catch((err) => console.error('Docking Bay 327: the Falcon could not be berthed; the bay stands without her', err));
  }
  return {
    group,
    lamps,
    update(t) {
      if (field) field.material.uniforms.uTime.value = t;
    },
    dispose() {
      gone = true;
      reflection.dispose();
      kit.free(built);
      field?.geometry.dispose();
      field?.material.dispose();
      stars.dispose();
      ship?.dispose();
      group.removeFromParent();
    },
  };
}

export function buildField() {
  const group = new THREE.Group();
  group.name = 'field';
  return { group, lamps: [], dispose() {} };
}

// ── the hold ──

// The Falcon’s smuggling hold: cramped, its deck plates lifted off two
// compartments, a crate or two, one amber lamp. Where the hold sits lower
// than her belly, a skin closes it from the bay outside (holed at the hatch).
export function buildShip(kit, room, layout, { renderer = null } = {}) {
  const b = room.box;
  const y = room.y;
  const parts = kit.shell(room, layout, { floor: false, bay: 1.1, rib: 0.16, ribDepth: 0.1, kick: 0.18, band: 0.25, tall: 1.2, seed: 1138 });
  parts.push(kit.plate(b.x1 - b.x0, b.z1 - b.z0, room.x, y, room.z, 'trim', 'up'));
  for (const s of [-1, 1]) {
    const [cx, cz] = [room.x + s * Math.min(1.4, (b.x1 - b.x0) / 4), b.z0 + Math.min(1.1, (b.z1 - b.z0) / 3)];
    parts.push(kit.plate(1.2, 0.8, cx, y + 0.004, cz, 'black', 'up'));
    for (const [w, d, dx, dz] of [[1.3, 0.05, 0, -0.425], [1.3, 0.05, 0, 0.425], [0.05, 0.8, -0.625, 0], [0.05, 0.8, 0.625, 0]]) parts.push(kit.box(w, 0.02, d, cx + dx, y + 0.01, cz + dz, 'rail'));
    parts.push(kit.box(1.2, 0.04, 0.8, cx, y + 0.03, cz + 0.9, 'trim'));
  }
  parts.push(kit.box(0.9, 0.7, 0.7, b.x0 + 0.6, y + 0.35, room.z + 0.4, 'trim'), kit.box(0.6, 0.45, 0.6, b.x0 + 0.55, y + 0.93, room.z + 0.4, 'black'));
  // the skin under her belly, facing out, from just under the deck to 1.05 m up
  const [lo, hi] = [-0.15, 1.05];
  for (const run of roomWalls(layout, room.id)) {
    const holes = run.holes.map((h) => ({ ...h, y0: h.y0 - lo, y1: h.y1 - lo }));
    for (const r of solidRects(run.len, hi - lo, holes)) {
      const g = new THREE.PlaneGeometry(r.x1 - r.x0, r.y1 - r.y0).rotateY(Math.PI).translate((r.x0 + r.x1) / 2, lo + (r.y0 + r.y1) / 2, -0.1);
      parts.push(...kit.place([{ geo: g, mat: 'trim' }], kit.at(run.x0, run.y0, run.z0, run.angle)));
    }
  }
  parts.push(kit.plate(b.x1 - b.x0 + 0.2, b.z1 - b.z0 + 0.2, room.x, y + lo, room.z, 'trim', 'down'));
  const lamps = [{ x: room.x, y: y + room.h - 0.3, z: room.z, color: 0xffb070, intensity: 3, distance: 6 }];
  const group = kit.merge(parts);
  group.name = room.id;
  const reflection = probeRoom(renderer, group, { x: room.x, y: y + 1.2, z: room.z }, { lamps });
  return {
    group,
    lamps,
    dispose() {
      reflection.dispose();
      kit.free(group);
      group.removeFromParent();
    },
  };
}
