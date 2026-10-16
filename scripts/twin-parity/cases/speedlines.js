// speedLines.js against speedLinesNodes.js: the field of stars drawn out
// into lines, on the camera, at a stretch and a little way into its run.
// The original lays its stars out with Math.random, so both builds run
// under the same seeded one and lay out the same field.
import * as SO from '../../../src/lib/three/speedLines.js';
import * as SN from '../../../src/lib/three/speedLinesNodes.js';

const seeded = (seed = 7) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

const lines = (S) => ({ scene, camera }) => {
  const random = Math.random;
  Math.random = seeded();
  let s;
  try {
    s = S.createSpeedLines();
  } finally {
    Math.random = random;
  }
  scene.background.set(0x02040a);
  camera.add(s.group);
  scene.add(camera);
  s.set({ stretch: 0.45, speed: 200 });
  s.update(0.6);
};

export default { 'speedlines:stretched': { node: lines(SN), classic: lines(SO) } };
