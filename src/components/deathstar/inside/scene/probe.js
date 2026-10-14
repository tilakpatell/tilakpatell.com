// Each room’s own reflection, made once when the room is built: the room
// alone, lit by its few lamps and its glowing panels, seen from a point in
// it into a small cube, then prefiltered for rough and glossy surfaces. The
// decks are near-black mirrors and the walls half-metal, so it is this that
// puts the light grids, the strips overhead and the Falcon into the floor;
// one per room, not one for the station, so a corridor never reflects the
// bay next door. On the node renderer the cube and its prefilter are its
// own (three/webgpu’s): the classic ones draw with GLSL it can’t run.
//
//   makeProbe(renderer, group, at, { lamps, size }) → { envMap, dispose }
//     (a 128-texel cube by default; `group` is lent to the picture and put back where it was)
//   applyProbe(group, envMap) → release()   every material under `group` marked
//     `userData.reflect` swapped for the room’s own copy holding the probe;
//     release() puts the shared ones back and frees the copies
//   probeRoom(renderer, group, at, { lamps }) → { envMap, dispose }   both at once; nothing
//     without a renderer (a room built for a test or before the canvas)

import * as THREE from 'three';
import { CubeRenderTarget, PMREMGenerator } from 'three/webgpu';
import { guardOf } from '../../../../lib/three/pipelineGuard';

// (the panels light nothing but themselves in the picture: a dim cool fill
// keeps the walls from going black where no lamp reaches)
const FILL = { color: 0x7d8aa0, intensity: 0.35 };

// The node renderer on WebGPU leaves out of a frame whatever it has not
// built yet (lib/three/pipelineGuard), so the first picture of a room may
// miss most of it: it is taken again, into the same texture, through the
// same scene, lamps and cube (so what was built for the first is what the
// next draws), once nothing is on its way, until one is drawn whole.
const AGAIN = { every: 150, tries: 40 }; // ms between looks, and how many before it gives up
// (nothing being built: no pipeline being made, no shader queued)
const quiet = (renderer, guard) => guard.pending() === 0 && !renderer._nodes?._buildInProgress && !(renderer._nodes?._buildQueue?.length > 0);
const later = (fn) => setTimeout(fn, AGAIN.every);

export function makeProbe(renderer, group, at, { lamps = [], size = 128, near = 0.05, far = 400 } = {}) {
  const node = Boolean(renderer.isWebGPURenderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const lights = lamps.map((l) => {
    const p = new THREE.PointLight(l.color, l.intensity, l.distance, 2);
    p.position.set(l.x, l.y, l.z);
    scene.add(p);
    return p;
  });
  scene.add(new THREE.AmbientLight(FILL.color, FILL.intensity));
  // half floats, so a light grid stays brighter than white in the reflection
  const target = new (node ? CubeRenderTarget : THREE.WebGLCubeRenderTarget)(size, { type: THREE.HalfFloatType });
  const camera = new THREE.CubeCamera(near, far, target);
  camera.position.set(at.x, at.y, at.z);
  let pmrem = null;
  let env = null;
  let freed = false;
  const free = () => {
    if (freed) return;
    freed = true;
    pmrem?.dispose();
    target.dispose();
    for (const l of lights) l.dispose();
  };
  // the room’s picture, prefiltered (into the same texture, a second time)
  const shoot = () => {
    const parent = group.parent;
    // (lent shown: the stream hides a room nobody can see, and a probe made then would be black)
    const shown = group.visible;
    group.visible = true;
    scene.add(group);
    try {
      camera.update(renderer, scene);
      pmrem ??= new (node ? PMREMGenerator : THREE.PMREMGenerator)(renderer);
      env = pmrem.fromCubemap(target.texture, env);
    } finally {
      scene.remove(group);
      group.visible = shown;
      parent?.add(group);
    }
  };
  const guard = node ? guardOf(renderer) : null;
  try {
    shoot();
  } finally {
    if (!guard || !env) free();
  }
  let gone = false;
  if (guard) {
    let tries = 0;
    const look = () => {
      if (gone || tries++ >= AGAIN.tries) return free();
      if (!quiet(renderer, guard)) return later(look);
      const before = { held: guard.held(), pending: guard.pending() };
      try {
        shoot();
      } catch {
        // (the picture already in it stays)
        return free();
      }
      if (guard.held() === before.held && guard.pending() === before.pending) free();
      else later(look);
    };
    later(look);
  }
  return {
    envMap: env.texture,
    dispose: () => {
      gone = true;
      free();
      env.dispose();
    },
  };
}

export function applyProbe(group, envMap) {
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
