// What the second Death Star’s working half shows of space: the magnetic
// field across a bay’s mouth (a faint sheet of slow ripples, brighter at
// its rim where the emitters hold it), the lip of the deck over the mouth
// with the station’s face falling away under it, and the stars beyond a
// mouth or a window. The views of Endor and the fleet are scene/views.js’
// to give (the spec’s Task 6.3); until a room takes one, the stars stand in.
//
//   fieldOver(mouth) → { mesh, update(t), dispose() }   the sheet filling a doorway ({ x, y, z, w, h, axis })
//   lipOf(kit, mouth, room) → parts   the deck’s edge and the station’s face under it, lit along the lip
//   starsRound(renderer, at, { small, seed }) → { points, dispose() }   a far sphere of soft points round `at`

import * as THREE from 'three';
import { seeded } from '../../../../../../lib/seeded';
import { sharpen } from '../../../../../../lib/three/textures';
import { starSprite } from '../../../../plating';
import { ds2Field, starPoints } from '../../nodes/rooms';

// ripples climbing the sheet, added over what lies beyond it so the stars
// still show through; strongest where the emitters at its rim hold it
// (../../nodes/rooms.js’s ds2Field)
export function fieldOver(mouth) {
  const material = ds2Field();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mouth.w, mouth.h), material);
  mesh.position.set(mouth.x, mouth.y + mouth.h / 2, mouth.z);
  mesh.rotation.y = mouth.axis === 'x' ? 0 : Math.PI / 2;
  mesh.renderOrder = 2;
  mesh.name = 'magnetic-field';
  return {
    mesh,
    update(t) {
      material.uniforms.uTime.value = t;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

// The lip in the mouth’s own frame (x along it, +z out to space): a deep
// edge beam with lights let into its top, emitter housings at both ends,
// and the station’s face falling away under it in plated steps.
export function lipOf(kit, mouth, room) {
  const out = mouth.axis === 'x' ? Math.sign(mouth.z - room.z) || 1 : Math.sign(mouth.x - room.x) || 1;
  const turn = mouth.axis === 'x' ? (out > 0 ? 0 : Math.PI) : out > 0 ? Math.PI / 2 : -Math.PI / 2;
  const w = mouth.w;
  const local = [kit.box(w + 3, 1.8, 0.5, 0, -0.9, 0.25, 'trim'), kit.box(w + 3, 0.06, 0.5, 0, 0.03, 0.25, 'black')];
  for (let x = -w / 2 + 1; x < w / 2; x += 2) local.push(kit.box(1.1, 0.03, 0.14, x, 0.05, 0.22, 'strip'));
  // the face below, stepping out as it falls, and a band of lights a few metres down
  for (const [y, d, h] of [[-8, 0.5, 12.4], [-30, 3, 32], [-80, 9, 70]]) local.push(kit.box(w + 40, h, 0.4, 0, y, 0.5 + d, 'wall'));
  for (let x = -w / 2 - 16; x < w / 2 + 18; x += 4) local.push(kit.box(1.6, 0.25, 0.1, x, -13, 3.55, 'strip'));
  // the emitters at each end of the mouth, up its sides, that hold the field
  for (const s of [-1, 1]) {
    local.push(kit.box(0.7, mouth.h, 0.6, s * (w / 2 + 0.75), mouth.h / 2, 0.3, 'trim'));
    for (let y = 1; y < mouth.h; y += 1.5) local.push(kit.box(0.08, 0.9, 0.04, s * (w / 2 + 0.4), y, 0.62, 'strip'));
  }
  return kit.place(local, kit.at(mouth.x, mouth.y, mouth.z, turn));
}

export function starsRound(renderer, at, { small = false, seed = 1983, radius = 420 } = {}) {
  const rand = seeded(seed);
  const n = small ? 1400 : 3200;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u) * radius;
    pos.set([at.x + Math.cos(a) * r, at.y + u * radius, at.z + Math.sin(a) * r], i * 3);
    const k = 0.22 + rand() ** 3 * 0.95;
    const tint = rand();
    col.set(tint < 0.1 ? [k, k * 0.85, k * 0.68] : tint < 0.25 ? [k * 0.78, k * 0.87, k] : [k, k, k], i * 3);
  }
  const sprite = sharpen(new THREE.CanvasTexture(starSprite(32)), { renderer, color: true });
  // (each a quad the size a point was: ../../nodes/rooms.js’s starPoints)
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
