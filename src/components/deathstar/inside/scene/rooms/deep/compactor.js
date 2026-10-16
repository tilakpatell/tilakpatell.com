// Garbage compactor 3263827, as A New Hope has it: a deep pit of murky
// green-brown water with heaps of junk standing out of it, its long walls
// heavy with ribs, a grimy shaft of light down from a vent, the dianoga’s
// rings spreading on the water where it lies; the walkway at its east end
// with the rubbish to climb out by, and the hatch over it with its keypad
// and its number stencilled above. The two long walls over the water are
// the mashers: while the story says so (ctx.flags has 'walls-closing') they
// close in over its forty seconds, and they draw back once it stops.
//
//   MASHER: { depth, travel }   how thick a masher stands off its wall, and how far it closes
//   COMPACTOR_PROPS: { junk, keypad, stencil }   (prop) → parts about its foot
//   waterOf(room) → { y, x0, x1, z0, z1 } | null   the water: a metre over the bottom, up to the dry deck
//   mashersOf(room) → [{ side, x0, x1, z, inward, travel } | { side, z0, z1, x, inward, travel }]
//     the long walls over the water, each moving `inward` (+1 or −1 along z, or x) by up to travel
//   waterNormals(n, seed) → Uint8Array   an n × n RGBA normal map of ripples that tiles
//   buildCompactor(kit, room, layout, { renderer }) → { group, lamps, update(t, dt, ctx), dispose() }

import * as THREE from 'three';
import { seeded } from '../../../../../../lib/seeded';
import { sharpen } from '../../../../../../lib/three/textures';
import { furnish } from '../../../rules/furnish';
import { grimeOf } from './cells';
import { box, boundsOf, cyl, digitRects, drawWith, finish, flagsOf, hazeMaterial, plate, resolve, stepClose } from './parts';
import { waterSurface } from '../../nodes/rooms';

export const MASHER = { depth: 0.3, travel: 1.25 };
const DEEP = 0.98; // the water over the bottom: the floating junk (furnish.js, 0.96 up, 0.08 thick) rides in it
const DRY = 0.1; // a deck this near the surface, or above it, stands out of the water
const RIB = 0.42; // between a masher’s ribs

// ── the water and the walls ──

// a box less another, as up to four boxes; the biggest is kept
function biggestLeft(r, c) {
  if (c.x1 <= r.x0 || c.x0 >= r.x1 || c.z1 <= r.z0 || c.z0 >= r.z1) return r;
  const [z0, z1] = [Math.max(r.z0, c.z0), Math.min(r.z1, c.z1)];
  const out = [];
  if (c.z0 > r.z0) out.push({ ...r, z1: c.z0 });
  if (c.z1 < r.z1) out.push({ ...r, z0: c.z1 });
  if (c.x0 > r.x0) out.push({ ...r, x1: c.x0, z0, z1 });
  if (c.x1 < r.x1) out.push({ ...r, x0: c.x1, z0, z1 });
  const area = (b) => (b.x1 - b.x0) * (b.z1 - b.z0);
  return out.sort((a, b) => area(b) - area(a))[0] ?? null;
}

export function waterOf(room) {
  const floors = room.floors ?? [];
  if (!floors.length) return null;
  const bottom = floors.reduce((a, f) => (f.y < a.y ? f : a));
  const y = bottom.y + DEEP;
  let rect = { x0: bottom.x0, x1: bottom.x1, z0: bottom.z0, z1: bottom.z1 };
  for (const f of floors) if (f.y >= y - DRY && rect) rect = biggestLeft(rect, f);
  return rect ? { y, ...rect } : null;
}

export function mashersOf(room) {
  const water = waterOf(room);
  if (!water) return [];
  const b = room.box;
  const span = room.w >= room.d ? b.z1 - b.z0 : b.x1 - b.x0;
  // closed, the two leave a gap a body barely fits
  const travel = Math.min(MASHER.travel, Math.max(0, (span - 2 * MASHER.depth - 0.9) / 2));
  if (room.w >= room.d) {
    return [
      { side: 'north', x0: water.x0, x1: water.x1, z: b.z0, inward: 1, travel },
      { side: 'south', x0: water.x0, x1: water.x1, z: b.z1, inward: -1, travel },
    ];
  }
  return [
    { side: 'west', z0: water.z0, z1: water.z1, x: b.x0, inward: 1, travel },
    { side: 'east', z0: water.z0, z1: water.z1, x: b.x1, inward: -1, travel },
  ];
}

export function waterNormals(n, seed) {
  const rand = seeded(seed);
  // waves with whole numbers of crests across the tile, so it wraps without a seam
  const waves = Array.from({ length: 7 }, () => {
    let [kx, ky] = [Math.round((rand() * 2 - 1) * 5), Math.round((rand() * 2 - 1) * 5)];
    if (!kx && !ky) kx = 1;
    return { kx, ky, a: (0.6 + rand()) / Math.hypot(kx, ky), ph: rand() * Math.PI * 2 };
  });
  const out = new Uint8Array(n * n * 4);
  const lean = 0.035;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let [du, dv] = [0, 0];
      for (const w of waves) {
        const c = Math.cos(2 * Math.PI * ((w.kx * x) / n + (w.ky * y) / n) + w.ph) * w.a * 2 * Math.PI;
        du += c * w.kx;
        dv += c * w.ky;
      }
      const [nx, ny] = [-du * lean, -dv * lean];
      const len = Math.hypot(nx, ny, 1);
      const i = (y * n + x) * 4;
      out[i] = Math.round((nx / len / 2 + 0.5) * 255);
      out[i + 1] = Math.round((ny / len / 2 + 0.5) * 255);
      out[i + 2] = Math.round((1 / len / 2 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

// ── the drawers ──

// A part shrunk about its middle, if it must be, and moved in, so it lies within b.
function fitInto(part, b) {
  const p = boundsOf([part]);
  const s = Math.min(1, (b.x1 - b.x0) / (p.x1 - p.x0 || 1), (b.y1 - b.y0) / (p.y1 - p.y0 || 1), (b.z1 - b.z0) / (p.z1 - p.z0 || 1));
  const c = { x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2, z: (p.z0 + p.z1) / 2 };
  part.geo.translate(-c.x, -c.y, -c.z).scale(s, s, s);
  const [hx, hy, hz] = [((p.x1 - p.x0) * s) / 2, ((p.y1 - p.y0) * s) / 2, ((p.z1 - p.z0) * s) / 2];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  part.geo.translate(clamp(c.x, b.x0 + hx, b.x1 - hx), clamp(c.y, b.y0 + hy, b.y1 - hy), clamp(c.z, b.z0 + hz, b.z1 - hz));
  return part;
}

// A block crushed in: its sides dented inwards and its top sagging, the
// same dent for every face that shares a corner, so it holds together.
function crushed(w, h, d, rand, sag = 0.25) {
  const g = new THREE.BoxGeometry(w, h, d, 3, 2, 3);
  const p = g.attributes.position;
  const dents = new Map();
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (!dents.has(key)) dents.set(key, [1 - rand() * 0.06, y > 0 ? rand() * sag * h : 0, 1 - rand() * 0.06]);
    const [sx, dy, sz] = dents.get(key);
    p.setXYZ(i, x * sx, y + h / 2 - dy, z * sz);
  }
  g.computeVertexNormals();
  return g;
}

// A heap: a crushed block most of its height, and on it a pipe, a bent
// plate and a drum, each kept within the heap’s box. A flat bit floats.
function junk(p) {
  const { w, d, h } = p;
  const rand = seeded(Math.floor(Math.abs(p.x * 7919 + p.z * 104729)) + 1);
  if (h < 0.15) return [box(w * 0.9, h * 0.5, d * 0.85, 0, h * 0.5, 0, 'junk'), box(w * 0.45, h * 0.35, d * 0.25, w * 0.15, h * 0.75, d * 0.2, 'trim')];
  const bounds = { x0: -w / 2, x1: w / 2, y0: 0, y1: h, z0: -d / 2, z1: d / 2 };
  const parts = [{ geo: crushed(w - 0.02, h * 0.75, d - 0.02, rand), mat: 'junk' }];
  const r = 0.035 + rand() * 0.03;
  const pipe = cyl(r, r, w * (0.7 + rand() * 0.4), 0, h * (0.72 + rand() * 0.2), (rand() - 0.5) * d * 0.5, rand() < 0.5 ? 'rail' : 'trim', { axis: 'x', sides: 8 });
  pipe.geo.rotateY((rand() - 0.5) * 0.6);
  const sheet = box(w * (0.4 + rand() * 0.4), 0.03, d * (0.5 + rand() * 0.4), (rand() - 0.5) * w * 0.3, h * 0.8, (rand() - 0.5) * d * 0.3, rand() < 0.5 ? 'trim' : 'junk');
  sheet.geo.rotateX((rand() - 0.5) * 0.8).rotateZ((rand() - 0.5) * 0.6);
  const dr = Math.min(w, d) * (0.18 + rand() * 0.12);
  const drum = cyl(dr, dr, h * 0.35, (rand() < 0.5 ? -1 : 1) * (w / 2 - dr), h * 0.82, (rand() - 0.5) * (d - 2 * dr), 'junk', { sides: 12 });
  for (const part of [pipe, sheet, drum]) parts.push(fitInto(part, bounds));
  return parts;
}

// the hatch’s keypad: a plate, a little readout and twelve keys
function keypad(p) {
  const z = -p.d / 2;
  const parts = [box(p.w, p.h, 0.03, 0, p.h / 2, z + 0.015, 'trim'), plate(p.w - 0.06, 0.06, 0, p.h - 0.06, z + 0.031, 'screen')];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) parts.push(box(0.045, 0.035, 0.012, (c - 1) * 0.065, 0.05 + r * 0.055, z + 0.036, r === 0 && c === 2 ? 'red' : 'console'));
  return parts;
}

// The number stencilled over the hatch, in worn paint on the wall, in the
// top of its box: the foot of the box (furnish.js puts it 0.12 m over the
// hatch) is behind the hatch frame’s lintel (kit.js FRAME.hatch, 0.18 m).
const UNDER_LINTEL = 0.065;
function stencil(p) {
  const text = String(p.text ?? '');
  const size = Math.min(p.h - UNDER_LINTEL - 0.005, (p.w * 0.94) / Math.max(digitRects(text, 1).w, 1e-6));
  const lift = p.h - 0.005 - size;
  return digitRects(text, size).rects.map((r) => box(r.x1 - r.x0, r.y1 - r.y0, 0.004, (r.x0 + r.x1) / 2, lift + (r.y0 + r.y1) / 2, -p.d / 2 + 0.002, 'paint'));
}

export const COMPACTOR_PROPS = { junk, keypad, stencil };

// ── the room ──

// A masher, in its own frame: along +x from 0 to len, its back on the wall
// at z 0 and its face MASHER.depth out towards +z, from the bottom up h.
function masher(len, h) {
  const parts = [box(len, h, 0.12, len / 2, h / 2, 0.06, 'wall')];
  for (let y = 0.3; y < h - 0.2; y += RIB) parts.push(box(len - 0.1, 0.13, MASHER.depth - 0.12, len / 2, y, 0.12 + (MASHER.depth - 0.12) / 2, 'trim'));
  for (const x of [0.12, len - 0.12]) parts.push(box(0.24, h, MASHER.depth, x, h / 2, MASHER.depth / 2, 'junk'));
  for (let x = 1.5; x < len - 1; x += 1.75) parts.push(box(0.14, h - 0.2, MASHER.depth - 0.02, x, h / 2, (MASHER.depth - 0.02) / 2, 'junk'));
  return parts;
}

// The murky water: the kit’s idea of a surface, a ripple map sampled twice
// drifting two ways, and the dianoga’s rings spreading from where it lies.
function waterMaterial(renderer, water) {
  const n = 128;
  const map = new THREE.DataTexture(waterNormals(n, 3263827), n, n, THREE.RGBAFormat);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  sharpen(map, { renderer, color: false, repeat: [(water.x1 - water.x0) / 2.6, (water.z1 - water.z0) / 2.6] });
  // (the surface’s two drifting samples and the rings: ../../nodes/rooms.js’s waterSurface)
  const { material, uniforms } = waterSurface({ name: 'ds-water', color: 0x3d3f20, roughness: 0.16, metalness: 0.1, emissive: 0x10130a, normalMap: map, normalScale: new THREE.Vector2(0.45, 0.45), transparent: true, opacity: 0.88, envMapIntensity: 1.2 });
  return { material, map, uniforms };
}

export function buildCompactor(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const water = waterOf(room);
  const own = {
    wall: grimeOf(kit, 0x77735a),
    junk: new THREE.MeshStandardMaterial({ name: 'ds-junk', color: 0x5a4c39, roughness: 0.72, metalness: 0.4 }),
    paint: new THREE.MeshStandardMaterial({ name: 'ds-paint', color: 0xcfc6a0, roughness: 0.85, metalness: 0 }),
  };
  const parts = kit.shell(room, layout, { floor: false, bay: 1, rib: 0.3, ribDepth: 0.16, tall: 0.7, kick: 0.4, band: 0.5, seed: 3263827 });
  const b = room.box;
  const top = room.y + room.h;
  const bottom = Math.min(...room.floors.map((f) => f.y));
  // the bottom, the rubbish steps and the walkway with its deck plate
  for (const f of room.floors) {
    const [w, d, cx, cz] = [f.x1 - f.x0, f.z1 - f.z0, (f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2];
    if (f.y <= bottom) parts.push(plate(w, d, cx, f.y, cz, 'black', 'up'));
    else if (!water || f.y < water.y - 0.1) parts.push(box(w, f.y - bottom, d, cx, (f.y + bottom) / 2, cz, 'junk'), plate(w - 0.1, d - 0.1, cx, f.y + 0.002, cz, 'trim', 'up'));
    else parts.push(box(w, f.y - 0.06 - bottom, d, cx, (f.y - 0.06 + bottom) / 2, cz, 'black'), box(w, 0.06, d, cx, f.y - 0.03, cz, 'trim'), plate(w - 0.08, d - 0.08, cx, f.y + 0.002, cz, 'grate', 'up'));
  }
  // heavy beams across the ceiling, and the vent the light comes down from
  for (let x = b.x0 + 0.65; x < b.x1; x += 1.3) parts.push(box(0.24, 0.32, b.z1 - b.z0, x, top - 0.16, room.z, 'trim'));
  const vent = { x: water ? water.x0 + (water.x1 - water.x0) * 0.42 : room.x, z: room.z + 0.3 };
  parts.push(plate(0.9, 0.9, vent.x, top - 0.36, vent.z, 'grate', 'down'), plate(0.8, 0.8, vent.x, top - 0.34, vent.z, 'strip', 'down'));
  for (const p of props) parts.push(...drawWith(COMPACTOR_PROPS, p));

  const extra = [];
  // the mashers, each its own group so it can close
  const walls = mashersOf(room).map((m) => {
    const len = m.x1 - m.x0;
    const g = kit.merge(resolve(masher(len, top - bottom), own));
    g.name = `masher-${m.side}`;
    const base = m.inward > 0 ? { x: m.x0, z: m.z, turn: 0 } : { x: m.x1, z: m.z, turn: Math.PI };
    g.position.set(base.x, bottom, base.z);
    g.rotation.y = base.turn;
    extra.push(g);
    return { g, m, base };
  });
  // the water, and the shaft of light down onto it
  const surface = water ? waterMaterial(renderer, water) : null;
  if (surface) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(water.x1 - water.x0, water.z1 - water.z0).rotateX(-Math.PI / 2), surface.material);
    mesh.position.set((water.x0 + water.x1) / 2, water.y, (water.z0 + water.z1) / 2);
    mesh.name = 'water';
    mesh.renderOrder = 1;
    extra.push(mesh);
  }
  const fall = top - 0.36 - (water?.y ?? bottom);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 1.05, fall, 20, 1, true), hazeMaterial({ color: 0xd2dcb4, strength: 0.13 }));
  shaft.position.set(vent.x, top - 0.36 - fall / 2, vent.z);
  shaft.name = 'light-shaft';
  shaft.renderOrder = 3;
  extra.push(shaft);

  const spot = layout.station.spots?.dianoga;
  const dianoga = spot?.room === room.id ? spot : { x: room.x, z: room.z };
  const hatch = props.find((p) => p.kind === 'stencil');
  const lamps = [
    { x: vent.x, y: top - 0.6, z: vent.z, color: 0xcbd9a6, intensity: 34, distance: 11 },
    { x: b.x0 + 1.2, y: top - 1, z: room.z, color: 0x9fb07a, intensity: 10, distance: 8 },
    { x: hatch?.x ?? b.x1 - 1.5, y: top - 1.2, z: (hatch?.z ?? b.z0) + 1, color: 0xffc58a, intensity: 6, distance: 6 },
  ];
  let k = 0;
  const built = finish(kit, room, parts, {
    lamps,
    own,
    maps: surface ? [surface.map] : [],
    extra,
    renderer,
    probeAt: { x: room.x, y: (water?.y ?? room.y) + 1.2, z: room.z },
    update(t, dt, ctx) {
      k = stepClose(k, dt, flagsOf(ctx).has('walls-closing'));
      // a masher grinds in by fits and starts
      const shove = k * (1 - 0.04 * Math.abs(Math.sin(t * 7)) * (k > 0 && k < 1 ? 1 : 0));
      for (const { g, m, base } of walls) g.position.z = base.z + m.inward * m.travel * shove;
      if (surface) {
        surface.uniforms.uTime.value = t;
        surface.uniforms.uRipple.value.set(dianoga.x, dianoga.z, 0.35 + 0.25 * Math.sin(t * 0.6));
      }
      shaft.material.uniforms.uTime.value = t;
    },
    dispose() {
      shaft.geometry.dispose();
      shaft.material.dispose();
      surface?.material.dispose();
    },
  });
  // the water mirrors the room too
  if (surface) surface.material.envMap = built.reflection.envMap;
  return built;
}
