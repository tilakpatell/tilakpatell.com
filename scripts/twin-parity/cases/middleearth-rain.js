// A town’s rain: ../../../src/components/middleearth/towns/rain.js against
// its twin, nodes/towns/rain.js. The streaks round the camera, slanting in
// the wind and thinning off toward the box’s edge, brightened to be seen;
// and the splashes ringing out on the ground about you, seen from above,
// some just born and some fading. Math.random seeded for each side (the
// streaks’ seeds and the splashes’ places both draw from it).
import * as RO from '../../../src/components/middleearth/towns/rain.js';
import * as RN from '../../../src/components/middleearth/nodes/towns/rain.js';

const seeded = (fn) => {
  const real = Math.random;
  let s = 0x3c91;
  Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
};

const streaks =
  (R, amount) =>
  ({ scene, camera }) => {
    scene.background.set(0x0c1016);
    camera.position.set(0, 1.6, 0);
    camera.lookAt(6, 1, -4);
    seeded(() => {
      const rain = R.makeRain({ count: 3000, size: [16, 10, 16], splashes: 0 });
      rain.tint(0.9, 0.95, 1, 0.9);
      rain.update(camera, 7.3, amount);
      scene.add(rain.group);
    });
  };
const splashes =
  (R) =>
  ({ scene, camera }) => {
    scene.background.set(0x0c1016);
    camera.position.set(0, 3, 3);
    camera.lookAt(0, 0, 0);
    seeded(() => {
      const rain = R.makeRain({ count: 1, splashes: 160, height: () => 0 });
      rain.tint(0.9, 0.95, 1, 0);
      rain.group.children[1].material.uniforms.uScale.value = 900;
      rain.update(camera, 1, 1, { x: 0, z: 0 });
      rain.update(camera, 1.25, 1, { x: 0, z: 0 });
      scene.add(rain.group);
    });
  };

export default {
  'middleearth:rain:streaks': {
    node: streaks(RN, 1),
    classic: streaks(RO, 1),
  },
  'middleearth:rain:light': {
    node: streaks(RN, 0.4),
    classic: streaks(RO, 0.4),
  },
  'middleearth:rain:splashes': { node: splashes(RN), classic: splashes(RO) },
};
