// cruiser3d.js on the node renderer: the same cruiser and crew
// (./cruiser3dCore.js), built with node looks: the cast painted by
// ./portal/meshyCastNodes.js, the ink from lib/three/inkNodes.js, the
// wardrobe's colours from ./wardrobe/wearNodes.js, and the glass dome as
// hooks on a copy of each mesh's material, line for line. No canvas of its
// own (createCruiser3D's WebGLRenderer): a node world draws it in its scene.
//
//   buildCruiser({ ink, crewInk, looks }) → the cruiser, as cruiser3d.js's
//   glassDome(body) → the rim's height in the meshes' units
//   TALL, GLASS, CREW, CANS, crewLife   cruiser3d.js's

import { abs, mix, normalView, positionGeometry, smoothstep, vec3, vec4 } from 'three/tsl';
import { createMeshyCast } from './portal/meshyCastNodes';
import { inkHull } from '../../lib/three/inkNodes';
import { asNode, onColor } from '../../lib/three/hookNodes';
import { cloneShaded } from './wardrobe/dressNodes';
import { dress } from './wardrobe/wearNodes';
import { GLASS, buildCruiserWith } from './cruiser3dCore';

export { CANS, CREW, GLASS, TALL, crewLife } from './cruiser3dCore';

// The saucer's dome as glass: everything above the rim (GLASS of the way up
// each mesh, in its own units) see-through face-on and thicker towards its
// edges, so it reads as a bubble with the crew in it. Each mesh gets its own
// copy of its material, its hooks kept (in userData.glass, to dispose);
// returns the rim's height in the meshes' units.
export function glassDome(body) {
  let glassY = null;
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const { min, max } = o.geometry.boundingBox;
    glassY = min.y + (max.y - min.y) * GLASS;
    const y = glassY;
    const m = cloneShaded(asNode(o.material));
    m.transparent = true;
    onColor(
      m,
      (diffuse) => {
        const glass = smoothstep(y - 0.004, y + 0.004, positionGeometry.y.toVarying('vGlassY'));
        // see-through face on, thicker towards its edges, so it reads as a bubble
        const rim = abs(normalView.z).oneMinus();
        diffuse.assign(vec4(mix(diffuse.rgb, vec3(0.74, 0.95, 0.96), glass.mul(0.6)), diffuse.a.mul(mix(1, rim.mul(rim).mul(0.6).add(0.16), glass))));
        return null;
      },
      `glass-${glassY}`,
    );
    o.material = m;
    o.userData.glass = m;
  });
  return glassY;
}

export const buildCruiser = buildCruiserWith({ createMeshyCast, inkHull, glassDome, dress });
