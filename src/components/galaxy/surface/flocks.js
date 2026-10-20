// A world's flocks (site.air.flocks, flora.js's airOf): each a ring of
// birds (lib/three/birds, two draws a flock) circling over a place or off
// the landing, its height over the ground there.
//
//   createFlocks(flocks, { heightAt, reduced }) → { group, update(dt), dispose() } | null
//     (null for none; held still, where they are, under reduced motion)

import * as THREE from 'three';
import { createBirds } from '../../../lib/three/birds';

export function createFlocks(flocks = [], { heightAt, reduced = false } = {}) {
  if (!flocks.length) return null;
  const group = new THREE.Group();
  group.name = 'galaxy:flocks';
  const birds = flocks.map((f) => createBirds({ at: [f.at[0], heightAt(f.at[0], f.at[1]) + f.height, f.at[1]], count: f.count, radius: f.radius, size: f.size, colour: f.colour, speed: f.speed, seed: f.seed, name: 'galaxy:birds' }));
  for (const b of birds) group.add(b.mesh);
  return {
    group,
    update(dt) {
      if (reduced) return;
      for (const b of birds) b.update(dt);
    },
    dispose() {
      for (const b of birds) b.dispose();
    },
  };
}
