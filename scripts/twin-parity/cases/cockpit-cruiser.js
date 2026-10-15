// Rick's cruiser's twin (src/components/cockpit/vehicles/cruiserNodes.js)
// against cruiser.js: the cab from the pilot's eye at rest, Morty beside you,
// the dash, the wheel, your arms and the hood under the dome, the street
// at dusk beyond, its houses inked; and the same at the moment the portal
// opens ahead; and a glance over at Morty (his texture snapped to the
// show's colours for him). The cab and the street in one scene here (the cockpit draws
// them in two passes), at a fixed time, so both sides are the same moment.
import * as CO from '../../../src/components/cockpit/vehicles/cruiser.js';
import * as CN from '../../../src/components/cockpit/vehicles/cruiserNodes.js';

const cab = (C, { launching = false, lt = 0, glance = false } = {}) => async ({ scene, camera }) => {
  const b = await C.build({ rich: true, coarse: false });
  scene.background = null;
  // (the pilot's eye at rest: its yaw and pitch, a 90° view)
  camera.fov = b.hfov;
  camera.near = 0.02;
  camera.far = 2000;
  camera.position.set(...b.eye);
  camera.rotation.set(b.rest[1], glance ? b.glance : b.rest[0], 0, 'YXZ');
  camera.updateProjectionMatrix();
  scene.add(b.inside, b.outside);
  b.update(0.016, 2.4, { launching, t: lt, plan: { spool: 900, peak: 2400 }, throttle: launching ? 0.2 : 0 });
};

export default {
  'cockpit-cruiser:cab': { node: cab(CN), classic: cab(CO) },
  'cockpit-cruiser:morty': { node: cab(CN, { glance: true }), classic: cab(CO, { glance: true }) },
  'cockpit-cruiser:portal': { node: cab(CN, { launching: true, lt: 1100 }), classic: cab(CO, { launching: true, lt: 1100 }) },
};
