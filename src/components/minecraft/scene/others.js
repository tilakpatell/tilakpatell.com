// The others online in your world (the module hands them in: ../rules/online.js),
// each a Steve: the player's own shape, eight pixels of head on twelve of
// body and twelve of legs, built of six boxes (the game draws no figure of
// yours, first person; a ghost downloads nothing). middleearth/towns/
// ghostsOf.js shimmers and fades him, with his name over him, in the towns'
// pale and rim of light made of nodes (ghostNodes.js: the tribute is drawn
// by the node renderer, which runs no GLSL), the same ghost as everywhere.
//
//   makeSteve() → { group, top, face, arms, legs, dispose() }
//   stride(steve, t, p, dt): the walk's swing, arms against legs, as the game's
//   ghostLight(), lightGhosts(light, sun): the sky's light on them alone

import * as THREE from 'three';

const PX = 1.8 / 32; // (the player is 1.8 m tall; Steve's skin is 32 pixels head to foot)

export function makeSteve() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial(); // (ghosts.js puts its own on every box)
  const geos = [];
  // a box w × h × d pixels hung from (x, y) pixels, its top at the pivot
  const limb = (w, h, d, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x * PX, y * PX, 0);
    const g = new THREE.BoxGeometry(w * PX, h * PX, d * PX).translate(0, (-h * PX) / 2, 0);
    geos.push(g);
    pivot.add(new THREE.Mesh(g, mat));
    group.add(pivot);
    return pivot;
  };
  const legs = [limb(4, 12, 4, -2, 12), limb(4, 12, 4, 2, 12)];
  const body = limb(8, 12, 4, 0, 24);
  const arms = [limb(4, 12, 4, -6, 24), limb(4, 12, 4, 6, 24)];
  const head = limb(8, 8, 8, 0, 32);
  // (his face: where the head looks, for the checks)
  const face = new THREE.Object3D();
  face.position.set(0, -4 * PX, 4 * PX);
  head.add(face);
  return {
    group,
    top: 32 * PX,
    face,
    arms,
    legs,
    body,
    swing: 0,
    dispose() {
      for (const g of geos) g.dispose();
      mat.dispose();
    },
  };
}

// The ghosts' pale is a lit one (their tint under the world's light, as in
// every other world); the tribute's blocks are all their own light, so a
// hemisphere light here lights the ghosts and nothing else, the day's sun
// (rules/time.js's sunBrightness, 0 to 1) setting how much.
export const ghostLight = () => new THREE.HemisphereLight(0xffffff, 0x4a5a6a, 1.6);
export function lightGhosts(light, sun) {
  light.intensity = 0.45 + 1.15 * Math.max(0, Math.min(1, sun));
}

// arms and legs swung opposite, the swing as wide as he's fast (a walk's
// 4.3 m/s the game's full stride), eased out to standing when he stops
export function stride(f, t, p, dt = 1 / 60) {
  const fast = p.moving ? Math.min(1, (p.motion?.speed ?? p.speed ?? 4.3) / 4.3) : 0;
  f.swing += (fast - f.swing) * Math.min(1, dt * 10);
  const a = Math.sin(t * 10) * 0.9 * f.swing;
  f.legs[0].rotation.x = a;
  f.legs[1].rotation.x = -a;
  f.arms[0].rotation.x = -a;
  f.arms[1].rotation.x = a;
}
