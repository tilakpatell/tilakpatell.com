// Each room’s own reflection, made once when the room is built: the room
// alone, lit by its few lamps and its glowing panels, seen from a point in
// it into a small cube, then prefiltered for rough and glossy surfaces. The
// decks are near-black mirrors and the walls half-metal, so it is this that
// puts the light grids, the strips overhead and the Falcon into the floor;
// one per room, not one for the station, so a corridor never reflects the
// bay next door.
//
//   makeProbe(renderer, group, at, { lamps, size }) → { envMap, dispose }
//     (a 128-texel cube by default; `group` is lent to the picture and put back where it was)
//   applyProbe(group, envMap) → release()   every material under `group` marked
//     `userData.reflect` swapped for the room’s own copy holding the probe;
//     release() puts the shared ones back and frees the copies
//   probeRoom(renderer, group, at, { lamps }) → { envMap, dispose }   both at once; nothing
//     without a renderer (a room built for a test or before the canvas)

import * as THREE from 'three';

// (the panels light nothing but themselves in the picture: a dim cool fill
// keeps the walls from going black where no lamp reaches)
const FILL = { color: 0x7d8aa0, intensity: 0.35 };

export function makeProbe(renderer, group, at, { lamps = [], size = 128, near = 0.05, far = 400 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const parent = group.parent;
  // (lent shown: the stream hides a room nobody can see, and a probe made then would be black)
  const shown = group.visible;
  group.visible = true;
  scene.add(group);
  const lights = lamps.map((l) => {
    const p = new THREE.PointLight(l.color, l.intensity, l.distance, 2);
    p.position.set(l.x, l.y, l.z);
    scene.add(p);
    return p;
  });
  scene.add(new THREE.AmbientLight(FILL.color, FILL.intensity));
  // half floats, so a light grid stays brighter than white in the reflection
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  const camera = new THREE.CubeCamera(near, far, target);
  camera.position.set(at.x, at.y, at.z);
  let env = null;
  try {
    camera.update(renderer, scene);
    const pmrem = new THREE.PMREMGenerator(renderer);
    env = pmrem.fromCubemap(target.texture);
    pmrem.dispose();
  } finally {
    target.dispose();
    for (const l of lights) l.dispose();
    scene.remove(group);
    group.visible = shown;
    parent?.add(group);
  }
  return { envMap: env.texture, dispose: () => env.dispose() };
}

function applyProbe(group, envMap) {
  const copies = new Map();
  const swapped = [];
  group.traverse((o) => {
    if (!o.isMesh || !o.material?.userData?.reflect) return;
    let copy = copies.get(o.material);
    if (!copy) {
      copy = o.material.clone();
      copy.envMap = envMap;
      copies.set(o.material, copy);
    }
    swapped.push([o, o.material]);
    o.material = copy;
  });
  return () => {
    for (const [o, shared] of swapped) o.material = shared;
    for (const c of copies.values()) c.dispose();
    copies.clear();
    swapped.length = 0;
  };
}

const NONE = { envMap: null, dispose() {} };

export function probeRoom(renderer, group, at, { lamps = [] } = {}) {
  if (!renderer) return NONE;
  let probe = null;
  try {
    probe = makeProbe(renderer, group, at, { lamps });
  } catch {
    // a graphics chip that can’t draw into a half-float cube: the room is
    // drawn without its reflection rather than not at all
    return NONE;
  }
  const release = applyProbe(group, probe.envMap);
  return {
    envMap: probe.envMap,
    dispose() {
      release();
      probe.dispose();
    },
  };
}
