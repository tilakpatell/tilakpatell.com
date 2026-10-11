// Portal panic's cast as modelled for the site with Meshy (scripts/meshy.mjs):
// textured models toon-shaded like everything else, the two-legged ones
// skinned, each on an animator of its own (lib/three/animator.js: idle,
// walking and running weighed by how fast it goes, a base state such as
// sitting in their place, any clip of the library played over them on the
// whole body or the upper or lower half, the head turned to look). Anything
// that doesn't load falls back to the shapes in ./cast.js. A cast here has
// the same face as one from cast.js ({ group, body, … }) plus
// update(t, move, hit), which ./cast.js's animate() hands it to.
//
// A figure from make(kind, variant, { tall, seed }):
//   group, body, height, meshy, hand, hipsY, up, kind…   as they always were
//   anim     its animator, or null when it isn't rigged
//   mixer, act   the animator's mixer, and an action for every clip of its
//     own (idle, walk, run, sit…; sat at no weight until wanted) and every
//     whole-body one-shot it's played, for callers that weigh them by hand
//   update(t, move, hit, { dt, motion, frame, lodRate, after = true })
//     move 0…1 as ever; motion: locomotion.js's (speed, side, turn, air,
//     hurt, knock, down: speeds in the cast's units, which are metres
//     unless make was told `tall`), its feet then paced to the ground;
//     frame: { forward, up } in the world, once it's placed; after: false
//     leaves the bones laid over the clips for c.after, once it's placed
//   after(dt, motion, frame)   the bones over the clips (animator's after)
//   play(name, opts), stop(fade, layer), base(name, opts), look(target, opts),
//     react(event, ctx)   animatorCalls's (lib/three/figureCalls.js); on a figure that isn't
//     rigged they do nothing (play resolves false, react returns null)
//   tall: the metres it stands where it's put (footScene's crews), so its
//   motion's speeds are read in its own units; seed: its clocks (its idle's
//   start, its stride's, its fidgets'), else its kind and which it is
// A figure that isn't rigged sways in its step instead (gait.js: a hop, a
// lurch, by the ground it covers) and breathes while it stands.

// (The cast itself is ./meshyCastCore.js's; here it's painted in GLSL, as
// it always was, and ./meshyCastNodes.js paints the same cast in nodes.)

import * as THREE from 'three';
import { toon } from './toon';
import { rimToon } from '../../../lib/three/ink';
import { sharpenMaterial } from '../../../lib/three/textures';
import { RIM, lightRamp, meshyCastWith } from './meshyCastCore';

export { BASE, FOLDERS, FOUND, MESHY, MESHY_ASSETS, RIGGED, SHARED_CLIPS, assetUrl, cullWithin, faceForward, heading } from './meshyCastCore';

// The calls a figure on an animator answers (animatorCalls, NO_CALLS, seedOf,
// SEAT) are lib/three/figureCalls.js's now, where every world's figures get
// them; they're still to be had from here, as they always were.
export { NO_CALLS, SEAT, animatorCalls, seedOf } from '../../../lib/three/figureCalls';

// Meshy's paint: the light steps (lightRamp) and the rim (RIM) are the core's
const lit = (m) => {
  sharpenMaterial(m);
  return rimToon(m, RIM);
};
const flat = (map, extra = {}) => toon(0xffffff, { map, gradientMap: lightRamp(), ...extra });
const paint = (map, extra = {}) => lit(flat(map, extra));

// a Morty clone's shirt: the yellow of Morty's texture swapped for another colour
function shirted(map, shirt) {
  const m = flat(map);
  m.userData.shirt = { value: new THREE.Color(shirt) };
  m.onBeforeCompile = (s) => {
    s.uniforms.shirt = m.userData.shirt;
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float yellow = smoothstep(0.12, 0.3, min(c.r, c.g) - c.b) * step(0.25, c.g);
        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(c, shirt * (lum / 0.62), yellow);
      }`).replace('void main() {', 'uniform vec3 shirt;\nvoid main() {');
  };
  m.customProgramCacheKey = () => 'shirted';
  return lit(m);
}

export const createMeshyCast = meshyCastWith({ paint, shirted });
