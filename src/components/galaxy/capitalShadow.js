// The sun's shadow on the capital ships, as the films' models and the 2017
// game's capitals have it: the bridge tower's across the deck, each tier's
// on the one under it, the trenches dark. One shadow map, the sun's, fitted
// round the capital that fills the most of the view (its bounding sphere
// over its distance; held until another fills 1.3 times as much, so it
// doesn't flick between two side by side), and drawn again each frame
// there's one: the box centred on that ship, never snapped to a grid, so
// the texels ride with it and its shadows hold still as it flies. Only the
// capitals cast and take it (shadowed(), on a capital as it loads): the
// fighters and the rest neither, so the map holds what it's for.
//
// It's on for the whole flight, wherever a device has shadows: a computer at
// mid and up (lib/device's budget().shadows, its map 1,024 at mid, 2,048 at
// high, 3,072 at most), never a phone. On from the start, before anything is
// compiled: every lit shader in the scene is made once, with the shadow in
// it, so nothing is made again when a capital comes into view.
//
// The galaxy's suns sit 100 out along their way with their targets at the
// middle (./scene.js, ./areaLook.js set them so): place() moves the sun's
// light and its target together onto the ship (its way, so its light,
// unchanged) for the frame's drawing, and home() puts them back after it.
//
//   shadowSize(device, budget) → the map's size, 0 for none
//   createCapitalShadows({ renderer, sun, size }) → { place(camera, slots),
//     home(), focus, dispose() (the renderer's shadows as they were) } | null
//     (none: size 0)
//   focusOf(camera, slots, held) → the slot to fit to, or null
//   fitShadow(centre, radius, way, size) → { target, position, half, near,
//     far, bias, normalBias } (the box and its biases, in the world's units)
//   shadowed(root) → root (its meshes cast and take the shadow, but glass
//     and glows)

import * as THREE from 'three';
import { isCapital } from './capitalLook';

const MOST = 3072;
const HOLD = 1.3; // how much more of the view another capital must fill to take the shadow over
const LEAST = 0.02; // a capital smaller than this in the view (its radius over its distance) has no shadow drawn
// the ship's bounding sphere as a share of its length (a Star Destroyer's
// wedge, 0.6 as wide as it is long, its tower 0.25 high: half its diagonal)
const REACH = 0.62;

export const shadowSize = (dev, b) => (dev.phone || !b.shadows ? 0 : Math.min(b.shadowMap ?? 0, MOST));

// the shadow camera's box round a ship: square on the sun's way, as deep as
// the ship and as far again on the sun's side (so the box clears it); the
// biases a texel or so, the normal's in the world's units, the depth's in the
// box's [0, 1]
export function fitShadow(centre, radius, way, size) {
  const back = radius * 2;
  const target = centre.clone();
  const position = centre.clone().addScaledVector(way, back);
  const half = radius;
  const near = back - radius * 1.1;
  const far = back + radius * 1.1;
  const texel = (2 * half) / size;
  return { target, position, half, near, far, bias: -(texel * 0.5) / (far - near), normalBias: texel * 1.5 };
}

const shown = (o) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};
const scale = new THREE.Vector3();
const sphere = new THREE.Sphere();
const frustum = new THREE.Frustum();
const m = new THREE.Matrix4();

// how much of the view a capital's slot fills (its radius over its distance),
// 0 when it isn't in the view, isn't loaded or isn't out there; its sphere in `out`
function share(s, camera, out) {
  if (!s?.real || !isCapital(s.kind) || !s.holder.parent || !shown(s.holder)) return 0;
  s.holder.getWorldPosition(out.center);
  s.holder.getWorldScale(scale);
  out.radius = s.size * scale.x * REACH;
  if (!frustum.intersectsSphere(out)) return 0;
  return out.radius / Math.max(out.center.distanceTo(camera.position), out.radius * 0.5);
}

export function focusOf(camera, slots, held = null) {
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let best = null;
  let most = LEAST;
  for (const s of slots) {
    const k = share(s, camera, sphere);
    if (k > most) {
      best = s;
      most = k;
    }
  }
  const kept = held && held !== best ? share(held, camera, sphere) : 0;
  return kept >= LEAST && kept * HOLD > most ? held : best;
}

export function shadowed(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const on = !o.userData.glows && ![o.material].flat().some((x) => x?.transparent);
    o.castShadow = on;
    o.receiveShadow = on;
  });
  return root;
}

export function createCapitalShadows({ renderer, sun, size = 0 }) {
  if (!size) return null;
  // (the runtime's renderer: shared with whatever world comes next, so its shadows go back as they were at dispose)
  const was = { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type, autoUpdate: renderer.shadowMap.autoUpdate };
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // (drawn when there's a capital to fit, not every frame regardless)
  renderer.shadowMap.autoUpdate = false;
  sun.castShadow = true;
  sun.shadow.mapSize.set(size, size);
  const cam = sun.shadow.camera;
  const home = { at: new THREE.Vector3(), target: new THREE.Vector3(), out: false };
  const way = new THREE.Vector3();
  const centre = new THREE.Sphere();
  let focus = null;
  // (no capital to fit: every point reads off the map, so lit: a capital
  // out of the view, or too small in it, never takes the last one's shadows,
  // left where they were, nor the empty map's before any)
  const park = () => sun.shadow.matrix.makeScale(0, 0, 0).setPosition(2, 2, 2);
  park();
  return {
    get focus() {
      return focus;
    },
    // fitted round the capital that fills most of the view, for this frame's drawing
    place(camera, slots) {
      const held = focus;
      focus = focusOf(camera, slots, focus);
      if (!focus && held) park();
      if (!focus || home.out) return;
      share(focus, camera, centre);
      home.at.copy(sun.position);
      home.target.copy(sun.target.position);
      way.copy(sun.position).sub(sun.target.position).normalize();
      // (a sun straight overhead: the box squared to the z axis instead)
      cam.up.set(0, Math.abs(way.y) > 0.99 ? 0 : 1, Math.abs(way.y) > 0.99 ? 1 : 0);
      const fit = fitShadow(centre.center, centre.radius, way, size);
      sun.target.position.copy(fit.target);
      sun.position.copy(fit.position);
      sun.updateMatrixWorld();
      sun.target.updateMatrixWorld();
      Object.assign(cam, { left: -fit.half, right: fit.half, top: fit.half, bottom: -fit.half, near: fit.near, far: fit.far });
      cam.updateProjectionMatrix();
      sun.shadow.bias = fit.bias;
      sun.shadow.normalBias = fit.normalBias;
      renderer.shadowMap.needsUpdate = true;
      home.out = true;
    },
    // the sun back where the scene keeps it (after the frame's drawn)
    home() {
      if (!home.out) return;
      sun.position.copy(home.at);
      sun.target.position.copy(home.target);
      home.out = false;
    },
    dispose() {
      focus = null;
      sun.castShadow = false;
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      Object.assign(renderer.shadowMap, was);
    },
  };
}
