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
import { dot, mix, positionWorld, smoothstep, vec3 } from 'three/tsl';
import { onColor } from '../../../lib/three/hookNodes';

// (fewer and broader than the galaxy’s: thin blades at this density shimmered, a grain over the fields)
export const BLADES = { ultra: { side: 270, size: 46 }, high: { side: 250, size: 44 }, mid: { side: 170, size: 38 }, low: null };
export const NEAR = 4.5; // m: no blades standing closer to the camera than about this
const LUMA = vec3(0.2126, 0.7152, 0.0722);

export function createBlades({ groundMap, wind, soil, tier = 'high' }) {
  const patch = BLADES[tier] ?? null;
  if (!patch || !wind || !(soil?.blades > 0)) return null;
  // (thinner grass: fewer blades over the same patch)
  const side = Math.round(patch.side * Math.sqrt(soil.blades));
  // (laid down within NEAR of the camera: a few blades right under a low camera stood as spikes across the picture;
  // their roots a little dark, not much: a strong one speckled the field, light tip by dark root (0.72 did, tufted,
  // on Lothlórien's gold floor);
  // each turned to face the camera, so it's lit from above, by the sun: its back seen, it was lit from below)
  // (each a curved blade tapering to its tip, grown four to a tuft: one broad triangle
  // apiece, evenly spread, the verges were a carpet of green cones)
  const grass = createGrass({ ground: groundMap, wind, side, size: patch.size, height: soil.blade ?? 0.45, width: 0.048, root: 0.84, near: NEAR, faceCamera: true, shape: 'blade', tufts: true });
  grass.mesh.name = 'road:blades';
  // the map’s colour a little greyed (at full colour, lit from below by the
  // sky light’s green ground half, they stood lime over the photo-scanned
  // ground), in slow patches lighter and darker, here and there gone dry,
  // as a field is (the wind’s noise, read still, metres across)
  const noise = wind.uniforms.uWindNoise;
  onColor(
    grass.material,
    (d) => {
      const grey = mix(vec3(dot(d.rgb, LUMA)), d.rgb, 0.85);
      const lit = noise.sample(positionWorld.xz.mul(0.021)).r;
      const dry = smoothstep(0.58, 0.82, noise.sample(positionWorld.xz.mul(0.0083).add(0.37)).r);
      return mix(grey, grey.mul(vec3(1.18, 1.06, 0.62)), dry.mul(0.7)).mul(lit.mul(0.36).add(0.82));
    },
    'blades:tone',
    { ...wind.uniforms },
  );
  // (in the sun’s shadow on high and up: the trees’ shade lies over the grass, not under it)
  grass.mesh.receiveShadow = tier === 'high' || tier === 'ultra';
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
