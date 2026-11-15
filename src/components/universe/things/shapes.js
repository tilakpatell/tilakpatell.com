// The shapes and materials of lane 4a's things in space, near: each kind a
// list of parts, every part one geometry and one stock material (no shader of
// its own: the site's GLSL is at its budget), unit-sized and scaled by the
// thing's size when it's drawn. Additive parts (a comet's coma and tail, a
// storm's puffs, a beacon's lamp, a pulsar's beams, a wormhole's swirl) glow
// over 1 so the bloom takes them; the rest are lit by the scene's suns.
//
// partsOf(kind, tier) → [{ name, geometry, material, additive, billboard, many, tint }]: made once a
//   kind. billboard: a soft glow on a quad the drawer turns to the camera; many: drawn many an
//   entry (a field's rocks); tint: the instances' colour (a rock material reads it)
// PALETTE colours are the catalogue's (KINDS[kind].color), the four lattice kinds lane 2's own.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../../../lib/three/canvasTexture';
import { rock, rockMaterial } from '../../../lib/three/rock';
import { KINDS } from '../../expanse/shared/gen';

const merged = (list) => {
  const g = mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)));
  for (const x of list) x.dispose();
  g.computeVertexNormals();
  return g;
};
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const lit = (kind, o = {}) => new THREE.MeshStandardMaterial({ color: KINDS[kind].color, roughness: 0.7, metalness: 0.3, flatShading: true, ...o });
const glow = (hex, k = 2.4, opacity = 1) => new THREE.MeshBasicMaterial({ color: hot(hex, k), toneMapped: false, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

// a hull, its nose along +z, a unit long: a box with a tapered nose and a bridge
const hullGeometry = () => merged([box(0.22, 0.12, 0.7, 0, 0, -0.1), new THREE.ConeGeometry(0.11, 0.3, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).translate(0, 0, 0.4), box(0.08, 0.1, 0.14, 0, 0.1, -0.2)]);

// a soft round glow, made in code (no canvas, so it's the same in Node): a puff, a coma, a lamp
let dot = null;
export const softDot = () => {
  if (dot) return dot;
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const a = Math.max(0, 1 - r) ** 2.2;
      data.set([255, 255, 255, Math.round(a * 255)], (y * n + x) * 4);
    }
  dot = new THREE.DataTexture(data, n, n);
  dot.needsUpdate = true;
  return dot;
};
// a camera-facing glow (the drawer turns each instance to face the camera)
const puff = (hex, k, opacity) => new THREE.MeshBasicMaterial({ map: softDot(), color: hot(hex, k), toneMapped: false, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
const PLANE = () => new THREE.PlaneGeometry(2, 2);
// a ring whose light falls off from its inner edge to nothing at its outer (additive: black is clear)
const fading = (inner, outer) => {
  const g = new THREE.RingGeometry(inner, outer, 128, 8);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.pow(1 - (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 3);
    col.set([k, k, k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
};

const SHAPES = {
  outpost: (tier) => [{ name: 'hub', geometry: merged([box(0.6, 0.35, 0.6), box(1.4, 0.08, 0.12), box(0.12, 0.08, 1.4), new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6).translate(0.3, 0.5, 0.3)]), material: lit('outpost', { metalness: 0.5 }), tier }],
  relay: () => [
    { name: 'mast', geometry: merged([new THREE.CylinderGeometry(0.05, 0.08, 1.2, 6), new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, 0.9).rotateX(-0.5).translate(0, 0.7, 0)]), material: lit('relay', { side: THREE.DoubleSide, metalness: 0.6 }) },
    { name: 'lamp', geometry: new THREE.SphereGeometry(0.06, 8, 6).translate(0, 1.2, 0), material: glow(KINDS.relay.color, 3), additive: true },
  ],
  monolith: () => [{ name: 'slab', geometry: box(0.28, 1.2, 0.7), material: new THREE.MeshStandardMaterial({ color: '#0c0d10', roughness: 0.15, metalness: 0.8 }) }],
  beacon: () => [
    { name: 'body', geometry: merged([new THREE.OctahedronGeometry(0.4), new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4)]), material: lit('beacon', { color: '#8a8f99' }) },
    { name: 'lamp', geometry: PLANE(), material: puff(KINDS.beacon.color, 3, 0.9), additive: true, billboard: true },
  ],
  comet: () => [
    { name: 'nucleus', geometry: rock(31), material: lit('comet', { color: '#5a5650', flatShading: true }) },
    { name: 'coma', geometry: PLANE(), material: puff(KINDS.comet.color, 1.8, 0.7), additive: true, billboard: true },
    // (a cone, its base at the head and its tip a tail's length away along +y)
    { name: 'tail', geometry: new THREE.ConeGeometry(1, 1, 16, 1, true).translate(0, -0.5, 0).rotateX(Math.PI), material: glow('#9fd8ff', 1.4, 0.28), additive: true },
  ],
  field: (tier) => [{ name: 'rocks', geometry: rock(7), material: rockMaterial({ tier }), many: 'rocks', tint: KINDS.rock.color }],
  icefield: () => [{ name: 'shards', geometry: rock(19).scale(0.8, 1.35, 0.8), material: new THREE.MeshStandardMaterial({ color: KINDS.icefield.color, roughness: 0.35, flatShading: true }), many: 'rocks' }],
  rig: (tier) => [
    { name: 'rock', geometry: rock(11), material: rockMaterial({ tier }), tint: KINDS.rock.color },
    { name: 'tower', geometry: merged([new THREE.CylinderGeometry(0.06, 0.1, 1.2, 6).translate(0, 0.9, 0), box(0.9, 0.06, 0.06, 0, 1.3, 0), box(0.06, 0.06, 0.9, 0, 1.1, 0)]), material: lit('rig', { color: '#7d7466' }) },
    { name: 'lights', geometry: new THREE.SphereGeometry(0.05, 6, 4).translate(0, 1.5, 0), material: glow(KINDS.rig.color, 3), additive: true },
    { name: 'haulers', geometry: hullGeometry(), material: lit('fleet'), many: 'haulers' },
  ],
  debris: () => [{ name: 'pieces', geometry: merged([box(1, 0.08, 0.6), box(0.1, 0.1, 1.2, 0.4, 0, 0)]), material: lit('debris', { metalness: 0.6 }), many: 'pieces' }],
  fleet: () => [{ name: 'ships', geometry: hullGeometry(), material: lit('fleet', { metalness: 0.45 }), many: 'ships' }],
  shipyard: () => [
    { name: 'frame', geometry: merged([...[-1, 1].flatMap((x) => [-1, 1].map((y) => box(0.03, 0.03, 1.6, x * 0.35, y * 0.25, 0))), ...[-0.7, -0.2, 0.3, 0.75].map((z) => box(0.73, 0.03, 0.03, 0, 0.25, z)), ...[-0.7, -0.2, 0.3, 0.75].map((z) => box(0.73, 0.03, 0.03, 0, -0.25, z))]), material: lit('shipyard', { metalness: 0.6 }) },
    { name: 'hull', geometry: hullGeometry().scale(2, 2, 1.8), material: lit('fleet', { color: '#6f747d' }) },
    { name: 'lights', geometry: new THREE.SphereGeometry(0.03, 6, 4).translate(0.35, 0.28, 0.75), material: glow('#ffc070', 3), additive: true },
  ],
  // (its body is lane 1's nebula volume, the storm's own cloud: here only the lightning inside it)
  storm: () => [{ name: 'sparks', geometry: PLANE(), material: puff('#e8f4ff', 3, 0.9), additive: true, many: 'sparks', billboard: true }],
  herd: () => [{ name: 'bodies', geometry: merged([new THREE.SphereGeometry(0.5, 14, 10).scale(0.55, 0.45, 1.6), new THREE.ConeGeometry(0.3, 0.9, 8).rotateX(-Math.PI / 2).translate(0, 0, -1.2)]), material: lit('herd', { roughness: 0.5, metalness: 0.1, flatShading: false, emissive: KINDS.herd.color, emissiveIntensity: 0.25 }), many: 'bodies' }],
  swarm: () => [{ name: 'motes', geometry: PLANE(), material: puff(KINDS.swarm.color, 3, 0.9), additive: true, many: 'motes', billboard: true }],
  pulsar: () => [
    { name: 'star', geometry: new THREE.SphereGeometry(0.25, 16, 12), material: glow(KINDS.pulsar.color, 4) },
    { name: 'halo', geometry: PLANE(), material: puff(KINDS.pulsar.color, 2.5, 0.8), additive: true, billboard: true },
    { name: 'beams', geometry: new THREE.ConeGeometry(1, 1, 12, 1, true).translate(0, -0.5, 0).rotateX(Math.PI), material: glow(KINDS.pulsar.color, 2, 0.25), additive: true, many: 'beams' },
  ],
  magnetar: () => [
    { name: 'star', geometry: new THREE.SphereGeometry(0.25, 16, 12), material: glow(KINDS.magnetar.color, 4) },
    { name: 'halo', geometry: PLANE(), material: puff(KINDS.magnetar.color, 2.5, 0.8), additive: true, billboard: true },
    { name: 'beams', geometry: new THREE.ConeGeometry(1, 1, 12, 1, true).translate(0, -0.5, 0).rotateX(Math.PI), material: glow(KINDS.magnetar.color, 2, 0.25), additive: true, many: 'beams' },
  ],
  protostar: () => [
    { name: 'core', geometry: new THREE.SphereGeometry(0.12, 16, 12), material: glow(KINDS.protostar.color, 3.5) },
    { name: 'halo', geometry: PLANE(), material: puff(KINDS.protostar.color, 2, 0.6), additive: true, billboard: true },
    { name: 'disc', geometry: new THREE.RingGeometry(0.2, 1, 48, 2).rotateX(-Math.PI / 2), material: new THREE.MeshBasicMaterial({ color: hot(KINDS.protostar.color, 0.9), toneMapped: false, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }) },
  ],
  // (a dark throat ringed by the starlight it bends: a thin bright ring at the edge, a fainter
  // one further out, and arcs of smeared stars; no painted spiral)
  wormhole: () => [
    { name: 'throat', geometry: new THREE.SphereGeometry(0.42, 32, 20), material: new THREE.MeshBasicMaterial({ color: '#000000' }) },
    { name: 'ring', geometry: new THREE.RingGeometry(0.425, 0.438, 128, 1), material: new THREE.MeshBasicMaterial({ color: hot('#e6eeff', 2.4), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), additive: true, billboard: true },
    { name: 'halo', geometry: fading(0.44, 0.75), material: new THREE.MeshBasicMaterial({ vertexColors: true, color: hot('#b9c8ff', 0.9), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), additive: true, billboard: true },
    { name: 'arcs', geometry: new THREE.RingGeometry(0.5, 0.505, 48, 1, 0, 0.8), material: new THREE.MeshBasicMaterial({ color: hot('#ffffff', 1.2), toneMapped: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), additive: true, billboard: true, many: 'arcs' },
  ],
};

export const DRAWN = Object.keys(SHAPES);
export const partsOf = (kind, tier = 'mid') => SHAPES[kind]?.(tier) ?? [];
