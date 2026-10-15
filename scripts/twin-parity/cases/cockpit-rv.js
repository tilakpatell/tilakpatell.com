// cockpit/vehicles/rv.js against its twin, rvNodes.js: Walt and Jesse’s RV
// built whole on each side, the same files loaded, and seen from the
// driver’s eye. The cab alone, at rest, as the galaxy shows it (scene.js’s
// buildCab draws `inside` only), and turned to Jesse and Walt in their
// looks; the cab with the high desert outside, at rest (the evening sky,
// the land and its haze), and again with the shadows a high tier casts;
// the same at dusk on the drive, wings out, the road rushing by; at night
// as it lifts off, the town’s lights and the stars out; and from outside,
// climbing, Hank after it and the crystals spilling. A fixed moment and no
// clock (dt 0: nothing random moves), so each side draws the same.
import * as THREE from 'three';
import { PMREMGenerator } from 'three/webgpu';
import * as RO from '../../../src/components/cockpit/vehicles/rv.js';
import * as RN from '../../../src/components/cockpit/vehicles/rvNodes.js';
import { plan } from '../../../src/components/cockpit/timeline.js';

const rv = (R, { outside = false, at = null, rich = false, look = [0, 0], Pm = THREE.PMREMGenerator } = {}) => async ({ scene, camera, renderer }) => {
  // (the cab’s own light only, as the cockpit draws it)
  for (const o of [...scene.children]) if (o.isLight) scene.remove(o);
  const pmrem = new Pm(renderer);
  const built = await R.build({ rich, coarse: false, renderer, pmrem, say: () => {}, added: () => {} });
  pmrem.dispose();
  // (the winged RV and Hank's SUV come when they come, LATE or after: from
  // outside, wait for both, so neither side draws the cab in their place)
  for (let waited = 0; outside && at !== null && built.outside.children.length < 6 && waited < 30000; waited += 100) await new Promise((r) => setTimeout(r, 100));
  scene.add(built.inside);
  if (outside) scene.add(built.outside);
  scene.environment = built.environment ?? null;
  scene.environmentIntensity = built.envIntensity ?? 0.35;
  camera.fov = 70;
  camera.near = 0.02;
  camera.far = outside ? 12000 : 60;
  camera.position.set(...built.eye);
  const p = plan('rv');
  // (where the cockpit turns your head at that moment: out at the wings, after the RV once outside)
  const aim = at === null ? look : built.aim(at, p);
  camera.rotation.set(built.rest[1] + aim[1], built.rest[0] + aim[0], 0, 'YXZ');
  camera.updateProjectionMatrix();
  built.update(0, 4.2, at === null ? { launching: false, t: 0, plan: p } : { launching: true, t: at, plan: p });
};

const pair = (o) => ({ node: rv(RN, { ...o, Pm: PMREMGenerator }), classic: rv(RO, o) });

export default {
  'cockpit-rv:cab': pair({}),
  'cockpit-rv:outside': pair({ outside: true }),
  'cockpit-rv:shadows': pair({ outside: true, rich: true }),
  'cockpit-rv:crew': pair({ look: [-0.85, 0.05] }),
  'cockpit-rv:dusk': pair({ outside: true, at: 6300 }),
  'cockpit-rv:night': pair({ outside: true, at: 8800 }),
  'cockpit-rv:climb': pair({ outside: true, at: 11200 }),
};
