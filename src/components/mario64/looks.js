// How the picture is finished. Modern: the scene, a light bloom, ACES tone
// mapping (in the output pass). Ultra and N64 come with the looks slice; until
// then they draw as Modern.
//
// makeLook(renderer, scene, camera, { bloom }) → { render(), setSize(w, h),
//   setLook(name), dispose() }

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const LOOK_NAMES = ['modern', 'ultra', 'n64'];

export function makeLook(renderer, scene, camera, { bloom = true } = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const glow = new UnrealBloomPass(new THREE.Vector2(Math.max(1, size.x), Math.max(1, size.y)), 0.32, 0.55, 0.92);
  glow.enabled = bloom;
  composer.addPass(glow);
  composer.addPass(new OutputPass());
  let look = 'modern';
  return {
    render() {
      composer.render();
    },
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
    setLook(name) {
      look = LOOK_NAMES.includes(name) ? name : 'modern';
      return look;
    },
    setBloom(on) {
      glow.enabled = on;
    },
    get look() {
      return look;
    },
    dispose() {
      composer.dispose();
    },
  };
}
