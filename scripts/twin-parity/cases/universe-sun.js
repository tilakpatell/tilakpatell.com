// universe/sun.js against its twin, universe/sunNodes.js: the sun in the
// middle of the map, its surface boiling and its corona round it, drawn
// small enough to see whole; once with no map (its own orange) and once
// over a made map. A fixed time, no clock, so each side draws the same.
import * as SO from '../../../src/components/universe/sun.js';
import * as SN from '../../../src/components/universe/sunNodes.js';

// a map to boil: bands and blotches, the same texels on both sides
const map = (THREE) => {
  const W = 64;
  const H = 32;
  const d = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = 0.5 + 0.25 * Math.sin(x * 0.7) * Math.cos(y * 0.9) + 0.25 * Math.sin((x + y) * 0.31);
      d.set([255, Math.round(90 + 120 * k), Math.round(20 + 60 * k), 255], (y * W + x) * 4);
    }
  }
  const t = new THREE.DataTexture(d, W, H);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};

const sun = (S, { mapped }) => ({ THREE, scene, camera }) => {
  const s = S.buildSun(mapped ? { sun: map(THREE) } : {});
  s.group.scale.setScalar(1 / 45);
  scene.add(s.group);
  s.update(12.3, camera);
};

export default {
  'universe:sun:plain': { node: sun(SN, { mapped: false }), classic: sun(SO, { mapped: false }) },
  'universe:sun:mapped': { node: sun(SN, { mapped: true }), classic: sun(SO, { mapped: true }) },
};
