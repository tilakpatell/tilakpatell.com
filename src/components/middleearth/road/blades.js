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
import { dot, mix, vec3 } from 'three/tsl';
import { onColor } from '../../../lib/three/hookNodes';

// (fewer and broader than the galaxy’s: thin blades at this density shimmered, a grain over the fields)
export const BLADES = { ultra: { side: 240, size: 46 }, high: { side: 220, size: 44 }, mid: { side: 160, size: 38 }, low: null };
export const NEAR = 4.5; // m: no blades standing closer to the camera than about this
const LUMA = vec3(0.2126, 0.7152, 0.0722);

export function createBlades({ groundMap, wind, soil, tier = 'high' }) {
  const patch = BLADES[tier] ?? null;
  if (!patch || !wind || !(soil?.blades > 0)) return null;
  // (thinner grass: fewer blades over the same patch)
  const side = Math.round(patch.side * Math.sqrt(soil.blades));
  // (laid down within NEAR of the camera: a few blades right under a low camera stood as spikes across the picture)
  const grass = createGrass({ ground: groundMap, wind, side, size: patch.size, height: soil.blade ?? 0.45, width: 0.09, root: 0.6, near: NEAR });
  grass.mesh.name = 'road:blades';
  // (the map’s colour a little greyed: lit straight from above, the blades
  // stood brighter and greener than the photo-scanned ground between them)
  onColor(grass.material, (d) => mix(vec3(dot(d.rgb, LUMA)), d.rgb, 0.82), 'blades:tone');
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
