// The covered bridge and the stone circle (the design’s §4.3): the timber
// bridge out of the castle’s west gate (castle/castle.js builds it in a
// group of its own) creaks and sways as you cross it, a slow roll about its
// long axis and a give where you stand, more the faster you go, a little in
// the wind when no one is on it; and at its far end on the knoll, the
// stone circle: eleven rough standing stones in a ring, one fallen, the
// view back to the castle across the gully.
//
//   ON: m from the bridge’s line you count as on it
//   swayOf(t, on, speed) → the roll (radians) at t (pure)
//   creakEvery(speed) → s between creaks at that speed (pure)
//   onBridge(at, frame) → 0…1 how far along the deck you stand, or null off it (pure)
//   createBridge({ bridge: { group, frame }, materials, ground, tier }) → { group (the circle), colliders, step(dt, { at, speed }) → { creak }, dispose() }

import * as THREE from 'three';
import { createMesh } from '../castle/mesh';
import { BRIDGES } from '../castle/plan';
import { placeById } from '../../rules/places';
import { seeded } from '../../../../lib/seeded';

export const ON = 2.2;
const CIRCLE = placeById('stone-circle');

export function swayOf(t, on, speed = 0) {
  const wind = 0.0025 * Math.sin(t * 0.9);
  const walk = on * (0.006 + 0.004 * Math.min(1, speed / 3)) * (Math.sin(t * 2.1) + 0.45 * Math.sin(t * 3.7 + 1));
  return wind + walk;
}

export const creakEvery = (speed) => (speed > 0.3 ? 2.6 / Math.min(2, 0.5 + speed / 2) : Infinity);

export function onBridge(at, { from, to } = BRIDGES.covered) {
  if (!at) return null;
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const l2 = dx * dx + dz * dz;
  const t = ((at[0] - from[0]) * dx + (at[2] - from[2]) * dz) / l2;
  if (t < 0 || t > 1) return null;
  const off = Math.hypot(at[0] - from[0] - dx * t, at[2] - from[2] - dz * t);
  const deck = from[1] + (to[1] - from[1]) * t;
  return off <= ON && Math.abs(at[1] - deck) < 2.5 ? t : null;
}

export function createBridge({ bridge = null, materials, ground, tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'grounds:stone-circle';
  const m = createMesh();
  const rng = seeded(57);
  const [cx, cz] = CIRCLE.at;
  const colliders = [];
  // the ring: eleven stones, each a rough slab a little out of true, one lying where it fell
  const n = 11;
  const R = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const x = cx + Math.sin(a) * R;
    const z = cz + Math.cos(a) * R;
    const y = ground(x, z);
    const h = 2.4 + rng() * 1.8;
    const w = 1.0 + rng() * 0.6;
    const d = 0.55 + rng() * 0.35;
    const tone = [0.48 + rng() * 0.1, 0.47 + rng() * 0.09, 0.44 + rng() * 0.08];
    m.tone(tone);
    if (i === 7) {
      // (the fallen one, on its side in the grass)
      m.box('rubble', { at: [x, y - 0.25, z], size: [h, d + 0.1, w], turn: a + 0.4 });
      continue;
    }
    // (each a slab with a narrower, rougher top, its face to the circle’s middle)
    m.box('rubble', { at: [x, y - 0.5, z], size: [w, h * 0.72 + 0.5, d], turn: a });
    m.box('rubble', { at: [x + (rng() - 0.5) * 0.12, y + h * 0.72, z + (rng() - 0.5) * 0.12], size: [w * 0.82, h * 0.28, d * 0.9], turn: a + (rng() - 0.5) * 0.12 });
    colliders.push({ id: 'stone', kind: 'circle', at: [x, z], r: Math.max(w, d) * 0.55 });
  }
  const geometries = m.geometries();
  for (const [name, g] of Object.entries(geometries)) {
    const mesh = new THREE.Mesh(g, materials[name]);
    mesh.castShadow = mesh.receiveShadow = tier !== 'low';
    mesh.name = `circle:${name}`;
    group.add(mesh);
  }

  let t = 0;
  let on = 0;
  let since = 0;
  const base = bridge?.group ? bridge.group.rotation.x : 0;
  const baseY = bridge?.group ? bridge.group.position.y : 0;
  return {
    group,
    colliders,
    step(dt, { at = null, speed = 0 } = {}) {
      t += dt;
      const here = onBridge(at);
      on += ((here != null ? 1 : 0) - on) * Math.min(1, dt * 3);
      if (bridge?.group) {
        // (a roll about its long axis, and a dip toward where you stand, out at its middle most)
        bridge.group.rotation.x = base + swayOf(t, on, speed);
        bridge.group.position.y = baseY - on * 0.05 * Math.sin(Math.PI * (here ?? 0.5)) * (1 + 0.3 * Math.sin(t * 2.1));
      }
      let creak = 0;
      if (here != null && (since += dt) > creakEvery(speed)) {
        since = 0;
        creak = 0.4 + 0.6 * Math.min(1, speed / 3);
      }
      return { creak };
    },
    dispose() {
      for (const g of Object.values(geometries)) g.dispose();
    },
  };
}
