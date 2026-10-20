// The other pilots' ships (./online.js's peers()), drawn from one pool of
// the wedge, a slot a pilot: a peer who goes quiet, or flies out of the
// cells round you, is no longer listed, and their slot is let go of. Their
// hulls are the look's ice blue, so they read apart from yours, and an
// ally's (`ally(id)`, the roster's, asked each frame: an alliance made in
// flight shows at once) the site's ally green, as on the universe map: a
// colour a slot (the pool's tint), still the one draw. What a pilot's just
// said (`quip(id)`: the site's quick chat, a set line, or null once it's
// old) is a bubble over their wedge (lib/three/quipSprite.js), the same size
// on the screen however far off they are; it's made the first time they say
// something, hidden between lines and let go of with their slot, so a sky of
// quiet pilots is still the one draw.
//
//   createPeers(parent, palette) → { draw(list, at, ally?, quip?), count(), mesh, slot(id), dispose() }

import * as THREE from 'three';
import { createQuipSprite } from '../../../lib/three/quipSprite';
import { createPool } from './pools';
import { wedgeGeometry } from './models';
import { MAX_PEERS } from './online';

export const ALLY = 0x8dffad; // the site's ally green (online.css's, the towns' ghosts' ring)
const QUIP_H = 0.034; // a bubble's card, a share of the view (about a thirty-fifth of its height at the flight's 62°)
const QUIP_UP = 3; // m over the wedge's middle, its tail's tip (the hull's back is under a metre up)

export function createPeers(parent, palette) {
  // (white, so each slot's tint is its colour)
  const pool = createPool(parent, wedgeGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.2, flatShading: true, side: THREE.DoubleSide }), MAX_PEERS);
  const stranger = new THREE.Color(palette[3]);
  const friend = new THREE.Color(ALLY);
  const tinted = new Map(); // id → whether its slot wears the ally green
  const bubbles = new Map(); // id → its quick-chat bubble, once they've said something
  const seen = new Set();
  return {
    draw(list, at, ally = () => false, quip = () => null) {
      seen.clear();
      for (const { id, pose } of list) {
        if (pool.add(id) < 0) continue;
        seen.add(id);
        const mate = Boolean(ally(id));
        if (tinted.get(id) !== mate) {
          tinted.set(id, mate);
          pool.tint(id, mate ? friend : stranger);
        }
        // (scene.js's own ship: pitch, yaw, then the roll the other way)
        pool.place(id, pose.x, pose.y, pose.z, pose.yaw, pose.pitch, -pose.roll);
        const line = quip(id);
        let b = bubbles.get(id);
        if (line && !b) {
          b = createQuipSprite({ height: QUIP_H, sizeAttenuation: false });
          parent.add(b.sprite);
          bubbles.set(id, b);
        }
        if (!b) continue;
        b.set(line);
        // (from the floating origin, as the pool draws the wedge)
        b.sprite.position.set(pose.x - at[0], pose.y - at[1] + QUIP_UP, pose.z - at[2]);
      }
      for (const id of [...pool.ids()]) {
        if (seen.has(id)) continue;
        pool.free(id);
        tinted.delete(id);
        bubbles.get(id)?.dispose();
        bubbles.delete(id);
      }
      pool.draw(at);
    },
    count: () => pool.size,
    // (for the checks: the pool's mesh, and a pilot's slot in it)
    mesh: pool.mesh,
    slot: (id) => (pool.has(id) ? pool.add(id) : -1),
    dispose() {
      for (const b of bubbles.values()) b.dispose();
      bubbles.clear();
      pool.dispose();
    },
  };
}
