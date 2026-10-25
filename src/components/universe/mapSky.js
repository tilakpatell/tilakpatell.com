// The map's sky: the Star Wars galaxy's (galaxy/sky.js), its disc and dust
// and its core, as Kashyyyk sees it (the core a third of the way in:
// bright, not blinding), without its suns (the map has its own) or the
// other systems' stars to jump to; turning with the map and riding with the
// camera, baked once into a cube. Its clouds are left out: only what is
// truly at infinity rides the camera, and every nebula is a place in the
// map now (nebula/).
//
// createMapSky(parent, { renderer, small, level, post }) → { sky, followDrawn }
//   sky          the galaxy's sky (createSky's), its group under `parent`
//   followDrawn() → post.ratio, told to the sky when it has moved

import { createSky } from '../galaxy/sky';
import { SYSTEMS } from '../galaxy/systems';
import { prepFrame } from './prepFrame';

export function createMapSky(parent, { renderer = null, small = false, level = null, post }) {
  const sky = createSky({ small, level, renderer, beacons: false, clouds: false });
  sky.setSystem({ ...SYSTEMS.find((s) => s.id === 'kashyyyk'), suns: [] });
  // (its stars sized in the pixels the post draws at, which the quality
  // softens over a canvas that keeps its size; told again when that moves:
  // the galaxy's drawnAt.js does the same, kept here rather than reached
  // into, a world's insides being its own)
  let drawnWas = null;
  const followDrawn = () => {
    const r = post.ratio;
    if (r !== drawnWas) {
      drawnWas = r;
      sky.setRatio(r);
    }
    return r;
  };
  followDrawn();
  parent.add(sky.group);
  // (the bake is the sky drawn six times over, one long job on the chip:
  // under the intro, in an idle moment and never in the cockpit's launch,
  // as the map's other making is; ./prepFrame.js)
  sky.prepare(renderer)
    .then(() => prepFrame())
    .then(() => sky.bake(renderer));
  return { sky, followDrawn };
}
