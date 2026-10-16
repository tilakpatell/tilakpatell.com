// The galaxy’s planets: bodies.js against nodes/bodies.js, each world built
// as world.js builds it (lit by one or two suns, its clock at 12.5 s), its
// surface, its atmosphere’s shell and, on Scarif, its shield struck by a
// ship. A world of each family from orbit (on high, where the ground is
// worked finer from orbit: nearOctaves, and the fine grain over it),
// skimmed close (the scans in), and on ultra; a skinned world (the game’s maps,
// waited for on both sides). Deterministic: the near octaves set to what the
// frame would ease them to, the textures loaded before the pictures.
import * as THREE from 'three';
import * as BO from '../../../src/components/galaxy/bodies.js';
import * as BN from '../../../src/components/galaxy/nodes/bodies.js';
import { setQuality } from '../../../src/lib/device.js';

const R = 40;
const SUNS = [
  { dir: new THREE.Vector3(0.8, 0.35, 0.5).normalize(), color: new THREE.Color(1.25, 1.2, 1.1) },
  { dir: new THREE.Vector3(-0.6, -0.2, 0.7).normalize(), color: new THREE.Color(0.35, 0.3, 0.5) },
];
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

// eye and target in radii, from the planet’s middle
const bodyCase = (B, { look, tier = 'high', eye, at = [0, 0, 0], suns = 1, shield = false, wait = true, spin = 0 }) => async ({ scene, camera }) => {
  scene.background = new THREE.Color(0x000000);
  camera.near = 0.05;
  camera.far = 4000;
  camera.position.set(...eye.map((v) => v * R));
  camera.lookAt(...at.map((v) => v * R));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  // (the page’s level the case’s tier, as the scans read it: SwiftShader alone grades low)
  setQuality(tier);
  const b = B.buildBody(look, { r: R, tier });
  setQuality('auto');
  b.group.rotation.set(0.2, spin, 0.1);
  scene.add(b.group);
  b.setSuns(SUNS.slice(0, suns));
  const u = b.surface.material.uniforms;
  // (the scans and the skin in on both sides before anything’s drawn)
  if (wait) {
    for (let i = 0; i < 200; i++) {
      const scans = !u.uDetK || u.uDetK.value.w === 1;
      const skin = !u.uSkinColor || !u.uSkinColor.value.isDataTexture;
      if (scans && skin) break;
      await settle(50);
    }
  }
  if (shield) {
    b.set('shield', 1);
    b.update(12.2, camera);
    b.hit(new THREE.Vector3(...eye).normalize().multiplyScalar(R * 1.12).add(new THREE.Vector3(6, 4, 0)));
  }
  b.update(12.5, camera);
  const px = BO.pxTall({ r: R, dist: camera.position.length(), fov: camera.fov, height: 256 });
  u.uNearOct.value = BO.nearOctaves({ tier, pxTall: px });
  return { tick: () => b.update(12.5, camera) };
};
const pair = (opts) => ({ node: bodyCase(BN, opts), classic: bodyCase(BO, opts) });

const ORBIT = [0.6, 0.9, 2.9];
const LIMB = [2.2, 0.5, 1.6];
// (skimming: a few hundredths of a radius up, looking along the ground)
const LOW = [0.05, 1.005, 0.12];
const AHEAD = [0.2, 0.985, -0.25];

export default {
  'galaxy-bodies:tatooine-orbit': pair({ look: 'tatooine', eye: ORBIT }),
  'galaxy-bodies:tatooine-low': pair({ look: 'tatooine', eye: LOW, at: AHEAD }),
  'galaxy-bodies:tatooine-ultra': pair({ look: 'tatooine', tier: 'ultra', eye: ORBIT }),
  'galaxy-bodies:geonosis-low': pair({ look: 'geonosis', eye: LOW, at: AHEAD }),
  'galaxy-bodies:mandalore-orbit': pair({ look: 'mandalore', eye: LIMB, suns: 2 }),
  'galaxy-bodies:hoth-orbit': pair({ look: 'hoth', eye: ORBIT, tier: 'mid' }),
  'galaxy-bodies:hoth-low': pair({ look: 'hoth', eye: LOW, at: AHEAD }),
  'galaxy-bodies:kashyyyk-orbit': pair({ look: 'kashyyyk', eye: ORBIT }),
  'galaxy-bodies:yavin4-limb': pair({ look: 'yavin4', eye: LIMB, suns: 2 }),
  'galaxy-bodies:dagobah-low': pair({ look: 'dagobah', eye: LOW, at: AHEAD }),
  'galaxy-bodies:scarif-shield': pair({ look: 'scarif', eye: ORBIT, shield: true }),
  'galaxy-bodies:kamino-storms': pair({ look: 'kamino', eye: ORBIT, tier: 'low' }),
  'galaxy-bodies:naboo-skin': pair({ look: 'naboo', eye: ORBIT }),
  'galaxy-bodies:coruscant-night': pair({ look: 'coruscant', eye: [-1.2, -0.9, 2.2], spin: 2.4 }),
  'galaxy-bodies:mustafar-orbit': pair({ look: 'mustafar', eye: ORBIT }),
  'galaxy-bodies:nevarro-low': pair({ look: 'nevarro', eye: LOW, at: AHEAD }),
  'galaxy-bodies:yavin-giant': pair({ look: 'yavin', eye: ORBIT, suns: 2 }),
  'galaxy-bodies:moon-grey': pair({ look: 'moon-grey', eye: ORBIT }),
  'galaxy-bodies:moon-ice-low': pair({ look: 'moon-ice', eye: LOW, at: AHEAD }),
};
