// The Mario 64 tribute’s GLSL, as it was drawn on the classic renderer:
// kept for the parity check (../cases/mario64.js) and for the tests that
// hold each twin to it (src/components/mario64/nodes.test.js and
// looks.test.js). The world draws on the node renderer now, every one of
// these replaced by its twin in mario64/nodes.js (and the look by
// mario64/looks.js’s chain), so nothing the site builds imports this file:
// WebGPURenderer can’t run a patched shader or an EffectComposer. It lives
// here, beside the check that reads it, and not under src/, because the
// world’s GLSL is gone from the site once it is ported (glsl-sites counts
// src/ only); lane FL4 deletes it with the other originals.
//
//   splatMaterial(mats, small) → Promise<MeshStandardMaterial>   (scene.js’s)
//   paintingMaterial(art) → { material, uniforms: { uRipple, uTime } }   (things.js’s painting)
//   waterfallMaterial() → { material, uniforms: { uTime } }   (things.js’s waterfall)
//   makeLook(renderer, scene, camera, { bloom }) → { render(), setSize(w, h),
//     setLook(name), setBloom(on), look, dispose() }   (looks.js’s composer)

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { loadSet } from '../../../src/components/avengers/hq/assets';
import { SCALE } from '../../../src/components/mario64/courses/index';
import { S } from '../../../src/components/mario64/scene';
import { MATS } from '../../../src/components/mario64/textures';

// (looks.js’s own, which it no longer exports: lane FL1’s sweep)
const LOOK_NAMES = ['modern', 'ultra', 'n64'];

// The terrain's material: three sets blended by the splat attribute. The
// first is the base (its uv is the kit's, x/z over its scale); the others are
// sampled at their own scales, and the second (rock) is projected on three
// planes by the normal, so cliffs aren't stretched. (Only the colour’s
// patch ever took: the normal’s, roughness’s and ao’s look for lines that
// are still #include lines when onBeforeCompile sees them; ./nodes.js.)
export async function splatMaterial(mats, small) {
  const sets = await Promise.all(mats.map((k) => loadSet(MATS[k]?.set, { small })));
  const tint = mats.map((k) => new THREE.Color(MATS[k]?.tint ?? '#ffffff').multiplyScalar(MATS[k]?.boost ?? 1));
  const base = sets[0];
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
  if (!base || !sets[1] || !sets[2]) {
    m.color = tint[0];
    return m;
  }
  m.map = base.map;
  m.normalMap = base.normalMap;
  m.roughnessMap = base.arm;
  m.aoMap = base.arm;
  const s0 = SCALE[mats[0]] ?? 500;
  const uniforms = {
    uMap1: { value: sets[1].map },
    uMap2: { value: sets[2].map },
    uNrm1: { value: sets[1].normalMap },
    uNrm2: { value: sets[2].normalMap },
    uArm1: { value: sets[1].arm },
    uArm2: { value: sets[2].arm },
    uTint0: { value: tint[0] },
    uTint1: { value: tint[1] },
    uTint2: { value: tint[2] },
    uS1: { value: s0 / (SCALE[mats[1]] ?? 500) },
    uS2: { value: s0 / (SCALE[mats[2]] ?? 500) },
    uRockScale: { value: 1 / ((SCALE[mats[1]] ?? 600) * S) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 splat;\nvarying vec3 vSplat;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat;\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uMap1, uMap2, uNrm1, uNrm2, uArm1, uArm2;
        uniform vec3 uTint0, uTint1, uTint2;
        uniform float uS1, uS2, uRockScale;
        varying vec3 vSplat;
        varying vec3 vWPos;
        varying vec3 vWNrm;
        vec4 tri(sampler2D t) {
          vec3 w = pow(abs(vWNrm), vec3(4.0));
          w /= (w.x + w.y + w.z);
          vec3 p = vWPos * uRockScale;
          return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `vec4 c0 = texture2D(map, vMapUv) * vec4(uTint0, 1.0);
        vec4 c1 = tri(uMap1) * vec4(uTint1, 1.0);
        vec4 c2 = texture2D(uMap2, vMapUv * uS2) * vec4(uTint2, 1.0);
        // the rock shows through where the splat says, sharpened by the texture's own light and dark
        vec3 sw = vSplat;
        sw.y = clamp(sw.y * (0.7 + c1.g * 0.6), 0.0, 1.0);
        sw /= max(0.001, sw.x + sw.y + sw.z);
        diffuseColor *= c0 * sw.x + c1 * sw.y + c2 * sw.z;`,
      )
      .replace(
        'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        'vec3 mapN = (texture2D( normalMap, vNormalMapUv ).xyz * sw.x + texture2D( uNrm1, vNormalMapUv * uS1 ).xyz * sw.y + texture2D( uNrm2, vNormalMapUv * uS2 ).xyz * sw.z) * 2.0 - 1.0;',
      )
      .replace(
        'vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );',
        'vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv ) * sw.x + tri( uArm1 ) * sw.y + texture2D( uArm2, vRoughnessMapUv * uS2 ) * sw.z;',
      )
      .replace(
        'float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;',
        'float ambientOcclusion = ( (texture2D( aoMap, vAoMapUv ).r * sw.x + tri( uArm1 ).r * sw.y + texture2D( uArm2, vAoMapUv * uS2 ).r * sw.z) - 1.0 ) * aoMapIntensity + 1.0;',
      );
  };
  return m;
}

// a painting's canvas, rippling out from its middle when he jumps in
export function paintingMaterial(art) {
  const mat = art ? new THREE.MeshStandardMaterial({ map: art, roughness: 0.7 }) : new THREE.MeshStandardMaterial({ color: '#7fb0e0' });
  const uniforms = { uRipple: { value: 0 }, uTime: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRipple = uniforms.uRipple;
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uRipple; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float d = length(position.xy);
        transformed.z += uRipple * 0.12 * sin(d * 9.0 - uTime * 10.0) * exp(-d * 0.6);`);
  };
  return { material: mat, uniforms };
}

// the waterfall's sheet: glassy water with bright streaks running down it
export function waterfallMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({ color: '#cfeeff', roughness: 0.1, transmission: 0.4, transparent: true, opacity: 0.75, emissive: '#7fc8ff', emissiveIntensity: 0.15 });
  const uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec2 vUv2;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float streak = sin(vUv2.x * 80.0) * 0.5 + 0.5;
        float flow = fract(vUv2.y * 3.0 + uTime * 1.6 + streak * 0.3);
        gl_FragColor.rgb += vec3(0.25) * smoothstep(0.7, 1.0, flow) * streak;`);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUv2 = uv;');
  };
  return { material: mat, uniforms };
}

// How the picture is finished. Modern: the scene, a light bloom, ACES tone
// mapping (in the output pass). Ultra and N64 come with the looks slice; until
// then they draw as Modern.
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
    // (for the tests: the twin's chain is held to this one's passes)
    composer,
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
