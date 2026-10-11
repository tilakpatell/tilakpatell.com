// meshyCast.js on the node renderer: the same cast (./meshyCastCore.js),
// painted in nodes: ./toonNodes.js's toon on the same light steps, the
// rim of light from lib/three/inkNodes.js, and a Morty clone's shirt as a
// hook on his diffuse colour, with the same uniform (userData.shirt). The
// same exports as meshyCast.js.

import * as THREE from 'three';
import { dot, min, mix, smoothstep, step, vec3 } from 'three/tsl';
import { toon } from './toonNodes';
import { rimToon } from '../../../lib/three/inkNodes';
import { follow, onColor } from '../../../lib/three/hookNodes';
import { sharpenMaterial } from '../../../lib/three/textures';
import { RIM, lightRamp, meshyCastWith } from './meshyCastCore';

export { BASE, FOLDERS, FOUND, MESHY, MESHY_ASSETS, RIGGED, SHARED_CLIPS, assetUrl, cullWithin, faceForward, heading } from './meshyCastCore';
export { NO_CALLS, SEAT, animatorCalls, seedOf } from '../../../lib/three/figureCalls';

const lit = (m) => {
  sharpenMaterial(m);
  return rimToon(m, RIM);
};
const flat = (map, extra = {}) => toon(0xffffff, { map, gradientMap: lightRamp(), ...extra });
const paint = (map, extra = {}) => lit(flat(map, extra));

// a Morty clone's shirt: the yellow of Morty's texture swapped for another
// colour, once the map's in the diffuse colour (map_fragment's place)
export function shirted(map, shirt) {
  const m = flat(map);
  m.userData.shirt = { value: new THREE.Color(shirt) };
  const u = { shirt: follow(m.userData.shirt, 'color') };
  onColor(
    m,
    (diffuse) => {
      const c = diffuse.rgb;
      const yellow = smoothstep(0.12, 0.3, min(c.r, c.g).sub(c.b)).mul(step(0.25, c.g));
      const lum = dot(c, vec3(0.299, 0.587, 0.114));
      return mix(c, u.shirt.mul(lum.div(0.62)), yellow);
    },
    'shirted',
    u,
  );
  return lit(m);
}

export const createMeshyCast = meshyCastWith({ paint, shirted });
