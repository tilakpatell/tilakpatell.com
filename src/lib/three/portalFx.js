// What the portal gun does to someone it kills, as the show has it: a
// portal opens on the ground just behind them, tilted up at them; they're
// pulled off their feet toward its eye, tumbling (ragdoll.js over the pose
// they died in), sinking into the green as they cross its plane (the
// materials clip there, so nothing shows behind the disc); somewhere between
// the waist and the shoulders it snaps shut with a flash of the lip, and
// what was still on this side stays cut at that plane, drops to the ground
// and lies there. Nothing comes out the other side. World-agnostic: the
// universe map's foot combat and the galaxy's worlds both draw it.
//
// createPortalFx({ parent }) → { swallow(fig, opts), update(dt), dispose }
//   parent: the Object3D the portals go under; every figure swallowed must
//     be a child of it (positions are in its space, sizes in its units).
//   swallow({ root, tall, up, push, joints, ground, seed, on }) → handle
//     root: the figure's Object3D (its origin at the feet, +y its up);
//     tall: its height; up and push: unit vectors in `parent`'s space (the
//     ground's normal there, and the way the shot sent them); joints:
//     ragdoll.js's [{ obj, len }], as many as the figure has; ground(p):
//     the point on the ground under p (default: the plane through the
//     feet); on(event): 'open' as it opens, 'cut' as it shuts.
//     handle: { done (the fall's over), cut (it's shut), dispose() }.
//   update(dt): once a frame after the figures' clips have posed them (the
//     ragdoll and the swallow own the root and the joints from then on).
//
// (The swallow itself is portalFxCore.js's; this is its GLSL disc. The
// node renderer's is portalFxNodes.js.)

import * as THREE from 'three';
import { SWIRL_GLSL } from './swirl';
import { PAD, createPortalFx as createWith, meshyJoints } from './portalFxCore';

const portalMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { t: { value: 0 }, seed: { value: 0 }, open: { value: 0 }, flash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float t, seed, open, flash;
      varying vec2 vUv;
      ${SWIRL_GLSL}
      void main() {
        vec4 c = portal((vUv * 2.0 - 1.0) * ${PAD.toFixed(2)}, t, open, seed);
        if (c.a < 0.004) discard;
        // the flash as it shuts: the whole disc goes to the lip's light
        c.rgb = mix(c.rgb, vec3(0.93, 1.0, 0.7) * c.a, flash);
        gl_FragColor = c;
      }`,
  });

export const createPortalFx = ({ parent }) => createWith({ parent, portalMat });
export { meshyJoints };
