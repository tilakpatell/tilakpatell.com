// A Middle-earth stage's grade: lib/stage3d's GRADE after the classic
// chain's OutputPass (an EffectComposer: RenderPass, OutputPass, ShaderPass)
// against lib/three/stage3dNodes's gradeNode in a node pipeline. The case's
// own render on each side: a lit scene with colours from dark to over
// white, the house's Neutral tone map at an exposure over 1; the grade as
// the stages set it (one plain, one cold and dark, as Mordor's), its grain
// at 0 (a noise a pixel, the same nowhere).
import * as THREE from "three";
import { RenderPipeline } from "three/webgpu";
import { pass } from "three/tsl";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GRADE } from "../../../src/lib/stage3d.js";
import {
  gradeNode,
  gradeUniforms,
} from "../../../src/lib/three/stage3dNodes.js";

const LOOKS = {
  plain: {},
  mordor: {
    uContrast: 0.2,
    uSat: 0.8,
    uVignette: 0.42,
    uShadow: [0.012, 0.004, 0],
    uHigh: [0.03, 0.012, 0],
  },
};

const fill = (scene, camera) => {
  scene.background = new THREE.Color(0x101820);
  const colours = [0x202020, 0x7a2408, 0x3a7a2c, 0x5c86c8, 0xf0e0c0];
  colours.forEach((c, i) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 32, 16),
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.6,
        emissive: i === 4 ? 0xffd090 : 0,
        emissiveIntensity: 1.5,
      }),
    );
    m.position.set((i - 2) * 1.6, 0.5, 0);
    scene.add(m);
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.9 }),
  );
  floor.position.y = -0.3;
  scene.add(floor);
  camera.position.set(0, 2.5, 7);
  camera.lookAt(0, 0.3, 0);
};
const set = (u, look, read) => {
  for (const [k, v] of Object.entries({ uGrain: 0, uAspect: 1, ...look })) {
    if (Array.isArray(v)) read(u[k]).setRGB(...v);
    else if (u[k].value?.isColor) read(u[k]).copy(v);
    else u[k].value = v;
  }
};
const tone = (r) => {
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1.2;
};

const node =
  (look) =>
  ({ scene, camera, renderer }) => {
    fill(scene, camera);
    const u = gradeUniforms();
    set(u, LOOKS[look], (x) => x.value);
    const pipeline = new RenderPipeline(renderer);
    pipeline.outputColorTransform = false;
    pipeline.outputNode = gradeNode(u)(pass(scene, camera).getTextureNode());
    return { render: () => (tone(renderer), pipeline.render()) };
  };
const classic =
  (look) =>
  ({ scene, camera, renderer }) => {
    fill(scene, camera);
    const composer = new EffectComposer(
      renderer,
      new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType }),
    );
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new OutputPass());
    const g = new ShaderPass(GRADE);
    set(g.uniforms, LOOKS[look], (x) => x.value);
    composer.addPass(g);
    return { render: () => (tone(renderer), composer.render()) };
  };

export default {
  "middleearth:stage:grade": { node: node("plain"), classic: classic("plain") },
  "middleearth:stage:grade:mordor": {
    node: node("mordor"),
    classic: classic("mordor"),
  },
};
