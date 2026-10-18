// Space drawn round the city (split out of ./scene.js as a repair): the
// Earth, the Moon, Mars and the stars (./space.js), Allen between the Moon
// and home, Thragg over Mars, who can be talked to out there, and the light
// when the sun is the only one.

import * as THREE from 'three';
import { LINES } from './lines';
import { BODIES } from './orbit';
import { personFor } from './people';
import { buildSpace } from './space';

// `thragg`: his figure (./scene.js poses him); `people`: the cast's HD figures (Allen's)
export async function createSpaceScene(engine, scene, { small, people, thragg }) {
  // ── space: the Earth under him, the Moon, Mars, and who's waiting out there ──
  const space = await buildSpace(engine.renderer, { small });
  scene.add(space.group, space.stars);
  space.stars.visible = false;
  const toEarth = (c) => {
    const l = Math.hypot(...c);
    return c.map((v) => -v / l);
  };
  // Allen, between the Moon and home; Thragg, over Mars, facing Earth
  const moon = BODIES.find((b) => b.id === 'moon');
  const mars = BODIES.find((b) => b.id === 'mars');
  const ALLEN = moon.c.map((v, i) => v + toEarth(moon.c)[i] * (moon.r + 30));
  const THRAGG = mars.c.map((v, i) => v + toEarth(mars.c)[i] * (mars.r + 45));
  const allen = personFor('allen', 9, people.allen);
  const allenHolder = new THREE.Group();
  allenHolder.add(allen.root);
  allenHolder.position.set(...ALLEN);
  allenHolder.rotation.y = Math.atan2(-ALLEN[0], -ALLEN[2]);
  space.group.add(allenHolder);
  thragg.holder.removeFromParent();
  space.group.add(thragg.holder);
  const spaceTalk = [
    { id: 'allen', name: 'Allen', p: ALLEN, r: 70, lines: LINES.allen },
    { id: 'thragg', name: 'Thragg', p: THRAGG, r: 90, lines: LINES.thragg },
  ];

  function look(spot) {
    scene.background = new THREE.Color(0, 0, 0.004);
    scene.fog = null;
    scene.environmentIntensity = 0.08;
    engine.sun.color.setRGB(1, 0.97, 0.92);
    engine.sun.intensity = 3.4;
    engine.hemi.intensity = 0.04;
    spot.intensity = 0; // (out there the sun's the only light on him)
    engine.sun.userData.dir = space.sun.clone();
    space.stars.visible = true;
    space.stars.material.color.setScalar(1);
  }
  return { space, allen, ALLEN, THRAGG, spaceTalk, look };
}
