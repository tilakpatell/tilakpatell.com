// The Space Cruiser in 3D for the flight down the Rick and Morty page
// (./CruiserFlight.jsx): the Meshy model of the classic saucer with Rick at
// the wheel and Morty beside him, both sat in their seats (Meshy's seated
// clip) under the glass dome, toon-shaded and
// inked like Portal panic, on a small see-through canvas that the page moves
// about. Here it only turns: pose() points the nose the way it's flying
// (swinging round through facing you as it swoops from one side to the
// other), dips it as it drops, banks it and rolls it into a portal. The
// crew sit on their animators (base 'sit'): Rick takes a pull on his flask
// now and then over the wheel, and Morty throws his hands up when it dives.
// Loaded only where 3D is on; null if anything won't start.

// (The cruiser itself is ./cruiser3dCore.js's; here it's built with the
// GLSL looks and drawn on a canvas of its own, and ./cruiser3dNodes.js
// builds it in nodes.)

import * as THREE from 'three';
import { createMeshyCast } from './portal/meshyCast';
import { inkHull } from '../../lib/three/ink';
import { dress } from './wardrobe/wear';
import { pixelRatio } from '../../lib/device';
import { precompile, quiet, releaseContext } from '../../lib/three/renderer';
import { GLASS, SPAN, buildCruiserWith } from './cruiser3dCore';

export { CANS, CREW, GLASS, TALL, crewLife } from './cruiser3dCore';

// The saucer's dome as glass: everything above the rim (GLASS of the way up
// each mesh, in its own units) see-through face-on and thicker towards its
// edges, so it reads as a bubble with the crew in it. Each mesh gets its own
// copy of its material (in userData.glass, to dispose); returns the rim's
// height in the meshes' units.
export function glassDome(body) {
  let glassY = null;
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const { min, max } = o.geometry.boundingBox;
    glassY = min.y + (max.y - min.y) * GLASS;
    const m = o.material.clone();
    m.transparent = true;
    // (on top of what its material already does to its shaders: its rim of light)
    const before = o.material.onBeforeCompile;
    const key = o.material.customProgramCacheKey;
    m.onBeforeCompile = (s, r) => {
      before?.call(m, s, r);
      s.vertexShader = s.vertexShader.replace('void main() {', 'varying float vGlassY;\nvoid main() {\nvGlassY = position.y;');
      // see-through face on, thicker towards its edges, so it reads as a bubble
      s.fragmentShader = s.fragmentShader
        .replace('void main() {', 'varying float vGlassY;\nvoid main() {\nfloat glass = 0.0;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          glass = smoothstep(${glassY.toFixed(5)} - 0.004, ${glassY.toFixed(5)} + 0.004, vGlassY);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.95, 0.96), glass * 0.6);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          {
            float rim = 1.0 - abs(normal.z);
            diffuseColor.a *= mix(1.0, 0.16 + 0.6 * rim * rim, glass);
          }`,
        );
    };
    m.customProgramCacheKey = () => `${key.call(o.material)}|glass-${glassY}`;
    o.material = m;
    o.userData.glass = m;
  });
  return glassY;
}

export const buildCruiser = buildCruiserWith({ createMeshyCast, inkHull, glassDome, dress });

export async function createCruiser3D(canvas) {
  let renderer;
  try {
    renderer = quiet(new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }));
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const aspect = (canvas.clientHeight || 190) / (canvas.clientWidth || 260);
  const camera = new THREE.OrthographicCamera(-SPAN, SPAN, SPAN * aspect, -SPAN * aspect, 0.1, 60);
  // a little above it, so you see into the cockpit
  camera.position.set(0, 3.6, 12);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x8a94a8, 2.1));
  const sun = new THREE.DirectionalLight(0xfff6e8, 2.3);
  sun.position.set(-4, 9, 7);
  scene.add(sun);

  const cruiser = await buildCruiser();
  if (!cruiser) {
    renderer.dispose();
    return null;
  }
  const ship = cruiser.group;
  let dive = 0; // (pose's v, for the crew)
  scene.add(ship);

  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(pixelRatio(2)); // lib/device: lower on a phone or a weak device
    renderer.setSize(w, h, false);
    const a = h / w;
    camera.top = SPAN * a;
    camera.bottom = -SPAN * a;
    camera.updateProjectionMatrix();
  };
  fit();
  // its shaders linked in the background before its first frame (the flat
  // drawing flies meanwhile), so drawing it doesn't stop the page
  await precompile(renderer, scene, camera);

  return {
    // h: how much it's heading right (-1 left … 1 right), v: down (0 … 1),
    // bank and roll in radians
    pose({ h = 1, v = 0, bank = 0, roll = 0 }) {
      dive = v; // (how steeply it's going down: Morty's nerves)
      // the nose's angle from screen-right round towards you: always a little
      // towards you, so you see who's flying
      const a = 0.4 + ((1 - h) / 2) * (Math.PI - 0.8);
      ship.rotation.set(v * 0.26, Math.PI / 2 - a, bank + roll);
    },
    render(t) {
      cruiser.update(t, { dive });
      renderer.render(scene, camera);
    },
    fit,
    dispose() {
      cruiser.dispose();
      renderer.dispose();
      releaseContext(renderer); // (lib/three/renderer: once nothing is compiling)
    },
  };
}
