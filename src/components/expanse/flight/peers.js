// The other pilots' ships (./online.js's peers()), drawn from one pool of
// the wedge, a slot a pilot: a peer who goes quiet, or flies out of the
// cells round you, is no longer listed, and their slot is let go of. Their
// hulls are the look's ice blue, so they read apart from yours, and an
// ally's (`ally(id)`, the roster's, asked each frame: an alliance made in
// flight shows at once) the site's ally green, as on the universe map: a
// colour a slot (the pool's tint), still the one draw.
//
//   createPeers(parent, palette) → { draw(list, at, ally?), count(), mesh, slot(id), dispose() }

import * as THREE from 'three';
import { createPool } from './pools';
import { wedgeGeometry } from './models';
import { MAX_PEERS } from './online';

export const ALLY = 0x8dffad; // the site's ally green (online.css's, the towns' ghosts' ring)

export function createPeers(parent, palette) {
  // (white, so each slot's tint is its colour)
  const pool = createPool(parent, wedgeGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.2, flatShading: true, side: THREE.DoubleSide }), MAX_PEERS);
  const stranger = new THREE.Color(palette[3]);
  const friend = new THREE.Color(ALLY);
  const tinted = new Map(); // id → whether its slot wears the ally green
  const seen = new Set();
  return {
    draw(list, at, ally = () => false) {
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
      }
      for (const id of [...pool.ids()]) {
        if (seen.has(id)) continue;
        pool.free(id);
        tinted.delete(id);
      }
      pool.draw(at);
    },
    count: () => pool.size,
    // (for the checks: the pool's mesh, and a pilot's slot in it)
    mesh: pool.mesh,
    slot: (id) => (pool.has(id) ? pool.add(id) : -1),
    dispose: () => pool.dispose(),
  };
}
