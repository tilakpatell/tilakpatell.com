// The grass close round you: grassNodes’ blades (Bruno Simon’s one-mesh
// grass, lib/three/grassNodes) on a stage’s ground map, standing where its
// paint grows grass and gone on the road, coloured by it, bent by the wind;
// the patch follows the camera in its stage’s frame. As thick and tall as
// the stage’s soil says (stages/soils.js), none on low or where nothing grows.
//
//   createBlades({ groundMap, wind, soil, tier }) → { mesh, update(x, z), dispose() } | null
//   BLADES: each tier’s patch: blades a side, metres across

import * as THREE from 'three';
import { createGrass } from '../../../lib/three/grassNodes';
import { onColor } from '../../../lib/three/hookNodes';

// (fewer and broader than the galaxy’s: thin blades at this density shimmered, a grain over the fields)
export const BLADES = { ultra: { side: 240, size: 46 }, high: { side: 220, size: 44 }, mid: { side: 160, size: 38 }, low: null };

export function createBlades({ groundMap, wind, soil, tier = 'high' }) {
  const patch = BLADES[tier] ?? null;
  if (!patch || !wind || !(soil?.blades > 0)) return null;
  // (thinner grass: fewer blades over the same patch)
  const side = Math.round(patch.side * Math.sqrt(soil.blades));
  const grass = createGrass({ ground: groundMap, wind, side, size: patch.size, height: soil.blade ?? 0.45, width: 0.09, root: 0.6 });
  grass.mesh.name = 'road:blades';
  // (a little lighter than the map they’re coloured by: a field of blades reads darker than its ground, the light caught between them)
  onColor(grass.material, (d) => d.rgb.mul(1.3), 'blades:light');
  const centre = new THREE.Vector3();
  return {
    mesh: grass.mesh,
    update(x, z) {
      grass.update(centre.set(x, 0, z));
    },
    dispose() {
      grass.mesh.removeFromParent();
      grass.dispose();
    },
  };
}
