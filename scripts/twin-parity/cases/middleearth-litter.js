// The Shire’s fallen leaves: ../../../src/lib/three/flatLitter.js against
// its twin, flatLitterNodes.js. A thick litter on a rolling floor seen from
// a stride up, lying still (each leaf cut to its shape, tilted in the light,
// its own colour); and the same thrown up by a blast a moment before, the
// leaves off the ground swinging as they fall and those near the box’s edge
// shrunk away. The sim is seeded and stepped the same on either side.
import * as LO from '../../../src/lib/three/flatLitter.js';
import * as LN from '../../../src/lib/three/flatLitterNodes.js';

const SPEC = {
  colours: ['#a39c34', '#d8a83c', '#b4622c'],
  density: 6,
  size: 0.45,
  shed: 0,
};
const floorAt = (x, z) => 0.15 * Math.sin(x * 0.9) + 0.1 * Math.cos(z * 0.7);

const leaves =
  (L, { blast = false, look = [0, 2.2, 3.2] } = {}) =>
  ({ scene, camera }) => {
    const l = L.createFlatLitter({
      max: 512,
      half: 4,
      spec: SPEC,
      floorAt,
      seed: 22,
    });
    scene.add(l.mesh);
    if (blast) {
      l.blast(0.5, 0.2, 2.5, 4);
      for (let k = 0; k < 12; k++) l.update(1 / 30, { focus: { x: 0, z: 0 } });
    } else l.update(1 / 60, { focus: { x: 0.3, z: 0.2 } });
    camera.position.set(...look);
    camera.lookAt(0, 0, 0);
  };

export default {
  'middleearth:litter:lying': {
    node: leaves(LN),
    classic: leaves(LO),
  },
  'middleearth:litter:close': {
    node: leaves(LN, { look: [0.4, 0.9, 1.1] }),
    classic: leaves(LO, { look: [0.4, 0.9, 1.1] }),
  },
  'middleearth:litter:blast': {
    node: leaves(LN, { blast: true, look: [0, 1.6, 4.5] }),
    classic: leaves(LO, { blast: true, look: [0, 1.6, 4.5] }),
  },
};
